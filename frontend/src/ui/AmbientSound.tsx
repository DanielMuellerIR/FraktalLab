import { useEffect, useRef } from 'react'

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
      ctxRef.current?.close()
      ctxRef.current = null
      return
    }

    const ctx = new AudioContext()
    ctxRef.current = ctx

    // Problem 1 — Autostart-Fix: Beim ersten User-Gesture AudioContext fortsetzen.
    // Browser starten AudioContext im "suspended"-Zustand. Der erste Click/Key/Touch
    // weckt ihn auf — danach läuft alles ohne weiteres Zutun.
    function onFirstGesture() {
      ctx.resume().catch(() => { /* kein Fehler werfen wenn ctx bereits geschlossen */ })
      document.removeEventListener('click',      onFirstGesture)
      document.removeEventListener('keydown',    onFirstGesture)
      document.removeEventListener('touchstart', onFirstGesture)
    }
    document.addEventListener('click',      onFirstGesture)
    document.addEventListener('keydown',    onFirstGesture)
    document.addEventListener('touchstart', onFirstGesture)

    // Einen vollständigen Tastendruck-Sound erzeugen (3 Schichten)
    function pressKey(volume = 1.0) {
      if (ctx.state === 'closed') return
      const now = ctx.currentTime

      // Schicht 1: HF-Klick-Transient (2–4 ms, Bandpass 4–7 kHz)
      const hfDur  = 0.002 + Math.random() * 0.002
      const hfBuf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * hfDur), ctx.sampleRate)
      const hfData = hfBuf.getChannelData(0)
      for (let i = 0; i < hfData.length; i++)
        hfData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hfData.length, 2)
      const hfSrc  = ctx.createBufferSource()
      const hfBpf  = ctx.createBiquadFilter()
      const hfGain = ctx.createGain()
      hfSrc.buffer        = hfBuf
      hfBpf.type          = 'bandpass'
      hfBpf.frequency.value = 4000 + Math.random() * 3000
      hfBpf.Q.value       = 0.9
      hfGain.gain.value   = (0.18 + Math.random() * 0.14) * volume
      hfSrc.connect(hfBpf); hfBpf.connect(hfGain); hfGain.connect(ctx.destination)
      hfSrc.start(now)

      // Schicht 2: LF-Body-Thump (8–14 ms, Tiefpass 300–500 Hz)
      const lfDur  = 0.008 + Math.random() * 0.006
      const lfBuf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * lfDur), ctx.sampleRate)
      const lfData = lfBuf.getChannelData(0)
      for (let i = 0; i < lfData.length; i++)
        lfData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lfData.length, 1.5)
      const lfSrc  = ctx.createBufferSource()
      const lfLpf  = ctx.createBiquadFilter()
      const lfGain = ctx.createGain()
      lfSrc.buffer        = lfBuf
      lfLpf.type          = 'lowpass'
      lfLpf.frequency.value = 300 + Math.random() * 200
      lfGain.gain.value   = (0.10 + Math.random() * 0.10) * volume
      lfSrc.connect(lfLpf); lfLpf.connect(lfGain); lfGain.connect(ctx.destination)
      lfSrc.start(now)

      // Schicht 3: Key-Release-Klick (optional, leise, 30–50 ms später)
      if (Math.random() > 0.45) {
        const relDelay = 0.030 + Math.random() * 0.020
        const relDur   = 0.002 + Math.random() * 0.002
        const relBuf   = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * relDur), ctx.sampleRate)
        const relData  = relBuf.getChannelData(0)
        for (let i = 0; i < relData.length; i++)
          relData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / relData.length, 3)
        const relSrc  = ctx.createBufferSource()
        const relHpf  = ctx.createBiquadFilter()
        const relGain = ctx.createGain()
        relSrc.buffer       = relBuf
        relHpf.type         = 'highpass'
        relHpf.frequency.value = 3000 + Math.random() * 2000
        relGain.gain.value  = (0.04 + Math.random() * 0.04) * volume
        relSrc.connect(relHpf); relHpf.connect(relGain); relGain.connect(ctx.destination)
        relSrc.start(now + relDelay)
      }
    }

    // Schwerer Spacebar-Thump: extra Low-Frequenz-Schicht für den satten Druck
    function pressSpacebar() {
      // Normalen Klick mit etwas höherem Volumen
      pressKey(1.1)

      // Zusätzliche tiefe Thump-Schicht (60–120 Hz) für das schwere Spacebar-Gefühl
      if (ctx.state === 'closed') return
      const now    = ctx.currentTime
      const dur    = 0.018 + Math.random() * 0.010
      const buf    = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
      const data   = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2)
      const src    = ctx.createBufferSource()
      const lpf    = ctx.createBiquadFilter()
      const gain   = ctx.createGain()
      src.buffer        = buf
      lpf.type          = 'lowpass'
      lpf.frequency.value = 80 + Math.random() * 60   // 80–140 Hz
      gain.gain.value   = 0.20 + Math.random() * 0.10
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination)
      src.start(now)
    }

    // Problem 2 — Tastatur-Sounds: Physische Tastendrücke klingen lassen
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') {
        // Leertaste: schwerer, bassiger Klick
        pressSpacebar()
      } else {
        // Alle anderen Tasten: leise, um Überlappung mit Zustandsautomat zu minimieren
        pressKey(0.7)
      }
    }
    document.addEventListener('keydown', onKey)

    // Problem 3 — Maus-Klick-Sounds: Jeder Mausklick erzeugt ein weiches Click
    function onMouse() {
      pressKey(0.5)
    }
    document.addEventListener('mousedown', onMouse)

    // CRT-Summen: leises Sägezan-Summen bei ~15,7 kHz
    const humOsc  = ctx.createOscillator()
    const humGain = ctx.createGain()
    humOsc.frequency.value = 15700
    humOsc.type            = 'sawtooth'
    humGain.gain.value     = 0.004
    humOsc.connect(humGain)
    humGain.connect(ctx.destination)
    humOsc.start()

    // Gelegentlicher Ping-Ton (Systembeep-artig)
    let pingTimer: ReturnType<typeof setTimeout>
    function schedulePing() {
      pingTimer = setTimeout(() => {
        if (ctx.state !== 'closed') {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.value = 800 + Math.random() * 700
          osc.type            = 'sine'
          gain.gain.setValueAtTime(0.025, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.22)
        }
        schedulePing()
      }, 12_000 + Math.random() * 20_000)
    }
    schedulePing()

    // ── Varianz-Zustandsautomat ─────────────────────────────────────────────────
    // Zustände: 'idle' (Pause), 'thinking' (langsam), 'typing' (normal), 'burst' (schnell)
    type TState = 'idle' | 'thinking' | 'typing' | 'burst'

    // Gewichtete Übergangstabelle
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

    // Intervall in ms für aktuellen Zustand
    function interval(state: TState): number {
      switch (state) {
        case 'idle':     return 300 + Math.random() * 1700  // 0.3–2 s Pause
        case 'thinking': return 180 + Math.random() * 600   // 0.18–0.78 s
        case 'typing':   return 55  + Math.random() * 120   // 55–175 ms normal
        case 'burst':    return 15  + Math.random() * 25    // Problem 4: 15–40 ms (vorher 22–67 ms)
      }
    }

    let state: TState = 'idle'
    let burstCount    = 0
    let typingTimer: ReturnType<typeof setTimeout>

    function tick() {
      if (ctx.state === 'closed') return

      // Im Nicht-Idle-Zustand Taste drücken
      if (state !== 'idle') {
        pressKey(0.65 + Math.random() * 0.55)

        // Problem 4 — Burst-Intensivierung: im Burst-Modus 2 Klicks pro Tick,
        // zweiter Click 10 ms versetzt, damit es mehr hetzt.
        if (state === 'burst') {
          setTimeout(() => {
            if (ctx.state !== 'closed') pressKey(0.55 + Math.random() * 0.40)
          }, 10)
        }
      }

      // Burst-Länge verwalten
      if (state === 'burst') {
        burstCount++
        if (burstCount >= 3 + Math.floor(Math.random() * 9)) {
          burstCount = 0
          state = pick(NEXT.burst)
        }
      } else if (Math.random() > 0.82) {
        // Zufälliger Zustandswechsel (nicht bei jedem Tick)
        state = pick(NEXT[state])
        if (state === 'burst') burstCount = 0
      }

      typingTimer = setTimeout(tick, interval(state))
    }

    // Kurze Einschwinglzeit, dann starten
    typingTimer = setTimeout(tick, 400 + Math.random() * 1200)

    stopperRef.current = () => {
      clearTimeout(typingTimer)
      clearTimeout(pingTimer)
      try { humOsc.stop() } catch (_) { /* bereits gestoppt */ }
      humOsc.disconnect()
    }

    return () => {
      // Alle Event-Listener sauber entfernen, bevor der AudioContext geschlossen wird
      document.removeEventListener('click',      onFirstGesture)
      document.removeEventListener('keydown',    onFirstGesture)
      document.removeEventListener('touchstart', onFirstGesture)
      document.removeEventListener('keydown',    onKey)
      document.removeEventListener('mousedown',  onMouse)
      stopperRef.current?.()
      ctx.close()
    }
  }, [enabled])

  // Unsichtbare Komponente — erzeugt nur Audio
  return null
}
