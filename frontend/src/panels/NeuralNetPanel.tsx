import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

interface Node {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
  subnet: number
  color: string
  label: string
  pulse: number
  shield: number
}

interface Packet {
  fromNode: number
  toNode: number
  progress: number
  speed: number
  type: 'attack' | 'defense' | 'data'
  color: string
}

const SUBNETS = [
  { name: 'SECURE_CORE', color: '#00f0ff' }, // Cyan
  { name: 'OUTER_PERIM', color: '#ffaa00' }, // Amber
  { name: 'INTRUSION', color: '#ff0055' }, // Neon Red
  { name: 'GATEWAY', color: '#b55eff' }, // Neon Purple
]

const MEMORY_ADDRESSES = [
  '0x7FFA1', '0x00E2C', '0x88F0B', '0x11A3E', '0xBB40F', '0xCC01A', '0x992D8', '0x44D01',
  '0xEA39F', '0xFD022', '0x002FB', '0x883E1', '0x55A1C', '0xC0B29', '0xAA911', '0x1F2C3'
]

function NeuralNetPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const packetsRef = useRef<Packet[]>([])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let unsubscribe: (() => void) | null = null
    let alive = true

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

    // Generate 56 nodes divided into 4 subnets
    const nodeCount = 56
    const nodes: Node[] = Array.from({ length: nodeCount }, (_, i) => {
      const subnet = i % 4
      const addr = MEMORY_ADDRESSES[i % MEMORY_ADDRESSES.length]
      const label = `${SUBNETS[subnet].name.substring(0, 4)}_${addr.substring(2)}`
      return {
        id: i,
        x: Math.random() * 400,
        y: Math.random() * 300,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        targetX: 0,
        targetY: 0,
        subnet,
        color: SUBNETS[subnet].color,
        label,
        pulse: Math.random() * Math.PI,
        shield: 0,
      }
    })

    // Setup initial targets inside bounds
    nodes.forEach(n => {
      n.targetX = Math.random() * 300 + 50
      n.targetY = Math.random() * 200 + 50
      n.x = n.targetX
      n.y = n.targetY
    })

    let lastPacketTime = 0

    function loop(t: number) {
      if (!alive) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Cycle topology every 9 seconds
      const topologies: ('mesh' | 'layered' | 'rings' | 'grid')[] = ['mesh', 'layered', 'rings', 'grid']
      const cycleIdx = Math.floor(t / 9000) % topologies.length
      const currentTopology = topologies[cycleIdx]

      // Update topology targets
      if (currentTopology === 'mesh') {
        nodes.forEach(n => {
          n.targetX += n.vx * 0.4
          n.targetY += n.vy * 0.4
          // Bounce off boundaries in mesh mode
          if (n.targetX < 20 || n.targetX > W - 20) n.vx *= -1
          if (n.targetY < 20 || n.targetY > H - 20) n.vy *= -1
        })
      } else if (currentTopology === 'layered') {
        const layers = 4
        nodes.forEach(n => {
          const layer = n.id % layers
          const nodesInLayer = nodes.filter(x => (x.id % layers) === layer)
          const idx = nodesInLayer.indexOf(n)
          n.targetX = W * 0.15 + (W * 0.7 * (layer / (layers - 1)))
          n.targetY = H * 0.15 + (H * 0.7 * (idx / (nodesInLayer.length - 1 || 1)))
        })
      } else if (currentTopology === 'rings') {
        nodes.forEach(n => {
          if (n.id === 0) {
            n.targetX = W / 2
            n.targetY = H / 2
          } else {
            let ring = 1
            let ringCount = 8
            let idx = n.id - 1
            if (idx >= 8 && idx < 24) {
              ring = 2
              ringCount = 16
              idx -= 8
            } else if (idx >= 24) {
              ring = 3
              ringCount = nodes.length - 25
              idx -= 24
            }
            const angle = (idx / ringCount) * Math.PI * 2 + (t * 0.00015 * (ring % 2 === 0 ? 1 : -1))
            const radius = Math.min(W, H) * 0.12 * ring
            n.targetX = W / 2 + Math.cos(angle) * radius
            n.targetY = H / 2 + Math.sin(angle) * radius
          }
        })
      } else if (currentTopology === 'grid') {
        const cols = 8
        const rows = 7
        nodes.forEach(n => {
          const col = n.id % cols
          const row = Math.floor(n.id / cols) % rows
          n.targetX = W * 0.15 + col * (W * 0.7 / (cols - 1))
          n.targetY = H * 0.15 + row * (H * 0.7 / (rows - 1))
        })
      }

      // Smoothly interpolate nodes to targets
      nodes.forEach(n => {
        const lerpFactor = currentTopology === 'mesh' ? 0.08 : 0.06
        n.x += (n.targetX - n.x) * lerpFactor
        n.y += (n.targetY - n.y) * lerpFactor
        n.pulse += 0.05
        if (n.shield > 0) n.shield -= 0.04
      })

      // Clear background
      ctx.fillStyle = '#020406'
      ctx.fillRect(0, 0, W, H)

      // Connection distance threshold
      let maxDist = 70
      if (currentTopology === 'layered') maxDist = 90
      else if (currentTopology === 'rings') maxDist = 75
      else if (currentTopology === 'grid') maxDist = 60

      // Collect connected nodes for spawning packets
      const connections: [number, number][] = []

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i]
          const n2 = nodes[j]
          const dx = n1.x - n2.x
          const dy = n1.y - n2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < maxDist) {
            connections.push([i, j])
            const alpha = (1 - dist / maxDist) * 0.28
            ctx.lineWidth = 1.0
            
            if (n1.subnet === n2.subnet) {
              ctx.strokeStyle = n1.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
            } else {
              ctx.strokeStyle = `rgba(100, 110, 120, ${alpha * 0.6})`
            }
            ctx.beginPath()
            ctx.moveTo(n1.x, n1.y)
            ctx.lineTo(n2.x, n2.y)
            ctx.stroke()
          }
        }
      }

      // Spawning Attack/Defense/Data packets
      if (t - lastPacketTime > 180 && connections.length > 0) {
        lastPacketTime = t
        const [i, j] = connections[Math.floor(Math.random() * connections.length)]
        const n1 = nodes[i]

        // 10% Attack, 10% Defense, 80% normal data packets
        const rng = Math.random()
        let type: 'attack' | 'defense' | 'data' = 'data'
        let color = n1.color

        if (rng < 0.12) {
          type = 'attack'
          color = '#ff0055' // intruder attack red
        } else if (rng < 0.24) {
          type = 'defense'
          color = '#00f0ff' // defensive core cyber cyan
        }

        packetsRef.current.push({
          fromNode: i,
          toNode: j,
          progress: 0,
          speed: 0.02 + Math.random() * 0.018,
          type,
          color,
        })
      }

      // Render packets
      const packets = packetsRef.current
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        p.progress += p.speed
        if (p.progress >= 1.0) {
          // Trigger impact on target node
          const target = nodes[p.toNode]
          if (target) {
            target.shield = 1.0
          }
          packets.splice(i, 1)
          continue
        }

        const nFrom = nodes[p.fromNode]
        const nTo = nodes[p.toNode]
        if (!nFrom || !nTo) {
          packets.splice(i, 1)
          continue
        }

        const px = nFrom.x + (nTo.x - nFrom.x) * p.progress
        const py = nFrom.y + (nTo.y - nFrom.y) * p.progress

        ctx.fillStyle = p.color
        const pSize = p.type === 'data' ? 3 : 4.5
        ctx.beginPath()
        ctx.arc(px, py, pSize, 0, Math.PI * 2)
        ctx.fill()

        // Tiny trail
        ctx.strokeStyle = p.color + '44'
        ctx.lineWidth = pSize - 1.5
        ctx.beginPath()
        ctx.moveTo(nFrom.x + (nTo.x - nFrom.x) * Math.max(0, p.progress - 0.12), nFrom.y + (nTo.y - nFrom.y) * Math.max(0, p.progress - 0.12))
        ctx.lineTo(px, py)
        ctx.stroke()
      }

      // Render nodes
      nodes.forEach(n => {
        const scanDist = Math.abs(n.x - (t * 0.06 % (W + 80) - 40))
        const isScanned = scanDist < 20
        const pulseVal = Math.sin(n.pulse)
        const size = 3.5 + pulseVal * 1.0 + (n.shield * 4.0)

        // Shield impact rings
        if (n.shield > 0) {
          ctx.strokeStyle = n.color + Math.round(n.shield * 255).toString(16).padStart(2, '0')
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(n.x, n.y, size * (1.5 + (1 - n.shield) * 2), 0, Math.PI * 2)
          ctx.stroke()
        }

        // Inner glowing core
        ctx.fillStyle = isScanned ? '#ffffff' : n.color
        ctx.beginPath()
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2)
        ctx.fill()

        // Outer scanning ring
        if (isScanned) {
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.arc(n.x, n.y, size * 2.2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Text labels (draw subset of labels dynamically to prevent clutter)
        if (pulseVal > 0.3) {
          ctx.font = '8px monospace'
          ctx.fillStyle = isScanned ? '#ffffff' : n.color + 'bb'
          ctx.fillText(n.label, n.x + size + 3, n.y + 3)
        }
      })

      // Vertical radar scan sweep line
      const sweepX = (t * 0.06) % (W + 80) - 40
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sweepX, 0)
      ctx.lineTo(sweepX, H)
      ctx.stroke()

      const grad = ctx.createLinearGradient(sweepX - 30, 0, sweepX, 0)
      grad.addColorStop(0, 'rgba(74, 222, 128, 0)')
      grad.addColorStop(1, 'rgba(74, 222, 128, 0.08)')
      ctx.fillStyle = grad
      ctx.fillRect(sweepX - 30, 0, 30, H)

      // HUD Ticker Overlay
      ctx.font = 'bold 9px monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.fillText(`NEURAL MAP // TOPO: ${currentTopology.toUpperCase()}`, 12, 18)
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.75)'
      ctx.fillText(`SUBNETS: COMP-CORE [CYN] | PERIM [AMB] | INTRUSION [RED] | GATE [PUR]`, 12, 30)
      ctx.fillText(`PACKETS_IN_TRANSIT: ${packetsRef.current.length} // COMPILING: ACTIVE`, 12, 42)
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
    <Panel title="NEURAL NETWORK // TOPO MATRIX">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(NeuralNetPanel);
