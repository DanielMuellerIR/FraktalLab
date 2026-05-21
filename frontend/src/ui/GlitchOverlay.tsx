import { useEffect, useRef } from 'react'

// Zeichnet einen einzelnen Glitch-Frame auf den Canvas.
// intensity: 0..1 — wie stark der Glitch gerade ist
function drawGlitchFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
) {
  ctx.clearRect(0, 0, W, H)

  // ── VHS-Tracking-Fehler: horizontale helle Bänder ────────────────────────
  // Mehr Bänder als vorher: 4-12 statt 2-6
  const bandCount = 4 + Math.floor(Math.random() * 8)
  for (let i = 0; i < bandCount; i++) {
    const y  = Math.random() * H
    const h  = 1 + Math.random() * 14
    const br = 0.12 + Math.random() * 0.25
    ctx.fillStyle = `rgba(0,255,60,${br * intensity})`
    ctx.fillRect(0, y, W, h)
  }

  // ── Horizontale Verschiebungs-Blöcke (simulierter Zeilen-Versatz) ────────
  // 3–8 Slices, jede mit frisch zufälligem y und xOff pro Frame
  const sliceCount = 3 + Math.floor(Math.random() * 6)  // 3..8
  for (let i = 0; i < sliceCount; i++) {
    // Jeder Slice bekommt eine völlig zufällige Bildschirmhöhe
    const y    = Math.random() * H
    const h    = 4 + Math.random() * 40
    // xOff wird jedes Frame neu gewürfelt → sichtbares Flackern
    const xOff = (Math.random() - 0.5) * 160
    ctx.fillStyle = `rgba(255,0,0,${0.12 * intensity})`
    ctx.fillRect(xOff - 10, y, W, h)
    ctx.fillStyle = `rgba(0,100,255,${0.12 * intensity})`
    ctx.fillRect(xOff + 10, y, W, h)
    ctx.fillStyle = `rgba(200,255,200,${0.15 * intensity})`
    ctx.fillRect(0, y + h * 0.4, W, h * 0.2)
  }

  // ── Rausch-Blöcke (digitale Artefakte) ───────────────────────────────────
  // Mehr und größere Blöcke
  const noiseBlocks = 8 + Math.floor(Math.random() * 12)
  for (let i = 0; i < noiseBlocks; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const w = 10 + Math.random() * 120
    const h = 3 + Math.random() * 30
    const v = Math.random()
    if (v > 0.7) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 * intensity})`
    } else if (v > 0.4) {
      ctx.fillStyle = `rgba(0,${120 + Math.random() * 135},0,${0.12 * intensity})`
    } else {
      // Gelegentlich rote oder blaue Artefakte
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,0,0' : '0,80,255'},${0.1 * intensity})`
    }
    ctx.fillRect(x, y, w, h)
  }

  // ── Vertikale Streifen (neu: seltener aber auffälliger) ───────────────────
  if (Math.random() > 0.6) {
    const x = Math.random() * W
    const w = 2 + Math.random() * 8
    ctx.fillStyle = `rgba(0,255,0,${0.2 * intensity})`
    ctx.fillRect(x, 0, w, H)
  }

  // ── Kurzer Vollbild-Blitz (häufiger als vorher) ───────────────────────────
  if (Math.random() > 0.6) {
    ctx.fillStyle = `rgba(0,255,0,${0.08 * intensity})`
    ctx.fillRect(0, 0, W, H)
  }

  // ── RGB-Split-Effekt (horizontal verschoben) ──────────────────────────────
  // Simuliert Chromatic Aberration
  if (intensity > 0.4 && Math.random() > 0.5) {
    const shift = 5 + Math.random() * 20
    const h     = 10 + Math.random() * 60
    const y     = Math.random() * (H - h)
    ctx.fillStyle = `rgba(255,0,0,${0.08 * intensity})`
    ctx.fillRect(-shift, y, W, h)
    ctx.fillStyle = `rgba(0,0,255,${0.08 * intensity})`
    ctx.fillRect(shift, y, W, h)
  }

  // ── Scan-Lines: dunkle horizontale Linien (CRT-Effekt) ────────────────────
  // Immer aktiv, nicht nur während Glitch
  ctx.fillStyle = `rgba(0,0,0,${0.06 * intensity})`
  for (let y = 0; y < H; y += 3) {
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

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    let rafId: number
    let nextTimeout: ReturnType<typeof setTimeout>

    function runGlitch() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Glitch-Dauer: 300–1500 ms (länger als vorher)
      const duration = 300 + Math.random() * 1200
      const start    = performance.now()

      // 1–5 Peaks (häufiger als vorher: 1-3)
      const peaks: number[] = Array.from(
        { length: 1 + Math.floor(Math.random() * 5) },
        () => Math.random(),
      ).sort((a, b) => a - b)

      function glitchFrame(now: number) {
        const elapsed = now - start
        if (elapsed >= duration) {
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
          // Nächsten Glitch einplanen: 5–15 Sekunden (statt 20-60s)
          const next = 5_000 + Math.random() * 10_000
          nextTimeout = setTimeout(runGlitch, next)
          return
        }

        const t = elapsed / duration
        let intensity = 0
        for (const p of peaks) {
          const d = Math.abs(t - p)
          // Breiterer Peak (d*6 statt d*12) → länger sichtbar
          intensity += Math.max(0, 1 - d * 6)
        }
        intensity = Math.min(1, intensity)

        if (intensity > 0.03) {
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

    // Erster Glitch: 1–3 Sekunden nach Seitenload (schneller als vorher: 3-6s)
    const firstDelay = 1_000 + Math.random() * 2_000
    nextTimeout = setTimeout(runGlitch, firstDelay)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(nextTimeout)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-testid="glitch-overlay"
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
