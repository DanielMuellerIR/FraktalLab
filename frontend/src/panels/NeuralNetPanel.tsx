import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
// Zentraler rAF-Coordinator: bündelt alle Panel-Animationen in einer einzigen
// requestAnimationFrame-Schleife. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  label: string
  pulse: number
}

const MEMORY_ADDRESSES = [
  '0x7FFA1', '0x00E2C', '0x88F0B', '0x11A3E', '0xBB40F', '0xCC01A', '0x992D8', '0x44D01',
  '0xEA39F', '0xFD022', '0x002FB', '0x883E1', '0x55A1C', '0xC0B29', '0xAA911', '0x1F2C3'
]

function NeuralNetPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    // Unsubscribe-Handle vom zentralen raf-coordinator; null = nicht abonniert.
    let unsubscribe: (() => void) | null = null
    let alive = true

    // IntersectionObserver: bei Unsichtbarkeit komplett vom rAF-Coordinator abmelden,
    // statt nur Frames ohne Zeichnen zu verbrauchen.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!unsubscribe && alive) unsubscribe = subscribe(loop)
      } else {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
      }
    })
    io.observe(canvas)

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Generate nodes
    const nodes: Node[] = Array.from({ length: 32 }, (_, i) => ({
      x: Math.random() * 400,
      y: Math.random() * 300,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      label: MEMORY_ADDRESSES[i % MEMORY_ADDRESSES.length],
      pulse: Math.random() * Math.PI
    }))

    function loop(t: number) {
      if (!alive) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Clear background
      ctx.fillStyle = '#010502'
      ctx.fillRect(0, 0, W, H)

      // Vertical radar scan sweep line
      const sweepX = (t * 0.08) % (W + 60) - 30

      // Draw connection lines
      ctx.lineWidth = 1.0
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 75) {
            const alpha = (1 - dist / 75) * 0.35
            ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      nodes.forEach((n) => {
        // Move nodes
        n.x += n.vx
        n.y += n.vy

        // Wrap around boundaries
        if (n.x < 0) n.x = W
        if (n.x > W) n.x = 0
        if (n.y < 0) n.y = H
        if (n.y > H) n.y = 0

        n.pulse += 0.04

        // Check if scan line crosses node
        const isCrossed = Math.abs(n.x - sweepX) < 15
        const nodeSize = isCrossed ? 5 : 2.5
        const alpha = isCrossed ? 0.9 : 0.55

        // Node glow
        ctx.fillStyle = isCrossed ? '#00ff66' : 'rgba(74, 222, 128, 0.7)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, nodeSize, 0, Math.PI * 2)
        ctx.fill()

        if (isCrossed) {
          ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
          ctx.beginPath()
          ctx.arc(n.x, n.y, nodeSize * 2.8, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Draw address labels next to some nodes
        if (Math.sin(n.pulse) > 0.4) {
          ctx.font = '8px monospace'
          ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.6})`
          ctx.fillText(n.label, n.x + 6, n.y + 3)
        }
      })

      // Draw vertical sweep line
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sweepX, 0)
      ctx.lineTo(sweepX, H)
      ctx.stroke()

      // Concentric sweep glow
      const grad = ctx.createLinearGradient(sweepX - 25, 0, sweepX, 0)
      grad.addColorStop(0, 'rgba(74, 222, 128, 0)')
      grad.addColorStop(1, 'rgba(74, 222, 128, 0.06)')
      ctx.fillStyle = grad
      ctx.fillRect(sweepX - 25, 0, 25, H)

      // HUD Status Ticker
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.8)'
      ctx.fillText(`NEURAL MAP // SECTOR COMPILER`, 10, 18)
      ctx.fillText(`ACTIVE_NODES: ${nodes.length} // COMPILING_STREAM: OK`, 10, 30)
    }

    // Beim zentralen rAF-Coordinator abonnieren — loop wird bei jedem Tick automatisch aufgerufen.
    unsubscribe = subscribe(loop)
    return () => {
      alive = false
      if (unsubscribe) { unsubscribe(); unsubscribe = null }
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="NEURAL NETWORK // SECTOR COMPILER">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(NeuralNetPanel);
