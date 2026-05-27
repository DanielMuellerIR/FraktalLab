import { useEffect, useRef } from 'react'
import { getWasmModule } from '../utils/wasm-loader'

// 6 klassische Julia-Parametersätze
const JULIA_PARAMS = [
  { cx: -0.7,    cy:  0.27015, label: 'DENDRITE'  },
  { cx:  0.285,  cy:  0.01,    label: 'DRAGON'    },
  { cx: -0.4,    cy:  0.6,     label: 'SPIRAL'    },
  { cx:  0.45,   cy:  0.1428,  label: 'RABBIT'    },
  { cx: -0.8,    cy:  0.156,   label: 'SEAHORSE'  },
  { cx:  0.285,  cy:  0.013,   label: 'SNOWFLAKE' },
]

function isLowDetail(pixels: Uint8ClampedArray): boolean {
  let black = 0
  const colorCounts = new Map<number, number>()
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

export default function FractalJulia() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    const canvas: HTMLCanvasElement      = _canvas
    const ctx: CanvasRenderingContext2D  = _ctx

    let cancelled = false

    const RENDER_W = 600
    const RENDER_H = 400

    const setSize = () => {
      if (canvas.width !== RENDER_W) canvas.width = RENDER_W
      if (canvas.height !== RENDER_H) canvas.height = RENDER_H
    }
    setSize()
    window.addEventListener('resize', setSize)

    const s = {
      paramIdx:   0,
      zoom:       180,
      centerX:    0.0,
      centerY:    0.0,
      driftAngle: Math.random() * Math.PI * 2,
      lastFrame:  performance.now(),
      
      fading:     false,
      fadeAlpha:  0,
      prevPixels: null as Uint8ClampedArray | null,
      nextPixels: null as Uint8ClampedArray | null,
      nextParamIdx: 0,
    }

    let isVisible = true

    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
    })
    io.observe(canvas)

    getWasmModule()
      .then((wasm) => {
        if (cancelled) return

        const { render_julia } = wasm

        const buf = new Uint8Array(RENDER_W * RENDER_H * 4)
        const pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
        const imgData = new ImageData(pixels, RENDER_W, RENDER_H)

        // Pixelbuffer for the transition targets
        const nextBuf = new Uint8Array(RENDER_W * RENDER_H * 4)
        const nextPixels = new Uint8ClampedArray(nextBuf.buffer, nextBuf.byteOffset, nextBuf.byteLength)

        const frame = (now: number) => {
          if (cancelled) return

          if (!isVisible) {
            s.lastFrame = now
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          if (canvas.width === 0 || canvas.height === 0) {
            setSize()
            s.lastFrame = now
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          const dt = Math.max(1, Math.min(100, now - s.lastFrame))
          s.lastFrame = now

          // ── Fading/Transition is active ────────────────────────────────────
          if (s.fading && s.prevPixels && s.nextPixels) {
            s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.02 * (dt / 16.7))

            const prev = s.prevPixels
            const next = s.nextPixels
            const blended = new Uint8ClampedArray(RENDER_W * RENDER_H * 4)
            const a = s.fadeAlpha

            for (let i = 0; i < blended.length; i += 4) {
              blended[i]   = (prev[i]   * (1 - a) + next[i]   * a) | 0
              blended[i+1] = (prev[i+1] * (1 - a) + next[i+1] * a) | 0
              blended[i+2] = (prev[i+2] * (1 - a) + next[i+2] * a) | 0
              blended[i+3] = 255
            }

            ctx.putImageData(new ImageData(blended, RENDER_W, RENDER_H), 0, 0)

            // Render text overlay during fade
            ctx.save()
            ctx.font         = '11px monospace'
            ctx.textAlign    = 'right'
            ctx.textBaseline = 'bottom'
            ctx.fillStyle    = 'rgba(74,222,128,0.9)'
            const currentLabel = JULIA_PARAMS[s.paramIdx].label
            const nextLabel = JULIA_PARAMS[s.nextParamIdx].label
            ctx.fillText(`TRANSITION // ${currentLabel} -> ${nextLabel} (${Math.round(a * 100)}%)`, RENDER_W - 6, RENDER_H - 4)
            ctx.restore()

            if (s.fadeAlpha >= 1) {
              s.paramIdx = s.nextParamIdx
              s.zoom = 180
              s.centerX = 0.0
              s.centerY = 0.0
              s.fading = false
              s.fadeAlpha = 0
              s.prevPixels = null
              s.nextPixels = null
            }

            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // ── Normal Render ──────────────────────────────────────────────────
          // Exponential zoom
          s.zoom *= Math.pow(1.032, dt / 16.7)

          // Constant scaled drift
          s.driftAngle += 0.01 * (dt / 16.7)
          const driftDist = 0.55 / s.zoom // Pan slightly relative to viewport
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
              250 // Higher iterations for deeper zoom details
            )

            // Apply feedback correction using current pixels
            const boundary = findClosestBoundaryPixel(pixels, RENDER_W, RENDER_H)
            if (boundary) {
              // Convert pixel coordinate back to complex coordinate
              const targetX = s.centerX + (boundary.px - RENDER_W / 2) / s.zoom
              const targetY = s.centerY + (boundary.py - RENDER_H / 2) / s.zoom

              // Smoothly nudge center towards boundary
              const lerpFactor = 1 - Math.pow(0.95, dt / 16.7)
              s.centerX = s.centerX * (1 - lerpFactor) + targetX * lerpFactor
              s.centerY = s.centerY * (1 - lerpFactor) + targetY * lerpFactor
            }

            // Put image data to canvas
            ctx.putImageData(imgData, 0, 0)
          } catch { /* ignore WASM error */ }

          // Check if we need to transition (too deep or low detail)
          const maxZoomReached = s.zoom > 1e11
          const lowDetail = isLowDetail(pixels)

          if ((maxZoomReached || lowDetail) && !s.fading) {
            s.fading = true
            s.fadeAlpha = 0
            s.prevPixels = pixels.slice()

            s.nextParamIdx = (s.paramIdx + 1) % JULIA_PARAMS.length
            
            // Render first frame of the next parameter set at default zoom and center
            const nextParam = JULIA_PARAMS[s.nextParamIdx]
            try {
              render_julia(
                nextBuf,
                RENDER_W,
                RENDER_H,
                nextParam.cx,
                nextParam.cy,
                0.0,
                0.0,
                180,
                250
              )
              s.nextPixels = nextPixels.slice()
            } catch {
              s.fading = false // abort if error
            }
          }

          // HUD Label
          ctx.save()
          ctx.font         = '11px monospace'
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'bottom'
          ctx.fillStyle    = 'rgba(74,222,128,0.9)'
          const infoText = `JULIA // ${currentParam.label} // ZOOM 10^${Math.log10(s.zoom).toFixed(1)} // RES ${RENDER_W}x${RENDER_H}`
          ctx.fillText(infoText, RENDER_W - 6, RENDER_H - 4)
          ctx.restore()

          rafRef.current = requestAnimationFrame(frame)
        }

        rafRef.current = requestAnimationFrame(frame)
      })
      .catch((err) => console.error('[FraktalLab] WASM-Fehler (Julia):', err))

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', setSize)
      io.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-testid="fractal-julia-canvas"
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
    />
  )
}
