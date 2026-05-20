import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// ParallaxPanel: Horizontales Parallax-Scrolling einer futuristischen Raumstadt.
// 5 Layer mit unterschiedlichen Scroll-Geschwindigkeiten erzeugen Tiefenwirkung.
// ─────────────────────────────────────────────────────────────────────────────

// Jeder Layer hat eine Scroll-Geschwindigkeit (px/s) und eine Farbe.
// Layer 0 = hinterste Ebene (Sterne), Layer 4 = vorderste Ebene (Debris).
const LAYERS = [
  { speed: 8,   color: 'rgba(180,255,200,0.7)' },  // Layer 0: Sterne
  { speed: 20,  color: '#0d3318' },                 // Layer 1: Ferne Raumstation-Silhouette
  { speed: 45,  color: '#1a5c2e' },                 // Layer 2: Mittlere Gebäude
  { speed: 90,  color: '#2ea852' },                 // Layer 3: Vordergrund-Strukturen
  { speed: 160, color: '#6dffaa' },                 // Layer 4: Debris/Partikel
]

// ─── Sternfeld-Daten ──────────────────────────────────────────────────────────
// Sterne werden einmalig zufällig platziert und scrollen langsam nach links.
// Beim Verlassen des linken Rands erscheinen sie wieder rechts (Loop).
interface Star {
  x: number    // aktuelle X-Position in Pixeln (scrollt)
  y: number    // Y-Position (fix, in 0..1 normiert — wird bei Render auf canvas.height skaliert)
  r: number    // Radius in Pixeln
  bright: number // Helligkeit 0..1
}

// ─── Gebäude/Struktur-Definitionen ───────────────────────────────────────────
// Jeder Layer 1–3 hat ein Array von Gebäuden.
// Gebäude sind Rechtecke + optionale Antennen + optionale Lichter.
interface Building {
  xOff: number    // X-Offset in der Kachel (0..tileW)
  w: number       // Gebäudebreite in Pixeln
  hFrac: number   // Gebäudehöhe als Bruchteil von canvas.height (0..1)
  hasAntenna: boolean
  lights: number[] // Lichter: Y-Positionen als Bruchteil der Gebäudehöhe
}

// ─── Debris-Partikel (Layer 4) ────────────────────────────────────────────────
interface Debris {
  x: number     // X-Position (scrollt)
  y: number     // Y-Position (normiert 0..1)
  size: number  // Größe in Pixeln
  shape: number // 0=Punkt, 1=Linie, 2=Kreuz
  angle: number // Rotation in Radiant
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ParallaxPanel() {
  // Ref auf das äußere Container-Div für ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null)
  // Ref auf das Canvas-Element
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas    = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return
    // Explizit typisierte Aliases — TypeScript narrowt Non-null in Closures nicht immer
    const canvas: HTMLCanvasElement          = _canvas
    const ctx:    CanvasRenderingContext2D   = _ctx

    let rafId:  number
    let alive = true

    // ── Canvas-Größe ans Container anpassen ─────────────────────────────────
    // Wird initial und bei jeder Größenänderung aufgerufen.
    const resize = () => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Sterne generieren ────────────────────────────────────────────────────
    // 120 Sterne mit zufälliger Position, Größe und Helligkeit.
    const STAR_COUNT = 120
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x:      Math.random(),          // normiert 0..1 (wird mit tileW multipliziert)
      y:      Math.random(),          // normiert 0..1
      r:      0.3 + Math.random() * 1.2,
      bright: 0.4 + Math.random() * 0.6,
    }))

    // ── Gebäude pro Layer generieren ─────────────────────────────────────────
    // Jeder Layer wiederholt seine Gebäude-Kachel (tileW Pixel breit).
    // So entsteht ein nahtloser Loop.
    const buildings: Building[][] = [[], [], []]  // für Layer 1, 2, 3

    // Hilfsfunktion: Gebäude-Array für einen Layer generieren
    function genBuildings(count: number, minW: number, maxW: number,
                          minH: number, maxH: number): Building[] {
      const result: Building[] = []
      let x = 0
      for (let i = 0; i < count; i++) {
        const w = minW + Math.random() * (maxW - minW)
        // Lücke zwischen Gebäuden: 5–20px
        const gap = 5 + Math.random() * 15
        result.push({
          xOff:      x + gap,
          w,
          hFrac:     minH + Math.random() * (maxH - minH),
          hasAntenna: Math.random() > 0.5,
          // 0–3 Lichter pro Gebäude
          lights: Array.from({ length: Math.floor(Math.random() * 4) },
            () => Math.random() * 0.7 + 0.1),  // Lichtposition 10%–80% der Gebäudehöhe
        })
        x += w + gap
      }
      return result
    }

    // Layer 1: wenige, sehr hohe und breite Strukturen (Raumstation-Umriss)
    buildings[0] = genBuildings(8, 30, 80, 0.25, 0.55)
    // Layer 2: mittlere Gebäude
    buildings[1] = genBuildings(14, 15, 45, 0.15, 0.35)
    // Layer 3: viele kleine Vordergrund-Blöcke
    buildings[2] = genBuildings(20, 8, 25, 0.08, 0.22)

    // ── Debris generieren ────────────────────────────────────────────────────
    const DEBRIS_COUNT = 25
    const debris: Debris[] = Array.from({ length: DEBRIS_COUNT }, () => ({
      x:     Math.random(),         // normiert 0..1 (wird mit canvas.width multipliziert)
      y:     0.3 + Math.random() * 0.65,  // Debris nur im mittleren/unteren Bereich
      size:  1 + Math.random() * 3,
      shape: Math.floor(Math.random() * 3),
      angle: Math.random() * Math.PI * 2,
    }))

    // ── Scroll-Offsets pro Layer ─────────────────────────────────────────────
    // scrollX[i] ist der aktuelle Scroll-Betrag in Pixeln für Layer i.
    const scrollX = [0, 0, 0, 0, 0]

    // Timestamp des letzten Frames für Delta-Zeit-Berechnung
    let lastT = 0

    // ── Blink-Zustand für Lichter ─────────────────────────────────────────────
    // Lichter blinken asynchron. Wir speichern pro Gebäude einen Phasenwert.
    // (Da wir die Lights per sin berechnen, brauchen wir kein separates State.)

    // ── Kachel-Breite für jeden Layer (Gesamtbreite der Gebäude in diesem Layer)
    // Wird im Render dynamisch berechnet, da canvas.width sich ändern kann.
    function getTileWidth(layerIdx: number): number {
      // Layer 1–3 (Index 0–2 in buildings-Array):
      // Summe aller (xOff + w) des letzten Gebäudes + etwas Puffer
      const blds = buildings[layerIdx]
      if (blds.length === 0) return canvas.width
      const last = blds[blds.length - 1]
      return last.xOff + last.w + 40  // 40px Puffer am Ende
    }

    // ── Zeichenfunktionen ─────────────────────────────────────────────────────

    // Zeichnet den Hintergrund-Verlauf (schwarz → sehr dunkles Grün)
    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      grad.addColorStop(0,   '#000000')
      grad.addColorStop(0.6, '#010801')
      grad.addColorStop(1,   '#021204')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Zeichnet Layer 0: Sterne
    // starScrollX: wie weit die Sterne bereits nach links geschoben wurden
    function drawStars(starScrollX: number) {
      // Sterne befinden sich in einem "Universum" das tileW Pixel breit ist
      const tileW = canvas.width * 2  // Sterne-Kachel = 2x Breite für dichten Look
      for (const s of stars) {
        // Absolute X-Position: normiert auf tileW, dann Scroll subtrahieren
        let ax = s.x * tileW - (starScrollX % tileW)
        // Wrap-Around: sobald links raus → von rechts wieder rein
        if (ax < 0) ax += tileW
        if (ax > canvas.width) continue  // außerhalb → nicht zeichnen
        const ay = s.y * canvas.height
        ctx.fillStyle = LAYERS[0].color.replace('0.7', String(s.bright))
        ctx.beginPath()
        ctx.arc(ax, ay, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Zeichnet einen einzelnen Gebäude-Layer (Layer 1–3)
    // layerBuildingIdx: 0, 1 oder 2 (Index in buildings[])
    // color: Füllfarbe
    // scroll: aktueller Scroll-Offset in Pixeln
    function drawBuildingLayer(
      layerBuildingIdx: number,
      color: string,
      scroll: number,
      t: number
    ) {
      const blds  = buildings[layerBuildingIdx]
      const tileW = getTileWidth(layerBuildingIdx)
      const H     = canvas.height

      // Scroll-Offset innerhalb einer Kachel (Modulo für Loop)
      const offset = scroll % tileW

      // Wir zeichnen zwei Kacheln nebeneinander, damit beim Übergang kein Lücke entsteht
      for (let tile = -1; tile <= 1; tile++) {
        const tileStartX = tile * tileW - offset  // X-Startposition dieser Kachel

        for (let bi = 0; bi < blds.length; bi++) {
          const b  = blds[bi]
          const bx = tileStartX + b.xOff         // absolute X-Position des Gebäudes
          const bh = b.hFrac * H                  // Gebäudehöhe in Pixeln
          const by = H - bh                       // Y-Position (wächst von unten)

          // Gebäude nur zeichnen wenn im sichtbaren Bereich
          if (bx + b.w < -5 || bx > canvas.width + 5) continue

          // Gebäude-Füllung
          ctx.fillStyle = color
          ctx.fillRect(bx, by, b.w, bh)

          // Antenne oben auf dem Gebäude
          if (b.hasAntenna) {
            const antennaH = 8 + b.hFrac * 25   // Höhe proportional zur Gebäudehöhe
            const cx = bx + b.w / 2
            ctx.strokeStyle = color
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(cx, by)
            ctx.lineTo(cx, by - antennaH)
            ctx.stroke()
            // Kleines Licht an der Antennenspitze (blinkt)
            const blink = 0.5 + 0.5 * Math.sin(t * 0.003 + bi * 1.7)
            ctx.fillStyle = `rgba(100,255,150,${blink})`
            ctx.beginPath()
            ctx.arc(cx, by - antennaH, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }

          // Lichter in den Gebäudefenstern
          for (let li = 0; li < b.lights.length; li++) {
            const lyFrac = b.lights[li]
            const ly     = by + bh * lyFrac   // absolute Y-Position des Lichts
            // Jedes Licht blinkt mit eigener Frequenz (zufällige Phase via bi+li)
            const on = Math.sin(t * 0.0025 + bi * 2.3 + li * 4.7) > 0.2
            if (!on) continue
            ctx.fillStyle = `rgba(150,255,180,0.8)`
            ctx.fillRect(bx + 3, ly - 1, 4, 3)
          }
        }
      }
    }

    // Zeichnet Layer 4: Debris/Partikel
    function drawDebris(debrisScroll: number, t: number) {
      const tileW = canvas.width * 1.5  // Debris-Kachel leicht größer als Bildschirm

      for (let i = 0; i < debris.length; i++) {
        const d = debris[i]
        let ax = d.x * tileW - (debrisScroll % tileW)
        if (ax < -10) ax += tileW
        if (ax > canvas.width + 10) continue
        const ay = d.y * canvas.height

        // Debris dreht sich langsam (jedes Partikel mit eigener Rotationsgeschwindigkeit)
        const angle = d.angle + t * 0.001 * (i % 5 + 1) * 0.3

        ctx.save()
        ctx.translate(ax, ay)
        ctx.rotate(angle)
        ctx.strokeStyle = LAYERS[4].color
        ctx.lineWidth = 0.8

        if (d.shape === 0) {
          // Kleiner Punkt
          ctx.fillStyle = LAYERS[4].color
          ctx.beginPath()
          ctx.arc(0, 0, d.size * 0.5, 0, Math.PI * 2)
          ctx.fill()
        } else if (d.shape === 1) {
          // Kurze Linie
          ctx.beginPath()
          ctx.moveTo(-d.size, 0)
          ctx.lineTo(d.size, 0)
          ctx.stroke()
        } else {
          // Kreuz/Trümmer-Fragment
          ctx.beginPath()
          ctx.moveTo(-d.size, 0); ctx.lineTo(d.size, 0)
          ctx.moveTo(0, -d.size); ctx.lineTo(0, d.size * 0.5)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // ── Haupt-Render-Loop ─────────────────────────────────────────────────────
    function loop(t: number) {
      if (!alive) return

      // Delta-Zeit in Sekunden (begrenzt auf max 100ms um Sprünge nach Tab-Switch zu vermeiden)
      const dt = Math.min((t - lastT) / 1000, 0.1)
      lastT = t

      // Scroll-Offsets für jeden Layer erhöhen (Geschwindigkeit in px/s × dt)
      for (let i = 0; i < LAYERS.length; i++) {
        scrollX[i] += LAYERS[i].speed * dt
      }

      // ── Rendern ──────────────────────────────────────────────────────────

      // Schritt 1: Hintergrundverlauf
      drawBackground()

      // Schritt 2: Sterne (Layer 0)
      drawStars(scrollX[0])

      // Schritt 3: Gebäude-Layer 1 (Silhouette — hintere Ebene)
      drawBuildingLayer(0, LAYERS[1].color, scrollX[1], t)

      // Schritt 4: Gebäude-Layer 2 (mittlere Ebene)
      drawBuildingLayer(1, LAYERS[2].color, scrollX[2], t)

      // Schritt 5: Gebäude-Layer 3 (Vordergrund)
      drawBuildingLayer(2, LAYERS[3].color, scrollX[3], t)

      // Schritt 6: Debris/Partikel (Layer 4 — vorderste Ebene)
      drawDebris(scrollX[4], t)

      // Schritt 7: CRT-Scanline-Overlay (leichte horizontale Streifen)
      // Jede zweite Zeile leicht abdunkeln für Röhren-Look
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      for (let y = 0; y < canvas.height; y += 2) {
        ctx.fillRect(0, y, canvas.width, 1)
      }

      // Schritt 8: Sektor-Bezeichnung oben links
      ctx.font = `${Math.max(8, canvas.width * 0.025)}px monospace`
      ctx.fillStyle = 'rgba(46,168,82,0.5)'
      ctx.textBaseline = 'top'
      ctx.fillText('SECTOR 7 // ALTITUDE 8400km', 6, 6)

      rafId = requestAnimationFrame(loop)
    }

    // Ersten Frame starten
    rafId = requestAnimationFrame((t) => { lastT = t; loop(t) })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="PARALLAX // SPACE CITY SECTOR 7">
      {/* Container-Div: füllt den Panel-Innenbereich vollständig */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}
