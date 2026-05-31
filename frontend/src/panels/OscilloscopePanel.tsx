import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'
import { registerAudioFocusListener, requestAudioFocus, releaseAudioFocus } from '../utils/audio-focus'
import { SidPlayer, type SidMetadata, type SidVisuals } from '../utils/sidplayer'

const AUDIO_ID = 'sid-player'
const BASE = import.meta.env.BASE_URL

// Scrubber range in seconds. SID files carry no length, so we use a fixed window
// (6 min covers almost every tune before it loops). Position past this is clamped.
const SCRUB_MAX = 360

// Format seconds as "M:SS" for the time display.
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// SID waveform-select bitmasks (upper nibble of the control register).
const WF_TRI = 0x10
const WF_SAW = 0x20
const WF_PULSE = 0x40
const WF_NOISE = 0x80

// One sample (-1..1) of the SID waveform `wf` at phase `frac` (0..1). Renders the
// real shape on the scope instead of a generic sine: triangle, sawtooth, pulse
// (with its duty cycle) and noise. Combined waveforms fall back to the strongest
// bit (noise > pulse > saw > tri); a voice with no waveform draws a flat line.
function sidWaveSample(frac: number, wf: number, duty: number): number {
  if (wf & WF_NOISE) return Math.random() * 2 - 1                 // noise: random
  if (wf & WF_PULSE) return frac < duty ? 1 : -1                  // pulse / square
  if (wf & WF_SAW) return 2 * frac - 1                            // rising sawtooth
  if (wf & WF_TRI) return frac < 0.5 ? 4 * frac - 1 : 3 - 4 * frac // triangle
  return 0                                                        // no waveform → flat
}

// Short label for the active waveform of a voice.
function wfName(wf: number): string {
  if (wf & WF_NOISE) return 'NOI'
  if (wf & WF_PULSE) return 'PUL'
  if (wf & WF_SAW) return 'SAW'
  if (wf & WF_TRI) return 'TRI'
  return '---'
}

interface Track {
  id: string
  name: string
  url: string
  composer: string
  year: string
  isUser?: boolean
  buffer?: Uint8Array
}

const DEFAULT_TRACKS: Track[] = [
  { id: 'cyber', name: 'Cybernoid', url: `${BASE}audio/Cybernoid.sid`, composer: 'Jeroen Tel', year: '1988' },
  { id: 'cyber2', name: 'Cybernoid II', url: `${BASE}audio/Cybernoid_II.sid`, composer: 'Jeroen Tel', year: '1988' },
  { id: 'turrican', name: 'Turrican', url: `${BASE}audio/Turrican.sid`, composer: 'Ramiro Vaca', year: '1990' },
]

function isSidName(name: string): boolean {
  return name.toLowerCase().endsWith('.sid')
}

// Read a File into a Uint8Array (Promise wrapper around FileReader).
function readFileAsUint8(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// Recursively walk dropped DataTransfer entries (files + folders) and collect
// every .sid file. Folder drag&drop exposes a directory tree through the
// non-standard webkitGetAsEntry() / FileSystemEntry API; readEntries() returns
// a directory in batches, so we loop until it yields nothing more.
async function collectSidFilesFromEntries(entries: any[]): Promise<File[]> {
  const out: File[] = []
  const walk = async (entry: any): Promise<void> => {
    if (!entry) return
    if (entry.isFile) {
      const file: File = await new Promise((res, rej) => entry.file(res, rej))
      if (isSidName(file.name)) out.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readBatch = (): Promise<any[]> =>
        new Promise((res, rej) => reader.readEntries(res, rej))
      let batch: any[]
      do {
        batch = await readBatch()
        for (const e of batch) await walk(e)
      } while (batch.length > 0)
    }
  }
  for (const e of entries) await walk(e)
  out.sort((a, b) => a.name.localeCompare(b.name)) // stable, alphabetical order
  return out
}

function OscilloscopePanel() {
  const [trackIdx, setTrackIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  // Metadata state from player
  const [metadata, setMetadata] = useState<SidMetadata | null>(null)
  const [currentSubtune, setCurrentSubtune] = useState(0)
  
  // User uploads list
  const [userTracks, setUserTracks] = useState<Track[]>([])
  const [dragOver, setDragOver] = useState(false)
  const dragDepthRef = useRef(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scrubber: uncontrolled <input range> updated from the RAF loop via refs to
  // avoid a React re-render ~43x/sec. seekingRef suppresses RAF updates while
  // the user is dragging the slider.
  const scrubberRef = useRef<HTMLInputElement>(null)
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const seekingRef = useRef(false)
  const seekTimerRef = useRef<number | null>(null)
  
  // Singleton SidPlayer instance
  const [player] = useState(() => new SidPlayer())
  const playerRef = useRef<SidPlayer>(player)
  const shouldAutoPlayRef = useRef(false)
  
  // Combine default and user uploaded tracks
  const allTracks = useMemo<Track[]>(
    () => [...DEFAULT_TRACKS, ...userTracks],
    [userTracks]
  )
  
  // Visualizer data ref updated ~43 times/sec from AudioWorklet
  const lastVisuals = useRef<SidVisuals>({
    envelopes: [0, 0, 0],
    frequencies: [0, 0, 0],
    gates: [0, 0, 0],
    waveforms: [0, 0, 0],
    pulsewidths: [0.5, 0.5, 0.5],
    playtime: 0
  })
  
  // Animation phases for wave trace
  const phases = useRef<[number, number, number]>([0, 0, 0])

  // Mirror of `playing` readable inside the RAF loop (whose closure captures
  // stale state). When false the oscilloscope draws a flat null-line.
  const playingRef = useRef(false)

  // Add a batch of files (drag&drop, file picker or folder) to the user track
  // list, and optionally start playing the first SID of the batch. Reads all
  // files, deduplicates by id, appends them, then auto-plays the first one.
  const addUserFiles = async (files: File[], playFirst: boolean) => {
    const sids = files.filter(f => isSidName(f.name))
    if (sids.length === 0) return

    const newTracks: Track[] = []
    for (const f of sids) {
      try {
        const buffer = await readFileAsUint8(f)
        newTracks.push({
          id: `user:${f.name}:${f.size}`,
          name: f.name.replace(/\.sid$/i, ''),
          url: '',
          composer: 'Unknown Composer',
          year: 'N/A',
          isUser: true,
          buffer,
        })
      } catch { /* skip unreadable file */ }
    }
    if (newTracks.length === 0) return

    const playId = newTracks[0].id // first dropped SID — the one we auto-play

    setUserTracks(prev => {
      const ids = new Set(prev.map(t => t.id))
      const merged = [...prev]
      for (const t of newTracks) {
        if (ids.has(t.id)) continue // dedupe against existing list
        ids.add(t.id)
        merged.push(t)
      }
      if (playFirst) {
        // Works for both freshly added and already-present (re-dropped) tunes.
        const userIdx = merged.findIndex(t => t.id === playId)
        if (userIdx >= 0) {
          const targetIdx = DEFAULT_TRACKS.length + userIdx
          queueMicrotask(() => {
            shouldAutoPlayRef.current = true
            setTrackIdx(targetIdx)
          })
        }
      }
      return merged
    })
  }

  const onDragEnter: React.DragEventHandler = (e) => {
    e.preventDefault()
    dragDepthRef.current++
    if (!dragOver) setDragOver(true)
  }

  const onDragOver: React.DragEventHandler = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave: React.DragEventHandler = (e) => {
    e.preventDefault()
    dragDepthRef.current--
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setDragOver(false)
    }
  }

  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault()
    dragDepthRef.current = 0
    setDragOver(false)

    const dt = e.dataTransfer
    const items = dt.items
    // Folder drop: capture the FileSystemEntry objects synchronously (they are
    // only valid during the event), then walk them for .sid files. Falls back to
    // the plain file list when the entry API isn't available.
    if (items && items.length && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      const entries: any[] = []
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry?.()
        if (entry) entries.push(entry)
      }
      collectSidFilesFromEntries(entries).then(files => addUserFiles(files, true))
      return
    }
    addUserFiles(Array.from(dt.files || []), true)
  }

  const onFilePickerChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    addUserFiles(files, true)
    e.target.value = ''
  }

  // Folder picker (button) — input has webkitdirectory set, so files contains
  // every file in the chosen folder tree; we keep the .sid ones.
  const onFolderPickerChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    addUserFiles(files, true)
    e.target.value = ''
  }

  // Bind audio focus listener and setup callbacks
  useEffect(() => {
    const p = playerRef.current
    
    p.watchVisuals((visuals) => {
      lastVisuals.current = visuals
    })
    
    p.watchLoaded((meta) => {
      setMetadata(meta)
      setCurrentSubtune(0)
      setLoading(false)
      if (shouldAutoPlayRef.current) {
        shouldAutoPlayRef.current = false
        requestAudioFocus(AUDIO_ID)
        p.play().then(() => setPlaying(true)).catch(console.error)
      }
    })
    
    const unsubscribe = registerAudioFocusListener((focusedId) => {
      if (focusedId !== null && focusedId !== AUDIO_ID) {
        p.stop()
        setPlaying(false)
      }
    })

    return () => {
      unsubscribe()
      p.unload()
      releaseAudioFocus(AUDIO_ID)
    }
  }, [player])

  // Keep playingRef readable by the RAF loop (which captures stale state).
  useEffect(() => { playingRef.current = playing }, [playing])

  // The folder picker needs the non-standard `webkitdirectory` attribute, which
  // JSX/TS won't accept directly — set it on the DOM node after mount.
  useEffect(() => {
    const el = folderInputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [])

  // Load track data when index changes (NO AudioContext needed)
  useEffect(() => {
    const p = playerRef.current
    setLoading(true)
    setLoadError(null)
    setPlaying(false)
    p.stop()

    // Reset the scrubber/time display for the new track.
    lastVisuals.current.playtime = 0
    if (scrubberRef.current) scrubberRef.current.value = '0'
    if (timeLabelRef.current) timeLabelRef.current.textContent = '0:00'

    const track = allTracks[trackIdx]
    if (!track) {
      setLoading(false)
      return
    }

    if (track.isUser && track.buffer) {
      p.loadBuffer(track.buffer, 0).catch(err => {
        setLoading(false)
        setLoadError(err.message || String(err))
      })
    } else {
      p.load(track.url, 0).catch(err => {
        setLoading(false)
        setLoadError(err.message || String(err))
      })
    }
  }, [trackIdx, allTracks])

  // Play/Stop toggle — play() is async and sets up AudioContext on first call
  const handlePlayToggle = async () => {
    const p = playerRef.current
    if (loading || !p.loaded) return

    if (playing) {
      p.stop()
      setPlaying(false)
      releaseAudioFocus(AUDIO_ID)
    } else {
      try {
        p.resumeContext()
        requestAudioFocus(AUDIO_ID)
        await p.play()
        setPlaying(true)
      } catch (err) {
        console.error('SID play failed:', err)
        setLoadError(String(err))
      }
    }
  }

  // Scrubber. React fires onChange continuously while a range slider is dragged,
  // so we update the time label live but DEBOUNCE the actual seek: it only runs
  // ~160ms after the user stops moving. That avoids firing a (costly) seek on
  // every pixel and reliably re-enables RAF updates afterwards — no dependence on
  // which "release" event the browser sends. seekingRef pauses the RAF loop so it
  // doesn't fight the slider while the user is scrubbing.
  const onScrub: React.FormEventHandler<HTMLInputElement> = (e) => {
    seekingRef.current = true
    const v = Number((e.target as HTMLInputElement).value)
    if (timeLabelRef.current) timeLabelRef.current.textContent = fmtTime(v)
    if (seekTimerRef.current != null) clearTimeout(seekTimerRef.current)
    seekTimerRef.current = window.setTimeout(() => {
      playerRef.current.seek(v)
      lastVisuals.current.playtime = v // keep display steady until the next frame
      seekingRef.current = false
      seekTimerRef.current = null
    }, 120)
  }

  // Change Subtune
  const handleSubtuneChange = (delta: number) => {
    if (!metadata) return
    const count = metadata.subtunesCount || 1
    const next = (currentSubtune + delta + count) % count
    setCurrentSubtune(next)
    playerRef.current.setSubtune(next)
  }

  // Canvas visualizer loop using global raf-coordinator
  useEffect(() => {
    const _canvas = canvasRef.current
    const _container = containerRef.current
    if (!_canvas || !_container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    const canvas: HTMLCanvasElement = _canvas
    const ctx: CanvasRenderingContext2D = _ctx
    const container: HTMLDivElement = _container

    let alive = true
    let unsubscribe: (() => void) | null = null

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // IntersectionObserver to pause loop when scrolled out of view
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!unsubscribe && alive) unsubscribe = subscribe(loop)
      } else {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
      }
    })
    io.observe(canvas)

    // Trace colors for the 3 SID voices
    const traceColors = [
      '#00f0ff', // Voice 1: Cyan
      '#a3e635', // Voice 2: Lime
      '#ec4899', // Voice 3: Magenta
    ]

    function loop() {
      if (!alive) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Draw dark radar/oscilloscope background
      ctx.fillStyle = '#060814'
      ctx.fillRect(0, 0, W, H)

      // Draw oscilloscope grid lines
      ctx.strokeStyle = 'rgba(74, 85, 104, 0.15)'
      ctx.lineWidth = 1

      // Vertical grids
      const gridSpacingX = W / 10
      for (let x = 0; x < W; x += gridSpacingX) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      // Horizontal grids
      const gridSpacingY = H / 8
      for (let y = 0; y < H; y += gridSpacingY) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // Load real-time visuals
      const visuals = lastVisuals.current
      const envelopes = visuals.envelopes
      const frequencies = visuals.frequencies
      const gates = visuals.gates
      const waveforms = visuals.waveforms
      const pulsewidths = visuals.pulsewidths

      // Drive the scrubber + time display from live playtime (unless dragging).
      if (!seekingRef.current && scrubberRef.current) {
        const pt = visuals.playtime || 0
        scrubberRef.current.value = String(Math.min(pt, SCRUB_MAX))
        if (timeLabelRef.current) timeLabelRef.current.textContent = fmtTime(pt)
      }

      // Calculate baselines for 3 split channel views
      const channelH = H / 3

      // When paused, every voice collapses to a flat null-line: no signal, no
      // motion, labels zeroed — instead of freezing on the last drawn waveform.
      const live = playingRef.current

      for (let c = 0; c < 3; c++) {
        const baselineY = channelH * c + channelH / 2
        const rawFreq = live ? frequencies[c] : 0
        const env = live ? envelopes[c] : 0
        const gate = live ? gates[c] : 0
        const wf = live ? waveforms[c] : 0      // active waveform (0 = flat/paused)
        const duty = pulsewidths[c] || 0.5      // pulse duty cycle 0..1

        // Map SID pitch register value to approximate Hz (PAL frequency formula)
        const freqHz = rawFreq * 0.0587

        // Update animated trace phase based on frequency (higher freq moves
        // faster). Frozen while paused so the null-line stays perfectly still.
        if (live) {
          phases.current[c] += (freqHz * 0.005) + 0.02
          if (phases.current[c] > Math.PI * 2) {
            phases.current[c] -= Math.PI * 2
          }
        }

        // Draw horizontal baseline trace for the channel
        ctx.strokeStyle = 'rgba(74, 85, 104, 0.25)'
        ctx.beginPath()
        ctx.moveTo(0, baselineY)
        ctx.lineTo(W, baselineY)
        ctx.stroke()

        // Draw active oscillating trace
        ctx.beginPath()
        ctx.lineWidth = gate ? 2.0 : 1.0
        
        // Setup neon glow
        ctx.strokeStyle = traceColors[c]
        ctx.shadowColor = traceColors[c]
        ctx.shadowBlur = gate ? Math.max(3, env * 10) : 0

        // Paused → flat null-line (0). Playing → envelope-scaled amplitude, or a
        // tiny static wobble when the gate is closed but the tune is running.
        const amplitude = !live
          ? 0
          : (env > 0.01
              ? env * (channelH * 0.38)
              : (Math.random() * 1.5 - 0.75))

        const wavelength = freqHz > 10
          ? Math.max(10, Math.min(300, 3000 / freqHz))
          : 150

        // Phase offset (scrolling) expressed in wavelengths.
        const phaseShift = phases.current[c] / (Math.PI * 2)
        for (let x = 0; x < W; x += 2) {
          // Trace shape: the REAL SID waveform of this voice (tri/saw/pulse/noise),
          // scrolled by phase and scaled by the envelope amplitude.
          const ph = x / wavelength - phaseShift
          const frac = ph - Math.floor(ph) // wrap into [0,1)
          const waveVal = sidWaveSample(frac, wf, duty)
          const y = baselineY + waveVal * amplitude
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        ctx.shadowBlur = 0 // Reset glow for other operations

        // Voice label overlay
        ctx.font = '9px monospace'
        ctx.fillStyle = traceColors[c]
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        
        const gateStr = gate ? 'GATE:ON ' : 'GATE:OFF'
        const freqStr = freqHz > 20 ? `${Math.round(freqHz).toString().padStart(4, ' ')} Hz` : '0 Hz'
        const envStr = `${Math.round(env * 100).toString().padStart(3, ' ')}%`
        const wfStr = wfName(wf)

        ctx.fillText(
          `V${c + 1} | ${wfStr} | [${gateStr}] | Freq:${freqStr} | Env:${envStr}`,
          10,
          channelH * c + 10
        )
      }

      // ── Sub-HUD Status ─────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(74, 222, 128, 0.4)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(
        `CHIP MODEL: C64 ${metadata?.prefModel === 8580 ? '8580' : '6581'} // CHANNELS: 3 TRACE`,
        W - 10,
        H - 10
      )
    }

    unsubscribe = subscribe(loop)

    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
      io.disconnect()
    }
  }, [metadata])

  // Subtune slider or buttons values
  const totalSubtunes = metadata?.subtunesCount || 1
  const displayComposer = metadata?.author || allTracks[trackIdx]?.composer || 'Unknown'
  const displayTitle = metadata?.title || allTracks[trackIdx]?.name || 'Unknown'
  const displayInfo = metadata?.info || (allTracks[trackIdx]?.year ? `Hewson © ${allTracks[trackIdx].year}` : 'C64 Chiptune')

  return (
    <Panel title="C64 SID MUSIC PLAYER // DUAL-TRACE MULTI-OSCILLOSCOPE">
      <div
        className="relative flex flex-col h-full overflow-hidden bg-black text-[#4ade80] font-mono text-xs select-none p-1"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragOver && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 border-2 border-dashed border-[#4ade80] text-[#4ade80] font-bold text-sm"
          >
            DROP .SID FILE
          </div>
        )}

        {/* ─── Control Bar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 bg-[#0d0e1a] border border-[#1e293b] rounded shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 font-bold text-[10px]">TUNE:</span>
            <select
              value={trackIdx}
              onChange={(e) => {
                setTrackIdx(Number(e.target.value))
                shouldAutoPlayRef.current = playing  // auto-play if already playing
              }}
              disabled={loading}
              className="bg-black border border-[#334155] text-[#4ade80] text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <optgroup label="Built-in SID Tunes">
                {DEFAULT_TRACKS.map((t, idx) => (
                  <option key={t.id} value={idx}>{t.name}</option>
                ))}
              </optgroup>
              {userTracks.length > 0 && (
                <optgroup label="User Loaded SIDs">
                  {userTracks.map((t, i) => (
                    <option key={t.id} value={DEFAULT_TRACKS.length + i}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#0f172a] border border-[#334155] active:bg-[#1e293b] px-1.5 py-0.5 text-[10px] text-neutral-300 font-bold cursor-pointer rounded"
            >
              LOAD .SID
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sid"
              multiple
              onChange={onFilePickerChange}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              title="Load all .sid files from a folder"
              className="bg-[#0f172a] border border-[#334155] active:bg-[#1e293b] px-1.5 py-0.5 text-[10px] text-neutral-300 font-bold cursor-pointer rounded"
            >
              FOLDER
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={onFolderPickerChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="flex items-center gap-2">
            {totalSubtunes > 1 && (
              <div className="flex items-center gap-1 bg-black border border-[#1e293b] px-1 py-0.5 rounded">
                <button
                  type="button"
                  onClick={() => handleSubtuneChange(-1)}
                  className="px-1 text-[#4ade80] font-bold hover:text-white cursor-pointer"
                  title="Previous Subtune"
                >
                  ◀
                </button>
                <span className="text-[10px] px-1 text-white">
                  SUBTUNE: {currentSubtune + 1}/{totalSubtunes}
                </span>
                <button
                  type="button"
                  onClick={() => handleSubtuneChange(1)}
                  className="px-1 text-[#4ade80] font-bold hover:text-white cursor-pointer"
                  title="Next Subtune"
                >
                  ▶
                </button>
              </div>
            )}

            <button
              onClick={handlePlayToggle}
              disabled={loading}
              className={`border font-bold text-[10px] px-2 py-0.5 cursor-pointer rounded ${
                playing
                  ? 'bg-red-900/40 border-red-500/60 text-red-300 active:bg-red-800/60'
                  : 'bg-[#0f172a] border-[#334155] text-[#4ade80] active:bg-[#1e293b]'
              }`}
            >
              {loading ? '⏳ LOADING...' : playing ? '■ STOP' : '▶ PLAY'}
            </button>
          </div>
        </div>

        {/* ─── Metadata Details ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-0.5 px-2.5 py-1 bg-black/60 border-b border-[#111827] shrink-0 text-[10px]">
          <div className="flex justify-between">
            <span className="text-neutral-400">Title: <strong className="text-white">{displayTitle}</strong></span>
            <span className="text-neutral-400">Composer: <strong className="text-[#38bdf8]">{displayComposer}</strong></span>
          </div>
          <div className="text-neutral-500 italic truncate">{displayInfo}</div>
          {loadError && <div className="text-red-500 font-bold mt-0.5">ERROR: {loadError}</div>}
        </div>

        {/* ─── Scrubber / Song Position ─────────────────────────────────── */}
        <div className="flex items-center gap-2 px-2.5 py-1 shrink-0 text-[10px]">
          <span ref={timeLabelRef} className="text-[#4ade80] tabular-nums w-9 text-right">0:00</span>
          <input
            ref={scrubberRef}
            type="range"
            min={0}
            max={SCRUB_MAX}
            step={1}
            defaultValue={0}
            onChange={onScrub}
            className="flex-1 h-1 accent-[#4ade80] cursor-pointer"
            title="Seek song position"
          />
          <span className="text-neutral-500 tabular-nums w-9">{fmtTime(SCRUB_MAX)}</span>
        </div>

        {/* ─── Oscilloscope Canvas ─────────────────────────────────────── */}
        <div ref={containerRef} className="flex-1 min-h-0 relative bg-black border border-[#1e293b] rounded mt-1 overflow-hidden">
          <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
      </div>
    </Panel>
  )
}

export default memo(OscilloscopePanel)
