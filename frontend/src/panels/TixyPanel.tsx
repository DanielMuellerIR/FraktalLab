import React, { useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'
import { PALETTES, getRandomPaletteName, getPaletteColor } from '../utils/palettes'

const FORMULAS = [
  {
    name: 'RIPPLE GENERATOR',
    expr: 'sin(t - dist(x,y, midX,midY) * 0.4)',
    fn: (_i: number, x: number, y: number, cols: number, rows: number, t: number) => {
      const dx = x - (cols - 1) / 2
      const dy = y - (rows - 1) / 2
      const d = Math.sqrt(dx * dx + dy * dy)
      return Math.sin(t * 0.005 - d * 0.4)
    }
  },
  {
    name: 'CHECKER WAVEFORCE',
    expr: 'sin(x * 0.3 + t) * cos(y * 0.3 + t)',
    fn: (_i: number, x: number, y: number, _cols: number, _rows: number, t: number) => {
      const time = t * 0.004
      return Math.sin(x * 0.3 + time) * Math.cos(y * 0.3 + time)
    }
  },
  {
    name: 'NEURAL CASCADE',
    expr: 'sin(t + (x * y) * 0.05)',
    fn: (_i: number, x: number, y: number, _cols: number, _rows: number, t: number) => {
      return Math.sin(t * 0.005 + (x * y) * 0.05)
    }
  }
]

export const TixyPanel = React.memo(function TixyPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [formulaIdx, setFormulaIdx] = useState(0)
  const [paletteName, setPaletteName] = useState('vapor')

  // Rotate formulas and palettes every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFormulaIdx((curr) => (curr + 1) % FORMULAS.length)
      setPaletteName(getRandomPaletteName())
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

    // ResizeObserver to ensure vector sharpness and dynamic size
    const syncSize = () => {
      const container = containerRef.current
      if (!container) return
      const w = container.clientWidth || 300
      const h = container.clientHeight || 200
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
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
          unsubscribe = subscribe(loop, 'TixyPanel')
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

      const cellSize = 22 // Dynamic grid density based on fixed cell size
      const cols = Math.floor(w / cellSize)
      const rows = Math.floor(h / cellSize)
      const xOffset = (w - cols * cellSize) / 2
      const yOffset = (h - rows * cellSize) / 2

      const activeFormula = FORMULAS[formulaIdx]
      const pal = PALETTES[paletteName] || PALETTES.vapor

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          const val = activeFormula.fn(i, x, y, cols, rows, t) // range [-1..1]
          
          const clampedVal = Math.max(-1, Math.min(1, val))
          const absVal = Math.abs(clampedVal)
          
          const maxRadius = (cellSize * 0.44)
          const r = maxRadius * absVal

          if (r < 0.2) continue

          const cx = xOffset + x * cellSize + cellSize / 2
          const cy = yOffset + y * cellSize + cellSize / 2

          // Map dynamic value to cosine palette color
          const tColor = (clampedVal + 1) / 2
          const [pr, pg, pb] = getPaletteColor(pal, tColor)

          ctx.fillStyle = `rgba(${Math.round(pr * 255)}, ${Math.round(pg * 255)}, ${Math.round(pb * 255)}, ${0.25 + 0.75 * absVal})`
          ctx.strokeStyle = `rgba(${Math.round(pr * 255)}, ${Math.round(pg * 255)}, ${Math.round(pb * 255)}, ${0.45 + 0.55 * absVal})`
          
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    if (isVisible && alive) {
      unsubscribe = subscribe(loop, 'TixyPanel')
    }

    return () => {
      alive = false
      if (unsubscribe) {
        unsubscribe()
      }
      ro.disconnect()
      io.disconnect()
    }
  }, [formulaIdx, paletteName])

  const activeFormula = FORMULAS[formulaIdx]
  const currentPalette = PALETTES[paletteName] || PALETTES.vapor

  return (
    <Panel
      title={`TIXY MATRIX // ${activeFormula.name}`}
      rightLabel={`${activeFormula.expr} [PAL: ${currentPalette.name.toUpperCase()}]`}
    >
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-black select-none relative"
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        
        {/* Subtle grid info overlay */}
        <div className="absolute top-2 left-2 text-[8px] font-mono text-green-700/50 uppercase select-none pointer-events-none">
          GRID: DYNAMIC // RESOLUTION: HIGH // MODE: VECTOR
        </div>
      </div>
    </Panel>
  )
})

