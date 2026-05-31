import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

function LidarScanPanel() {
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
      // We cap the rendering resolution slightly for performance while keeping it sharp
      const maxW = 480
      const cw = container.clientWidth || 300
      const ch = container.clientHeight || 200
      const scale = cw > maxW ? maxW / cw : 1

      canvas.width = Math.round(cw * scale)
      canvas.height = Math.round(ch * scale)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── 3D Grid Parameters ───────────────────────────────────────────────────
    const GRID_SIZE = 26
    const SPACING = 15

    // Projection helper
    function project(
      x: number,
      y: number,
      z: number,
      rotY: number,
      rotX: number,
      W: number,
      H: number
    ) {
      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const x1 = x * cosY - z * sinY
      const z1 = x * sinY + z * cosY

      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)
      const y2 = y * cosX - z1 * sinX
      const z2 = y * sinX + z1 * cosX

      const distance = 350
      const fov = 320
      const factor = fov / (distance + z2)
      const sx = W / 2 + x1 * factor
      const sy = H * 0.45 - y2 * factor

      return { sx, sy, z2, scale: factor }
    }

    // 4 Terrain modes with different geometric wave patterns
    function getTargetHeight(mode: number, dx: number, dz: number, dist: number, waveTime: number): number {
      switch (mode % 4) {
        case 0: { // Double sine waves
          const h1 = Math.sin(dx * 0.22 - waveTime) * Math.cos(dz * 0.22 - waveTime)
          const h2 = 0.35 * Math.sin(dist * 0.4 - waveTime * 1.5)
          return (h1 + h2) * 16.0
        }
        case 1: { // Radial ripples expanding outwards
          return Math.sin(dist * 0.48 - waveTime * 1.8) * 16.0
        }
        case 2: { // Linear sweeping canyon ridges
          return Math.cos(dx * 0.3 - waveTime) * Math.sin(dz * 0.18) * 18.0
        }
        case 3:
        default: { // Diagonal peaks
          return Math.sin((dx + dz) * 0.25 - waveTime * 1.4) * 18.0
        }
      }
    }

    // Dynamic state trackers
    const renderedHeights = new Float32Array(GRID_SIZE * GRID_SIZE)
    const pointModes = new Uint8Array(GRID_SIZE * GRID_SIZE)
    let globalMode = 0
    let lastStageChange = 0.0

    // ── Render Loop ──────────────────────────────────────────────────────────
    function loop(t: number) {
      if (!active || !isVisible) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Clear with very dark background
      ctx.fillStyle = '#010502'
      ctx.fillRect(0, 0, W, H)

      // Time variables
      const waveTime = t * 0.002
      const rotY = t * 0.0003
      
      // Slowly animate pitch tilt angle from low perspective to top-down view (0.28 to 1.35)
      const rotX = 0.81 + 0.54 * Math.sin(t * 0.00015)

      // Sonar sweep angle
      const sweepAngle = (t * 0.0018) % (Math.PI * 2)

      // Cycle terrain modes every 15 seconds
      if (t - lastStageChange > 15000) {
        lastStageChange = t
        globalMode = (globalMode + 1) % 4
      }

      // Project all grid points
      const points: { sx: number; sy: number; z2: number; h: number; color: string; scale: number }[][] = []
      const halfSize = (GRID_SIZE - 1) / 2

      for (let gy = 0; gy < GRID_SIZE; gy++) {
        points[gy] = []
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const idx = gy * GRID_SIZE + gx
          const dx = gx - halfSize
          const dz = gy - halfSize
          const dist = Math.sqrt(dx * dx + dz * dz)

          // Determine angle from center in polar coords for sonar sweep detection
          const ptAngle = Math.atan2(dz, dx) + Math.PI // 0 to 2PI
          const angleDiff = Math.abs(ptAngle - sweepAngle)
          const isSweepHit = angleDiff < 0.22 || angleDiff > Math.PI * 2 - 0.22

          // If sonar sweep line hits point, update its mode to target global mode
          if (isSweepHit) {
            pointModes[idx] = globalMode
          }

          const targetH = getTargetHeight(pointModes[idx], dx, dz, dist, waveTime)
          // Smoothly interpolate current rendered height towards target wave height
          const dt = 0.016
          renderedHeights[idx] += (targetH - renderedHeights[idx]) * 7.5 * dt
          const h = renderedHeights[idx]

          const wx = dx * SPACING
          const wz = dz * SPACING

          const { sx, sy, z2, scale } = project(wx, h, wz, rotY, rotX, W, H)

          // Color based on height and sweep highlight
          let color = ''
          if (isSweepHit) {
            // Glowing neon yellow-green for active sonar sweep
            color = 'rgba(163, 230, 53, 0.9)'
          } else {
            // Transition from neon cyan (high points) to neon magenta (low points)
            const ratio = Math.max(0, Math.min(1, (h + 16) / 32))
            const r = Math.round(34 + ratio * 200)
            const g = Math.round(211 - ratio * 180)
            const b = Math.round(238 + ratio * 17)
            const opacity = Math.max(0.12, 1.0 - z2 / 280) // fog fading
            color = `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`
          }

          points[gy][gx] = { sx, sy, z2, h, color, scale }
        }
      }

      // Draw grid lines (horizontal & vertical connections)
      ctx.lineWidth = 0.65
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const p = points[gy][gx]
          if (p.z2 < -150) continue // Behind clipping plane

          // Connect to right neighbor
          if (gx < GRID_SIZE - 1) {
            const pr = points[gy][gx + 1]
            if (pr.z2 > -150) {
              ctx.strokeStyle = p.color
              ctx.beginPath()
              ctx.moveTo(p.sx, p.sy)
              ctx.lineTo(pr.sx, pr.sy)
              ctx.stroke()
            }
          }

          // Connect to bottom neighbor
          if (gy < GRID_SIZE - 1) {
            const pb = points[gy + 1][gx]
            if (pb.z2 > -150) {
              ctx.strokeStyle = p.color
              ctx.beginPath()
              ctx.moveTo(p.sx, p.sy)
              ctx.lineTo(pb.sx, pb.sy)
              ctx.stroke()
            }
          }
        }
      }

      // Draw dots on top of the grid
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const p = points[gy][gx]
          if (p.z2 < -150) continue

          const dotSize = Math.max(1.5, p.scale * 1.5)
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, dotSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Sonar Sweep Line Overlay ───────────────────────────────────────────
      const sonarR = Math.min(W, H) * 0.42
      const sonarX = W / 2
      const sonarY = H * 0.45
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(sonarX, sonarY, sonarR, 0, Math.PI * 2)
      ctx.stroke()

      // Radial sonar beam line
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.28)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sonarX, sonarY)
      ctx.lineTo(
        sonarX + Math.cos(sweepAngle) * sonarR,
        sonarY + Math.sin(sweepAngle) * sonarR * 0.45
      )
      ctx.stroke()

      // ── HUD Text Overlays ──────────────────────────────────────────────────
      const fSize = Math.max(7, Math.min(10, W * 0.024))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      // Top Left
      ctx.fillStyle = 'rgba(74, 222, 128, 0.7)'
      ctx.fillText('LIDAR SCANNER: ONLINE', 6, 6)

      // Top Right
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(34, 211, 238, 0.7)'
      ctx.fillText(`RESOLVING RES: ${GRID_SIZE}x${GRID_SIZE} // TILT: ${(rotX * 180 / Math.PI).toFixed(0)}°`, W - 6, 6)

      // Bottom Left
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.5)'
      ctx.fillText(`SONAR SWEEP SWEEP_HZ: ${(0.0018 * 60 / (Math.PI * 2)).toFixed(2)}`, 6, H - 6)

      // Bottom Right
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(232, 121, 249, 0.6)'
      ctx.fillText(`TOPOLOGY: GRID-MODE-${globalMode}`, W - 6, H - 6)
      ctx.textAlign = 'left'
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
    <Panel title="LIDAR SCAN // TOPOLOGY COMPILER">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </Panel>
  )
}

export default memo(LidarScanPanel)
