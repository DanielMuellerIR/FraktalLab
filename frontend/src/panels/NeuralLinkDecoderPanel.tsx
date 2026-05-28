import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

interface Node {
  x: number
  y: number
  radius: number
  pulsePhase: number
  label: string
}

interface Connection {
  from: number
  to: number
  activeSignals: { progress: number; speed: number }[]
}

interface DecryptRow {
  address: string
  rawData: string
  resolved: string
  status: 'DECRYPTING' | 'SECURED'
  timer: number
}

const WORDS = ['COGNITIVE', 'SYNAPSE', 'CORTEX', 'NEURAL_LINK', 'MEM_MATRIX', 'MYELIN_NET', 'BIOLINK', 'AXON_BRIDGE']

function NeuralLinkDecoderPanel() {
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

    let active = true
    let isVisible = true
    let unsubscribe: (() => void) | null = null

    // ── Resize Observer ──────────────────────────────────────────────────────
    const resize = () => {
      if (!canvas) return
      // Cap the internal rendering size slightly for vector drawing performance
      const maxW = 500
      const cw = container.clientWidth || 300
      const ch = container.clientHeight || 200
      const scale = cw > maxW ? maxW / cw : 1

      canvas.width = Math.round(cw * scale)
      canvas.height = Math.round(ch * scale)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Simulation States ────────────────────────────────────────────────────
    const nodes: Node[] = [
      { x: 0.25, y: 0.25, radius: 4, pulsePhase: 0.0, label: 'N-CORTEX' },
      { x: 0.50, y: 0.15, radius: 5, pulsePhase: 1.5, label: 'S-DECODER' },
      { x: 0.75, y: 0.20, radius: 4, pulsePhase: 3.0, label: 'E-LOBE' },
      { x: 0.35, y: 0.50, radius: 6, pulsePhase: 0.8, label: 'THALAMUS' },
      { x: 0.65, y: 0.45, radius: 5, pulsePhase: 2.1, label: 'HIPPOCAMP' },
      { x: 0.20, y: 0.75, radius: 4, pulsePhase: 4.2, label: 'AMYGDALA' },
      { x: 0.50, y: 0.80, radius: 7, pulsePhase: 1.1, label: 'MYELIN_R' },
      { x: 0.80, y: 0.70, radius: 4, pulsePhase: 2.9, label: 'C-BRIDGE' },
    ]

    const connections: Connection[] = [
      { from: 0, to: 1, activeSignals: [] },
      { from: 1, to: 2, activeSignals: [] },
      { from: 0, to: 3, activeSignals: [] },
      { from: 1, to: 4, activeSignals: [] },
      { from: 2, to: 7, activeSignals: [] },
      { from: 3, to: 4, activeSignals: [] },
      { from: 3, to: 5, activeSignals: [] },
      { from: 4, to: 6, activeSignals: [] },
      { from: 5, to: 6, activeSignals: [] },
      { from: 6, to: 7, activeSignals: [] },
      { from: 4, to: 7, activeSignals: [] },
    ]

    // Decryption table states
    const decryptRows: DecryptRow[] = Array.from({ length: 6 }, (_, idx) => {
      const addr = `0x${(0x4F20 + idx * 0x2A).toString(16).toUpperCase()}`
      return {
        address: addr,
        rawData: generateHex(8),
        resolved: '----------',
        status: 'DECRYPTING',
        timer: 1.0 + Math.random() * 3.0,
      }
    })

    function generateHex(len: number): string {
      let res = ''
      const hexChars = '0123456789ABCDEF'
      for (let i = 0; i < len; i++) {
        res += hexChars[Math.floor(Math.random() * 16)]
      }
      return res
    }

    let lastSimT = 0
    let packetTimer = 0
    let lastLogUpdate = 0

    // ── Main Draw & Update ───────────────────────────────────────────────────
    function loop(t: number) {
      if (!active || !isVisible) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      if (lastSimT === 0) lastSimT = t
      const dt = Math.min((t - lastSimT) / 1000, 0.08)
      lastSimT = t

      // Background
      ctx.fillStyle = '#010502'
      ctx.fillRect(0, 0, W, H)

      // ── Left: Decryption Decoders ──────────────────────────────────────────
      const sidebarW = Math.max(120, W * 0.36)
      ctx.strokeStyle = '#051808'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(sidebarW, 0)
      ctx.lineTo(sidebarW, H)
      ctx.stroke()

      const rowH = Math.min(22, H / 8)
      const fSize = Math.max(7, Math.min(9, H * 0.026))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      // Title sidebar
      ctx.fillStyle = 'rgba(74, 222, 128, 0.5)'
      ctx.fillText('NEURAL LINK STATUS', 8, 6)

      decryptRows.forEach((row, i) => {
        const ry = 22 + i * rowH

        // Update timers and status
        row.timer -= dt
        if (row.timer <= 0) {
          if (row.status === 'DECRYPTING') {
            row.status = 'SECURED'
            row.resolved = WORDS[Math.floor(Math.random() * WORDS.length)]
            row.timer = 4.0 + Math.random() * 5.0
          } else {
            row.status = 'DECRYPTING'
            row.resolved = '----------'
            row.timer = 2.0 + Math.random() * 4.0
          }
        }

        // Randomize rawData representing streaming decrypting data
        if (row.status === 'DECRYPTING' && t - lastLogUpdate > 100) {
          row.rawData = generateHex(8)
        }

        ctx.fillStyle = 'rgba(74, 222, 128, 0.35)'
        ctx.fillText(row.address, 8, ry)

        if (row.status === 'DECRYPTING') {
          ctx.fillStyle = '#ef4444' // red raw bits
          ctx.fillText(row.rawData, 8 + fSize * 6, ry)
        } else {
          ctx.fillStyle = '#22c55e' // green resolved key
          ctx.fillText(row.resolved, 8 + fSize * 6, ry)
        }
      })
      if (t - lastLogUpdate > 100) {
        lastLogUpdate = t
      }

      // ── Right: Synaptic Connection Graph ───────────────────────────────────
      const graphW = W - sidebarW
      const graphH = H
      const gX = (x: number) => sidebarW + x * graphW
      const gY = (y: number) => y * graphH

      // Spawn signal packets periodically
      packetTimer -= dt
      if (packetTimer <= 0) {
        const randomConn = connections[Math.floor(Math.random() * connections.length)]
        randomConn.activeSignals.push({ progress: 0.0, speed: 0.45 + Math.random() * 0.4 })
        packetTimer = 0.5 + Math.random() * 0.8
      }

      // Draw Connection lines
      ctx.lineWidth = 0.8
      connections.forEach((conn) => {
        const fromNode = nodes[conn.from]
        const toNode = nodes[conn.to]
        const fx = gX(fromNode.x)
        const fy = gY(fromNode.y)
        const tx = gX(toNode.x)
        const ty = gY(toNode.y)

        // Dim green connection path
        ctx.strokeStyle = 'rgba(20, 83, 45, 0.5)'
        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(tx, ty)
        ctx.stroke()

        // Update and draw packets
        conn.activeSignals = conn.activeSignals.filter((sig) => {
          sig.progress += sig.speed * dt
          if (sig.progress >= 1.0) {
            // Signal arrived: trigger ripple pulse on destination node
            toNode.pulsePhase = 1.0
            return false
          }

          // Compute packet coord
          const px = fx + (tx - fx) * sig.progress
          const py = fy + (ty - fy) * sig.progress

          // Draw travelling dot
          ctx.fillStyle = '#4ade80'
          ctx.beginPath()
          ctx.arc(px, py, 2, 0, Math.PI * 2)
          ctx.fill()

          return true
        })
      })

      // Draw Nodes
      nodes.forEach((node) => {
        const nx = gX(node.x)
        const ny = gY(node.y)

        // Draw outer ripple pulse
        if (node.pulsePhase > 0) {
          node.pulsePhase = Math.max(0, node.pulsePhase - dt * 2.0)
          const rippleRadius = Math.max(0.1, node.radius + (1.0 - Math.min(1.0, node.pulsePhase)) * 16.0)
          ctx.strokeStyle = `rgba(74, 222, 128, ${Math.min(1.0, node.pulsePhase)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(nx, ny, rippleRadius, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Draw solid node center
        ctx.fillStyle = '#22c55e'
        ctx.beginPath()
        ctx.arc(nx, ny, node.radius, 0, Math.PI * 2)
        ctx.fill()

        // Tiny inner core
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(nx, ny, node.radius * 0.4, 0, Math.PI * 2)
        ctx.fill()

        // Node label
        ctx.fillStyle = 'rgba(74, 222, 128, 0.45)'
        const labelSize = Math.max(5, Math.min(7, H * 0.02))
        ctx.font = `${labelSize}px monospace`
        ctx.fillText(node.label, nx + node.radius + 3, ny - labelSize / 2)
      })

      // ── Hacking Progress Bar at bottom of graph ────────────────────────────
      const barH = Math.max(8, H * 0.06)
      const barY = H - barH - 8
      const barW = graphW * 0.8
      const barX = sidebarW + (graphW - barW) / 2

      ctx.fillStyle = '#051808'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.strokeStyle = '#166534'
      ctx.strokeRect(barX, barY, barW, barH)

      const hackingProgress = (t * 0.00004) % 1.0
      ctx.fillStyle = 'rgba(34, 197, 94, 0.7)'
      ctx.fillRect(barX + 2, barY + 2, (barW - 4) * hackingProgress, barH - 4)

      ctx.fillStyle = '#ffffff'
      const labelFSize = Math.max(6, Math.min(8, H * 0.024))
      ctx.font = `${labelFSize}px monospace`
      ctx.textBaseline = 'middle'
      ctx.fillText(
        `LINK SYNCHRONIZATION: ${(hackingProgress * 100).toFixed(1)}%`,
        barX + 6,
        barY + barH / 2
      )
    }

    // ── Intersection Observer ────────────────────────────────────────────────
    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) {
          if (!unsubscribe && active) {
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

    // Initial activation
    if (isVisible && !unsubscribe && active) {
      unsubscribe = subscribe(loop)
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      active = false
      if (unsubscribe) {
        unsubscribe()
      }
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="NEURAL LINK // CORTICAL DECODER">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </Panel>
  )
}

export default memo(NeuralLinkDecoderPanel)
