import { useEffect, useRef } from 'react'
import { subscribe } from '../utils/raf-coordinator'

// ─────────────────────────────────────────────────────────────────────────────
// GlitchOverlay — Vollbild-Stoereffekt im Stil eines analogen VHS-Bandes.
//
// Hintergrund (Audit-Befund + Designentscheidung):
//   Die vorherige Variante zeichnete pro Frame ~40 fillRect-Operationen,
//   setzte canvas.width/height in jedem rAF-Tick neu (= forced repaint des
//   gesamten Vollbild-Canvas) und nutzte zudem eine harte Hacker-Gruen-
//   Palette. Resultat: Wenn der Glitch aktiv war, ruckelte die gesamte
//   Seite spuerbar, und das Aussehen passte nicht zur gewollten "analoge
//   VHS-Stoerung"-Optik.
//
// Aenderungen:
//   1. rAF wird nur waehrend eines aktiven Glitches abonniert. In den
//      Ruhephasen (5-15 s zwischen Glitches) keine Frame-Last.
//   2. canvas.width/height wird ausschliesslich bei Mount und Window-Resize
//      gesetzt — kein impliziter Vollbild-Repaint pro Frame mehr.
//   3. Die Scanlines wurden aus der per-Frame fillRect-Schleife geholt und
//      ueber eine CSS-Hintergrund-Gradient-Schicht permanent gezeigt. Das
//      spart ~360 fillRect-Calls pro Frame bei 1080p.
//   4. rAF ueber den zentralen raf-coordinator statt eigenem
//      requestAnimationFrame-Loop. So pausiert der Glitch automatisch
//      waehrend Layout-Slides.
//   5. Farbpalette: weniger gesaettigt, mehr VHS-typische Stoerungen
//      (Chroma-Bleed in Magenta/Cyan, Dropouts als schwarze Lines,
//      Tracking-Banding mit hellem Rauschen).
// ─────────────────────────────────────────────────────────────────────────────

// Zeichnet einen einzelnen Glitch-Frame auf den Canvas.
// intensity: 0..1 — wie stark der Glitch gerade ist.
function drawGlitchFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
) {
  ctx.clearRect(0, 0, W, H)

  // ── VHS-Tracking-Fehler: helle Banding-Streifen, bevorzugt am oberen ──────
  // oder unteren Bildrand (echtes VHS verliert das Tracking dort zuerst).
  const bandCount = 2 + Math.floor(Math.random() * 4)
  for (let i = 0; i < bandCount; i++) {
    // 50/50: oben oder unten. In der Bildmitte selten.
    const y = (Math.random() < 0.5)
      ? Math.random() * (H * 0.18)
      : H * 0.82 + Math.random() * (H * 0.18)
    const h = 2 + Math.random() * 10
    // Helles, leicht warmes Grau (statt hartes Gruen).
    ctx.fillStyle = `rgba(230,225,215,${0.10 * intensity})`
    ctx.fillRect(0, y, W, h)
    // In den Tracking-Bands sitzt oft "noise crawl" — kurze schwarze
    // Dropout-Schlieren.
    const dropouts = 2 + Math.floor(Math.random() * 5)
    for (let k = 0; k < dropouts; k++) {
      const dx = Math.random() * W
      const dw = 20 + Math.random() * 80
      ctx.fillStyle = `rgba(0,0,0,${0.32 * intensity})`
      ctx.fillRect(dx, y, dw, h)
    }
  }

  // ── Horizontale Slice-Versaetze mit Chroma-Bleed (Y/C-Crosstalk) ──────────
  // Hellrot + Cyan-Doppellinien — sieht aus wie ein verrutschter
  // Farbtraeger bei analogem Composite-Video.
  const sliceCount = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < sliceCount; i++) {
    const y = Math.random() * H
    const h = 4 + Math.random() * 28
    const shift = (Math.random() - 0.5) * 60
    ctx.fillStyle = `rgba(220,50,90,${0.10 * intensity})`
    ctx.fillRect(shift - 5, y, W, h)
    ctx.fillStyle = `rgba(60,200,220,${0.10 * intensity})`
    ctx.fillRect(shift + 5, y, W, h)
  }

  // ── Dropouts (Signalverlust): schmale schwarze Querstriche, irgendwo ──────
  // im Bild verteilt. Klassische VHS-Bandschaeden.
  const dropoutCount = 2 + Math.floor(Math.random() * 5)
  for (let i = 0; i < dropoutCount; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const w = 40 + Math.random() * 220
    const h = 1 + Math.random() * 3
    ctx.fillStyle = `rgba(0,0,0,${0.48 * intensity})`
    ctx.fillRect(x, y, w, h)
  }

  // ── Capstan-Wobble: kurze duenne Querlinien, leicht cyan ──────────────────
  // Nur bei starker Intensitaet — sonst zu viel Detail bei kleinen Peaks.
  if (intensity > 0.4 && Math.random() > 0.5) {
    const wobble = 3 + Math.floor(Math.random() * 4)
    for (let i = 0; i < wobble; i++) {
      const y = Math.random() * H
      ctx.fillStyle = `rgba(200,240,240,${0.06 * intensity})`
      ctx.fillRect(0, y, W, 1)
    }
  }

  // ── Vollbild-Helligkeits-Pulse (selten, kurze Blende) ─────────────────────
  // Macht den Eindruck "Spannungseinbruch im Geraet".
  if (Math.random() > 0.85) {
    ctx.fillStyle = `rgba(200,180,140,${0.05 * intensity})`
    ctx.fillRect(0, 0, W, H)
  }
}

export default function GlitchOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas-Groesse einmalig auf Window-Groesse setzen. Wird nur bei
    // tatsaechlicher Fenstergroessenaenderung neu gesetzt — NICHT in der
    // rAF-Schleife. Vermeidet pro-Frame-Resets des gesamten Vollbild-Buffers.
    const syncSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    syncSize()
    window.addEventListener('resize', syncSize)

    // State der aktiven Glitch-Episode. Wird beim Beenden der Episode
    // zurueckgesetzt. So braucht der rAF-Coordinator-Callback keinen Closure
    // ueber dynamische Werte zu halten.
    let unsubscribe: (() => void) | null = null
    let episodeStart = 0
    let episodeDuration = 0
    let episodePeaks: number[] = []
    let nextTimeout: ReturnType<typeof setTimeout> | null = null

    function stopEpisode() {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
    }

    function glitchFrame(t: number) {
      const elapsed = t - episodeStart
      if (elapsed >= episodeDuration) {
        stopEpisode()
        // Naechsten Glitch einplanen — 5-15 s zwischen Episoden.
        const next = 5_000 + Math.random() * 10_000
        nextTimeout = setTimeout(startEpisode, next)
        return
      }

      const u = elapsed / episodeDuration
      let intensity = 0
      for (const p of episodePeaks) {
        const d = Math.abs(u - p)
        // Breiter Peak (d*6) → laenger sichtbar als ein scharfer Spike.
        intensity += Math.max(0, 1 - d * 6)
      }
      if (intensity > 1) intensity = 1

      // Schwelle hoeher als vorher (0.06 statt 0.03), damit das Overlay
      // nicht fuer jeden Mini-Tail-Wert noch ein Vollbild-Zeichnen ausloest.
      if (intensity > 0.06) {
        drawGlitchFrame(ctx!, canvas!.width, canvas!.height, intensity)
      } else {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      }
    }

    function startEpisode() {
      // Dauer einer Glitch-Episode: 300-1300 ms.
      episodeDuration = 300 + Math.random() * 1000
      episodeStart = performance.now()
      // 1-4 Peaks innerhalb der Episode (Verteilung sortiert).
      const peakCount = 1 + Math.floor(Math.random() * 4)
      episodePeaks = []
      for (let i = 0; i < peakCount; i++) episodePeaks.push(Math.random())
      episodePeaks.sort((a, b) => a - b)
      // rAF erst hier abonnieren — in der Ruhephase laeuft kein Callback.
      unsubscribe = subscribe(glitchFrame)
    }

    // Erster Glitch: 1-3 Sekunden nach Mount.
    const firstDelay = 1_000 + Math.random() * 2_000
    nextTimeout = setTimeout(startEpisode, firstDelay)

    return () => {
      window.removeEventListener('resize', syncSize)
      if (unsubscribe) unsubscribe()
      if (nextTimeout) clearTimeout(nextTimeout)
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
        // Scanlines konstant via CSS-Hintergrund statt pro Frame mit
        // fillRect malen — ~360 Calls pro Frame bei 1080p gespart. Der
        // Effekt ist permanent sichtbar (CRT/VHS-Look), genauso wie
        // vorher gewollt.
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)',
      }}
    />
  )
}
