import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// ParallaxPanel: Horizontales Parallax-Scrolling durch 4 verschiedene Szenen.
// Szenen-Wechsel alle 20s mit 1s Schwarz-Überblendung.
//
// Szene 0: "Futuristic City"   — grüne Raumstadt (Original)
// Szene 1: "Neon Rain"         — dunkle Regenstadt mit Cyan-Neon
// Szene 2: "Space Station"     — Weltraum mit Raumstation und Planet
// Szene 3: "Underground Tunnel"— U-Bahn-Tunnel mit Röhren und Lichtern
// ─────────────────────────────────────────────────────────────────────────────

// Szenen-Dauer und Überblendungszeit in Millisekunden
const SCENE_DURATION_MS  = 20_000
const FADE_DURATION_MS   =  1_000

// Scroll-Geschwindigkeiten (px/s) für die 4 Layer jeder Szene
// Index 0 = hinterster Layer, Index 3 = vorderster Layer
const SCENE_SPEEDS = [
  [8,  20,  45, 160],   // Szene 0: Futuristic City
  [6,  18,  40, 120],   // Szene 1: Neon Rain
  [5,  15,  35, 100],   // Szene 2: Space Station
  [10, 25,  55, 180],   // Szene 3: Underground Tunnel
]

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

// Pseudo-Zufallszahl aus einem Seed (deterministisch, kein Math.random in Render-Loop)
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123
  return x - Math.floor(x)
}

// Zeichnet ein Array von horizontalen CRT-Scanlines über das Canvas
function drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let y = 0; y < H; y += 2) {
    ctx.fillRect(0, y, W, 1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SZENE 0: Futuristic City (grüne Raumstadt)
// ─────────────────────────────────────────────────────────────────────────────

// 120 Sterne für Szene 0 (und als Basis für Szene 2)
const STARS_S0 = Array.from({ length: 120 }, (_, i) => ({
  x:      seededRand(i * 3),
  y:      seededRand(i * 3 + 1),
  r:      0.3 + seededRand(i * 3 + 2) * 1.2,
  bright: 0.4 + seededRand(i * 3 + 2) * 0.6,
}))

// Gebäude-Definitionen für Szene 0, Layer 1–3
function makeBuildings0(layerIdx: number): { xOff: number; w: number; hFrac: number; hasAntenna: boolean; lights: number[] }[] {
  const configs = [
    { count: 8,  minW: 30, maxW: 80, minH: 0.25, maxH: 0.55 },
    { count: 14, minW: 15, maxW: 45, minH: 0.15, maxH: 0.35 },
    { count: 20, minW: 8,  maxW: 25, minH: 0.08, maxH: 0.22 },
  ]
  const cfg = configs[layerIdx]
  const result = []
  let x = 0
  for (let i = 0; i < cfg.count; i++) {
    const seed = layerIdx * 1000 + i
    const w    = cfg.minW + seededRand(seed)     * (cfg.maxW - cfg.minW)
    const gap  = 5       + seededRand(seed + 0.5) * 15
    const lightCount = Math.floor(seededRand(seed + 0.7) * 4)
    result.push({
      xOff:       x + gap,
      w,
      hFrac:      cfg.minH + seededRand(seed + 0.3) * (cfg.maxH - cfg.minH),
      hasAntenna: seededRand(seed + 0.9) > 0.5,
      lights:     Array.from({ length: lightCount }, (_, li) =>
                    seededRand(seed + li * 0.11) * 0.7 + 0.1),
    })
    x += w + gap
  }
  return result
}

const BLDS_S0 = [0, 1, 2].map(makeBuildings0)

function tileWidth0(layerIdx: number): number {
  const blds = BLDS_S0[layerIdx]
  const last = blds[blds.length - 1]
  return last.xOff + last.w + 40
}

function drawScene0(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  offsets: number[],   // offsets[0..3]
) {
  // Hintergrund: schwarz → sehr dunkles Grün
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0,   '#000000')
  bg.addColorStop(0.6, '#010801')
  bg.addColorStop(1,   '#021204')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Layer 0: Sterne
  const tileW0 = W * 2
  for (const s of STARS_S0) {
    let ax = s.x * tileW0 - (offsets[0] % tileW0)
    if (ax < 0) ax += tileW0
    if (ax > W) continue
    const alpha = s.bright.toFixed(2)
    ctx.fillStyle = `rgba(180,255,200,${alpha})`
    ctx.beginPath()
    ctx.arc(ax, s.y * H, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Layer 1–3: Gebäude
  const layerColors = ['#0d3318', '#1a5c2e', '#2ea852']
  for (let li = 0; li < 3; li++) {
    const blds  = BLDS_S0[li]
    const tileW = tileWidth0(li)
    const color = layerColors[li]
    const offset = offsets[li + 1] % tileW

    for (let tile = -1; tile <= 1; tile++) {
      const tileStartX = tile * tileW - offset
      for (let bi = 0; bi < blds.length; bi++) {
        const b  = blds[bi]
        const bx = tileStartX + b.xOff
        const bh = b.hFrac * H
        const by = H - bh
        if (bx + b.w < -5 || bx > W + 5) continue

        ctx.fillStyle = color
        ctx.fillRect(bx, by, b.w, bh)

        if (b.hasAntenna) {
          const antennaH = 8 + b.hFrac * 25
          const cx = bx + b.w / 2
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(cx, by)
          ctx.lineTo(cx, by - antennaH)
          ctx.stroke()
          const blink = 0.5 + 0.5 * Math.sin(t * 0.003 + bi * 1.7)
          ctx.fillStyle = `rgba(100,255,150,${blink.toFixed(2)})`
          ctx.beginPath()
          ctx.arc(cx, by - antennaH, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }

        for (let lx = 0; lx < b.lights.length; lx++) {
          const ly  = by + bh * b.lights[lx]
          const on  = Math.sin(t * 0.0025 + bi * 2.3 + lx * 4.7) > 0.2
          if (!on) continue
          ctx.fillStyle = 'rgba(150,255,180,0.8)'
          ctx.fillRect(bx + 3, ly - 1, 4, 3)
        }
      }
    }
  }

  // Szenen-Label
  ctx.font = `${Math.max(8, W * 0.025)}px monospace`
  ctx.fillStyle = 'rgba(46,168,82,0.5)'
  ctx.textBaseline = 'top'
  ctx.fillText('SECTOR 7 // ALTITUDE 8400km', 6, 6)
}

// ─────────────────────────────────────────────────────────────────────────────
// SZENE 1: Neon Rain — dunkle Regenstadt
// ─────────────────────────────────────────────────────────────────────────────

// Gebäude-Silhouetten für Szene 1
function makeBuildings1(): { xOff: number; w: number; hFrac: number }[] {
  const result = []
  let x = 0
  for (let i = 0; i < 12; i++) {
    const seed = 2000 + i
    const w    = 25 + seededRand(seed) * 70
    const gap  = 3  + seededRand(seed + 0.4) * 8
    result.push({
      xOff:  x + gap,
      w,
      hFrac: 0.2 + seededRand(seed + 0.6) * 0.5,
    })
    x += w + gap
  }
  return result
}

const BLDS_S1 = makeBuildings1()
function tileWidth1(): number {
  const last = BLDS_S1[BLDS_S1.length - 1]
  return last.xOff + last.w + 30
}

// 70 Regenstreifen (x in 0..1 normiert)
const RAIN_LINES = Array.from({ length: 70 }, (_, i) => ({
  x:      seededRand(i * 7),
  length: 8  + seededRand(i * 7 + 1) * 14,   // Länge in Pixeln
  alpha:  0.2 + seededRand(i * 7 + 2) * 0.5,
  speed:  1.5 + seededRand(i * 7 + 3) * 1.0,  // Multiplikator auf Layer-Geschwindigkeit
}))

// 3 Neon-Schilder
const NEON_SIGNS = [
  { xFrac: 0.15, yFrac: 0.45, w: 60, h: 5 },
  { xFrac: 0.5,  yFrac: 0.38, w: 80, h: 6 },
  { xFrac: 0.78, yFrac: 0.5,  w: 50, h: 5 },
]

function drawScene1(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  offsets: number[],
) {
  // Hintergrund: sehr dunkles Blau-Schwarz
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0,   '#000008')
  bg.addColorStop(0.7, '#00000f')
  bg.addColorStop(1,   '#000005')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Layer 1: Gebäude-Silhouetten (hinterste Ebene)
  const tileW1 = tileWidth1()
  const silhouetteColor = '#111133'
  for (let tile = -1; tile <= 1; tile++) {
    const startX = tile * tileW1 - (offsets[0] % tileW1)
    for (const b of BLDS_S1) {
      const bx = startX + b.xOff
      const bh = b.hFrac * H
      const by = H - bh
      if (bx + b.w < -5 || bx > W + 5) continue
      ctx.fillStyle = silhouetteColor
      ctx.fillRect(bx, by, b.w, bh)
    }
  }

  // Layer 2: Nass-Boden-Reflexionen (sehr blasse Spiegelung der Silhouetten)
  // Zeichnet nur die untere 20% des Canvas als blasse gespiegelte Silhouetten
  ctx.save()
  ctx.globalAlpha = 0.12
  for (let tile = -1; tile <= 1; tile++) {
    const startX = tile * tileW1 - (offsets[1] % tileW1)
    for (const b of BLDS_S1) {
      const bx  = startX + b.xOff
      const bh  = b.hFrac * H * 0.3   // Reflexion nur ein Drittel der Originalhöhe
      const by  = H - bh              // Reflexion beginnt am Boden
      if (bx + b.w < -5 || bx > W + 5) continue
      // Verlauf von unten: oben transparent, unten etwas sichtbarer
      const refGrad = ctx.createLinearGradient(0, by, 0, H)
      refGrad.addColorStop(0, 'rgba(30,30,80,0)')
      refGrad.addColorStop(1, 'rgba(30,30,80,0.6)')
      ctx.fillStyle = refGrad
      ctx.fillRect(bx, by, b.w, bh)
    }
  }
  ctx.restore()

  // Layer 3: Regen-Streifen — bewegen sich nach unten (vertikale Bewegung simuliert
  // durch: Y-Offset = (offsets[2] * speed) % H, da offsets den Scroll-Fortschritt trägt)
  ctx.save()
  for (const rl of RAIN_LINES) {
    const rx = rl.x * W
    // Regen fällt nach unten: Y-Position aus Zeit berechnen
    const ry = ((t * 0.15 * rl.speed) % (H + rl.length)) - rl.length
    ctx.strokeStyle = `rgba(150,220,255,${rl.alpha.toFixed(2)})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.lineTo(rx - 1, ry + rl.length)  // leicht schräg
    ctx.stroke()
  }
  ctx.restore()

  // Layer 4: Fensterlichter — kleine orange/gelbe Rechtecke, einige flimmern
  const WINDOW_COUNT = 40
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const seed  = 3000 + i
    const wx    = seededRand(seed)     * W
    const wy    = (0.1 + seededRand(seed + 0.2) * 0.7) * H
    const ww    = 3 + seededRand(seed + 0.4) * 6
    const wh    = 2 + seededRand(seed + 0.5) * 4
    const flicker = seededRand(seed + 0.6) > 0.7
      ? 0.5 + 0.5 * Math.sin(t * 0.008 * (1 + seededRand(seed + 0.8) * 3) + i)
      : 0.85
    const hue = seededRand(seed + 0.9) > 0.5 ? '255,200,80' : '255,160,40'
    ctx.fillStyle = `rgba(${hue},${flicker.toFixed(2)})`
    ctx.fillRect(wx, wy, ww, wh)
  }

  // Neon-Schilder (Cyan-Leuchtstäbe)
  for (let ni = 0; ni < NEON_SIGNS.length; ni++) {
    const ns     = NEON_SIGNS[ni]
    const nx     = ns.xFrac * W
    const ny     = ns.yFrac * H
    const pulse  = 0.7 + 0.3 * Math.sin(t * 0.004 + ni * 2.1)
    // Leucht-Schein (blur simuliert durch mehrere überlagerte Rechtecke mit fallender Alpha)
    for (let glow = 3; glow >= 0; glow--) {
      const a = (pulse * 0.3 * (1 - glow / 4)).toFixed(2)
      ctx.fillStyle = `rgba(0,255,255,${a})`
      ctx.fillRect(nx - glow * 2, ny - glow, ns.w + glow * 4, ns.h + glow * 2)
    }
    ctx.fillStyle = `rgba(0,255,255,${pulse.toFixed(2)})`
    ctx.fillRect(nx, ny, ns.w, ns.h)
  }

  // Szenen-Label
  ctx.font = `${Math.max(8, W * 0.025)}px monospace`
  ctx.fillStyle = 'rgba(0,200,255,0.45)'
  ctx.textBaseline = 'top'
  ctx.fillText('RAIN DISTRICT // CAM-07 // NIGHT MODE', 6, 6)
}

// ─────────────────────────────────────────────────────────────────────────────
// SZENE 2: Space Station — Weltraum-Umgebung
// ─────────────────────────────────────────────────────────────────────────────

// 300 Sterne (dichter als Szene 0)
const STARS_S2 = Array.from({ length: 300 }, (_, i) => ({
  x:      seededRand(i * 5 + 100),
  y:      seededRand(i * 5 + 101),
  r:      0.2 + seededRand(i * 5 + 102) * 1.0,
  bright: 0.3 + seededRand(i * 5 + 103) * 0.7,
}))

// Raumstation-Module (rechteckige Blöcke + Solarpanel-Arme)
const STATION_MODULES = (() => {
  // Zentrales Modul + angehängte Blöcke
  const modules = []
  // Kern
  modules.push({ x: -80, y: -20, w: 160, h: 40 })
  // Aufsätze oben/unten
  modules.push({ x: -40, y: -50, w: 80,  h: 30 })
  modules.push({ x: -40, y:  20, w: 80,  h: 30 })
  // Seiten-Docking-Ports
  modules.push({ x:  80, y: -10, w: 40,  h: 20 })
  modules.push({ x: -120,y: -10, w: 40,  h: 20 })
  return modules
})()

// Solarpanel-Arme der Station
const SOLAR_PANELS = [
  { x:  120, y: -70, w: 8,  h: 140 },   // rechts
  { x: -128, y: -70, w: 8,  h: 140 },   // links
  { x:   60, y: -80, w: 80,  h: 12  },  // oben rechts
  { x:  -140,y: -80, w: 80,  h: 12  },  // oben links
]

// Gitter-Muster (scrollt mit Layer 2)
const GRID_ROWS = 8
const GRID_COLS = 16

function drawScene2(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  t: number,
  offsets: number[],
) {
  // Hintergrund: reines Schwarz (Weltraum)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Layer 0: Sternfeld (sehr viele Sterne)
  const tileW_stars = W * 2.5
  for (const s of STARS_S2) {
    let ax = s.x * tileW_stars - (offsets[0] % tileW_stars)
    if (ax < 0) ax += tileW_stars
    if (ax > W) continue
    const alpha = s.bright.toFixed(2)
    ctx.fillStyle = `rgba(220,235,255,${alpha})`
    ctx.beginPath()
    ctx.arc(ax, s.y * H, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Layer 1: Ferner Planet (groß, am oberen oder unteren Rand, scrollt sehr langsam)
  const planetX = W * 0.72 - (offsets[0] * 0.3) % (W * 0.5)
  const planetR = H * 0.38
  const planetY = -planetR * 0.35  // oben halb angeschnitten
  const planetGrad = ctx.createRadialGradient(
    planetX - planetR * 0.25, planetY + planetR * 0.2, planetR * 0.1,
    planetX, planetY, planetR,
  )
  planetGrad.addColorStop(0,   '#2a4a6a')
  planetGrad.addColorStop(0.4, '#1a2a40')
  planetGrad.addColorStop(0.8, '#0d1520')
  planetGrad.addColorStop(1,   'rgba(5,10,20,0)')
  ctx.fillStyle = planetGrad
  ctx.beginPath()
  ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2)
  ctx.fill()
  // Atmosphäre-Glanz
  ctx.strokeStyle = 'rgba(60,120,200,0.2)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(planetX, planetY, planetR * 1.02, 0, Math.PI * 2)
  ctx.stroke()

  // Layer 2: Grid-Muster (scrollt mit mittlerer Geschwindigkeit — Perspektiv-Täuschung)
  const gridScrollX = offsets[1] % (W / GRID_COLS)
  ctx.save()
  ctx.strokeStyle = 'rgba(30,80,120,0.25)'
  ctx.lineWidth = 0.5
  for (let col = 0; col <= GRID_COLS + 1; col++) {
    const gx = col * (W / GRID_COLS) - gridScrollX
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
  }
  for (let row = 0; row <= GRID_ROWS; row++) {
    const gy = row * (H / GRID_ROWS)
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
  }
  ctx.restore()

  // Layer 3: Raumstation (langsam von rechts nach links scrollend)
  const stX = W * 0.45 - (offsets[2] % (W * 2)) + W * 0.5
  const stY = H * 0.42
  ctx.save()
  ctx.translate(stX, stY)

  // Solarpanel-Arme (dunkel mit blau-grünen Highlights)
  for (const sp of SOLAR_PANELS) {
    ctx.fillStyle = '#1a2030'
    ctx.fillRect(sp.x, sp.y, sp.w, sp.h)
    // Panel-Gitter
    ctx.strokeStyle = 'rgba(40,180,160,0.4)'
    ctx.lineWidth = 0.5
    const gstepX = sp.w > sp.h ? sp.w / 4 : sp.w
    const gstepY = sp.h > sp.w ? sp.h / 4 : sp.h
    for (let gx = sp.x; gx <= sp.x + sp.w; gx += gstepX) {
      ctx.beginPath(); ctx.moveTo(gx, sp.y); ctx.lineTo(gx, sp.y + sp.h); ctx.stroke()
    }
    for (let gy = sp.y; gy <= sp.y + sp.h; gy += gstepY) {
      ctx.beginPath(); ctx.moveTo(sp.x, gy); ctx.lineTo(sp.x + sp.w, gy); ctx.stroke()
    }
  }

  // Station-Module
  for (const m of STATION_MODULES) {
    ctx.fillStyle = '#252a35'
    ctx.fillRect(m.x, m.y, m.w, m.h)
    // Umrandung
    ctx.strokeStyle = 'rgba(80,160,200,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(m.x, m.y, m.w, m.h)
  }

  // Positions-Lichter auf der Station (blinken)
  const blinkA = 0.5 + 0.5 * Math.sin(t * 0.005)
  const blinkB = 0.5 + 0.5 * Math.sin(t * 0.007 + 1.2)
  ctx.fillStyle = `rgba(255,80,80,${blinkA.toFixed(2)})`
  ctx.beginPath(); ctx.arc(-120, 0, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `rgba(80,200,255,${blinkB.toFixed(2)})`
  ctx.beginPath(); ctx.arc(120, 0, 3, 0, Math.PI * 2); ctx.fill()

  ctx.restore()

  // Layer 4: Strukturbalken im Vordergrund (dünne diagonale Linie)
  const beamX1 = W * 0.08 - (offsets[3] % (W * 1.5))
  ctx.save()
  ctx.strokeStyle = 'rgba(100,130,160,0.6)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(beamX1,      0)
  ctx.lineTo(beamX1 + 20, H)
  ctx.stroke()
  // Zweiter Balken
  const beamX2 = beamX1 + W * 0.6
  if (beamX2 > 0 && beamX2 < W + 25) {
    ctx.beginPath()
    ctx.moveTo(beamX2,      0)
    ctx.lineTo(beamX2 + 20, H)
    ctx.stroke()
  }
  ctx.restore()

  // Szenen-Label
  ctx.font = `${Math.max(8, W * 0.025)}px monospace`
  ctx.fillStyle = 'rgba(80,200,255,0.45)'
  ctx.textBaseline = 'top'
  ctx.fillText('ISS ALPHA // ORBIT 408km // CAM-EXT-03', 6, 6)
}

// ─────────────────────────────────────────────────────────────────────────────
// SZENE 3: Underground Tunnel — U-Bahn-Tunnel
// ─────────────────────────────────────────────────────────────────────────────

// Anzahl der Tunnel-Ringe (Querschnitte), die gleichzeitig sichtbar sind
const TUNNEL_RING_COUNT = 12

// Rohre auf den Tunnelwänden (normierte Positionen auf dem Ring-Umfang 0..1)
const PIPE_POSITIONS = [0.08, 0.15, 0.82, 0.91]   // oben links / rechts
const PIPE_RADII     = [3, 2, 2.5, 2]              // Radius in Pixeln

function drawScene3(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  _t: number,
  offsets: number[],
) {
  const cx = W / 2   // Tunnel-Zentrum
  const cy = H / 2

  // Hintergrund: dunkles Beton-Grau
  ctx.fillStyle = '#0e0e0e'
  ctx.fillRect(0, 0, W, H)

  // Tunnel-Wand als großes ovales/elliptisches Gradient
  const tunnelGrad = ctx.createRadialGradient(cx, cy, H * 0.15, cx, cy, H * 0.65)
  tunnelGrad.addColorStop(0,   '#1a1a1a')
  tunnelGrad.addColorStop(0.5, '#111111')
  tunnelGrad.addColorStop(1,   '#050505')
  ctx.fillStyle = tunnelGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy, W * 0.48, H * 0.48, 0, 0, Math.PI * 2)
  ctx.fill()

  // Layer 1: Tunnel-Querschnitt-Ringe (Perspektiv-Scrolling)
  // Jeder Ring ist ein elliptischer Rahmen. Weiter entfernte Ringe sind kleiner.
  // Die Ringe scrollen von klein (hinten) nach groß (vorne): Scroll-Offset
  // bestimmt, wie weit jeder Ring "vorgerückt" ist.

  const ringSpacing = H * 0.18   // Abstand zwischen den Ringen in "Tiefe"
  const scrollOffset = offsets[0] % ringSpacing  // wie weit der vorderste Ring bereits ist

  for (let ri = 0; ri < TUNNEL_RING_COUNT; ri++) {
    // Ring ri = 0 ist der vorderste (größte), ri = TUNNEL_RING_COUNT-1 ist hinterster
    // Tiefe: scroll bringt Ringe von vorne (0) nach hinten
    const depth  = (ri * ringSpacing + scrollOffset) / (TUNNEL_RING_COUNT * ringSpacing)
    const scale  = 1 - depth * 0.85   // Scale: 1 (vorne) → 0.15 (hinten)
    const rx = W * 0.46 * scale
    const ry = H * 0.46 * scale
    if (rx < 2 || ry < 2) continue

    // Sichtbarkeit: vordere Ringe werden etwas transparenter (da man durch sie hindurchschaut)
    const alpha = 0.15 + depth * 0.5
    ctx.strokeStyle = `rgba(90,90,90,${alpha.toFixed(2)})`
    ctx.lineWidth = Math.max(0.5, 2 * scale)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Gelber Sicherheits-Streifen am Boden (Platform-Edge)
    if (scale > 0.4) {
      const stripeY  = cy + ry - 4 * scale
      const stripeW  = rx * 1.5
      const stripeH  = 4 * scale
      const stripeAlpha = (alpha * 1.5).toFixed(2)
      ctx.fillStyle = `rgba(200,160,0,${stripeAlpha})`
      ctx.fillRect(cx - stripeW / 2, stripeY, stripeW, stripeH)

      // Unterbrochene gelbe Warn-Linie (gestrichelt)
      ctx.strokeStyle = `rgba(255,200,0,${stripeAlpha})`
      ctx.lineWidth = 1.5 * scale
      ctx.setLineDash([8 * scale, 6 * scale])
      ctx.beginPath()
      ctx.moveTo(cx - stripeW / 2, stripeY + stripeH * 0.5)
      ctx.lineTo(cx + stripeW / 2, stripeY + stripeH * 0.5)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Layer 2: Rohre und Leitungen an den Tunnelwänden (parallax-scrollende horizontale Rohre)
  const pipeScrollX = offsets[1] % W
  for (let pi = 0; pi < PIPE_POSITIONS.length; pi++) {
    const angleFrac  = PIPE_POSITIONS[pi]
    const angle      = angleFrac * Math.PI * 2 - Math.PI / 2
    const pipeRx     = W * 0.46 * 0.92   // Rohre auf ca. 92% des Ellipsen-Radius
    const pipeRy     = H * 0.46 * 0.92
    // Position auf der Ellipse
    const px = cx + Math.cos(angle) * pipeRx
    const py = cy + Math.sin(angle) * pipeRy
    const pr = PIPE_RADII[pi]

    // Rohr als horizontal verlaufende Linie (Länge = volle Breite, scrollt)
    ctx.strokeStyle = 'rgba(80,80,80,0.7)'
    ctx.lineWidth = pr * 2
    ctx.beginPath()
    ctx.moveTo(-pipeScrollX,     py)
    ctx.lineTo(W - pipeScrollX + W, py)
    ctx.stroke()
    // Highlight-Linie oben auf dem Rohr (Glanz)
    ctx.strokeStyle = 'rgba(120,120,120,0.3)'
    ctx.lineWidth = Math.max(0.5, pr * 0.6)
    ctx.beginPath()
    ctx.moveTo(-pipeScrollX,     py - pr * 0.4)
    ctx.lineTo(W - pipeScrollX + W, py - pr * 0.4)
    ctx.stroke()
    // Kleiner Kreis an Sichtposition (zeigt Rohrquerschnitt)
    ctx.fillStyle = 'rgba(60,60,60,0.9)'
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(100,100,100,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Layer 3: Tunnel-Lampen (erscheinen in regelmäßigen Abständen, scrollen)
  // Lampen hängen oben in der Tunnelmitte und werfen Lichtkegel nach unten
  const lampSpacing = W * 0.35
  const lampScroll  = offsets[2] % lampSpacing
  const lampCount   = Math.ceil(W / lampSpacing) + 2

  for (let li = 0; li < lampCount; li++) {
    const lx    = li * lampSpacing - lampScroll + lampSpacing
    const lyTop = cy - H * 0.42   // Lampe oben im Tunnel

    if (lx < -50 || lx > W + 50) continue

    // Entscheiden ob diese Lampe leuchtet (manche aus — zufällig aber deterministisch)
    const lampSeed = Math.floor(li + offsets[2] / lampSpacing)
    const isOn     = seededRand(lampSeed * 13 + 7) > 0.15

    if (isOn) {
      // Lichtkegel (nach unten, dreieckig)
      const coneGrad = ctx.createLinearGradient(lx, lyTop, lx, cy + H * 0.1)
      coneGrad.addColorStop(0,   'rgba(255,255,220,0.35)')
      coneGrad.addColorStop(0.5, 'rgba(255,255,180,0.1)')
      coneGrad.addColorStop(1,   'rgba(255,255,150,0)')
      ctx.fillStyle = coneGrad
      ctx.beginPath()
      ctx.moveTo(lx, lyTop)
      ctx.lineTo(lx - H * 0.2, cy + H * 0.1)
      ctx.lineTo(lx + H * 0.2, cy + H * 0.1)
      ctx.closePath()
      ctx.fill()

      // Lampen-Glühbirne (heller weißer Punkt)
      ctx.fillStyle = 'rgba(255,255,220,0.95)'
      ctx.beginPath()
      ctx.arc(lx, lyTop + 5, 3, 0, Math.PI * 2)
      ctx.fill()
      // Lens-Flare (mehrere Kreise mit fallender Alpha)
      for (let glow = 1; glow <= 4; glow++) {
        ctx.fillStyle = `rgba(255,255,180,${(0.07 / glow).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(lx, lyTop + 5, glow * 8, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      // Ausgebrannte Lampe (dunkler Fleck)
      ctx.fillStyle = 'rgba(40,35,30,0.8)'
      ctx.beginPath()
      ctx.arc(lx, lyTop + 5, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Layer 4: Vordergrund — Waggon-/Türrahmen-Ausschnitt
  // Dunkler Rahmen am Rand des Canvas der einen Türdurchgang simuliert
  const frameScrollX = offsets[3] % (W * 3)
  // Linker Pfosten (bewegt sich mit höchster Geschwindigkeit aus dem Bild)
  const postX = W * 0.5 - frameScrollX * 0.5
  if (postX > -40 && postX < W + 40) {
    ctx.fillStyle = 'rgba(20,20,20,0.9)'
    ctx.fillRect(postX - 20, 0, 18, H)
    // Metall-Schiene (helle Linie an der Kante)
    ctx.fillStyle = 'rgba(80,80,80,0.7)'
    ctx.fillRect(postX - 2, 0, 2, H)
  }

  // Fester dunkler Vignette-Rahmen
  const vignette = ctx.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.7)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  // Szenen-Label
  ctx.font = `${Math.max(8, W * 0.025)}px monospace`
  ctx.fillStyle = 'rgba(200,160,0,0.5)'
  ctx.textBaseline = 'top'
  ctx.fillText('METRO LINE-Ω // TUNNEL CAM // RESTRICTED', 6, 6)
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Komponente
// ─────────────────────────────────────────────────────────────────────────────

// Panel-Titel pro Szene
const SCENE_TITLES = [
  'PARALLAX // SPACE CITY SECTOR 7',
  'PARALLAX // RAIN DISTRICT NODE-07',
  'PARALLAX // ISS ALPHA ORBITAL CAM',
  'PARALLAX // METRO LINE-Ω TUNNEL',
]

// Render-Funktionen in Array — Index entspricht Szenen-Index
const SCENE_DRAW_FNS = [drawScene0, drawScene1, drawScene2, drawScene3]

function ParallaxPanel() {
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

    let rafId:    number
    let alive   = true
    let isVisible = true

    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(container)

    const resize = () => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Szenen-State ─────────────────────────────────────────────────────────
    let sceneIdx     = 0                  // aktuelle Szene (0–3)
    let sceneStartMs = 0                  // Zeitstempel (ms) bei dem aktuelle Szene begann
    let fadeState: 'none' | 'out' | 'in' = 'none'
    let fadeStartMs  = 0

    // Scroll-Offsets: 4 Layer × 4 Szenen — jede Szene hat eigene Offsets
    // (damit sie beim Rückwechsel nicht springen)
    const scrollX: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]

    let lastT = 0

    function loop(t: number) {
      if (!alive) return
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const dt = Math.min((t - lastT) / 1000, 0.1)
      lastT = t

      if (sceneStartMs === 0) sceneStartMs = t

      // ── Szenen-Wechsel-Logik ──────────────────────────────────────────────
      const elapsed = t - sceneStartMs

      if (fadeState === 'none' && elapsed >= SCENE_DURATION_MS) {
        // Szene ist abgelaufen → Fade-Out starten
        fadeState  = 'out'
        fadeStartMs = t
      }

      if (fadeState === 'out' && (t - fadeStartMs) >= FADE_DURATION_MS) {
        // Fade-Out abgeschlossen → Szene wechseln und Fade-In starten
        sceneIdx    = (sceneIdx + 1) % SCENE_DRAW_FNS.length
        sceneStartMs = t
        fadeState   = 'in'
        fadeStartMs = t
      }

      if (fadeState === 'in' && (t - fadeStartMs) >= FADE_DURATION_MS) {
        fadeState = 'none'
      }

      // ── Scroll-Offsets für aktive Szene erhöhen ───────────────────────────
      const speeds = SCENE_SPEEDS[sceneIdx]
      const offs   = scrollX[sceneIdx]
      for (let i = 0; i < 4; i++) {
        offs[i] += speeds[i] * dt
      }

      // ── Rendern ───────────────────────────────────────────────────────────
      const W = canvas.width
      const H = canvas.height

      // Aktuelle Szene zeichnen
      SCENE_DRAW_FNS[sceneIdx](ctx, W, H, t, scrollX[sceneIdx])

      // CRT-Scanlines
      drawScanlines(ctx, W, H)

      // Überblend-Overlay (schwarz, Alpha 0→1 für Fade-Out, 1→0 für Fade-In)
      if (fadeState !== 'none') {
        const progress = (t - fadeStartMs) / FADE_DURATION_MS  // 0..1
        const alpha    = fadeState === 'out' ? progress : 1 - progress
        ctx.fillStyle  = `rgba(0,0,0,${alpha.toFixed(3)})`
        ctx.fillRect(0, 0, W, H)
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame((t) => { lastT = t; sceneStartMs = t; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title={SCENE_TITLES[0]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}

export default memo(ParallaxPanel);
