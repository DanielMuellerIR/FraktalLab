import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'

// ── Typen und Schnittstellen ──────────────────────────────────────────────────

interface Circle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  mass: number
  color: string
  glowColor: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  life: number
  maxLife: number
  size: number
}

// ── Konstanten ────────────────────────────────────────────────────────────────

const PARTICLE_COLORS = [
  '#ff3366', // Pink
  '#00f0ff', // Cyan
  '#ff9900', // Orange
  '#33ff66', // Neon-Grün
  '#ff00ff', // Magenta
  '#ffff33', // Gelb
]

function PhysicsSandboxPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Attraktor-Zustand (Mitte des Canvas als Standard)
  const [attractor, setAttractor] = useState({ x: 150, y: 150, active: true, mass: 6.0 })
  const isDraggingRef = useRef(false)

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

    // Dynamische Anpassung an Containergröße
    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // Attraktor-Startposition mittig ausrichten
    setAttractor(prev => ({ x: canvas.width / 2, y: canvas.height / 2, active: prev.active, mass: prev.mass }))

    // ── Simulationszustand ───────────────────────────────────────────────────

    const circles: Circle[] = []
    const particles: Particle[] = []

    // 12-16 leuchtende Kreise erzeugen
    const circleCount = 14
    for (let i = 0; i < circleCount; i++) {
      const radius = rand(10, 20)
      const mass = radius * radius * 0.05 // Masse proportional zur Fläche
      const colorIdx = i % PARTICLE_COLORS.length
      circles.push({
        id: i,
        x: rand(radius * 2, canvas.width - radius * 2),
        y: rand(radius * 2, canvas.height - radius * 2),
        vx: rand(-80, 80),
        vy: rand(-80, 80),
        radius,
        mass,
        color: PARTICLE_COLORS[colorIdx],
        glowColor: PARTICLE_COLORS[colorIdx],
      })
    }

    // ── Hilfsfunktionen ──────────────────────────────────────────────────────

    function rand(min: number, max: number) {
      return min + Math.random() * (max - min)
    }

    // Partikel-Explosion erzeugen bei Kollision
    function createExplosion(x: number, y: number, count: number, baseColor: string) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = rand(40, 160)
        const maxLife = rand(30, 60)
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: baseColor,
          alpha: 1.0,
          life: maxLife,
          maxLife,
          size: rand(1.5, 3.5),
        })
      }
    }

    // ── Maus- / Touch-Interaktionen ──────────────────────────────────────────

    const updateAttractorFromEvent = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      let clientX = 0
      let clientY = 0

      if (window.TouchEvent && e instanceof TouchEvent) {
        if (e.touches.length > 0) {
          clientX = e.touches[0].clientX
          clientY = e.touches[0].clientY
        } else {
          return
        }
      } else {
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
      }

      const x = clientX - rect.left
      const y = clientY - rect.top
      setAttractor(prev => ({ ...prev, x, y }))
    }

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      updateAttractorFromEvent(e)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      updateAttractorFromEvent(e)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
    }

    const onTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true
      updateAttractorFromEvent(e)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      updateAttractorFromEvent(e)
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onMouseUp)

    // Attraktor-Position als Ref halten, um Rerender-Verzögerung im Loop zu umgehen
    const attrPosRef = useRef({ x: 150, y: 150, active: true, mass: 6.0 })
    attrPosRef.current = { x: canvas.width / 2, y: canvas.height / 2, active: true, mass: 6.0 }

    // ── Haupt-Simulations- und Renderloop ────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.05) // Cap auf max 50ms (20fps)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // Synchronisiere Attraktor-Ref mit React-State
      // (State wird durch User-Klicks aktualisiert)
      // Falls noch nicht initialisiert, zentrieren
      const attrX = attrPosRef.current.x
      const attrY = attrPosRef.current.y
      const attrActive = attrPosRef.current.active
      const attrMass = attrPosRef.current.mass

      // 1. ANZAHL DER KREISE AKTUALISIEREN & BEWEGUNG SIMULIEREN
      circles.forEach(c => {
        // Anziehungskraft zum Attraktor (Gravitation)
        if (attrActive) {
          const dx = attrX - c.x
          const dy = attrY - c.y
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)

          if (dist > 1.0) {
            // Gravitationskraft-Gleichung mit Softening, um Singularität bei r->0 zu vermeiden
            const softening = 400
            const force = (attrMass * 400000 * c.mass) / (distSq + softening)
            const accel = force / c.mass

            c.vx += (dx / dist) * accel * dt
            c.vy += (dy / dist) * accel * dt
          }
        }

        // Einfache Reibung (Dämpfung)
        c.vx *= 0.994
        c.vy *= 0.994

        // Positionen aktualisieren
        c.x += c.vx * dt
        c.y += c.vy * dt

        // Kollisionen mit Wand auflösen
        const elasticity = 0.92
        if (c.x - c.radius < 0) {
          c.x = c.radius
          c.vx = -c.vx * elasticity
        } else if (c.x + c.radius > W) {
          c.x = W - c.radius
          c.vx = -c.vx * elasticity
        }

        if (c.y - c.radius < 0) {
          c.y = c.radius
          c.vy = -c.vy * elasticity
        } else if (c.y + c.radius > H) {
          c.y = H - c.radius
          c.vy = -c.vy * elasticity
        }
      })

      // 2. KREIS-KREIS-KOLLISIONEN (Elastisch)
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const c1 = circles[i]
          const c2 = circles[j]

          const dx = c2.x - c1.x
          const dy = c2.y - c1.y
          const distSq = dx * dx + dy * dy
          const minDist = c1.radius + c2.radius

          if (distSq < minDist * minDist) {
            // Kollisionsachse ermitteln
            const dist = Math.sqrt(distSq)
            const nx = dx / (dist || 0.001)
            const ny = dy / (dist || 0.001)

            // A. Statische Auflösung (Overlap korrigieren)
            const overlap = minDist - dist
            const totalMass = c1.mass + c2.mass
            
            c1.x -= nx * overlap * (c2.mass / totalMass)
            c1.y -= ny * overlap * (c2.mass / totalMass)
            c2.x += nx * overlap * (c1.mass / totalMass)
            c2.y += ny * overlap * (c1.mass / totalMass)

            // B. Elastischer Stoß (Impulserhaltung)
            // Relative Geschwindigkeit
            const kx = c1.vx - c2.vx
            const ky = c1.vy - c2.vy
            
            // Relativgeschwindigkeit projiziert auf Kollisionsnormale
            const velAlongNormal = kx * nx + ky * ny

            // Nur aufeinander zubewegen
            if (velAlongNormal > 0) {
              const restitution = 0.98
              const impulseScalar = (1 + restitution) * velAlongNormal / (1 / c1.mass + 1 / c2.mass)

              c1.vx -= nx * impulseScalar / c1.mass
              c1.vy -= ny * impulseScalar / c1.mass
              c2.vx += nx * impulseScalar / c2.mass
              c2.vy += ny * impulseScalar / c2.mass

              // C. Partikeleffekte erzeugen (Kollisionspunkt)
              const collisionX = c1.x + nx * c1.radius
              const collisionY = c1.y + ny * c1.radius
              
              // Anzahl Funken proportional zur Aufprallenergie
              const impactEnergy = Math.abs(velAlongNormal)
              const particleCount = Math.min(10, Math.max(3, Math.round(impactEnergy * 0.05)))
              const baseColor = Math.random() < 0.5 ? c1.color : c2.color
              createExplosion(collisionX, collisionY, particleCount, baseColor)
            }
          }
        }
      }

      // 3. PARTIKEL BEWEGEN & FADEN
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life--

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        // Partikel fallen unter leichter Schwerkraft nach unten
        p.vy += 65.0 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.alpha = p.life / p.maxLife
      }

      // ── RENDERING ──────────────────────────────────────────────────────────

      // Hintergrund
      ctx.fillStyle = '#020409'
      ctx.fillRect(0, 0, W, H)

      // A. Gravitation-Grid Warping (Raumzeit-Krümmungsgitter um Attraktor)
      ctx.lineWidth = 0.7
      const pullRange = 120 // Radius der gravitativen Verzerrung
      
      // Horizontale Linien
      for (let gy = 20; gy < H; gy += 25) {
        ctx.beginPath()
        for (let gx = 0; gx <= W; gx += 10) {
          const dx = attrX - gx
          const dy = attrY - gy
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)
          
          let px = gx
          let py = gy
          
          if (attrActive && dist < pullRange) {
            // Verzerrung zum Zentrum
            const warpFactor = Math.pow((pullRange - dist) / pullRange, 1.8) * 35.0
            px += (dx / (dist + 0.001)) * warpFactor
            py += (dy / (dist + 0.001)) * warpFactor
          }

          if (gx === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = `rgba(0, 150, 255, ${attrActive ? 0.06 : 0.03})`
        ctx.stroke()
      }

      // Vertikale Linien
      for (let gx = 20; gx < W; gx += 25) {
        ctx.beginPath()
        for (let gy = 0; gy <= H; gy += 10) {
          const dx = attrX - gx
          const dy = attrY - gy
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)

          let px = gx
          let py = gy

          if (attrActive && dist < pullRange) {
            const warpFactor = Math.pow((pullRange - dist) / pullRange, 1.8) * 35.0
            px += (dx / (dist + 0.001)) * warpFactor
            py += (dy / (dist + 0.001)) * warpFactor
          }

          if (gy === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = `rgba(0, 150, 255, ${attrActive ? 0.06 : 0.03})`
        ctx.stroke()
      }

      // B. Attraktor (Gravitations-Singularität) zeichnen
      if (attrActive) {
        ctx.save()
        // Äußerer Schein
        const pulse = 1.0 + Math.sin(t * 0.008) * 0.15
        const radGrad = ctx.createRadialGradient(attrX, attrY, 0, attrX, attrY, 35 * pulse)
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        radGrad.addColorStop(0.2, 'rgba(0, 230, 255, 0.7)')
        radGrad.addColorStop(0.5, 'rgba(0, 80, 255, 0.28)')
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)')

        ctx.fillStyle = radGrad
        ctx.beginPath()
        ctx.arc(attrX, attrY, 35 * pulse, 0, Math.PI * 2)
        ctx.fill()

        // Innerer Kern (Schwarzes Loch Ästhetik)
        ctx.fillStyle = '#000000'
        ctx.strokeStyle = '#00f0ff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(attrX, attrY, 6 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }

      // C. Kreise zeichnen (mit leichtem Glow)
      circles.forEach(c => {
        ctx.save()
        ctx.fillStyle = c.color
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 0.8

        ctx.shadowColor = c.glowColor
        ctx.shadowBlur = 12

        ctx.beginPath()
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()

        // Kleiner innerer 3D Glanz-Reflex
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
        ctx.beginPath()
        ctx.arc(c.x - c.radius * 0.3, c.y - c.radius * 0.3, c.radius * 0.22, 0, Math.PI * 2)
        ctx.fill()
      })

      // D. Partikel/Funken zeichnen
      particles.forEach(p => {
        ctx.save()
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        
        ctx.shadowColor = p.color
        ctx.shadowBlur = 4

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // E. HUD Text
      ctx.fillStyle = 'rgba(0, 190, 255, 0.75)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`ACTIVE BODIES : ${circles.length}`, 10, 20)
      ctx.fillText(`COLLISION RES : ELASTIC (100%)`, 10, 32)
      ctx.fillText(`PARTICLES    : ${particles.length}`, 10, 44)
      ctx.fillText(`GRAVITY WELL : ${attrActive ? 'ACTIVE (DRAGGABLE)' : 'OFF'}`, 10, 56)

      ctx.textAlign = 'right'
      ctx.fillText('SYS: PHYSICS SANDBOX 2D', W - 10, 20)
      ctx.fillText(`FIELD: ${W}px x ${H}px`, W - 10, 32)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    // Mouse Move und Drag Listener synchronisieren
    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      attrPosRef.current = { ...attrPosRef.current, x, y }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      const rect = canvas.getBoundingClientRect()
      if (e.touches.length > 0) {
        const x = e.touches[0].clientX - rect.left
        const y = e.touches[0].clientY - rect.top
        attrPosRef.current = { ...attrPosRef.current, x, y }
      }
    }

    const handleStart = (e: MouseEvent) => {
      isDraggingRef.current = true
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      attrPosRef.current = { ...attrPosRef.current, x, y }
      setAttractor(prev => ({ ...prev, x, y }))
    }

    const handleTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true
      const rect = canvas.getBoundingClientRect()
      if (e.touches.length > 0) {
        const x = e.touches[0].clientX - rect.left
        const y = e.touches[0].clientY - rect.top
        attrPosRef.current = { ...attrPosRef.current, x, y }
        setAttractor(prev => ({ ...prev, x, y }))
      }
    }

    canvas.addEventListener('mousedown', handleStart)
    window.addEventListener('mousemove', handleMove)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      canvas.removeEventListener('mousedown', handleStart)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', onMouseUp)
    }
  }, [attractor.active, attractor.mass])

  return (
    <Panel title="QUANTUM GRAVITY // PHYSICS SANDBOX">
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        />
        {/* Schwebender Umschalter für Schwerkraft-Intensität */}
        <div className="absolute bottom-2 right-2 flex space-x-1.5 z-10 font-mono text-[9px] bg-black/60 border border-blue-900/60 p-1 rounded">
          <button
            onClick={() => setAttractor(prev => ({ ...prev, active: !prev.active }))}
            className={`px-1.5 py-0.5 rounded border transition-colors ${attractor.active ? 'bg-cyan-950 text-cyan-400 border-cyan-700' : 'bg-black text-gray-600 border-gray-800'}`}
          >
            WELL: {attractor.active ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setAttractor(prev => ({ ...prev, mass: prev.mass === 2.5 ? 6.0 : (prev.mass === 6.0 ? 12.0 : 2.5) }))}
            className="px-1.5 py-0.5 rounded border border-blue-900 text-blue-400 hover:bg-blue-950/40"
            disabled={!attractor.active}
          >
            G-PULL: {attractor.mass === 2.5 ? 'WEAK' : (attractor.mass === 6.0 ? 'MID' : 'STRONG')}
          </button>
        </div>
      </div>
    </Panel>
  )
}

export default memo(PhysicsSandboxPanel)
