import { useEffect, useRef } from 'react'
import { getWasmModule } from '../utils/wasm-loader'

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

export default function FractalCanvas() {
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

    // Canvas-Auflösung exakt an Container anpassen (kein Seitenverhältnis-Verzerrung).
    // Pixel-Budget begrenzt die Gesamtpixel für Performance, nicht W/H einzeln.
    const MAX_PIXELS = 480000; // ~800×600 Budget

    const syncSize = () => {
      const cw = container.clientWidth  || 300
      const ch = container.clientHeight || 200
      // Skaliere proportional herunter wenn über Budget
      const pixels = cw * ch
      const scale = pixels > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / pixels) : 1
      const w = Math.round(cw * scale)
      const h = Math.round(ch * scale)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w
        canvas.height = h
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
        }

        const frame = () => {
          if (cancelled) return

          syncSize()
          if (canvas.width === 0 || canvas.height === 0) {
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // ── Cross-Fade läuft: nur Pixel blenden, kein WASM-Render ─────────
          if (s.fading && s.prevImageData && s.nextImageData) {
            s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.025)

            const prev   = s.prevImageData.data
            const next   = s.nextImageData.data
            const W      = s.prevImageData.width
            const H      = s.prevImageData.height
            const blended = new ImageData(W, H)
            const out    = blended.data
            const a      = s.fadeAlpha

            // Pixel-genaues Blend: prev*(1-a) + next*a
            for (let i = 0; i < out.length; i += 4) {
              out[i]   = (prev[i]   * (1 - a) + next[i]   * a) | 0
              out[i+1] = (prev[i+1] * (1 - a) + next[i+1] * a) | 0
              out[i+2] = (prev[i+2] * (1 - a) + next[i+2] * a) | 0
              out[i+3] = 255
            }
            ctx.putImageData(blended, 0, 0)

            // Cross-Fade abgeschlossen: zu nächster Location wechseln
            if (s.fadeAlpha >= 1) {
              s.locIdx       = s.nextLocIdx
              s.zoom         = s.nextZoom
              s.centerX      = s.nextCenterX
              s.centerY      = s.nextCenterY
              s.fading       = false
              s.fadeAlpha    = 0
              s.prevImageData = null
              s.nextImageData = null
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
            const pixels = new Uint8ClampedArray(render(canvas.width, canvas.height, params))

            // Boundary tracking: keep zooming on high-detail boundary and avoid black interior
            if (!s.fading && s.zoom > 200) {
              const boundary = findBoundaryNonBlack(pixels, canvas.width, canvas.height)
              if (boundary) {
                const target = pixelToComplex(boundary.px, boundary.py, canvas.width, canvas.height, s.centerX, s.centerY, s.zoom, angle)
                s.centerX += (target.x - s.centerX) * 0.15
                s.centerY += (target.y - s.centerY) * 0.15
              }
            }

            // Schwarzraum-Früherkennung: wenn >75% der Pixel Mandelbrot-Inneres sind,
            // sofort Übergang auslösen statt schwarze Frames zu zeigen (nur nach mind. 12s Zoom).
            if (!s.fading && s.zoom > 200 && elapsed > 12000) {
              let black = 0, total = 0
              for (let i = 0; i < pixels.length; i += 128) {
                if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) black++
                total++
              }
              if (black / total > 0.75) s.fading = true
            }

            // Aktuellen Frame immer auf Canvas ausgeben
            ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0)
            canvas.setAttribute('data-zoom', s.zoom.toString())
            canvas.setAttribute('data-zoom-direction', s.fading ? '0' : '1')

            // Übergang starten: Snapshot beider Frames vorbereiten
            if (s.fading && !s.prevImageData) {
              // Snapshot des gerade gerenderten Frames
              s.prevImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

              // Nächste Location und Zoom bestimmen
              s.nextLocIdx = (s.locIdx + 1) % LOCATIONS.length
              s.nextZoom   = 80 + Math.random() * 800
              s.nextCenterX = LOCATIONS[s.nextLocIdx].cx
              s.nextCenterY = LOCATIONS[s.nextLocIdx].cy

              // Einen WASM-Frame der Ziel-Location rendern
              const nextParams = new RenderParams(s.nextCenterX, s.nextCenterY, s.nextZoom, 128, 0.0)
              const nextPixels = new Uint8ClampedArray(render(canvas.width, canvas.height, nextParams))
              s.nextImageData  = new ImageData(nextPixels, canvas.width, canvas.height)

              s.fadeAlpha = 0
            }
          } catch { /* WASM-Fehler still ignorieren */ }

          rafRef.current = requestAnimationFrame(frame)
        }

        rafRef.current = requestAnimationFrame(frame)
      })
      .catch((err) => console.error('[FraktalLab] WASM-Fehler:', err))

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        data-testid="fractal-canvas"
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
    </div>
  )
}

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

