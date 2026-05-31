import { useEffect, useRef } from 'react'
import { getSharedAudioContext, isSharedAudioContextRunning } from '../utils/shared-audio'

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVIERT am 2026-05-31 (Relaunch-Audio-Konzept): Diese Tipp-/Klick-Geräusch-
// Komponente wird NICHT mehr gerendert. Audio läuft jetzt ausschließlich über die
// Erst-Klick-Election eines der drei Player (siehe utils/audio-focus.ts). Die
// Datei bleibt als wiederverwendbarer Code im Repo — zum Reaktivieren wieder in
// App.tsx importieren und <AmbientSound enabled={...} /> rendern.
// ─────────────────────────────────────────────────────────────────────────────

// Erzeugt fetten, cremigen Tastatur-Sound mit Varianz-Zustandsautomat.
// Drei Klang-Schichten pro Tastendruck:
//   1. HF-Transient  — kurzes Bandpass-Rauschen ~4–7 kHz (der "Klick")
//   2. LF-Thump      — längeres Tiefpass-Rauschen ~300–500 Hz (der "Körper")
//   3. Key-Release   — leises Nachklicken 30–50 ms nach dem Anschlag (optional)

interface AmbientSoundProps {
  enabled: boolean
}

export default function AmbientSound({ enabled }: AmbientSoundProps) {
  const ctxRef     = useRef<AudioContext | null>(null)
  const stopperRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      stopperRef.current?.()
      stopperRef.current = null
      ctxRef.current = null
      return
    }

    let humOsc: OscillatorNode | null = null
    let humGain: GainNode | null = null
    let pingTimer: any = null
    let typingTimer: any = null

    // Einen vollständigen Tastendruck-Sound erzeugen (3 Schichten)
    function pressKey(volume = 1.0) {
      const activeCtx = ctxRef.current
      if (!activeCtx || activeCtx.state === 'closed') return
      const now = activeCtx.currentTime

      // Schicht 1: HF-Klick-Transient (2–4 ms, Bandpass 4–7 kHz)
      const hfDur  = 0.002 + Math.random() * 0.002
      const hfBuf  = activeCtx.createBuffer(1, Math.ceil(activeCtx.sampleRate * hfDur), activeCtx.sampleRate)
      const hfData = hfBuf.getChannelData(0)
      for (let i = 0; i < hfData.length; i++)
        hfData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hfData.length, 2)
      const hfSrc  = activeCtx.createBufferSource()
      const hfBpf  = activeCtx.createBiquadFilter()
      const hfGain = activeCtx.createGain()
      hfSrc.buffer        = hfBuf
      hfBpf.type          = 'bandpass'
      hfBpf.frequency.value = 4000 + Math.random() * 3000
      hfBpf.Q.value       = 0.9
      hfGain.gain.value   = (0.04 + Math.random() * 0.03) * volume // Weichere, weniger scharfe Klicks
      hfSrc.connect(hfBpf); hfBpf.connect(hfGain); hfGain.connect(activeCtx.destination)
      hfSrc.start(now)

      // Schicht 2: LF-Body-Thump (8–14 ms, Tiefpass 200–350 Hz)
      const lfDur  = 0.008 + Math.random() * 0.006
      const lfBuf  = activeCtx.createBuffer(1, Math.ceil(activeCtx.sampleRate * lfDur), activeCtx.sampleRate)
      const lfData = lfBuf.getChannelData(0)
      for (let i = 0; i < lfData.length; i++)
        lfData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lfData.length, 1.5)
      const lfSrc  = activeCtx.createBufferSource()
      const lfLpf  = activeCtx.createBiquadFilter()
      const lfGain = activeCtx.createGain()
      lfSrc.buffer        = lfBuf
      lfLpf.type          = 'lowpass'
      lfLpf.frequency.value = 200 + Math.random() * 150 // Tiefere, wärmere Frequenzen für mechanische Tasten
      lfGain.gain.value   = (0.14 + Math.random() * 0.08) * volume // Mehr Körper-Anteil
      lfSrc.connect(lfLpf); lfLpf.connect(lfGain); lfGain.connect(activeCtx.destination)
      lfSrc.start(now)

      // Schicht 3: Key-Release-Klick (optional, sehr leise, 30–50 ms später)
      if (Math.random() > 0.45) {
        const relDelay = 0.030 + Math.random() * 0.020
        const relDur   = 0.002 + Math.random() * 0.002
        const relBuf   = activeCtx.createBuffer(1, Math.ceil(activeCtx.sampleRate * relDur), activeCtx.sampleRate)
        const relData  = relBuf.getChannelData(0)
        for (let i = 0; i < relData.length; i++)
          relData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / relData.length, 3)
        const relSrc  = activeCtx.createBufferSource()
        const relHpf  = activeCtx.createBiquadFilter()
        const relGain = activeCtx.createGain()
        relSrc.buffer       = relBuf
        relHpf.type         = 'highpass'
        relHpf.frequency.value = 3000 + Math.random() * 2000
        relGain.gain.value  = (0.01 + Math.random() * 0.01) * volume // Dezentere Tastenfreigabe
        relSrc.connect(relHpf); relHpf.connect(relGain); relGain.connect(activeCtx.destination)
        relSrc.start(now + relDelay)
      }
    }

    // Schwerer Spacebar-Thump: extra Low-Frequenz-Schicht für den satten Druck
    function pressSpacebar() {
      pressKey(1.1)

      const activeCtx = ctxRef.current
      if (!activeCtx || activeCtx.state === 'closed') return
      const now    = activeCtx.currentTime
      const dur    = 0.018 + Math.random() * 0.010
      const buf    = activeCtx.createBuffer(1, Math.ceil(activeCtx.sampleRate * dur), activeCtx.sampleRate)
      const data   = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2)
      const src    = activeCtx.createBufferSource()
      const lpf    = activeCtx.createBiquadFilter()
      const gain   = activeCtx.createGain()
      src.buffer        = buf
      lpf.type          = 'lowpass'
      lpf.frequency.value = 80 + Math.random() * 60
      gain.gain.value   = 0.20 + Math.random() * 0.10
      src.connect(lpf); lpf.connect(gain); gain.connect(activeCtx.destination)
      src.start(now)
    }

    // Startet die eigentliche Audio-Generierung (CRT-Summen, scheduled pings, tick-loop)
    function startAudio(activeCtx: AudioContext) {
      if (ctxRef.current) return // Bereits gestartet
      ctxRef.current = activeCtx

      // CRT-Summen: leises Sägezahn-Summen bei ~15,7 kHz
      try {
        humOsc = activeCtx.createOscillator()
        humGain = activeCtx.createGain()
        humOsc.frequency.value = 15700
        humOsc.type            = 'sawtooth'
        humGain.gain.value     = 0.004
        humOsc.connect(humGain)
        humGain.connect(activeCtx.destination)
        humOsc.start()
      } catch (e) {
        console.warn('Failed to start hum osc:', e)
      }

      // Gelegentlicher Ping-Ton (Systembeep-artig)
      function schedulePing() {
        pingTimer = setTimeout(() => {
          if (activeCtx.state !== 'closed' && ctxRef.current) {
            try {
              const osc  = activeCtx.createOscillator()
              const gain = activeCtx.createGain()
              osc.frequency.value = 800 + Math.random() * 700
              osc.type            = 'sine'
              gain.gain.setValueAtTime(0.025, activeCtx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.0001, activeCtx.currentTime + 0.22)
              osc.connect(gain)
              gain.connect(activeCtx.destination)
              osc.start()
              osc.stop(activeCtx.currentTime + 0.22)
            } catch (_) {}
          }
          schedulePing()
        }, 12_000 + Math.random() * 20_000)
      }
      schedulePing()

      // ── Varianz-Zustandsautomat ─────────────────────────────────────────────────
      type TState = 'idle' | 'thinking' | 'typing' | 'burst'

      const NEXT: Record<TState, { s: TState; w: number }[]> = {
        idle:     [{ s: 'typing',   w: 5 }, { s: 'burst',    w: 3 }, { s: 'thinking', w: 2 }],
        thinking: [{ s: 'typing',   w: 5 }, { s: 'burst',    w: 2 }, { s: 'idle',     w: 3 }],
        typing:   [{ s: 'typing',   w: 4 }, { s: 'burst',    w: 3 }, { s: 'idle',     w: 2 }, { s: 'thinking', w: 1 }],
        burst:    [{ s: 'idle',     w: 4 }, { s: 'typing',   w: 4 }, { s: 'thinking', w: 2 }],
      }

      function pick(opts: { s: TState; w: number }[]): TState {
        let r = Math.random() * opts.reduce((a, o) => a + o.w, 0)
        for (const o of opts) { r -= o.w; if (r <= 0) return o.s }
        return opts[opts.length - 1].s
      }

      function interval(state: TState): number {
        switch (state) {
          case 'idle':     return 300 + Math.random() * 1700
          case 'thinking': return 180 + Math.random() * 600
          case 'typing':   return 55  + Math.random() * 120
          case 'burst':    return 15  + Math.random() * 25
        }
      }

      let state: TState = 'idle'
      let burstCount    = 0

      function tick() {
        if (!ctxRef.current || activeCtx.state === 'closed') return

        if (state !== 'idle') {
          pressKey(0.65 + Math.random() * 0.55)
          if (state === 'burst') {
            setTimeout(() => {
              if (ctxRef.current && activeCtx.state !== 'closed') pressKey(0.55 + Math.random() * 0.40)
            }, 10)
          }
        }

        if (state === 'burst') {
          burstCount++
          if (burstCount >= 3 + Math.floor(Math.random() * 9)) {
            burstCount = 0
            state = pick(NEXT.burst)
          }
        } else if (Math.random() > 0.82) {
          state = pick(NEXT[state])
          if (state === 'burst') burstCount = 0
        }

        typingTimer = setTimeout(tick, interval(state))
      }

      tick()
    }

    // Erste Interaktion abfangen und Context entsperren
    function tryUnlock() {
      const activeCtx = getSharedAudioContext()
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {})
      }
      try {
        const buffer = activeCtx.createBuffer(1, 1, 22050)
        const source = activeCtx.createBufferSource()
        source.buffer = buffer
        source.connect(activeCtx.destination)
        source.start(0)
      } catch (e) {
        console.warn('Failed to play dummy buffer for iOS unlock in AmbientSound:', e)
      }
      startAudio(activeCtx)
      cleanupUnlockListeners()
    }

    function cleanupUnlockListeners() {
      window.removeEventListener('click',      tryUnlock, { capture: true })
      window.removeEventListener('keydown',    tryUnlock, { capture: true })
      window.removeEventListener('touchstart', tryUnlock, { capture: true })
      window.removeEventListener('touchend',   tryUnlock, { capture: true })
    }

    // Wenn der AudioContext bereits läuft, starten wir direkt
    if (isSharedAudioContextRunning()) {
      startAudio(getSharedAudioContext())
    } else {
      window.addEventListener('click',      tryUnlock, { capture: true })
      window.addEventListener('keydown',    tryUnlock, { capture: true })
      window.addEventListener('touchstart', tryUnlock, { capture: true })
      window.addEventListener('touchend',   tryUnlock, { capture: true })
    }

    // Tastatur-Sounds: Physische Tastendrücke klingen lassen
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') {
        pressSpacebar()
      } else {
        pressKey(0.7)
      }
    }
    document.addEventListener('keydown', onKey)

    // Maus-Klick-Sounds: Jeder Mausklick erzeugt ein weiches Click
    function onMouse() {
      pressKey(0.5)
    }
    document.addEventListener('mousedown', onMouse)

    stopperRef.current = () => {
      cleanupUnlockListeners()
      clearTimeout(typingTimer)
      clearTimeout(pingTimer)
      try { humOsc?.stop() } catch (_) {}
      humOsc?.disconnect()
    }

    return () => {
      cleanupUnlockListeners()
      document.removeEventListener('keydown',    onKey)
      document.removeEventListener('mousedown',  onMouse)
      stopperRef.current?.()
    }
  }, [enabled])

  // Unsichtbare Komponente — erzeugt nur Audio
  return null
}

