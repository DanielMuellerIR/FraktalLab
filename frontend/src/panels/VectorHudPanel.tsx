import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
// Zentraler rAF-Coordinator: bündelt alle Panel-Animationen in einer einzigen
// requestAnimationFrame-Schleife. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

interface Point4D { x: number; y: number; z: number; w: number }

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

    // Generate 4D hypercube (Tesseract) points
    const points: Point4D[] = []
    const edges: [number, number][] = []

    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          for (let w = -1; w <= 1; w += 2) {
            points.push({ x, y, z, w })
          }
        }
      }
    }

    // Connect edges of the 4D Tesseract (32 edges)
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        let diff = 0
        if (points[i].x !== points[j].x) diff++
        if (points[i].y !== points[j].y) diff++
        if (points[i].z !== points[j].z) diff++
        if (points[i].w !== points[j].w) diff++
        if (diff === 1) edges.push([i, j])
      }
    }

    let rotXW = 0
    let rotYZ = 0
    let rotZW = 0

    function project4D(p: Point4D, w: number, h: number, rxw: number, ryz: number, rzw: number, morphFactor: number, zoom: number) {
      const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z + p.w * p.w)
      // Morph coordinates between hypercube (+/-1) and hypersphere (normalized)
      const mx = p.x * (1.0 - morphFactor + (morphFactor * 1.732 / len)) * 42 * zoom
      const my = p.y * (1.0 - morphFactor + (morphFactor * 1.732 / len)) * 42 * zoom
      const mz = p.z * (1.0 - morphFactor + (morphFactor * 1.732 / len)) * 42 * zoom
      const mw = p.w * (1.0 - morphFactor + (morphFactor * 1.732 / len)) * 42 * zoom

      // Rotate XW
      let x1 = mx * Math.cos(rxw) - mw * Math.sin(rxw)
      let w1 = mx * Math.sin(rxw) + mw * Math.cos(rxw)
      
      // Rotate YZ
      let y1 = my * Math.cos(ryz) - mz * Math.sin(ryz)
      let z1 = my * Math.sin(ryz) + mz * Math.cos(ryz)
      
      // Rotate ZW
      let z2 = z1 * Math.cos(rzw) - w1 * Math.sin(rzw)
      let w2 = z1 * Math.sin(rzw) + w1 * Math.cos(rzw)
      
      // Project 4D to 3D (perspective division by W)
      const wDistance = 140
      const scale3D = wDistance / (wDistance + w2)
      
      const p3Dx = x1 * scale3D
      const p3Dy = y1 * scale3D
      const p3Dz = z2 * scale3D
      
      // Perspective projection from 3D to 2D
      const zDistance = 240
      const scale2D = zDistance / (zDistance + p3Dz)
      
      return {
        x: w / 2 + p3Dx * scale2D * 1.4,
        y: h / 2 + p3Dy * scale2D * 1.4
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
      rotXW = t * 0.0006
      rotYZ = t * 0.0008
      rotZW = t * 0.0003

      // Dynamic morph factor (hypercube to hypersphere)
      const morphFactor = 0.5 + 0.5 * Math.sin(t * 0.0005)
      // Pulsing zoom
      const zoomPulse = 1.0 + 0.15 * Math.sin(t * 0.0018)

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
      const projected = points.map(p => project4D(p, W, H, rotXW, rotYZ, rotZW, morphFactor, zoomPulse))

      // Draw edges
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

      // Draw target lock bracket around hypercube
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
      ctx.fillText('TARGET: HYPERCUBE_TESSERACT_4D', 12, 18)
      ctx.fillText(`MORPH_STATE: ${morphFactor.toFixed(2)} (${morphFactor > 0.85 ? 'SPHERE' : morphFactor < 0.15 ? 'CUBE' : 'HYBRID'})`, 12, 30)
      ctx.fillText(`ROT_XW: ${(rotXW % (Math.PI * 2)).toFixed(2)} RAD`, 12, 42)
      ctx.fillText(`ROT_YZ: ${(rotYZ % (Math.PI * 2)).toFixed(2)} RAD`, 12, 54)
      ctx.fillText(`ZOOM_PULSE: ${zoomPulse.toFixed(2)}x`, 12, 66)

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
