import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Breite und Höhe der internen Canvas-Auflösung
const W = 80, H = 50

// Sieben Signalmodi — rotieren alle 6–12 Sekunden.
// 'noise' wurde durch 'spiral' (Lissajous X-Y-Modus) ersetzt.
type Mode = 'ekg' | 'seismic' | 'fm' | 'interference' | 'spiral' | 'echo'

// Kurzer Titel-Suffix pro Modus, erscheint im Canvas unten links
const MODE_LABELS: Record<Mode, string> = {
  ekg:          'CARDIAC TRACE // SUBJECT ALIVE',
  seismic:      'SEISMIC ARRAY // TREMOR DETECTED',
  fm:           'RF SCAN // 88.5–108 MHz',
  interference: 'CARRIER WAVE // INTERFERENCE',
  spiral:       'LISSAJOUS // X-Y MODE',
  echo:         'SONAR PULSE // DEPTH 1240m',
}

const MODES: Mode[] = ['ekg', 'seismic', 'fm', 'interference', 'spiral', 'echo']

// -------------------------------------------------------------------
// Lissajous-Konfiguration
// -------------------------------------------------------------------

// Koprime Verhältnisse f1:f2, die interessante Lissajous-Figuren erzeugen
const LISSAJOUS_RATIOS: Array<[number, number]> = [
  [3, 2],
  [5, 3],
  [7, 4],
  [5, 4],
  [4, 3],
  [7, 5],
]

// Wie viele Samples pro Frame für den X-Y-Plot gezeichnet werden
const XY_SAMPLES = 2500

// Anzahl der aufbewahrten Pfade für den Phosphor-Nachleuchten-Effekt
const RING_FRAMES = 80

export default function OscilloscopePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
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

    // --- Zeit-Domain-Zustand ---
    // Scrolling-Waveform-Buffer: je ein Y-Wert pro Spalte
    const buffer = new Float32Array(W).fill(H / 2)

    // Brownian-Noise-Zustand (seismic)
    let noiseY = H / 2
    // Oszillator-Phase für FM
    let fmPhase = 0

    // --- Lissajous-Zustand ---
    // Ring-Buffer für ältere Pfade (Phosphor-Persistenz)
    // Jeder Eintrag ist ein Array aus {x, y}-Punkten
    const ringBuffer: Array<Float32Array> = []  // Float32Array je [x0,y0,x1,y1,...]
    let ringHead = 0   // Index des nächsten Schreibplatzes

    // Aktuelles und nächstes Frequenzverhältnis + Crossfade-Zustand
    let ratioIdx = 0
    let nextRatioIdx = 1
    let ratioChangeAt = 0   // Zeitstempel, wann nächster Ratio-Wechsel startet
    let crossfadeStart = 0  // Zeitstempel, wann Crossfade begann
    const CROSSFADE_MS = 2000
    const RATIO_HOLD_MS = 15000
    let inCrossfade = false

    // Langsam driftende Phaseoffsets für mehr Abwechslung
    let phi1 = 0   // Phase-Offset für x-Kanal
    let phi2 = Math.PI / 4

    // --- Modus-Zustand ---
    let modeIdx = 0
    let mode: Mode = MODES[modeIdx]
    let modeChangeAt = 0   // Zeitpunkt des nächsten Mode-Wechsels (ms)

    // Wahl der Modus-Wechselzeit: 6–12 Sekunden
    function scheduleNext(now: number) {
      modeChangeAt = now + 6000 + Math.random() * 6000
    }

    // Berechnet den nächsten Sample-Y-Wert für Zeit-Domain-Modi
    function nextSample(t: number): number {
      switch (mode) {
        case 'ekg': {
          // PQRST-Herzschlagkomplex mit 1,1s-Periode
          const period = 1100
          const p = (t % period) / period
          let v = 0
          if      (p < 0.07)  { v =  Math.sin(p / 0.07 * Math.PI) * 0.12 }          // P-Welle
          else if (p < 0.32)  { v =  0                                     }          // PR-Strecke
          else if (p < 0.35)  { v = -0.18                                  }          // Q-Zacke
          else if (p < 0.37)  { v =  1.0                                   }          // R-Zacke (Spike)
          else if (p < 0.39)  { v = -0.22                                  }          // S-Zacke
          else if (p < 0.52)  { v =  Math.sin((p - 0.39) / 0.13 * Math.PI) * 0.28 } // T-Welle
          v += (Math.random() - 0.5) * 0.03  // Grundrauschen
          return H / 2 - v * H * 0.38
        }
        case 'seismic': {
          // Brownsche Bewegung mit seltenen Großereignissen
          noiseY += (Math.random() - 0.5) * 1.8
          if (Math.random() > 0.997) noiseY += (Math.random() - 0.5) * H * 0.55  // Beben
          noiseY += (H / 2 - noiseY) * 0.012   // langsame Rückkehr zur Mitte
          noiseY = Math.max(3, Math.min(H - 3, noiseY))
          return noiseY
        }
        case 'fm': {
          // FM: Träger mit modulierter Frequenz
          const modFreq = 0.00012 + 0.00008 * Math.sin(t * 0.00021)
          fmPhase += modFreq * t % 1 === 0 ? 0 : modFreq
          const v = Math.sin(fmPhase * 280) * 0.4
          return H / 2 - v * H
        }
        case 'interference': {
          // Zwei verschiedene Sinuswellen überlagert → Schwebung
          const a = Math.sin(t * 0.0063) * 0.28
          const b = Math.sin(t * 0.0091 + 1.2) * 0.18
          const c = Math.sin(t * 0.0031 + 0.4) * 0.12
          return H / 2 - (a + b + c) * H
        }
        case 'echo': {
          // Sonar-Puls: kurze Impulse mit exponentiell abklingendem Echo
          const period = 900
          const p = (t % period) / period
          let v: number
          if (p < 0.04) {
            v = Math.sin(p / 0.04 * Math.PI * 4) * (1 - p / 0.04)  // Sendepuls
          } else {
            // Echo: gedämpfter Rückwurf nach ~30% der Periode
            const echo1 = Math.abs(p - 0.28)
            const echo2 = Math.abs(p - 0.55)
            v = Math.exp(-echo1 * 60) * Math.sin(echo1 * 400) * 0.6
              + Math.exp(-echo2 * 80) * Math.sin(echo2 * 400) * 0.3
          }
          return H / 2 - v * H * 0.45
        }
        // 'spiral' ist kein Zeit-Domain-Modus — wird separat gerendert
        default:
          return H / 2
      }
    }

    // ---------------------------------------------------------------
    // Lissajous: Pfad für einen Frame berechnen
    // Gibt Float32Array [x0,y0, x1,y1, ...] zurück
    // ---------------------------------------------------------------
    function buildLissajousPath(t: number, f1: number, f2: number): Float32Array {
      const pts = new Float32Array(XY_SAMPLES * 2)
      // Amplituden: etwas Spielraum zum Rand lassen
      const A = W * 0.44
      const B = H * 0.44
      const cx = W / 2
      const cy = H / 2
      // Grundfrequenz in rad/ms — sehr langsam für sanfte Figuren
      const omega = 0.0018
      for (let i = 0; i < XY_SAMPLES; i++) {
        // t läuft als Parameterwert; i/XY_SAMPLES deckt eine volle Periode ab
        const param = t * omega + (i / XY_SAMPLES) * Math.PI * 2 * Math.max(f1, f2)
        pts[i * 2]     = cx + A * Math.sin(f1 * param + phi1)
        pts[i * 2 + 1] = cy + B * Math.sin(f2 * param + phi2)
      }
      return pts
    }

    // ---------------------------------------------------------------
    // Lissajous-Frame rendern (Ring-Buffer + Phosphor-Persistenz)
    // ---------------------------------------------------------------
    function renderSpiral(t: number) {
      // Ratio-Wechsel verwalten
      if (ratioChangeAt === 0) {
        ratioChangeAt = t + RATIO_HOLD_MS
      }
      if (!inCrossfade && t >= ratioChangeAt) {
        // Crossfade starten
        inCrossfade  = true
        crossfadeStart = t
        nextRatioIdx = (ratioIdx + 1 + Math.floor(Math.random() * (LISSAJOUS_RATIOS.length - 1))) % LISSAJOUS_RATIOS.length
      }
      if (inCrossfade && t - crossfadeStart >= CROSSFADE_MS) {
        // Crossfade abgeschlossen
        ratioIdx     = nextRatioIdx
        inCrossfade  = false
        ratioChangeAt = t + RATIO_HOLD_MS
      }

      // Aktuelles effektives Verhältnis (während Crossfade interpolieren wir die Phasen
      // — einfach: wir wechseln hart an der Crossfade-Mitte, sieht natürlich aus)
      const blend = inCrossfade ? (t - crossfadeStart) / CROSSFADE_MS : 0
      const [f1a, f2a] = LISSAJOUS_RATIOS[ratioIdx]
      const [f1b, f2b] = LISSAJOUS_RATIOS[nextRatioIdx]
      const f1 = f1a + (f1b - f1a) * blend
      const f2 = f2a + (f2b - f2a) * blend

      // Phase langsam driften lassen
      phi1 += 0.00008
      phi2 += 0.000053

      // Neuen Pfad berechnen und in Ring-Buffer eintragen
      const newPath = buildLissajousPath(t, f1, f2)
      if (ringBuffer.length < RING_FRAMES) {
        ringBuffer.push(newPath)
      } else {
        ringBuffer[ringHead] = newPath
      }
      const currentRingHead = ringHead
      ringHead = (ringHead + 1) % RING_FRAMES

      // Schwarzer Hintergrund (kein Phosphor-Decay hier, wir malen explizit)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // Fadenkreuz in der Mitte
      ctx.strokeStyle = 'rgba(0,60,20,0.6)'
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
      ctx.stroke()

      // Ältere Pfade aus dem Ring-Buffer zeichnen — älteste zuerst, am dunkelsten
      const total = Math.min(ringBuffer.length, RING_FRAMES)
      for (let age = total - 1; age >= 0; age--) {
        // age=0 → aktueller Frame (hellste), age=total-1 → ältester (dunkelste)
        const bufIdx = (currentRingHead - age + RING_FRAMES) % RING_FRAMES
        if (bufIdx >= ringBuffer.length) continue
        const pts = ringBuffer[bufIdx]
        if (!pts || pts.length < 4) continue

        // Opazität: aktueller Frame = 1.0, älteste = ~0.02
        const ageFrac = age / RING_FRAMES   // 0 = aktuell, 1 = älteste
        const alpha   = Math.pow(1 - ageFrac, 2.2)  // quadratischer Abfall

        // Farbe: aktuell = weißlich-cyan, alt = dunkelgrün
        // Interpolation: rgb(220,255,230) → rgb(0,60,20)
        const r = Math.round(220 * (1 - ageFrac))
        const g = Math.round(255 - (255 - 60) * ageFrac)
        const b = Math.round(230 * (1 - ageFrac) + 20 * ageFrac)

        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
        ctx.lineWidth   = age === 0 ? 1.0 : 0.7

        ctx.beginPath()
        ctx.moveTo(pts[0], pts[1])
        for (let i = 1; i < pts.length / 2; i++) {
          ctx.lineTo(pts[i * 2], pts[i * 2 + 1])
        }
        ctx.stroke()
      }

      // Label
      ctx.font      = '3.5px monospace'
      ctx.fillStyle = 'rgba(0,160,60,0.55)'
      ctx.fillText(MODE_LABELS['spiral'], 2, H - 2)
    }

    // ---------------------------------------------------------------
    // Haupt-Animations-Loop
    // ---------------------------------------------------------------
    function loop(t: number) {
      if (!alive) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      // Modus wechseln?
      if (modeChangeAt === 0) scheduleNext(t)
      if (t >= modeChangeAt) {
        modeIdx = (modeIdx + 1) % MODES.length
        mode    = MODES[modeIdx]
        // Zustand für neue Modi zurücksetzen
        noiseY   = H / 2
        fmPhase  = 0
        // Lissajous-Zustand bei Eintritt in Spiral-Modus zurücksetzen
        if (mode === 'spiral') {
          ringBuffer.length = 0
          ringHead          = 0
          ratioIdx          = Math.floor(Math.random() * LISSAJOUS_RATIOS.length)
          ratioChangeAt     = 0
          inCrossfade       = false
          phi1 = Math.random() * Math.PI * 2
          phi2 = Math.random() * Math.PI * 2
        }
        scheduleNext(t)
      }

      // ---- Spiral-Modus: komplett eigener Render-Pfad ----
      if (mode === 'spiral') {
        renderSpiral(t)
        rafId = requestAnimationFrame(loop)
        return
      }

      // ---- Zeit-Domain-Modi ----

      // Waveform-Buffer um 1 nach links schieben, neuen Sample rechts einfügen
      buffer.copyWithin(0, 1)
      buffer[W - 1] = nextSample(t)

      // Hintergrund mit Phosphor-Nachleuchten
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.fillRect(0, 0, W, H)

      // Leichte Rasterlinie in der Mitte (0-Linie)
      ctx.strokeStyle = 'rgba(0,80,30,0.4)'
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()

      // Waveform-Kurve zeichnen
      ctx.beginPath()
      ctx.moveTo(0, buffer[0])
      for (let x = 1; x < W; x++) ctx.lineTo(x, buffer[x])
      ctx.strokeStyle = '#00e860'
      ctx.lineWidth   = 0.9
      ctx.stroke()

      // Vertikale Sweep-Linie an der rechten Kante
      ctx.strokeStyle = 'rgba(0,255,120,0.55)'
      ctx.lineWidth   = 0.8
      ctx.beginPath()
      ctx.moveTo(W - 1, 0)
      ctx.lineTo(W - 1, H)
      ctx.stroke()

      // Modus-Label unten links
      ctx.font      = '3.5px monospace'
      ctx.fillStyle = 'rgba(0,160,60,0.55)'
      ctx.fillText(MODE_LABELS[mode], 2, H - 2)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(rafId); io.disconnect() }
  }, [])

  return (
    <Panel title="OSCILLOSCOPE // SIGNAL TRACE">
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '100%',
            aspectRatio: `${W} / ${H}`,
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
      </div>
    </Panel>
  )
}
