import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
// Zentraler rAF-Coordinator: bündelt alle Panel-Animationen in einer einzigen
// requestAnimationFrame-Schleife. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'
import { EARTH_BASE64 } from '../utils/earth-map-base64'

function SupervolcanoPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    const _canvas = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    // Unsubscribe-Handle vom zentralen raf-coordinator; null = nicht abonniert.
    let unsubscribe: (() => void) | null = null
    let alive = true

    // Generate procedural geothermal landmass map
    let processedMap: HTMLCanvasElement | null = null
    
    const mapWidth = 512
    const mapHeight = 256
    const offscreen = document.createElement('canvas')
    offscreen.width = mapWidth
    offscreen.height = mapHeight
    const oCtx = offscreen.getContext('2d')

    const mapImg = new Image()
    mapImg.onload = () => {
      if (oCtx) {
        oCtx.drawImage(mapImg, 0, 0, mapWidth, mapHeight)
        
        let seed = 98765
        const rnd = () => {
          const x = Math.sin(seed++) * 10000
          return x - Math.floor(x)
        }

        // Draw hot spots in North America (Green channel) near Yellowstone (around x: 120, y: 100)
        oCtx.fillStyle = 'rgb(0, 255, 0)'
        for (let i = 0; i < 18; i++) {
          const hx = 110 + rnd() * 35
          const hy = 80 + rnd() * 35
          const hr = 8 + rnd() * 14
          oCtx.beginPath()
          oCtx.arc(hx, hy, hr, 0, Math.PI * 2)
          oCtx.fill()
        }

        // Apply color processing
        const imgData = oCtx.getImageData(0, 0, mapWidth, mapHeight)
        const data = imgData.data

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i+1]
          
          if (r > 100) {
            // Geothermal landmass: volcanic rust red
            data[i]   = 160 // R
            data[i+1] = 45  // G
            data[i+2] = 10  // B
            data[i+3] = 110 // A (semi-transparent)
          } else if (g > 100) {
            // Hotspots: glowing magma orange
            data[i]   = 255 // R
            data[i+1] = 110 // G
            data[i+2] = 0   // B
            data[i+3] = 255 // A
          } else {
            // Ocean: fully transparent
            data[i+3] = 0
          }
        }
        oCtx.putImageData(imgData, 0, 0)
        processedMap = offscreen
      }
    }
    mapImg.src = `data:image/webp;base64,${EARTH_BASE64}`

    // Synchronously subscribe to the central rAF-coordinator immediately on mount so rendering starts on frame 1
    unsubscribe = subscribe((t) => {
      if (firstTick) { lastT = t; firstTick = false }
      loop(t)
    })


    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Simulationszustand ───────────────────────────────────────────────────
    let eruptionProgress = 0.0 // Eruptionsstufe 0..1 (wiederholt sich alle 24s)
    let ashRadius = 0.0
    
    const addLog = (text: string) => {
      const now = new Date()
      const timeStr = `[${now.toTimeString().split(' ')[0]}]`
      setLogs(prev => [ `${timeStr} ${text}`, ...prev.slice(0, 14) ])
    }

    // Tectonic Fault lines across North America (relative coordinate space)
    const faultLines = [
      // San Andreas Fault
      [
        { x: 0.16, y: 0.42 },
        { x: 0.22, y: 0.55 },
        { x: 0.28, y: 0.65 },
      ],
      // Cascadia Subduction Zone
      [
        { x: 0.18, y: 0.25 },
        { x: 0.16, y: 0.35 },
        { x: 0.19, y: 0.42 },
      ],
      // Wasatch Fault / Yellowstone surrounding area
      [
        { x: 0.28, y: 0.35 },
        { x: 0.34, y: 0.46 },
        { x: 0.32, y: 0.52 },
      ],
    ]

    function drawFuzzyCloud(cx: number, cy: number, radius: number, time: number, color: string, alpha: number) {
      ctx.save()
      ctx.fillStyle = color
      ctx.globalAlpha = alpha
      ctx.beginPath()

      const segments = 45
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        // Procedural noise distortion on cloud borders
        const noiseFactor = 1.0 +
          0.09 * Math.sin(angle * 6.0 + time * 1.5) +
          0.04 * Math.sin(angle * 14.0 - time * 3.2)
        
        const r = radius * noiseFactor
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }

      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    let lastT = 0
    let logCooldown = 0.0

    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // Eruption Progress Cycle (24 seconds)
      eruptionProgress = (t % 24000) / 24000
      ashRadius = W * 0.85 * smoothstep(0.0, 0.72, eruptionProgress)

      // ── Logger Updates based on eruption phases ─────────────────────────
      logCooldown -= dt
      if (logCooldown <= 0) {
        if (eruptionProgress < 0.05) {
          addLog('OBSERVATORY: MAGMA CHAMBER OVERPRESSURE CRITICAL // CALDERA BULGING')
          logCooldown = 3.5
        } else if (eruptionProgress >= 0.05 && eruptionProgress < 0.25) {
          addLog('ALERT: VEI-8 SUPER-ERUPTION DETECTED // CALDERA RUPTURE COMMENCED')
          logCooldown = 3.5
        } else if (eruptionProgress >= 0.25 && eruptionProgress < 0.50) {
          addLog('WEATHER FEED: STRATOSPHERIC ASH INTRUSION (ALTITUDE: 48KM)')
          logCooldown = 3.5
        } else if (eruptionProgress >= 0.50 && eruptionProgress < 0.75) {
          addLog('CLIMATE FEED: INCOMING GLOBAL ICE STAGE / GRAIN YIELD FORCAST -50%')
          logCooldown = 3.5
        } else {
          addLog('OBSERVATORY: CYCLE RESETTING // DRIFT ANALYSIS NOMINAL')
          logCooldown = 5.0
        }
      }

      function smoothstep(edge0: number, edge1: number, x: number) {
        const temp = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
        return temp * temp * (3 - 2 * temp)
      }

      // ── Rendering ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#0a0301' // Geothermal dark magma black/brown
      ctx.fillRect(0, 0, W, H)

      // 1. Grid
      ctx.strokeStyle = 'rgba(255, 110, 0, 0.035)'
      ctx.lineWidth = 0.5
      const gSize = 30
      ctx.beginPath()
      for (let x = 0; x < W; x += gSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H)
      }
      for (let y = 0; y < H; y += gSize) {
        ctx.moveTo(0, y); ctx.lineTo(W, y)
      }
      ctx.stroke()

      // 2. Render tactical map zoomed in on North America
      if (processedMap) {
        ctx.save()
        ctx.globalAlpha = 0.72
        
        const mapW = processedMap.width
        const mapH = processedMap.height
        const sx = mapW * 0.10
        const sy = mapH * 0.23
        const sw = mapW * 0.35
        const sh = mapH * 0.44

        ctx.drawImage(processedMap, sx, sy, sw, sh, 0, 0, W, H)
        ctx.restore()
      }

      const ystoneX = 0.37 * W
      const ystoneY = 0.38 * H

      // 3. Tectonic Fault Lines (glowing magma lines)
      ctx.save()
      ctx.shadowBlur = 6
      ctx.shadowColor = '#ff5500'
      ctx.lineWidth = 1.6
      faultLines.forEach(line => {
        ctx.beginPath()
        const lx0 = ((line[0].x - 0.10) / 0.35) * W
        const ly0 = ((line[0].y - 0.23) / 0.44) * H
        ctx.moveTo(lx0, ly0)
        for (let i = 1; i < line.length; i++) {
          const lx = ((line[i].x - 0.10) / 0.35) * W
          const ly = ((line[i].y - 0.23) / 0.44) * H
          ctx.lineTo(lx, ly)
        }
        
        const faultPulse = 0.5 + 0.5 * Math.sin(t * 0.005 + line[0].x)
        ctx.strokeStyle = `rgba(255, ${Math.round(80 + faultPulse * 100)}, 0, ${0.45 + faultPulse * 0.45})`
        ctx.stroke()
      })
      ctx.shadowBlur = 0
      ctx.restore()

      // 4. Caldera Overpressure Pulsing lava rings
      {
        const calderaPulse = 1.0 + Math.sin(t * 0.008) * 0.2
        const radGrad = ctx.createRadialGradient(ystoneX, ystoneY, 0, ystoneX, ystoneY, 32 * calderaPulse)
        radGrad.addColorStop(0, '#ffffff')
        radGrad.addColorStop(0.25, '#ffcc00')
        radGrad.addColorStop(0.55, '#ff4400')
        radGrad.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = radGrad
        ctx.beginPath()
        ctx.arc(ystoneX, ystoneY, 32 * calderaPulse, 0, Math.PI * 2)
        ctx.fill()
      }

      // 5. Ash Plume Clouds (expanding fuzzy clouds with hot cores)
      if (eruptionProgress > 0.02) {
        const timeFactor = t * 0.001
        drawFuzzyCloud(ystoneX, ystoneY, ashRadius, timeFactor, '#5a504b', 0.32)
        drawFuzzyCloud(ystoneX, ystoneY, ashRadius * 0.65, timeFactor, '#352f2c', 0.48)
        drawFuzzyCloud(ystoneX, ystoneY, ashRadius * 0.3, timeFactor, '#ff3700', 0.28)
      }

      // 6. HUD Geothermal Diagnostics Overlay
      ctx.fillStyle = 'rgba(255, 120, 0, 0.9)'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('WARNING: VEI-8 SUPERVOLCANIC EVENT RECORDED', 12, 22)

      ctx.fillStyle = 'rgba(230, 200, 180, 0.6)'
      ctx.font = '9px monospace'
      ctx.fillText(`GEOTHERMAL STATUS : ERUPTING (ST-3)`, 12, 36)
      ctx.fillText(`PLUME DIAMETER    : ${(ashRadius * 2.8).toFixed(0)}KM`, 12, 48)

      ctx.textAlign = 'right'
      ctx.fillText('SUPERVOLCANO SEISMIC MAP', W - 12, 22)
      ctx.fillText('ZOOM: NORTH AMERICA REGION [A-1]', W - 12, 36)
    }

    let firstTick = true

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="GEOTHERMAL MONITORING // TEKTONIC ANALYSIS">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden flex flex-col bg-black select-none">
        <div className="flex-1 w-full relative">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        
        {/* Ticker log for global fallout feedback */}
        <div className="h-24 bg-orange-950/20 border-t border-orange-900/60 p-2 font-mono text-[8px] text-orange-500 overflow-y-auto leading-relaxed flex flex-col-reverse">
          {logs.map((log, idx) => (
            <div key={idx} className={idx === 0 ? 'text-orange-400 font-bold animate-pulse' : 'text-orange-700/80'}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export default memo(SupervolcanoPanel)
