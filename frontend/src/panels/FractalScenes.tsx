import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { getWasmModule } from '../utils/wasm-loader'
import { subscribe } from '../utils/raf-coordinator'

interface Location { cx: number; cy: number }

type ColorTransform = 'mono' | 'cold' | 'hot' | 'neon' | 'invert'


function applyTransform(pixels: Uint8ClampedArray, t: ColorTransform) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2]
    if ((r | g | b) === 0) continue
    switch (t) {
      case 'mono': {
        const lum = Math.round(0.299*r + 0.587*g + 0.114*b)
        pixels[i] = 0; pixels[i+1] = lum; pixels[i+2] = 0
        break
      }
      case 'cold': {
        const lum = (r + g + b) / 3
        const boost = Math.max(0, 40 - lum)
        pixels[i]   = Math.min(255, (r * 0.1 | 0) + boost * 0.3)
        pixels[i+1] = Math.min(255, (g * 0.5 | 0) + boost * 0.6)
        pixels[i+2] = Math.min(255, ((b * 1.5 + r * 0.4) | 0) + boost)
        break
      }
      case 'hot': {
        pixels[i]   = Math.min(255, (r * 1.5 + g * 0.25) | 0)
        pixels[i+1] = Math.min(255, g * 0.45 | 0)
        pixels[i+2] = Math.min(255, b * 0.05 | 0)
        break
      }
      case 'neon': {
        pixels[i]   = Math.min(255, r * 1.3 | 0)
        pixels[i+1] = Math.min(255, g * 0.15 | 0)
        pixels[i+2] = Math.min(255, b * 1.6 | 0)
        break
      }
      case 'invert': {
        pixels[i] = 255 - r; pixels[i+1] = 255 - g; pixels[i+2] = 255 - b
        break
      }
    }
  }
}

function isLowDetail(pixels: Uint8ClampedArray): boolean {
  let black = 0
  const colorCounts = new Map<number, number>()
  const sampleStep = 64
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

function pixelToComplex(
  px: number,
  py: number,
  W: number,
  H: number,
  centerX: number,
  centerY: number,
  zoom: number,
  type: 'mandelbrot' | 'julia',
  angle: number
): { x: number; y: number } {
  const dx = type === 'mandelbrot'
    ? (px - W / 2) / (zoom * W / 4.0)
    : (px - W / 2) / zoom
  const dy = type === 'mandelbrot'
    ? (py - H / 2) / (zoom * H / 4.0)
    : (py - H / 2) / zoom

  const cos_a = Math.cos(angle)
  const sin_a = Math.sin(angle)
  const rx = dx * cos_a - dy * sin_a
  const ry = dx * sin_a + dy * cos_a

  return {
    x: centerX + rx,
    y: centerY + ry,
  }
}

function makeFractalScene(
  title:           string,
  type:            'mandelbrot' | 'julia',
  locs:            Location[],
  juliaC:          { cx: number; cy: number } | null,
  maxIter:         number,
  colorTransform?: ColorTransform,
  _zoomMax:         number = 1e9,
): React.NamedExoticComponent<any> {
  // Deterministic seed from title so each panel starts differently
  let seed = 0
  for (let i = 0; i < title.length; i++) seed = ((seed << 5) - seed + title.charCodeAt(i)) | 0
  const initialAngle = ((seed & 0xFFFF) / 0xFFFF) * Math.PI * 2

  return React.memo(function FractalScene() {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
      zoom:       type === 'mandelbrot' ? 10 : 180,
      centerX:    type === 'mandelbrot' ? locs[0].cx : 0.0,
      centerY:    type === 'mandelbrot' ? locs[0].cy : 0.0,
      locIdx:     0,
      zoomDirection: 1,
      angle:      initialAngle,
      driftAngle: initialAngle + 1.0,
      lastFrame:  0,
      directionTime: 0,
    })

    useEffect(() => {
      const container = containerRef.current!
      const canvas = canvasRef.current!
      const ctx    = canvas.getContext('2d')!
      let alive = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let wasmMod: any = null
      let unsubscribe: (() => void) | null = null

      let isVisible = true
      const io = new IntersectionObserver(([e]) => {
        isVisible = e.isIntersecting
        if (isVisible) {
          if (!unsubscribe && alive) {
            unsubscribe = subscribe(loop)
          }
        } else {
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
        }
      })
      io.observe(canvas)

      getWasmModule().then((wasm) => {
        if (alive) wasmMod = wasm
      }).catch((err) => {
        console.error('[FractalScenes] WASM-Fehler (import):', err)
      })

      // Dynamic sizing configuration
      const MAX_PIXELS = 120000
      let w = 320
      let h = 213
      let lastW = 0
      let lastH = 0
      let buf: Uint8Array
      let pixels: Uint8ClampedArray
      let imgData: ImageData

      const syncSize = () => {
        const cw = container.clientWidth  || 300
        const ch = container.clientHeight || 200
        const pixelCount = cw * ch
        const scale = pixelCount > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / pixelCount) : 1
        const targetW = Math.round(cw * scale)
        const targetH = Math.round(ch * scale)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width  = targetW
          canvas.height = targetH
        }
        w = canvas.width
        h = canvas.height
      }
      syncSize()

      const ro = new ResizeObserver(syncSize)
      ro.observe(container)

      const updateBuffers = (targetW: number, targetH: number) => {
        if (targetW === lastW && targetH === lastH) return
        buf = new Uint8Array(targetW * targetH * 4)
        pixels = new Uint8ClampedArray(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)
        imgData = new ImageData(pixels as any, targetW, targetH)
        lastW = targetW
        lastH = targetH
      }

      function loop(t: number) {
        if (!alive) return

        const s = stateRef.current

        if (s.lastFrame === 0) {
          s.lastFrame = t
          return
        }

        // Throttle to 30 FPS
        if (t - s.lastFrame < 33) return
        const dt = t - s.lastFrame
        s.lastFrame = t
        s.directionTime += dt

        if (!isVisible) return
        if (!wasmMod) return

        syncSize()
        if (w === 0 || h === 0) return
        updateBuffers(w, h)

        // ── Zoom ──
        if (s.zoomDirection === 1) {
          const zoomRate = Math.pow(type === 'mandelbrot' ? 1.020 : 1.018, dt / 16.7)
          s.zoom *= zoomRate
        } else {
          // Warp zoom-out speed to minimize black screen time
          const zoomRateOut = Math.pow(type === 'mandelbrot' ? 1.120 : 1.100, dt / 16.7)
          s.zoom /= zoomRateOut
        }

        // Slow rotation
        s.angle += 0.004 * (dt / 16.7) * s.zoomDirection

        // Drift/tumble only at deeper zoom
        if (s.zoom > (type === 'mandelbrot' ? 30 : 600)) {
          // Reduce drift/tumble amplitude during zoom-in so it doesn't fight boundary tracking
          const factor = s.zoomDirection === 1 ? 0.05 : 1.0
          const tumbleAmp = (0.03 / s.zoom) * factor
          s.centerX += Math.sin(t * 0.0006) * tumbleAmp
          s.centerY += Math.cos(t * 0.0008) * tumbleAmp

          s.driftAngle += 0.006 * (dt / 16.7)
          const maxDrift = ((type === 'mandelbrot' ? 0.2 : 0.3) / s.zoom) * factor
          s.centerX += Math.cos(s.driftAngle) * maxDrift
          s.centerY += Math.sin(s.driftAngle) * maxDrift
        }

        try {
          if (type === 'mandelbrot') {
            const params = new wasmMod.RenderParams(s.centerX, s.centerY, s.zoom, maxIter, s.angle)
            wasmMod.render(buf, w, h, params)
          } else {
            wasmMod.render_julia(
              buf, w, h,
              juliaC!.cx, juliaC!.cy,
              s.centerX, s.centerY,
              s.zoom, maxIter, s.angle
            )
          }

          // Boundary feedback: steer toward the NON-BLACK side of boundaries
          // This prevents zooming into the solid interior of the set
          if (s.zoomDirection === 1 && s.zoom > 8) {
            const boundary = findBoundaryNonBlack(pixels, w, h)
            if (boundary) {
              const target = pixelToComplex(boundary.px, boundary.py, w, h, s.centerX, s.centerY, s.zoom, type, s.angle)
              const lerpFactor = 1 - Math.pow(0.84, dt / 16.7)
              s.centerX += (target.x - s.centerX) * lerpFactor
              s.centerY += (target.y - s.centerY) * lerpFactor
            }
          }

          if (colorTransform) applyTransform(pixels, colorTransform)
          ctx.putImageData(imgData, 0, 0)
          canvas.setAttribute('data-zoom', s.zoom.toString())
          canvas.setAttribute('data-zoom-direction', s.zoomDirection.toString())
        } catch (err) {
          console.error('[FractalScenes] Render error:', err)
          return
        }

        // Bidirectional zoom logic
        const lowDetail = isLowDetail(pixels)
        const minZoom = type === 'mandelbrot' ? 1.5 : 180
        const maxZoomLimit = type === 'mandelbrot' ? 2e12 : 2e9

        if (s.zoomDirection === 1) {
          if (s.directionTime > 12000) {
            if (lowDetail && s.zoom > minZoom * 4) {
              s.zoomDirection = -1
              s.directionTime = 0
            } else if (s.zoom > maxZoomLimit) {
              s.zoomDirection = -1
              s.directionTime = 0
            }
          }
        } else {
          if (s.zoom <= minZoom) {
            s.zoomDirection = 1
            s.zoom = minZoom
            s.directionTime = 0

            // Cycle through locs for variety
            if (type === 'mandelbrot' && locs.length > 1) {
              s.locIdx = (s.locIdx + 1) % locs.length
              s.centerX = locs[s.locIdx].cx
              s.centerY = locs[s.locIdx].cy
            } else if (type === 'mandelbrot') {
              s.centerX = locs[0].cx
              s.centerY = locs[0].cy
            } else {
              s.centerX = (Math.random() - 0.5) * 0.04
              s.centerY = (Math.random() - 0.5) * 0.04
            }
            s.driftAngle = Math.random() * Math.PI * 2
          } else if (s.directionTime > 12000 && lowDetail) {
            s.zoomDirection = 1
            s.directionTime = 0
          }
        }
      }

      return () => {
        alive = false
        if (unsubscribe) {
          unsubscribe()
        }
        io.disconnect()
        ro.disconnect()
      }
    }, [])

    return (
      <Panel title={title}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
          />
        </div>
      </Panel>
    )
  })
}

/**
 * Find nearest boundary pixel but return the NON-BLACK side.
 * This steers zoom toward colorful detail, not into solid Mandelbrot interior.
 */
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
        // Return the non-black pixel at this boundary
        if (!centerIsBlack) return { px, py }

        // Center is black — find the non-black neighbor
        if (!neighbors[0]) return { px: px - 1, py }
        if (!neighbors[1]) return { px: px + 1, py }
        if (!neighbors[2]) return { px, py: py - 1 }
        if (!neighbors[3]) return { px, py: py + 1 }
      }
    }
  }
  return null
}

// ── 10 Overhauled Fractal Scenes ──

export const FractalSeahorse = makeFractalScene(
  'SEAHORSE VALLEY // DEPTH ∞',
  'mandelbrot',
  [
    { cx: -0.7435, cy: 0.1314 },
    { cx: -0.7269, cy: 0.1889 },
    { cx: -0.7269, cy: 0.1314 },
  ],
  null,
  180,
  undefined,
  1e9
)

export const FractalSpiral = makeFractalScene(
  'TRIPLE SPIRAL // SECTOR 3',
  'mandelbrot',
  [
    { cx: -0.761574, cy: -0.0847596 },
    { cx: -0.743643, cy: 0.1318259  },
  ],
  null,
  200,
  'mono',
  1e9
)

export const FractalLightning = makeFractalScene(
  'LIGHTNING FORK // VECTOR FIELD',
  'mandelbrot',
  [
    { cx: -1.25066, cy: 0.02012 },
    { cx: -1.25045, cy: 0.02019 },
  ],
  null,
  200,
  'cold',
  1e9
)

export const FractalElephant = makeFractalScene(
  'ELEPHANT VALLEY // SCANNING',
  'mandelbrot',
  [
    { cx: -0.16,   cy: 1.0405 },
    { cx: -0.1701, cy: 1.0365 },
  ],
  null,
  140,
  'hot',
  1e9
)

export const FractalMini = makeFractalScene(
  'MINI-MANDELBROT // DEEP FIELD',
  'mandelbrot',
  [
    { cx: -1.7534, cy: 0.0016 },
    { cx: -1.6256, cy: 0.0019 },
  ],
  null,
  120,
  undefined,
  1e9
)

export const FractalDragon = makeFractalScene(
  'NEON DRAGON // JULIA SECTOR',
  'julia',
  [],
  { cx: 0.285, cy: 0.01 },
  200,
  'neon',
  1e10
)

export const FractalSatellite = makeFractalScene(
  'SATELLITE ORBIT // DATASTREAM',
  'mandelbrot',
  [
    { cx: -1.2560, cy: 0.3818 },  // satellite bulb
    { cx: -0.7326, cy: 0.2312 },  // seahorse-adjacent
  ],
  null,
  200,
  'cold',
  1e9
)

export const FractalDendrite = makeFractalScene(
  'DENDRITE HYPHA // GROWTH',
  'julia',
  [],
  { cx: -0.7, cy: 0.27015 },
  220,
  'invert',
  1e10
)

export const FractalSwirl = makeFractalScene(
  'DEEP SWIRL // NEURAL SYNC',
  'mandelbrot',
  [
    { cx: -0.0986, cy: 0.6517 },
    { cx: -0.0986, cy: 0.6519 },
    { cx:  0.295,  cy: 0.555  },
  ],
  null,
  220,
  'invert',
  1e10
)

export const FractalTendril = makeFractalScene(
  'TENDRIL CLUSTER // CRAWLING',
  'mandelbrot',
  [
    { cx: -0.7483, cy: 0.1127 },
    { cx: -0.743643, cy: 0.1318259 },
  ],
  null,
  200,
  'hot',
  1e9
)
