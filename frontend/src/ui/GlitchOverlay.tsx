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

// Zeichnet einen VHS-Tracking-Stoerstreifen (ca. 10% Bildhoehe) aus weissen,
// verschwommenen Pixeln/analogem Schnee, inklusive horizontalem Sync-Drift.
function drawTrackingBarGlitch(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
  barY: number,
  barH: number,
  variant: number,
) {
  ctx.clearRect(0, 0, W, H)

  // Varianten-Konfiguration
  let blurRadius = 1.2
  let snowDensity = 0.55
  let skewStrength = 32
  let colorBleed = 10

  if (variant === 2) {
    // Variante 2: Schaerferer Schnee, massiver Sync-Drift / Verbiegung
    blurRadius = 0.6
    snowDensity = 0.45
    skewStrength = 55
    colorBleed = 16
  } else if (variant === 3) {
    // Variante 3: Sehr weichgezeichneter, breiterer Stoerstreifen mit weniger Drift
    blurRadius = 2.2
    snowDensity = 0.70
    skewStrength = 18
    colorBleed = 6
  }

  // 1. Der verschwommene Schnee-Streifen selbst
  ctx.save()
  if (blurRadius > 0) {
    ctx.filter = `blur(${blurRadius}px)`
  }

  const cellH = 4
  const rows = Math.floor(barH / cellH)
  const cols = 60
  const cellW = W / cols

  for (let r = 0; r < rows; r++) {
    const y = barY + r * cellH
    const wrappedY = (y + H) % H

    for (let c = 0; c < cols; c++) {
      if (Math.random() < snowDensity) {
        const val = 180 + Math.floor(Math.random() * 75)
        const alpha = (0.25 + Math.random() * 0.55) * intensity
        ctx.fillStyle = `rgba(${val},${val},${val},${alpha})`
        ctx.fillRect(c * cellW, wrappedY, cellW, cellH)
      } else if (Math.random() > 0.85) {
        ctx.fillStyle = `rgba(0,0,0,${0.8 * intensity})`
        ctx.fillRect(c * cellW, wrappedY, cellW, cellH)
      }
    }
  }
  ctx.restore()

  // 2. Feine, kontrastreiche Stoerlinien/Ausfaelle direkt um den Streifen
  const gapCount = variant === 2 ? 6 : 3
  for (let i = 0; i < gapCount; i++) {
    const gy = (barY + (Math.random() - 0.5) * (barH * 1.5) + H) % H
    const gh = 1 + Math.random() * 3
    ctx.fillStyle = `rgba(0,0,0,${0.85 * intensity})`
    ctx.fillRect(0, gy, W, gh)
  }

  // 3. Horizontaler Sync-Drift (Verschiebung der Bildzeilen in der Naehe des Streifens)
  const bendZoneH = barH * (variant === 2 ? 3.2 : 2.2)
  const bendSlices = variant === 2 ? 28 : 18
  const sliceH = bendZoneH / bendSlices
  const startY = barY - bendZoneH / 2

  for (let i = 0; i < bendSlices; i++) {
    const y = startY + i * sliceH
    const wrappedY = (y + H) % H

    const distToCenter = Math.abs(y - (barY + barH / 2))
    const proximity = Math.max(0, 1 - distToCenter / (bendZoneH / 2))

    const timeFactor = performance.now() * 0.012
    const shift = Math.sin(y * 0.04 + timeFactor) * skewStrength * proximity * intensity

    if (proximity > 0.05) {
      // Fuchsia Chroma-Bleed
      ctx.fillStyle = `rgba(255, 0, 128, ${0.16 * proximity * intensity})`
      ctx.fillRect(shift - colorBleed, wrappedY, W, sliceH)
      // Cyan Chroma-Bleed
      ctx.fillStyle = `rgba(0, 255, 255, ${0.16 * proximity * intensity})`
      ctx.fillRect(shift + colorBleed, wrappedY, W, sliceH)
      // Weisser Kern-Versetzer
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * proximity * intensity})`
      ctx.fillRect(shift, wrappedY, W, sliceH)
    }
  }

  // 4. Head-Switching-Noise ganz unten am Bildschirmrand (Vollbild-Verschiebung)
  const noiseH = 14
  const noiseY = H - noiseH
  const blockCount = 60
  const blockW = W / blockCount
  for (let b = 0; b < blockCount; b++) {
    const val = Math.random() > 0.5 ? 230 : 20
    ctx.fillStyle = `rgba(${val},${val},${val},${(0.25 + 0.45 * Math.random()) * intensity})`
    const jitterH = Math.random() * noiseH
    ctx.fillRect(b * blockW, noiseY + (noiseH - jitterH), blockW, jitterH)
  }

  // 5. VCR OSD-Text während des Tracking-Glitches
  ctx.save()
  const osdJitter = (Math.random() - 0.5) * 8.0 * intensity
  ctx.translate(osdJitter, 0)
  ctx.font = 'bold 18px "Courier New", Courier, monospace'
  ctx.fillStyle = `rgba(0, 245, 95, ${0.85 * intensity})`
  ctx.shadowBlur = 5
  ctx.shadowColor = 'rgba(0, 245, 95, 0.4)'

  ctx.fillText('TRACKING', 35, H - 65)

  const elapsedSecs = Math.floor(performance.now() / 1000)
  const hours = Math.floor(elapsedSecs / 3600)
  const mins = Math.floor((elapsedSecs % 3600) / 60)
  const secs = elapsedSecs % 60
  const timeStr = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  ctx.fillText(timeStr, 35, H - 35)
  ctx.restore()
}

export default function GlitchOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const syncSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    syncSize()
    window.addEventListener('resize', syncSize)

    let unsubscribe: (() => void) | null = null
    let episodeStart = 0
    let episodeDuration = 0
    let episodePeaks: number[] = []
    let nextTimeout: ReturnType<typeof setTimeout> | null = null

    // Glitch-Konfigurationen
    let glitchType: 'composite' | 'tracking_bar' = 'composite'
    let trackingBarY = 0
    let trackingBarH = 0
    let trackingDriftSpeed = 0
    let trackingVariant = 1

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
        
        // Schneller Loop bei URL-Steuerung aktivieren
        const params = new URLSearchParams(window.location.search)
        const loopActive = params.has('glitch_loop')
        
        let next = 8_000 + Math.random() * 10_000
        if (loopActive) {
          next = 2000 // 2 Sekunden Pause fuer Inspektion / Review
        }
        nextTimeout = setTimeout(startEpisode, next)
        return
      }

      const u = elapsed / episodeDuration
      let intensity = 0
      for (const p of episodePeaks) {
        const d = Math.abs(u - p)
        intensity += Math.max(0, 1 - d * 3.5)
      }
      if (intensity > 1) intensity = 1

      if (intensity > 0.05) {
        if (glitchType === 'tracking_bar') {
          const H = canvas!.height
          const currentY = (trackingBarY + trackingDriftSpeed * (elapsed / 1000) + H) % H
          drawTrackingBarGlitch(
            ctx!,
            canvas!.width,
            canvas!.height,
            intensity,
            currentY,
            trackingBarH,
            trackingVariant,
          )
        } else {
          drawGlitchFrame(ctx!, canvas!.width, canvas!.height, intensity)
        }
      } else {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      }
    }

    function startEpisode() {
      const params = new URLSearchParams(window.location.search)
      const forceType = params.get('glitch_type')
      const forceVariant = params.get('glitch_variant')
      const loopActive = params.has('glitch_loop')

      // Typ-Entscheidung
      if (forceType === 'tracking_bar') {
        glitchType = 'tracking_bar'
      } else if (forceType === 'composite') {
        glitchType = 'composite'
      } else {
        glitchType = Math.random() > 0.5 ? 'tracking_bar' : 'composite'
      }

      // Variante waehlen
      if (forceVariant) {
        trackingVariant = parseInt(forceVariant, 10) || 1
      } else {
        trackingVariant = 1 + Math.floor(Math.random() * 3)
      }

      if (glitchType === 'tracking_bar') {
        // 10s bei Loop-Aktivierung (Review), sonst 4-6s
        episodeDuration = loopActive ? 10000 : (4000 + Math.random() * 2000)
        trackingBarH = Math.floor(window.innerHeight * 0.10)

        
        // y-Position: meist oben/unten (45% oben, 45% unten, 10% mitte)
        const rand = Math.random()
        const H = window.innerHeight
        if (rand < 0.45) {
          trackingBarY = Math.random() * (H * 0.20)
        } else if (rand < 0.90) {
          trackingBarY = H * 0.70 + Math.random() * (H * 0.20)
        } else {
          trackingBarY = H * 0.20 + Math.random() * (H * 0.50)
        }

        // Drift-Geschwindigkeit: 20-50 px/s (rauf/runter)
        const dir = Math.random() > 0.5 ? 1 : -1
        trackingDriftSpeed = dir * (20 + Math.random() * 30)
      } else {
        // Composite Glitch: 1.0s - 2.5s
        episodeDuration = 1000 + Math.random() * 1500
      }

      episodeStart = performance.now()
      const peakCount = 2 + Math.floor(Math.random() * 4)
      episodePeaks = []
      for (let i = 0; i < peakCount; i++) episodePeaks.push(Math.random())
      episodePeaks.sort((a, b) => a - b)
      
      unsubscribe = subscribe(glitchFrame)
    }

    const params = new URLSearchParams(window.location.search)
    const hasForce = params.has('glitch_type') || params.has('glitch_variant')
    const firstDelay = hasForce ? 200 : 1_000 + Math.random() * 2_000
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
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)',
      }}
    />
  )
}
