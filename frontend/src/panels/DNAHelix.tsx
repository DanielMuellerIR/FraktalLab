import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Farbzuordnung für die vier DNA-Basen
// A = Adenin (grün), T = Thymin (cyan), C = Cytosin (magenta), G = Guanin (gelb)
const BASE_COLORS: Record<string, [number, number, number]> = {
  A: [0, 255, 102],
  T: [0, 204, 255],
  C: [255, 68, 204],
  G: [255, 221, 0],
}

// Feste Basensequenz für den scrollenden Ticker unten
const BASE_SEQ = 'ATCGATCGATCGATCGTAGCTAGCTAGCTAATTGGCCATGCATGCATGC'

// Rotierender 3D-DNA-Doppelhelix — Biohacking-Look mit vollem Canvas-Fill
function DNAHelix() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let alive = true
    // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────────
    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── RAF-Loop ─────────────────────────────────────────────────────────────
    function loop(t: number) {
      if (!alive) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      // Aktuelle Canvas-Dimensionen dynamisch lesen
      const W = canvas!.width
      const H = canvas!.height

      // Sicherheitscheck: falls Canvas noch keine Größe hat, überspringen
      if (W === 0 || H === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      // Zeitbasis in Sekunden
      const ts = t * 0.001

      // Hintergrund schwarz löschen
      ctx!.fillStyle = '#000000'
      ctx!.fillRect(0, 0, W, H)

      // ── Helix-Parameter ─────────────────────────────────────────────────────
      // Helix-Höhe: volle Canvas-Höhe minus Platz für Ticker unten
      const tickerH = Math.max(16, Math.round(H * 0.13))  // ~13 % für Ticker
      const helixH  = H - tickerH - 2                     // verbleibende Höhe
      const cx      = W / 2                               // horizontale Mitte

      // Radius proportional zur Breite — aber nicht zu groß
      const radius  = Math.min(W * 0.22, helixH * 0.18, 60)

      // Anzahl Basenpaar-Segmente — mehr bei großem Panel
      const steps = Math.max(24, Math.min(60, Math.round(helixH / 8)))

      // ── Alle Segmente berechnen ──────────────────────────────────────────────
      type Seg = {
        y:       number   // Y-Position auf dem Canvas
        x1:      number   // X des Strangs A
        x2:      number   // X des Strangs B
        z:       number   // Tiefenwert für Painter's Algorithm + Helligkeit
        baseA:   string   // Basen-Buchstabe Strang A
        baseB:   string   // Basen-Buchstabe Strang B (komplementär)
        colorA:  [number, number, number]   // Farbe Strang A
        colorB:  [number, number, number]   // Farbe Strang B
      }
      const segs: Seg[] = []

      // Komplementäre Basenpaare: A-T und G-C
      const PAIRS: [string, string][] = [['A','T'], ['T','A'], ['G','C'], ['C','G']]

      for (let i = 0; i < steps; i++) {
        const frac  = i / steps
        // Winkel: zwei volle Umdrehungen über die Helixlänge + zeitbasierte Rotation
        const angle = ts * 1.1 + frac * Math.PI * 4

        // Y-Position: gleichmäßig über die Helix-Höhe verteilt
        const y = frac * helixH

        // X-Positionen der beiden Stränge (um PI versetzt = gegenüberliegend)
        const x1 = cx + Math.cos(angle) * radius
        const x2 = cx + Math.cos(angle + Math.PI) * radius

        // Z-Tiefe: sin des Winkels (+1 = vorne, -1 = hinten)
        const z = Math.sin(angle)

        // Basenpaar wählen (zyklisch durch die Sequenz)
        const pairIdx = (i + Math.floor(ts * 0.5)) % PAIRS.length
        const [baseA, baseB] = PAIRS[pairIdx]

        segs.push({
          y, x1, x2, z, baseA, baseB,
          colorA: BASE_COLORS[baseA],
          colorB: BASE_COLORS[baseB],
        })
      }

      // ── Alle Zeichnungs-Elemente (Drawables) erstellen und sortieren ───────────
      type Drawable =
        | {
            type: 'rung'
            y: number
            x1: number
            x2: number
            z: number
            bright: number
          }
        | {
            type: 'sphere'
            y: number
            x: number
            z: number
            bright: number
            color: [number, number, number]
          }

      const drawables: Drawable[] = []

      for (const s of segs) {
        // Helligkeit für Strang A (Tiefenwert s.z) und Strang B (Tiefenwert -s.z) berechnen
        const brightA = Math.min(1.0, 0.25 + (s.z + 1) * 0.38)
        const brightB = Math.min(1.0, 0.25 + (-s.z + 1) * 0.38)
        const brightRung = 0.63 // Durchschnittliche Helligkeit für das Verbindungsstäbchen

        // Verbindungsstäbchen (Rung)
        drawables.push({
          type: 'rung',
          y: s.y,
          x1: s.x1,
          x2: s.x2,
          z: 0,
          bright: brightRung,
        })

        // Kugel für Strang A
        drawables.push({
          type: 'sphere',
          y: s.y,
          x: s.x1,
          z: s.z,
          bright: brightA,
          color: s.colorA,
        })

        // Kugel für Strang B
        drawables.push({
          type: 'sphere',
          y: s.y,
          x: s.x2,
          z: -s.z,
          bright: brightB,
          color: s.colorB,
        })
      }

      // Depth Sorting (Painter's Algorithm): hintere Elemente (kleines z) zuerst zeichnen.
      // Wenn z identisch ist (z.B. bei z = 0), zeichnen wir Verbindungsstäbchen zuerst.
      drawables.sort((a, b) => {
        if (a.z !== b.z) {
          return a.z - b.z
        }
        if (a.type === 'rung' && b.type === 'sphere') return -1
        if (a.type === 'sphere' && b.type === 'rung') return 1
        return 0
      })

      // ── Drawables zeichnen ───────────────────────────────────────────────────
      for (const d of drawables) {
        if (d.type === 'rung') {
          // Verbindungsstäbchen zwischen den Strängen
          const rungAlpha = d.bright * 0.55
          ctx!.strokeStyle = `rgba(60,160,80,${rungAlpha})`
          ctx!.lineWidth   = Math.max(0.5, radius * 0.04)
          ctx!.beginPath()
          ctx!.moveTo(d.x1, d.y)
          ctx!.lineTo(d.x2, d.y)
          ctx!.stroke()
        } else {
          // Kugel (opaque Sphären mit radialem 3D-Verlauf)
          const dotR = Math.max(1, radius * 0.18 * d.bright)
          const [r, g, b] = d.color

          // Radialer Verlauf für echten 3D-Glanz
          const grad = ctx!.createRadialGradient(
            d.x - dotR * 0.25, d.y - dotR * 0.25, dotR * 0.05,
            d.x, d.y, dotR
          )
          
          const baseColor = `rgb(${Math.round(r * d.bright)}, ${Math.round(g * d.bright)}, ${Math.round(b * d.bright)})`
          const highlightColor = `rgb(${Math.round(Math.min(255, r * d.bright + (255 - r) * 0.5))}, ${Math.round(Math.min(255, g * d.bright + (255 - g) * 0.5))}, ${Math.round(Math.min(255, b * d.bright + (255 - b) * 0.5))})`
          
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.2, highlightColor)
          grad.addColorStop(1, baseColor)

          ctx!.fillStyle = grad
          ctx!.beginPath()
          ctx!.arc(d.x, d.y, dotR, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      // ── Scrollende Basensequenz unten ────────────────────────────────────────
      const tickerY   = helixH + 4                    // Abstand unter der Helix
      const fontSize  = Math.max(8, Math.min(13, Math.round(tickerH * 0.72)))
      ctx!.font       = `${fontSize}px monospace`
      ctx!.textBaseline = 'top'

      // Scrollgeschwindigkeit: eine Base pro ~0.3 s
      const scrollOffset = Math.floor(ts * 3.3) % BASE_SEQ.length

      // Trennlinie zwischen Helix und Ticker
      ctx!.strokeStyle = '#1a4020'
      ctx!.lineWidth   = 0.5
      ctx!.beginPath()
      ctx!.moveTo(0, tickerY - 2)
      ctx!.lineTo(W, tickerY - 2)
      ctx!.stroke()

      // Ticker-Label
      ctx!.fillStyle = '#166534'
      ctx!.fillText('SEQ:', 2, tickerY)

      // Basen einzeln zeichnen — jede Base bekommt ihre Farbe
      const labelW    = ctx!.measureText('SEQ: ').width
      const charW     = ctx!.measureText('A').width + 1   // +1px Abstand
      const maxChars  = Math.floor((W - labelW - 4) / charW)

      for (let i = 0; i < maxChars; i++) {
        const base = BASE_SEQ[(scrollOffset + i) % BASE_SEQ.length]
        const colorTuple = BASE_COLORS[base] ?? [0, 255, 102]
        ctx!.fillStyle = `rgb(${colorTuple[0]}, ${colorTuple[1]}, ${colorTuple[2]})`
        // Leichte Abschwächung für alternierenden effekt
        ctx!.globalAlpha = i % 2 === 0 ? 0.9 : 0.55
        ctx!.fillText(base, 2 + labelW + i * charW, tickerY)
      }
      ctx!.globalAlpha = 1

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    // Cleanup beim Unmount
    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="DNA SEQUENCE // HELIX SCAN ACTIVE">
      {/* Canvas füllt den Panel-Body vollständig (flex-1 min-h-0 vom Panel) */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(DNAHelix);
