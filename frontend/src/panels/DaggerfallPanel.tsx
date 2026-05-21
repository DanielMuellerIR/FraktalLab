import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// DaggerfallPanel — "Castle Pixelstein Alpha 0.1"
// Raycasting-Dungeon mit prozedural generiertem Labyrinth (DFS-Backtracker),
// BFS-Wegfindung und KI-Spieler, der den Ausgang sucht.
// ─────────────────────────────────────────────────────────────────────────────

// ── Maze-Konfiguration ────────────────────────────────────────────────────────
// Labyrinth-Zellenraster: MAZE_COLS × MAZE_ROWS Zellen.
// Jede Zelle hat 4 mögliche Wände (N/E/S/W).
// In World-Koordinaten ist jede Zelle 1.0 Einheit groß (= 1 Tile für den Raycaster).
const MAZE_COLS = 15   // Anzahl Zellen horizontal
const MAZE_ROWS = 15   // Anzahl Zellen vertikal

// Jede Zelle braucht Zellen + 1 Tile für Außenwände.
// Die Wall-Map hat (2*MAZE_COLS+1) × (2*MAZE_ROWS+1) Tiles.
// Ungerade Indizes = Zell-Mittelpunkt (Boden), gerade Indizes = Wand.
const TILE_W = 2 * MAZE_COLS + 1   // = 31
const TILE_H = 2 * MAZE_ROWS + 1   // = 31

// ── Wand-Farbtöne ─────────────────────────────────────────────────────────────
// Grüner Phosphor-Effekt. side=0 = X-seitige Wand (heller), side=1 = Y-seitig.
function getWallColor(side: 0 | 1, dist: number, isExit: boolean): string {
  if (isExit) {
    // Ausgangs-Wand: dunkles Rot-Braun
    const fog = Math.max(0, 1 - dist / 10)
    const r   = Math.round((side === 0 ? 180 : 110) * fog)
    const g   = Math.round(r * 0.15)
    return `rgb(${r},${g},0)`
  }
  const base = side === 0 ? 140 : 80
  const fog  = Math.max(0, 1 - dist / 10)
  const gv   = Math.round(base * fog)
  return `rgb(${Math.round(gv * 0.15)},${gv},${Math.round(gv * 0.08)})`
}

// ── Event-Meldungen ────────────────────────────────────────────────────────────
const EVENTS = [
  'CAVE TROLL DEFEATED!',
  'FOUND: Scroll of C',
  'CRITICAL HIT! +82 EXP',
  'DOOR UNLOCKED',
  'ITEM: Iron Key',
  'DARK ELF FLED!',
  'TRAP DISARMED',
  'SOUL GEM SHATTERED',
  'LEVEL UP! LVL 9',
  'CURSED DAGGER FOUND',
  'RATS EXTERMINATED',
  'SECRET PASSAGE FOUND',
]

// ── Ausgangs-Dialog ───────────────────────────────────────────────────────────
// Wird angezeigt, wenn der Spieler den Ausgang erreicht.
const EXIT_LINES = [
  '╔══════════════════════════════════════════╗',
  '║ Der Mann in Schwarz floh durch die       ║',
  '║ Wüste, und der Revolvermann folgte ihm.  ║',
  '╚══════════════════════════════════════════╝',
]

// ─────────────────────────────────────────────────────────────────────────────
// Maze-Generierung: Recursive Backtracker (DFS)
// Erzeugt ein Labyrinth als 2D-Boolean-Array (true = Wand).
// Die Wall-Map hat (2*COLS+1) × (2*ROWS+1) Tiles:
//   - Zellen sitzen an ungeraden Indizes (1,3,5,…)
//   - Wände sitzen an geraden Indizes (0,2,4,…)
// ─────────────────────────────────────────────────────────────────────────────
function generateMaze(): boolean[][] {
  // Alle Tiles zunächst als Wand initialisieren
  const walls: boolean[][] = Array.from({ length: TILE_H }, () =>
    Array(TILE_W).fill(true)
  )

  // Hilfs-Array: welche Zellen wurden schon besucht?
  const visited: boolean[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array(MAZE_COLS).fill(false)
  )

  // Zell-Koordinate (row, col) → Tile-Koordinate (tileY, tileX) des Zell-Zentrums
  function cellToTile(row: number, col: number): [number, number] {
    return [row * 2 + 1, col * 2 + 1]
  }

  // Zell-Zentrum in Tile-Map als begehbar markieren
  function openCell(row: number, col: number) {
    const [ty, tx] = cellToTile(row, col)
    walls[ty][tx] = false
  }

  // Wand zwischen zwei Nachbar-Zellen öffnen (den Tile dazwischen)
  function openWall(r1: number, c1: number, r2: number, c2: number) {
    const ty = r1 * 2 + 1 + (r2 - r1)   // Tile-Y der Wand
    const tx = c1 * 2 + 1 + (c2 - c1)   // Tile-X der Wand
    walls[ty][tx] = false
  }

  // DFS-Backtracker: iterativ mit explizitem Stack
  const stack: [number, number][] = []
  const startR = 0
  const startC = 0

  visited[startR][startC] = true
  openCell(startR, startC)
  stack.push([startR, startC])

  // Nachbar-Richtungen: [dRow, dCol]
  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]]

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1]

    // Unbesuchte Nachbarn sammeln
    const neighbors: [number, number][] = []
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < MAZE_ROWS && nc >= 0 && nc < MAZE_COLS && !visited[nr][nc]) {
        neighbors.push([nr, nc])
      }
    }

    if (neighbors.length === 0) {
      // Backtrack
      stack.pop()
    } else {
      // Zufälligen Nachbarn wählen und Wand öffnen
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

// ─────────────────────────────────────────────────────────────────────────────
// BFS-Wegfindung: Findet den kürzesten Pfad von Start- zu Ziel-Zelle.
// Gibt eine Liste von World-Koordinaten (Zell-Mitten) zurück.
// ─────────────────────────────────────────────────────────────────────────────
function bfsPath(
  walls: boolean[][],
  startRow: number, startCol: number,
  exitRow:  number, exitCol:  number
): [number, number][] {
  // Jede Zell-Mitte sitzt im Tile-Raum bei (2*row+1, 2*col+1),
  // in World-Koordinaten entspricht das (col*2+1 + 0.5, row*2+1 + 0.5).
  // Wir arbeiten hier im Zell-Raster (nicht Tile-Raster).

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
      // Wand zwischen (r,c) und (nr,nc) prüfen
      const wallR = r * 2 + 1 + dr
      const wallC = c * 2 + 1 + dc
      if (walls[wallR][wallC]) continue   // Wand → nicht begehbar

      visited[nr][nc] = true
      parent[nr][nc] = [r, c]
      queue.push([nr, nc])
    }
  }

  // Pfad rückwärts rekonstruieren
  const path: Cell[] = []
  let cur: Cell | null = [exitRow, exitCol]
  while (cur !== null) {
    path.unshift(cur)
    const pr: number = cur[0]
    const pc: number = cur[1]
    cur = parent[pr][pc]
  }

  // In World-Koordinaten umrechnen.
  // Tile-Mitte einer Zelle (row, col) liegt bei:
  //   worldX = (col * 2 + 1) + 0.5  = col * 2 + 1.5
  //   worldY = (row * 2 + 1) + 0.5  = row * 2 + 1.5
  return path.map(([r, c]) => [c * 2 + 1.5, r * 2 + 1.5])
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DaggerfallPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas   = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    const canvas: HTMLCanvasElement        = _canvas
    const ctx:    CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive = true

    // ── Canvas-Größe dynamisch anpassen ─────────────────────────────────────
    const resize = () => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Labyrinth-Zustand ────────────────────────────────────────────────────
    let walls: boolean[][] = []
    let waypoints: [number, number][] = []  // Liste von World-Koordinaten
    let waypointIdx = 0                      // Nächstes anzufahrendes Wegpunkt-Idx

    // Exit-Zell-Position (in World-Koordinaten)
    const EXIT_ROW = MAZE_ROWS - 1
    const EXIT_COL = MAZE_COLS - 1

    // Exit-Wand Tile-Koordinaten (die Außenwand rechts/unten neben der Exit-Zelle)
    // Wir merken uns die Tile-Koordinaten der Exit-Zell-Mitte für die Ausgangs-Erkennung
    const exitWorldX = EXIT_COL * 2 + 1.5
    const exitWorldY = EXIT_ROW * 2 + 1.5

    // ── Spieler-Zustand ──────────────────────────────────────────────────────
    let posX  = 0
    let posY  = 0
    let angle = 0

    // ── Exit-Dialog-Zustand ──────────────────────────────────────────────────
    let exitDialogTimer = 0    // > 0 → Dialog wird angezeigt (Countdown in Sekunden)
    let exitDialogAlpha = 0    // Einblend-Deckkraft

    // ── KI-Bewegungs-Parameter ───────────────────────────────────────────────
    const MOVE_SPEED  = 3.0   // Welteinheiten/Sekunde
    const TURN_SPEED  = 2.5   // Radiant/Sekunde
    const WAYP_RADIUS = 0.4   // Ankunfts-Radius um einen Wegpunkt

    // ── RPG-Stats ────────────────────────────────────────────────────────────
    let hp    = 87
    let mana  = 54
    let gold  = 1337
    const level = 8
    let stepTimer = 0

    // ── Event-Overlay ─────────────────────────────────────────────────────────
    let eventText  = ''
    let eventAlpha = 0
    let eventTimer = 2000   // ms bis erstes Event

    // ── Neues Labyrinth starten ───────────────────────────────────────────────
    function startNewMaze() {
      walls = generateMaze()
      // Wegpunkte via BFS berechnen
      waypoints = bfsPath(walls, 0, 0, EXIT_ROW, EXIT_COL)
      waypointIdx = 0
      // Spieler startet in Zell-Mitte (0,0)
      posX  = 0 * 2 + 1.5   // = 1.5
      posY  = 0 * 2 + 1.5   // = 1.5
      // Blickrichtung zum ersten Wegpunkt (dem nächsten nach dem Start)
      if (waypoints.length > 1) {
        const [wx, wy] = waypoints[1]
        angle = Math.atan2(wy - posY, wx - posX)
      } else {
        angle = 0
      }
      exitDialogTimer = 0
      exitDialogAlpha = 0
    }

    // Beim Start direkt ein Labyrinth erzeugen
    startNewMaze()

    // ── Kollision: Tile-Map-Lookup ────────────────────────────────────────────
    function isWalkable(x: number, y: number): boolean {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      if (tx < 0 || ty < 0 || tx >= TILE_W || ty >= TILE_H) return false
      return !walls[ty][tx]
    }

    // ── Hilfe: kürzester Winkelunterschied (in Radiant, Wertebereich −π … +π) ─
    function angleDiff(target: number, current: number): number {
      let d = target - current
      while (d >  Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      return d
    }

    // ── Haupt-Loop ────────────────────────────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.08)  // max 80 ms Cap
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // ── Exit-Dialog-Sequenz ──────────────────────────────────────────────
      if (exitDialogTimer > 0) {
        // Einblenden in den ersten 0.4 Sekunden
        exitDialogAlpha = Math.min(1, exitDialogAlpha + dt / 0.4)
        exitDialogTimer -= dt
        if (exitDialogTimer <= 0) {
          // Dialog abgelaufen → neues Labyrinth
          startNewMaze()
        }
        // Spieler bleibt stehen während Dialog läuft → Rendering trotzdem ausführen
      } else {
        // ── KI-Bewegung (nur wenn kein Exit-Dialog) ─────────────────────────
        if (waypointIdx < waypoints.length) {
          const [wx, wy] = waypoints[waypointIdx]
          const dx = wx - posX
          const dy = wy - posY
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < WAYP_RADIUS) {
            // Wegpunkt erreicht → nächsten ansteuern
            waypointIdx++
          } else {
            // Zielwinkel berechnen
            const targetAngle = Math.atan2(dy, dx)
            const diff = angleDiff(targetAngle, angle)

            // Maximale Drehung pro Frame
            const maxTurn = TURN_SPEED * dt

            if (Math.abs(diff) > 0.05) {
              // Noch nicht ausgerichtet → drehen (aber vorwärts bewegen erlaubt)
              angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn)
            }

            // Vorwärtsbewegung (auch während des Drehens, nur gebremst bei starkem Winkel)
            const alignment = Math.cos(diff)  // 1 = perfekt ausgerichtet, -1 = falsche Richtung
            if (alignment > 0.1) {
              const speed  = MOVE_SPEED * Math.max(0.3, alignment) * dt
              const nx     = posX + Math.cos(angle) * speed
              const ny     = posY + Math.sin(angle) * speed
              if (isWalkable(nx, posY)) posX = nx
              if (isWalkable(posX, ny)) posY = ny
            }
          }
        } else {
          // Alle Wegpunkte abgearbeitet → Ausgang erreicht
          const dxE = exitWorldX - posX
          const dyE = exitWorldY - posY
          const distToExit = Math.sqrt(dxE * dxE + dyE * dyE)

          if (distToExit < 2.5 && exitDialogTimer === 0) {
            exitDialogTimer = 3.0   // Dialog 3 Sekunden zeigen
            exitDialogAlpha = 0
          }
        }
      }

      // ── RPG-Stats zufällig fluktuieren ────────────────────────────────────
      stepTimer += dt
      if (stepTimer > 0.8) {
        stepTimer = 0
        hp   = Math.max(10, Math.min(100, hp   + (Math.random() > 0.5 ? 1 : -1)))
        mana = Math.max(0,  Math.min(100, mana + (Math.random() > 0.4 ? 2 : -1)))
        gold += Math.floor(Math.random() * 3)
      }

      // ── Event-Overlay-Timing ───────────────────────────────────────────────
      eventTimer -= dt * 1000
      if (eventTimer <= 0) {
        eventText  = EVENTS[Math.floor(Math.random() * EVENTS.length)]
        eventAlpha = 1.0
        eventTimer = 6000 + Math.random() * 8000
      }
      if (eventAlpha > 0) {
        eventAlpha = Math.max(0, eventAlpha - dt * 0.5)
      }

      // ── Rendering ──────────────────────────────────────────────────────────

      // Hintergrund
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // ── Decke und Boden ────────────────────────────────────────────────────
      const ceilGrad = ctx.createLinearGradient(0, 0, 0, H / 2)
      ceilGrad.addColorStop(0, '#000800')
      ceilGrad.addColorStop(1, '#001200')
      ctx.fillStyle = ceilGrad
      ctx.fillRect(0, 0, W, H / 2)

      const floorGrad = ctx.createLinearGradient(0, H / 2, 0, H)
      floorGrad.addColorStop(0, '#010f01')
      floorGrad.addColorStop(1, '#000500')
      ctx.fillStyle = floorGrad
      ctx.fillRect(0, H / 2, W, H / 2)

      // ── Raycasting ─────────────────────────────────────────────────────────
      // HUD-Bereich reservieren (untere 25%)
      const viewH  = Math.floor(H * 0.75)
      const FOV    = Math.PI / 3    // 60° Sichtfeld
      const halfFOV = FOV / 2
      const numRays = W             // ein Strahl pro Pixel-Spalte

      for (let col = 0; col < numRays; col++) {
        const rayAngle = angle - halfFOV + (col / numRays) * FOV

        const rdx = Math.cos(rayAngle)
        const rdy = Math.sin(rayAngle)

        // DDA-Setup
        let mapX = Math.floor(posX)
        let mapY = Math.floor(posY)

        const deltaDistX = rdx === 0 ? 1e30 : Math.abs(1 / rdx)
        const deltaDistY = rdy === 0 ? 1e30 : Math.abs(1 / rdy)

        const stepX = rdx < 0 ? -1 : 1
        const stepY = rdy < 0 ? -1 : 1

        let sideDistX = rdx < 0
          ? (posX - mapX) * deltaDistX
          : (mapX + 1.0 - posX) * deltaDistX
        let sideDistY = rdy < 0
          ? (posY - mapY) * deltaDistY
          : (mapY + 1.0 - posY) * deltaDistY

        let side: 0 | 1 = 0
        let hit  = false
        let dist = 0
        let hitX = 0   // Tile-X des getroffenen Tiles
        let hitY = 0   // Tile-Y des getroffenen Tiles

        // DDA: Schritt für Schritt vorwärts
        for (let step = 0; step < 64 && !hit; step++) {
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
            if (walls[mapY][mapX]) {
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

        // Perpendiculare Distanz (kein Fish-Eye)
        if (side === 0) dist = sideDistX - deltaDistX
        else            dist = sideDistY - deltaDistY
        dist = Math.max(0.1, dist)

        // Ausgangs-Wand erkennen: Tile direkt neben der Exit-Zell-Mitte
        // Exit-Zelle sitzt bei Tile (EXIT_ROW*2+1, EXIT_COL*2+1)
        const exitTileX = EXIT_COL * 2 + 1
        const exitTileY = EXIT_ROW * 2 + 1
        const isExit =
          Math.abs(hitX - exitTileX) <= 1 &&
          Math.abs(hitY - exitTileY) <= 1

        // Wandhöhe berechnen und zeichnen
        const wallH = Math.min(viewH, Math.round(viewH / dist))
        const wallTop = Math.round(viewH / 2 - wallH / 2)

        ctx.fillStyle = getWallColor(side, dist, isExit)
        ctx.fillRect(col, wallTop, 1, wallH)
      }

      // ── HUD ────────────────────────────────────────────────────────────────
      const hudY = viewH
      const hudH = H - viewH

      ctx.fillStyle = '#000a00'
      ctx.fillRect(0, hudY, W, hudH)
      ctx.strokeStyle = '#1a5c1a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, hudY)
      ctx.lineTo(W, hudY)
      ctx.stroke()

      const fSize = Math.max(7, Math.min(12, hudH * 0.3))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      const c1 = 6
      const c2 = W * 0.35
      const c3 = W * 0.68
      const ty1 = hudY + hudH * 0.1
      const ty2 = hudY + hudH * 0.55

      // HP-Balken
      ctx.fillStyle = '#555'
      ctx.fillRect(c1, ty1, W * 0.28, fSize * 0.8)
      ctx.fillStyle = '#00cc44'
      ctx.fillRect(c1, ty1, W * 0.28 * (hp / 100), fSize * 0.8)
      ctx.fillStyle = '#33ff66'
      ctx.fillText(`HP: ${hp}/100`, c1, ty2)

      // Mana-Balken
      ctx.fillStyle = '#333'
      ctx.fillRect(c2, ty1, W * 0.28, fSize * 0.8)
      ctx.fillStyle = '#0044ff'
      ctx.fillRect(c2, ty1, W * 0.28 * (mana / 100), fSize * 0.8)
      ctx.fillStyle = '#66aaff'
      ctx.fillText(`MP: ${mana}/100`, c2, ty2)

      // Gold und Level
      ctx.fillStyle = '#ccaa00'
      ctx.fillText(`GOLD: ${gold}`, c3, ty1)
      ctx.fillStyle = '#44ff88'
      ctx.fillText(`LVL: ${level}`, c3, ty2)

      // ── Mini-Map (oben rechts) ──────────────────────────────────────────────
      // Zeigt das komplette Tile-Raster des Labyrinths.
      const mmSize = Math.min(W * 0.22, viewH * 0.32)   // Gesamt-Größe
      const mmTile = mmSize / TILE_W                      // Pixel pro Tile
      const mmX    = W - mmSize - 4
      const mmY    = 4

      ctx.fillStyle = 'rgba(0,10,0,0.75)'
      ctx.fillRect(mmX, mmY, mmSize, mmSize)

      // Tiles zeichnen
      for (let ty = 0; ty < TILE_H; ty++) {
        for (let tx = 0; tx < TILE_W; tx++) {
          if (walls[ty][tx]) {
            // Wand: dunkles Grün
            ctx.fillStyle = '#0a3a0a'
          } else {
            // Passierbar: helleres Grün-Grau
            ctx.fillStyle = '#0e1f0e'
          }
          ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile, mmTile)
        }
      }

      // Ausgangs-Markierung auf Mini-Map (rotes Kästchen)
      const emX = mmX + (EXIT_COL * 2 + 1) * mmTile
      const emY = mmY + (EXIT_ROW * 2 + 1) * mmTile
      ctx.fillStyle = 'rgba(200,40,0,0.8)'
      ctx.fillRect(emX, emY, mmTile, mmTile)

      // Spieler-Punkt auf Mini-Map
      const ppx = mmX + posX * mmTile
      const ppy = mmY + posY * mmTile
      ctx.fillStyle = '#00ff60'
      ctx.beginPath()
      ctx.arc(ppx, ppy, mmTile * 0.9, 0, Math.PI * 2)
      ctx.fill()

      // Blickrichtungs-Pfeil
      ctx.strokeStyle = '#00ff60'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(ppx, ppy)
      ctx.lineTo(ppx + Math.cos(angle) * mmTile * 2.5, ppy + Math.sin(angle) * mmTile * 2.5)
      ctx.stroke()

      // Mini-Map-Rahmen
      ctx.strokeStyle = '#1a5c1a'
      ctx.lineWidth = 0.8
      ctx.strokeRect(mmX, mmY, mmSize, mmSize)

      // ── Spiel-Titel auf Mini-Map ──────────────────────────────────────────
      const titleFSize = Math.max(5, Math.min(8, mmSize * 0.08))
      ctx.font = `${titleFSize}px monospace`
      ctx.fillStyle = 'rgba(0,255,80,0.5)'
      ctx.textBaseline = 'bottom'
      ctx.fillText('Castle Pixelstein α0.1', mmX, mmY - 1)
      ctx.textBaseline = 'top'

      // ── Event-Overlay ──────────────────────────────────────────────────────
      if (eventAlpha > 0.01) {
        const evFSize = Math.max(8, Math.min(14, W * 0.04))
        ctx.font = `bold ${evFSize}px monospace`
        ctx.textBaseline = 'top'
        const evW = ctx.measureText(eventText).width + 12
        const evX = (W - evW) / 2
        const evY = viewH * 0.07

        ctx.fillStyle = `rgba(0,20,0,${eventAlpha * 0.85})`
        ctx.fillRect(evX - 4, evY - 2, evW + 4, evFSize + 6)
        ctx.strokeStyle = `rgba(0,255,80,${eventAlpha * 0.6})`
        ctx.lineWidth = 0.8
        ctx.strokeRect(evX - 4, evY - 2, evW + 4, evFSize + 6)
        ctx.fillStyle = `rgba(0,255,80,${eventAlpha})`
        ctx.fillText('► ' + eventText, evX, evY + 2)
      }

      // ── Exit-Dialog ────────────────────────────────────────────────────────
      if (exitDialogTimer > 0 && exitDialogAlpha > 0.01) {
        const dlgFSize = Math.max(8, Math.min(13, W * 0.028))
        ctx.font = `${dlgFSize}px monospace`
        ctx.textBaseline = 'top'

        // Box-Größe anhand der längsten Zeile
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

        // Hintergrund
        ctx.fillStyle = `rgba(0,8,0,${exitDialogAlpha * 0.95})`
        ctx.fillRect(boxX, boxY, boxW, boxH)
        ctx.strokeStyle = `rgba(180,40,0,${exitDialogAlpha * 0.9})`
        ctx.lineWidth = 1.5
        ctx.strokeRect(boxX, boxY, boxW, boxH)

        // Zeilen ausgeben
        ctx.fillStyle = `rgba(200,240,180,${exitDialogAlpha})`
        for (let i = 0; i < EXIT_LINES.length; i++) {
          ctx.fillText(EXIT_LINES[i], boxX + 12, boxY + 8 + i * lineH)
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    // Animation starten
    rafId = requestAnimationFrame((t) => { lastT = t; eventTimer = 2000; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="Castle Pixelstein Alpha 0.1">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}
