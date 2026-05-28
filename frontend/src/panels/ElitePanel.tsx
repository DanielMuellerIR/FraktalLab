import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// ElitePanel: Simuliert das Original-Elite (1984) — Wireframe-3D-Raumschiff.
// Einfache 3D-Rotation + orthografische Projektion, kein WebGL.
// ─────────────────────────────────────────────────────────────────────────────

// ── 3D-Hilfstypen ─────────────────────────────────────────────────────────────
interface Vec3 { x: number; y: number; z: number }
interface Edge  { a: number; b: number }  // Indizes in das Vertices-Array

// ── Rotationsmatrix ──────────────────────────────────────────────────────────
// Dreht einen 3D-Punkt um alle drei Achsen (Euler-Winkel in Radiant).
function rotateVec3(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  // ── Rotation um X-Achse ──
  let y =  v.y * Math.cos(rx) - v.z * Math.sin(rx)
  let z =  v.y * Math.sin(rx) + v.z * Math.cos(rx)
  let x =  v.x

  // ── Rotation um Y-Achse ──
  const x2 =  x * Math.cos(ry) + z * Math.sin(ry)
  const z2 = -x * Math.sin(ry) + z * Math.cos(ry)

  // ── Rotation um Z-Achse ──
  const x3 = x2 * Math.cos(rz) - y * Math.sin(rz)
  const y3 = x2 * Math.sin(rz) + y * Math.cos(rz)

  return { x: x3, y: y3, z: z2 }
}

// ── Orthografische Projektion ────────────────────────────────────────────────
// Projiziert einen 3D-Punkt auf 2D-Schirmkoordinaten.
// cx, cy = Bildschirmmittelpunkt; scale = Skalierungsfaktor.
function project(v: Vec3, cx: number, cy: number, scale: number): { sx: number; sy: number } {
  return { sx: cx + v.x * scale, sy: cy - v.y * scale }
}

// ── Cobra Mk III Wireframe-Definitionen ──────────────────────────────────────
// Vereinfachtes Cobra Mk III — angelehnt an die originale Elite-Geometrie.
// Alle Koordinaten normiert auf ca. ±1. Im Render wird mit scale skaliert.
//
// Das Cobra Mk III hat:
//   - Einen breiten, flachen Hauptkörper (trapezförmig von vorne)
//   - Zwei seitliche Flügel
//   - Motordüsen hinten
//   - Cockpit-Wölbung oben vorne

const COBRA_VERTICES: Vec3[] = [
  // ── Hauptkörper ──────────────────────────────────────────────────────
  { x:  0.0,  y:  0.15, z:  1.0  },   //  0: Nase oben
  { x:  0.0,  y: -0.10, z:  1.0  },   //  1: Nase unten
  { x:  0.7,  y:  0.10, z:  0.0  },   //  2: Mitte rechts oben
  { x:  0.7,  y: -0.15, z:  0.0  },   //  3: Mitte rechts unten
  { x: -0.7,  y:  0.10, z:  0.0  },   //  4: Mitte links oben
  { x: -0.7,  y: -0.15, z:  0.0  },   //  5: Mitte links unten
  { x:  0.5,  y:  0.08, z: -1.0  },   //  6: Heck rechts oben
  { x:  0.5,  y: -0.12, z: -1.0  },   //  7: Heck rechts unten
  { x: -0.5,  y:  0.08, z: -1.0  },   //  8: Heck links oben
  { x: -0.5,  y: -0.12, z: -1.0  },   //  9: Heck links unten
  // ── Cockpit-Wölbung (oben vorne) ─────────────────────────────────────
  { x:  0.0,  y:  0.35, z:  0.4  },   // 10: Cockpit-Top
  { x:  0.25, y:  0.20, z:  0.1  },   // 11: Cockpit rechts
  { x: -0.25, y:  0.20, z:  0.1  },   // 12: Cockpit links
  // ── Linker Flügel (Außenkante) ────────────────────────────────────────
  { x: -1.4,  y: -0.05, z:  0.2  },   // 13: Flügel links außen vorne
  { x: -1.4,  y: -0.05, z: -0.5  },   // 14: Flügel links außen hinten
  // ── Rechter Flügel (Außenkante) ───────────────────────────────────────
  { x:  1.4,  y: -0.05, z:  0.2  },   // 15: Flügel rechts außen vorne
  { x:  1.4,  y: -0.05, z: -0.5  },   // 16: Flügel rechts außen hinten
  // ── Motordüsen (Kreis-Approximation durch 4 Punkte, hinten) ───────────
  { x:  0.25, y:  0.0,  z: -1.15 },   // 17: Düse rechts
  { x: -0.25, y:  0.0,  z: -1.15 },   // 18: Düse links
  { x:  0.0,  y:  0.25, z: -1.15 },   // 19: Düse oben
  { x:  0.0,  y: -0.25, z: -1.15 },   // 20: Düse unten
]

// Kanten: Paare von Vertex-Indizes. Canvas zeichnet diese als Linien.
const COBRA_EDGES: Edge[] = [
  // ── Rumpf-Kontur ──────────────────────────────────────────────────────
  { a:  0, b:  2 }, { a:  0, b:  4 },   // Nase → Mitte
  { a:  1, b:  3 }, { a:  1, b:  5 },
  { a:  2, b:  6 }, { a:  4, b:  8 },   // Mitte → Heck
  { a:  3, b:  7 }, { a:  5, b:  9 },
  { a:  6, b:  8 }, { a:  7, b:  9 },   // Heck-Querstreben
  { a:  2, b:  3 }, { a:  4, b:  5 },   // Mitte senkrecht
  { a:  0, b:  1 },                       // Nasenspitze senkrecht
  { a:  6, b:  7 }, { a:  8, b:  9 },   // Heck senkrecht
  // ── Cockpit ───────────────────────────────────────────────────────────
  { a:  0, b: 10 }, { a: 10, b: 11 }, { a: 10, b: 12 },
  { a: 11, b:  2 }, { a: 12, b:  4 },
  { a: 11, b: 12 },
  // ── Linker Flügel ─────────────────────────────────────────────────────
  { a:  4, b: 13 }, { a: 13, b: 14 }, { a: 14, b:  8 }, { a:  5, b: 13 },
  // ── Rechter Flügel ────────────────────────────────────────────────────
  { a:  2, b: 15 }, { a: 15, b: 16 }, { a: 16, b:  6 }, { a:  3, b: 15 },
  // ── Motordüsen ────────────────────────────────────────────────────────
  { a: 17, b: 19 }, { a: 19, b: 18 }, { a: 18, b: 20 }, { a: 20, b: 17 },
  { a:  6, b: 17 }, { a:  7, b: 20 }, { a:  8, b: 18 }, { a:  9, b: 20 },
]

// ── Feindliches Schiff: vereinfachtes Viper-Wireframe ─────────────────────────
// Das Viper ist schlanker als das Cobra: spitz, schnell.
const VIPER_VERTICES: Vec3[] = [
  { x:  0.0,  y:  0.0,  z:  0.9  },   // 0: Nase
  { x:  0.4,  y:  0.1,  z: -0.3  },   // 1: Flügel rechts oben
  { x:  0.4,  y: -0.1,  z: -0.3  },   // 2: Flügel rechts unten
  { x: -0.4,  y:  0.1,  z: -0.3  },   // 3: Flügel links oben
  { x: -0.4,  y: -0.1,  z: -0.3  },   // 4: Flügel links unten
  { x:  0.2,  y:  0.0,  z: -0.9  },   // 5: Heck rechts
  { x: -0.2,  y:  0.0,  z: -0.9  },   // 6: Heck links
  { x:  0.0,  y:  0.25, z: -0.2  },   // 7: Rücken-Finne oben
  { x:  0.0,  y: -0.1,  z: -0.7  },   // 8: Rücken-Finne unten hinten
]

const VIPER_EDGES: Edge[] = [
  { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }, { a: 0, b: 4 },
  { a: 1, b: 5 }, { a: 2, b: 5 }, { a: 3, b: 6 }, { a: 4, b: 6 },
  { a: 5, b: 6 }, { a: 1, b: 2 }, { a: 3, b: 4 },
  { a: 0, b: 7 }, { a: 7, b: 8 }, { a: 3, b: 7 }, { a: 1, b: 7 },
]

// ── Gelegentliche Status-Meldungen ───────────────────────────────────────────
const MESSAGES = [
  'PIRATE DESTROYED',
  'DOCKING COMPUTER ON',
  'FUEL SCOOP ACTIVE',
  'VIPER MISSILE LOCK!',
  'CARGO JETTISONED',
  'HYPERDRIVE READY',
  'POLICE SCANNER ACTIVE',
  'THARGOID SIGNAL',
  'BOUNTY: 200 CR',
  'ANACONDA DETECTED',
]

// ── Sternfeld ────────────────────────────────────────────────────────────────
interface Star2D {
  x: number    // normiert 0..1
  y: number    // normiert 0..1
  r: number    // Radius in Pixeln
}

// ─────────────────────────────────────────────────────────────────────────────
function ElitePanel() {
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

    // ── Statische Sterne ────────────────────────────────────────────────────
    const STAR_COUNT = 80
    const stars: Star2D[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.80,   // nur im oberen 80% (HUD unten)
      r: Math.random() > 0.85 ? 1.5 : 0.8,
    }))

    // ── Rotations-Zustand ────────────────────────────────────────────────────
    // Das Cobra dreht sich langsam und führt gelegentlich Ausweichmanöver durch.
    let cobraRx = 0.05  // Aktuelle Rotation Cobra um X-Achse
    let cobraRy = 0.0   // Aktuelle Rotation Cobra um Y-Achse
    let cobraRz = 0.0   // Aktuelle Rotation Cobra um Z-Achse

    // Dreh-Geschwindigkeiten (Radiant/Sekunde) — fix für die gesamte Session
    const cobraDRy = 0.5   // langsame Y-Rotation (Haupt-Schaurotation)
    const cobraDRx = 0.05  // minimale X-Schwankung

    // Das feindliche Schiff (Viper) kreist außen herum.
    // Seine Position wird in Polarkoordinaten gespeichert.
    let viperOrbit    = 0     // Umlauf-Winkel in Radiant
    const viperOrbitR = 0.4   // Orbit-Radius normiert (fix, kein Resize nötig)
    let viperRy       = 0     // Eigene Y-Rotation des Vipers

    // ── Ausweichmanöver-Zustand ──────────────────────────────────────────────
    let evadeTimer    = 0     // Countdown bis nächstes Manöver (ms)
    let evadeActive   = false
    let evadeDRx      = 0
    let evadeDRz      = 0

    // ── HUD-Daten ────────────────────────────────────────────────────────────
    let score  = 12450
    let cash   = 1234.5   // Credits
    const fuel      = 6.2     // Lichtjahre (fix für Demo)
    const legal     = 'CLEAN'

    // ── Status-Nachricht-Overlay ─────────────────────────────────────────────
    let msgText  = ''
    let msgAlpha = 0
    let msgTimer = 3000  // erstes Msg nach 3s

    // ── Radar-Blip-Daten ─────────────────────────────────────────────────────
    // Ein paar zufällige Objekte auf dem Radar.
    const radarBlips = Array.from({ length: 5 }, () => ({
      angle: Math.random() * Math.PI * 2,
      r:     0.3 + Math.random() * 0.6,  // Entfernung vom Zentrum (0=Mitte, 1=Rand)
      above: Math.random() > 0.5,        // Blip über (true) oder unter (false) der Radar-Ebene
    }))

    // ── Hilfsfunktion: Wireframe-Schiff zeichnen ──────────────────────────────
    // vertices: Array mit 3D-Punkten
    // edges: Kanten als Index-Paare
    // rx/ry/rz: Rotation in Radiant
    // cx/cy: Bildschirmmittelpunkt
    // scale: Skalierungsfaktor (bestimmt, wie groß das Schiff erscheint)
    // color: Linienfarbe
    function drawWireframe(
      vertices: Vec3[],
      edges: Edge[],
      rx: number, ry: number, rz: number,
      cx: number, cy: number,
      scale: number,
      color: string
    ) {
      // Alle Vertices rotieren und projizieren
      const projected = vertices.map(v => {
        const rotated = rotateVec3(v, rx, ry, rz)
        return project(rotated, cx, cy, scale)
      })

      // Kanten als Linien zeichnen
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.2
      ctx.beginPath()
      for (const e of edges) {
        ctx.moveTo(projected[e.a].sx, projected[e.a].sy)
        ctx.lineTo(projected[e.b].sx, projected[e.b].sy)
      }
      ctx.stroke()
    }

    // ── Radar-Display ─────────────────────────────────────────────────────────
    // Elliptischer Radar-Kreis (wie im Original), Blips als Punkte.
    // Radar-Position: unten in der Mitte.
    function drawRadar(cx: number, cy: number, rW: number, rH: number) {
      // Ellipsen-Umriss (Radar-Schüssel)
      ctx.strokeStyle = '#1a8a1a'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.ellipse(cx, cy, rW, rH, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Horizontale Mittellinie der Ellipse (trennt oben/unten)
      ctx.beginPath()
      ctx.moveTo(cx - rW, cy)
      ctx.lineTo(cx + rW, cy)
      ctx.stroke()

      // Vertikale Hilfslinie
      ctx.strokeStyle = '#0d4a0d'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(cx, cy - rH)
      ctx.lineTo(cx, cy + rH)
      ctx.stroke()

      // Spieler-Markierung (kleines Dreieck in der Mitte)
      ctx.fillStyle = '#00ff60'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 3)
      ctx.lineTo(cx - 2.5, cy + 2)
      ctx.lineTo(cx + 2.5, cy + 2)
      ctx.closePath()
      ctx.fill()

      // Blips der Objekte
      for (const blip of radarBlips) {
        // Blip-Position innerhalb der Ellipse
        const bx = cx + Math.cos(blip.angle + viperOrbit * 0.3) * blip.r * rW
        const by = cy + Math.sin(blip.angle + viperOrbit * 0.3) * blip.r * rH * (blip.above ? -0.5 : 0.5)
        // Blips, die über der Radar-Ebene sind, leuchten heller
        ctx.fillStyle = blip.above ? '#00ff80' : '#006630'
        ctx.fillRect(bx - 1, by - 1, 2, 2)
      }

      // Viper-Blip: blinkt wenn nahe
      const viperBx = cx + Math.cos(viperOrbit) * 0.7 * rW
      const viperBy = cy - 0.3 * rH
      const viperBlink = Math.floor(Date.now() / 400) % 2 === 0
      if (viperBlink) {
        ctx.fillStyle = '#ff4444'
        ctx.fillRect(viperBx - 1.5, viperBy - 1.5, 3, 3)
      }
    }

    // ── Haupt-Loop ────────────────────────────────────────────────────────────
    let lastT = 0

    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.08)
      lastT = t

      const W = canvas.width
      const H = canvas.height

      // ── Rotationen aktualisieren ─────────────────────────────────────────
      cobraRy += cobraDRy * dt
      cobraRx += cobraDRx * dt

      // Ausweichmanöver-Countdown
      evadeTimer -= dt * 1000
      if (evadeTimer <= 0 && !evadeActive) {
        // Neues Manöver starten
        evadeActive = true
        evadeDRx    = (Math.random() - 0.5) * 2.5
        evadeDRz    = (Math.random() - 0.5) * 2.0
        evadeTimer  = 600 + Math.random() * 800  // Manöver dauert 0.6–1.4s
      }

      if (evadeActive) {
        cobraRx += evadeDRx * dt
        cobraRz += evadeDRz * dt
        evadeTimer -= dt * 1000
        if (evadeTimer <= 0) {
          // Manöver beendet, nächstes in 4–10s
          evadeActive = false
          evadeDRx    = 0
          evadeDRz    = 0
          evadeTimer  = 4000 + Math.random() * 6000
        }
      } else {
        // Ohne Manöver: Z-Rotation langsam zurück auf 0 (Lerp)
        cobraRz += (0 - cobraRz) * 2 * dt
        cobraRx += (0.05 - cobraRx) * 0.5 * dt
      }

      // Viper umkreist das Cobra
      viperOrbit += 0.4 * dt
      viperRy    += 0.9 * dt

      // HUD-Werte fluktuieren leicht
      if (Math.random() > 0.97) { score += 10; cash += 0.3 }

      // Status-Nachricht
      msgTimer -= dt * 1000
      if (msgTimer <= 0) {
        msgText  = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
        msgAlpha = 1.0
        msgTimer = 5000 + Math.random() * 7000
      }
      if (msgAlpha > 0) msgAlpha = Math.max(0, msgAlpha - dt * 0.4)

      // ── Rendering ─────────────────────────────────────────────────────────

      // Schritt 1: Hintergrund schwarz
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Schritt 2: Sterne (statisch — nur Punkte, keine Bewegung)
      for (const s of stars) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── 3D-Bereich ────────────────────────────────────────────────────────
      // Der 3D-Bereich füllt die oberen ~72% des Canvas.
      // Der Rest gehört dem HUD.
      const viewH  = H * 0.72
      const cobCX  = W * 0.5   // Cobra zentriert
      const cobCY  = viewH * 0.48
      const cobScale = Math.min(W, viewH) * 0.3  // Skalierung am Panel-Inhalt orientiert

      // Schritt 3: Cobra Mk III zeichnen
      drawWireframe(
        COBRA_VERTICES, COBRA_EDGES,
        cobraRx, cobraRy, cobraRz,
        cobCX, cobCY, cobScale,
        '#00e860'  // helles Grün, wie Original-Elite-Phosphor
      )

      // Schritt 4: Viper zeichnen (kleiner, außen, kreisend)
      // Viper-Position auf dem Bildschirm: Ellipsen-Orbit um das Cobra
      const viperOrbitRpx = cobScale * viperOrbitR  // Orbit-Radius in Pixeln
      const viperCX = cobCX + Math.cos(viperOrbit) * viperOrbitRpx * 2.2
      const viperCY = cobCY + Math.sin(viperOrbit) * viperOrbitRpx * 0.8
      // Nur zeichnen wenn im sichtbaren Bereich
      if (viperCY > 10 && viperCY < viewH - 10) {
        drawWireframe(
          VIPER_VERTICES, VIPER_EDGES,
          0, viperRy, 0,
          viperCX, viperCY, cobScale * 0.3,
          '#ff4444'  // Rot = feindliches Schiff
        )
      }

      // ── HUD-Hintergrund ───────────────────────────────────────────────────
      const hudY = viewH
      const hudH = H - viewH

      ctx.fillStyle = '#000500'
      ctx.fillRect(0, hudY, W, hudH)
      ctx.strokeStyle = '#1a5c1a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, hudY)
      ctx.lineTo(W, hudY)
      ctx.stroke()

      // ── HUD-Text ─────────────────────────────────────────────────────────
      const fSize = Math.max(7, Math.min(11, hudH * 0.28))
      ctx.font = `${fSize}px monospace`
      ctx.textBaseline = 'middle'
      const ty = hudY + hudH * 0.3

      ctx.fillStyle = '#33ff66'
      ctx.fillText(`SCORE: ${score}`, W * 0.02, ty)
      ctx.fillStyle = '#ccaa00'
      ctx.fillText(`CASH: ${cash.toFixed(1)} CR`, W * 0.22, ty)
      ctx.fillStyle = '#44aaff'
      ctx.fillText(`FUEL: ${fuel} LY`, W * 0.48, ty)
      ctx.fillStyle = '#aaffaa'
      ctx.fillText(`LEGAL: ${legal}`, W * 0.70, ty)

      // ── Radar ────────────────────────────────────────────────────────────
      // Radar-Ellipse mittig im HUD-Bereich
      const radarCX = W * 0.5
      const radarCY = hudY + hudH * 0.72
      const radarW  = Math.min(W * 0.18, hudH * 0.55)
      const radarH  = radarW * 0.45  // Ellipse ist breiter als hoch

      drawRadar(radarCX, radarCY, radarW, radarH)

      // ── Status-Nachricht ──────────────────────────────────────────────────
      if (msgAlpha > 0.01) {
        const mFSize = Math.max(7, Math.min(12, W * 0.035))
        ctx.font = `${mFSize}px monospace`
        ctx.textBaseline = 'top'
        ctx.fillStyle = `rgba(0,255,80,${msgAlpha})`
        ctx.fillText('► ' + msgText, W * 0.02, viewH * 0.06)
      }

      // ── Schiff-Bezeichnung und Status oben ────────────────────────────────
      ctx.font = `${Math.max(7, W * 0.022)}px monospace`
      ctx.fillStyle = 'rgba(0,200,80,0.4)'
      ctx.textBaseline = 'top'
      ctx.fillText('COBRA MK III  //  CMDR JAMESON', W * 0.02, 4)

      rafId = requestAnimationFrame(loop)
    }

    // Starten
    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="ELITE // COBRA MK III — JAMESON">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}

export default memo(ElitePanel);
