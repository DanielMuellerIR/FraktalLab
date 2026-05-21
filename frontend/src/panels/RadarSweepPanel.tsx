import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Konstanten ───────────────────────────────────────────────────────────────

// Rotationsdauer einer vollen 360°-Umdrehung in Millisekunden
const SWEEP_PERIOD_MS = 4000

// Maximale Anzahl aktiver Blips auf dem Schirm gleichzeitig
const MAX_BLIPS = 12

// Wie viele Blips beim Start zufällig vorinitialisiert werden
const INITIAL_BLIPS = 10

// Wie lang ein Blip nach dem Sweep-Durchgang sichtbar bleibt (ms)
const BLIP_FADE_MS = 3500

// Breite des Nachleuchtbogen hinter dem Sweep (in Radiant, ~90°)
const TRAIL_ARC = Math.PI / 2

// Mögliche Label-Bezeichnungen für Blips
const BLIP_LABELS = [
  'TGT-01', 'TGT-02', 'TGT-03',
  'UNK-03', 'UNK-07', 'UNK-11',
  'ECHO-4', 'ECHO-9',
  'ALT-02', 'BOGEY',
  'TRACK-5', 'TRACK-8',
]

// ── Typen ────────────────────────────────────────────────────────────────────

interface Blip {
  // Polarkoordinaten relativ zum Mittelpunkt (r = 0..1, Bruchteil des Radius)
  r: number
  angle: number       // Winkel in Radiant, auf dem Blip liegt

  // Bewegung: einige Blips driften langsam
  angularSpeed: number  // rad/ms (0 = statisch)
  radialSpeed: number   // Änderung von r pro ms (0 = statisch)

  // Anzeige-Metadaten
  label: string | null  // null = kein Label

  // Zustand
  lastHitTime: number   // Zeitstempel (ms) wann der Sweep zuletzt drüberging
  alpha: number         // aktuell angezeigte Deckkraft (0..1)
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Gibt einen zufälligen Wert zwischen min und max zurück */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Erzeugt einen neuen zufälligen Blip. lastHitTime = -Infinity → startet unsichtbar */
function makeBlip(now: number, visible: boolean): Blip {
  // Blips erscheinen nicht ganz im Zentrum und nicht ganz am Rand
  const r = rand(0.12, 0.92)
  const angle = rand(0, Math.PI * 2)

  // ~30 % der Blips bewegen sich langsam
  const moving = Math.random() < 0.3
  const angularSpeed = moving ? rand(0.00004, 0.00015) * (Math.random() < 0.5 ? 1 : -1) : 0
  const radialSpeed  = moving ? rand(-0.00003, 0.00003) : 0

  // ~60 % der Blips erhalten ein lesbares Label
  const hasLabel = Math.random() < 0.6
  const label = hasLabel ? BLIP_LABELS[Math.floor(Math.random() * BLIP_LABELS.length)] : null

  return {
    r,
    angle,
    angularSpeed,
    radialSpeed,
    label,
    lastHitTime: visible ? now - rand(0, BLIP_FADE_MS * 0.8) : -Infinity,
    alpha: 0,
  }
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function RadarSweepPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // TypeScript-Closure-Narrowing: Assertion trägt in Closures nicht weiter.
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive = true

    // ── IntersectionObserver: Pause wenn Panel nicht sichtbar ───────────────
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────────
    const resize = () => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Blip-Pool initialisieren ─────────────────────────────────────────────
    const blips: Blip[] = []
    // Beim Start sofort einige sichtbare Blips erzeugen (damit der Schirm nicht leer wirkt)
    for (let i = 0; i < INITIAL_BLIPS; i++) {
      blips.push(makeBlip(0, /* visible= */ true))
    }

    // ── Animations-Loop ──────────────────────────────────────────────────────
    function loop(t: number) {
      if (!alive) return
      // Panel nicht sichtbar → Frame überspringen, Loop am Leben lassen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }

      // Mittelpunkt und nutzbarer Radius (mit etwas Rand)
      const cx = W / 2
      const cy = H / 2
      const R  = Math.min(cx, cy) * 0.88

      // Aktueller Sweep-Winkel: 0 → 2π im Verlauf von SWEEP_PERIOD_MS
      // Winkel 0 zeigt nach oben (−π/2 in Canvas-Koordinaten), dreht im Uhrzeigersinn
      const sweepFrac = (t % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS
      const sweepAngle = sweepFrac * Math.PI * 2  // 0..2π

      // ── Hintergrund ───────────────────────────────────────────────────────
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // ── Sweep-Nachleuchten (Gradient-Kegel hinter der Linie) ──────────────
      // Der Kegel beginnt bei sweepAngle und geht TRAIL_ARC radians zurück
      // (also im Uhrzeigersinn: von sweepAngle-TRAIL_ARC bis sweepAngle).
      // Wir zeichnen ihn als gefüllten Kreissektor mit radialem Gradient.
      {
        // Canvas dreht Winkel 0 nach rechts; wir wollen 0 = oben → Offset −π/2
        const canvasAngle = sweepAngle - Math.PI / 2
        const startAngle  = canvasAngle - TRAIL_ARC
        const endAngle    = canvasAngle

        // Radialer Gradient: Mitte hell, Rand transparent
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
        grad.addColorStop(0,   'rgba(0,255,65,0.18)')
        grad.addColorStop(0.4, 'rgba(0,255,65,0.10)')
        grad.addColorStop(1,   'rgba(0,255,65,0.0)')

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()
      }

      // ── Konzentrische Reichweitsringe ──────────────────────────────────────
      const ringCount = 4
      ctx.lineWidth = 0.8
      for (let i = 1; i <= ringCount; i++) {
        const rr = R * (i / ringCount)
        ctx.strokeStyle = 'rgba(0,255,65,0.18)'
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── Fadenkreuz durch den Mittelpunkt ───────────────────────────────────
      ctx.strokeStyle = 'rgba(0,255,65,0.10)'
      ctx.lineWidth   = 0.6
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.stroke()

      // Diagonale Linien (45°-Kreuz) noch dezenter
      ctx.strokeStyle = 'rgba(0,255,65,0.06)'
      ctx.beginPath()
      ctx.moveTo(cx - R * 0.707, cy - R * 0.707); ctx.lineTo(cx + R * 0.707, cy + R * 0.707)
      ctx.moveTo(cx + R * 0.707, cy - R * 0.707); ctx.lineTo(cx - R * 0.707, cy + R * 0.707)
      ctx.stroke()

      // ── Sweep-Linie ────────────────────────────────────────────────────────
      {
        const canvasAngle = sweepAngle - Math.PI / 2
        const ex = cx + Math.cos(canvasAngle) * R
        const ey = cy + Math.sin(canvasAngle) * R

        // Linien-Gradient: Mitte sehr hell, Spitze etwas gedämpft
        const lineGrad = ctx.createLinearGradient(cx, cy, ex, ey)
        lineGrad.addColorStop(0,   'rgba(0,255,65,0.0)')
        lineGrad.addColorStop(0.1, 'rgba(0,255,65,0.9)')
        lineGrad.addColorStop(1,   'rgba(0,255,65,0.6)')

        ctx.strokeStyle = lineGrad
        ctx.lineWidth   = 1.5
        ctx.shadowColor  = '#00ff41'
        ctx.shadowBlur   = 6
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // ── Äußerer Begrenzungskreis ───────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0,255,65,0.45)'
      ctx.lineWidth   = 1.0
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      // ── Blips aktualisieren und zeichnen ────────────────────────────────────

      // Pool: wenn zu wenig Blips vorhanden, neue hinzufügen
      while (blips.length < MAX_BLIPS) {
        blips.push(makeBlip(t, /* visible= */ false))
      }

      const dt = 1000 / 60  // Näherung: ein Frame ≈ 16.67ms (für Bewegung unkritisch)

      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i]

        // Blip-Position animieren (driftende Targets)
        b.angle += b.angularSpeed * dt
        b.r     += b.radialSpeed  * dt

        // Blip, der aus dem sichtbaren Bereich driftet, entfernen und ersetzen
        if (b.r < 0.05 || b.r > 0.95) {
          blips.splice(i, 1)
          blips.push(makeBlip(t, false))
          continue
        }

        // Prüfen, ob der Sweep-Strahl gerade über diesen Blip läuft
        // (Sweep-Winkel normalisiert auf 0..2π, Blip-Winkel ebenfalls)
        const normalBlip  = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const normalSweep = sweepAngle % (Math.PI * 2)
        // Winkelabstand zwischen Sweep und Blip (vorwärts im Uhrzeigersinn)
        const angDist = ((normalSweep - normalBlip) + Math.PI * 2) % (Math.PI * 2)

        // Wenn Sweep knapp vor dem Blip liegt (innerhalb 3°), registrieren
        if (angDist < 0.05) {
          b.lastHitTime = t
        }

        // Deckkraft berechnen: sofort voll sichtbar nach Hit, dann linear abklingen
        const msSinceHit = t - b.lastHitTime
        if (msSinceHit < 0) {
          b.alpha = 0
        } else if (msSinceHit < 50) {
          b.alpha = 1.0   // kurzer Peak-Flash beim Hit
        } else {
          b.alpha = Math.max(0, 1 - (msSinceHit - 50) / BLIP_FADE_MS)
        }

        if (b.alpha <= 0) continue

        // Canvas-Koordinaten des Blips
        // Blip-Angle 0 = oben, dreht clockwise (wie der Sweep)
        const bCanvasAngle = b.angle - Math.PI / 2
        const bx = cx + Math.cos(bCanvasAngle) * b.r * R
        const by = cy + Math.sin(bCanvasAngle) * b.r * R

        // Blip-Kern: kleiner heller Punkt
        const blipRadius = 2.5
        ctx.shadowColor = '#00ff41'
        ctx.shadowBlur  = b.alpha > 0.5 ? 8 : 4

        ctx.fillStyle = `rgba(0,255,65,${b.alpha})`
        ctx.beginPath()
        ctx.arc(bx, by, blipRadius, 0, Math.PI * 2)
        ctx.fill()

        // Kurzer Nachleucht-Ring um frische Blips
        if (b.alpha > 0.7) {
          const ringAlpha = (b.alpha - 0.7) / 0.3  // 0..1 nur in den ersten 30% der Sichtbarkeit
          ctx.strokeStyle = `rgba(0,255,65,${ringAlpha * 0.5})`
          ctx.lineWidth   = 0.8
          ctx.beginPath()
          ctx.arc(bx, by, blipRadius + 3 * (1 - ringAlpha), 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.shadowBlur = 0

        // Label neben dem Blip (nur wenn Blip gut sichtbar ist)
        if (b.label && b.alpha > 0.25) {
          const fontSize = Math.max(8, Math.min(11, W * 0.025))
          ctx.font      = `${fontSize}px monospace`
          ctx.fillStyle = `rgba(0,255,65,${b.alpha * 0.85})`
          ctx.textBaseline = 'middle'

          // Label links oder rechts je nach Position auf dem Schirm
          const labelOffset = blipRadius + 5
          if (bx > cx) {
            ctx.textAlign = 'left'
            ctx.fillText(b.label, bx + labelOffset, by)
          } else {
            ctx.textAlign = 'right'
            ctx.fillText(b.label, bx - labelOffset, by)
          }
        }
      }

      // ── Info-Overlay unten ────────────────────────────────────────────────
      {
        const fontSize = Math.max(8, Math.min(11, W * 0.026))
        ctx.font         = `${fontSize}px monospace`
        ctx.textBaseline = 'bottom'
        ctx.textAlign    = 'left'

        // Linke Seite: Modus + Bereich
        ctx.fillStyle = 'rgba(0,255,65,0.55)'
        ctx.fillText('RADAR // SECTOR SCAN', 6, H - 4)

        // Rechte Seite: Rotationsgeschwindigkeit + Bereich
        ctx.textAlign = 'right'
        const rpmText = `RNG: ${(R / Math.min(W, H) * 100).toFixed(0)}km  ROT: ${(60000 / SWEEP_PERIOD_MS).toFixed(1)}RPM`
        ctx.fillStyle = 'rgba(0,255,65,0.38)'
        ctx.fillText(rpmText, W - 6, H - 4)

        // Sweep-Winkel-Indikator oben rechts
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'top'
        ctx.fillStyle    = 'rgba(0,255,65,0.35)'
        const bearingDeg = Math.round((sweepAngle * 180 / Math.PI) % 360)
        ctx.fillText(`HDG: ${bearingDeg.toString().padStart(3, '0')}°`, W - 6, 4)
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="RADAR // SECTOR SCAN">
      {/* Canvas füllt den Panel-Body vollständig */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}
