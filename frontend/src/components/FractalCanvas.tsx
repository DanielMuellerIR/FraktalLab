import { useEffect, useRef, memo } from 'react'
import { getWasmModule } from '../utils/wasm-loader'
import { subscribe } from '../utils/raf-coordinator'

// Interessante Mandelbrot-Koordinaten — werden zyklisch durchgezoomt.
// Wenn die Float-Präzisionsgrenze erreicht wird, Cross-Fade → nächste Location.
const LOCATIONS = [
  { cx: -0.7269,  cy:  0.1889  },  // Seahorse Valley
  { cx: -0.5436,  cy:  0.6317  },  // Triple Spiral
  { cx:  0.3600,  cy:  0.1000  },  // Right Bulb Spirals
  { cx: -0.7453,  cy:  0.1127  },  // Seahorse Satellite
  { cx: -0.1080,  cy:  0.9249  },  // Elephant Valley
  { cx: -0.0630,  cy:  0.6748  },  // Lightning Fork
  { cx: -0.7390,  cy:  0.1660  },  // Inner Seahorse
  { cx: -1.2560,  cy:  0.3818  },  // Satellite Bulb
]

export default memo(function FractalCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Zoom-State im Ref statt im React-State — kein Re-render-Overhead pro Frame.
  // Zufälliger Einstieg: andere Location und Zoom-Stufe bei jedem Laden.
// eslint-disable-next-line react-hooks/purity
  const stateRef = useRef({
    zoom:          80 + Math.random() * 800,
    locIdx:        Math.floor(Math.random() * LOCATIONS.length),
    centerX:       0,
    centerY:       0,
    initialized:   false,
    fadeAlpha:     0,
    fading:        false,
    // Cross-Fade: Snapshots des aktuellen und nächsten Frames
    prevImageData: null as ImageData | null,
    nextImageData: null as ImageData | null,
    nextLocIdx:    0,
    nextZoom:      80,
    nextCenterX:   0,
    nextCenterY:   0,
  })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    let isVisible = true
    let unsubscribe: (() => void) | null = null
    let activeFrame: (() => void) | null = null

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

    // Canvas-Auflösung exakt an Container anpassen (kein Seitenverhältnis-Verzerrung).
    // Pixel-Budget begrenzt die Gesamtpixel für Performance, nicht W/H einzeln.
    const MAX_PIXELS = 480000; // ~800×600 Budget

    let buf: Uint8Array
    let pixelsArray: Uint8ClampedArray
    let imgData: ImageData

    let prevImgData: ImageData
    let nextBuf: Uint8Array
    let nextPixelsArray: Uint8ClampedArray
    let nextImgData: ImageData
    let blendImgData: ImageData

    const syncSize = () => {
      const cw = container.clientWidth  || 300
      const ch = container.clientHeight || 200
      // Skaliere proportional herunter wenn über Budget
      const pixels = cw * ch
      const scale = pixels > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / pixels) : 1
      const w = Math.round(cw * scale)
      const h = Math.round(ch * scale)
      if (canvas.width !== w || canvas.height !== h || !buf) {
        canvas.width  = w
        canvas.height = h

        buf = new Uint8Array(w * h * 4)
        pixelsArray = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
        imgData = new ImageData(pixelsArray as any, w, h)

        prevImgData = new ImageData(w, h)
        nextBuf = new Uint8Array(w * h * 4)
        nextPixelsArray = new Uint8ClampedArray(nextBuf.buffer, nextBuf.byteOffset, nextBuf.byteLength)
        nextImgData = new ImageData(nextPixelsArray as any, w, h)

        blendImgData = new ImageData(w, h)
      }
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    ro.observe(container)

    getWasmModule()
      .then((wasm) => {
        if (cancelled) return

        const { RenderParams, render } = wasm
        const s = stateRef.current

        if (!s.initialized) {
          s.centerX = LOCATIONS[s.locIdx].cx
          s.centerY = LOCATIONS[s.locIdx].cy
          s.initialized = true
          ;(s as any).locTime = performance.now()
          ;(s as any).hasSnapshots = false
          ;(s as any).boundaryFrame = 0
        }

        const frame = () => {
          if (cancelled) return

          syncSize()
          if (canvas.width === 0 || canvas.height === 0) {
            return
          }

          // ── Cross-Fade läuft: nur Pixel blenden, kein WASM-Render ─────────
          if (s.fading && (s as any).hasSnapshots) {
            s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.025)

            const prev   = prevImgData.data
            const next   = nextImgData.data
            const out    = blendImgData.data
            const a      = s.fadeAlpha

            // Pixel-genaues Blend: prev*(1-a) + next*a
            for (let i = 0; i < out.length; i += 4) {
              out[i]   = (prev[i]   * (1 - a) + next[i]   * a) | 0
              out[i+1] = (prev[i+1] * (1 - a) + next[i+1] * a) | 0
              out[i+2] = (prev[i+2] * (1 - a) + next[i+2] * a) | 0
              out[i+3] = 255
            }
            ctx.putImageData(blendImgData, 0, 0)

            // Cross-Fade abgeschlossen: zu nächster Location wechseln
            if (s.fadeAlpha >= 1) {
              s.locIdx       = s.nextLocIdx
              s.zoom         = s.nextZoom
              s.centerX      = s.nextCenterX
              s.centerY      = s.nextCenterY
              s.fading       = false
              s.fadeAlpha    = 0
              ;(s as any).hasSnapshots = false
              ;(s as any).locTime = performance.now()
            }

            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // ── Normaler Live-Render ────────────────────────────────────────────
          s.zoom *= 1.015
          
          // Rotate background fractal slowly
          if (!s.fading) {
            if (!(s as any).angle) (s as any).angle = 0
            ;(s as any).angle += 0.002
          }
          const angle = (s as any).angle || 0

          // Übergang auslösen bevor Floating-Point-Artefakte sichtbar werden
          const elapsed = performance.now() - ((s as any).locTime || performance.now())
          if (s.zoom > 1.5e6 && elapsed > 12000 && !s.fading) s.fading = true

          try {
            const params = new RenderParams(s.centerX, s.centerY, s.zoom, 128, angle)
            render(buf, canvas.width, canvas.height, params)

            // Boundary tracking: keep zooming on high-detail boundary and avoid black interior
            if (!s.fading && s.zoom > 200) {
              ;(s as any).boundaryFrame++
              if ((s as any).boundaryFrame % 4 === 0) {
                const boundary = findBoundaryNonBlack(pixelsArray, canvas.width, canvas.height)
                if (boundary) {
                  const target = pixelToComplex(boundary.px, boundary.py, canvas.width, canvas.height, s.centerX, s.centerY, s.zoom, angle)
                  s.centerX += (target.x - s.centerX) * 0.15
                  s.centerY += (target.y - s.centerY) * 0.15
                }
              }
            }

            // Schwarzraum-Früherkennung: wenn >75% der Pixel Mandelbrot-Inneres sind,
            // sofort Übergang auslösen statt schwarze Frames zu zeigen (nur nach mind. 12s Zoom).
            if (!s.fading && s.zoom > 200 && elapsed > 12000) {
              let black = 0, total = 0
              for (let i = 0; i < pixelsArray.length; i += 128) {
                if (pixelsArray[i] === 0 && pixelsArray[i + 1] === 0 && pixelsArray[i + 2] === 0) black++
                total++
              }
              if (black / total > 0.75) s.fading = true
            }

            // Aktuellen Frame immer auf Canvas ausgeben
            ctx.putImageData(imgData, 0, 0)
            canvas.setAttribute('data-zoom', s.zoom.toString())
            canvas.setAttribute('data-zoom-direction', s.fading ? '0' : '1')

            // Übergang starten: Snapshot beider Frames vorbereiten
            if (s.fading && !(s as any).hasSnapshots) {
              // Snapshot des gerade gerenderten Frames
              prevImgData.data.set(pixelsArray)

              // Nächste Location und Zoom bestimmen
              s.nextLocIdx = (s.locIdx + 1) % LOCATIONS.length
              s.nextZoom   = 80 + Math.random() * 800
              s.nextCenterX = LOCATIONS[s.nextLocIdx].cx
              s.nextCenterY = LOCATIONS[s.nextLocIdx].cy

              // Einen WASM-Frame der Ziel-Location rendern
              const nextParams = new RenderParams(s.nextCenterX, s.nextCenterY, s.nextZoom, 128, 0.0)
              render(nextBuf, canvas.width, canvas.height, nextParams)
              
              ;(s as any).hasSnapshots = true
              s.fadeAlpha = 0
            }
          } catch (err) { console.error('[FractalCanvas] render error:', err) }
        }

        activeFrame = frame
        if (isVisible && !unsubscribe && !cancelled) {
          unsubscribe = subscribe(activeFrame)
        }
      })
      .catch((err) => console.error('[FraktalLab] WASM-Fehler:', err))

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
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        data-testid="fractal-canvas"
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'auto' }}
      />
    </div>
  )
})

function pixelToComplex(
  px: number,
  py: number,
  W: number,
  H: number,
  centerX: number,
  centerY: number,
  zoom: number,
  angle: number
): { x: number; y: number } {
  const dx = (px - W / 2) / (zoom * W / 4.0)
  const dy = (py - H / 2) / (zoom * H / 4.0)

  const cos_a = Math.cos(angle)
  const sin_a = Math.sin(angle)
  const rx = dx * cos_a - dy * sin_a
  const ry = dx * sin_a + dy * cos_a

  return {
    x: centerX + rx,
    y: centerY + ry,
  }
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

