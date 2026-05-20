import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// DaggerfallPanel: Simuliert ein Retro-DOS-RPG-Dungeon (Wolfenstein-3D-Stil).
// Raycasting auf 16×16-Tile-Map. Kamera bewegt sich automatisch (KI-Spieler).
// ─────────────────────────────────────────────────────────────────────────────

// ── Dungeon-Map 16×16 ────────────────────────────────────────────────────────
// 1 = Wand, 0 = freies Feld. Die Map ist als Array von Zahlenreihen definiert.
// Jede Reihe entspricht einer Zeile (Y-Achse), jede Zahl einer Spalte (X-Achse).
const MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,0,1,0,1,1,1,0,1,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,1,0,0,1,0,1],
  [1,0,0,0,1,0,1,1,0,0,1,0,0,0,0,1],
  [1,0,1,0,1,0,0,0,0,1,1,1,0,1,0,1],
  [1,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1],
  [1,0,0,0,1,0,1,0,1,0,1,1,0,0,0,1],
  [1,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1],
  [1,0,0,1,1,1,0,1,1,0,0,0,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,1],
  [1,0,1,1,0,0,0,1,0,0,1,0,1,1,0,1],
  [1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,1,0,0,0,1,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

const MAP_W = 16
const MAP_H = 16

// ── Wand-Farbtöne für Grüntöne ───────────────────────────────────────────────
// Helle Seite (senkrechte Wände = kürzerer Strahlweg) und dunkle Seite (waagrecht).
// Die Wand-Helligkeit nimmt mit der Distanz ab (Fog-Effekt).
function getWallColor(side: 0 | 1, dist: number): string {
  // side=0: Wand in X-Richtung getroffen (heller), side=1: Y-Richtung (dunkler)
  const base = side === 0 ? 140 : 80   // Grün-Basis-Helligkeit (0–255)
  // Mit der Distanz abnehmen (max Sichtweite ca. 12 Tiles)
  const fog  = Math.max(0, 1 - dist / 10)
  const g    = Math.round(base * fog)
  // Grüner Ton: R sehr niedrig, G variabel, B fast null
  return `rgb(${Math.round(g * 0.15)},${g},${Math.round(g * 0.08)})`
}

// ── Gelegentliche Status-Meldungen ───────────────────────────────────────────
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

    // ── Kamera-Zustand ───────────────────────────────────────────────────────
    // posX/posY: Position des Spielers auf der Map (in Tile-Koordinaten, float)
    // angle: Blickwinkel in Radiant (0 = nach rechts/+X)
    let posX  = 1.5   // Startposition: zweites Tile von links
    let posY  = 1.5   // zweites Tile von oben
    let angle = 0.3   // Startblickwinkel leicht nach rechts-unten

    // ── KI-Bewegungs-Zustand ─────────────────────────────────────────────────
    // Die KI bewegt sich immer vorwärts und dreht nur bei Wand-Kontakt.
    let stepTimer  = 0    // Akkumulator für Bewegungsschritte (in Sekunden)
    const moveSpeed  = 2.0  // Tiles/Sekunde
    const turnSpeed  = 1.4  // Radiant/Sekunde
    let turning    = false  // gerade am Drehen?
    let turnDir    = 1      // +1 = rechts drehen, -1 = links drehen
    let turnLeft   = 0      // noch zu drehendes Winkelmaß (in Radiant)

    // ── RPG-Stats (hardcoded, zeigen nur zufällige Fluktuationen) ───────────
    let hp    = 87
    let mana  = 54
    let gold  = 1337
    const level  = 8

    // ── Event-Overlay-Zustand ─────────────────────────────────────────────────
    let eventText    = ''
    let eventAlpha   = 0     // Deckkraft 0..1
    let eventTimer   = 0     // ms bis nächstes Event

    // ── Hilfe: prüfen ob Position (x,y) begehbar ist ─────────────────────────
    function isWalkable(x: number, y: number): boolean {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false
      return MAP[ty][tx] === 0
    }

    // ── Haupt-Loop ────────────────────────────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.08)  // Delta-Zeit in Sekunden
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // ── KI-Bewegung ────────────────────────────────────────────────────────

      if (turning) {
        // Drehen bis turnLeft = 0
        const dAngle = turnSpeed * dt * turnDir
        if (Math.abs(dAngle) >= Math.abs(turnLeft)) {
          angle    += turnLeft
          turning   = false
          turnLeft  = 0
        } else {
          angle    += dAngle
          turnLeft -= dAngle
        }
      } else {
        // Vorwärtsbewegung
        const dx  = Math.cos(angle) * moveSpeed * dt
        const dy  = Math.sin(angle) * moveSpeed * dt
        const nx  = posX + dx
        const ny  = posY + dy

        // Kollisionserkennung: X und Y separat prüfen (Wandgleiten)
        if (isWalkable(nx, posY)) posX = nx
        else {
          // Wand vorne → Drehung einleiten
          turning  = true
          turnDir  = Math.random() > 0.5 ? 1 : -1
          // Drehwinkel: 60–120 Grad
          turnLeft = (Math.PI / 3) + Math.random() * (Math.PI / 3)
        }
        if (isWalkable(posX, ny)) posY = ny
      }

      // ── RPG-Stats zufällig fluktuieren ──────────────────────────────────
      stepTimer += dt
      if (stepTimer > 0.8) {
        stepTimer = 0
        hp    = Math.max(10, Math.min(100, hp   + (Math.random() > 0.5 ? 1 : -1)))
        mana  = Math.max(0,  Math.min(100, mana + (Math.random() > 0.4 ? 2 : -1)))
        gold += Math.floor(Math.random() * 3)
      }

      // ── Event-Overlay-Timing ─────────────────────────────────────────────
      eventTimer -= dt * 1000
      if (eventTimer <= 0) {
        // Neues zufälliges Event
        eventText  = EVENTS[Math.floor(Math.random() * EVENTS.length)]
        eventAlpha = 1.0
        eventTimer = 6000 + Math.random() * 8000  // nächstes Event in 6–14s
      }
      // Langsam ausblenden
      if (eventAlpha > 0) {
        eventAlpha = Math.max(0, eventAlpha - dt * 0.5)
      }

      // ── Rendering ─────────────────────────────────────────────────────────

      // Hintergrund löschen
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // ── Boden und Decke ───────────────────────────────────────────────────
      // Decke: sehr dunkles Grün oben
      const ceilGrad = ctx.createLinearGradient(0, 0, 0, H / 2)
      ceilGrad.addColorStop(0, '#000800')
      ceilGrad.addColorStop(1, '#001200')
      ctx.fillStyle = ceilGrad
      ctx.fillRect(0, 0, W, H / 2)

      // Boden: etwas heller als Decke, Stein-ähnlich
      const floorGrad = ctx.createLinearGradient(0, H / 2, 0, H)
      floorGrad.addColorStop(0, '#010f01')
      floorGrad.addColorStop(1, '#000500')
      ctx.fillStyle = floorGrad
      ctx.fillRect(0, H / 2, W, H / 2)

      // ── Raycasting ────────────────────────────────────────────────────────
      // Wir casten für jede Pixel-Spalte einen Strahl und berechnen die Wandhöhe.
      // Blickfeld (FOV): 66° = ±33° vom Mittelpunkt.
      const FOV    = Math.PI / 3   // 60° in Radiant
      const halfFOV = FOV / 2

      // Anzahl der zu castenden Strahlen = Breite des 3D-Bereichs
      // Der untere Teil (ca. 25%) ist für den HUD reserviert
      const viewH  = Math.floor(H * 0.75)
      const numRays = W  // ein Strahl pro Pixel-Spalte

      for (let col = 0; col < numRays; col++) {
        // Winkel dieses Strahls: links = -halfFOV, rechts = +halfFOV
        const rayAngle = angle - halfFOV + (col / numRays) * FOV

        // Richtungsvektor des Strahls
        const rdx = Math.cos(rayAngle)
        const rdy = Math.sin(rayAngle)

        // DDA-Algorithmus (Digital Differential Analyzer) für effizientes Raycasting.
        // Wir laufen in Tile-Schritten bis wir eine Wand treffen.

        // Aktuelle Tile-Koordinaten (ganzzahlig)
        let mapX = Math.floor(posX)
        let mapY = Math.floor(posY)

        // Länge des Strahls für einen Schritt in X- bzw. Y-Richtung
        const deltaDistX = rdx === 0 ? 1e30 : Math.abs(1 / rdx)
        const deltaDistY = rdy === 0 ? 1e30 : Math.abs(1 / rdy)

        // Richtung des Schritts (± 1 pro Achse)
        const stepX = rdx < 0 ? -1 : 1
        const stepY = rdy < 0 ? -1 : 1

        // Anfangsdistanzen zur ersten Gitterlinie
        let sideDistX = rdx < 0
          ? (posX - mapX) * deltaDistX
          : (mapX + 1.0 - posX) * deltaDistX
        let sideDistY = rdy < 0
          ? (posY - mapY) * deltaDistY
          : (mapY + 1.0 - posY) * deltaDistY

        // Welche Seite des Tiles wurde getroffen? 0=X-Seite (senkrechte Wand), 1=Y-Seite
        let side: 0 | 1 = 0
        let hit  = false
        let dist = 0

        // DDA: Schritt für Schritt vorwärts bis Wand getroffen
        for (let step = 0; step < 32 && !hit; step++) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX
            mapX      += stepX
            side       = 0
          } else {
            sideDistY += deltaDistY
            mapY      += stepY
            side       = 1
          }
          if (mapX >= 0 && mapY >= 0 && mapX < MAP_W && mapY < MAP_H) {
            if (MAP[mapY][mapX] === 1) hit = true
          } else {
            hit = true  // Rand der Map
          }
        }

        // Perpendiculare Distanz (verhindert Fish-Eye-Effekt)
        if (side === 0) dist = sideDistX - deltaDistX
        else            dist = sideDistY - deltaDistY
        dist = Math.max(0.1, dist)  // Division durch 0 verhindern

        // Wandhöhe auf dem Screen: je näher, desto höher
        const wallH = Math.min(viewH, Math.round(viewH / dist))

        // Y-Position der Wand-Oberkante und -Unterkante auf dem Canvas
        const wallTop    = Math.round(viewH / 2 - wallH / 2)
        const wallBottom = wallTop + wallH

        // Wand zeichnen
        ctx.fillStyle = getWallColor(side, dist)
        ctx.fillRect(col, wallTop, 1, wallBottom - wallTop)
      }

      // ── HUD (unterer Teil) ────────────────────────────────────────────────
      const hudY  = viewH     // HUD beginnt unterhalb der 3D-Ansicht
      const hudH  = H - viewH // HUD-Höhe in Pixeln

      // HUD-Hintergrund
      ctx.fillStyle = '#000a00'
      ctx.fillRect(0, hudY, W, hudH)
      // HUD-Trennlinie
      ctx.strokeStyle = '#1a5c1a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, hudY)
      ctx.lineTo(W, hudY)
      ctx.stroke()

      // HUD-Text
      const fSize = Math.max(7, Math.min(12, hudH * 0.3))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'top'

      const col1 = 6
      const col2 = W * 0.35
      const col3 = W * 0.68
      const ty1  = hudY + hudH * 0.1
      const ty2  = hudY + hudH * 0.55

      // HP-Balken
      ctx.fillStyle = '#555'
      ctx.fillRect(col1, ty1, W * 0.28, fSize * 0.8)
      ctx.fillStyle = '#00cc44'
      ctx.fillRect(col1, ty1, W * 0.28 * (hp / 100), fSize * 0.8)
      ctx.fillStyle = '#33ff66'
      ctx.fillText(`HP: ${hp}/100`, col1, ty2)

      // Mana-Balken
      ctx.fillStyle = '#333'
      ctx.fillRect(col2, ty1, W * 0.28, fSize * 0.8)
      ctx.fillStyle = '#0044ff'
      ctx.fillRect(col2, ty1, W * 0.28 * (mana / 100), fSize * 0.8)
      ctx.fillStyle = '#66aaff'
      ctx.fillText(`MP: ${mana}/100`, col2, ty2)

      // Gold und Level
      ctx.fillStyle = '#ccaa00'
      ctx.fillText(`GOLD: ${gold}`, col3, ty1)
      ctx.fillStyle = '#44ff88'
      ctx.fillText(`LVL: ${level}`, col3, ty2)

      // ── Mini-Map (oben rechts, klein) ─────────────────────────────────────
      const mmSize  = Math.min(W * 0.18, viewH * 0.28)  // Mini-Map Gesamtgröße
      const mmTile  = mmSize / MAP_W                      // Größe eines Tiles auf der Mini-Map
      const mmX     = W - mmSize - 4                      // X-Startposition (rechts)
      const mmY     = 4                                   // Y-Startposition (oben)

      // Halbtransparenter Hintergrund
      ctx.fillStyle = 'rgba(0,10,0,0.75)'
      ctx.fillRect(mmX, mmY, mmSize, mmSize)

      // Tiles zeichnen
      for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
          if (MAP[ty][tx] === 1) {
            // Wand: dunkles Grün
            ctx.fillStyle = '#0a3a0a'
            ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile, mmTile)
          }
          // Freie Felder bleiben transparent
        }
      }

      // Spieler-Punkt auf Mini-Map
      const ppx = mmX + posX * mmTile
      const ppy = mmY + posY * mmTile
      ctx.fillStyle = '#00ff60'
      ctx.beginPath()
      ctx.arc(ppx, ppy, mmTile * 0.8, 0, Math.PI * 2)
      ctx.fill()

      // Blickrichtungs-Pfeil auf Mini-Map
      ctx.strokeStyle = '#00ff60'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(ppx, ppy)
      ctx.lineTo(ppx + Math.cos(angle) * mmTile * 2, ppy + Math.sin(angle) * mmTile * 2)
      ctx.stroke()

      // Mini-Map-Rahmen
      ctx.strokeStyle = '#1a5c1a'
      ctx.lineWidth = 0.8
      ctx.strokeRect(mmX, mmY, mmSize, mmSize)

      // ── Event-Overlay (Text-Benachrichtigung) ────────────────────────────
      if (eventAlpha > 0.01) {
        const evFSize = Math.max(8, Math.min(14, W * 0.04))
        ctx.font = `bold ${evFSize}px monospace`
        ctx.textBaseline = 'top'
        const evW = ctx.measureText(eventText).width + 12
        const evX = (W - evW) / 2
        const evY = viewH * 0.07

        // Hintergrundbox
        ctx.fillStyle = `rgba(0,20,0,${eventAlpha * 0.85})`
        ctx.fillRect(evX - 4, evY - 2, evW + 4, evFSize + 6)
        ctx.strokeStyle = `rgba(0,255,80,${eventAlpha * 0.6})`
        ctx.lineWidth = 0.8
        ctx.strokeRect(evX - 4, evY - 2, evW + 4, evFSize + 6)

        // Text
        ctx.fillStyle = `rgba(0,255,80,${eventAlpha})`
        ctx.fillText('► ' + eventText, evX, evY + 2)
      }

      rafId = requestAnimationFrame(loop)
    }

    // Starten
    rafId = requestAnimationFrame((t) => { lastT = t; eventTimer = 2000; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="DAGGERFALL // DUNGEON CRAWLER ACTIVE">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}
