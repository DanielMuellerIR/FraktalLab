import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Konstanten ───────────────────────────────────────────────────────────────

const SWEEP_PERIOD_MS = 4500
const MAX_BLIPS = 12
const INITIAL_BLIPS = 9
const BLIP_FADE_MS = 3800
const TRAIL_ARC = Math.PI * 0.45 // ~80 Grad Nachleuchten

const BLIP_CONFIGS = [
  { label: 'HOSTILE TGT-01', type: 'hostile' as const },
  { label: 'HOSTILE UNK-03', type: 'hostile' as const },
  { label: 'HOSTILE BOGEY', type: 'hostile' as const },
  { label: 'HOSTILE ALARM', type: 'hostile' as const },
  { label: 'FRIENDLY TRK-08', type: 'friendly' as const },
  { label: 'FRIENDLY ALT-02', type: 'friendly' as const },
  { label: 'FRIENDLY CIVIL-5', type: 'friendly' as const },
  { label: 'WARNING ECHO-4', type: 'echo' as const },
  { label: 'WARNING ECHO-9', type: 'echo' as const },
  { label: 'WARNING TGT-X', type: 'echo' as const },
]

// ── Typen ────────────────────────────────────────────────────────────────────

interface Blip {
  r: number
  angle: number
  angularSpeed: number
  radialSpeed: number
  label: string | null
  type: 'hostile' | 'friendly' | 'echo'
  lastHitTime: number
  alpha: number
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function makeBlip(now: number, visible: boolean): Blip {
  const r = rand(0.15, 0.90)
  const angle = rand(0, Math.PI * 2)

  const moving = Math.random() < 0.35
  const angularSpeed = moving ? rand(0.00004, 0.00012) * (Math.random() < 0.5 ? 1 : -1) : 0
  const radialSpeed = moving ? rand(-0.00002, 0.00002) : 0

  const hasLabel = Math.random() < 0.65
  const config = BLIP_CONFIGS[Math.floor(Math.random() * BLIP_CONFIGS.length)]
  const label = hasLabel ? config.label : null

  return {
    r,
    angle,
    angularSpeed,
    radialSpeed,
    label,
    type: config.type,
    lastHitTime: visible ? now - rand(0, BLIP_FADE_MS * 0.8) : -Infinity,
    alpha: 0,
  }
}

// ── Komponente ───────────────────────────────────────────────────────────────

function RadarSweepPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const canvas: HTMLCanvasElement = _canvas

    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive = true

    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const blips: Blip[] = []
    for (let i = 0; i < INITIAL_BLIPS; i++) {
      blips.push(makeBlip(0, true))
    }

    function loop(t: number) {
      if (!alive) return
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }

      const cx = W / 2
      const cy = H / 2
      const R = Math.min(cx, cy) * 0.84

      const sweepFrac = (t % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS
      const sweepAngle = sweepFrac * Math.PI * 2

      // ── Hintergrund (Dunkles Navyblau-Cyber-Space) ─────────────────────────
      ctx.fillStyle = '#010612'
      ctx.fillRect(0, 0, W, H)

      // ── Sweep-Nachleuchten (Cyan-Blau-Verlauf) ─────────────────────────────
      {
        const canvasAngle = sweepAngle - Math.PI / 2
        const startAngle = canvasAngle - TRAIL_ARC
        const endAngle = canvasAngle

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.14)')
        grad.addColorStop(0.5, 'rgba(0, 110, 255, 0.07)')
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)')

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()
      }

      // ── Technische Gitterringe (Blueprint Cyan/Blau) ────────────────────────
      const ringCount = 4
      ctx.lineWidth = 0.5
      for (let i = 1; i <= ringCount; i++) {
        const rr = R * (i / ringCount)
        ctx.strokeStyle = `rgba(0, 160, 255, ${i === ringCount ? 0.35 : 0.15})`
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── Hauptachsen Fadenkreuz ─────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0, 160, 255, 0.12)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.stroke()

      // Diagonalen noch dezenter
      ctx.strokeStyle = 'rgba(0, 160, 255, 0.06)'
      ctx.beginPath()
      ctx.moveTo(cx - R * 0.707, cy - R * 0.707); ctx.lineTo(cx + R * 0.707, cy + R * 0.707)
      ctx.moveTo(cx + R * 0.707, cy - R * 0.707); ctx.lineTo(cx - R * 0.707, cy + R * 0.707)
      ctx.stroke()

      // ── Compass Dial & Grad-Ticks am Außenring ──────────────────────────────
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.35)'
      ctx.lineWidth = 0.8
      for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2
        const isMajor = i % 18 === 0 // Hauptachsen 0, 90, 180, 270
        const isMedium = i % 9 === 0 // 45 Grad
        
        const tickLen = isMajor ? 7 : (isMedium ? 5 : 3)
        const innerR = R - tickLen
        const outerR = R + 1
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        ctx.beginPath()
        ctx.moveTo(cx + cos * innerR, cy + sin * innerR)
        ctx.lineTo(cx + cos * outerR, cy + sin * outerR)
        ctx.stroke()

        if (isMajor) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.8)'
          ctx.font = 'bold 9px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labelDist = R - 14
          let label = ''
          if (i === 0) label = 'E'
          else if (i === 18) label = 'S'
          else if (i === 36) label = 'W'
          else if (i === 54) label = 'N'
          ctx.fillText(label, cx + cos * labelDist, cy + sin * labelDist)
        }
      }

      // ── Sweep-Laserlinie ────────────────────────────────────────────────────
      {
        const canvasAngle = sweepAngle - Math.PI / 2
        const ex = cx + Math.cos(canvasAngle) * R
        const ey = cy + Math.sin(canvasAngle) * R

        const lineGrad = ctx.createLinearGradient(cx, cy, ex, ey)
        lineGrad.addColorStop(0, 'rgba(0, 130, 255, 0.0)')
        lineGrad.addColorStop(0.3, 'rgba(0, 180, 255, 0.4)')
        lineGrad.addColorStop(0.8, 'rgba(0, 230, 255, 0.85)')
        lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)')

        ctx.strokeStyle = lineGrad
        ctx.lineWidth = 1.6
        ctx.shadowColor = '#00f0ff'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // ── Blips ──────────────────────────────────────────────────────────────
      while (blips.length < MAX_BLIPS) {
        blips.push(makeBlip(t, false))
      }

      const dt = 1000 / 60

      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i]

        b.angle += b.angularSpeed * dt
        b.r += b.radialSpeed * dt

        if (b.r < 0.05 || b.r > 0.96) {
          blips.splice(i, 1)
          blips.push(makeBlip(t, false))
          continue
        }

        const normalBlip = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const normalSweep = sweepAngle % (Math.PI * 2)
        const angDist = ((normalSweep - normalBlip) + Math.PI * 2) % (Math.PI * 2)

        if (angDist < 0.05) {
          b.lastHitTime = t
        }

        const msSinceHit = t - b.lastHitTime
        if (msSinceHit < 0) {
          b.alpha = 0
        } else if (msSinceHit < 50) {
          b.alpha = 1.0
        } else {
          b.alpha = Math.max(0, 1 - (msSinceHit - 50) / BLIP_FADE_MS)
        }

        if (b.alpha <= 0) continue

        const bCanvasAngle = b.angle - Math.PI / 2
        const bx = cx + Math.cos(bCanvasAngle) * b.r * R
        const by = cy + Math.sin(bCanvasAngle) * b.r * R

        // Farbkonfiguration basierend auf Blip-Klasse
        let blipColor = ''
        let glowColor = ''
        switch (b.type) {
          case 'hostile':
            blipColor = `rgba(255, 45, 85, ${b.alpha})` // Rotes Signal
            glowColor = '#ff2d55'
            break
          case 'friendly':
            blipColor = `rgba(0, 240, 255, ${b.alpha})` // Cyan Signal
            glowColor = '#00f0ff'
            break
          case 'echo':
          default:
            blipColor = `rgba(255, 160, 0, ${b.alpha})` // Amber Signal
            glowColor = '#ffa000'
            break
        }

        const blipRadius = 2.8
        ctx.shadowColor = glowColor
        ctx.shadowBlur = b.alpha > 0.5 ? 9 : 4

        // Kernpunkt des Blips zeichnen
        ctx.fillStyle = blipColor
        ctx.beginPath()
        ctx.arc(bx, by, blipRadius, 0, Math.PI * 2)
        ctx.fill()

        // Leuchtring für frische Hits
        if (b.alpha > 0.75) {
          const ringAlpha = (b.alpha - 0.75) / 0.25
          ctx.strokeStyle = b.type === 'hostile'
            ? `rgba(255, 45, 85, ${ringAlpha * 0.4})`
            : (b.type === 'friendly' ? `rgba(0, 240, 255, ${ringAlpha * 0.4})` : `rgba(255, 160, 0, ${ringAlpha * 0.4})`)
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.arc(bx, by, blipRadius + 4 * (1 - ringAlpha), 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.shadowBlur = 0

        // Label anzeigen
        if (b.label && b.alpha > 0.25) {
          const fontSize = Math.max(8, Math.min(10, W * 0.024))
          ctx.font = `${fontSize}px monospace`
          ctx.fillStyle = blipColor
          ctx.textBaseline = 'middle'

          const labelOffset = blipRadius + 6
          if (bx > cx) {
            ctx.textAlign = 'left'
            ctx.fillText(b.label, bx + labelOffset, by)
          } else {
            ctx.textAlign = 'right'
            ctx.fillText(b.label, bx - labelOffset, by)
          }
        }
      }

      // ── Status HUD am unteren Rand ──────────────────────────────────────────
      {
        const fontSize = Math.max(8, Math.min(10, W * 0.026))
        ctx.font = `${fontSize}px monospace`
        ctx.textBaseline = 'bottom'

        // Linke Seite
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(0, 210, 255, 0.75)'
        ctx.fillText('RADAR // MULTI-SPECTRAL SECTOR SCAN', 8, H - 4)

        // Rechte Seite
        ctx.textAlign = 'right'
        const rpmText = `RANGE: ${(R / Math.min(W, H) * 500).toFixed(0)}km  ROT: ${(60000 / SWEEP_PERIOD_MS).toFixed(1)}RPM`
        ctx.fillStyle = 'rgba(255, 140, 0, 0.7)' // Amber Akzent
        ctx.fillText(rpmText, W - 8, H - 4)

        // Bearing / Gradzahl oben rechts
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(0, 230, 255, 0.6)'
        const bearingDeg = Math.round((sweepAngle * 180 / Math.PI) % 360)
        ctx.fillText(`BEARING: ${bearingDeg.toString().padStart(3, '0')}°`, W - 8, 4)
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="RADAR // SECTOR SCAN">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(RadarSweepPanel)
