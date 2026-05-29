import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { getWasmModule } from '../utils/wasm-loader'
import { subscribe } from '../utils/raf-coordinator'

// 6 klassische Julia-Parametersätze
const JULIA_PARAMS = [
  { cx: -0.7,    cy:  0.27015, label: 'DENDRITE'  },
  { cx:  0.285,  cy:  0.01,    label: 'DRAGON'    },
  { cx: -0.4,    cy:  0.6,     label: 'SPIRAL'    },
  { cx:  0.45,   cy:  0.1428,  label: 'RABBIT'    },
  { cx: -0.8,    cy:  0.156,   label: 'SEAHORSE'  },
  { cx:  0.285,  cy:  0.013,   label: 'SNOWFLAKE' },
]

// Wiederverwendete Map fuer isLowDetail(). Bewusst auf Modul-Ebene, NICHT pro
// Aufruf neu angelegt: isLowDetail() laeuft im rAF-Loop nach jedem Render-Tick,
// pro Frame entstehen ~30 000 Map.set-Operationen. Eine frische Map pro Frame
// summiert sich zu spuerbarem GC-Druck (siehe AUDIT_FINDINGS.md F-002). JS ist
// single-threaded und der Aufruf laeuft synchron durch -- clear() am Eingang
// reicht.
const _isLowDetailCounts = new Map<number, number>()

function isLowDetail(pixels: Uint8ClampedArray): boolean {
  let black = 0
  // Map wiederverwenden statt neu allokieren.
  const colorCounts = _isLowDetailCounts
  colorCounts.clear()
  const sampleStep = 64 // Sample every 16th pixel (RGBA = 4 bytes)
  let total = 0

  for (let i = 0; i < pixels.length; i += sampleStep) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    if (r === 0 && g === 0 && b === 0) {
      black++
    }

    const colorKey = (r << 16) | (g << 8) | b
    colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1)
    total++
  }

  if (total === 0) return true
  if (black / total > 0.95) return true

  let maxCount = 0
  for (const count of colorCounts.values()) {
    if (count > maxCount) {
      maxCount = count
    }
  }

  if (maxCount / total > 0.95) return true
  return false
}

function findBoundaryNonBlack(pixels: Uint8ClampedArray, W: number, H: number): { px: number, py: number } | null {
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)

  const isBlack = (x: number, y: number) => {
    const idx = (y * W + x) * 4
    return pixels[idx] === 0 && pixels[idx + 1] === 0 && pixels[idx + 2] === 0
  }

  const maxRadius = Math.min(cx, cy) - 2
  for (let r = 1; r < maxRadius; r += 2) {
    const numSamples = Math.min(64, 4 * r)
    for (let si = 0; si < numSamples; si++) {
      const angle = (si * 2 * Math.PI) / numSamples
      const px = Math.round(cx + r * Math.cos(angle))
      const py = Math.round(cy + r * Math.sin(angle))

      if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue

      const centerIsBlack = isBlack(px, py)
      const neighbors = [
        isBlack(px - 1, py), isBlack(px + 1, py),
        isBlack(px, py - 1), isBlack(px, py + 1),
      ]
      const isBoundary = neighbors.some(n => n !== centerIsBlack)

      if (isBoundary) {
        if (!centerIsBlack) return { px, py }
        if (!neighbors[0]) return { px: px - 1, py }
        if (!neighbors[1]) return { px: px + 1, py }
        if (!neighbors[2]) return { px, py: py - 1 }
        if (!neighbors[3]) return { px, py: py + 1 }
      }
    }
  }
  return null
}

function FractalJulia() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    const canvas: HTMLCanvasElement      = _canvas
    const ctx: CanvasRenderingContext2D  = _ctx

    let cancelled = false
    let isVisible = true
    let unsubscribe: (() => void) | null = null
    let activeFrame: ((t: number) => void) | null = null

    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
      if (isVisible) {
        if (!unsubscribe && activeFrame && !cancelled) {
          unsubscribe = subscribe(activeFrame)
        }
      } else {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
      }
    })
    io.observe(canvas)

    const MAX_PIXELS = 240000
    let RENDER_W = 320
    let RENDER_H = 213
    let buf: Uint8Array
    let pixels: Uint8ClampedArray
    let imgData: ImageData

    const syncSize = () => {
      const container = containerRef.current
      if (!container) return
      const cw = container.clientWidth  || 300
      const ch = container.clientHeight || 200
      const pixelsCount = cw * ch
      const scale = pixelsCount > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / pixelsCount) : 1
      const w = Math.round(cw * scale)
      const h = Math.round(ch * scale)
      if (canvas.width !== w || canvas.height !== h || !buf) {
        canvas.width  = w
        canvas.height = h
        RENDER_W = w
        RENDER_H = h
        buf = new Uint8Array(w * h * 4)
        pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
        imgData = new ImageData(pixels as any, w, h)
      }
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    const container = containerRef.current
    if (container) ro.observe(container)

    const s = {
      paramIdx:   0,
      zoom:       180,
      centerX:    0.0,
      centerY:    0.0,
      zoomDirection: 1, // 1 = zoom in, -1 = zoom out
      angle:      Math.random() * Math.PI * 2,
      driftAngle: Math.random() * Math.PI * 2,
      lastFrame:  performance.now(),
      directionTime: 0,
      // Frame-Zaehler fuer Throttling von findBoundaryNonBlack() und
      // isLowDetail(). Siehe AUDIT_FINDINGS.md H-01/H-02.
      frameCount: 0,
      // Cache fuer den letzten Low-Detail-Wert (wird nur alle paar Frames
      // neu berechnet, aber in der Zoom-Logik bei jedem Frame gelesen).
      cachedLowDetail: false,
    }

    getWasmModule()
      .then((wasm) => {
        if (cancelled) return

        const { render_julia } = wasm

        const frame = (now: number) => {
          if (cancelled) return

          if (canvas.width === 0 || canvas.height === 0) {
            syncSize()
            s.lastFrame = now
            return
          }

          const dt = Math.max(1, Math.min(100, now - s.lastFrame))
          s.lastFrame = now
          s.directionTime += dt
          s.frameCount++

          // ── Normal Render ──
          // Exponential zoom
          if (s.zoomDirection === 1) {
            const zoomRate = Math.pow(1.018, dt / 16.7)
            s.zoom *= zoomRate
          } else {
            // Warp zoom-out speed to minimize black screen time
            const zoomRateOut = Math.pow(1.100, dt / 16.7)
            s.zoom /= zoomRateOut
          }

          // Slow rotation and tumbling
          s.angle += 0.004 * (dt / 16.7) * s.zoomDirection
          
          // Tumbling
          const factor = s.zoomDirection === 1 ? 0.05 : 1.0
          const tumbleAmp = (0.03 / s.zoom) * factor
          s.centerX += Math.sin(now * 0.0005) * tumbleAmp
          s.centerY += Math.cos(now * 0.0007) * tumbleAmp

          // Constant scaled drift
          s.driftAngle += 0.008 * (dt / 16.7)
          const driftDist = (0.42 / s.zoom) * factor
          s.centerX += Math.cos(s.driftAngle) * driftDist
          s.centerY += Math.sin(s.driftAngle) * driftDist

          // Render Julia
          const currentParam = JULIA_PARAMS[s.paramIdx]
          try {
            render_julia(
              buf,
              RENDER_W,
              RENDER_H,
              currentParam.cx,
              currentParam.cy,
              s.centerX,
              s.centerY,
              s.zoom,
              250, // Higher iterations for deeper zoom details
              s.angle
            )

            // Apply feedback correction (only when zooming in to steer toward colored details).
            // Drosselung auf jeden 4. Frame: findBoundaryNonBlack ist O(maxRadius)
            // pro Suche und wird bei tiefem Zoom teuer. Steuerung braucht das
            // nicht jeden Frame. Vgl. AUDIT_FINDINGS.md H-01.
            if (s.zoomDirection === 1 && s.zoom > 300 && (s.frameCount & 3) === 0) {
              const boundary = findBoundaryNonBlack(pixels, RENDER_W, RENDER_H)
              if (boundary) {
                // Convert boundary pixel to complex coordinate
                const cos_a = Math.cos(s.angle)
                const sin_a = Math.sin(s.angle)
                const dx = (boundary.px - RENDER_W / 2) / s.zoom
                const dy = (boundary.py - RENDER_H / 2) / s.zoom
                
                const rx = dx * cos_a - dy * sin_a
                const ry = dx * sin_a + dy * cos_a

                const targetX = s.centerX + rx
                const targetY = s.centerY + ry

                // Smoothly nudge center towards boundary
                const lerpFactor = 1 - Math.pow(0.84, dt / 16.7)
                s.centerX += (targetX - s.centerX) * lerpFactor
                s.centerY += (targetY - s.centerY) * lerpFactor
              }
            }

            // Put image data to canvas
            ctx.putImageData(imgData, 0, 0)
            // data-zoom* nur jeden 8. Frame schreiben — Tests pollen,
            // brauchen keine 60-Hz-Genauigkeit (AUDIT_FINDINGS.md H-08).
            if ((s.frameCount & 7) === 0) {
              canvas.setAttribute('data-zoom', s.zoom.toString())
              canvas.setAttribute('data-zoom-direction', s.zoomDirection.toString())
            }
          } catch (err) {
            console.error('[FractalJulia] WASM error:', err)
          }

          // Bidirectional Zoom Transition Logic.
          // isLowDetail() samplet ~30 000 Pixel + Map-Hash-Ops. Direction-Switch
          // wird erst nach directionTime > 12 000 ms ausgewertet, daher reicht
          // ein Update alle 8 Frames. Vgl. AUDIT_FINDINGS.md H-02.
          if ((s.frameCount & 7) === 0) {
            s.cachedLowDetail = isLowDetail(pixels)
          }
          const lowDetail = s.cachedLowDetail
          const maxZoomLimit = 1.5e10

          if (s.zoomDirection === 1) {
            if (s.directionTime > 12000) {
              if (lowDetail && s.zoom > 1000) {
                s.zoomDirection = -1
                s.directionTime = 0
              } else if (s.zoom > maxZoomLimit) {
                s.zoomDirection = -1
                s.directionTime = 0
              }
            }
          } else {
            if (s.zoom <= 180) {
              s.zoomDirection = 1
              s.zoom = 180
              s.directionTime = 0
              
              // Switch to next param set to keep things interesting
              s.paramIdx = (s.paramIdx + 1) % JULIA_PARAMS.length
              s.centerX = 0.0
              s.centerY = 0.0
              s.driftAngle = Math.random() * Math.PI * 2
            } else if (s.directionTime > 12000 && lowDetail) {
              s.zoomDirection = 1
              s.directionTime = 0
            }
          }

          // HUD Label
          ctx.save()
          ctx.font         = '11px monospace'
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'bottom'
          ctx.fillStyle    = 'rgba(74,222,128,0.9)'
          const infoText = `JULIA // ${currentParam.label} // ZOOM 10^${Math.max(0, Math.log10(s.zoom)).toFixed(1)} // RES ${RENDER_W}x${RENDER_H}`
          ctx.fillText(infoText, RENDER_W - 6, RENDER_H - 4)
          ctx.restore()
        }

        activeFrame = frame
        if (isVisible && !unsubscribe && !cancelled) {
          unsubscribe = subscribe(activeFrame)
        }
      })
      .catch((err) => console.error('[FraktalLab] WASM-Fehler (Julia):', err))

    return () => {
      cancelled = true
      if (unsubscribe) {
        unsubscribe()
      }
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="WASM FRACTAL JULIA // RECURSIVE LATENT ENGINE">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          data-testid="fractal-julia-canvas"
          style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'auto' }}
        />
      </div>
    </Panel>
  )
}

export default memo(FractalJulia);
