import { useEffect, useRef } from 'react'

// 6 klassische Julia-Parametersätze — werden alle 12 s zyklisch gewechselt.
// cx + i*cy ist der feste komplexe Parameter c der Julia-Menge.
const JULIA_PARAMS = [
  { cx: -0.7,    cy:  0.27015, label: 'DENDRITE'  },
  { cx:  0.285,  cy:  0.01,    label: 'DRAGON'    },
  { cx: -0.4,    cy:  0.6,     label: 'SPIRAL'    },
  { cx:  0.45,   cy:  0.1428,  label: 'RABBIT'    },
  { cx: -0.8,    cy:  0.156,   label: 'SEAHORSE'  },
  { cx:  0.285,  cy:  0.013,   label: 'SNOWFLAKE' },
]

// Wechsel-Intervall in Millisekunden
const SWITCH_INTERVAL_MS = 12_000
// Fade-Dauer in Millisekunden (0.8 s)
const FADE_MS = 800

export default function FractalJulia() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    // Closure-Narrowing: TypeScript weiß ab hier sicher, dass canvas/ctx nicht null sind
    const canvas: HTMLCanvasElement      = _canvas
    const ctx: CanvasRenderingContext2D  = _ctx

    let cancelled = false

    // Interne Render-Auflösung (unabhängig vom CSS-Layout)
    const RENDER_W = 600
    const RENDER_H = 400

    const setSize = () => {
      canvas.width  = RENDER_W
      canvas.height = RENDER_H
    }
    setSize()
    window.addEventListener('resize', setSize)

    // Mutable State im Ref statt React-State — kein Re-Render-Overhead pro Frame
    const s = {
      paramIdx:   0,                   // Index in JULIA_PARAMS
      startTime:  performance.now(),   // Zeitstempel des Starts (für Zoom-Oszillation)
      lastSwitch: performance.now(),   // Zeitstempel des letzten Parameterwechsels
      fadeAlpha:  0,                   // 0 = transparent, 1 = vollständig schwarz
      fading:     false,               // true = Fade-Out läuft, false = Fade-In läuft
    }

    import('@wasm/fraktallab_wasm.js')
      .then(async (wasm) => {
        // WASM-Modul initialisieren
        await wasm.default()
        if (cancelled) return

        const { render_julia } = wasm

        // Pixel-Buffer einmalig allozieren — Größe ändert sich nicht
        let buf = new Uint8Array(RENDER_W * RENDER_H * 4)

        const frame = (now: number) => {
          if (cancelled) return

          // Sicherheitscheck: Canvas muss Dimensionen haben
          if (canvas.width === 0 || canvas.height === 0) {
            setSize()
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // Buffer neu anlegen falls Canvas-Größe sich geändert hat
          const needed = canvas.width * canvas.height * 4
          if (buf.length !== needed) {
            buf = new Uint8Array(needed)
          }

          // Zeit seit Start in Sekunden — für Zoom-Oszillation
          const t = (now - s.startTime) / 1000

          // Zoom oszilliert sanft zwischen 120 und 240
          const zoom = 180 + Math.sin(t * 0.3) * 60

          // ── Fade-Logik ───────────────────────────────────────────────────────
          // Wechsel anstoßen wenn Intervall abgelaufen und noch kein Fade läuft
          if (!s.fading && now - s.lastSwitch >= SWITCH_INTERVAL_MS) {
            s.fading = true
          }

          if (s.fading) {
            // Fade-Out: Alpha bis 1 hochziehen
            s.fadeAlpha = Math.min(1, s.fadeAlpha + (16 / FADE_MS))
            if (s.fadeAlpha >= 1) {
              // Parametersatz wechseln, Fade-Richtung umkehren
              s.paramIdx   = (s.paramIdx + 1) % JULIA_PARAMS.length
              s.fading     = false
              s.lastSwitch = now
            }
          } else {
            // Fade-In: Alpha bis 0 absenken
            s.fadeAlpha = Math.max(0, s.fadeAlpha - (16 / FADE_MS))
          }

          const params = JULIA_PARAMS[s.paramIdx]

          try {
            // Julia-Menge rendern: c = params.cx + i*params.cy, Mittelpunkt (0,0), maxIter=200
            render_julia(
              buf,
              canvas.width,
              canvas.height,
              params.cx,
              params.cy,
              0,          // center_x
              0,          // center_y
              zoom,
              200,        // max_iter
            )

            // Pixel-Buffer auf Canvas übertragen
            const pixels = new Uint8ClampedArray(buf.buffer)
            ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0)
          } catch { /* WASM-Fehler still ignorieren */ }

          // Schwarzes Overlay für sanften Übergang
          if (s.fadeAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${s.fadeAlpha})`
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          // Label unten rechts — zeigt aktuellen Parametersatz
          // Während Fade-Out (fading=true) noch alten Namen zeigen, danach neuen
          const labelParams = s.fading
            ? JULIA_PARAMS[(s.paramIdx - 1 + JULIA_PARAMS.length) % JULIA_PARAMS.length]
            : params
          const label = `JULIA // ${labelParams.label}`
          const labelAlpha = s.fading ? (1 - s.fadeAlpha) : (1 - s.fadeAlpha * 0.5)

          ctx.save()
          ctx.font         = '11px monospace'
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'bottom'
          ctx.fillStyle    = `rgba(74,222,128,${labelAlpha})`  // green-400
          ctx.fillText(label, canvas.width - 6, canvas.height - 4)
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
