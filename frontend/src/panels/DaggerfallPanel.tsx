import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// ── Maze-Konfiguration ────────────────────────────────────────────────────────
const MAZE_COLS = 15   // cells horizontal
const MAZE_ROWS = 15   // cells vertical

const TILE_W = 2 * MAZE_COLS + 1   // = 31
const TILE_H = 2 * MAZE_ROWS + 1   // = 31

// ── Event-Meldungen ────────────────────────────────────────────────────────────
const EVENTS = [
  'FIREWALL DECRYPT ACTIVE',
  'COMPROMISED PORT DETECTED',
  'INTRUSION LEVEL ELEVATED',
  'DECRYPTION CORE ENGAGED',
  'PORT SCAN: S-22 OPEN',
  'ROUTING INTERCEPT ACTIVE',
  'SECURITY PROTOCOL BYPASSED',
  'SYSTEM MEMORY DUMP ACTIVE',
  'IP GEOLOCATION RESOLVED',
  'VPN SHIELD ENGAGED',
  'PROXY CHAIN EXPANDED',
  'ROOT ACCESS GRANTED',
]

// ── Ausgangs-Dialog ───────────────────────────────────────────────────────────
const EXIT_LINES = [
  '╔══════════════════════════════════════════╗',
  '║ INTRUSION COMPLETE // SYSTEM ACCESS      ║',
  '║ ALL FIREWALLS COLLAPSED. CORE COMPROMISED║',
  '╚══════════════════════════════════════════╝',
]

// ── Maze-Generierung: DFS-Backtracker ─────────────────────────────────────────
function generateMaze(): number[][] {
  const walls: number[][] = Array.from({ length: TILE_H }, () =>
    Array(TILE_W).fill(1) // 1 = Standard wall
  )

  const visited: boolean[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array(MAZE_COLS).fill(false)
  )

  function cellToTile(row: number, col: number): [number, number] {
    return [row * 2 + 1, col * 2 + 1]
  }

  function openCell(row: number, col: number) {
    const [ty, tx] = cellToTile(row, col)
    walls[ty][tx] = 0 // 0 = Walkable floor
  }

  function openWall(r1: number, c1: number, r2: number, c2: number) {
    const ty = r1 * 2 + 1 + (r2 - r1)
    const tx = c1 * 2 + 1 + (c2 - c1)
    walls[ty][tx] = 0
  }

  const stack: [number, number][] = []
  const startR = 0
  const startC = 0

  visited[startR][startC] = true
  openCell(startR, startC)
  stack.push([startR, startC])

  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1]
    const neighbors: [number, number][] = []
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < MAZE_ROWS && nc >= 0 && nc < MAZE_COLS && !visited[nr][nc]) {
        neighbors.push([nr, nc])
      }
    }

    if (neighbors.length === 0) {
      stack.pop()
    } else {
      const idx = Math.floor(Math.random() * neighbors.length)
      const [nr, nc] = neighbors[idx]
      visited[nr][nc] = true
      openCell(nr, nc)
      openWall(r, c, nr, nc)
      stack.push([nr, nc])
    }
  }

  return walls
}

// ── BFS Wegfindung ────────────────────────────────────────────────────────────
function bfsPath(
  walls: number[][],
  startRow: number, startCol: number,
  exitRow:  number, exitCol:  number
): [number, number][] {
  type Cell = [number, number]
  const visited: boolean[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array(MAZE_COLS).fill(false)
  )
  const parent: ([number,number] | null)[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array(MAZE_COLS).fill(null)
  )

  const queue: Cell[] = [[startRow, startCol]]
  visited[startRow][startCol] = true

  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    if (r === exitRow && c === exitCol) break

    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= MAZE_ROWS || nc < 0 || nc >= MAZE_COLS) continue
      if (visited[nr][nc]) continue

      const wallR = r * 2 + 1 + dr
      const wallC = c * 2 + 1 + dc
      if (walls[wallR][wallC] === 1) continue // Standard walls block grid paths during initial BFS

      visited[nr][nc] = true
      parent[nr][nc] = [r, c]
      queue.push([nr, nc])
    }
  }

  const path: Cell[] = []
  let cur: Cell | null = [exitRow, exitCol]
  while (cur !== null) {
    path.unshift(cur)
    const pr: number = cur[0]
    const pc: number = cur[1]
    cur = parent[pr][pc]
  }

  return path.map(([r, c]) => [c * 2 + 1.5, r * 2 + 1.5])
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  size: number
}

function DaggerfallPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const firewallHealthRef = useRef<number>(100)

  useEffect(() => {
    const _canvas   = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement        = _canvas
    const ctx:    CanvasRenderingContext2D = _ctx

    let active = true
    let isVisible = true
    let unsubscribe: (() => void) | null = null

    // ── Canvas-Auflösung auf native Containergröße setzen (scharf) ───────────
    const resize = () => {
      canvas.width  = container.clientWidth  || 640
      canvas.height = container.clientHeight || 400
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Prozedurale Textur-Generierung ───────────────────────────────────────
    const texSize = 128
    const textures: HTMLCanvasElement[] = []

    function buildTextures() {
      for (let t = 0; t < 4; t++) {
        const texCanvas = document.createElement('canvas')
        texCanvas.width = texSize
        texCanvas.height = texSize
        const tCtx = texCanvas.getContext('2d')!

        tCtx.fillStyle = '#010502'
        tCtx.fillRect(0, 0, texSize, texSize)

        if (t === 0) {
          // Texture 0: Neon circuit wall (high res details)
          tCtx.strokeStyle = '#041c09'
          tCtx.lineWidth = 2
          for (let i = 0; i < texSize; i += 32) {
            tCtx.strokeRect(i, 0, 32, texSize)
            tCtx.strokeRect(0, i, texSize, 32)
          }
          // Draw high-res glowing green trace lines
          tCtx.strokeStyle = '#22c55e'
          tCtx.lineWidth = 1.5
          tCtx.beginPath()
          tCtx.moveTo(16, 0); tCtx.lineTo(16, 48); tCtx.lineTo(48, 80); tCtx.lineTo(48, 128)
          tCtx.moveTo(96, 128); tCtx.lineTo(96, 80); tCtx.lineTo(64, 48); tCtx.lineTo(64, 0)
          tCtx.moveTo(0, 32); tCtx.lineTo(32, 32); tCtx.lineTo(48, 48); tCtx.lineTo(48, 80); tCtx.lineTo(32, 96); tCtx.lineTo(0, 96)
          tCtx.stroke()

          tCtx.fillStyle = '#a3e635'
          tCtx.beginPath(); tCtx.arc(16, 48, 3, 0, Math.PI*2); tCtx.fill()
          tCtx.beginPath(); tCtx.arc(48, 80, 3, 0, Math.PI*2); tCtx.fill()
          tCtx.beginPath(); tCtx.arc(64, 48, 3, 0, Math.PI*2); tCtx.fill()
          tCtx.beginPath(); tCtx.arc(48, 48, 3, 0, Math.PI*2); tCtx.fill()
        } else if (t === 1) {
          // Texture 1: Firewall Red Grid
          tCtx.strokeStyle = '#2e040a'
          tCtx.lineWidth = 2
          for (let i = 0; i < texSize; i += 16) {
            tCtx.strokeRect(i, 0, 16, texSize)
            tCtx.strokeRect(0, i, texSize, 16)
          }
          tCtx.fillStyle = '#ef4444'
          tCtx.fillRect(40, 48, 48, 44)
          tCtx.strokeStyle = '#ef4444'
          tCtx.lineWidth = 4
          tCtx.beginPath()
          tCtx.arc(64, 48, 14, Math.PI, 0)
          tCtx.stroke()

          tCtx.strokeStyle = '#f87171'
          tCtx.lineWidth = 2
          tCtx.strokeRect(4, 4, texSize - 8, texSize - 8)
        } else if (t === 2) {
          // Texture 2: Locked Gate Blue
          tCtx.strokeStyle = '#021e3d'
          tCtx.lineWidth = 2.5
          for (let i = 0; i < texSize; i += 32) {
            tCtx.strokeRect(0, i, texSize, 32)
          }
          tCtx.fillStyle = '#3b82f6'
          tCtx.fillRect(20, 40, 88, 48)
          tCtx.strokeStyle = '#60a5fa'
          tCtx.lineWidth = 2
          tCtx.strokeRect(20, 40, 88, 48)
        } else {
          // Texture 3: Decrypted Data (blank/noise fallback)
          tCtx.fillStyle = '#020f04'
          tCtx.fillRect(0, 0, texSize, texSize)
          tCtx.fillStyle = '#4ade80'
          for (let i = 0; i < 40; i++) {
            const rx = Math.floor(Math.random() * texSize)
            const ry = Math.floor(Math.random() * texSize)
            tCtx.fillRect(rx, ry, 2, 2)
          }
        }
        textures.push(texCanvas)
      }
    }
    buildTextures()

    // ── Labyrinth-Zustand ────────────────────────────────────────────────────
    let walls: number[][] = []
    let waypoints: [number, number][] = []
    let waypointIdx = 0

    const EXIT_ROW = MAZE_ROWS - 1
    const EXIT_COL = MAZE_COLS - 1


    // ── Spieler-Zustand ──────────────────────────────────────────────────────
    let posX = 1.5
    let posY = 1.5
    let angle = 0.0

    // ── Exit-Dialog-Zustand ──────────────────────────────────────────────────
    let exitDialogTimer = 0.0
    let exitDialogAlpha = 0.0

    // ── KI-Bewegungs-Parameter ───────────────────────────────────────────────
    const MOVE_SPEED = 2.8
    const TURN_SPEED = 2.4
    const WAYP_RADIUS = 0.38

    // ── Stats ────────────────────────────────────────────────────────────────
    let decryptRate = 45
    let packetsSent = 120
    let portsCompromised = 0
    let integrity = 100
    let stepTimer = 0.0

    // ── Event-Overlay ─────────────────────────────────────────────────────────
    let eventText = ''
    let eventAlpha = 0.0
    let eventTimer = 1500

    // Particle explosions
    let particles: Particle[] = []

    function spawnExplosion(sx: number, sy: number) {
      for (let i = 0; i < 35; i++) {
        const a = Math.random() * Math.PI * 2
        const speed = 1.5 + Math.random() * 4.0
        particles.push({
          x: sx,
          y: sy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 1.2,
          color: Math.random() > 0.55 ? '#ef4444' : '#f97316',
          alpha: 1.0,
          size: 1 + Math.random() * 3,
        })
      }
    }

    function startNewMaze() {
      walls = generateMaze()
      waypoints = bfsPath(walls, 0, 0, EXIT_ROW, EXIT_COL)
      waypointIdx = 0

      // Place 2 firewalls along the BFS path to block progress
      if (waypoints.length > 8) {
        const idx1 = Math.floor(waypoints.length * 0.35)
        const idx2 = Math.floor(waypoints.length * 0.70)
        for (const idx of [idx1, idx2]) {
          const [wx1, wy1] = waypoints[idx]
          const [wx2, wy2] = waypoints[idx + 1]
          const tx = Math.floor((wx1 + wx2) / 2)
          const ty = Math.floor((wy1 + wy2) / 2)
          if (tx > 0 && tx < TILE_W - 1 && ty > 0 && ty < TILE_H - 1) {
            walls[ty][tx] = 2 // Firewall
          }
        }
      }

      // Exit outer wall as locked gate
      walls[TILE_H - 2][TILE_W - 1] = 3

      posX = 1.5
      posY = 1.5
      firewallHealthRef.current = 100
      portsCompromised = 0

      if (waypoints.length > 1) {
        const [wx, wy] = waypoints[1]
        angle = Math.atan2(wy - posY, wx - posX)
      } else {
        angle = 0
      }
      exitDialogTimer = 0.0
      exitDialogAlpha = 0.0
    }

    startNewMaze()

    function isWalkable(x: number, y: number): boolean {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      if (tx < 0 || ty < 0 || tx >= TILE_W || ty >= TILE_H) return false
      return walls[ty][tx] === 0
    }

    function angleDiff(target: number, current: number): number {
      let d = target - current
      while (d >  Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      return d
    }

    let lastSimT = 0

    // ── Haupt-Loop ────────────────────────────────────────────────────────────
    function loop(t: number) {
      if (!active || !isVisible) return

      const dt = lastSimT === 0 ? 0.016 : Math.min((t - lastSimT) / 1000, 0.08)
      lastSimT = t

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // ── Intrusion / Decryption Check ───────────────────────────────────────
      let isBypassing = false
      let targetFirewallX = -1
      let targetFirewallY = -1
      let firewallType = 0

      if (waypointIdx < waypoints.length) {
        const [wx, wy] = waypoints[waypointIdx]
        const tx = Math.floor((posX + wx) / 2)
        const ty = Math.floor((posY + wy) / 2)
        if (walls[ty] && (walls[ty][tx] === 2 || walls[ty][tx] === 3)) {
          isBypassing = true
          targetFirewallX = tx
          targetFirewallY = ty
          firewallType = walls[ty][tx]
        }
      } else {
        const tx = TILE_W - 1
        const ty = TILE_H - 2
        if (walls[ty][tx] === 3) {
          isBypassing = true
          targetFirewallX = tx
          targetFirewallY = ty
          firewallType = 3
        }
      }

      if (exitDialogTimer > 0) {
        exitDialogAlpha = Math.min(1.0, exitDialogAlpha + dt / 0.4)
        exitDialogTimer -= dt
        if (exitDialogTimer <= 0) {
          startNewMaze()
        }
      } else if (isBypassing) {
        // Stop moving and look at firewall
        const targetAngle = Math.atan2(targetFirewallY + 0.5 - posY, targetFirewallX + 0.5 - posX)
        angle = lerp(angle, targetAngle, 0.2)

        // Decryption combat ticks
        firewallHealthRef.current -= dt * 32.0 // takes ~3 seconds
        packetsSent += Math.round(10 * dt * 10) / 10

        if (firewallHealthRef.current <= 0) {
          walls[targetFirewallY][targetFirewallX] = 0 // Remove firewall wall
          firewallHealthRef.current = 100
          spawnExplosion(W / 2, H * 0.4)

          eventText = firewallType === 2 ? 'FIREWALL BYPASSED!' : 'ACCESS KEY COMPROMISED!'
          eventAlpha = 1.0
          portsCompromised++

          if (firewallType === 3) {
            exitDialogTimer = 3.2
            exitDialogAlpha = 0.0
          }
        }
      } else {
        // Normal Navigation
        if (waypointIdx < waypoints.length) {
          const [wx, wy] = waypoints[waypointIdx]
          const dx = wx - posX
          const dy = wy - posY
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < WAYP_RADIUS) {
            waypointIdx++
          } else {
            const targetAngle = Math.atan2(dy, dx)
            const diff = angleDiff(targetAngle, angle)
            const maxTurn = TURN_SPEED * dt

            if (Math.abs(diff) > 0.06) {
              angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn)
            }

            const alignment = Math.cos(diff)
            if (alignment > 0.1) {
              const speed  = MOVE_SPEED * Math.max(0.3, alignment) * dt
              const nx     = posX + Math.cos(angle) * speed
              const ny     = posY + Math.sin(angle) * speed
              if (isWalkable(nx, posY)) posX = nx
              if (isWalkable(posX, ny)) posY = ny
            }
          }
        }
      }

      // Stats drift
      stepTimer += dt
      if (stepTimer > 0.6) {
        stepTimer = 0
        decryptRate = Math.max(10, Math.min(250, decryptRate + (Math.random() > 0.5 ? 5 : -4)))
        integrity = Math.max(80, Math.min(100, integrity + (Math.random() > 0.6 ? 1 : -1)))
      }

      // Events Overlay Timer
      eventTimer -= dt * 1000
      if (eventTimer <= 0) {
        eventText  = EVENTS[Math.floor(Math.random() * EVENTS.length)]
        eventAlpha = 1.0
        eventTimer = 5000 + Math.random() * 6000
      }
      if (eventAlpha > 0) {
        eventAlpha = Math.max(0, eventAlpha - dt * 0.45)
      }

      // ── Render ceiling and floor with gradients and perspective grids ───────
      const viewH = Math.floor(H * 0.76)
      const horizonY = Math.floor(viewH / 2)

      // Ceiling gradient: dark purple/black to deep purple glow at the horizon
      const ceilingGrd = ctx.createLinearGradient(0, 0, 0, horizonY)
      ceilingGrd.addColorStop(0, '#000000')
      ceilingGrd.addColorStop(1, '#1b0326')
      ctx.fillStyle = ceilingGrd
      ctx.fillRect(0, 0, W, horizonY)

      // Floor gradient: deep blue glow at the horizon to pitch black at the bottom
      const floorGrd = ctx.createLinearGradient(0, horizonY, 0, viewH)
      floorGrd.addColorStop(0, '#02182d')
      floorGrd.addColorStop(1, '#000000')
      ctx.fillStyle = floorGrd
      ctx.fillRect(0, horizonY, W, viewH - horizonY)

      // ── Dynamic 3D perspective grids on floor and ceiling ───────────────────
      const FOV = Math.PI / 3
      const fovScale = W / (2 * Math.tan(FOV / 2))
      const r = 12
      const gridStep = 0.5
      const minX = Math.floor((posX - r) / gridStep) * gridStep
      const maxX = Math.ceil((posX + r) / gridStep) * gridStep
      const minY = Math.floor((posY - r) / gridStep) * gridStep
      const maxY = Math.ceil((posY + r) / gridStep) * gridStep

      const gridW = Math.round((maxX - minX) / gridStep) + 1
      const gridH = Math.round((maxY - minY) / gridStep) + 1
      
      const ptsFloor: ([number, number] | null)[] = new Array(gridW * gridH).fill(null)
      const ptsCeil: ([number, number] | null)[] = new Array(gridW * gridH).fill(null)
      const ptsDepth: number[] = new Array(gridW * gridH).fill(0)
      
      for (let ix = 0; ix < gridW; ix++) {
        const gx = minX + ix * gridStep
        for (let iy = 0; iy < gridH; iy++) {
          const gy = minY + iy * gridStep
          
          const dx = gx - posX
          const dy = gy - posY
          const cx = dx * Math.cos(angle) + dy * Math.sin(angle)
          
          if (cx > 0.05) {
            const cy = -dx * Math.sin(angle) + dy * Math.cos(angle)
            const sx = W / 2 + (cy * fovScale) / cx
            
            // Floor Y (pz = -0.5)
            const syF = horizonY + (0.5 * viewH) / cx
            ptsFloor[ix * gridH + iy] = [sx, syF]
            
            // Ceiling Y (pz = 0.5)
            const syC = horizonY - (0.5 * viewH) / cx
            ptsCeil[ix * gridH + iy] = [sx, syC]
            
            ptsDepth[ix * gridH + iy] = cx
          }
        }
      }

      ctx.lineWidth = 1.0
      
      // Draw lines of constant X (longitudinal lines)
      for (let ix = 0; ix < gridW; ix++) {
        for (let iy = 0; iy < gridH - 1; iy++) {
          const idx1 = ix * gridH + iy
          const idx2 = ix * gridH + (iy + 1)
          const p1F = ptsFloor[idx1]
          const p2F = ptsFloor[idx2]
          const p1C = ptsCeil[idx1]
          const p2C = ptsCeil[idx2]
          
          if (p1F && p2F) {
            const cxAvg = (ptsDepth[idx1] + ptsDepth[idx2]) / 2
            if (cxAvg < r) {
              const opacity = 0.28 * (1.0 - cxAvg / r)
              ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})` // Vibrant Cyan
              ctx.beginPath()
              ctx.moveTo(p1F[0], p1F[1])
              ctx.lineTo(p2F[0], p2F[1])
              ctx.stroke()
            }
          }
          
          if (p1C && p2C) {
            const cxAvg = (ptsDepth[idx1] + ptsDepth[idx2]) / 2
            if (cxAvg < r) {
              const opacity = 0.20 * (1.0 - cxAvg / r)
              ctx.strokeStyle = `rgba(236, 72, 153, ${opacity})` // Vibrant Pink/Magenta
              ctx.beginPath()
              ctx.moveTo(p1C[0], p1C[1])
              ctx.lineTo(p2C[0], p2C[1])
              ctx.stroke()
            }
          }
        }
      }
      
      // Draw lines of constant Y (transverse lines)
      for (let iy = 0; iy < gridH; iy++) {
        for (let ix = 0; ix < gridW - 1; ix++) {
          const idx1 = ix * gridH + iy
          const idx2 = (ix + 1) * gridH + iy
          const p1F = ptsFloor[idx1]
          const p2F = ptsFloor[idx2]
          const p1C = ptsCeil[idx1]
          const p2C = ptsCeil[idx2]
          
          if (p1F && p2F) {
            const cxAvg = (ptsDepth[idx1] + ptsDepth[idx2]) / 2
            if (cxAvg < r) {
              const opacity = 0.28 * (1.0 - cxAvg / r)
              ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})` // Vibrant Cyan
              ctx.beginPath()
              ctx.moveTo(p1F[0], p1F[1])
              ctx.lineTo(p2F[0], p2F[1])
              ctx.stroke()
            }
          }
          
          if (p1C && p2C) {
            const cxAvg = (ptsDepth[idx1] + ptsDepth[idx2]) / 2
            if (cxAvg < r) {
              const opacity = 0.20 * (1.0 - cxAvg / r)
              ctx.strokeStyle = `rgba(236, 72, 153, ${opacity})` // Vibrant Pink/Magenta
              ctx.beginPath()
              ctx.moveTo(p1C[0], p1C[1])
              ctx.lineTo(p2C[0], p2C[1])
              ctx.stroke()
            }
          }
        }
      }

      // ── Raycasting 3D textured scene ───────────────────────────────────────
      const halfFOV = FOV / 2
      const numRays = W

      for (let col = 0; col < numRays; col++) {
        const rayAngle = angle - halfFOV + (col / numRays) * FOV
        const rdx = Math.cos(rayAngle)
        const rdy = Math.sin(rayAngle)

        let mapX = Math.floor(posX)
        let mapY = Math.floor(posY)

        const deltaDistX = rdx === 0 ? 1e30 : Math.abs(1 / rdx)
        const deltaDistY = rdy === 0 ? 1e30 : Math.abs(1 / rdy)
        const stepX = rdx < 0 ? -1 : 1
        const stepY = rdy < 0 ? -1 : 1

        let sideDistX = rdx < 0 ? (posX - mapX) * deltaDistX : (mapX + 1.0 - posX) * deltaDistX
        let sideDistY = rdy < 0 ? (posY - mapY) * deltaDistY : (mapY + 1.0 - posY) * deltaDistY

        let side: 0 | 1 = 0
        let hit = false
        let dist = 0
        let hitX = 0
        let hitY = 0

        for (let step = 0; step < 50 && !hit; step++) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX
            mapX      += stepX
            side       = 0
          } else {
            sideDistY += deltaDistY
            mapY      += stepY
            side       = 1
          }
          if (mapX >= 0 && mapY >= 0 && mapX < TILE_W && mapY < TILE_H) {
            if (walls[mapY][mapX] > 0) {
              hit  = true
              hitX = mapX
              hitY = mapY
            }
          } else {
            hit  = true
            hitX = mapX
            hitY = mapY
          }
        }

        if (side === 0) dist = sideDistX - deltaDistX
        else            dist = sideDistY - deltaDistY
        dist = Math.max(0.08, dist)

        const wallH = Math.min(viewH * 3, Math.round(viewH / dist))
        const wallTop = Math.round(viewH / 2 - wallH / 2)

        // Texture selection
        let texIdx = 0
        if (hitX >= 0 && hitX < TILE_W && hitY >= 0 && hitY < TILE_H) {
          const val = walls[hitY][hitX]
          if (val === 2) texIdx = 1      // Red Firewall
          else if (val === 3) texIdx = 2 // Blue locked gate
        }

        // Texture slice sampling
        let wallX = 0
        if (side === 0) wallX = posY + dist * rdy
        else            wallX = posX + dist * rdx
        wallX -= Math.floor(wallX)

        let texX = Math.floor(wallX * texSize)
        if (side === 0 && rdx > 0) texX = texSize - 1 - texX
        if (side === 1 && rdy < 0) texX = texSize - 1 - texX

        // Hardware accelerated slice draw
        ctx.drawImage(textures[texIdx], texX, 0, 1, texSize, col, wallTop, 1, wallH)

        // Distance fog overlay (dimming)
        const fogOpacity = Math.min(0.92, dist / 11.5)
        ctx.fillStyle = `rgba(1, 5, 2, ${fogOpacity.toFixed(2)})`
        ctx.fillRect(col, wallTop, 1, wallH)

        // Y-axis Shading/Shadowing
        if (side === 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
          ctx.fillRect(col, wallTop, 1, wallH)
        }
      }

      // ── Laser beam decryption animation ────────────────────────────────────
      if (isBypassing && exitDialogTimer <= 0) {
        const beamColor = firewallType === 2 ? '239, 68, 68' : '59, 130, 246'
        const targetX = W / 2
        const targetY = H * 0.38 + Math.sin(t * 0.02) * 5

        // Firing beams from lower left and right screen corners targeting the wall center
        const mPoints = [
          [W * 0.15, H * 0.72],
          [W * 0.85, H * 0.72]
        ]

        // 1. Draw outer fuzzy glow
        ctx.save()
        ctx.shadowBlur = 12
        ctx.shadowColor = `rgba(${beamColor}, 0.9)`
        ctx.strokeStyle = `rgba(${beamColor}, 0.45)`
        ctx.lineWidth = 6 + Math.sin(t * 0.1) * 2
        mPoints.forEach(([sx, sy]) => {
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(targetX, targetY)
          ctx.stroke()
        })

        // 2. Draw bright middle line
        ctx.strokeStyle = `rgba(${beamColor}, 0.85)`
        ctx.lineWidth = 3
        mPoints.forEach(([sx, sy]) => {
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(targetX, targetY)
          ctx.stroke()
        })

        // 3. Draw white-hot center core
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        mPoints.forEach(([sx, sy]) => {
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(targetX, targetY)
          ctx.stroke()
        })
        ctx.restore()

        // 4. Draw a pulsing target impact ring
        const impactR = 10 + Math.sin(t * 0.08) * 4
        const grad = ctx.createRadialGradient(targetX, targetY, 1, targetX, targetY, impactR)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.3, `rgba(${beamColor}, 0.8)`)
        grad.addColorStop(1, `rgba(${beamColor}, 0.0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(targetX, targetY, impactR, 0, Math.PI * 2)
        ctx.fill()

        // Spawn combat sparks periodically
        if (Math.random() < 0.35) {
          particles.push({
            x: targetX,
            y: targetY,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 1.0,
            color: firewallType === 2 ? '#ef4444' : '#60a5fa',
            alpha: 1.0,
            size: 1.5 + Math.random() * 2,
          })
        }

        // Decryption health percentage overlay above target wall
        ctx.fillStyle = '#ffffff'
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        const label = firewallType === 2
          ? `BYPASSING FIREWALL: ${Math.round(firewallHealthRef.current)}%`
          : `DECRYPTING CORE PORT: ${Math.round(firewallHealthRef.current)}%`
        ctx.fillText(label, W / 2, H * 0.23)
        ctx.textAlign = 'left'
      }

      // ── Update and render explosion particles ──────────────────────────────
      ctx.save()
      particles = particles.filter((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.09
        p.alpha -= dt * 1.6

        if (p.alpha <= 0) return false

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
        return true
      })
      ctx.restore()

      // ── HUD Panel at bottom ────────────────────────────────────────────────
      const hudY = viewH
      const hudH = H - viewH

      ctx.fillStyle = '#010903'
      ctx.fillRect(0, hudY, W, hudH)
      ctx.strokeStyle = '#05310b'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(0, hudY)
      ctx.lineTo(W, hudY)
      ctx.stroke()

      const fSize = Math.max(7, Math.min(9, hudH * 0.28))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      const c1 = 6
      const c2 = W * 0.36
      const c3 = W * 0.70
      const ty1 = hudY + hudH * 0.12
      const ty2 = hudY + hudH * 0.58

      // Hacking packet buffers
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(c1, ty1, W * 0.3, fSize * 0.8)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(c1, ty1, W * 0.3 * (integrity / 100), fSize * 0.8)
      ctx.fillStyle = '#4ade80'
      ctx.fillText(`INTEGRITY: ${integrity}%`, c1, ty2)

      // Ports and speed stats
      ctx.fillStyle = '#a3e635'
      ctx.fillText(`DECRYPT: ${decryptRate} KB/s`, c2, ty1)
      ctx.fillStyle = '#60a5fa'
      ctx.fillText(`BYPASSED: ${portsCompromised}/2`, c2, ty2)

      // Hacking diagnostic numbers
      ctx.fillStyle = '#16a34a'
      ctx.fillText(`PACKETS: ${Math.round(packetsSent)}`, c3, ty1)
      ctx.fillStyle = '#22c55e'
      ctx.fillText(`NODE: COMPILING`, c3, ty2)

      // ── Mini-Map (top right) ────────────────────────────────────────────────
      const mmSize = Math.min(W * 0.22, viewH * 0.32)
      const mmTile = mmSize / TILE_W
      const mmX    = W - mmSize - 6
      const mmY    = 6

      // Radar style transparent background
      ctx.fillStyle = 'rgba(1, 8, 3, 0.75)'
      ctx.fillRect(mmX, mmY, mmSize, mmSize)

      // Draw subtle grid lines on the minimap
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.05)'
      ctx.lineWidth = 0.5
      for (let i = 0; i <= mmSize; i += mmSize / 5) {
        ctx.beginPath()
        ctx.moveTo(mmX + i, mmY)
        ctx.lineTo(mmX + i, mmY + mmSize)
        ctx.moveTo(mmX, mmY + i)
        ctx.lineTo(mmX + mmSize, mmY + i)
        ctx.stroke()
      }

      // Draw walls as sleek neon lines rather than solid blocks
      for (let ty = 0; ty < TILE_H; ty++) {
        for (let tx = 0; tx < TILE_W; tx++) {
          const val = walls[ty][tx]
          if (val === 1) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'
            ctx.fillRect(mmX + tx * mmTile + 0.5, mmY + ty * mmTile + 0.5, mmTile - 1, mmTile - 1)
          } else if (val === 2) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)' // red firewall
            ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile, mmTile)
          } else if (val === 3) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.4)' // blue exit
            ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile, mmTile)
          }
        }
      }

      // Player node - draw as a tiny glowing wedge pointing in the direction of travel
      const ppx = mmX + posX * mmTile
      const ppy = mmY + posY * mmTile
      ctx.save()
      ctx.translate(ppx, ppy)
      ctx.rotate(angle)
      ctx.fillStyle = '#4ade80'
      ctx.beginPath()
      ctx.moveTo(mmTile * 1.8, 0)
      ctx.lineTo(-mmTile * 1.2, -mmTile * 1.0)
      ctx.lineTo(-mmTile * 0.7, 0)
      ctx.lineTo(-mmTile * 1.2, mmTile * 1.0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Radar style circular target rings
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(mmX, mmY, mmSize, mmSize)

      // ── Event Overlay Message ──────────────────────────────────────────────
      if (eventAlpha > 0.01) {
        const evFSize = Math.max(6, Math.min(10, W * 0.038))
        ctx.font = `bold ${evFSize}px monospace`
        ctx.textBaseline = 'top'
        const evW = ctx.measureText(eventText).width + 12
        const evX = (W - evW) / 2
        const evY = viewH * 0.06

        ctx.fillStyle = `rgba(1,9,2,${eventAlpha * 0.9})`
        ctx.fillRect(evX - 4, evY - 2, evW + 4, evFSize + 6)
        ctx.strokeStyle = `rgba(34,197,94,${eventAlpha * 0.65})`
        ctx.lineWidth = 0.8
        ctx.strokeRect(evX - 4, evY - 2, evW + 4, evFSize + 6)
        ctx.fillStyle = `rgba(34,197,94,${eventAlpha})`
        ctx.fillText('► ' + eventText, evX, evY + 2)
      }

      // ── Exit dialog ────────────────────────────────────────────────────────
      if (exitDialogTimer > 0 && exitDialogAlpha > 0.01) {
        const dlgFSize = Math.max(7, Math.min(9, W * 0.026))
        ctx.font = `${dlgFSize}px monospace`
        ctx.textBaseline = 'top'

        let maxW = 0
        for (const line of EXIT_LINES) {
          const lw = ctx.measureText(line).width
          if (lw > maxW) maxW = lw
        }
        const lineH  = dlgFSize * 1.5
        const boxW   = maxW + 24
        const boxH   = EXIT_LINES.length * lineH + 16
        const boxX   = (W - boxW) / 2
        const boxY   = viewH / 2 - boxH / 2

        ctx.fillStyle = `rgba(1,8,2,${exitDialogAlpha * 0.95})`
        ctx.fillRect(boxX, boxY, boxW, boxH)
        ctx.strokeStyle = `rgba(239,68,68,${exitDialogAlpha * 0.9})`
        ctx.lineWidth = 1.5
        ctx.strokeRect(boxX, boxY, boxW, boxH)

        ctx.fillStyle = `rgba(220,252,231,${exitDialogAlpha})`
        for (let i = 0; i < EXIT_LINES.length; i++) {
          ctx.fillText(EXIT_LINES[i], boxX + 12, boxY + 8 + i * lineH)
        }
      }
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
    <Panel title="VIRTUAL NETRUNNER // INTRUSION 3D">
      <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
        />
      </div>
    </Panel>
  )
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f
}

export default memo(DaggerfallPanel)
