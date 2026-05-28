import React, { useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

const GRID_SIZE = 16

const FORMULAS = [
  {
    name: 'RIPPLE GENERATOR',
    expr: 'sin(t - dist(x,y, 7.5,7.5) * 0.4)',
    fn: (_i: number, x: number, y: number, t: number) => {
      const dx = x - 7.5
      const dy = y - 7.5
      const d = Math.sqrt(dx * dx + dy * dy)
      return Math.sin(t * 0.005 - d * 0.4)
    }
  },
  {
    name: 'CHECKER WAVEFORCE',
    expr: 'sin(x * 0.3 + t) * cos(y * 0.3 + t)',
    fn: (_i: number, x: number, y: number, t: number) => {
      const time = t * 0.004
      return Math.sin(x * 0.3 + time) * Math.cos(y * 0.3 + time)
    }
  },
  {
    name: 'NEURAL CASCADE',
    expr: 'sin(t + (x * y) * 0.05)',
    fn: (_i: number, x: number, y: number, t: number) => {
      return Math.sin(t * 0.005 + (x * y) * 0.05)
    }
  }
]

export const TixyPanel = React.memo(function TixyPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [formulaIdx, setFormulaIdx] = useState(0)

  // Rotate formulas every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFormulaIdx((curr) => (curr + 1) % FORMULAS.length)
    }, 20000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    let alive = true
    let unsubscribe: (() => void) | null = null

    // ResizeObserver to ensure vector sharpness
    const syncSize = () => {
      const container = containerRef.current
      if (!container) return
      const size = Math.min(container.clientWidth, container.clientHeight) || 300
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size
        canvas.height = size
      }
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    if (containerRef.current) {
      ro.observe(containerRef.current)
    }

    // IntersectionObserver to pause loop when invisible
    let isVisible = true
    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
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
    })
    io.observe(canvas)

    function loop(t: number) {
      if (!alive || !isVisible) return

      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      const cellSize = w / GRID_SIZE
      const activeFormula = FORMULAS[formulaIdx]

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const i = y * GRID_SIZE + x
          const val = activeFormula.fn(i, x, y, t) // range [-1..1]
          
          // Constrain value
          const clampedVal = Math.max(-1, Math.min(1, val))
          const absVal = Math.abs(clampedVal)
          
          // Radius scales with absolute value
          const maxRadius = (cellSize * 0.45)
          const r = maxRadius * absVal

          if (r < 0.2) continue

          const cx = x * cellSize + cellSize / 2
          const cy = y * cellSize + cellSize / 2

          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)

          // Positive = cyber green glow, Negative = neon purple/magenta glow
          if (clampedVal >= 0) {
            ctx.fillStyle = `rgba(74, 222, 128, ${0.2 + 0.8 * absVal})` // Green
            ctx.strokeStyle = `rgba(74, 222, 128, ${0.4 + 0.6 * absVal})`
          } else {
            ctx.fillStyle = `rgba(236, 72, 153, ${0.2 + 0.8 * absVal})` // Pink/Purple
            ctx.strokeStyle = `rgba(236, 72, 153, ${0.4 + 0.6 * absVal})`
          }
          
          ctx.lineWidth = 1
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    if (isVisible && alive) {
      unsubscribe = subscribe(loop)
    }

    return () => {
      alive = false
      if (unsubscribe) {
        unsubscribe()
      }
      ro.disconnect()
      io.disconnect()
    }
  }, [formulaIdx])

  const activeFormula = FORMULAS[formulaIdx]

  return (
    <Panel
      title={`TIXY MATRIX // ${activeFormula.name}`}
      rightLabel={activeFormula.expr}
    >
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-black p-4 select-none relative"
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        
        {/* Subtle grid info overlay */}
        <div className="absolute top-2 left-2 text-[8px] font-mono text-green-700/50 uppercase select-none pointer-events-none">
          GRID: 16x16 // RESOLUTION: HIGH // MODE: VECTOR
        </div>
      </div>
    </Panel>
  )
})
