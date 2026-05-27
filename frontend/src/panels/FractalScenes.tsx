import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { getWasmModule } from '../utils/wasm-loader'

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

function findClosestBoundaryPixel(pixels: Uint8ClampedArray, W: number, H: number): { px: number, py: number } | null {
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)
  
  const isBlack = (x: number, y: number) => {
    const idx = (y * W + x) * 4
    return pixels[idx] === 0 && pixels[idx + 1] === 0 && pixels[idx + 2] === 0
  }
  
  const maxRadius = Math.min(cx, cy) - 2
  for (let r = 1; r < maxRadius; r += 2) {
    const numSamples = Math.min(64, 4 * r)
    for (let s = 0; s < numSamples; s++) {
      const angle = (s * 2 * Math.PI) / numSamples
      const px = Math.round(cx + r * Math.cos(angle))
      const py = Math.round(cy + r * Math.sin(angle))
      
      if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue
      
      const centerBlack = isBlack(px, py)
      const leftBlack   = isBlack(px - 1, py)
      const rightBlack  = isBlack(px + 1, py)
      const topBlack    = isBlack(px, py - 1)
      const bottomBlack = isBlack(px, py + 1)
      
      if (centerBlack !== leftBlack || centerBlack !== rightBlack || centerBlack !== topBlack || centerBlack !== bottomBlack) {
        return { px, py }
      }
    }
  }
  return null
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
  _locs:           Location[],
  juliaC:          { cx: number; cy: number } | null,
  maxIter:         number,
  colorTransform?: ColorTransform,
  _zoomMax:         number = 1e9,
): () => React.JSX.Element {
  const W = 320
  const H = 213

  return function FractalScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
      zoom:       type === 'mandelbrot' ? 1.5 : 180,
      centerX:    type === 'mandelbrot' ? -0.5 : 0.0,
      centerY:    0.0,
      locIdx:     0,
      zoomDirection: 1, // 1 = zoom in, -1 = zoom out
      angle:      0,
      driftAngle: Math.random() * Math.PI * 2,
      lastFrame:  0,
    })

    useEffect(() => {
      const canvas = canvasRef.current!
      const ctx    = canvas.getContext('2d')!
      let raf: number
      let alive = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let wasmMod: any = null

      let isVisible = true
      const io = new IntersectionObserver(([e]) => {
        isVisible = e.isIntersecting
      })
      io.observe(canvas)

      getWasmModule().then((wasm) => {
        if (alive) wasmMod = wasm
      }).catch((err) => {
        console.error('[FractalScenes] WASM-Fehler (import):', err)
      })

      const buf = new Uint8Array(W * H * 4)
      const pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
      const imgData = new ImageData(pixels, W, H)

      function loop(t: number) {
        if (!alive) return
        raf = requestAnimationFrame(loop)

        const s = stateRef.current

        if (s.lastFrame === 0) {
          s.lastFrame = t
          return
        }

        // Throttle to 30 FPS
        if (t - s.lastFrame < 33) return
        const dt = t - s.lastFrame
        s.lastFrame = t

        if (!isVisible) return
        if (!wasmMod) return

        // ── Normal Render ──
        // Zoom exponentially based on direction
        const zoomRate = Math.pow(type === 'mandelbrot' ? 1.038 : 1.026, dt / 16.7)
        if (s.zoomDirection === 1) {
          s.zoom *= zoomRate
        } else {
          s.zoom /= zoomRate
        }

        // Slow rotation
        s.angle += 0.0055 * (dt / 16.7) * s.zoomDirection

        // Only drift/tumble once zoomed in enough (zoom > 30 for Mandelbrot, > 600 for Julia)
        const minZoomForDrift = type === 'mandelbrot' ? 30 : 600
        if (s.zoom > minZoomForDrift) {
          // Tumbling: shift center slightly with sine waves
          const tumbleAmp = 0.04 / s.zoom
          s.centerX += Math.sin(t * 0.0006) * tumbleAmp
          s.centerY += Math.cos(t * 0.0008) * tumbleAmp

          // Scaled drift – capped to prevent wild jumps
          s.driftAngle += 0.008 * (dt / 16.7)
          const maxDrift = (type === 'mandelbrot' ? 0.28 : 0.4) / s.zoom
          s.centerX += Math.cos(s.driftAngle) * maxDrift
          s.centerY += Math.sin(s.driftAngle) * maxDrift
        }

        try {
          if (type === 'mandelbrot') {
            const params = new wasmMod.RenderParams(s.centerX, s.centerY, s.zoom, maxIter, s.angle)
            const mandelPixels = new Uint8ClampedArray(wasmMod.render(W, H, params))
            pixels.set(mandelPixels)
          } else {
            wasmMod.render_julia(
              buf,
              W,
              H,
              juliaC!.cx,
              juliaC!.cy,
              s.centerX,
              s.centerY,
              s.zoom,
              maxIter,
              s.angle
            )
          }

          // Apply boundary feedback correction (only when zooming in to stay centered on detail and zoom is high enough)
          if (s.zoomDirection === 1 && s.zoom > 45) {
            const boundary = findClosestBoundaryPixel(pixels, W, H)
            if (boundary) {
              const target = pixelToComplex(boundary.px, boundary.py, W, H, s.centerX, s.centerY, s.zoom, type, s.angle)
              const lerpFactor = 1 - Math.pow(0.93, dt / 16.7)
              s.centerX = s.centerX * (1 - lerpFactor) + target.x * lerpFactor
              s.centerY = s.centerY * (1 - lerpFactor) + target.y * lerpFactor
            }
          }

          // Transform colors
          if (colorTransform) applyTransform(pixels, colorTransform)

          // Put to screen
          ctx.putImageData(imgData, 0, 0)
        } catch (err) {
          console.error('[FractalScenes] Render error:', err)
          return
        }

        // Bidirectional Zoom Transition Logic
        const lowDetail = isLowDetail(pixels)
        const absoluteMinZoom = type === 'mandelbrot' ? 1.5 : 180
        const maxZoomLimit = type === 'mandelbrot' ? 2e12 : 2e9

        if (s.zoomDirection === 1) {
          // Switch to zoom-out if detail is low or zoom limit is reached
          if (lowDetail && s.zoom > absoluteMinZoom * 4) {
            s.zoomDirection = -1
          } else if (s.zoom > maxZoomLimit) {
            s.zoomDirection = -1
          }
        } else {
          // Switch to zoom-in if zoomed out too far
          if (s.zoom <= absoluteMinZoom) {
            s.zoomDirection = 1
            s.zoom = absoluteMinZoom

            // Always reset to standard Mandelbrot overview - boundary tracking navigates from there
            if (type === 'mandelbrot') {
              s.centerX = -0.5 + (Math.random() - 0.5) * 0.3
              s.centerY = (Math.random() - 0.5) * 0.3
            } else {
              // Julia: return to center with slight offset
              s.centerX = (Math.random() - 0.5) * 0.05
              s.centerY = (Math.random() - 0.5) * 0.05
            }
            s.driftAngle = Math.random() * Math.PI * 2
            s.angle = 0
          }
        }
      }

      raf = requestAnimationFrame(loop)
      return () => {
        alive = false
        cancelAnimationFrame(raf)
        io.disconnect()
      }
    }, [])

    return (
      <Panel title={title}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{ width:'100%', height:'100%', imageRendering:'pixelated', display:'block' }}
        />
      </Panel>
    )
  }
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
    { cx: 0.36,  cy: 0.1  },
    { cx: 0.355, cy: 0.108 },
  ],
  null,
  130,
  'mono',
  1e9
)

export const FractalLightning = makeFractalScene(
  'LIGHTNING FORK // VECTOR FIELD',
  'mandelbrot',
  [
    { cx: -0.0630, cy: 0.6748 },
    { cx: -0.0621, cy: 0.7140 },
  ],
  null,
  120,
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
    { cx: -0.5,    cy: 0.0    },  // start: full view with guaranteed variance
    { cx: -1.2560, cy: 0.3818 },  // satellite bulb
    { cx: -0.7326, cy: 0.2312 },  // seahorse-adjacent
  ],
  null,
  130,
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
    { cx: -0.7490, cy: 0.0585 },
    { cx: -0.7080, cy: 0.2492 },
  ],
  null,
  120,
  'hot',
  1e9
)
