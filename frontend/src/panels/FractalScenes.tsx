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
  if (black / total > 0.70) return true
  
  let maxCount = 0
  for (const count of colorCounts.values()) {
    if (count > maxCount) {
      maxCount = count
    }
  }
  
  if (maxCount / total > 0.70) return true
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
  type: 'mandelbrot' | 'julia'
): { x: number; y: number } {
  if (type === 'mandelbrot') {
    return {
      x: centerX + (px - W / 2) / (zoom * W / 4.0),
      y: centerY + (py - H / 2) / (zoom * H / 4.0),
    }
  } else {
    return {
      x: centerX + (px - W / 2) / zoom,
      y: centerY + (py - H / 2) / zoom,
    }
  }
}

function makeFractalScene(
  title:           string,
  type:            'mandelbrot' | 'julia',
  locs:            Location[],
  juliaC:          { cx: number; cy: number } | null,
  maxIter:         number,
  colorTransform?: ColorTransform,
  zoomMax:         number = 1e9,
  zoomStart?:      number,
): () => React.JSX.Element {
  const W = 320
  const H = 213

  return function FractalScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
      zoom:       zoomStart ?? (type === 'mandelbrot' ? 1.5 : 180),
      centerX:    type === 'mandelbrot' ? locs[0].cx : 0.0,
      centerY:    type === 'mandelbrot' ? locs[0].cy : 0.0,
      locIdx:     0,
      
      fadeAlpha:  0,
      fading:     false,
      driftAngle: Math.random() * Math.PI * 2,
      lastFrame:  0,

      prevPixels: null as Uint8ClampedArray | null,
      nextPixels: null as Uint8ClampedArray | null,
      
      nextLocIdx:  0,
      nextZoom:    zoomStart ?? (type === 'mandelbrot' ? 1.5 : 180),
      nextCenterX: 0.0,
      nextCenterY: 0.0,
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

        // ── Fading/Transition is active ──────────────────────────────────────
        if (s.fading && s.prevPixels && s.nextPixels) {
          s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.05 * (dt / 16.7))

          const prev = s.prevPixels
          const next = s.nextPixels
          const blended = new Uint8ClampedArray(W * H * 4)
          const a = s.fadeAlpha
          const oneMinusA = 1 - a

          for (let i = 0; i < blended.length; i += 4) {
            blended[i]   = (prev[i]   * oneMinusA + next[i]   * a) | 0
            blended[i+1] = (prev[i+1] * oneMinusA + next[i+1] * a) | 0
            blended[i+2] = (prev[i+2] * oneMinusA + next[i+2] * a) | 0
            blended[i+3] = 255
          }

          ctx.putImageData(new ImageData(blended, W, H), 0, 0)

          if (s.fadeAlpha >= 1) {
            s.locIdx     = s.nextLocIdx
            s.zoom       = s.nextZoom
            s.centerX    = s.nextCenterX
            s.centerY    = s.nextCenterY
            s.fading     = false
            s.fadeAlpha  = 0
            s.prevPixels = null
            s.nextPixels = null
          }
          return
        }

        // ── Normal Render ──────────────────────────────────────────────────
        // Zoom exponentially
        s.zoom *= Math.pow(type === 'mandelbrot' ? 1.042 : 1.03, dt / 16.7)

        // Scaled drift
        s.driftAngle += 0.01 * (dt / 16.7)
        const driftDist = (type === 'mandelbrot' ? 0.35 : 0.5) / s.zoom
        s.centerX += Math.cos(s.driftAngle) * driftDist
        s.centerY += Math.sin(s.driftAngle) * driftDist

        try {
          if (type === 'mandelbrot') {
            const params = new wasmMod.RenderParams(s.centerX, s.centerY, s.zoom, maxIter)
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
              maxIter
            )
          }

          // Apply boundary feedback correction
          const boundary = findClosestBoundaryPixel(pixels, W, H)
          if (boundary) {
            const target = pixelToComplex(boundary.px, boundary.py, W, H, s.centerX, s.centerY, s.zoom, type)
            const lerpFactor = 1 - Math.pow(0.95, dt / 16.7)
            s.centerX = s.centerX * (1 - lerpFactor) + target.x * lerpFactor
            s.centerY = s.centerY * (1 - lerpFactor) + target.y * lerpFactor
          }

          // Transform colors
          if (colorTransform) applyTransform(pixels, colorTransform)

          // Put to screen
          ctx.putImageData(imgData, 0, 0)
        } catch (err) {
          console.error('[FractalScenes] Render error:', err)
          return
        }

        // Transition detection
        const maxZoomReached = s.zoom > zoomMax
        const lowDetail = isLowDetail(pixels)

        if ((maxZoomReached || lowDetail) && !s.fading) {
          s.fading = true
          s.fadeAlpha = 0
          s.prevPixels = pixels.slice()

          if (type === 'mandelbrot') {
            s.nextLocIdx = (s.locIdx + 1) % locs.length
            s.nextZoom = 100
            s.nextCenterX = locs[s.nextLocIdx].cx
            s.nextCenterY = locs[s.nextLocIdx].cy
          } else {
            s.nextZoom = 180
            s.nextCenterX = 0.0
            s.nextCenterY = 0.0
          }

          try {
            const nextTarget = new Uint8ClampedArray(W * H * 4)
            if (type === 'mandelbrot') {
              const nextParams = new wasmMod.RenderParams(s.nextCenterX, s.nextCenterY, s.nextZoom, maxIter)
              const nextMandel = new Uint8ClampedArray(wasmMod.render(W, H, nextParams))
              nextTarget.set(nextMandel)
            } else {
              const nextTargetBuf = new Uint8Array(W * H * 4)
              const nextTargetPixels = new Uint8ClampedArray(nextTargetBuf.buffer, nextTargetBuf.byteOffset, nextTargetBuf.byteLength)
              wasmMod.render_julia(
                nextTargetBuf,
                W,
                H,
                juliaC!.cx,
                juliaC!.cy,
                s.nextCenterX,
                s.nextCenterY,
                s.nextZoom,
                maxIter
              )
              nextTarget.set(nextTargetPixels)
            }

            if (colorTransform) applyTransform(nextTarget, colorTransform)
            s.nextPixels = nextTarget
          } catch (err) {
            console.error('[FractalScenes] Next frame render error:', err)
            s.fading = false
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
  1e9,
  30
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
  1e9,
  100
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
  1e9,
  100
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
  1e9,
  100
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
  1e9,
  1000
)

export const FractalDragon = makeFractalScene(
  'NEON DRAGON // JULIA SECTOR',
  'julia',
  [],
  { cx: 0.285, cy: 0.01 },
  200,
  'neon',
  1e10,
  200
)

export const FractalSatellite = makeFractalScene(
  'SATELLITE ORBIT // DATASTREAM',
  'mandelbrot',
  [
    { cx: -1.2560, cy: 0.3818 },
    { cx: -0.7326, cy: 0.2312 },
  ],
  null,
  130,
  'cold',
  1e9,
  1000
)

export const FractalDendrite = makeFractalScene(
  'DENDRITE HYPHA // GROWTH',
  'julia',
  [],
  { cx: -0.7, cy: 0.27015 },
  220,
  'invert',
  1e10,
  300
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
  1e10,
  200
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
  1e9,
  200
)
