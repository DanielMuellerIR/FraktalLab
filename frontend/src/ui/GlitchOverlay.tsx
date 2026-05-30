import { useEffect, useRef } from 'react'
import { subscribe } from '../utils/raf-coordinator'

// ─────────────────────────────────────────────────────────────────────────────
// GlitchOverlay — Vollbild-Stoereffekt im Stil eines analogen VHS-Bandes.
// ─────────────────────────────────────────────────────────────────────────────

// Zeichnet einen einzelnen Glitch-Frame auf den Canvas.
// intensity: 0..1 — wie stark der Glitch gerade ist.
function drawGlitchFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
) {
  ctx.clearRect(0, 0, W, H)

  // 1. VCR Head Switching Noise (at bottom 14px)
  if (intensity > 0.05) {
    const noiseH = 14
    const noiseY = H - noiseH
    const blockCount = 60
    const blockW = W / blockCount
    for (let b = 0; b < blockCount; b++) {
      const val = Math.random() > 0.5 ? 240 : 15
      ctx.fillStyle = `rgba(${val},${val},${val},${(0.20 + 0.35 * Math.random()) * intensity})`
      const jitterH = Math.random() * noiseH
      ctx.fillRect(b * blockW, noiseY + (noiseH - jitterH), blockW, jitterH)
    }
  }

  // 2. Tracking snow bands / analog static
  if (intensity > 0.2) {
    const snowBands = 1 + Math.floor(Math.random() * 2)
    for (let s = 0; s < snowBands; s++) {
      const snowHeight = 12 + Math.random() * 24
      const snowY = Math.random() * (H - snowHeight - 20)
      const blockCount = 50
      const blockW = W / blockCount
      for (let b = 0; b < blockCount; b++) {
        const val = Math.floor(Math.random() * 255)
        ctx.fillStyle = `rgba(${val},${val},${val},${0.18 * intensity})`
        ctx.fillRect(b * blockW, snowY + (Math.random() - 0.5) * 4, blockW, snowHeight)
      }
    }
  }

  // 3. VHS Tracking bands (warm gray)
  const bandCount = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < bandCount; i++) {
    const y = (Math.random() < 0.5)
      ? Math.random() * (H * 0.22)
      : H * 0.78 + Math.random() * (H * 0.22)
    const h = 3 + Math.random() * 12
    ctx.fillStyle = `rgba(230,225,215,${0.12 * intensity})`
    ctx.fillRect(0, y, W, h)
    
    const dropouts = 2 + Math.floor(Math.random() * 4)
    for (let k = 0; k < dropouts; k++) {
      const dx = Math.random() * W
      const dw = 30 + Math.random() * 110
      ctx.fillStyle = `rgba(0,0,0,${0.35 * intensity})`
      ctx.fillRect(dx, y, dw, h)
    }
  }

  // 4. Sync Drift / Horizontal Wave Bend
  if (intensity > 0.25) {
    const bendCount = 1 + Math.floor(Math.random() * 2)
    for (let b = 0; b < bendCount; b++) {
      const y = Math.random() * (H * 0.7)
      const h = 35 + Math.random() * 95
      const shift = (Math.random() - 0.5) * 80 * intensity
      
      ctx.fillStyle = `rgba(240,40,90,${0.08 * intensity})`
      ctx.fillRect(shift - 4, y, W, h)
      ctx.fillStyle = `rgba(40,220,240,${0.08 * intensity})`
      ctx.fillRect(shift + 4, y + 2, W, h)
    }
  }

  // 5. Horizontale Slice-Versaetze mit Chroma-Bleed (composite color artifacts)
  const sliceCount = 3 + Math.floor(Math.random() * 4)
  for (let i = 0; i < sliceCount; i++) {
    const y = Math.random() * H
    const h = 3 + Math.random() * 20
    const shift = (Math.random() - 0.5) * 70 * intensity
    ctx.fillStyle = `rgba(225,45,110,${0.12 * intensity})`
    ctx.fillRect(shift - 6, y, W, h)
    ctx.fillStyle = `rgba(50,210,230,${0.12 * intensity})`
    ctx.fillRect(shift + 6, y, W, h)
  }

  // 6. Signal Dropouts (black horizontal scanline slices)
  const dropoutCount = 3 + Math.floor(Math.random() * 6)
  for (let i = 0; i < dropoutCount; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const w = 50 + Math.random() * 250
    const h = 1 + Math.random() * 3
    ctx.fillStyle = `rgba(0,0,0,${0.55 * intensity})`
    ctx.fillRect(x, y, w, h)
  }

  // 7. Capstan-Wobble / thin static lines
  if (intensity > 0.35 && Math.random() > 0.4) {
    const wobble = 4 + Math.floor(Math.random() * 5)
    for (let i = 0; i < wobble; i++) {
      const y = Math.random() * H
      ctx.fillStyle = `rgba(180,250,250,${0.08 * intensity})`
      ctx.fillRect(0, y, W, 1)
    }
  }

  // 8. Full screen brightness pulse / voltage drops
  if (Math.random() > 0.82) {
    ctx.fillStyle = `rgba(210,185,130,${0.07 * intensity})`
    ctx.fillRect(0, 0, W, H)
  }

  // 9. VHS OSD overlay
  if (intensity > 0.05) {
    ctx.save()
    // Tracking jitter offsets the text slightly at high intensities
    const osdJitter = intensity > 0.6 ? (Math.random() - 0.5) * 12.0 : 0.0
    ctx.translate(osdJitter, 0)
    
    ctx.font = 'bold 18px "Courier New", Courier, monospace'
    // VHS green phosphors color
    ctx.fillStyle = `rgba(0, 245, 95, ${0.85 * intensity})`
    ctx.shadowBlur = 5
    ctx.shadowColor = 'rgba(0, 245, 95, 0.4)'
    
    // Glitch-sensitive labeling
    let actionText = 'PLAY  ▶'
    if (intensity > 0.75) {
      const choice = Math.random()
      actionText = choice > 0.66 ? 'AUTO TRACKING' : choice > 0.33 ? 'TAPE SLIP' : 'NO SIGNAL'
    }
    
    ctx.fillText(actionText, 35, H - 65)
    
    // VCR elapsed time logic
    const elapsedSecs = Math.floor(performance.now() / 1000)
    const hours = Math.floor(elapsedSecs / 3600)
    const mins = Math.floor((elapsedSecs % 3600) / 60)
    const secs = elapsedSecs % 60
    const timeStr = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    ctx.fillText(timeStr, 35, H - 35)
    
    // Tape format label on the right
    ctx.font = '14px "Courier New", Courier, monospace'
    ctx.fillText('SP', W - 65, H - 35)
    ctx.restore()
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
        // Naechsten Glitch einplanen — 7-15 s zwischen Episoden.
        const next = 7_000 + Math.random() * 8_000
        nextTimeout = setTimeout(startEpisode, next)
        return
      }

      const u = elapsed / episodeDuration
      let intensity = 0
      for (const p of episodePeaks) {
        const d = Math.abs(u - p)
        // Breiter Peak (d*3.5) → laenger sichtbar als ein scharfer Spike.
        intensity += Math.max(0, 1 - d * 3.5)
      }
      if (intensity > 1) intensity = 1

      // Schwelle hoeher als vorher (0.05 statt 0.03)
      if (intensity > 0.05) {
        drawGlitchFrame(ctx!, canvas!.width, canvas!.height, intensity)
      } else {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      }
    }

    function startEpisode() {
      // Dauer einer Glitch-Episode: 1000-2500 ms (laenger fuer echten Stoereffekt)
      episodeDuration = 1000 + Math.random() * 1500
      episodeStart = performance.now()
      // 2-5 Peaks innerhalb der Episode.
      const peakCount = 2 + Math.floor(Math.random() * 4)
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
        // EFFEKT ist permanent sichtbar (CRT/VHS-Look), genauso wie
        // vorher gewollt.
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)',
      }}
    />
  )
}
