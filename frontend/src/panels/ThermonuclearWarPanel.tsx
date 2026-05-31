import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'
import { VECTOR_EARTH } from '../utils/vector-earth'

// Frame-Loop laeuft ueber den zentralen raf-coordinator (siehe AUDIT_FINDINGS.md H-05).

interface City {
  name: string
  x: number // Percentual 0..1
  y: number // Percentual 0..1
  side: 'west' | 'east'
  isDestroyed: boolean
  destroyedTime: number
}

interface Missile {
  id: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  fromName: string
  toName: string
  progress: number // 0..1
  speed: number
  active: boolean
  trail: { x: number; y: number }[]
  type: 'icbm' | 'abm' // icbm = offensive, abm = defensive interceptor
  targetMissile?: Missile // target for ABMs
  color: string
}

interface ImpactRipple {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
  color: string
  yieldText?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  color: string
}

// ── Ziel-Standorte auf der Weltkarte ──────────────────────────────────────
// x/y sind prozentuale Positionen (0..1) auf der Karte (Plate-Carrée / lineare lon/lat-Projektion).
// 'side' teilt die Standorte in zwei verfeindete Blöcke ('west'/'east') für den Schlagabtausch.
// Labels bewusst KURZ und in normaler Groß-/Kleinschreibung (kein ALLCAPS), damit sie gut lesbar bleiben.
const CITIES: City[] = [
  // Westlicher Block
  { name: 'Washington', x: 0.286, y: 0.284, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'New York', x: 0.294, y: 0.274, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'Chicago', x: 0.257, y: 0.267, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'San Francisco', x: 0.160, y: 0.290, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'London', x: 0.499, y: 0.214, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'Paris', x: 0.506, y: 0.229, side: 'west', isDestroyed: false, destroyedTime: 0 },
  { name: 'Montana', x: 0.193, y: 0.240, side: 'west', isDestroyed: false, destroyedTime: 0 },
  // Indien sitzt geografisch zwischen den Blöcken, hier dem Westen zugeschlagen
  { name: 'New Delhi', x: 0.700, y: 0.330, side: 'west', isDestroyed: false, destroyedTime: 0 },
  // Östlicher Block
  { name: 'Moscow', x: 0.604, y: 0.190, side: 'east', isDestroyed: false, destroyedTime: 0 },
  { name: 'Beijing', x: 0.823, y: 0.278, side: 'east', isDestroyed: false, destroyedTime: 0 },
  { name: 'Tokyo', x: 0.888, y: 0.302, side: 'east', isDestroyed: false, destroyedTime: 0 },
  { name: 'Siberia', x: 0.790, y: 0.209, side: 'east', isDestroyed: false, destroyedTime: 0 },
  { name: 'Ural', x: 0.668, y: 0.184, side: 'east', isDestroyed: false, destroyedTime: 0 },
  // Neue Atommächte
  { name: 'Pyongyang', x: 0.852, y: 0.290, side: 'east', isDestroyed: false, destroyedTime: 0 },
  { name: 'Islamabad', x: 0.690, y: 0.300, side: 'east', isDestroyed: false, destroyedTime: 0 },
]

function ThermonuclearWarPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  // HUD state variables for visual readouts
  const [defcon, setDefcon] = useState(5)
  const [activeMissilesCount, setActiveMissilesCount] = useState(0)
  const [casualties, setCasualties] = useState(0)
  const [stageName, setStageName] = useState('PRE-LAUNCH DRILL')

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
    // Erster Frame nach Subscribe initialisiert lastT, damit dt nicht riesig wird
    let firstFrame = true

    // Using vector-earth coordinates directly in the rendering loop

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Simulation States (Refs for high performance rendering loop) ───────────────────
    const missilesRef = { current: [] as Missile[] }
    const ripplesRef = { current: [] as ImpactRipple[] }
    const particlesRef = { current: [] as Particle[] }
    
    let missileIdSeq = 0
    let simTime = 0.0
    let simStage = 0 // 0: Drill, 1: First Strike, 2: Retaliation, 3: Defensive ABMs, 4: Impact/Devastation, 5: Nuclear Winter
    let nextStageTimer = 6.0 // Sekunden
    let currentCasualties = 0
    let abmLaunchCooldown = 0.0

    // Reset simulation
    function resetSim() {
      missilesRef.current = []
      ripplesRef.current = []
      particlesRef.current = []
      currentCasualties = 0
      simStage = 0
      nextStageTimer = 6.0
      simTime = 0.0
      setDefcon(5)
      setCasualties(0)
      setStageName('Tactical drill')
      CITIES.forEach(c => {
        c.isDestroyed = false
        c.destroyedTime = 0
      })
      setLogs([
        `[${new Date().toTimeString().split(' ')[0]}] Global thermonuclear war simulation reinitialized.`,
        `[${new Date().toTimeString().split(' ')[0]}] Radar feed active. DEFCON 5 secure.`
      ])
    }

    const addLog = (text: string) => {
      const now = new Date()
      const timeStr = `[${now.toTimeString().split(' ')[0]}]`
      setLogs(prev => [ `${timeStr} ${text}`, ...prev.slice(0, 14) ])
    }

    // Trigger launch from side to target
    function triggerICBMLaunch(fromCity: City, toCity: City, W: number, H: number, delayOffset = 0) {
      const fromX = fromCity.x * W
      const fromY = fromCity.y * H
      const toX = toCity.x * W
      const toY = toCity.y * H

      missilesRef.current.push({
        id: missileIdSeq++,
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        fromName: fromCity.name,
        toName: toCity.name,
        progress: -delayOffset, // Negative progress allows delayed launches
        speed: 0.15 + Math.random() * 0.08,
        active: true,
        trail: [],
        type: 'icbm',
        color: 'rgba(244, 63, 94, 0.7)' // Desaturated rose/red arc
      })
    }

    // Launch interceptor ABM from a friendly city towards an incoming ICBM
    function triggerABMLaunch(friendlyCity: City, targetMissile: Missile, W: number, H: number) {
      const fromX = friendlyCity.x * W
      const fromY = friendlyCity.y * H

      missilesRef.current.push({
        id: missileIdSeq++,
        from: { x: fromX, y: fromY },
        to: { x: targetMissile.from.x, y: targetMissile.from.y }, // Track back or meet
        fromName: friendlyCity.name,
        toName: `ICBM INTERCEPTOR #${targetMissile.id}`,
        progress: 0,
        speed: 0.35 + Math.random() * 0.1, // ABMs fly much faster
        active: true,
        trail: [],
        type: 'abm',
        targetMissile: targetMissile,
        color: 'rgba(148, 163, 184, 0.75)' // Desaturated slate arc
      })
    }

    // Explode particles on interception or impact
    function spawnExplosion(x: number, y: number, count = 25, color = '#ff3344') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const spd = 20.0 + Math.random() * 120.0
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          alpha: 1.0,
          size: 1.5 + Math.random() * 2.5,
          color
        })
      }
    }

    resetSim()

    // ── Animations-Loop ──────────────────────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      // Erster Frame nach Subscribe: lastT initialisieren
      if (firstFrame) { lastT = t; firstFrame = false }

      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t
      simTime += dt

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) {
        return
      }

      // ── Simulation Stages State Machine ──────────────────────────────────────
      nextStageTimer -= dt
      if (nextStageTimer <= 0) {
        simStage = (simStage + 1) % 6
        if (simStage === 0) {
          resetSim()
        } else if (simStage === 1) {
          // FIRST STRIKE
          setDefcon(3)
          setStageName('First strike detected')
          nextStageTimer = 4.0
          addLog('Warning: thermal sensors detect multiple silo ignitions (east squadrons).')
          
          const eastLaunchers = CITIES.filter(c => c.side === 'east')
          const westTargets = CITIES.filter(c => c.side === 'west')
          
          // Launch 5 missiles immediately
          for (let i = 0; i < 5; i++) {
            const from = eastLaunchers[i % eastLaunchers.length]
            const to = westTargets[Math.floor(Math.random() * westTargets.length)]
            triggerICBMLaunch(from, to, W, H, i * 0.1)
          }

          // West Coast immediately fires defensive ABMs at 2 of them
          setTimeout(() => {
            if (!alive) return
            const activeICBMs = missilesRef.current.filter(m => m.type === 'icbm' && m.active)
            const westDefenders = CITIES.filter(c => c.side === 'west' && !c.isDestroyed)
            for (let i = 0; i < Math.min(activeICBMs.length, 2); i++) {
              const launcher = westDefenders[i % westDefenders.length]
              if (launcher) {
                triggerABMLaunch(launcher, activeICBMs[i], W, H)
              }
            }
          }, 300)
        } else if (simStage === 2) {
          // RETALIATION
          setDefcon(2)
          setStageName('Mass retaliation')
          nextStageTimer = 6.0
          addLog('Alert: DEFCON 2 enforced. Deploying full retaliatory response vector.')
          
          const east = CITIES.filter(c => c.side === 'east' && !c.isDestroyed)
          const west = CITIES.filter(c => c.side === 'west' && !c.isDestroyed)

          // West responds with 8 missiles
          west.forEach((from, idx) => {
            const target = east[idx % east.length]
            if (target) {
              triggerICBMLaunch(from, target, W, H, Math.random() * 0.2)
              triggerICBMLaunch(from, east[(idx + 1) % east.length], W, H, 0.2 + Math.random() * 0.2)
            }
          })
          
          // East sends secondary strike of 8 missiles
          east.forEach((from, idx) => {
            const target = west[idx % west.length]
            if (target) {
              triggerICBMLaunch(from, target, W, H, Math.random() * 0.2)
              triggerICBMLaunch(from, west[(idx + 1) % west.length], W, H, 0.2 + Math.random() * 0.2)
            }
          })
        } else if (simStage === 3) {
          // DEFENSIVE ENGAGEMENT (Launch interceptors)
          setDefcon(1)
          setStageName('Defensive engagement')
          nextStageTimer = 5.0
          addLog('ABM shield: threat level critical. Dispatching all remaining interceptors.')

          // Find active ICBMs in air
          const activeICBMs = missilesRef.current.filter(m => m.type === 'icbm' && m.progress > 0 && m.progress < 0.8)
          const friendlyCities = CITIES.filter(c => !c.isDestroyed)

          activeICBMs.forEach((icbm, idx) => {
            // Find opposite side launcher
            const targetCity = CITIES.find(c => Math.hypot(c.x * W - icbm.to.x, c.y * H - icbm.to.y) < 15)
            if (targetCity) {
              const defenders = friendlyCities.filter(c => c.side === targetCity.side)
              const launcher = defenders[idx % defenders.length]
              if (launcher) {
                triggerABMLaunch(launcher, icbm, W, H)
              }
            }
          })
        } else if (simStage === 4) {
          // CONFLICT DEVASTATION
          setStageName('Terminal impacts')
          nextStageTimer = 6.0
          addLog('Tactical data: extensive warhead entries and cratering detected.')
        } else if (simStage === 5) {
          // NUCLEAR WINTER / Aussterben — am Ende überlebt niemand.
          setStageName('Extinction')
          nextStageTimer = 8.0
          addLog('Climate model: global particulate intrusion exceeds 95%. Temp -35C.')

          // Endzustand: ALLE noch verbliebenen Standorte werden ausgelöscht,
          // damit es keinen "Gewinner" gibt — beide Seiten sind komplett zerstört.
          CITIES.forEach(c => {
            if (!c.isDestroyed) {
              c.isDestroyed = true
              c.destroyedTime = simTime * 1000 // grobe Zeitmarke (ms), nur fürs Blinken relevant
              // Kleine Resteinschläge auf der Karte sichtbar machen
              spawnExplosion(c.x * W, c.y * H, 30, '#e11d48')
              // ripplesRef.current direkt verwenden — die lokale Konstante `ripples`
              // wird erst weiter unten im Loop deklariert und ist hier noch nicht im Scope.
              ripplesRef.current.push({
                x: c.x * W,
                y: c.y * H,
                r: 0,
                maxR: 55,
                alpha: 1.0,
                color: 'rgba(244, 63, 94, 0.85)',
                yieldText: undefined,
              })
              currentCasualties += Math.floor(15 + Math.random() * 45)
            }
          })
          addLog('Conclusion: no survivors on either side. Simulation ended.')
        }
      }

      // Dynamic interceptor auto-launcher
      if (simStage >= 1 && simStage <= 4) {
        abmLaunchCooldown -= dt
        if (abmLaunchCooldown <= 0) {
          abmLaunchCooldown = 0.5 // Check/launch every 0.5 seconds
          
          const activeICBMs = missilesRef.current.filter(m => m.type === 'icbm' && m.progress > 0.15 && m.progress < 0.75)
          const targetedMissileIds = new Set(
            missilesRef.current
              .filter(m => m.type === 'abm' && m.targetMissile && m.targetMissile.active)
              .map(m => m.targetMissile!.id)
          )
          
          const untargetedICBMs = activeICBMs.filter(m => !targetedMissileIds.has(m.id))
          
          if (untargetedICBMs.length > 0) {
            const friendlyCities = CITIES.filter(c => !c.isDestroyed)
            const target = untargetedICBMs.sort((a, b) => b.progress - a.progress)[0]
            const targetCity = CITIES.find(c => Math.hypot(c.x * W - target.to.x, c.y * H - target.to.y) < 15)
            if (targetCity) {
              const defenders = friendlyCities.filter(c => c.side === targetCity.side)
              if (defenders.length > 0) {
                const launcher = defenders[Math.floor(Math.random() * defenders.length)]
                triggerABMLaunch(launcher, target, W, H)
                addLog(`Shield intercept: interceptor fired from ${launcher.name}.`)
              }
            }
          }
        }
      }

      // Update DEFCON values based on active stages
      if (simStage >= 4 && defcon !== 1) setDefcon(1)

      // ── ICBM & ABM Simulation ─────────────────────────────────────────────────
      const missiles = missilesRef.current
      const ripples = ripplesRef.current

      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i]
        if (!m.active) continue

        m.progress += m.speed * dt
        
        // Calculate curve path
        const p = Math.max(0.0, Math.min(1.0, m.progress))
        const t1 = 1 - p
        const t2 = p

        // Arch height proportional to distance
        const midX = (m.from.x + m.to.x) / 2
        let archH = Math.abs(m.from.x - m.to.x) * 0.35 + 50
        if (m.type === 'abm') archH *= 0.45 // ABM interceptors fly lower/straighter

        const midY = Math.min(m.from.y, m.to.y) - archH
        const px = t1 * t1 * m.from.x + 2 * t1 * t2 * midX + t2 * t2 * m.to.x
        const py = t1 * t1 * m.from.y + 2 * t1 * t2 * midY + t2 * t2 * m.to.y

        // Track trail
        if (m.progress >= 0) {
          m.trail.push({ x: px, y: py })
          if (m.trail.length > 25) m.trail.shift()
        }

        // Check ABM interception logic
        if (m.type === 'abm' && m.targetMissile) {
          const target = m.targetMissile
          if (!target.active) {
            // Target was already destroyed, self-destruct abm
            m.active = false
            missiles.splice(i, 1)
            continue
          }

          // Calculate current head pos for both
          const headABM = m.trail[m.trail.length - 1]
          const headICBM = target.trail[target.trail.length - 1]

          if (headABM && headICBM) {
            const dist = Math.hypot(headABM.x - headICBM.x, headABM.y - headICBM.y)
            if (dist < 12.0) {
              // Interception!
              m.active = false
              target.active = false
              
              spawnExplosion(headICBM.x, headICBM.y, 22, '#94a3b8')
              ripples.push({
                x: headICBM.x,
                y: headICBM.y,
                r: 0,
                maxR: 35,
                alpha: 1.0,
                color: 'rgba(148, 163, 184, 0.8)',
                yieldText: 'Intercept'
              })
              addLog('Intercept: ICBM threat neutralized by shield over sector.')
              
              // Remove both
              missiles.splice(i, 1)
              const tIdx = missiles.indexOf(target)
              if (tIdx > -1) missiles.splice(tIdx, 1)
              continue
            }
          }
        }

        // Impact logic
        if (m.progress >= 1.0) {
          m.active = false
          
          if (m.type === 'icbm') {
            // Find targeted city and destroy it
            const targetCity = CITIES.find(c => Math.hypot(c.x * W - m.to.x, c.y * H - m.to.y) < 15)
            if (targetCity) {
              targetCity.isDestroyed = true
              targetCity.destroyedTime = t
              addLog(`Impact: detonation confirmed over ${targetCity.name}.`)
            }

            // Spawn destructive explosion
            spawnExplosion(m.to.x, m.to.y, 45, '#e11d48')
            const yieldVal = 10 + Math.floor(Math.random() * 16)
            ripples.push({
              x: m.to.x,
              y: m.to.y,
              r: 0,
              maxR: 65,
              alpha: 1.0,
              color: 'rgba(244, 63, 94, 0.85)',
              yieldText: `${yieldVal} MT`
            })
            currentCasualties += Math.floor(15 + Math.random() * 45) // Millions
          }
          
          missiles.splice(i, 1)
        }
      }

      // Update active missile counter
      setActiveMissilesCount(missiles.filter(m => m.active && m.progress > 0).length)

      // ── Simulation Ripples ──────────────────────────────────────────────────
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.r += 75.0 * dt
        r.alpha = 1.0 - r.r / r.maxR
        if (r.r >= r.maxR) ripples.splice(i, 1)
      }

      // ── Particle Simulation ─────────────────────────────────────────────────
      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 85.0 * dt // Gravity pulling sparks down
        p.alpha -= dt * 1.3
        if (p.alpha <= 0) particles.splice(i, 1)
      }

      // Smoothly update casualty counter (in millions)
      if (casualties < currentCasualties) {
        setCasualties(curr => Math.min(currentCasualties, curr + Math.max(1, Math.round((currentCasualties - curr) * 0.1))))
      }

      // ── Drawing ────────────────────────────────────────────────────────────
      ctx.fillStyle = '#080c10' // Dark steel void
      ctx.fillRect(0, 0, W, H)

      // 1. Grid
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.05)'
      ctx.lineWidth = 0.5
      const gSize = 35
      ctx.beginPath()
      for (let x = 0; x < W; x += gSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H)
      }
      for (let y = 0; y < H; y += gSize) {
        ctx.moveTo(0, y); ctx.lineTo(W, y)
      }
      ctx.stroke()

      // 2. Blueprint Tactical vector map (infinitely sharp continent outlines)
      ctx.save()
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)' // Sleek slate-600 line
      ctx.lineWidth = 1.0
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)' // Subtle dark slate filled land
      
      VECTOR_EARTH.forEach(poly => {
        if (poly.length < 2) return
        ctx.beginPath()
        poly.forEach((pt, idx) => {
          const px = (pt.lon + 180) * (W / 360)
          const py = (90 - pt.lat) * (H / 180)
          if (idx === 0) {
            ctx.moveTo(px, py)
          } else {
            ctx.lineTo(px, py)
          }
        })
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      })
      ctx.restore()

      // 3. Expanding Detonation Ripples
      ripples.forEach(r => {
        ctx.save()
        ctx.strokeStyle = r.color
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
        
        ctx.fillStyle = r.color.replace('0.95', '0.07').replace('0.9', '0.07').replace('0.85', '0.07').replace('0.8', '0.07')
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * 0.7, 0, Math.PI * 2)
        ctx.fill()

        // Vector Crosshair at center
        ctx.strokeStyle = r.color
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(r.x - 4, r.y)
        ctx.lineTo(r.x + 4, r.y)
        ctx.moveTo(r.x, r.y - 4)
        ctx.lineTo(r.x, r.y + 4)
        ctx.stroke()

        // Yield/Intercept Labels
        if (r.yieldText) {
          ctx.fillStyle = r.color
          ctx.font = 'bold 10px monospace' // groesser + fett fuer bessere Lesbarkeit
          ctx.textAlign = 'center'
          ctx.fillText(r.yieldText, r.x, r.y - r.r - 4)
        }
        ctx.restore()
      })

      // 4. Missile Trails
      missiles.forEach(m => {
        if (m.trail.length < 2) return

        ctx.save()
        const head = m.trail[m.trail.length - 1]
        
        const grad = ctx.createLinearGradient(m.trail[0].x, m.trail[0].y, head.x, head.y)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, m.color)

        ctx.strokeStyle = grad
        ctx.lineWidth = m.type === 'abm' ? 1.0 : 1.6
        ctx.beginPath()
        ctx.moveTo(m.trail[0].x, m.trail[0].y)
        for (let j = 1; j < m.trail.length; j++) {
          ctx.lineTo(m.trail[j].x, m.trail[j].y)
        }
        ctx.stroke()

        // Glow head
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = m.type === 'abm' ? '#00ffff' : '#ff0033'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // 5. Fireball Sparks
      particles.forEach(p => {
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size)
      })
      ctx.globalAlpha = 1.0

      // 6. Draw City Targets (Launch points)
      CITIES.forEach(c => {
        const cx = c.x * W
        const cy = c.y * H

        if (c.isDestroyed) {
          // Blinkende Ziel-Markierung (rotes Kreuz im Kasten) fuer zerstoerte Standorte
          const blk = Math.floor(t / 250) % 2 === 0
          if (blk) {
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)'
            ctx.lineWidth = 1.2
            ctx.strokeRect(cx - 5, cy - 5, 10, 10)
            // Diagonales Kreuz im Kasten — markiert deutlich "ausgeloescht"
            ctx.beginPath()
            ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5)
            ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5)
            ctx.stroke()

            // Status-Text in normaler Schreibweise + dunkler Schatten fuer Kontrast
            ctx.font = 'bold 11px monospace'
            ctx.textAlign = cx > W / 2 ? 'right' : 'left'
            const tx = cx > W / 2 ? cx - 8 : cx + 8
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
            ctx.shadowBlur = 3
            ctx.fillStyle = '#fb7185'
            ctx.fillText('Lost', tx, cy - 3)
            ctx.shadowBlur = 0
          }
        } else {
          // Normal active city dot
          const pulse = 1.0 + Math.sin(t * 0.007 + cx) * 0.2
          ctx.strokeStyle = c.side === 'west' ? 'rgba(148, 163, 184, 0.5)' : 'rgba(110, 231, 183, 0.4)'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.arc(cx, cy, 4.5 * pulse, 0, Math.PI * 2)
          ctx.stroke()

          ctx.fillStyle = c.side === 'west' ? '#94a3b8' : '#6ee7b7'
          ctx.beginPath()
          ctx.arc(cx, cy, 2.0, 0, Math.PI * 2)
          ctx.fill()
        }

        // Ortsnamen zeichnen — groesser, mit dunklem Schatten fuer guten Kontrast auf der Karte
        ctx.save()
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = cx > W / 2 ? 'right' : 'left'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
        ctx.shadowBlur = 3
        ctx.fillStyle = c.isDestroyed ? 'rgba(248, 113, 113, 0.85)' : 'rgba(226, 232, 240, 0.95)'
        ctx.fillText(c.name, cx > W / 2 ? cx - 8 : cx + 8, cy + 9)
        ctx.restore()
      })

      // 7. Apocalypse Overlay (Static noise and frosty overlay in Stage 5)
      if (simStage === 5) {
        ctx.save()
        // Frosty tint
        ctx.fillStyle = `rgba(180, 220, 255, ${0.15 * Math.min(1.0, simTime % 11.0 / 2.0)})`
        ctx.fillRect(0, 0, W, H)

        // Static glitch lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
        ctx.lineWidth = 1.0
        for (let i = 0; i < 4; i++) {
          const sy = Math.random() * H
          ctx.beginPath()
          ctx.moveTo(0, sy)
          ctx.lineTo(W, sy)
          ctx.stroke()
        }
        ctx.restore()

        // Blinking Core Message
        const blink = Math.floor(t / 400) % 2 === 0
        if (blink) {
          ctx.save()
          ctx.textAlign = 'center'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'
          ctx.shadowBlur = 4
          // Kernbotschaft: niemand hat ueberlebt, es gibt keinen Gewinner
          ctx.fillStyle = 'rgba(251, 113, 133, 0.95)'
          ctx.font = 'bold 16px monospace'
          ctx.fillText('No winners — extinction threshold reached', W / 2, H * 0.48)
          // WarGames-Zitat
          ctx.font = 'bold 11px monospace'
          ctx.fillStyle = '#6ee7b7'
          ctx.fillText('A strange game. The only winning move is not to play.', W / 2, H * 0.53)
          ctx.restore()
        }
      }

      // 8. Titel-HUD zeichnen — groessere, fette Schrift mit dunklem Schatten fuer Kontrast.
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
      ctx.shadowBlur = 3
      ctx.textAlign = 'left'

      ctx.fillStyle = 'rgba(251, 113, 133, 0.95)'
      ctx.font = 'bold 13px monospace'
      ctx.fillText(`Tactical alert: DEFCON ${defcon}`, 12, 24)

      ctx.fillStyle = 'rgba(226, 232, 240, 0.92)'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(`Status   : ${stageName}`, 12, 42)
      ctx.fillText(`Airborne : ${activeMissilesCount} ICBM`, 12, 57)
      ctx.fillText(`Casualties: ${casualties} million`, 12, 72)

      ctx.textAlign = 'right'
      ctx.fillText('Global defense // WOPR', W - 12, 24)
      ctx.fillText(`Sim time : ${simTime.toFixed(1)}s`, W - 12, 42)
      ctx.restore()
    }

    // Beim zentralen raf-coordinator anmelden
    unsubscribe = subscribe(loop)

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="GLOBAL TELEMETRY // WOPR WAR SIMULATION">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden flex flex-col bg-black">
        {/* Canvas für die Weltkarten-Physiksimulation */}
        <div className="flex-1 w-full relative">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        
        {/* Unterer fiktiver Ticker (DEFCON / Kriegsverlauf) */}
        <div className="h-24 bg-slate-950/20 border-t border-slate-900/60 p-2 font-mono text-[10px] text-slate-300 overflow-y-auto leading-relaxed flex flex-col-reverse select-none">
          {logs.map((log, idx) => (
            <div key={idx} className={idx === 0 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export default memo(ThermonuclearWarPanel)
