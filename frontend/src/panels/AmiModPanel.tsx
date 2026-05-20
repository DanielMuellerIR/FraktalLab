import { useEffect, useRef, useState, useCallback } from 'react'
import Panel from '../ui/Panel'

// ══════════════════════════════════════════════════════════════════════════════
// AmiModPanel — simulierter Amiga ProTracker mit echter Web Audio Synthese.
// Zeigt eine animierte Tracker-UI (DOM-basiert, kein Canvas) und spielt einen
// 16-Takt Chiptune-Loop über die Web Audio API.
// ══════════════════════════════════════════════════════════════════════════════

// ─── Musikdaten ──────────────────────────────────────────────────────────────

// Alle Noten in Amiga-Notation. Frequenzen in Hz.
// Amiga-typisch: Middle-C ist C-3 (261.63 Hz).
// Leere Row = "---" (Pause / laufende Note hält an).
const NOTE_FREQ: Record<string, number> = {
  'C-1':  32.70, 'C#1':  34.65, 'D-1':  36.71, 'D#1':  38.89, 'E-1':  41.20,
  'F-1':  43.65, 'F#1':  46.25, 'G-1':  49.00, 'G#1':  51.91, 'A-1':  55.00,
  'A#1':  58.27, 'B-1':  61.74,
  'C-2':  65.41, 'C#2':  69.30, 'D-2':  73.42, 'D#2':  77.78, 'E-2':  82.41,
  'F-2':  87.31, 'F#2':  92.50, 'G-2':  98.00, 'G#2': 103.83, 'A-2': 110.00,
  'A#2': 116.54, 'B-2': 123.47,
  'C-3': 130.81, 'C#3': 138.59, 'D-3': 146.83, 'D#3': 155.56, 'E-3': 164.81,
  'F-3': 174.61, 'F#3': 185.00, 'G-3': 196.00, 'G#3': 207.65, 'A-3': 220.00,
  'A#3': 233.08, 'B-3': 246.94,
  'C-4': 261.63, 'C#4': 277.18, 'D-4': 293.66, 'D#4': 311.13, 'E-4': 329.63,
  'F-4': 349.23, 'F#4': 369.99, 'G-4': 392.00, 'G#4': 415.30, 'A-4': 440.00,
  'A#4': 466.16, 'B-4': 493.88,
}

// ── Instrumente ──────────────────────────────────────────────────────────────
// Jedes Instrument hat einen OscillatorType (oder 'noise') und einen
// Envelope-Wert (sustain-Länge in Sekunden). Mix von square und sawtooth
// erzeugt den typischen Amiga-Chiptune-Klang.

type InstrumentDef = {
  type: OscillatorType | 'noise'
  type2?: OscillatorType       // Zweiter Oszillator für Waveform-Mix
  mix2?: number                // Lautstärkeanteil des zweiten Oszillators (0–1)
  attack: number               // Attack-Zeit in Sekunden
  sustain: number              // Sustain-Länge (Ton hält) in Sekunden
  release: number              // Release-Zeit in Sekunden
  gain: number                 // Basisvolumen (0–1)
  detune?: number              // Verstimmung in Cents (für Chorus-Effekt)
  vibrato?: number             // Vibrato-Tiefe in Cents (0 = kein Vibrato)
  vibratoRate?: number         // Vibrato-Frequenz in Hz
}

// 15 Amiga-Style-Instrumente (01–0F hex)
const INSTRUMENTS: InstrumentDef[] = [
  // 01 - BD (Bass Drum): weißes Rauschen, sehr kurz
  { type: 'noise', attack: 0.002, sustain: 0.04, release: 0.06, gain: 0.55 },
  // 02 - SD (Snare): Rauschen + leichte Tonkomponente
  { type: 'noise', attack: 0.002, sustain: 0.06, release: 0.08, gain: 0.40 },
  // 03 - HH (Hi-Hat): sehr kurzes Rauschen
  { type: 'noise', attack: 0.001, sustain: 0.015, release: 0.02, gain: 0.25 },
  // 04 - BASS: tiefer Sawtooth — klassischer Amiga-Bass
  { type: 'sawtooth', attack: 0.005, sustain: 0.18, release: 0.04, gain: 0.35 },
  // 05 - LEAD: Square-Wave mit Vibrato — der Melodiesynth
  { type: 'square', attack: 0.01, sustain: 0.20, release: 0.05, gain: 0.22,
    vibrato: 8, vibratoRate: 5.5 },
  // 06 - ARP: schnelle Square-Wave-Arpeggio-Töne
  { type: 'square', attack: 0.002, sustain: 0.06, release: 0.02, gain: 0.18 },
  // 07 - PAD: weicher Sawtooth + Square-Mix (Amiga-Pad-Emulation)
  { type: 'sawtooth', type2: 'square', mix2: 0.4,
    attack: 0.04, sustain: 0.25, release: 0.10, gain: 0.15, detune: 7 },
  // 08 - FX1: kurzer Sinewave-Ping
  { type: 'sine', attack: 0.003, sustain: 0.08, release: 0.12, gain: 0.20 },
  // 09 - FX2: Sawtooth mit viel Detune (schmutzig)
  { type: 'sawtooth', attack: 0.005, sustain: 0.12, release: 0.06, gain: 0.18, detune: 25 },
  // 0A - EXTRA: Triangle-ähnlich via Sine + harmonics
  { type: 'sine', attack: 0.008, sustain: 0.15, release: 0.08, gain: 0.16 },
]

// Instrument-Namen für die Sample-Liste rechts
const INSTRUMENT_NAMES = [
  'BD      BASSDRUM  C-2',
  'SD      SNARE     D-2',
  'HH      HIHAT     F#2',
  'BASS    ACID-SAW  A-2',
  'LEAD    SQ-WAVE   C-4',
  'ARP     SQ-FAST   E-4',
  'PAD     SOFT-SAW  G-3',
  'FX1     PING      A#4',
  'FX2     DIRTY-SAW B-3',
  'EXTRA   SINE-PAD  G-4',
]

// ── Sequenzdaten (16 Takte à 4 Rows = 64 Rows total) ─────────────────────────
// Format pro Row: [note_ch1, inst_ch1, fx_ch1,
//                  note_ch2, inst_ch2, fx_ch2,
//                  note_ch3, inst_ch3, fx_ch3,
//                  note_ch4, inst_ch4, fx_ch4]
// '---' = kein neuer Ton (laufende Note klingt weiter oder Stille)
// Effekte sind rein visuell — werden nicht ausgeführt, nur angezeigt.
//
// Harmoniestruktur: C-Moll → Am-Abb... vereinfacht zu
// Takt 1–4:  C-Moll (C Eb G)
// Takt 5–8:  Ab-Dur  (Ab C Eb)
// Takt 9–12: F-Moll  (F Ab C)
// Takt 13–16: G-Dur   (G B D) → Spannung → zurück zum Anfang

// Jede Zeile: [ch1_note, ch1_inst, ch1_fx, ch2_note, ch2_inst, ch2_fx,
//              ch3_note, ch3_inst, ch3_fx, ch4_note, ch4_inst, ch4_fx]
// Instrumente: '01'=BD '02'=SD '03'=HH '04'=BASS '05'=LEAD '06'=ARP
//              '07'=PAD '08'=FX1 '09'=FX2 '0A'=EXTRA

type Row = readonly [
  string, string, string,   // CH1: note, inst, effect
  string, string, string,   // CH2
  string, string, string,   // CH3
  string, string, string,   // CH4
]

// Vollständige 64-Row-Sequenz (16 Takte × 4 Rows/Takt)
const SEQUENCE: Row[] = [
  // ── Takt 01 (C-Moll-Basis) ────────────────────────────────────────────────
  ['C-2','01','000',  'C-3','05','000',  'C-4','06','000',  'C-2','07','D00'],
  ['---','--','---',  '---','--','---',  'E-4','06','000',  '---','--','---'],
  ['---','01','000',  'D#3','05','000',  'G-4','06','000',  '---','--','---'],
  ['---','--','---',  '---','--','---',  'E-4','06','000',  '---','--','---'],
  // ── Takt 02 ───────────────────────────────────────────────────────────────
  ['C-2','01','000',  'G-3','05','E01',  'C-4','06','000',  'G-2','07','000'],
  ['---','--','---',  '---','--','---',  'E-4','06','000',  '---','--','---'],
  ['---','02','000',  'F-3','05','000',  'G-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'E-4','06','000',  '---','--','---'],
  // ── Takt 03 ───────────────────────────────────────────────────────────────
  ['C-2','01','000',  'D#3','05','000',  'C-4','06','000',  'D#2','07','D00'],
  ['---','--','---',  '---','--','---',  'D#4','06','000',  '---','--','---'],
  ['---','01','000',  'C-3','05','E01',  'G-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'D#4','06','000',  '---','--','---'],
  // ── Takt 04 ───────────────────────────────────────────────────────────────
  ['C-2','01','000',  'A#2','05','000',  'C-4','06','000',  'A#1','07','000'],
  ['---','--','---',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  ['---','02','000',  'G-2','05','000',  'F-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  // ── Takt 05 (Ab-Dur-Bereich) ──────────────────────────────────────────────
  ['G#1','01','000',  'G#3','05','000',  'G#4','06','000',  'G#2','07','D00'],
  ['---','--','---',  '---','--','---',  'C-4','06','000',  '---','--','---'],  // Tipp: C ist Terz von Ab
  ['---','01','000',  'C-3','05','E01',  'D#4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'C-4','06','000',  '---','--','---'],
  // ── Takt 06 ───────────────────────────────────────────────────────────────
  ['G#1','01','000',  'D#3','05','000',  'G#4','06','000',  'D#2','07','000'],
  ['---','--','---',  '---','--','---',  'G-4','06','000',  '---','--','---'],
  ['---','02','000',  'C-3','05','000',  'D#4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'G-4','06','000',  '---','--','---'],
  // ── Takt 07 ───────────────────────────────────────────────────────────────
  ['G#1','01','000',  'G#3','05','000',  'C-4','06','000',  'G#2','07','D00'],
  ['---','--','---',  '---','--','---',  'D#4','06','000',  '---','--','---'],
  ['---','01','000',  'F-3','05','E01',  'G#4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'D#4','06','000',  '---','--','---'],
  // ── Takt 08 ───────────────────────────────────────────────────────────────
  ['G#1','01','000',  'C-3','05','000',  'C-4','06','000',  'C-2','07','000'],
  ['---','--','---',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  ['---','02','000',  'G#2','05','000',  'G#4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  // ── Takt 09 (F-Moll) ──────────────────────────────────────────────────────
  ['F-2','01','000',  'F-3','05','000',  'F-4','06','000',  'F-2','07','D00'],
  ['---','--','---',  '---','--','---',  'G#4','06','000',  '---','--','---'],
  ['---','01','000',  'G#3','05','E01',  'C-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'G#4','06','000',  '---','--','---'],
  // ── Takt 10 ───────────────────────────────────────────────────────────────
  ['F-2','01','000',  'C-3','05','000',  'F-4','06','000',  'C-2','07','000'],
  ['---','--','---',  '---','--','---',  'A#4','06','000',  '---','--','---'],
  ['---','02','000',  'F-3','05','000',  'C-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'A#4','06','000',  '---','--','---'],
  // ── Takt 11 ───────────────────────────────────────────────────────────────
  ['F-2','01','000',  'G#3','05','000',  'F-4','06','000',  'G#2','07','D00'],
  ['---','--','---',  '---','--','---',  'C-4','06','000',  '---','--','---'],
  ['---','01','000',  'F-3','05','E01',  'G#4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'C-4','06','000',  '---','--','---'],
  // ── Takt 12 ───────────────────────────────────────────────────────────────
  ['F-2','01','000',  'C-3','05','000',  'F-4','06','000',  'C-2','07','000'],
  ['---','--','---',  '---','--','---',  'A#4','06','000',  '---','--','---'],
  ['---','02','000',  'D-3','05','000',  'F-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'A#4','06','000',  '---','--','---'],
  // ── Takt 13 (G-Dur — Spannungsaufbau vor dem Loop) ────────────────────────
  ['G-2','01','000',  'G-3','05','000',  'G-4','06','000',  'G-2','07','D00'],
  ['---','--','---',  '---','--','---',  'B-4','06','000',  '---','--','---'],
  ['---','01','000',  'B-3','05','E01',  'D-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'B-4','06','000',  '---','--','---'],
  // ── Takt 14 ───────────────────────────────────────────────────────────────
  ['G-2','01','000',  'D-3','05','000',  'G-4','06','000',  'D-2','07','000'],
  ['---','--','---',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  ['---','02','000',  'G-3','05','000',  'B-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'D-4','06','000',  '---','--','---'],
  // ── Takt 15 ───────────────────────────────────────────────────────────────
  ['G-2','01','000',  'B-3','05','000',  'G-4','06','000',  'B-2','07','D00'],
  ['---','--','---',  '---','--','---',  'G-4','06','000',  '---','--','---'],
  ['---','01','000',  'G-3','05','E01',  'D-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'G-4','06','000',  '---','--','---'],
  // ── Takt 16 (Turnaround → zurück zu C-Moll) ───────────────────────────────
  ['C-2','01','000',  'G-3','05','000',  'C-4','06','000',  'G-2','07','C00'],
  ['---','--','---',  '---','--','---',  'E-4','06','000',  '---','--','---'],
  ['---','02','000',  'D#3','05','F01',  'G-4','06','000',  '---','--','---'],
  ['---','03','000',  '---','--','---',  'E-4','06','000',  '---','--','---'],
]

// BPM und Speed wie echter ProTracker
const BPM = 125
const SPEED = 6   // Ticks pro Row (Standard-ProTracker-Wert)
// Dauer einer Row in ms: (60000 / BPM) * (SPEED / 24)
const ROW_MS = (60000 / BPM) * (SPEED / 24)

// ─── Instrumenten-Index-Mapping ───────────────────────────────────────────────
// Wandelt Hex-String-Instrument (z.B. '05') in INSTRUMENTS-Array-Index um
function instIndex(instStr: string): number {
  if (instStr === '--') return -1
  const n = parseInt(instStr, 16) - 1  // '01' → 0, '0F' → 14
  return Math.min(n, INSTRUMENTS.length - 1)
}

// ─── Typen ────────────────────────────────────────────────────────────────────

// VU-Meter-Werte für 4 Kanäle (0.0–1.0)
type VuLevels = [number, number, number, number]

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function AmiModPanel() {
  // Index der aktuell gespielten Row (0–63)
  const [currentRow, setCurrentRow] = useState(0)
  // VU-Meter-Werte für alle vier Kanäle
  const [vuLevels, setVuLevels]     = useState<VuLevels>([0, 0, 0, 0])
  // Aktueller Pattern-Index (0 = Pattern 01 von 02, weil 64 Rows = 2 Pattern)
  const [patternIdx, setPatternIdx] = useState(0)
  // Audiostatus: 'inactive' | 'playing' | 'muted'
  const [audioState, setAudioState] = useState<'inactive' | 'playing' | 'muted'>('inactive')

  // AudioContext und alle Audio-Objekte leben im Ref (bleiben zwischen Renders stabil)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // Ref zum Abbrechen des Sequencer-Loops
  const stopRef     = useRef<() => void>(() => {})
  // Ref für aktuelle Row (damit Callbacks nicht veraltete State-Werte lesen)
  const rowRef      = useRef(0)

  // Für VU-Meter: Gain-Werte der aktiven Noten setzen wir direkt über Ref
  const vuRef = useRef<VuLevels>([0, 0, 0, 0])

  // ── Einzelne Note abspielen ───────────────────────────────────────────────
  const playNote = useCallback((
    ctx: AudioContext,
    noteStr: string,
    instStr: string,
    channel: number,        // 0–3 für Stereo-Panning
  ) => {
    if (noteStr === '---' || instStr === '--') return

    const freq = NOTE_FREQ[noteStr]
    if (!freq) return

    const instDef = INSTRUMENTS[instIndex(instStr)]
    if (!instDef) return

    const now     = ctx.currentTime
    const totalDur = instDef.attack + instDef.sustain + instDef.release

    // Stereo-Panning: Kanal 0+3 → links, Kanal 1+2 → rechts (wie echter Amiga)
    const panner = ctx.createStereoPanner()
    panner.pan.value = (channel === 0 || channel === 3) ? -0.6 : 0.6

    // Master-Gain (Envelope)
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.001, now)
    masterGain.gain.linearRampToValueAtTime(instDef.gain, now + instDef.attack)
    masterGain.gain.setValueAtTime(instDef.gain, now + instDef.attack + instDef.sustain)
    masterGain.gain.linearRampToValueAtTime(0.001, now + totalDur)

    masterGain.connect(panner)
    panner.connect(ctx.destination)

    if (instDef.type === 'noise') {
      // Weißes Rauschen: kurzen Buffer mit Zufallswerten füllen
      const bufLen = Math.ceil(ctx.sampleRate * totalDur)
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      src.connect(masterGain)
      src.start(now)
      src.stop(now + totalDur)
    } else {
      // Primärer Oszillator
      const osc1 = ctx.createOscillator()
      osc1.type = instDef.type as OscillatorType
      osc1.frequency.value = freq
      if (instDef.detune) osc1.detune.value = instDef.detune

      // Vibrato: LFO moduliert die Frequenz des Hauptoszillators
      if (instDef.vibrato && instDef.vibratoRate) {
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.frequency.value = instDef.vibratoRate
        lfoGain.gain.value  = instDef.vibrato
        lfo.connect(lfoGain)
        lfoGain.connect(osc1.frequency)
        lfo.start(now)
        lfo.stop(now + totalDur)
      }

      osc1.connect(masterGain)
      osc1.start(now)
      osc1.stop(now + totalDur)

      // Optionaler zweiter Oszillator für Waveform-Mix (PAD-Sound)
      if (instDef.type2) {
        const osc2     = ctx.createOscillator()
        const mixGain  = ctx.createGain()
        osc2.type      = instDef.type2
        osc2.frequency.value = freq
        // Leicht verstimmt für Chorus-Effekt
        osc2.detune.value = -(instDef.detune ?? 0)
        mixGain.gain.value = instDef.mix2 ?? 0.3
        osc2.connect(mixGain)
        mixGain.connect(masterGain)
        osc2.start(now)
        osc2.stop(now + totalDur)
      }
    }

    // VU-Meter aktualisieren: Kanal-Lautstärke kurz auf instDef.gain setzen, dann abklingen
    vuRef.current[channel] = instDef.gain
  }, [])

  // ── Sequencer starten ─────────────────────────────────────────────────────
  const startSequencer = useCallback(() => {
    // AudioContext beim ersten Benutzer-Klick erstellen (Browser-Autoplay-Policy)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current

    let row = rowRef.current
    let alive = true
    let timeoutId: ReturnType<typeof setTimeout>

    function tick() {
      if (!alive) return

      const rowData = SEQUENCE[row]

      // Alle vier Kanäle der aktuellen Row abspielen
      playNote(ctx, rowData[0], rowData[1], 0)   // CH1
      playNote(ctx, rowData[3], rowData[4], 1)   // CH2
      playNote(ctx, rowData[6], rowData[7], 2)   // CH3
      playNote(ctx, rowData[9], rowData[10], 3)  // CH4

      // React-State aktualisieren (UI)
      rowRef.current = row
      setCurrentRow(row)
      // Pattern-Index: 0–31 = PAT 01, 32–63 = PAT 02
      setPatternIdx(Math.floor(row / 32))
      // VU-Werte in State kopieren (Kopie nötig da Ref kein Re-Render auslöst)
      setVuLevels([...vuRef.current] as VuLevels)

      // VU-Meter abklingen lassen
      vuRef.current = vuRef.current.map(v => Math.max(0, v - 0.15)) as VuLevels

      // Nächste Row vorwärtszählen, am Ende loopen
      row = (row + 1) % SEQUENCE.length

      timeoutId = setTimeout(tick, ROW_MS)
    }

    tick()

    // Stopper-Funktion
    stopRef.current = () => {
      alive = false
      clearTimeout(timeoutId)
    }
  }, [playNote])

  // ── Audio stoppen ─────────────────────────────────────────────────────────
  const stopSequencer = useCallback(() => {
    stopRef.current()
    // AudioContext suspendieren (nicht schließen, damit er wiederverwendbar bleibt)
    audioCtxRef.current?.suspend()
    setVuLevels([0, 0, 0, 0])
  }, [])

  // ── Mount: prüfen ob anderes Audio läuft ─────────────────────────────────
  useEffect(() => {
    // Laut Spezifikation: nur starten wenn kein Video gerade spielt
    const videos = document.querySelectorAll<HTMLVideoElement>('video')
    const anyVideoPlaying = Array.from(videos).some(v => !v.paused && !v.muted)

    if (!anyVideoPlaying) {
      // Kein konkurrierendes Audio → direkt starten (wartet auf ersten Click)
      setAudioState('inactive')  // Bleibt auf inactive bis Nutzer aktiv klickt
    } else {
      setAudioState('inactive')  // Video spielt — nur UI anzeigen
    }

    // Cleanup beim Unmount
    return () => {
      stopRef.current()
      audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
  }, [])

  // ── Play/Mute-Toggle ──────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (audioState === 'playing') {
      stopSequencer()
      setAudioState('muted')
    } else {
      // AudioContext nach Suspend wieder aufwecken
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      startSequencer()
      setAudioState('playing')
    }
  }, [audioState, startSequencer, stopSequencer])

  // ── VU-Meter: Balken-Höhe berechnen ──────────────────────────────────────
  function vuBarHeight(level: number): string {
    // level 0–1 → Höhe in Prozent (min 2% für Grundbalken)
    return `${Math.max(2, Math.round(level * 100))}%`
  }

  // ── Zeilen-Darstellung: Highlighted wenn aktiv ───────────────────────────
  // 32 Zeilen werden sichtbar angezeigt; aktuelle Row bleibt mittig
  const VISIBLE_ROWS = 32
  // Startindex so wählen dass currentRow immer in der Mitte liegt
  const halfVisible  = Math.floor(VISIBLE_ROWS / 2)
  const startRow     = Math.max(0, Math.min(
    currentRow - halfVisible,
    SEQUENCE.length - VISIBLE_ROWS
  ))
  const visibleRows  = SEQUENCE.slice(startRow, startRow + VISIBLE_ROWS)

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <Panel title="AMIGA PROTRACKER // COMPOSING SEQUENCE">
      <div className="flex flex-col h-full overflow-hidden text-green-400 font-mono text-xs">

        {/* ── Kopfzeile ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-green-900 shrink-0">
          <span className="text-green-300 text-xs tracking-wide">
            PROTRACKER v2.3d MOD — NEURAL OVERDRIVE | BPM: {BPM} | SPD: {SPEED}
          </span>
          <div className="flex items-center gap-2">
            {/* Pattern-Anzeige */}
            <span className="text-green-600 text-xs">
              PAT: {String(patternIdx + 1).padStart(2, '0')}/{String(Math.ceil(SEQUENCE.length / 32)).padStart(2, '0')}
            </span>
            {/* Play/Mute-Button */}
            <button
              onClick={handlePlayToggle}
              className="border border-green-700 hover:border-green-400 px-2 py-0.5 text-xs text-green-400 hover:text-green-200 transition-colors"
            >
              {audioState === 'playing' ? '[ MUTE ]' : '[ PLAY AUDIO ]'}
            </button>
          </div>
        </div>

        {/* ── Haupt-Content: VU-Meter links | Tracker-Tabelle | Sample-Liste rechts */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── VU-Meter (links) ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-1 px-1 border-r border-green-900 shrink-0 w-8">
            {vuLevels.map((level, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                {/* Kanal-Label */}
                <span className="text-green-700" style={{ fontSize: '7px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* VU-Balken: äußerer Container ist fix, innerer Balken wächst von unten */}
                <div
                  className="w-3 bg-green-950 relative overflow-hidden"
                  style={{ height: '40px' }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-75"
                    style={{
                      height: vuBarHeight(level),
                      // Farbe: grün bei niedrig, gelbgrün bei mittel, helles Grün bei hoch
                      background: level > 0.7
                        ? '#bbf7d0'
                        : level > 0.4
                          ? '#4ade80'
                          : '#166534',
                    }}
                  />
                </div>
                {/* VU-Wert als Prozentzahl */}
                <span className="text-green-800" style={{ fontSize: '6px' }}>
                  {String(Math.round(level * 99)).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>

          {/* ── Tracker-Tabelle (Mitte) ──────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            {/* Spaltenkopf */}
            <div
              className="flex items-center border-b border-green-900 shrink-0 px-1"
              style={{ fontSize: '9px' }}
            >
              {/* Row-Nummer-Spalte */}
              <span className="text-green-700 w-6 shrink-0">ROW</span>
              {/* Vier Kanal-Spalten */}
              {['CH01', 'CH02', 'CH03', 'CH04'].map((ch, i) => (
                <span
                  key={i}
                  className="text-green-600 flex-1 text-center"
                  style={{ minWidth: 0 }}
                >
                  {ch}
                </span>
              ))}
            </div>

            {/* Rows — scrollen so dass aktuelle Row immer sichtbar ist */}
            <div className="flex-1 overflow-hidden">
              {visibleRows.map((row, idx) => {
                const absoluteRow = startRow + idx
                const isActive    = absoluteRow === currentRow
                return (
                  <div
                    key={absoluteRow}
                    className="flex items-center px-1"
                    style={{
                      fontSize: '8px',
                      // Aktive Row: grüner Hintergrund + hellere Schrift
                      background: isActive ? 'rgba(0,255,100,0.12)' : 'transparent',
                      color:      isActive ? '#86efac' : '#166534',
                      lineHeight: '1.4',
                    }}
                  >
                    {/* Row-Nummer (hex, 2-stellig) */}
                    <span className="w-6 shrink-0 text-green-700">
                      {absoluteRow.toString(16).toUpperCase().padStart(2, '0')}
                    </span>
                    {/* Vier Kanäle */}
                    {[
                      [row[0], row[1], row[2]],
                      [row[3], row[4], row[5]],
                      [row[6], row[7], row[8]],
                      [row[9], row[10], row[11]],
                    ].map((ch, ci) => (
                      <span
                        key={ci}
                        className="flex-1 text-center"
                        style={{
                          minWidth: 0,
                          // Aktiver Kanal mit Ton: etwas heller
                          color: isActive && ch[0] !== '---'
                            ? '#a7f3d0'
                            : isActive
                              ? '#4ade80'
                              : ch[0] !== '---'
                                ? '#15803d'
                                : '#052e16',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {/* Note */}
                        <span>{ch[0]}</span>
                        {' '}
                        {/* Instrument (hex) */}
                        <span style={{ color: isActive && ch[1] !== '--' ? '#fcd34d' : undefined }}>
                          {ch[1]}
                        </span>
                        {' '}
                        {/* Effekt */}
                        <span style={{ color: isActive && ch[2] !== '000' ? '#93c5fd' : undefined }}>
                          {ch[2]}
                        </span>
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Sample-Liste (rechts) ────────────────────────────────────── */}
          <div
            className="border-l border-green-900 shrink-0 flex flex-col overflow-hidden"
            style={{ width: '120px' }}
          >
            {/* Kopf */}
            <div
              className="border-b border-green-900 px-1 py-0.5 text-green-600"
              style={{ fontSize: '8px' }}
            >
              SAMPLES (1–{INSTRUMENT_NAMES.length})
            </div>
            {/* Instrument-Liste */}
            <div className="flex-1 overflow-hidden">
              {INSTRUMENT_NAMES.map((name, i) => {
                // Instrument-Nummer in Hex (01–0A)
                const hexNum = (i + 1).toString(16).toUpperCase().padStart(2, '0')
                return (
                  <div
                    key={i}
                    className="px-1 flex items-center gap-1"
                    style={{
                      fontSize: '7px',
                      lineHeight: '1.6',
                      color: '#166534',
                    }}
                  >
                    <span className="text-green-700 shrink-0">{hexNum}</span>
                    <span className="truncate">{name}</span>
                  </div>
                )
              })}
            </div>

            {/* Status-Anzeige unten in der Sample-Liste */}
            <div
              className="border-t border-green-900 px-1 py-1 flex flex-col gap-0.5"
              style={{ fontSize: '7px' }}
            >
              <div className="flex justify-between text-green-700">
                <span>STATUS</span>
                <span className={audioState === 'playing' ? 'text-green-400 animate-pulse' : 'text-green-900'}>
                  {audioState === 'playing' ? 'PLAY' : 'STOP'}
                </span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>ROW</span>
                <span className="text-green-500">
                  {currentRow.toString().padStart(2, '0')}/{SEQUENCE.length - 1}
                </span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>LOOP</span>
                <span className="text-green-600">ON</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fußzeile ────────────────────────────────────────────────────── */}
        <div
          className="border-t border-green-900 px-2 py-0.5 shrink-0 flex items-center justify-between text-green-700"
          style={{ fontSize: '8px' }}
        >
          <span>♦ NEURAL OVERDRIVE v1.0 ♦ C-MINOR PROGRESSION ♦ 4CH</span>
          <span>
            {/* Blinkende Aktivitäts-Anzeige nur wenn Audio läuft */}
            {audioState === 'playing' && (
              <span className="text-green-500 animate-pulse">▶ PLAYING</span>
            )}
            {audioState !== 'playing' && (
              <span className="text-green-900">■ STOPPED</span>
            )}
          </span>
        </div>
      </div>
    </Panel>
  )
}
