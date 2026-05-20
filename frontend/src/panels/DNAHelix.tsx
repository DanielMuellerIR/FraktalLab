import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Rotierender 3D-DNA-Doppelhelix — klassischer Biohacking-Look
export default function DNAHelix() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 80, H = 50
    let rafId: number
    let alive = true

    // Farbpaare für die Basenpaarungen (A-T: grün/cyan, G-C: magenta/gelb)
    const PAIRS = [
      ['#00ff80', '#00ccff'],
      ['#ff40cc', '#ffdd00'],
      ['#00ff80', '#00ccff'],
      ['#ff40cc', '#ffdd00'],
    ]

    function loop(t: number) {
      if (!alive) return

      ctx!.fillStyle = '#000'
      ctx!.fillRect(0, 0, W, H)

      const ts     = t * 0.0015
      const steps  = 28          // Basenpaar-Schritte entlang der Y-Achse
      const cx     = W / 2
      const radius = 14          // Helix-Radius

      // Alle Segmente sammeln und nach Z sortieren (Painter's Algorithm)
      type Seg = { y: number; x1: number; x2: number; z: number; colorA: string; colorB: string; pair: number }
      const segs: Seg[] = []

      for (let i = 0; i < steps; i++) {
        const frac   = i / steps
        const angle  = ts + frac * Math.PI * 4   // zwei volle Drehungen über die Länge
        const y      = frac * H

        // Die zwei Stränge sind um PI versetzt
        const x1 = cx + Math.cos(angle) * radius
        const x2 = cx + Math.cos(angle + Math.PI) * radius
        const z  = Math.sin(angle)   // Z-Tiefe für Helligkeit + Sortierung

        const pair = i % PAIRS.length
        segs.push({ y, x1, x2, z, colorA: PAIRS[pair][0], colorB: PAIRS[pair][1], pair })
      }

      // Vorderste Segmente zuletzt zeichnen
      segs.sort((a, b) => a.z - b.z)

      for (const s of segs) {
        const py = s.y
        const bright = 0.3 + (s.z + 1) * 0.35   // Tiefe → Helligkeit

        // Querstrebe (Basenpaar)
        const alpha = bright * 0.6
        ctx!.strokeStyle = `rgba(80,200,100,${alpha})`
        ctx!.lineWidth   = 0.8
        ctx!.beginPath()
        ctx!.moveTo(s.x1, py)
        ctx!.lineTo(s.x2, py)
        ctx!.stroke()

        // Strang-A Punkt
        const r1 = Math.max(0.5, 2 * bright)
        ctx!.fillStyle = s.colorA + Math.round(bright * 255).toString(16).padStart(2, '0')
        ctx!.beginPath()
        ctx!.arc(s.x1, py, r1, 0, Math.PI * 2)
        ctx!.fill()

        // Strang-B Punkt
        ctx!.fillStyle = s.colorB + Math.round(bright * 255).toString(16).padStart(2, '0')
        ctx!.beginPath()
        ctx!.arc(s.x2, py, r1, 0, Math.PI * 2)
        ctx!.fill()
      }

      // Sequenz-Label unten (rotiert zufällig durchlaufend)
      const bases = 'ATCGATCGATCG'
      const startI = Math.floor(ts * 3) % bases.length
      ctx!.font = '4px monospace'
      ctx!.fillStyle = 'rgba(0,200,80,0.5)'
      ctx!.fillText('SEQ: ' + bases.slice(startI) + bases.slice(0, startI), 2, H - 2)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(rafId) }
  }, [])

  return (
    <Panel title="DNA SEQUENCE // BIOHACK ACTIVE">
      <canvas
        ref={canvasRef}
        width={80} height={50}
        style={{ width: '100%', height: 'auto', maxHeight: '100%', aspectRatio: '80 / 50', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}
