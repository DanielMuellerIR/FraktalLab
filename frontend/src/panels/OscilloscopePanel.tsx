import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

function OscilloscopePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number
    let alive = true

    let isVisible = true
    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
    })
    io.observe(canvas)

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const numBars = 32
    const heights = new Float32Array(numBars)
    const peaks = new Float32Array(numBars)
    const peakDecay = new Float32Array(numBars)

    // Spectrogram history buffer for scrolling waterfall (W x H)
    const historyRows = 40
    const history = Array.from({ length: historyRows }, () => new Float32Array(numBars))
    let historyHead = 0

    function loop(t: number) {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      if (!isVisible) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Clear screen
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // ── Simulate Frequency Spectrum ──
      const ts = t * 0.001
      for (let i = 0; i < numBars; i++) {
        // Base sine wave movements + noise
        const base = 0.3 * Math.sin(ts * 1.5 + i * 0.2) +
                     0.2 * Math.sin(ts * 3.4 - i * 0.5) +
                     0.1 * Math.sin(ts * 8.0 + i * 0.8) + 0.4
        let noise = Math.random() * 0.15
        
        // Add periodic drum/bass beats to the lower frequencies
        if (i < 6) {
          const beat = Math.pow(Math.max(0, Math.sin(ts * Math.PI * 1.8)), 4)
          noise += beat * 0.45
        }
        // Add random spikes to high frequencies
        if (i > 20 && Math.random() > 0.94) {
          noise += Math.random() * 0.4
        }

        const amp = Math.min(1.0, Math.max(0.02, base + noise))
        // Smooth transitions
        heights[i] = heights[i] * 0.7 + amp * 0.3

        // Peak decay calculation
        if (heights[i] >= peaks[i]) {
          peaks[i] = heights[i]
          peakDecay[i] = 0
        } else {
          peakDecay[i] += 0.016
          peaks[i] = Math.max(0, peaks[i] - 9.8 * peakDecay[i] * peakDecay[i] * 0.02)
        }
      }

      // Add to scrolling waterfall history
      const row = history[historyHead]
      row.set(heights)
      historyHead = (historyHead + 1) % historyRows

      // ── Layout Heights ──
      const barsY = H * 0.08
      const barsH = H * 0.42
      const barSpacing = W / numBars

      // ── Render Frequency Bars ──
      for (let i = 0; i < numBars; i++) {
        const x = i * barSpacing
        const h = heights[i] * barsH
        const y = barsY + barsH - h

        // Draw bar with gradient
        const grad = ctx.createLinearGradient(x, y, x, barsY + barsH)
        grad.addColorStop(0, '#00ff66')
        grad.addColorStop(0.5, '#009933')
        grad.addColorStop(1, '#003311')
        ctx.fillStyle = grad
        ctx.fillRect(x + 1, y, barSpacing - 2, h)

        // Draw peak decay dot
        const peakY = barsY + barsH - peaks[i] * barsH
        ctx.fillStyle = '#86efac'
        ctx.fillRect(x + 1, Math.max(barsY, peakY - 1.5), barSpacing - 2, 1.5)
      }

      // ── Render Spectrogram Waterfall ──
      const waterY = H * 0.56
      const waterH = H * 0.35
      const rowH = waterH / historyRows

      for (let r = 0; r < historyRows; r++) {
        // Read from oldest to newest row
        const idx = (historyHead - 1 - r + historyRows) % historyRows
        const rowData = history[idx]
        const y = waterY + r * rowH

        for (let i = 0; i < numBars; i++) {
          const x = i * barSpacing
          const amp = rowData[i]
          
          // Draw horizontal cells
          ctx.fillStyle = `rgba(0, 255, 65, ${amp * (1 - r / historyRows) * 0.85})`
          ctx.fillRect(x + 0.5, y, barSpacing - 1, rowH - 0.5)
        }
      }

      // Division line
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H * 0.52); ctx.lineTo(W, H * 0.52)
      ctx.stroke()

      // ── HUD Information Ticker ──
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.75)'
      ctx.fillText('SIGNAL COMPILING // RF SPECTRUM', 10, H - 6)
      
      const freq = 142.08 + 0.02 * Math.sin(ts)
      ctx.textAlign = 'right'
      ctx.fillText(`FREQ: ${freq.toFixed(3)} MHz // COMPILER_STRENGTH: 99.1%`, W - 10, H - 6)
      ctx.textAlign = 'left'
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="OSCILLOSCOPE // SIGNAL TRACE">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(OscilloscopePanel);
