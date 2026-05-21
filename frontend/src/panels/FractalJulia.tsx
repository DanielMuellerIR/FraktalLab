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
// Morph-Dauer in Millisekunden (3.0 s) am Ende des Zyklus
const TRANSITION_MS = 3_000

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
      if (canvas.width !== RENDER_W) canvas.width = RENDER_W
      if (canvas.height !== RENDER_H) canvas.height = RENDER_H
    }
    setSize()
    window.addEventListener('resize', setSize)

    // Mutable State im Ref statt React-State — kein Re-Render-Overhead pro Frame
    const s = {
      paramIdx:   0,                   // Index in JULIA_PARAMS
      startTime:  performance.now(),   // Zeitstempel des Starts (für Zoom-Oszillation)
      lastSwitch: performance.now(),   // Zeitstempel des letzten Wechsels
    }

    let isVisible = true

    // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
    })
    io.observe(canvas)

    import('@wasm/fraktallab_wasm.js')
      .then(async (wasm) => {
        // WASM-Modul initialisieren
        await wasm.default()
        if (cancelled) return

        const { render_julia } = wasm

        // Pixel-Buffer, ClampedArray und ImageData einmalig allozieren — verhindert Garbage-Collector-Ruckeln
        const buf = new Uint8Array(RENDER_W * RENDER_H * 4)
        const pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
        const imgData = new ImageData(pixels, RENDER_W, RENDER_H)

        const frame = (now: number) => {
          if (cancelled) return

          // Loop läuft im Hintergrund weiter, überspringt aber rechenintensive Schritte
          if (!isVisible) {
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // Sicherheitscheck: Canvas muss Dimensionen haben
          if (canvas.width === 0 || canvas.height === 0) {
            setSize()
            rafRef.current = requestAnimationFrame(frame)
            return
          }

          // Zeit seit Start in Sekunden — für Zoom-Oszillation
          const t = (now - s.startTime) / 1000

          // Zoom oszilliert sanft zwischen 120 und 240
          const zoom = 180 + Math.sin(t * 0.3) * 60

          // ── Timing und Morph-Logik ──────────────────────────────────────────
          let elapsed = now - s.lastSwitch
          if (elapsed >= SWITCH_INTERVAL_MS) {
            s.paramIdx = (s.paramIdx + 1) % JULIA_PARAMS.length
            s.lastSwitch = now
            elapsed = 0
          }

          let cx = JULIA_PARAMS[s.paramIdx].cx
          let cy = JULIA_PARAMS[s.paramIdx].cy
          let label = `JULIA // ${JULIA_PARAMS[s.paramIdx].label}`

          const morphThreshold = SWITCH_INTERVAL_MS - TRANSITION_MS // 9000 ms
          if (elapsed >= morphThreshold) {
            const nextIdx = (s.paramIdx + 1) % JULIA_PARAMS.length
            const p = (elapsed - morphThreshold) / TRANSITION_MS
            const currentParam = JULIA_PARAMS[s.paramIdx]
            const nextParam = JULIA_PARAMS[nextIdx]

            cx = currentParam.cx + (nextParam.cx - currentParam.cx) * p
            cy = currentParam.cy + (nextParam.cy - currentParam.cy) * p

            label = `JULIA // ${currentParam.label} -> ${nextParam.label} (${Math.round(p * 100)}%)`
          }

          try {
            // Julia-Menge rendern: c = cx + i*cy, Mittelpunkt (0,0), maxIter=200
            render_julia(
              buf,
              RENDER_W,
              RENDER_H,
              cx,
              cy,
              0,          // center_x
              0,          // center_y
              zoom,
              200,        // max_iter
            )

            // Pixel-Buffer auf Canvas übertragen
            ctx.putImageData(imgData, 0, 0)
          } catch { /* WASM-Fehler still ignorieren */ }

          // Label unten rechts — zeigt aktuellen Parametersatz bzw. Morph-Fortschritt
          ctx.save()
          ctx.font         = '11px monospace'
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'bottom'
          ctx.fillStyle    = 'rgba(74,222,128,0.9)'  // green-400
          ctx.fillText(label, RENDER_W - 6, RENDER_H - 4)
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
