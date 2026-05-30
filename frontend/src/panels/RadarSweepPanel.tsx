import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

const MAX_BLIPS = 10
const INITIAL_BLIPS = 7
const BLIP_FADE_MS = 4500

const BLIP_CONFIGS = [
  { label: 'HOSTILE C-1', type: 'hostile' as const },
  { label: 'HOSTILE C-2', type: 'hostile' as const },
  { label: 'HOSTILE RAIDER', type: 'hostile' as const },
  { label: 'FRIENDLY VIPER-1', type: 'friendly' as const },
  { label: 'FRIENDLY VIPER-2', type: 'friendly' as const },
  { label: 'FRIENDLY SHUTTLE', type: 'friendly' as const },
  { label: 'UNKNOWN UNK-8', type: 'echo' as const },
]

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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function makeBlip(now: number, visible: boolean): Blip {
  const r = rand(0.18, 0.88)
  const angle = rand(0, Math.PI * 2)

  const moving = Math.random() < 0.5
  // Slow angular drift
  const angularSpeed = moving ? rand(0.00002, 0.00006) * (Math.random() < 0.5 ? 1 : -1) : 0
  // Slow radial drift
  const radialSpeed = moving ? rand(-0.00001, 0.00001) : 0

  const config = BLIP_CONFIGS[Math.floor(Math.random() * BLIP_CONFIGS.length)]

  return {
    r,
    angle,
    angularSpeed,
    radialSpeed,
    label: config.label,
    type: config.type,
    lastHitTime: visible ? now - rand(0, BLIP_FADE_MS * 0.8) : -Infinity,
    alpha: 0,
  }
}

function RadarSweepPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const canvas: HTMLCanvasElement = _canvas

    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D = _ctx

    let unsubscribe: (() => void) | null = null
    let alive = true

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!unsubscribe && alive) unsubscribe = subscribe(loop)
        } else {
          if (unsubscribe) { unsubscribe(); unsubscribe = null }
        }
      },
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

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      const cx = W / 2
      const cy = H / 2
      const R = Math.min(cx, cy) * 0.85

      // Top-to-bottom sweep line y-coordinate
      const sweepY = (t * 0.08) % H

      // ── Background (DRADIS Slate Blue-Black) ─────────────────────────
      ctx.fillStyle = '#01050f'
      ctx.fillRect(0, 0, W, H)

      // ── DRADIS Grid Rings (Desaturated Dark Cyan/Blue) ────────────────
      ctx.strokeStyle = 'rgba(30, 75, 120, 0.16)'
      ctx.lineWidth = 0.5
      const ringCount = 5
      for (let i = 1; i <= ringCount; i++) {
        const rr = R * (i / ringCount)
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── Radial grid spokes ───────────────────────────────────────────
      ctx.strokeStyle = 'rgba(30, 75, 120, 0.08)'
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R)
        ctx.stroke()
      }

      // Outer dial bounding circle
      ctx.strokeStyle = 'rgba(30, 80, 140, 0.35)'
      ctx.lineWidth = 1.0
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      // Ticks around the dial
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2
        const isMajor = i % 9 === 0
        const len = isMajor ? 6 : 3
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * (R - len), cy + Math.sin(angle) * (R - len))
        ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R)
        ctx.stroke()
      }

      // ── Top-down horizontal scanline sweep ────────────────────────────
      {
        const sweepGrad = ctx.createLinearGradient(0, sweepY - 18, 0, sweepY)
        sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0.0)')
        sweepGrad.addColorStop(0.7, 'rgba(0, 200, 255, 0.16)')
        sweepGrad.addColorStop(1.0, 'rgba(0, 240, 255, 0.45)')

        ctx.fillStyle = sweepGrad
        ctx.fillRect(0, sweepY - 18, W, 18)

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.moveTo(0, sweepY)
        ctx.lineTo(W, sweepY)
        ctx.stroke()
      }

      // ── Blips ────────────────────────────────────────────────────────
      while (blips.length < MAX_BLIPS) {
        blips.push(makeBlip(t, false))
      }

      const dt = 0.016

      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i]

        b.angle += b.angularSpeed * dt * 60
        b.r += b.radialSpeed * dt * 60

        // Boundary recycle
        if (b.r < 0.05 || b.r > 0.95) {
          blips.splice(i, 1)
          blips.push(makeBlip(t, false))
          continue
        }

        const bCanvasAngle = b.angle - Math.PI / 2
        const bx = cx + Math.cos(bCanvasAngle) * b.r * R
        const by = cy + Math.sin(bCanvasAngle) * b.r * R

        // Check if horizontal sweep line passes target y coordinate
        if (Math.abs(by - sweepY) < 14) {
          b.lastHitTime = t
        }

        const msSinceHit = t - b.lastHitTime
        if (msSinceHit < 0) {
          b.alpha = 0
        } else if (msSinceHit < 80) {
          b.alpha = 1.0
        } else {
          b.alpha = Math.max(0, 1.0 - (msSinceHit - 80) / BLIP_FADE_MS)
        }

        if (b.alpha <= 0) continue

        // Color configuration: Green for friendly, Red for hostile, Amber for unknown
        let blipColor = ''
        let glowColor = ''
        switch (b.type) {
          case 'friendly':
            blipColor = `rgba(34, 211, 238, ${b.alpha})` // Cyan-Green Viper
            glowColor = '#22d3ee'
            break
          case 'hostile':
            blipColor = `rgba(244, 63, 94, ${b.alpha})` // Red Raider
            glowColor = '#f43f5e'
            break
          case 'echo':
          default:
            blipColor = `rgba(245, 158, 11, ${b.alpha})` // Amber echo
            glowColor = '#f59e0b'
            break
        }

        // Draw velocity vector trailing line
        if (b.angularSpeed !== 0 || b.radialSpeed !== 0) {
          const vx = Math.cos(bCanvasAngle) * b.radialSpeed * R - Math.sin(bCanvasAngle) * b.r * R * b.angularSpeed
          const vy = Math.sin(bCanvasAngle) * b.radialSpeed * R + Math.cos(bCanvasAngle) * b.r * R * b.angularSpeed
          
          ctx.save()
          ctx.strokeStyle = `rgba(${b.type === 'hostile' ? '244,63,94' : (b.type === 'friendly' ? '34,211,238' : '245,158,11')}, ${b.alpha * 0.32})`
          ctx.lineWidth = 1.2
          ctx.setLineDash([3, 2])
          ctx.beginPath()
          ctx.moveTo(bx, by)
          ctx.lineTo(bx - vx * 180, by - vy * 180) // Direction opposite velocity
          ctx.stroke()
          ctx.restore()
        }

        // Draw target glyph
        ctx.save()
        ctx.translate(bx, by)
        ctx.strokeStyle = blipColor
        ctx.fillStyle = blipColor
        ctx.lineWidth = 1.4
        ctx.shadowColor = glowColor
        ctx.shadowBlur = b.alpha > 0.5 ? 8 : 3

        if (b.type === 'friendly') {
          // Viper: green triangle pointing along path
          ctx.save()
          ctx.rotate(b.angle)
          ctx.beginPath()
          ctx.moveTo(0, -5)
          ctx.lineTo(4, 4)
          ctx.lineTo(-4, 4)
          ctx.closePath()
          ctx.stroke()
          ctx.restore()
          
          ctx.beginPath()
          ctx.arc(0, 0, 1.2, 0, Math.PI * 2)
          ctx.fill()
        } else if (b.type === 'hostile') {
          // Raider: red outline diamond
          ctx.beginPath()
          ctx.moveTo(0, -5)
          ctx.lineTo(5, 0)
          ctx.lineTo(0, 5)
          ctx.lineTo(-5, 0)
          ctx.closePath()
          ctx.stroke()
          
          ctx.beginPath()
          ctx.arc(0, 0, 1.2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Unknown: amber circle
          ctx.beginPath()
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()

        // Text tag label
        if (b.label && b.alpha > 0.3) {
          ctx.fillStyle = blipColor
          ctx.font = '8px monospace'
          ctx.textBaseline = 'middle'
          const offset = 8
          if (bx > cx) {
            ctx.textAlign = 'left'
            ctx.fillText(b.label, bx + offset, by)
          } else {
            ctx.textAlign = 'right'
            ctx.fillText(b.label, bx - offset, by)
          }
        }
      }

      // Draw faint CRT scanlines across the canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      for (let y = 0; y < H; y += 2) {
        ctx.fillRect(0, y, W, 1)
      }

      // ── HUD Text Overlays ─────────────────────────────────────────────
      const fontSize = Math.max(8, Math.min(10, W * 0.025))
      ctx.font = `${fontSize}px monospace`
      ctx.textBaseline = 'bottom'

      // Left
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0, 240, 255, 0.72)'
      ctx.fillText('DRADIS // COHESION SCANNER ACTIVE', 10, H - 6)

      // Right
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(245, 158, 11, 0.72)'
      const activeVipers = blips.filter(b => b.type === 'friendly' && b.alpha > 0.1).length
      const activeRaiders = blips.filter(b => b.type === 'hostile' && b.alpha > 0.1).length
      ctx.fillText(`VIPERS: ${activeVipers}  RAIDERS: ${activeRaiders}  SYS: GALACTICA CIC`, W - 10, H - 6)

      // Range indicator top right
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(0, 200, 255, 0.45)'
      ctx.fillText('RANGE: 250,000 KM', W - 10, 8)
    }

    unsubscribe = subscribe(loop)

    return () => {
      alive = false
      if (unsubscribe) { unsubscribe(); unsubscribe = null }
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="DRADIS // TACTICAL PLANAR SCAN">
      <div className="w-full h-full relative overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}

export default memo(RadarSweepPanel)
