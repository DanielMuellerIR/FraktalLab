import { useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'


const LOG_TEMPLATES = [
  'INCOMING [IP] via [PORT] -> Blocked (100% sus)',
  'OUTGOING LOCAL -> [DEST] encrypted via VPN (Dark Matter)',
  'TUNNEL SOL -> [SECTOR] stabilized at [SPEED] YB/s',
  'DEFLECTED: Tachyonic DDOS from [BOTNET] ([COUNT] attacks/s)',
  'DECRYPTED: Alien handshake packet ([STATUS])',
  'RESOLVED: Hostname [IP].warp.net in -1.2ms',
  'WARN: Wormhole buffer overflow in quadrant [QUAD]',
  'INFO: Spatial routing override active (vibes-only mode)',
]

function randomIP() {
  return `${Math.floor(100 + Math.random() * 150)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

function randomDest() {
  const dests = ['NSA_RELAY', 'DARKWEB_PROXY', 'KRONOS_V', 'CYBER_CORE_9', 'NEURAL_LINK']
  return dests[Math.floor(Math.random() * dests.length)]
}

function generateInitialLogs() {
  const list: string[] = []
  for (let i = 0; i < 8; i++) {
    list.push(generateRandomLog())
  }
  return list
}

function generateRandomLog() {
  const template = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
  return template
    .replace('[IP]', randomIP())
    .replace('[PORT]', String(Math.floor(1000 + Math.random() * 9000)))
    .replace('[DEST]', randomDest())
    .replace('[SECTOR]', `Sector ${Math.floor(1 + Math.random() * 9)}`)
    .replace('[SPEED]', (5.0 + Math.random() * 4.0).toFixed(2))
    .replace('[BOTNET]', `NEO-NET-${Math.floor(10 + Math.random() * 89)}`)
    .replace('[COUNT]', (1.2 + Math.random() * 0.6).toFixed(1) + 'B')
    .replace('[STATUS]', Math.random() > 0.5 ? 'DECRYPTED' : 'MALFORMED')
    .replace('[QUAD]', String(Math.floor(1 + Math.random() * 12)))
}

export default function TrafficMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState({
    throughput: '8.42 YB/s',
    latency: '-3.14 ms',
    deflections: '14.2B / sec',
    stability: '99.8%',
  })

  const [logs, setLogs] = useState<string[]>(() => generateInitialLogs())

  // Dynamic statistics fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        throughput: `${(8.2 + Math.random() * 0.5).toFixed(2)} YB/s`,
        latency: `${(-3.0 - Math.random() * 0.4).toFixed(2)} ms`,
        deflections: `${(14.2 + (Math.random() - 0.5) * 0.2).toFixed(1)}B / sec`,
        stability: `${(99.4 + Math.random() * 0.5).toFixed(1)}%`,
      })
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Dynamic scrolling logs
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((curr) => {
        const next = [...curr, generateRandomLog()]
        if (next.length > 30) next.shift()
        return next
      })
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  // Canvas animated real-time graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    const dataPoints: number[] = Array.from({ length: 60 }, () => 20 + Math.random() * 30)

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }
    resizeCanvas()
    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(canvas.parentElement!)

    function draw() {
      if (!ctx || !canvas) return

      // Shift data points and add a new one with random spikes
      dataPoints.shift()
      const spikeProbability = 0.05
      const base = 25 + Math.sin(Date.now() * 0.005) * 10
      const noise = (Math.random() - 0.5) * 8
      let nextVal = base + noise
      if (Math.random() < spikeProbability) {
        nextVal = 60 + Math.random() * 30 // Absurd spike!
      }
      dataPoints.push(Math.max(5, Math.min(canvas.height - 5, nextVal)))

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw background grid lines
      ctx.strokeStyle = '#052e16'
      ctx.lineWidth = 1
      const gridSpacing = 20
      for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Draw chart line
      ctx.strokeStyle = '#22c55e'
      ctx.shadowBlur = 8
      ctx.shadowColor = '#22c55e'
      ctx.lineWidth = 2
      ctx.beginPath()

      const step = canvas.width / (dataPoints.length - 1)
      for (let i = 0; i < dataPoints.length; i++) {
        // Map height so higher values are drawn higher up (subtracted from canvas height)
        const y = canvas.height - (dataPoints[i] / 100) * canvas.height
        const x = i * step
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Fill area under line
      ctx.shadowBlur = 0 // Remove shadow for fill
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)'
      ctx.lineTo(canvas.width, canvas.height)
      ctx.lineTo(0, canvas.height)
      ctx.closePath()
      ctx.fill()

      // Draw active scanner scanline
      const scanX = (Date.now() * 0.15) % canvas.width
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(scanX, 0)
      ctx.lineTo(scanX, canvas.height)
      ctx.stroke()

      rafId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="QUANTUM INTRUSION MONITOR // NETWORK FLUX">
      <div className="flex flex-col h-full w-full overflow-hidden p-2 gap-2 text-xs font-mono text-green-400">
        
        {/* Metric Grid Cards */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0 text-[10px]">
          <div className="border border-green-900 bg-black/60 p-1.5 flex flex-col justify-between rounded shadow-[inset_0_0_8px_rgba(20,83,45,0.4)]">
            <span className="text-green-800 uppercase tracking-widest font-bold">THROUGHPUT</span>
            <span className="text-[14px] text-green-300 font-bold truncate tracking-tight">{stats.throughput}</span>
            <div className="w-full bg-green-950 h-1 rounded overflow-hidden mt-1">
              <div 
                className="bg-green-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(10, parseFloat(stats.throughput) * 10))}%` }}
              />
            </div>
          </div>
          
          <div className="border border-green-900 bg-black/60 p-1.5 flex flex-col justify-between rounded shadow-[inset_0_0_8px_rgba(20,83,45,0.4)]">
            <span className="text-green-800 uppercase tracking-widest font-bold">LATENCY</span>
            <span className="text-[14px] text-green-300 font-bold truncate tracking-tight">{stats.latency}</span>
            <span className="text-[8px] text-green-600">TEMPORAL SHIFT ACTIVE</span>
          </div>

          <div className="border border-green-900 bg-black/60 p-1.5 flex flex-col justify-between rounded shadow-[inset_0_0_8px_rgba(20,83,45,0.4)]">
            <span className="text-green-800 uppercase tracking-widest font-bold">DEFLECTION RATE</span>
            <span className="text-[14px] text-green-300 font-bold truncate tracking-tight">{stats.deflections}</span>
            <span className="text-[8px] text-green-500">FIREWALL: SENTIENT (100%)</span>
          </div>

          <div className="border border-green-900 bg-black/60 p-1.5 flex flex-col justify-between rounded shadow-[inset_0_0_8px_rgba(20,83,45,0.4)]">
            <span className="text-green-800 uppercase tracking-widest font-bold">TUNNEL STABILITY</span>
            <span className="text-[14px] text-green-300 font-bold truncate tracking-tight">{stats.stability}</span>
            <div className="w-full bg-green-950 h-1 rounded overflow-hidden mt-1">
              <div 
                className="bg-green-400 h-full transition-all duration-300"
                style={{ width: stats.stability }}
              />
            </div>
          </div>
        </div>

        {/* Real-time Canvas Graph */}
        <div className="flex-1 min-h-[50px] border border-green-900 bg-black/80 rounded relative overflow-hidden">
          <div className="absolute top-1 left-2 text-[8px] text-green-700 tracking-wider font-bold select-none z-10">
            SUBSPACE QUANTUM CHANNEL RATE
          </div>
          <canvas ref={canvasRef} className="block w-full h-full" />
        </div>

        {/* Scrolling logs */}
        <div className="h-[90px] border border-green-900 bg-black/60 rounded flex flex-col overflow-hidden text-[9px]">
          <div className="bg-green-950/40 border-b border-green-900 px-2 py-0.5 text-green-700 font-bold tracking-widest uppercase">
            Intrusion Stream Logs
          </div>
          <ScrollingLog 
            lines={logs}
            interval={0} // Disable interval rotation, we feed it ourselves
            className="flex-1 p-1 text-green-800 [&>div:last-child]:text-green-400"
          />
        </div>
      </div>
    </Panel>
  )
}
