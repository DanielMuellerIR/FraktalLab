import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Breite und Höhe der internen Canvas-Auflösung
const W = 80, H = 50

// Sechs Signalmodi — rotieren alle 6–12 Sekunden
type Mode = 'ekg' | 'seismic' | 'fm' | 'interference' | 'noise' | 'echo'

// Kurzer Titel-Suffix pro Modus, erscheint im Canvas unten links
const MODE_LABELS: Record<Mode, string> = {
  ekg:          'CARDIAC TRACE // SUBJECT ALIVE',
  seismic:      'SEISMIC ARRAY // TREMOR DETECTED',
  fm:           'RF SCAN // 88.5–108 MHz',
  interference: 'CARRIER WAVE // INTERFERENCE',
  noise:        'BROADBAND NOISE // FILTERING',
  echo:         'SONAR PULSE // DEPTH 1240m',
}

const MODES: Mode[] = ['ekg', 'seismic', 'fm', 'interference', 'noise', 'echo']

export default function OscilloscopePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let alive = true

    // Scrolling-Waveform-Buffer: je ein Y-Wert pro Spalte
    const buffer = new Float32Array(W).fill(H / 2)

    // Zustand für Brownian-Noise-Modi (seismic, noise)
    let noiseY = H / 2
    // Oszillator-Phase für FM
    let fmPhase = 0

    let modeIdx = 0
    let mode: Mode = MODES[modeIdx]
    let modeChangeAt = 0   // Zeitpunkt des nächsten Mode-Wechsels (ms)

    // Wahl der Modus-Wechselzeit: 6–12 Sekunden
    function scheduleNext(now: number) {
      modeChangeAt = now + 6000 + Math.random() * 6000
    }

    // Berechnet den nächsten Sample-Y-Wert für den aktuellen Modus
    function nextSample(t: number): number {
      switch (mode) {
        case 'ekg': {
          // PQRST-Herzschlagkomplex mit 1,1s-Periode
          const period = 1100
          const p = (t % period) / period
          let v = 0
          if      (p < 0.07)                { v =  Math.sin(p / 0.07 * Math.PI) * 0.12 }        // P-Welle
          else if (p < 0.32)                { v =  0                                    }        // PR-Strecke
          else if (p < 0.35)                { v = -0.18                                 }        // Q-Zacke
          else if (p < 0.37)                { v =  1.0                                  }        // R-Zacke (Spike)
          else if (p < 0.39)                { v = -0.22                                 }        // S-Zacke
          else if (p < 0.52)                { v =  Math.sin((p - 0.39) / 0.13 * Math.PI) * 0.28 } // T-Welle
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
        case 'noise': {
          // Gefiltertes Breitbandrauschen (Tiefpasscharakter)
          noiseY += (Math.random() - 0.5) * 5
          noiseY += (H / 2 - noiseY) * 0.12
          noiseY = Math.max(3, Math.min(H - 3, noiseY))
          return noiseY
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
      }
    }

    function loop(t: number) {
      if (!alive) return

      // Modus wechseln?
      if (modeChangeAt === 0) scheduleNext(t)
      if (t >= modeChangeAt) {
        modeIdx = (modeIdx + 1) % MODES.length
        mode    = MODES[modeIdx]
        // Zustand für neue Modi zurücksetzen
        noiseY  = H / 2
        fmPhase = 0
        scheduleNext(t)
      }

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
    return () => { alive = false; cancelAnimationFrame(rafId) }
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
