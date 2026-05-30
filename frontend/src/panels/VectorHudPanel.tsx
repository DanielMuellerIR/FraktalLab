import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
// Zentraler rAF-Coordinator: bündelt alle Panel-Animationen in einer einzigen
// requestAnimationFrame-Schleife. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

interface Point3D { x: number; y: number; z: number }

function VectorHudPanel() {
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
        if (!unsubscribe) unsubscribe = subscribe(loop)
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

    // Generate 3D cube points
    const points: Point3D[] = []
    const edges: [number, number][] = []

    // 8 points of a 3D cube
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          points.push({ x: x * 45, y: y * 45, z: z * 45 })
        }
      }
    }

    // Connect edges of the cube
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        let diff = 0
        if (points[i].x !== points[j].x) diff++
        if (points[i].y !== points[j].y) diff++
        if (points[i].z !== points[j].z) diff++
        if (diff === 1) edges.push([i, j])
      }
    }

    let angleX = 0
    let angleY = 0
    let angleZ = 0

    function project3D(p: Point3D, w: number, h: number, rotX: number, rotY: number, rotZ: number) {
      // Rotate Z
      let x1 = p.x * Math.cos(rotZ) - p.y * Math.sin(rotZ)
      let y1 = p.x * Math.sin(rotZ) + p.y * Math.cos(rotZ)
      let z1 = p.z

      // Rotate Y
      let x2 = x1 * Math.cos(rotY) - z1 * Math.sin(rotY)
      let z2 = x1 * Math.sin(rotY) + z1 * Math.cos(rotY)
      let y2 = y1

      // Rotate X
      let y3 = y2 * Math.cos(rotX) - z2 * Math.sin(rotX)
      let z3 = y2 * Math.sin(rotX) + z2 * Math.cos(rotX)

      // Perspective projection
      const distance = 250
      const scale = distance / (distance + z3)
      return {
        x: w / 2 + x2 * scale * 1.5,
        y: h / 2 + y3 * scale * 1.5
      }
    }

    function loop(t: number) {
      if (!alive) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Clear screen
      ctx.fillStyle = '#020205'
      ctx.fillRect(0, 0, W, H)

      // Slow down rotations
      angleX += 0.007
      angleY += 0.009
      angleZ += 0.004

      // Draw concentric radar circles in background
      ctx.strokeStyle = 'rgba(0, 240, 100, 0.08)'
      ctx.lineWidth = 1
      const maxRadius = Math.min(W, H) * 0.45
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, maxRadius * 0.4, 0, Math.PI * 2)
      ctx.arc(W / 2, H / 2, maxRadius * 0.7, 0, Math.PI * 2)
      ctx.arc(W / 2, H / 2, maxRadius, 0, Math.PI * 2)
      ctx.stroke()

      // Crosshairs
      ctx.strokeStyle = 'rgba(0, 240, 100, 0.12)'
      ctx.beginPath()
      ctx.moveTo(W / 2 - maxRadius, H / 2); ctx.lineTo(W / 2 + maxRadius, H / 2)
      ctx.moveTo(W / 2, H / 2 - maxRadius); ctx.lineTo(W / 2, H / 2 + maxRadius)
      ctx.stroke()

      // Project points
      const projected = points.map(p => project3D(p, W, H, angleX, angleY, angleZ))

      // Draw cube faces / shading
      ctx.strokeStyle = '#00ff66'
      ctx.lineWidth = 1.6
      ctx.shadowBlur = 6
      ctx.shadowColor = '#00ff66'

      edges.forEach(([p1, p2]) => {
        ctx.beginPath()
        ctx.moveTo(projected[p1].x, projected[p1].y)
        ctx.lineTo(projected[p2].x, projected[p2].y)
        ctx.stroke()
      })
      ctx.shadowBlur = 0 // Reset

      // Draw target lock bracket around cube
      const targetSize = maxRadius * 0.75 + 10 * Math.sin(t * 0.005)
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)'
      ctx.lineWidth = 1.2
      const left = W / 2 - targetSize / 2
      const right = W / 2 + targetSize / 2
      const top = H / 2 - targetSize / 2
      const bottom = H / 2 + targetSize / 2

      // Draw brackets
      const arm = 12
      ctx.beginPath()
      ctx.moveTo(left + arm, top); ctx.lineTo(left, top); ctx.lineTo(left, top + arm)
      ctx.moveTo(right - arm, top); ctx.lineTo(right, top); ctx.lineTo(right, top + arm)
      ctx.moveTo(left + arm, bottom); ctx.lineTo(left, bottom); ctx.lineTo(left, bottom + arm)
      ctx.moveTo(right - arm, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom + arm)
      ctx.stroke()

      // Rotating diagnostic scanner sweep line
      const sweepAngle = t * 0.002
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(W / 2, H / 2)
      ctx.lineTo(W / 2 + Math.cos(sweepAngle) * maxRadius, H / 2 + Math.sin(sweepAngle) * maxRadius)
      ctx.stroke()

      // Draw HUD info labels
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(0, 255, 100, 0.75)'
      ctx.fillText('TARGET: HYPERCUBE_NODE_09', 12, 18)
      ctx.fillText(`ROT_X: ${(angleX % (Math.PI * 2)).toFixed(2)} RAD`, 12, 30)
      ctx.fillText(`ROT_Y: ${(angleY % (Math.PI * 2)).toFixed(2)} RAD`, 12, 42)
      ctx.fillText(`SCALE: 1.50x (AUTO)`, 12, 54)
      ctx.fillText('STATUS: LOCKED & TRACKING', 12, 66)

      ctx.fillText(`COORDS: X_${Math.round(projected[0].x)} Y_${Math.round(projected[0].y)}`, W - 145, 18)
      ctx.fillText(`SYS_CALIBRATION: OK`, W - 145, 30)
      ctx.fillText(`SIGNAL_STRENGTH: 99.8%`, W - 145, 42)
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
    <Panel title="VECTOR HUD // TACTICAL WIREFRAME">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(VectorHudPanel);
