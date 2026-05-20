import { useEffect, useRef } from 'react'

// Zeichnet einen einzelnen Glitch-Frame auf den Canvas
function drawGlitchFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,   // 0..1 — Stärke des aktuellen Frames
) {
  ctx.clearRect(0, 0, W, H)

  // ── VHS-Tracking-Fehler: horizontale helle Bänder ────────────────────────
  const bandCount = 2 + Math.floor(Math.random() * 4)
  for (let i = 0; i < bandCount; i++) {
    const y    = Math.random() * H
    const h    = 1 + Math.random() * 8
    const br   = 0.06 + Math.random() * 0.12
    ctx.fillStyle = `rgba(0,255,60,${br * intensity})`
    ctx.fillRect(0, y, W, h)
  }

  // ── Horizontale Verschiebungs-Blöcke (simulierter Zeilen-Versatz) ────────
  const sliceCount = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < sliceCount; i++) {
    const y   = Math.random() * H
    const h   = 3 + Math.random() * 20
    const xOff = (Math.random() - 0.5) * 30
    // Überlagern mit Farb-Shift (rot links, blau rechts)
    ctx.fillStyle = `rgba(255,0,0,${0.05 * intensity})`
    ctx.fillRect(xOff - 6, y, W, h)
    ctx.fillStyle = `rgba(0,100,255,${0.05 * intensity})`
    ctx.fillRect(xOff + 6, y, W, h)
    // Heller Streifen
    ctx.fillStyle = `rgba(200,255,200,${0.08 * intensity})`
    ctx.fillRect(0, y + h * 0.4, W, h * 0.2)
  }

  // ── Rausch-Blöcke (digitale Artefakte) ───────────────────────────────────
  const noiseBlocks = 3 + Math.floor(Math.random() * 6)
  for (let i = 0; i < noiseBlocks; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const w = 5 + Math.random() * 60
    const h = 2 + Math.random() * 15
    // Zufällige Farbe: meist grün-grau, gelegentlich weiß
    const v = Math.random()
    if (v > 0.8) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 * intensity})`
    } else {
      ctx.fillStyle = `rgba(0,${100 + Math.random()*155},0,${0.08 * intensity})`
    }
    ctx.fillRect(x, y, w, h)
  }

  // ── Kurzer Vollbild-Blitz (ganz selten) ──────────────────────────────────
  if (Math.random() > 0.85) {
    ctx.fillStyle = `rgba(0,255,0,${0.04 * intensity})`
    ctx.fillRect(0, 0, W, H)
  }

  // ── Scan-Lines: dunkle horizontale Linien (CRT-Effekt verstärkt) ─────────
  ctx.fillStyle = `rgba(0,0,0,${0.04 * intensity})`
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1)
  }
}

export default function GlitchOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let nextTimeout: ReturnType<typeof setTimeout>

    function runGlitch() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Zufällige Glitch-Dauer: 200–900 ms
      const duration = 200 + Math.random() * 700
      const start    = performance.now()

      // Zufällig 1–3 "Peaks" innerhalb der Dauer (mehrfache Ausschläge)
      const peaks: number[] = Array.from(
        { length: 1 + Math.floor(Math.random() * 3) },
        () => Math.random(),
      ).sort((a, b) => a - b)

      function glitchFrame(now: number) {
        const elapsed = now - start
        if (elapsed >= duration) {
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
          // Nächsten Glitch einplanen: 60–180 Sekunden
          const next = 60_000 + Math.random() * 120_000
          nextTimeout = setTimeout(runGlitch, next)
          return
        }

        const t = elapsed / duration
        // Intensität aus Peaks berechnen: Summe der Nähe zu jedem Peak
        let intensity = 0
        for (const p of peaks) {
          const d = Math.abs(t - p)
          intensity += Math.max(0, 1 - d * 12)
        }
        intensity = Math.min(1, intensity)

        if (intensity > 0.05) {
          canvas!.width  = window.innerWidth
          canvas!.height = window.innerHeight
          drawGlitchFrame(ctx!, canvas!.width, canvas!.height, intensity)
        } else {
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
        }

        rafId = requestAnimationFrame(glitchFrame)
      }

      rafId = requestAnimationFrame(glitchFrame)
    }

    // Erster Glitch: 5–10 Sekunden nach Seitenload (zum Testen früh genug)
    const firstDelay = 5_000 + Math.random() * 5_000
    nextTimeout = setTimeout(runGlitch, firstDelay)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(nextTimeout)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        pointerEvents: 'none',
        zIndex:        9999,
      }}
    />
  )
}
