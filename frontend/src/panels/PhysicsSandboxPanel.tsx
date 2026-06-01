import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// Frame-Loop laeuft ueber den zentralen raf-coordinator (siehe AUDIT_FINDINGS.md H-05).

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
  // ── Energieaufbau-Mechanik ───────────────────────────────────────────────
  // "energy" steigt, solange diese Kugel dicht von Nachbarn umgeben ist, und
  // faellt wieder, sobald sie frei steht. Erreicht sie die Entlade-Schwelle,
  // wird die Kugel (samt naher Nachbarn) explosiv nach aussen geschleudert.
  energy: number
  // Pro Kugel leicht zufaellige Entlade-Schwelle -> sorgt fuer Varianz, damit
  // nicht alle Kugeln synchron im selben Frame entladen.
  dischargeThreshold: number
  // Kurzer Cooldown direkt nach einer Entladung. Verhindert, dass eine gerade
  // entladene (und noch nah an anderen liegende) Kugel sofort wieder auflaedt.
  dischargeCooldown: number
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
  
  // Use a ref to prevent useEffect from restarting the simulation when well settings change
  const attractorRef = useRef(attractor)
  attractorRef.current = attractor

  useEffect(() => {
    const _canvas = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx

    // Cleanup-Funktion vom raf-coordinator
    let unsubscribe: (() => void) | null = null
    let alive = true
    // Flag, damit der erste Frame den lastT-Wert frisch setzt (kein 1.-Frame-Sprung)
    let firstFrame = true

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
    
    // Core stability tracking
    let overloadTime = 0.0
    let showDischargePulse = false
    let dischargeRingRadius = 0.0
    let dischargeRingAlpha = 0.0

    // ── Zustand der Energieaufbau-/Entlade-Mechanik ────────────────────────────
    // Spannungslinien, die in diesem Frame zwischen nahen Kugeln gezeichnet
    // werden. Wird pro Frame neu befuellt (kein Speicher-Wachstum). "load" ist
    // 0..1 und bestimmt Helligkeit/Dicke der Linie (wie stark "geladen").
    interface TensionLine { x1: number; y1: number; x2: number; y2: number; load: number }
    const tensionLines: TensionLine[] = []
    // Lokale Entlade-Schockwellen (eine pro Kugel-Entladung), rein visuell.
    interface Shock { x: number; y: number; radius: number; alpha: number; color: string }
    const shocks: Shock[] = []

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
        // Energie startet leer; Schwelle bekommt pro Kugel etwas Streuung.
        energy: 0,
        dischargeThreshold: rand(2.2, 3.4),
        dischargeCooldown: 0,
      })
    }

    // ── Parameter der Energieaufbau-/Entlade-Mechanik ──────────────────────────
    // Abstand (Mittelpunkt zu Mittelpunkt, in Pixel), bis zu dem zwei Kugeln als
    // "dicht beieinander" zaehlen. Innerhalb dieser Reichweite laedt sich Energie
    // auf und es wird ein Spannungsfeld (Linie) zwischen den Kugeln gezeichnet.
    const PROXIMITY_RANGE = 70
    // Wie schnell Energie pro Sekunde und pro nahem Nachbarn steigt.
    const ENERGY_GAIN_PER_NEIGHBOR = 0.9
    // Wie schnell Energie zerfaellt, wenn eine Kugel frei steht (pro Sekunde).
    const ENERGY_DECAY = 1.1
    // Cooldown-Dauer nach einer Entladung (in Sekunden).
    const DISCHARGE_COOLDOWN = 0.6

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
      attrPosRef.current = { ...attrPosRef.current, x, y }
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
    const attrPosRef = { current: { x: canvas.width / 2, y: canvas.height / 2 } }

    // ── Haupt-Simulations- und Renderloop ────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      // Erster Frame nach Subscribe: lastT initialisieren, damit dt nicht riesig wird
      if (firstFrame) { lastT = t; firstFrame = false }

      const dt = Math.min((t - lastT) / 1000, 0.05) // Cap auf max 50ms (20fps)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      const attrX = attrPosRef.current.x
      const attrY = attrPosRef.current.y
      
      // Read dynamic values from sync ref instead of trigger useEffect rebuilds
      const attrActive = attractorRef.current.active
      const attrMass = attractorRef.current.mass

      // Environment physical coefficients (No gravity -> frictionless floating gas)
      const friction = attrActive ? 0.994 : 1.0
      const wallElasticity = attrActive ? 0.92 : 1.0
      const ballRestitution = attrActive ? 0.98 : 1.0

      // Overload check: count bodies close to attractor
      if (attrActive) {
        let closeCount = 0
        circles.forEach(c => {
          const dx = attrX - c.x
          const dy = attrY - c.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 60) {
            closeCount++
          }
        })

        if (closeCount >= Math.floor(circles.length * 0.72)) {
          overloadTime += dt
        } else {
          overloadTime = Math.max(0.0, overloadTime - dt * 0.5) // Decay overload
        }

        if (overloadTime > 1.5) {
          // Trigger core quantum discharge explosion!
          overloadTime = 0.0
          showDischargePulse = true
          dischargeRingRadius = 0.0
          dischargeRingAlpha = 1.0

          // Fling bodies away from core
          circles.forEach(c => {
            const dx = c.x - attrX
            const dy = c.y - attrY
            const dist = Math.sqrt(dx * dx + dy * dy) || 1.0
            const force = rand(350, 520)
            c.vx = (dx / dist) * force
            c.vy = (dy / dist) * force
          })

          createExplosion(attrX, attrY, 45, '#ff9900')
          createExplosion(attrX, attrY, 25, '#00f0ff')
        }
      } else {
        overloadTime = 0.0
      }

      // Progress core discharge ring visual
      if (showDischargePulse) {
        dischargeRingRadius += 480 * dt
        dischargeRingAlpha -= dt * 1.3
        if (dischargeRingAlpha <= 0) {
          showDischargePulse = false
        }
      }

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

        // Dämpfung (friction is 1.0 when active well is OFF)
        c.vx *= friction
        c.vy *= friction

        // Positionen aktualisieren
        c.x += c.vx * dt
        c.y += c.vy * dt

        // Kollisionen mit Wand auflösen
        if (c.x - c.radius < 0) {
          c.x = c.radius
          c.vx = -c.vx * wallElasticity
        } else if (c.x + c.radius > W) {
          c.x = W - c.radius
          c.vx = -c.vx * wallElasticity
        }

        if (c.y - c.radius < 0) {
          c.y = c.radius
          c.vy = -c.vy * wallElasticity
        } else if (c.y + c.radius > H) {
          c.y = H - c.radius
          c.vy = -c.vy * wallElasticity
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
            const kx = c1.vx - c2.vx
            const ky = c1.vy - c2.vy
            
            const velAlongNormal = kx * nx + ky * ny

            // Nur aufeinander zubewegen
            if (velAlongNormal > 0) {
              const impulseScalar = (1 + ballRestitution) * velAlongNormal / (1 / c1.mass + 1 / c2.mass)

              c1.vx -= nx * impulseScalar / c1.mass
              c1.vy -= ny * impulseScalar / c1.mass
              c2.vx += nx * impulseScalar / c2.mass
              c2.vy += ny * impulseScalar / c2.mass

              // C. Partikeleffekte erzeugen (Kollisionspunkt)
              const collisionX = c1.x + nx * c1.radius
              const collisionY = c1.y + ny * c1.radius
              
              const impactEnergy = Math.abs(velAlongNormal)
              const particleCount = Math.min(10, Math.max(3, Math.round(impactEnergy * 0.05)))
              const baseColor = Math.random() < 0.5 ? c1.color : c2.color
              createExplosion(collisionX, collisionY, particleCount, baseColor)
            }
          }
        }
      }

      // 2b. ENERGIEAUFBAU BEI DICHTEM GEDRAENGE + SCHLAGARTIGE ENTLADUNG
      //
      // Idee: Solange eine Kugel von nahen Nachbarn umgeben ist, laedt sich ihre
      // "energy" auf. Steht sie frei, faellt die Energie wieder ab. Ueberschreitet
      // die Energie ihre (zufaellig gestreute) Schwelle, entlaedt sie sich: die
      // Kugel und alle nahen Nachbarn werden radial nach aussen geschleudert.
      // So entsteht ein wiederkehrender Zyklus aus Verdichtung und Explosion.

      // Spannungslinien-Puffer fuer dieses Frame leeren (kein Wachstum ueber Zeit).
      tensionLines.length = 0

      // Pro Kugel zaehlen wir nahe Nachbarn und merken uns den dichtesten Druck,
      // um daraus die Energie-Aufladerate abzuleiten.
      const neighborCount = new Float32Array(circles.length)

      const proxRangeSq = PROXIMITY_RANGE * PROXIMITY_RANGE

      // Alle Paare einmal durchgehen (gleiche O(n^2)-Struktur wie die Kollision,
      // bei ~14 Kugeln voellig unkritisch). Nahe Paare erzeugen Energiezuwachs
      // und eine sichtbare Spannungslinie.
      for (let i = 0; i < circles.length; i++) {
        const c1 = circles[i]
        for (let j = i + 1; j < circles.length; j++) {
          const c2 = circles[j]
          const dx = c2.x - c1.x
          const dy = c2.y - c1.y
          const dSq = dx * dx + dy * dy
          if (dSq < proxRangeSq) {
            const dist = Math.sqrt(dSq) || 0.001
            // "closeness" 0..1: 1 = quasi beruehrend, 0 = am Rand der Reichweite.
            const closeness = 1 - dist / PROXIMITY_RANGE
            // Beide Kugeln spueren den Druck dieses nahen Nachbarn.
            neighborCount[i] += closeness
            neighborCount[j] += closeness

            // Spannungslinie nur fuer wirklich relevante Naehe sammeln und nur,
            // wenn mindestens eine der beiden Kugeln schon etwas geladen ist ->
            // spart Linien bei lockerem Vorbeiflug und macht das "Laden" sichtbar.
            const load = Math.min(1, (c1.energy + c2.energy) / (c1.dischargeThreshold + c2.dischargeThreshold))
            if (closeness > 0.15 && load > 0.05) {
              tensionLines.push({ x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, load: load * closeness })
            }
          }
        }
      }

      // Energie pro Kugel aktualisieren und ggf. entladen.
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]

        // Cooldown nach einer frischen Entladung herunterzaehlen.
        if (c.dischargeCooldown > 0) {
          c.dischargeCooldown = Math.max(0, c.dischargeCooldown - dt)
        }

        const pressure = neighborCount[i]
        if (pressure > 0.4 && c.dischargeCooldown <= 0) {
          // Dicht umgeben -> Energie steigt, skaliert mit dem Nachbar-Druck.
          c.energy += ENERGY_GAIN_PER_NEIGHBOR * pressure * dt
        } else {
          // Frei stehend -> Energie zerfaellt langsam wieder.
          c.energy = Math.max(0, c.energy - ENERGY_DECAY * dt)
        }

        // Schwelle erreicht? -> schlagartige Entladung.
        if (c.energy >= c.dischargeThreshold) {
          // Energie der entladenden Kugel zuruecksetzen + kurzer Cooldown.
          c.energy = 0
          c.dischargeCooldown = DISCHARGE_COOLDOWN

          // Etwas Varianz in der Wucht, damit Entladungen nicht uniform wirken.
          const blast = rand(260, 420)

          // Alle nahen Nachbarn radial vom Entlade-Zentrum wegschleudern.
          for (let k = 0; k < circles.length; k++) {
            if (k === i) continue
            const o = circles[k]
            const dx = o.x - c.x
            const dy = o.y - c.y
            const dSq = dx * dx + dy * dy
            if (dSq < proxRangeSq) {
              const dist = Math.sqrt(dSq) || 0.001
              // Naehere Kugeln bekommen mehr Impuls (linearer Abfall mit Distanz).
              const falloff = 1 - dist / PROXIMITY_RANGE
              const push = blast * falloff
              o.vx += (dx / dist) * push
              o.vy += (dy / dist) * push
              // Nachbarn verlieren beim Stoss einen Teil ihrer eigenen Ladung,
              // damit eine Entladung den lokalen Cluster wirklich "entspannt".
              o.energy *= 0.4
            }
          }

          // Die entladende Kugel selbst bekommt einen leichten Rueckstoss in eine
          // zufaellige Richtung (Impulserhaltung nur grob angedeutet, rein optisch).
          const recoilAngle = Math.random() * Math.PI * 2
          c.vx += Math.cos(recoilAngle) * blast * 0.3
          c.vy += Math.sin(recoilAngle) * blast * 0.3

          // Visuelle Effekte: Funken-Explosion + expandierende Schockwelle.
          createExplosion(c.x, c.y, 22, c.glowColor)
          createExplosion(c.x, c.y, 10, '#ffffff')
          shocks.push({ x: c.x, y: c.y, radius: c.radius, alpha: 0.9, color: c.glowColor })
        }
      }

      // Lokale Schockwellen weiterbewegen und ausblenden (von hinten nach vorne
      // iterieren, damit das Entfernen per splice die Indizes nicht durcheinander
      // bringt).
      for (let i = shocks.length - 1; i >= 0; i--) {
        const s = shocks[i]
        s.radius += 260 * dt
        s.alpha -= dt * 2.0
        if (s.alpha <= 0 || s.radius > PROXIMITY_RANGE * 1.6) {
          shocks.splice(i, 1)
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

        // Partikel fallen unter Schwerkraft wenn well active ist
        p.vy += (attrActive ? 65.0 : 5.0) * dt
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

      // Quantum discharge blast wave ring
      if (showDischargePulse && dischargeRingAlpha > 0) {
        ctx.save()
        ctx.strokeStyle = `rgba(0, 240, 255, ${dischargeRingAlpha})`
        ctx.lineWidth = 3
        ctx.shadowColor = '#00f0ff'
        ctx.shadowBlur = 15
        ctx.beginPath()
        ctx.arc(attrX, attrY, dischargeRingRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // B2. SPANNUNGSFELD zwischen nahen, geladenen Kugeln zeichnen.
      // Die Linien werden mit additivem Blending (lighter) gezeichnet, damit sich
      // ueberlappende Felder hell aufaddieren -> "elektrisches" Glimmen.
      if (tensionLines.length > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        tensionLines.forEach(l => {
          // Je staerker geladen, desto heller (cyan -> weiss) und dicker.
          const a = Math.min(0.85, l.load * 0.85)
          const g = Math.round(160 + l.load * 95) // Gruenanteil steigt -> Richtung Weiss
          ctx.strokeStyle = `rgba(120, ${g}, 255, ${a})`
          ctx.lineWidth = 0.6 + l.load * 2.2
          ctx.shadowColor = '#66ccff'
          ctx.shadowBlur = 6 + l.load * 10
          ctx.beginPath()
          ctx.moveTo(l.x1, l.y1)
          ctx.lineTo(l.x2, l.y2)
          ctx.stroke()
        })
        ctx.restore()
      }

      // B3. Lokale Entlade-Schockwellen (Ringe) zeichnen.
      if (shocks.length > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        shocks.forEach(s => {
          ctx.strokeStyle = s.color
          ctx.globalAlpha = Math.max(0, s.alpha)
          ctx.lineWidth = 2.5
          ctx.shadowColor = s.color
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
          ctx.stroke()
        })
        ctx.restore()
      }

      // C. Kreise zeichnen (mit leichtem Glow)
      circles.forEach(c => {
        // Auflade-Anteil 0..1 dieser Kugel: steuert ein zusaetzliches Glimmen,
        // das die aufgebaute Energie sichtbar macht (je voller, desto heisser).
        const charge = Math.min(1, c.energy / c.dischargeThreshold)
        if (charge > 0.04) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          // Pulsieren wird mit steigender Ladung schneller und kraeftiger -> der
          // Effekt wirkt "kurz vor der Entladung" zunehmend nervoes/instabil.
          const pulse = 0.65 + 0.35 * Math.sin(t * (0.004 + charge * 0.02))
          const auraR = c.radius * (1.6 + charge * 1.8)
          const grad = ctx.createRadialGradient(c.x, c.y, c.radius * 0.4, c.x, c.y, auraR)
          // Von warmem Weiss (heiss geladen) ueber die Glow-Farbe nach transparent.
          grad.addColorStop(0, `rgba(255, 255, 255, ${0.5 * charge * pulse})`)
          grad.addColorStop(0.4, `rgba(180, 230, 255, ${0.45 * charge * pulse})`)
          grad.addColorStop(1, 'rgba(120, 200, 255, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(c.x, c.y, auraR, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

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
      ctx.fillText(`COLLISION RES : ELASTIC (${Math.round(ballRestitution * 100)}%)`, 10, 32)
      ctx.fillText(`PARTICLES    : ${particles.length}`, 10, 44)
      ctx.fillText(`GRAVITY WELL : ${attrActive ? 'ACTIVE (DRAGGABLE)' : 'OFF'}`, 10, 56)
      if (attrActive) {
        const pct = Math.min(100, Math.round((overloadTime / 1.5) * 100))
        ctx.fillStyle = pct > 75 ? 'rgba(255, 50, 80, 0.95)' : 'rgba(0, 190, 255, 0.75)'
        ctx.fillText(`CORE STABILITY: ${100 - pct}% ${pct > 75 ? '// WARNING OVERLOAD' : ''}`, 10, 68)
      } else {
        ctx.fillText(`ENVIRONMENT  : ZERO-G FLOAT`, 10, 68)
      }

      // Hoechste aktuelle Aufladung im Feld als Balken-Anzeige.
      let peakCharge = 0
      for (let i = 0; i < circles.length; i++) {
        const ch = circles[i].energy / circles[i].dischargeThreshold
        if (ch > peakCharge) peakCharge = ch
      }
      const peakPct = Math.min(100, Math.round(peakCharge * 100))
      ctx.fillStyle = peakPct > 80 ? 'rgba(255, 220, 120, 0.95)' : 'rgba(0, 190, 255, 0.75)'
      ctx.fillText(`CLUSTER CHARGE: ${peakPct}% ${peakPct > 80 ? '// DISCHARGE IMMINENT' : ''}`, 10, 80)

      ctx.textAlign = 'right'
      ctx.fillText('SYS: PHYSICS SANDBOX 2D', W - 10, 20)
      ctx.fillText(`FIELD: ${W}px x ${H}px`, W - 10, 32)
    }

    // Beim zentralen raf-coordinator anmelden
    unsubscribe = subscribe(loop)

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
      if (unsubscribe) unsubscribe()
      ro.disconnect()
      canvas.removeEventListener('mousedown', handleStart)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', onMouseUp)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, []) // Empty dependency array -> effect runs exactly once on mount, no resets!

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
