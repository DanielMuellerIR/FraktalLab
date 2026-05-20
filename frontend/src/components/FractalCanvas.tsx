import { useEffect, useRef } from 'react'

// Interessante Mandelbrot-Koordinaten — werden zyklisch durchgezoomt.
// Wenn die Float-Präzisionsgrenze erreicht wird, Fade-Out → nächste Location → Fade-In.
const LOCATIONS = [
  { cx: -0.7269,  cy:  0.1889  },  // Seahorse Valley
  { cx: -0.5436,  cy:  0.6317  },  // Triple Spiral
  { cx: -1.4012,  cy:  0.0001  },  // Dendrite Tip
  { cx: -0.7453,  cy:  0.1127  },  // Seahorse Satellite
  { cx: -0.1080,  cy:  0.9249  },  // Elephant Valley
  { cx: -0.0630,  cy:  0.6748  },  // Lightning Fork
  { cx: -0.6180,  cy:  0.3890  },  // Deep Swirl
  { cx: -1.2560,  cy:  0.3818  },  // Satellite Bulb
]

export default function FractalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Zoom-State im Ref statt im React-State — kein Re-render-Overhead pro Frame
  // Zufälliger Einstieg: andere Location und Zoom-Stufe bei jedem Laden
  // eslint-disable-next-line react-hooks/purity
  const stateRef  = useRef({
    zoom:      80 + Math.random() * 800,
    locIdx:    Math.floor(Math.random() * LOCATIONS.length),
    fadeAlpha: 0,
    fading:    false,
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

          const loc = LOCATIONS[s.locIdx]

          s.zoom *= 1.015

          // Übergang auslösen bevor Floating-Point-Artefakte sichtbar werden
          if (s.zoom > 3e4 && !s.fading) s.fading = true

          if (s.fading) {
            // Fade-Out: Alpha bis 1 erhöhen
            s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.04)
            if (s.fadeAlpha >= 1) {
              // Location wechseln, Zoom auf mittleren Bereich zurücksetzen (nicht zoom=1 → sonst große schwarze Fläche)
              s.locIdx = (s.locIdx + 1) % LOCATIONS.length
              s.zoom   = 80 + Math.random() * 800
              s.fading = false
            }
          } else {
            // Fade-In: Alpha bis 0 absenken
            s.fadeAlpha = Math.max(0, s.fadeAlpha - 0.03)
          }

          try {
            const params = new RenderParams(loc.cx, loc.cy, s.zoom, 128)
            const pixels = new Uint8ClampedArray(render(canvas.width, canvas.height, params))
            ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0)
          } catch { /* WASM-Fehler still ignorieren */ }

          // Schwarzes Overlay — erzeugt sanften Übergang ohne Schwarzbild
          if (s.fadeAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${s.fadeAlpha})`
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

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
