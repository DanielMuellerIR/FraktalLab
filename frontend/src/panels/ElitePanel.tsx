import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// ─────────────────────────────────────────────────────────────────────────────
// ElitePanel: Authentic 1984 first-person vector space dogfight simulation.
// Features a 3D starfield responsive to player steering, a maneuvering 3D
// wireframe Cobra Mk III, laser firing, hit flashes, shield ripple effects,
// and a retro vector HUD including the iconic 3D ellipse radar scanner.
// ─────────────────────────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }
interface Edge { a: number; b: number }

const COBRA_VERTICES: Vec3[] = [
  { x:  0.0,  y:  0.15, z:  1.0  },   // 0: Nose top
  { x:  0.0,  y: -0.10, z:  1.0  },   // 1: Nose bottom
  { x:  0.7,  y:  0.10, z:  0.0  },   // 2: Mid right top
  { x:  0.7,  y: -0.15, z:  0.0  },   // 3: Mid right bottom
  { x: -0.7,  y:  0.10, z:  0.0  },   // 4: Mid left top
  { x: -0.7,  y: -0.15, z:  0.0  },   // 5: Mid left bottom
  { x:  0.5,  y:  0.08, z: -1.0  },   // 6: Aft right top
  { x:  0.5,  y: -0.12, z: -1.0  },   // 7: Aft right bottom
  { x: -0.5,  y:  0.08, z: -1.0  },   // 8: Aft left top
  { x: -0.5,  y: -0.12, z: -1.0  },   // 9: Aft left bottom
  { x:  0.0,  y:  0.35, z:  0.4  },   // 10: Cockpit top
  { x:  0.25, y:  0.20, z:  0.1  },   // 11: Cockpit right
  { x: -0.25, y:  0.20, z:  0.1  },   // 12: Cockpit left
  { x: -1.4,  y: -0.05, z:  0.2  },   // 13: Wing left front
  { x: -1.4,  y: -0.05, z: -0.5  },   // 14: Wing left back
  { x:  1.4,  y: -0.05, z:  0.2  },   // 15: Wing right front
  { x:  1.4,  y: -0.05, z: -0.5  },   // 16: Wing right back
  { x:  0.25, y:  0.0,  z: -1.15 },   // 17: Thruster right
  { x: -0.25, y:  0.0,  z: -1.15 },   // 18: Thruster left
  { x:  0.0,  y:  0.25, z: -1.15 },   // 19: Thruster top
  { x:  0.0,  y: -0.25, z: -1.15 },   // 20: Thruster bottom
]

const COBRA_EDGES: Edge[] = [
  { a:  0, b:  2 }, { a:  0, b:  4 },
  { a:  1, b:  3 }, { a:  1, b:  5 },
  { a:  2, b:  6 }, { a:  4, b:  8 },
  { a:  3, b:  7 }, { a:  5, b:  9 },
  { a:  6, b:  8 }, { a:  7, b:  9 },
  { a:  2, b:  3 }, { a:  4, b:  5 },
  { a:  0, b:  1 },
  { a:  6, b:  7 }, { a:  8, b:  9 },
  { a:  0, b: 10 }, { a: 10, b: 11 }, { a: 10, b: 12 },
  { a: 11, b:  2 }, { a: 12, b:  4 },
  { a: 11, b: 12 },
  { a:  4, b: 13 }, { a: 13, b: 14 }, { a: 14, b:  8 }, { a:  5, b: 13 },
  { a:  2, b: 15 }, { a: 15, b: 16 }, { a: 16, b:  6 }, { a:  3, b: 15 },
  { a: 17, b: 19 }, { a: 19, b: 18 }, { a: 18, b: 20 }, { a: 20, b: 17 },
  { a:  6, b: 17 }, { a:  7, b: 20 }, { a:  8, b: 18 }, { a:  9, b: 20 },
]

function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

function rotateZ(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z }
}

interface Star3D { x: number; y: number; z: number }

interface Debris3D {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  size: number
}

function ElitePanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hudMessage, setHudMessage] = useState('SYSTEM CHECK OK // NO TARGETS')

  useEffect(() => {
    const _canvas = canvasRef.current
    const _container = containerRef.current
    if (!_canvas || !_container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx
    const container: HTMLDivElement = _container

    let alive = true
    let unsubscribe: (() => void) | null = null

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Simulation States ────────────────────────────────────────────────────
    const stars: Star3D[] = Array.from({ length: 120 }, () => ({
      x: (Math.random() - 0.5) * 8.0,
      y: (Math.random() - 0.5) * 6.0,
      z: Math.random() * 12.0 + 1.0
    }))

    // Target (Cobra Mk III) state
    let targetPos = { x: 0, y: 0, z: 8 }
    let targetShield = 100
    let targetStatus: 'NOMINAL' | 'SHIELDS_LOW' | 'DESTROYED' = 'NOMINAL'
    let targetSpawnTimer = 0.0

    // Rotations of the target ship model itself
    const targetRot = { x: 0, y: 0, z: 0 }

    // Debris for explosion effect
    let debris: Debris3D[] = []

    // Lasers
    let laserPulseActive = false
    let laserTimer = 0.0
    let hitFlashActive = false
    let hitFlashTimer = 0.0

    // Player inputs/steering (simulated auto-tracking)
    let steerPitch = 0.0
    let steerYaw = 0.0

    // Fuel & Cash
    let cash = 3280.4
    let score = 412

    let lastT = 0
    let messageTimer = 4.0

    const messages = [
      'PIRATE DETECTED // COBRA MK III',
      'LASER TEMPERATURE NORMAL',
      'ECM READY',
      'SCANNING SYSTEM CARRIER',
      'INCOMING BOUNTY UPDATE',
      'TARGET LOCK ACTIVE',
      'HYPERDRIVE CHARGE: 100%'
    ]

    function loop(t: number) {
      if (!alive) return
      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      const viewH = H * 0.70 // upper 70% space view
      const hudY = viewH

      // ── Steering / AI Flight Calculations ──────────────────────────────────
      if (targetStatus !== 'DESTROYED') {
        const angle = t * 0.00075
        // Maneuvering orbit flight path
        targetPos.x = 4.8 * Math.sin(angle * 1.3) * Math.cos(angle * 0.4)
        targetPos.y = 2.4 * Math.sin(angle * 1.8)
        targetPos.z = 6.5 + 4.5 * Math.cos(angle * 0.7)

        // Slowly orient/rotate the enemy ship model based on its flight vector
        targetRot.y += 1.4 * dt
        targetRot.x = Math.sin(angle) * 0.4
        targetRot.z = Math.cos(angle * 1.5) * 0.5

        // Player auto-tracking yaw/pitch to follow the target slightly
        const targetProjX = (targetPos.x / targetPos.z)
        const targetProjY = (targetPos.y / targetPos.z)
        steerYaw = targetProjX * 0.45
        steerPitch = targetProjY * 0.45
      } else {
        // Center view slowly when target is dead
        steerYaw += (0 - steerYaw) * 3 * dt
        steerPitch += (0 - steerPitch) * 3 * dt

        targetSpawnTimer -= dt
        if (targetSpawnTimer <= 0) {
          targetPos = { x: 0, y: 0, z: 10 }
          targetShield = 100
          targetStatus = 'NOMINAL'
          setHudMessage('NEW BOUNTY INCOMING // COBRA MK III')
        }
      }

      // Update 3D Stars (moving based on speed + player steering)
      const flightSpeed = 3.8 * dt
      for (const s of stars) {
        s.z -= flightSpeed
        // Yaw shift
        s.x -= steerYaw * 12 * dt
        // Pitch shift
        s.y += steerPitch * 12 * dt

        if (s.z <= 0.1) {
          s.z = 12.0
          s.x = (Math.random() - 0.5) * 8.0
          s.y = (Math.random() - 0.5) * 6.0
        }
      }

      // Update Debris Particles
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.z += d.vz * dt
        d.vx += (0 - d.vx) * 0.25 * dt
        d.vy += (0 - d.vy) * 0.25 * dt
        d.vz += (0 - d.vz) * 0.25 * dt
        
        // Offset relative to steering
        d.x -= steerYaw * 12 * dt
        d.y += steerPitch * 12 * dt

        if (d.z <= 0.1 || d.z > 14) {
          debris.splice(i, 1)
        }
      }

      // ── Laser Fire Logic ───────────────────────────────────────────────────
      laserTimer -= dt
      if (targetStatus !== 'DESTROYED') {
        const dx = Math.abs(targetPos.x / targetPos.z)
        const dy = Math.abs(targetPos.y / targetPos.z)
        // If enemy is inside crosshair reticle, shoot lasers!
        if (dx < 0.12 && dy < 0.12 && targetPos.z > 1.2 && targetPos.z < 10) {
          if (laserTimer <= 0) {
            laserPulseActive = true
            laserTimer = 0.55 // fire rate
            
            // Apply damage
            targetShield -= 20
            if (targetShield <= 0) {
              targetStatus = 'DESTROYED'
              targetSpawnTimer = 4.0
              score += 1
              cash += 150.0
              setHudMessage('TARGET DESTROYED // BOUNTY SECURED (+150.0 CR)')
              
              // Spawn explosion debris
              debris = Array.from({ length: 48 }, () => {
                const angle1 = Math.random() * Math.PI * 2
                const angle2 = Math.random() * Math.PI * 2
                const speed = 2.0 + Math.random() * 4.0
                return {
                  x: targetPos.x,
                  y: targetPos.y,
                  z: targetPos.z,
                  vx: speed * Math.sin(angle1) * Math.cos(angle2),
                  vy: speed * Math.sin(angle1) * Math.sin(angle2),
                  vz: speed * Math.cos(angle1),
                  size: 1 + Math.random() * 3
                }
              })
            } else if (targetShield <= 40) {
              targetStatus = 'SHIELDS_LOW'
              setHudMessage('WARNING: TARGET SHIELDS CRITICAL')
            }
            
            hitFlashActive = true
            hitFlashTimer = 0.10
          }
        }
      }

      if (hitFlashActive) {
        hitFlashTimer -= dt
        if (hitFlashTimer <= 0) {
          hitFlashActive = false
        }
      }

      if (laserTimer < 0.35) {
        laserPulseActive = false
      }

      // HUD messages cycling
      messageTimer -= dt
      if (messageTimer <= 0) {
        if (targetStatus !== 'DESTROYED' && targetShield > 0) {
          setHudMessage(messages[Math.floor(Math.random() * messages.length)])
        }
        messageTimer = 5.0 + Math.random() * 5.0
      }

      // ── RENDERING ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // 1. Render Vector Stars
      ctx.fillStyle = '#ffffff'
      for (const s of stars) {
        if (s.z <= 0.1) continue
        const sx = (s.x / s.z) * W * 0.65 + W / 2
        const sy = (s.y / s.z) * viewH * 0.65 + viewH / 2
        if (sx < 0 || sx >= W || sy < 0 || sy >= viewH) continue

        const size = s.z < 3 ? 2 : 1
        ctx.fillRect(Math.round(sx), Math.round(sy), size, size)
      }

      // 2. Render Target Ship (Cobra Mk III)
      if (targetStatus !== 'DESTROYED') {
        const ez = targetPos.z
        if (ez > 0.1) {
          // Scale based on depth
          const scale = (W * 0.28) / ez
          const cx = (targetPos.x / ez) * W * 0.65 + W / 2
          const cy = (targetPos.y / ez) * viewH * 0.65 + viewH / 2

          // Compute rotated ship vertices
          const projVerts = COBRA_VERTICES.map(v => {
            let rotated = rotateX(v, targetRot.x)
            rotated = rotateY(rotated, targetRot.y)
            rotated = rotateZ(rotated, targetRot.z)

            return {
              sx: cx + rotated.x * scale,
              sy: cy - rotated.y * scale
            }
          })

          // Draw wireframe edges in clean crisp white
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          for (const edge of COBRA_EDGES) {
            const pA = projVerts[edge.a]
            const pB = projVerts[edge.b]
            ctx.moveTo(pA.sx, pA.sy)
            ctx.lineTo(pB.sx, pB.sy)
          }
          ctx.stroke()

          // Draw shield ripple if laser hit
          if (hitFlashActive) {
            ctx.strokeStyle = 'rgba(255, 110, 0, 0.45)'
            ctx.lineWidth = 2.0
            ctx.beginPath()
            ctx.arc(cx, cy, scale * 1.8, 0, Math.PI * 2)
            ctx.stroke()
            
            // Inner neon shield ripple
            ctx.strokeStyle = 'rgba(255, 235, 120, 0.65)'
            ctx.lineWidth = 1.0
            ctx.beginPath()
            ctx.arc(cx, cy, scale * 1.6, 0, Math.PI * 2)
            ctx.stroke()
          }

          // Draw relative tag/scanner bracket around target
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.35)'
          ctx.lineWidth = 1.0
          const bSz = scale * 1.9
          ctx.strokeRect(cx - bSz, cy - bSz, bSz * 2, bSz * 2)
          
          ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'
          ctx.font = '8px monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`COBRA MK3 [${Math.round(ez * 100)}m]`, cx - bSz, cy - bSz - 4)
        }
      }

      // 3. Render Explosion Debris Particles
      ctx.fillStyle = '#ff6600'
      for (const d of debris) {
        if (d.z <= 0.1) continue
        const sx = (d.x / d.z) * W * 0.65 + W / 2
        const sy = (d.y / d.z) * viewH * 0.65 + viewH / 2
        if (sx < 0 || sx >= W || sy < 0 || sy >= viewH) continue

        const rad = (d.size * (W * 0.05)) / d.z
        ctx.beginPath()
        ctx.arc(sx, sy, Math.max(1, rad), 0, Math.PI * 2)
        ctx.fill()
      }

      // 4. Draw Cockpit Reticle / Crosshair
      const midX = W / 2
      const midY = viewH / 2
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
      ctx.lineWidth = 1.0
      ctx.beginPath()
      // Center circle
      ctx.arc(midX, midY, 20, 0, Math.PI * 2)
      // Four crosshair ticks
      ctx.moveTo(midX - 35, midY); ctx.lineTo(midX - 22, midY)
      ctx.moveTo(midX + 22, midY); ctx.lineTo(midX + 35, midY)
      ctx.moveTo(midX, midY - 35); ctx.lineTo(midX, midY - 22)
      ctx.moveTo(midX, midY + 22); ctx.lineTo(midX, midY + 35)
      ctx.stroke()

      // 5. Laser Fire Effect
      if (laserPulseActive) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3.5
        ctx.beginPath()
        ctx.moveTo(W * 0.10, viewH)
        ctx.lineTo(midX, midY)
        ctx.moveTo(W * 0.90, viewH)
        ctx.lineTo(midX, midY)
        ctx.stroke()

        ctx.strokeStyle = '#ff3300'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(W * 0.10, viewH)
        ctx.lineTo(midX, midY)
        ctx.moveTo(W * 0.90, viewH)
        ctx.lineTo(midX, midY)
        ctx.stroke()
      }

      // 6. Laser Hit Flash overlay
      if (hitFlashActive) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.08)'
        ctx.fillRect(0, 0, W, viewH)
      }

      // ── HUD PANEL RENDERING (Lower 30% of screen) ──────────────────────────
      ctx.fillStyle = '#050508'
      ctx.fillRect(0, hudY, W, H - hudY)

      ctx.strokeStyle = '#33333d'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, hudY); ctx.lineTo(W, hudY)
      ctx.stroke()

      const hudH = H - hudY
      const rCX = W / 2
      const rCY = hudY + hudH / 2
      const rW = Math.min(W * 0.18, hudH * 0.6)
      const rH = rW * 0.44

      // Draw 3D Ellipse Radar Scanner Grid
      ctx.strokeStyle = '#222230'
      ctx.lineWidth = 1.0
      ctx.beginPath()
      ctx.ellipse(rCX, rCY, rW, rH, 0, 0, Math.PI * 2)
      ctx.ellipse(rCX, rCY, rW * 0.6, rH * 0.6, 0, 0, Math.PI * 2)
      ctx.ellipse(rCX, rCY, rW * 0.3, rH * 0.3, 0, 0, Math.PI * 2)
      ctx.moveTo(rCX - rW, rCY); ctx.lineTo(rCX + rW, rCY)
      ctx.moveTo(rCX, rCY - rH); ctx.lineTo(rCX, rCY + rH)
      ctx.stroke()

      // Plot target on 3D Ellipse Scanner
      if (targetStatus !== 'DESTROYED') {
        const maxRange = 10.0
        // Scanner positions
        const bx = rCX + (targetPos.x / maxRange) * rW
        const by = rCY + (targetPos.z / maxRange) * rH

        // Stem height representing vertical Y-offset
        const stemLength = (targetPos.y / maxRange) * rH
        const stemEndY = by - stemLength

        // Draw vertical stem line to scanner plane
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx, stemEndY)
        ctx.stroke()

        // Draw blip dot at the end of the stem (Red for enemy target)
        ctx.fillStyle = '#ff3344'
        ctx.beginPath()
        ctx.arc(bx, stemEndY, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw HUD Vertical Status Bars (Shields, Target, Temp, Speed)
      const drawVerticalBar = (val: number, label: string, cx: number, w: number, color: string) => {
        const barH = hudH * 0.58
        const topY = hudY + hudH * 0.16
        ctx.fillStyle = '#111116'
        ctx.fillRect(cx - w/2, topY, w, barH)

        const filledH = barH * Math.max(0, Math.min(100, val)) / 100
        ctx.fillStyle = color
        ctx.fillRect(cx - w/2, topY + barH - filledH, w, filledH)

        ctx.strokeStyle = '#333344'
        ctx.lineWidth = 0.5
        ctx.strokeRect(cx - w/2, topY, w, barH)

        ctx.fillStyle = '#888899'
        ctx.font = '7px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(label, cx, topY + barH + 9)
      };

      // Player Speed pulse, Laser Temp
      const speedVal = targetStatus === 'DESTROYED' ? 30 : 65 + 10 * Math.sin(t * 0.002)
      const laserTemp = Math.max(10, Math.round(10 + 90 * (laserTimer / 0.55)))

      drawVerticalBar(100, 'SHLD F', W * 0.05, 8, '#3b82f6')
      drawVerticalBar(95, 'SHLD A', W * 0.10, 8, '#3b82f6')
      drawVerticalBar(speedVal, 'SPEED', W * 0.15, 8, '#10b981')

      // Target shield bar
      const tShieldFill = targetStatus === 'DESTROYED' ? 0 : targetShield
      drawVerticalBar(tShieldFill, 'T-SHLD', W * 0.85, 8, '#ef4444')
      drawVerticalBar(laserTemp, 'TEMP', W * 0.90, 8, '#f59e0b')
      drawVerticalBar(84, 'FUEL', W * 0.95, 8, '#a855f7')

      // Text readouts (Score, Cash, Compass)
      ctx.fillStyle = '#ffffff'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`CASH: ${cash.toFixed(1)} CR`, W * 0.22, hudY + hudH * 0.35)
      ctx.fillText(`SCORE: ${score}`, W * 0.22, hudY + hudH * 0.65)

      // Target Compass (Circle with direction dot)
      const compCX = W * 0.76
      const compCY = rCY
      const compR = hudH * 0.24
      ctx.strokeStyle = '#333344'
      ctx.lineWidth = 1.0
      ctx.beginPath()
      ctx.arc(compCX, compCY, compR, 0, Math.PI * 2)
      ctx.stroke()
      
      // Plot target direction on compass
      if (targetStatus !== 'DESTROYED') {
        const normAngle = Math.atan2(targetPos.y, targetPos.x)
        const inFront = targetPos.z > 0
        const dispR = inFront ? compR * 0.65 : compR * 0.3
        
        const dx = Math.cos(normAngle) * dispR
        const dy = Math.sin(normAngle) * dispR
        
        ctx.fillStyle = inFront ? '#ef4444' : 'rgba(239, 68, 68, 0.35)'
        ctx.beginPath()
        ctx.arc(compCX + dx, compCY + dy, 2.0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Dot in center
        ctx.fillStyle = '#555566'
        ctx.beginPath()
        ctx.arc(compCX, compCY, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#888899'
      ctx.font = '7px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('COMPASS', compCX, hudY + hudH * 0.16 + hudH * 0.58 + 9)

      // Header labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('FRONT VIEW', 12, 14)
      ctx.textAlign = 'right'
      ctx.fillText('COBRA MK III // STATUS DISPLAY', W - 12, 14)
    }

    unsubscribe = subscribe(loop)

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="ELITE // COBRA MK III VECTOR SCAN">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black select-none flex flex-col">
        <div className="flex-1 w-full relative">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        {/* Ticker log for game messages */}
        <div className="h-6 bg-[#040407] border-t border-[#1b1b22] px-3 flex items-center font-mono text-[8px] text-green-400 uppercase tracking-widest">
          <span className="text-[#64748b] mr-2">SYS LOG:</span>
          <span className="animate-pulse">{hudMessage}</span>
        </div>
      </div>
    </Panel>
  )
}

export default memo(ElitePanel)
