import { useEffect, useRef } from 'react'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Zoom-State im Ref statt im React-State — kein Re-render-Overhead pro Frame.
  // Zufälliger Einstieg: andere Location und Zoom-Stufe bei jedem Laden.
  // eslint-disable-next-line react-hooks/purity
  const stateRef = useRef({
    zoom:          80 + Math.random() * 800,
    locIdx:        Math.floor(Math.random() * LOCATIONS.length),
    fadeAlpha:     0,
    fading:        false,
    // Cross-Fade: Snapshots des aktuellen und nächsten Frames
    prevImageData: null as ImageData | null,
    nextImageData: null as ImageData | null,
    nextLocIdx:    0,
    nextZoom:      80,
  })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    const RENDER_W = 600
    const RENDER_H = 400
    const setSize = () => { canvas.width = RENDER_W; canvas.height = RENDER_H }
    setSize()
    window.addEventListener('resize', setSize)

    import('@wasm/fraktallab_wasm.js')
      .then(async (wasm) => {
        await wasm.default()
        if (cancelled) return

        const { RenderParams, render } = wasm
        const s = stateRef.current

        const frame = () => {
          if (cancelled) return

          if (canvas.width === 0 || canvas.height === 0) {
            setSize()
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // ── Cross-Fade läuft: nur Pixel blenden, kein WASM-Render ─────────
          if (s.fading && s.prevImageData && s.nextImageData) {
            s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.025)

            const prev   = s.prevImageData.data
            const next   = s.nextImageData.data
            const W      = canvas.width
            const H      = canvas.height
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
              s.fading       = false
              s.fadeAlpha    = 0
              s.prevImageData = null
              s.nextImageData = null
            }

            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // ── Normaler Live-Render ────────────────────────────────────────────
          const loc = LOCATIONS[s.locIdx]
          s.zoom *= 1.015

          // Übergang auslösen bevor Floating-Point-Artefakte sichtbar werden
          if (s.zoom > 3e4 && !s.fading) s.fading = true

          try {
            const params = new RenderParams(loc.cx, loc.cy, s.zoom, 128)
            const pixels = new Uint8ClampedArray(render(canvas.width, canvas.height, params))

            // Schwarzraum-Früherkennung: wenn >75% der Pixel Mandelbrot-Inneres sind,
            // sofort Übergang auslösen statt schwarze Frames zu zeigen.
            // Zoom-Guard: unter 200 ist ein großes Inneres normal (breite Außenansicht).
            if (!s.fading && s.zoom > 200) {
              let black = 0, total = 0
              for (let i = 0; i < pixels.length; i += 128) {
                if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) black++
                total++
              }
              if (black / total > 0.75) s.fading = true
            }

            // Aktuellen Frame immer auf Canvas ausgeben
            ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0)

            // Übergang starten: Snapshot beider Frames vorbereiten
            if (s.fading && !s.prevImageData) {
              // Snapshot des gerade gerenderten Frames
              s.prevImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

              // Nächste Location und Zoom bestimmen
              s.nextLocIdx = (s.locIdx + 1) % LOCATIONS.length
              s.nextZoom   = 80 + Math.random() * 800

              // Einen WASM-Frame der Ziel-Location rendern
              const nextLoc    = LOCATIONS[s.nextLocIdx]
              const nextParams = new RenderParams(nextLoc.cx, nextLoc.cy, s.nextZoom, 128)
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
      window.removeEventListener('resize', setSize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-testid="fractal-canvas"
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
    />
  )
}
