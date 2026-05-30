import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// ── Interactive Parallax: Neon Rain City ─────────────────────────────────────
// Layered scrolling with mouse-hover tilt offsets.
// No scene-cycling. Pure aesthetic focus.

interface RainDrop {
  x: number
  y: number
  vy: number
  vx: number
  length: number
  alpha: number
  terminalY: number
}

interface Splash {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
}

interface Building {
  xOff: number
  w: number
  h: number
  color: string
  windows: { x: number; y: number; color: string; speed: number }[]
  neonAd?: {
    text: string
    color: string
    textColor: string
    w: number
    h: number
    x: number
    y: number
    pulseSpeed: number
  }
}

function ParallaxPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    let alive = true
    let unsubscribe: (() => void) | null = null
    let firstFrame = true

    // ── Mouse State ──────────────────────────────────────────────────────────
    let targetMouseX = 0 // -1 to 1
    let targetMouseY = 0 // -1 to 1
    let mouseX = 0
    let mouseY = 0

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      targetMouseX = (e.clientX - cx) / (rect.width / 2)
      targetMouseY = (e.clientY - cy) / (rect.height / 2)
    }

    const onMouseLeave = () => {
      targetMouseX = 0
      targetMouseY = 0
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    // ── Resize Handler ───────────────────────────────────────────────────────
    const resize = () => {
      canvas.width = container.clientWidth || 640
      canvas.height = container.clientHeight || 400
      initRain()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Procedural Elements Generation ───────────────────────────────────────
    const STARS = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.65,
      r: 0.4 + Math.random() * 1.2,
      bright: 0.3 + Math.random() * 0.7,
      blinkSpeed: 1 + Math.random() * 3,
    }))

    // Layer 1 Buildings (Deep Background)
    const BUILDINGS_L1: Building[] = []
    let curX1 = 0
    for (let i = 0; i < 15; i++) {
      const w = 60 + Math.random() * 90
      const h = 180 + Math.random() * 140
      const color = '#0f172a' // slate-900 (deep blue-grey)
      const windows = []
      // Generate some windows
      const cols = Math.floor(w / 14)
      const rows = Math.floor(h / 18)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.45) {
            windows.push({
              x: 8 + c * 14,
              y: 10 + r * 18,
              color: Math.random() > 0.55 ? '#ec4899' : '#06b6d4', // neon pink or cyan
              speed: 0.5 + Math.random() * 1.5,
            })
          }
        }
      }
      BUILDINGS_L1.push({ xOff: curX1, w, h, color, windows })
      curX1 += w + 8 + Math.random() * 20
    }
    const L1_WIDTH = curX1

    // Layer 2 Buildings (Midground + Neon Ads)
    const AD_TEXTS = ['ネット', 'ハック', 'NEON', 'FRAKTAL', 'CORE', 'DATA']
    const AD_COLORS = ['#ec4899', '#06b6d4', '#eab308'] // pink, cyan, gold
    const BUILDINGS_L2: Building[] = []
    let curX2 = 0
    for (let i = 0; i < 12; i++) {
      const w = 80 + Math.random() * 110
      const h = 120 + Math.random() * 130
      const color = '#1e1b4b' // indigo-950 (deep purple-blue)
      const windows = []
      const cols = Math.floor(w / 18)
      const rows = Math.floor(h / 24)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.6) {
            windows.push({
              x: 10 + c * 18,
              y: 12 + r * 24,
              color: '#38bdf8', // light blue
              speed: 0.8 + Math.random() * 2.0,
            })
          }
        }
      }

      // Add a cool neon billboard ad on some buildings
      let neonAd
      if (Math.random() > 0.35) {
        const adW = 26 + Math.random() * 14
        const adH = 50 + Math.random() * 40
        const mainColor = AD_COLORS[Math.floor(Math.random() * AD_COLORS.length)]
        neonAd = {
          text: AD_TEXTS[Math.floor(Math.random() * AD_TEXTS.length)],
          color: mainColor,
          textColor: mainColor === '#eab308' ? '#1c1917' : '#ffffff',
          w: adW,
          h: adH,
          x: w / 2 - adW / 2,
          y: 15 + Math.random() * 25,
          pulseSpeed: 2 + Math.random() * 4,
        }
      }

      BUILDINGS_L2.push({ xOff: curX2, w, h, color, windows, neonAd })
      curX2 += w + 20 + Math.random() * 35
    }
    const L2_WIDTH = curX2

    // ── Rain Particle Engine ─────────────────────────────────────────────────
    let rainDrops: RainDrop[] = []
    let splashes: Splash[] = []
    const MAX_RAIN = 120

    function initRain() {
      rainDrops = []
      splashes = []
      const H = canvas.height
      const W = canvas.width
      if (W === 0 || H === 0) return

      for (let i = 0; i < MAX_RAIN; i++) {
        const rx = Math.random() * W
        const ry = Math.random() * H
        const vy = 550 + Math.random() * 250
        const vx = -30 - Math.random() * 40 // slanted rain
        const len = 12 + Math.random() * 15
        const terminalY = H * 0.45 + Math.random() * H * 0.52 // diverse collision heights

        rainDrops.push({
          x: rx,
          y: ry,
          vy,
          vx,
          length: len,
          alpha: 0.15 + Math.random() * 0.45,
          terminalY,
        })
      }
    }

    // ── Simulation variables ────────────────────────────────────────────────
    let scrollL0 = 0
    let scrollL1 = 0
    let scrollL2 = 0
    let scrollL3 = 0 // Foreground truss
    let lastT = 0

    // ── Draw CRT Scanlines ───────────────────────────────────────────────────
    function drawScanlines(W: number, H: number) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)'
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1)
      }
    }

    let isVisible = true

    // ── Main Render Loop ─────────────────────────────────────────────────────
    function loop(t: number) {
      if (!alive || !isVisible) return

      if (firstFrame) {
        lastT = t
        firstFrame = false
        initRain()
        return
      }

      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Smooth mouse coordinates interpolation
      mouseX = mouseX + (targetMouseX - mouseX) * 0.08
      mouseY = mouseY + (targetMouseY - mouseY) * 0.08

      // Update scroll offsets
      scrollL0 += 3 * dt // Sky stars
      scrollL1 += 12 * dt // L1 Buildings
      scrollL2 += 28 * dt // L2 Buildings
      scrollL3 += 85 * dt // Foreground Columns

      // ── Background Sky ─────────────────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
      bgGrad.addColorStop(0, '#02020a') // deep black-blue
      bgGrad.addColorStop(0.55, '#050518') // dark indigo
      bgGrad.addColorStop(1, '#0e0b24') // dark violet glow
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const s of STARS) {
        let sx = (s.x * W * 1.5 - scrollL0) % (W * 1.5)
        if (sx < 0) sx += W * 1.5
        const finalX = sx - W * 0.25 + mouseX * -6
        const finalY = s.y * H + mouseY * -4
        if (finalX >= 0 && finalX < W) {
          const blink = s.bright * (0.7 + 0.3 * Math.sin(t * 0.001 * s.blinkSpeed))
          ctx.fillStyle = `rgba(236, 72, 153, ${blink.toFixed(2)})` // subtle pink twinkle
          ctx.beginPath()
          ctx.arc(finalX, finalY, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Layer 1: Deep Buildings (Cyan/Pink Highlights) ─────────────────────
      ctx.save()
      const l1Offset = (scrollL1 - mouseX * -12) % L1_WIDTH
      for (let tile = -1; tile <= 1; tile++) {
        const startX = tile * L1_WIDTH - l1Offset
        for (const b of BUILDINGS_L1) {
          const bx = startX + b.xOff
          const by = H - b.h + mouseY * -8
          if (bx + b.w < -10 || bx > W + 10) continue

          ctx.fillStyle = b.color
          ctx.fillRect(bx, by, b.w, b.h)

          // Soft outline glow for distance shading
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)' // cyan tint
          ctx.lineWidth = 1
          ctx.strokeRect(bx, by, b.w, b.h)

          // Windows
          for (const win of b.windows) {
            const wx = bx + win.x
            const wy = by + win.y
            if (wy > H) continue
            const pulse = 0.4 + 0.6 * Math.sin(t * 0.001 * win.speed)
            ctx.fillStyle = win.color === '#ec4899'
              ? `rgba(236, 72, 153, ${pulse.toFixed(2)})`
              : `rgba(6, 182, 212, ${pulse.toFixed(2)})`
            ctx.fillRect(wx, wy, 4, 3)
          }
        }
      }
      ctx.restore()

      // ── Layer 2: Midground Buildings & Neon Ads ────────────────────────────
      ctx.save()
      const l2Offset = (scrollL2 - mouseX * 5) % L2_WIDTH
      for (let tile = -1; tile <= 1; tile++) {
        const startX = tile * L2_WIDTH - l2Offset
        for (const b of BUILDINGS_L2) {
          const bx = startX + b.xOff
          const by = H - b.h + mouseY * 6
          if (bx + b.w < -10 || bx > W + 10) continue

          ctx.fillStyle = b.color
          ctx.fillRect(bx, by, b.w, b.h)

          ctx.strokeStyle = 'rgba(236, 72, 153, 0.07)' // pink tint
          ctx.lineWidth = 1.2
          ctx.strokeRect(bx, by, b.w, b.h)

          // Windows
          for (const win of b.windows) {
            const wx = bx + win.x
            const wy = by + win.y
            if (wy > H) continue
            const pulse = 0.55 + 0.45 * Math.sin(t * 0.001 * win.speed)
            ctx.fillStyle = `rgba(56, 189, 248, ${pulse.toFixed(2)})`
            ctx.fillRect(wx, wy, 5, 4)
          }

          // Blinking vertical ads
          if (b.neonAd) {
            const ad = b.neonAd
            const ax = bx + ad.x
            const ay = by + ad.y
            const pulse = 0.6 + 0.4 * Math.sin(t * 0.0015 * ad.pulseSpeed)

            // Neon glowing background border
            ctx.shadowBlur = 8 * pulse
            ctx.shadowColor = ad.color
            ctx.fillStyle = `rgba(15, 23, 42, 0.85)`
            ctx.fillRect(ax, ay, ad.w, ad.h)
            ctx.strokeStyle = ad.color
            ctx.lineWidth = 2
            ctx.strokeRect(ax, ay, ad.w, ad.h)

            // Vertical neon characters/text
            ctx.fillStyle = ad.textColor
            ctx.shadowBlur = 10 * pulse
            ctx.shadowColor = ad.color
            ctx.font = 'bold 9px monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'

            const chars = ad.text.split('')
            const stepY = ad.h / (chars.length + 1)
            for (let ci = 0; ci < chars.length; ci++) {
              ctx.fillText(chars[ci], ax + ad.w / 2, ay + stepY * (ci + 0.7))
            }
            ctx.shadowBlur = 0 // reset shadow
          }
        }
      }
      ctx.restore()

      // ── Layer 3: Rain and Rain Splashes ────────────────────────────────────
      ctx.save()
      ctx.lineWidth = 1.2
      for (const d of rainDrops) {
        // Adjust coordinate by mouse tilt
        const rx = d.x + mouseX * 12
        const ry = d.y + mouseY * 10

        // Draw raindrop slant lines
        ctx.strokeStyle = `rgba(103, 232, 249, ${d.alpha.toFixed(2)})` // light cyan
        ctx.beginPath()
        ctx.moveTo(rx, ry)
        ctx.lineTo(rx + d.vx * 0.02, ry + d.vy * 0.02)
        ctx.stroke()

        // Move rain
        d.y += d.vy * dt
        d.x += d.vx * dt

        // Collision Check
        if (d.y >= d.terminalY) {
          // Spawn splash
          if (splashes.length < 80) {
            splashes.push({
              x: d.x + d.vx * 0.01,
              y: d.terminalY,
              r: 1,
              maxR: 3 + Math.random() * 5,
              alpha: d.alpha * 0.8,
            })
          }
          // Reset drop
          d.y = -d.length - 10
          d.x = Math.random() * W
        }
      }

      // Update and draw splashes
      ctx.lineWidth = 0.8
      splashes = splashes.filter((sp) => {
        sp.r += 24 * dt
        sp.alpha -= 3.5 * dt
        if (sp.alpha <= 0.02 || sp.r >= sp.maxR) return false

        // Splash ring
        ctx.strokeStyle = `rgba(165, 243, 252, ${sp.alpha.toFixed(2)})`
        ctx.beginPath()
        // Draw an ellipse to simulate ground perspective angle
        ctx.ellipse(sp.x + mouseX * 12, sp.y + mouseY * 10, sp.r, sp.r * 0.35, 0, 0, Math.PI * 2)
        ctx.stroke()
        return true
      })
      ctx.restore()

      // ── Layer 4: Foreground Pillars (Fast moving struts) ──────────────────
      ctx.save()
      const l3Offset = (scrollL3 - mouseX * 24) % (W * 1.5)
      const trussX1 = W * 0.2 - l3Offset
      const trussX2 = trussX1 + W * 0.85
      const trussY = mouseY * 18

      ctx.fillStyle = '#020205' // pitch black
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2

      const drawTrussColumn = (tx: number) => {
        if (tx < -80 || tx > W + 80) return
        // Column base rectangle
        ctx.fillRect(tx, -40 + trussY, 36, H + 80)
        ctx.strokeRect(tx, -40 + trussY, 36, H + 80)

        // Internal cross diagonal structural lines
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.05)' // pink structural lines
        ctx.beginPath()
        for (let y = 0; y < H; y += 80) {
          ctx.moveTo(tx, y + trussY)
          ctx.lineTo(tx + 36, y + 60 + trussY)
          ctx.moveTo(tx + 36, y + trussY)
          ctx.lineTo(tx, y + 60 + trussY)
        }
        ctx.stroke()
      }

      drawTrussColumn(trussX1)
      drawTrussColumn(trussX2)
      ctx.restore()

      // ── Scanlines and labels ────────────────────────────────────────────────
      drawScanlines(W, H)

      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(236, 72, 153, 0.55)'
      ctx.textBaseline = 'top'
      ctx.fillText('NEON RAIN // PARALLAX RENDER ENGINE', 8, 8)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)'
      ctx.fillText(`SPEED: 120 FPS // STYLING: HIGH-RES LAYERED`, 8, 18)
    }

    // Register to coordinator loop and track visibility
    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) {
          if (!unsubscribe && alive) {
            unsubscribe = subscribe(loop)
          }
        } else {
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
        }
      },
      { threshold: 0.1 }
    )
    io.observe(canvas)

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="PARALLAX // NEON RAIN CITY 3D">
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'crosshair' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}

export default memo(ParallaxPanel)
