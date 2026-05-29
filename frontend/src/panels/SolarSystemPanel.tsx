import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
// Zentraler rAF-Coordinator: bündelt alle Panel-Animationen in einer einzigen
// requestAnimationFrame-Schleife, statt dass jedes Panel seine eigene rAF-Loop
// startet. Spart Wechsel-Overhead und reduziert Jitter (siehe AUDIT_FINDINGS.md H-05).
import { subscribe } from '../utils/raf-coordinator'

// ── Planetendaten (Wissenschaftlich + Anzeige) ────────────────────────────────
// au:     reale Halbachse in Astronomischen Einheiten
// period: reale Umlaufzeit in Erdtagen
// mass:   Masse in Erdmassen
// moons:  Anzahl bekannter Monde
// type:   Planetentyp für Infoanzeige
const PLANET_DATA = [
  { name: 'MERCURY', au: 0.387,  period:    87.97, mass:   0.055, moons:   0, type: 'ROCKY',     color: '#b5b5b5', radius: 3  },
  { name: 'VENUS',   au: 0.723,  period:   224.70, mass:   0.815, moons:   0, type: 'ROCKY',     color: '#e8cda0', radius: 5  },
  { name: 'EARTH',   au: 1.000,  period:   365.25, mass:   1.000, moons:   1, type: 'ROCKY',     color: '#4b9cd3', radius: 5  },
  { name: 'MARS',    au: 1.524,  period:   686.97, mass:   0.107, moons:   2, type: 'ROCKY',     color: '#c1440e', radius: 4  },
  { name: 'JUPITER', au: 5.203,  period:  4332.59, mass: 317.800, moons:  95, type: 'GAS GIANT', color: '#c88b3a', radius: 11 },
  { name: 'SATURN',  au: 9.537,  period: 10759.22, mass:  95.200, moons: 146, type: 'GAS GIANT', color: '#e4d191', radius: 9  },
  { name: 'URANUS',  au: 19.190, period: 30688.50, mass:  14.500, moons:  28, type: 'ICE GIANT', color: '#7de8e8', radius: 7  },
  { name: 'NEPTUNE', au: 30.070, period: 60195.00, mass:  17.100, moons:  16, type: 'ICE GIANT', color: '#3f54ba', radius: 7  },
] as const

type PlanetData = typeof PLANET_DATA[number]

// ── Zeitskala ─────────────────────────────────────────────────────────────────
// Erde soll in 12 Sekunden eine volle Runde drehen.
// Erdperiode = 365.25 Tage → 365.25 / (12 * 1000) Tage pro Millisekunde
const DAYS_PER_MS = 365.25 / (12 * 1000)   // ≈ 0.0304375 Tage/ms

// ── Orbit-Radius berechnen (AU → Pixel, Wurzelskala) ─────────────────────────
// Maximale AU der letzten Planeten bestimmt die Skala.
// Alle Planeten bleiben sichtbar durch sqrt-Kompression.
const MAX_AU = 30.07  // Neptun

function orbitRadius(
  au: number,
  minOrbit: number,
  maxOrbit: number,
): number {
  // Wurzel-Interpolation: outer planets werden näher zusammengedrückt
  return minOrbit + (maxOrbit - minOrbit) * Math.sqrt(au / MAX_AU)
}

// ── Starfield: statische Positionen im Einheitsquadrat [0..1] ────────────────
// Einmalig beim Modul-Load berechnet, nicht bei jedem Render.
const STARS: { x: number; y: number }[] = Array.from({ length: 200 }, () => ({
  x: Math.random(),
  y: Math.random(),
}))

// ── Zoom-State Typen ──────────────────────────────────────────────────────────
type ZoomPhase = 'idle' | 'zooming_in' | 'watching' | 'zooming_out'

interface ZoomState {
  phase: ZoomPhase
  targetPlanetIdx: number   // Index in PLANET_DATA
  progress: number          // 0..1 für zoom_in / zoom_out
  watchTimer: number        // ms abgelaufen während 'watching'
  idleTimer: number         // ms abgelaufen während 'idle'
}

// ── Zoom-Timing-Konstanten ────────────────────────────────────────────────────
const ZOOM_IDLE_MS     = 7000   // 7 Sekunden zwischen den Zooms
const ZOOM_IN_MS       = 1500   // 1.5 Sekunden Zoom-in-Animation
const ZOOM_WATCH_MS    = 6000   // 6 Sekunden angezoomt bleiben
const ZOOM_OUT_MS      = 1500   // 1.5 Sekunden Zoom-out-Animation
const ZOOM_TARGET      = 8      // Vergrößerungsfaktor beim Zoom
const ZOOM_OVERVIEW    = 1      // Normaler Übersichts-Zoom

// ── Sanfte Easing-Funktion (Ease-in/out via Cosinus) ─────────────────────────
function easeInOut(t: number): number {
  // t = 0..1 → 0..1, mit weichem Start und Ende
  return 0.5 - 0.5 * Math.cos(t * Math.PI)
}

// ── Info-Box für den Zoom-Fokus zeichnen ──────────────────────────────────────
function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  planet: PlanetData,
  W: number,
  H: number,
  alpha: number,   // 0..1, für Fade-in/out
) {
  const minDim   = Math.min(W, H)
  const fontSize = Math.max(12, Math.min(22, Math.round(minDim * 0.032)))
  const lineH    = fontSize + 8
  const padX     = Math.max(12, Math.round(fontSize * 1.1))
  const padY     = Math.max(8, Math.round(fontSize * 0.8))

  // Zeilen der Info-Box
  const lines = [
    `► ${planet.name} ◄`,
    `---------------------------------`,
    `DISTANCE:  ${planet.au.toFixed(3)} AU`,
    `ORBIT:     ${(planet.period / 365.25).toFixed(2)} EARTH YEARS`,
    `MASS:      ${planet.mass} EARTH MASSES`,
    `MOONS:     ${planet.moons}`,
    `TYPE:      ${planet.type}`,
  ]

  // Box-Breite: längste Zeile + Padding
  ctx.font = `${fontSize}px monospace`
  const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width))
  const boxW = maxWidth + padX * 2
  const boxH = lines.length * lineH + padY * 2

  // Centered horizontally on the right half of the screen
  const bx = W * 0.73 - boxW / 2
  const by = (H - boxH) / 2

  // Hintergrund-Rechteck
  ctx.globalAlpha = alpha * 0.8
  ctx.fillStyle = '#000000'
  ctx.fillRect(bx, by, boxW, boxH)

  // Grüner Border
  ctx.globalAlpha = alpha * 0.95
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 1.5
  ctx.strokeRect(bx, by, boxW, boxH)

  // Textzeilen
  ctx.textBaseline = 'top'
  ctx.textAlign    = 'left'
  lines.forEach((line, i) => {
    ctx.globalAlpha = alpha * (i === 0 ? 1.0 : 0.85)
    ctx.fillStyle   = i === 0 ? '#4ade80' : '#86efac'
    ctx.font        = i === 0
      ? `bold ${fontSize}px monospace`
      : `${fontSize}px monospace`
    ctx.fillText(line, bx + padX, by + padY + i * lineH)
  })

  // globalAlpha zurücksetzen
  ctx.globalAlpha = 1
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
function SolarSystemPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    // Typ-Narrowing: TypeScript erkennt ctx in Closures nicht als non-null
    const ctx: CanvasRenderingContext2D = _ctx

    // Unsubscribe-Handle vom zentralen raf-coordinator; null = nicht abonniert.
    let unsubscribe: (() => void) | null = null
    let running = true

    // ── ResizeObserver: Canvas-Auflösung == Container-Größe ──────────────────
    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Zeitbasis ─────────────────────────────────────────────────────────────
    const startTime = performance.now()
    let   prevTime  = startTime

    // ── Zoom-Zustand ──────────────────────────────────────────────────────────
    const zoom: ZoomState = {
      phase:           'idle',
      targetPlanetIdx: 0,
      progress:        0,
      watchTimer:      0,
      idleTimer:       0,
    }

    // Kamera-Zustand: Welt-Koordinaten (relativ zum Canvas-Zentrum)
    let viewZoom    = ZOOM_OVERVIEW
    let viewCenterX = 0
    let viewCenterY = 0

    // Merkt sich die Übersicht-Kameraposition zum Zurückzoomen
    let overviewCenterX = 0
    let overviewCenterY = 0

    // ── RAF-Haupt-Loop ────────────────────────────────────────────────────────
    function loop(now: number) {
      if (!running) return

      const W = canvas!.width
      const H = canvas!.height

      // Canvas noch nicht initialisiert → warten
      // (subscribe ruft loop automatisch beim nächsten Tick erneut auf)
      if (W === 0 || H === 0) {
        return
      }

      // Zeit-Delta für Zoom-State-Machine
      const dt = now - prevTime
      prevTime = now

      // Simulierte Erdtage seit Beginn
      const elapsedMs = now - startTime
      const simDays   = elapsedMs * DAYS_PER_MS

      // ── Orbit-Geometrie (Weltkoordinaten, Zentrum = 0,0) ──────────────────
      const cx = W / 2
      const cy = H / 2
      const minDim   = Math.min(W, H)
      const sunR     = minDim * 0.06
      const minOrbit = sunR + 14
      const maxOrbit = minDim * 0.46

      // ── Planetenpositionen berechnen (Weltkoord, relativ zu Canvas-Mitte) ──
      const START_ANGLES = [4.4, 2.1, 0.0, 5.5, 0.8, 2.3, 4.0, 5.0]
      const planetPositions = PLANET_DATA.map((p, i) => {
        const orbitR = orbitRadius(p.au, minOrbit, maxOrbit)
        const angle  = START_ANGLES[i] + (simDays / p.period) * Math.PI * 2
        return {
          wx: Math.cos(angle) * orbitR,   // Weltkoordinate X
          wy: Math.sin(angle) * orbitR,   // Weltkoordinate Y
          orbitR,
        }
      })

      // ── Zoom-State-Machine aktualisieren ──────────────────────────────────
      const targetPos = planetPositions[zoom.targetPlanetIdx]

      if (zoom.phase === 'idle') {
        zoom.idleTimer += dt
        if (zoom.idleTimer >= ZOOM_IDLE_MS) {
          // Nächsten Planeten wählen, alle 8 zyklisch
          zoom.targetPlanetIdx = (zoom.targetPlanetIdx + 1) % PLANET_DATA.length
          zoom.idleTimer  = 0
          zoom.progress   = 0
          zoom.phase      = 'zooming_in'
          // Startpunkt der Kamera merken
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_in') {
        zoom.progress += dt / ZOOM_IN_MS
        if (zoom.progress >= 1) {
          zoom.progress  = 1
          zoom.watchTimer = 0
          zoom.phase     = 'watching'
        }
        // Kamera interpolieren: Übersicht → Planet
        // Shift camera focus center slightly to the right to place the planet on the left side of the canvas
        const shiftX = (W * 0.22) / ZOOM_TARGET
        const t = easeInOut(zoom.progress)
        viewZoom    = ZOOM_OVERVIEW + (ZOOM_TARGET - ZOOM_OVERVIEW) * t
        viewCenterX = overviewCenterX + (targetPos.wx + shiftX - overviewCenterX) * t
        viewCenterY = overviewCenterY + (targetPos.wy - overviewCenterY) * t
      } else if (zoom.phase === 'watching') {
        zoom.watchTimer += dt
        // Kamera folgt dem Planeten in Echtzeit (mit Shift nach links verschoben)
        const shiftX = (W * 0.22) / ZOOM_TARGET
        viewZoom    = ZOOM_TARGET
        viewCenterX = targetPos.wx + shiftX
        viewCenterY = targetPos.wy
        if (zoom.watchTimer >= ZOOM_WATCH_MS) {
          zoom.progress = 0
          zoom.phase    = 'zooming_out'
          // Startpunkt für Rückfahrt merken (aktueller Planet)
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_out') {
        zoom.progress += dt / ZOOM_OUT_MS
        if (zoom.progress >= 1) {
          zoom.progress  = 1
          zoom.idleTimer = 0
          zoom.phase     = 'idle'
        }
        // Kamera interpolieren: Planet → Übersicht (0,0)
        const t = easeInOut(zoom.progress)
        viewZoom    = ZOOM_TARGET + (ZOOM_OVERVIEW - ZOOM_TARGET) * t
        viewCenterX = overviewCenterX + (0 - overviewCenterX) * t
        viewCenterY = overviewCenterY + (0 - overviewCenterY) * t
      }

      // ── Hilfsfunktion: Weltkoordinate → Screenkoordinate ──────────────────
      // worldX/Y sind relativ zum Canvas-Zentrum (cx, cy)
      const toScreen = (wx: number, wy: number): [number, number] => [
        cx + (wx - viewCenterX) * viewZoom,
        cy + (wy - viewCenterY) * viewZoom,
      ]

      // ── Hintergrund ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // ── Sternfeld ────────────────────────────────────────────────────────────
      // Statische Punkte; werden durch viewZoom leicht skaliert für Parallax-Effekt.
      // Sternfeld bewegt sich halb so schnell wie die Szene → Tiefenwirkung.
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (const star of STARS) {
        // Halbparallax: Sterne versetzen sich mit halber Kameraverschiebung
        const sx = star.x * W - viewCenterX * viewZoom * 0.1
        const sy = star.y * H - viewCenterY * viewZoom * 0.1
        // Wrap around
        const swx = ((sx % W) + W) % W
        const swy = ((sy % H) + H) % H
        ctx.beginPath()
        ctx.arc(swx, swy, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Sonne (Weltkoordinate 0,0) ───────────────────────────────────────────
      const [sunSx, sunSy] = toScreen(0, 0)
      const scaledSunR = sunR * viewZoom

      // Äußerer Glow
      const glow = ctx.createRadialGradient(sunSx, sunSy, scaledSunR * 0.5, sunSx, sunSy, scaledSunR * 1.6)
      glow.addColorStop(0,   'rgba(255,220,80,0.35)')
      glow.addColorStop(0.5, 'rgba(255,140,0,0.12)')
      glow.addColorStop(1,   'rgba(255,80,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR * 1.6, 0, Math.PI * 2)
      ctx.fill()

      // Sonnen-Kern
      const sunGrad = ctx.createRadialGradient(
        sunSx - scaledSunR * 0.3, sunSy - scaledSunR * 0.3, 0,
        sunSx, sunSy, scaledSunR,
      )
      sunGrad.addColorStop(0,   '#fff8c0')
      sunGrad.addColorStop(0.4, '#ffd700')
      sunGrad.addColorStop(1,   '#e87820')
      ctx.fillStyle = sunGrad
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR, 0, Math.PI * 2)
      ctx.fill()

      // ── Planeten, Orbits, Mond ─────────────────────────────────────────────
      // Während 'watching': nur den fokussierten Planeten beschriften
      const isWatching = zoom.phase === 'watching'

      PLANET_DATA.forEach((planet, i) => {
        const { wx, wy, orbitR } = planetPositions[i]
        const scaledOrbitR = orbitR * viewZoom

        // Orbit-Kreis um die (skalierte) Sonnenposition (durchgezogen, grünlich für Telemetrie-Look)
        ctx.save()
        ctx.strokeStyle = 'rgba(74,222,128,0.32)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.arc(sunSx, sunSy, scaledOrbitR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        // Planetenposition auf Screen
        const [px, py] = toScreen(wx, wy)

        // Planetenradius skaliert (aber nicht zu groß werden lassen)
        const scaledRadius = Math.min(planet.radius * Math.sqrt(viewZoom), planet.radius * 3)

        // ── Saturn-Ring (vor Planet zeichnen) ─────────────────────────────────
        if (planet.name === 'SATURN') {
          const ringRx = scaledRadius * 2.4
          const ringRy = scaledRadius * 0.55
          ctx.save()
          ctx.translate(px, py)
          ctx.strokeStyle = '#f0e0a0'
          ctx.lineWidth   = 1.5
          ctx.beginPath()
          ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }

        // ── Planet ────────────────────────────────────────────────────────────
        const planetGrad = ctx.createRadialGradient(
          px - scaledRadius * 0.35, py - scaledRadius * 0.35, 0,
          px, py, scaledRadius,
        )
        planetGrad.addColorStop(0,   planet.color + 'ff')
        planetGrad.addColorStop(0.6, planet.color)
        planetGrad.addColorStop(1,   planet.color + '88')
        ctx.fillStyle = planetGrad
        ctx.beginPath()
        ctx.arc(px, py, scaledRadius, 0, Math.PI * 2)
        ctx.fill()

        // ── Planetenbezeichnung ────────────────────────────────────────────────
        // Im Watching-Modus: nur fokussierten Planeten beschriften (weniger Clutter)
        const showLabel = !isWatching || i === zoom.targetPlanetIdx
        if (showLabel) {
          const labelSize = Math.max(10, Math.min(18, Math.round(Math.min(W, H) * 0.024)))
          ctx.font         = `bold ${labelSize}px monospace`
          ctx.fillStyle    = '#ffffff'
          ctx.textBaseline = 'middle'
          ctx.textAlign    = 'left'
          ctx.fillText(planet.name, px + scaledRadius + 6, py - scaledRadius * 0.4)
        }

        // ── Mond der Erde ──────────────────────────────────────────────────────
        if (planet.name === 'EARTH') {
          const moonPeriod = 27.32
          const moonAngle  = (simDays / moonPeriod) * Math.PI * 2
          // Mond-Orbit-Radius in Weltkoordinaten (kleiner als Planetenabstand)
          const moonOrbitRWorld = (orbitRadius(1.0, minOrbit, maxOrbit) - orbitRadius(0.723, minOrbit, maxOrbit)) * 0.18
          const mwx = wx + Math.cos(moonAngle) * moonOrbitRWorld
          const mwy = wy + Math.sin(moonAngle) * moonOrbitRWorld
          const [mx, my] = toScreen(mwx, mwy)
          const moonOrbitScreenR = moonOrbitRWorld * viewZoom

          // Mond-Orbit: sehr schwach
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'
          ctx.lineWidth   = 0.5
          ctx.setLineDash([2, 4])
          ctx.beginPath()
          ctx.arc(px, py, moonOrbitScreenR, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])

          // Mond-Punkt (skaliert, min 1.5px)
          ctx.fillStyle = '#aaaaaa'
          ctx.beginPath()
          ctx.arc(mx, my, Math.max(1.5, 2 * Math.sqrt(viewZoom * 0.5)), 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // ── Planet-Info-Box während 'watching' und 'zooming_in/out' ──────────────
      // Alpha: Fade in am Ende von zoom_in, voll während watching, Fade out am Anfang zoom_out
      let infoAlpha = 0
      if (zoom.phase === 'watching') {
        // Kurzes Fade-in in den ersten 300ms des Watchens
        infoAlpha = Math.min(1, zoom.watchTimer / 300)
      } else if (zoom.phase === 'zooming_out') {
        // Fade-out in den ersten 400ms
        infoAlpha = Math.max(0, 1 - zoom.progress * (ZOOM_OUT_MS / 400))
      }

      if (infoAlpha > 0.01) {
        const focusedPlanet = PLANET_DATA[zoom.targetPlanetIdx]
        drawInfoBox(ctx, focusedPlanet, W, H, infoAlpha)
      }

      // ── Info-Overlay (unten links) ─────────────────────────────────────────
      const today = new Date().toLocaleDateString('en-GB')
      // Zeitskala in lesbarer Form
      const secsPerYear = 12   // 12s = 1 Erdumlauf = 1 Erdjahr
      const lines = [
        'HELIOCENTRIC ORBIT MODEL',
        `DATE: ${today}`,
        `1 MIN = ${(60 / secsPerYear).toFixed(0)} EARTH YEARS`,
      ]
      const fontSize = Math.max(8, Math.min(11, W * 0.018))
      const lineH    = fontSize + 4
      const padX     = 8
      const padY     = 6

      ctx.font         = `${fontSize}px monospace`
      ctx.textBaseline = 'bottom'
      ctx.textAlign    = 'left'

      lines.forEach((line, idx) => {
        const alpha = 0.55 - idx * 0.1
        ctx.fillStyle = `rgba(74,222,128,${alpha})`
        const ly = H - padY - (lines.length - 1 - idx) * lineH
        ctx.fillText(line, padX, ly)
      })

    }

    // Beim zentralen rAF-Coordinator abonnieren — loop wird bei jedem Tick automatisch aufgerufen.
    unsubscribe = subscribe(loop)

    return () => {
      running = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="SOLAR SYSTEM // LIVE TELEMETRY">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(SolarSystemPanel);
