import { useEffect, useRef, useState } from 'react';
import Panel from '../ui/Panel';
import { ModPlayer } from '../utils/modplayer/player';
import { Mod, Note } from '../utils/modplayer/mod';

// ─── Musik-Tracks ─────────────────────────────────────────────────────────────
interface Track {
  id: string;
  name: string;
  url: string;
  composer: string;
  arranger: string;
  year: string;
}

const TRACKS: Track[] = [
  { id: '58072', name: 'Speedball 2', url: '/audio/track_58072.mod.bin?v=1.0.3', composer: 'Simon Rogers', arranger: 'Richard Joseph', year: '1990' },
  { id: '142827', name: 'Stardust Memories', url: '/audio/track_142827.mod.bin?v=1.0.3', composer: 'Volker Tripp (Jester)', arranger: 'Volker Tripp (Jester)', year: '1992' },
  { id: '87180', name: 'Bootup', url: '/audio/track_87180.mod.bin?v=1.0.3', composer: 'Barry Leitch', arranger: 'Barry Leitch', year: '1991' }
];

// Amiga-Frequenz-Perioden und Notennamen-Mapping
const PERIODS = [
  // Oktave 1
  856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
  // Oktave 2
  428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
  // Oktave 3
  214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113,
  // Oktave 4
  107, 101,  95,  90,  85,  80,  75,  71,  67,  63,  60,  56
];

const NOTE_NAMES = [
  "C-1", "C#1", "D-1", "D#1", "E-1", "F-1", "F#1", "G-1", "G#1", "A-1", "A#1", "B-1",
  "C-2", "C#2", "D-2", "D#2", "E-2", "F-2", "F#2", "G-2", "G#2", "A-2", "A#2", "B-2",
  "C-3", "C#3", "D-3", "D#3", "E-3", "F-3", "F#3", "G-3", "G#3", "A-3", "A#3", "B-3",
  "C-4", "C#4", "D-4", "D#4", "E-4", "F-4", "F#4", "G-4", "G#4", "A-4", "A#4", "B-4"
];

function getNoteName(period: number): string {
  if (period <= 0) return "---";
  let bestIdx = -1;
  let bestDiff = 999999;
  for (let i = 0; i < PERIODS.length; i++) {
    const diff = Math.abs(PERIODS[i] - period);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  if (bestIdx !== -1 && bestDiff < 30) {
    return NOTE_NAMES[bestIdx];
  }
  return "---";
}

function formatInstrument(note: Note): string {
  if (note.instrument === 0) return "--";
  return note.instrument.toString(16).toUpperCase().padStart(2, '0');
}

function formatEffect(note: Note): string {
  if (note.rawEffect === 0) return "000";
  return note.rawEffect.toString(16).toUpperCase().padStart(3, '0');
}

type VuLevels = [number, number, number, number];

export default function AmiModPanel() {
  const [trackIdx, setTrackIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mod, setMod] = useState<Mod | null>(null);

  // Sequencer-Status
  const [currentRow, setCurrentRow] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [vuLevels, setVuLevels] = useState<VuLevels>([0, 0, 0, 0]);

  // ModPlayer einmalig für die Lebensdauer der Komponente erzeugen
  const [player] = useState(() => new ModPlayer());
  const playerRef = useRef<ModPlayer>(player);
  const shouldAutoPlayRef = useRef(false);

  // ModPlayer beim Unmount entladen
  useEffect(() => {
    return () => {
      player.unload();
      (window as any).fraktallab_mod_playing = false;
    };
  }, [player]);

  // ── Track laden und initialisieren ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    setCurrentRow(0);
    setCurrentPosition(0);
    setVuLevels([0, 0, 0, 0]);

    player.load(TRACKS[trackIdx].url, '/audio/mod-player-worklet.js').then(() => {
      if (!active) {
        return;
      }
      setLoading(false);
      setMod(player.mod);

      if (shouldAutoPlayRef.current) {
        player.play();
        setPlaying(true);
        (window as any).fraktallab_mod_playing = true;
        shouldAutoPlayRef.current = false;
      }

      // Subscriptions
      player.watchRows((pos, row) => {
        if (active) {
          setCurrentPosition(pos);
          setCurrentRow(row);
        }
      });

      player.watchNotes((noteData) => {
        if (active) {
          const ch = noteData.channel - 1;
          if (ch >= 0 && ch < 4) {
            setVuLevels(prev => {
              const next = [...prev] as VuLevels;
              next[ch] = Math.max(next[ch], noteData.volume / 64);
              return next;
            });
          }
        }
      });

      player.watchStop(() => {
        if (active) {
          setPlaying(false);
          (window as any).fraktallab_mod_playing = false;
        }
      });
    }).catch((err) => {
      console.error("Error loading mod file:", err);
      if (active) {
        setLoading(false);
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      active = false;
      player.stop();
    };
  }, [trackIdx, player]);

  // VU-Meter abklingen lassen
  useEffect(() => {
    let rAFId: number;
    const decay = () => {
      setVuLevels(prev => {
        const next = prev.map(v => Math.max(0, v - 0.08)) as VuLevels;
        if (next.every((v, i) => v === prev[i])) return prev;
        return next;
      });
      rAFId = requestAnimationFrame(decay);
    };
    rAFId = requestAnimationFrame(decay);
    return () => cancelAnimationFrame(rAFId);
  }, []);

  // Play/Stop toggle
  const handlePlayToggle = () => {
    const player = playerRef.current;
    if (!player || loading) return;

    if (playing) {
      player.stop();
      setPlaying(false);
      (window as any).fraktallab_mod_playing = false;
    } else {
      player.play();
      setPlaying(true);
      (window as any).fraktallab_mod_playing = true;
    }
  };

  // VU-Meter Balken-Höhe
  function vuBarHeight(level: number): string {
    return `${Math.max(2, Math.round(level * 100))}%`;
  }

  // ── Tracker Tabelle berechnen ──────────────────────────────────────────────
  const patternIdxInTable = mod && currentPosition < mod.patternTable.length 
    ? mod.patternTable[currentPosition] 
    : 0;
  const pattern = mod && patternIdxInTable < mod.patterns.length 
    ? mod.patterns[patternIdxInTable] 
    : null;

  const VISIBLE_ROWS = 32;
  const halfVisible = Math.floor(VISIBLE_ROWS / 2);
  const startRow = Math.max(0, Math.min(
    currentRow - halfVisible,
    64 - VISIBLE_ROWS
  ));
  
  const visibleRows = pattern ? pattern.rows.slice(startRow, startRow + VISIBLE_ROWS) : [];

  // Instrumentenliste
  const instrumentsToDisplay = mod 
    ? mod.instruments.slice(1).map((inst, idx) => {
        const num = (idx + 1).toString(16).toUpperCase().padStart(2, '0');
        const name = inst ? inst.name : "";
        return { num, name };
      })
    : [];

  return (
    <Panel title="AMIGA WORKBENCH // MOD PLAYER">
      <div className="flex flex-col h-full overflow-hidden bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] font-mono text-xs select-none p-0.5">

        {/* ─── Amiga-Style Window Title Bar ────────────────────────────── */}
        <div className="bg-[#0055aa] text-white flex items-center justify-between px-2 py-0.5 border-b border-[#404040] shrink-0 font-bold text-[10px]">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3 bg-[#c0c0c0] border border-b-[#404040] border-r-[#404040] border-t-white border-l-white cursor-pointer active:border-t-black active:border-l-black flex items-center justify-center text-[7px] text-black select-none">
              ✕
            </div>
            <span>ProTracker v2.3d // Workbench 3.0</span>
          </div>
          <div className="text-white truncate max-w-[200px] font-bold text-[10px]">
            {mod?.name ? mod.name.trim() : 'UNTITLED'}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3.5 h-3 bg-[#c0c0c0] border border-b-[#404040] border-r-[#404040] border-t-white border-l-white flex items-center justify-center text-[6px] text-black font-bold select-none">
              ▲
            </div>
            <div className="w-3.5 h-3 bg-[#c0c0c0] border border-b-[#404040] border-r-[#404040] border-t-white border-l-white flex items-center justify-center text-[6px] text-black font-bold select-none">
              ▼
            </div>
          </div>
        </div>

        {/* ─── Controls Bar ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1 bg-[#c0c0c0] border-b border-[#808080] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-neutral-800 text-[10px] font-bold">SONG:</span>
            <select
              value={trackIdx}
              onChange={(e) => {
                // Audio-Context im User-Gesture-Callstack vorab aufwecken/erstellen
                player.resumeContext();
                setTrackIdx(Number(e.target.value));
                shouldAutoPlayRef.current = true;
              }}
              disabled={loading}
              className="bg-white border-2 border-t-neutral-600 border-l-neutral-600 border-b-white border-r-white text-black text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {TRACKS.map((t, idx) => (
                <option key={t.id} value={idx}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {mod && (
              <span className="text-neutral-800 text-[10px] font-bold">
                POS: {String(currentPosition + 1).padStart(2, '0')}/{String(mod.length).padStart(2, '0')}
              </span>
            )}
            <button
              onClick={handlePlayToggle}
              disabled={loading}
              className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 active:border-t-neutral-700 active:border-l-neutral-700 active:border-b-white active:border-r-white px-2 py-0.5 text-[10px] font-bold text-black transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'LOADING...' : playing ? 'STOP' : 'PLAY AUDIO'}
            </button>
          </div>
        </div>

        {/* ─── Haupt-Content ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0 bg-[#808080] p-1 gap-1">

          {/* ── VU-Meter (links) ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-2 px-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 shrink-0 w-9 py-1 rounded-sm">
            {vuLevels.map((level, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-neutral-700 font-bold text-[8px]">
                  CH{i + 1}
                </span>
                <div
                  className="w-4 bg-black border border-neutral-600 relative overflow-hidden"
                  style={{ height: '38px' }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-all duration-75"
                    style={{
                      height: vuBarHeight(level),
                      background: 'linear-gradient(to top, #00aa00 0%, #00ff00 65%, #ffff00 65%, #ffaa00 85%, #ff0000 85%, #ff3333 100%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Tracker-Tabelle (Mitte) ──────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#000022] border-2 border-t-neutral-700 border-l-neutral-700 border-b-white border-r-white">
            {/* Spaltenkopf */}
            <div
              className="flex items-center bg-[#0033aa] text-white border-b border-black shrink-0 px-1 py-0.5 font-bold"
              style={{ fontSize: '11px' }}
            >
              <span className="text-neutral-300 w-9 shrink-0">ROW</span>
              {['CH1', 'CH2', 'CH3', 'CH4'].map((ch, i) => (
                <span
                  key={i}
                  className="text-white flex-1 text-center"
                  style={{ minWidth: 0 }}
                >
                  {ch}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="h-full flex items-center justify-center text-[#00ccff] animate-pulse text-xs">
                  LOADING RETRO TRACKER MODULE...
                </div>
              ) : visibleRows.length > 0 ? (
                visibleRows.map((row, idx) => {
                  const absoluteRow = startRow + idx;
                  const isActive = absoluteRow === currentRow;
                  return (
                    <div
                      key={absoluteRow}
                      className="flex items-center px-1"
                      style={{
                        fontSize: '11px',
                        background: isActive ? '#0044bb' : 'transparent',
                        color: isActive ? '#ffffff' : '#00aa00',
                        lineHeight: '1.3',
                      }}
                    >
                      <span className={`w-9 shrink-0 font-bold ${isActive ? 'text-white' : 'text-neutral-500'}`}>
                        {absoluteRow.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                      {row.notes.map((note, ci) => {
                        const noteName = getNoteName(note.period);
                        const inst = formatInstrument(note);
                        const fx = formatEffect(note);
                        const hasNote = noteName !== '---';
                        return (
                          <span
                            key={ci}
                            className="flex-1 text-center"
                            style={{
                              minWidth: 0,
                              color: isActive
                                ? '#ffffff'
                                : hasNote
                                  ? '#ffffff'
                                  : '#005500',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ color: isActive ? '#ffffff' : hasNote ? '#aaeebb' : undefined }}>
                              {noteName}
                            </span>
                            {' '}
                            <span style={{ color: isActive ? '#ffff55' : inst !== '--' ? '#ffcc00' : undefined }}>
                              {inst}
                            </span>
                            {' '}
                            <span style={{ color: isActive ? '#55ffff' : fx !== '000' ? '#00ccff' : undefined }}>
                              {fx}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })
              ) : loadError ? (
                <div className="h-full flex items-center justify-center text-red-500 text-xs p-2 text-center">
                  LOAD ERROR: {loadError}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-xs">
                  NO SEQUENCE DATA AVAILABLE
                </div>
              )}
            </div>
          </div>

          {/* ── Sample-Liste (rechts) ────────────────────────────────────── */}
          <div
            className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 shrink-0 flex flex-col overflow-hidden"
            style={{ width: '185px' }}
          >
            <div
              className="border-b border-[#808080] px-1 py-0.5 text-neutral-800 font-bold text-[10px] text-center"
            >
              INSTRUMENTS
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin p-1 bg-white border-b border-[#808080]">
              {instrumentsToDisplay.length > 0 ? (
                instrumentsToDisplay.map((inst, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1"
                    style={{
                      fontSize: '9px',
                      lineHeight: '1.3',
                      color: inst.name ? '#000000' : '#888888',
                    }}
                  >
                    <span className="text-[#0055aa] font-bold shrink-0">{inst.num}</span>
                    <span className="truncate" title={inst.name}>{inst.name || "---"}</span>
                  </div>
                ))
              ) : (
                <div className="p-1 text-neutral-400 text-[9px] text-center">NO INST LOADED</div>
              )}
            </div>

            {/* Status-Anzeige unten */}
            <div
              className="px-1 py-1 flex flex-col gap-0.5 bg-[#c0c0c0]"
              style={{ fontSize: '9px' }}
            >
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>STATUS:</span>
                <span className={playing ? 'text-[#008800] font-bold animate-pulse' : 'text-neutral-500'}>
                  {playing ? 'PLAYING' : 'STOPPED'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>ROW:</span>
                <span className="text-black">
                  {currentRow.toString().padStart(2, '0')}/63
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>NAME:</span>
                <span className="text-black truncate max-w-[100px]" title={mod?.name}>
                  {mod?.name || '---'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>COMPOSER:</span>
                <span className="text-black truncate max-w-[100px]" title={TRACKS[trackIdx].composer}>
                  {TRACKS[trackIdx].composer}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>ARRANGER:</span>
                <span className="text-black truncate max-w-[100px]" title={TRACKS[trackIdx].arranger}>
                  {TRACKS[trackIdx].arranger}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>YEAR:</span>
                <span className="text-black">
                  {TRACKS[trackIdx].year}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fußzeile ────────────────────────────────────────────────────── */}
        <div
          className="bg-[#c0c0c0] border-t border-neutral-500 px-2 py-0.5 shrink-0 flex items-center justify-between text-neutral-700 font-bold"
          style={{ fontSize: '8px' }}
        >
          <span>♦ AMIGA PROTRACKER RENDERER ♦ NON-COMMERCIAL FAN-ARRANGEMENTS FROM MODARCHIVE</span>
          <span>
            {playing && (
              <span className="text-[#008800] animate-pulse">▶ ACTIVE</span>
            )}
            {!playing && (
              <span className="text-neutral-500">■ IDLE</span>
            )}
          </span>
        </div>
      </div>
    </Panel>
  );
}
