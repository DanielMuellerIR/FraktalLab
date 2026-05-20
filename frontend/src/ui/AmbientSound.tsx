import { useEffect, useRef, useCallback } from 'react'

// Erzeugt Hacker-Ambient-Sounds mit der Web Audio API:
// - Tastenanschläge (zufällige kurze Klicks)
// - Gelegentliche Ping-Töne (kurze Pieptöne)
// - Leises CRT-Summen

interface AmbientSoundProps {
  enabled: boolean
}

export default function AmbientSound({ enabled }: AmbientSoundProps) {
  // AudioContext im Ref halten damit er nicht bei jedem Render neu erstellt wird
  const ctxRef     = useRef<AudioContext | null>(null)
  const stopperRef = useRef<(() => void) | null>(null)

  // Einen einzelnen Tastatur-Klick erzeugen: kurzes weißes Rauschen
  const playClick = useCallback((ctx: AudioContext) => {
    const buf    = ctx.createBuffer(1, ctx.sampleRate * 0.012, ctx.sampleRate)
    const data   = buf.getChannelData(0)
    // Kurzes abklingendes Rauschen
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    }
    const src  = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf
    // Lautstärke variiert leicht (0.03–0.08) für natürlicheres Gefühl
    gain.gain.value = 0.03 + Math.random() * 0.05
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  }, [])

  // Gelegentlichen Ping-Ton erzeugen: kurzer Sinuston der abklingt
  const playPing = useCallback((ctx: AudioContext) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    // Frequenz zwischen 800 und 2000 Hz (Hochton-Bereich)
    osc.frequency.value = 800 + Math.random() * 1200
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }, [])

  // CRT-Summen: dauerhafter leiser Ton bei ~15.7 kHz (klassische Frequenz alter Röhrenmonitore)
  const startCrtHum = useCallback((ctx: AudioContext) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 15700
    osc.type = 'sawtooth'
    gain.gain.value = 0.005
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    return () => { osc.stop(); osc.disconnect() }
  }, [])

  useEffect(() => {
    if (!enabled) {
      // Sound deaktiviert: alles stoppen und AudioContext schließen
      stopperRef.current?.()
      stopperRef.current = null
      ctxRef.current?.close()
      ctxRef.current = null
      return
    }

    // AudioContext erstellen (Browser erlaubt das erst nach User-Interaktion)
    const ctx = new AudioContext()
    ctxRef.current = ctx

    // CRT-Summen starten und Stopper speichern
    const stopHum = startCrtHum(ctx)

    // Tipp-Sound-Loop: zufällige Klicks in 50–300ms Abständen
    let clickTimeout: ReturnType<typeof setTimeout>
    function scheduleClick() {
      const delay = 50 + Math.random() * 250
      clickTimeout = setTimeout(() => {
        if (ctx.state !== 'closed') {
          playClick(ctx)
          // Manchmal Burst: 2-4 schnelle Klicks hintereinander (wie ein Wort tippen)
          if (Math.random() > 0.7) {
            const burstCount = 2 + Math.floor(Math.random() * 3)
            for (let i = 1; i <= burstCount; i++) {
              setTimeout(() => {
                if (ctx.state !== 'closed') playClick(ctx)
              }, i * (30 + Math.random() * 60))
            }
          }
        }
        scheduleClick()
      }, delay)
    }
    scheduleClick()

    // Ping-Töne: alle 8–25 Sekunden
    let pingTimeout: ReturnType<typeof setTimeout>
    function schedulePing() {
      const delay = 8_000 + Math.random() * 17_000
      pingTimeout = setTimeout(() => {
        if (ctx.state !== 'closed') playPing(ctx)
        schedulePing()
      }, delay)
    }
    schedulePing()

    stopperRef.current = () => {
      clearTimeout(clickTimeout)
      clearTimeout(pingTimeout)
      stopHum()
    }

    return () => {
      stopperRef.current?.()
      ctx.close()
    }
  }, [enabled, playClick, playPing, startCrtHum])

  // Diese Komponente rendert nichts Sichtbares — sie ist nur für den Ton
  return null
}
