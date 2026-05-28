import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'

const EARTH_BASE64 = 'UklGRnQEAABXRUJQVlA4IGgEAACwHACdASoAAYAAPm02l0ikIyIhI9RJSIANiWdu4XPw3WCa6LZn8qt9UY+ELzHfQB/P90N/g98A/uO+Of2DeAP//1r/RP+2drtkH+4UQLuJ0BdsI4B/NuID8H/vPmX8QMdH7zf5f+P3wC/wcJIAN/ZABv7H/hbPzZCYMtMJxbh7BPBZUajnlWc/odAofN/ytItCJc7VQjOdKJEf4wDs5mwSkGzNLb6xwMv/7fz3h/asmq9gpRyalgX1FsUd1x4Ns6RKE1GYL2IXNagdQAb84FRqpbSUH8bzZruVaCdfrzwuX3aWGqQdUWVGsqQAb+oAAP7+UX3/8er1J8q/wOf/49t/49t/49t/+PPOi3s4lCAY50ssB8bFuaPA9RHAvsjjkr0hVoD4+QCCirzRC13shAh3zXDNFVk3MHhlEYPSOpCa+JALDLu4X7snBdI2wnO6pIpwsVxaB+DfwVPw5D9dfNn/MgWdW/qpAPllzcuJZMYvN+lYH9i97ubql7c2f30KyCqUtRPeltR+a6F3Kw+1RsVeVuSPY/jSZe9Vqjn3DOoGfjBAlQit3cbOmEgWytHzWYXR1MY8mqa5KsGKq6WburEfuk5/CcmuagxOIAc40cY0hW1r9ZVnQJUxWSYD9tWVQ6Bwf9buJlj2GvgKDfOl2VTiTIGKmXSeC3Al/Hpp304taxspDNsDkK6LbPn0uK0rAqzRJluNRvuzzmPGn9DJ7gs86zpxsLCCiu9qyt2nEwMdwdT86qD37ubQcYrNUr2dAmVl5zV/gmyo2FTIVKCRxLjP2NnA/DVEAb+CyYtFsW+1kXxCut372VaJEciaIlkPOCX+4DHahW+9nez6e+3rSBROQtsZlltJxhhnDxYJAHBWvOY3dH5oOrISNzTKYyL4sgZZ+4v/glBQtJ2BMQUHn9H70nHyoKJet9KGHjfaLj1SR/MqQDtaKuHW1zC2dpcWfSQjmrD4HWgg7MaeSk3p2X/6CR6LLK9wFigGL9oWPiWsHEmf9xdL26kbZ1QX6N8D9gViStFznJv0ZUE/AXaklYa6hf1lRNeH/Be2RCUvY8qfxZZXolPED72WCYf2pma2ILDzUxcfBE3PS4oyiOeJsXE//Dmq8JBDMqKPddcmglmeTcTzFBeJWHrR6K8l3Aedd0GJMgYqZQY4NHSIzROXVy/WxHo5V+WTHt+x5jNraN1udu64fdB3gCv3Z+5jLLs0LEkZDqWTH7RAYjJ8qEAD46XLDGJJYSID83cNmWtCMmCUXgI4ehFo9kWG1LtKX5YTSY48L9wqGeMn2wt45RxTmu3GZSf/AS9YF3DSsJ7JJIwR8iHVVdSt3dTTTXPf3eDRYnXVOrxxrS5KA3E6OtfhODHN5JpSlKIZ3uuiWcXW1koyZMEGZd2LxeRC3meYbTr8F2sSARIb1ToraJd9Naka/fVRkZj7JDTUb1qD3C3OlH9v5nhwrJh4iXdnD6/8oTrJN//Am3tQpYZQ7LmigkzqVloltrOYgJEc0XdLI9mO6sqwbcy7tEdD+SpN4u71wQXOVF+BuUCRv5reJjO0+eZDmtozS1wnNsyg22Psjpt/BAAzuHjyYUDpebsIfPFZNdTeYR9dLZZmAdovRGuOumyYW6NsnwwUB6pbWje7O4E0p4Q/n6/jRgRXIhZImuO5Du804ZzJ8vU6sHAbnG+2zfA8/Ns0gMMT8cY6RjpaDsxAo7LYv+3ApZzWwb33nVME+vhBqgaZJVpyV4bED7SAIvb7QQdKTAEic+LxM6c2w6N+LSWvJaY5EGu3u/uA9trsH5iZJAyclJj2gWTufgCYfsBfEvUKi0wcCTJDs5oh8EllB4ItQBDtXwS4lE3JHZ/LvkdDoKXbh1dMtAZ0FPKQt6Nj4qxbUhzgTwk40+VQwMCkKUyqKgU9vSMIQjxTaRFWXLvgqOa+/3YOk1NIMj047XUvexO+KAmdjtcb83kiQ/JqGLIyu30fwl9AdFlPYP5WGlkX/AUF0glccNtIlDrwXEtfNYjwq6qUh1q1KCsm3nLCPypX4gaPvTmqWD2075x32yQPVFuiJkdlCL1H44knM0TwDBYTrFYzs0jsTfvlXuuLhfLuden5nWaICIMCvVO6mP8UtgQK1tuDLvBvFNcB0Dfj0csi8WvYmyD38ysgJODsJYK4Uao7Tus0Npia9Hi6hmsRZyspwWWt7KcWuGhV1KKHbaVb/I94TJMytzbJ4okTYpSojRKqFculrjXBEa7HFtxWEE8GmDm9HywZxB/xP0EHXxa1gAssKSwzmWdMVqcnH95NBMcl6ikm4AtVg4IYIQjBJuXg4OYtrmF1YlPhDVliGbyDQtkzo9NsB4DwiMI621JhGVyZ+fxJEb84pO7dPQP09dOJelkUXsDAxgTCc5APBRDdSZs7GHIJBehtBARpSA+pofT4x/Wq+5IxNG735dONI85gU/vOZGbcnxyDnSQe1//YnIjmHAojaryZZ0boyjUpCSQ/Pp+bca09w0CSJ5imGyHGKMer4yrVDKTJ7Gnjh+vTFXcW9D7gGYQpsJDykfMOTYkH2XEpyhTlVZP981uparBSsNVun/rdullXqrvw1XIr5SzP4ET4+/88D+V+kLR78v0qKpDmIpGcT1SVUWcPjHxGihnkIJEOMAZ7jEXwC3w080iimfcKywGTFaQVzn7zpAugYGoD/9/XOQnd0qZ/SR7goo3KIVo99Tf3nI76WfmDo3gXxI6WtoYvgCr31SzvExePHV2I2MuS0YaiE0ql5h9Y4Jbx7D0k0TP6KnvewaQ2wNOX9oz0hTuyMu/ZtcJQAbzWqj5GupbpdZfeb/z8Kai9JwTHgKGqDFSyp2fMbs9VKW16x1UuuXtEkca0gCHsEDeTyoDnOfY2q8RIeQH/5o7tdCVYPN6rTEur5iyLh2i7sgMNsWAyJU4cWNOiXAr0Ju+QpOhRqETQpICI0QVFpJp1X2xbrrHwElfLZsWYwDuJFvfkkdnpdoCZPzus2At9lwO6x1PYCqGK2Z1YIHhs+z+Dvhwkc0rxT3ldfx56WwGGpH4jP5rQ3P896wZlRjMzCbQCRwXBMlQHKY2SkjxobhP3EOv+pymOmF+t/AHXGfZ1UkRz5CnDejQabXuaLEWIF8lQ7GrIqB8WWDtdda8RynDK9qbFMtABRAzZ/TpCaTInqthf7V559KB1bdQTaOUdftPIhOAsRW/vpWrvzOS1EVHYS7uDpxMNNHuzMjcUC2e9dUdVJODbrPjG2Z5qzcG++7JMDbTV6g9MnKGRz8w4BKchHaKlDbP5TmpG7b+r28Zxx8hTRo+SqG7S0zXne8G/5E/xmEMmuABqqDIAJ0JoLquqkZofFlKBwuAaIfSObRzLcFbZkA2xPutq6p0kromaKvXQk0FY1ZFeXMF0h43cqrFrT9eEAknrvcZI+WVpjRUFQ5OhQZsVqI0mkCvKYNduGw/My0FqU3yQrZXAFculj48VHwzFElwXqf4VT/fz/WpyEhvuzIXmM3U14UD6fXw3FF5PD/1Iq9ie37tK0C9fPy4qe/h88tTWTqZ63IrBonCf978a0NWKA59DVRde7ChKZTDptUKHhQ3m6oJc6oJbwFRvYjz4blMw/oVdIL6xTjUnUS7E5KIxgkAGQSaojh4mBHZ7xarioAuqxXKoSHGUKwIxWTPS3MSypBLEVdeH5lFA8kFtk56qYDkzKqFRN1Efc4AOEJ+Ozib6Ko8ni9SxLfqvkO/GcZtu3AN8DlHqGfADXR5EwG9Z/ofwAgD2y+ppdDZMA7UKfjHBxvQdi+OfQOmZmNeeo93Im2lmhQGSriycqnP0nYkPTL8U7FSfI2/endOut6O7Z+oF6gD693EupyvhSP457IJPsbYqQFPNRb6ZgD1XDFgFgDUMvL0lk9JDpbEVyN4RK7UQMHatsBahcXwhbWIHoPhatu2/jVCoXZSpF5Dbzaobeed1Et3IZKpaXLJnLEX3nS/FIpips='

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

    let rafId: number
    let alive = true

    // Load and process geothermal landmass map
    const mapImg = new Image()
    let processedMap: HTMLCanvasElement | null = null
    
    mapImg.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width = mapImg.width
      offscreen.height = mapImg.height
      const oCtx = offscreen.getContext('2d')
      if (oCtx) {
        oCtx.drawImage(mapImg, 0, 0)
        const imgData = oCtx.getImageData(0, 0, offscreen.width, offscreen.height)
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
      // North America sits roughly at source: x: 0.10..0.45, y: 0.23..0.67 on the global map
      if (processedMap) {
        ctx.save()
        ctx.globalAlpha = 0.72 // Much brighter overlay since it is processed!
        
        const mapW = processedMap.width
        const mapH = processedMap.height
        const sx = mapW * 0.10
        const sy = mapH * 0.23
        const sw = mapW * 0.35
        const sh = mapH * 0.44

        ctx.drawImage(processedMap, sx, sy, sw, sh, 0, 0, W, H)
        ctx.restore()
      }

      // Yellowstone Center coordinates relative to zoomed map:
      // Global Yellowstone: x: 0.23, y: 0.40
      // Zoomed viewport window: sx: 0.10..0.45 (Width: 0.35), sy: 0.23..0.67 (Height: 0.44)
      // Local coordinates:
      // Local x: (0.23 - 0.10) / 0.35 = 0.37
      // Local y: (0.40 - 0.23) / 0.44 = 0.38
      const ystoneX = 0.37 * W
      const ystoneY = 0.38 * H

      // 3. Tectonic Fault Lines (glowing magma lines)
      ctx.save()
      ctx.shadowBlur = 6
      ctx.shadowColor = '#ff5500'
      ctx.lineWidth = 1.6
      faultLines.forEach(line => {
        ctx.beginPath()
        // Convert global coordinates to local zoom viewport coordinates
        const lx0 = ((line[0].x - 0.10) / 0.35) * W
        const ly0 = ((line[0].y - 0.23) / 0.44) * H
        ctx.moveTo(lx0, ly0)
        for (let i = 1; i < line.length; i++) {
          const lx = ((line[i].x - 0.10) / 0.35) * W
          const ly = ((line[i].y - 0.23) / 0.44) * H
          ctx.lineTo(lx, ly)
        }
        
        // Pulsate line brightness and color
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
        // Outer ash haze
        drawFuzzyCloud(ystoneX, ystoneY, ashRadius, timeFactor, '#5a504b', 0.32)
        // Mid density volcanic ash
        drawFuzzyCloud(ystoneX, ystoneY, ashRadius * 0.65, timeFactor, '#352f2c', 0.48)
        // Inner hot pyroklastic plume
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

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
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
