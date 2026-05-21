import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Farbzuordnung für die vier DNA-Basen
// A = Adenin (grün), T = Thymin (cyan), C = Cytosin (magenta), G = Guanin (gelb)
const BASE_COLORS: Record<string, string> = {
  A: '#00ff66',
  T: '#00ccff',
  C: '#ff44cc',
  G: '#ffdd00',
}

// Feste Basensequenz für den scrollenden Ticker unten
const BASE_SEQ = 'ATCGATCGATCGATCGTAGCTAGCTAGCTAATTGGCCATGCATGCATGC'

// Rotierender 3D-DNA-Doppelhelix — Biohacking-Look mit vollem Canvas-Fill
export default function DNAHelix() {
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
        colorA:  string   // Farbe Strang A
        colorB:  string   // Farbe Strang B
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

      // Painter's Algorithm: hintere Elemente (kleines z) zuerst zeichnen
      segs.sort((a, b) => a.z - b.z)

      // ── Segmente zeichnen ────────────────────────────────────────────────────
      for (const s of segs) {
        // Helligkeit anhand Tiefe: vordere Elemente (z~1) heller, hintere dunkler
        const bright = 0.25 + (s.z + 1) * 0.38   // 0.25 (hinten) bis 1.01 (vorne)

        // Radius der Basenpaar-Kreise proportional zur Helix-Größe + Tiefenwirkung
        const dotR = Math.max(1, radius * 0.18 * bright)

        // Verbindungsstäbchen zwischen den Strängen (die "Rungs" der Leiter)
        // Alpha schwächer als die Punkte, damit die Stränge dominieren
        const rungAlpha = bright * 0.55
        ctx!.strokeStyle = `rgba(60,160,80,${rungAlpha})`
        ctx!.lineWidth   = Math.max(0.5, radius * 0.04)
        ctx!.beginPath()
        ctx!.moveTo(s.x1, s.y)
        ctx!.lineTo(s.x2, s.y)
        ctx!.stroke()

        // ── Strang A: kleiner Kreis ──────────────────────────────────────────
        // Farbe mit Helligkeits-Suffix im Hex-Alpha
        const alphaHex = Math.round(bright * 255).toString(16).padStart(2, '0')
        ctx!.fillStyle = s.colorA + alphaHex
        ctx!.beginPath()
        ctx!.arc(s.x1, s.y, dotR, 0, Math.PI * 2)
        ctx!.fill()

        // Kleiner heller Glanzpunkt oben links auf dem Kreis
        if (bright > 0.7) {
          ctx!.fillStyle = `rgba(255,255,255,${(bright - 0.7) * 0.6})`
          ctx!.beginPath()
          ctx!.arc(s.x1 - dotR * 0.3, s.y - dotR * 0.3, dotR * 0.3, 0, Math.PI * 2)
          ctx!.fill()
        }

        // ── Strang B: kleiner Kreis ──────────────────────────────────────────
        ctx!.fillStyle = s.colorB + alphaHex
        ctx!.beginPath()
        ctx!.arc(s.x2, s.y, dotR, 0, Math.PI * 2)
        ctx!.fill()

        if (bright > 0.7) {
          ctx!.fillStyle = `rgba(255,255,255,${(bright - 0.7) * 0.6})`
          ctx!.beginPath()
          ctx!.arc(s.x2 - dotR * 0.3, s.y - dotR * 0.3, dotR * 0.3, 0, Math.PI * 2)
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
        ctx!.fillStyle = BASE_COLORS[base] ?? '#00ff66'
        // Leichte Abschwächung für alternierenden Effekt
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
