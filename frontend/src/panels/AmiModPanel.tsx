import { memo,  useEffect, useRef, useState } from 'react';
import Panel from '../ui/Panel';
import { ModPlayer } from '../utils/modplayer/player';
import { Mod, Note } from '../utils/modplayer/mod';
import { subscribe } from '../utils/raf-coordinator';
import { registerAudioFocusListener, requestAudioFocus, releaseAudioFocus } from '../utils/audio-focus';

const AUDIO_ID = 'ami-mod-player';


// ─── Musik-Tracks ─────────────────────────────────────────────────────────────
interface Track {
  id: string;
  name: string;
  url: string;
  composer: string;
  arranger: string;
  year: string;
}

const BASE = import.meta.env.BASE_URL;

const TRACKS: Track[] = [
  { id: '58072', name: 'Speedball 2', url: `${BASE}audio/track_58072.dat?v=1.0.3`, composer: 'Simon Rogers', arranger: 'Richard Joseph', year: '1990' },
  { id: '142827', name: 'Stardust Memories', url: `${BASE}audio/track_142827.dat?v=1.0.3`, composer: 'Volker Tripp (Jester)', arranger: 'Volker Tripp (Jester)', year: '1992' },
  { id: '87180', name: 'Bootup', url: `${BASE}audio/track_87180.dat?v=1.0.3`, composer: 'Barry Leitch', arranger: 'Barry Leitch', year: '1991' }
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

function AmiModPanel() {
  const [trackIdx, setTrackIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mod, setMod] = useState<Mod | null>(null);

  // Sequencer-Status
  // Wir verwenden hier React State nur für die aktuelle Pattern-Position (currentPosition).
  // Für die Zeile (currentRow) und die VU-Level (vuLevels) nutzen wir React-Refs.
  // Das verhindert unnötige, häufige Re-Renderings der gesamten Tracker-Zeilen (60-mal pro Sekunde).
  const currentRowRef = useRef(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const vuLevelsRef = useRef<VuLevels>([0, 0, 0, 0]);
  
  // HTML-Refs für direkten DOM-Zugriff
  const vuBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const statusRowRef = useRef<HTMLSpanElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  // Caching für Container- und Zeilenhöhe zur Vermeidung von Layout-Thrashing (Forced Reflow)
  const rowHeightRef = useRef<number>(15);
  const containerHeightRef = useRef<number>(200);

  // ModPlayer einmalig für die Lebensdauer der Komponente erzeugen
  const [player] = useState(() => new ModPlayer());
  const playerRef = useRef<ModPlayer>(player);
  const shouldAutoPlayRef = useRef(false);

  // ModPlayer beim Unmount entladen und Audio-Fokus abonnieren
  useEffect(() => {
    const unsubscribe = registerAudioFocusListener((focusedId) => {
      if (focusedId !== null && focusedId !== AUDIO_ID) {
        player.stop();
        setPlaying(false);
        (window as any).fraktallab_mod_playing = false;
      }
    });

    return () => {
      unsubscribe();
      player.unload();
      releaseAudioFocus(AUDIO_ID);
      (window as any).fraktallab_mod_playing = false;
    };
  }, [player]);

  // Caching und Autoplay-Auswahl bei Mount
  useEffect(() => {
    // Falls kein anderes Video oder Mod-Player läuft, wählen wir einen zufälligen Track aus.
    const isVidPlaying = !!document.querySelector<HTMLVideoElement>('video:not([muted])');
    const isOtherModPlaying = !!(window as any).fraktallab_mod_playing;
    
    if (!isVidPlaying && !isOtherModPlaying) {
      const randIdx = Math.floor(Math.random() * TRACKS.length);
      setTrackIdx(randIdx);
      shouldAutoPlayRef.current = false; // Keinen automatischen Start auslösen
    }
  }, []);

  // ── Track laden und initialisieren ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    currentRowRef.current = 0;
    setCurrentPosition(0);
    vuLevelsRef.current = [0, 0, 0, 0];

    player.load(TRACKS[trackIdx].url, `${BASE}audio/mod-player-worklet.js`).then(() => {
      if (!active) {
        return;
      }
      setLoading(false);
      setMod(player.mod);

      if (shouldAutoPlayRef.current) {
        requestAudioFocus(AUDIO_ID);
        player.play();
        setPlaying(true);
        (window as any).fraktallab_mod_playing = true;
        shouldAutoPlayRef.current = false;
      }

      // Subscriptions (Registrierung der Player-Ereignisse)
      let lastPos = 0;
      player.watchRows((pos, row) => {
        if (active) {
          // Erkennen, wenn der Song zum Anfang zurückspringt (Loop-Ende erreicht)
          const totalPatterns = player.mod?.length || 1;
          if (pos < lastPos || (totalPatterns === 1 && row === 0 && currentRowRef.current === 63)) {
            player.stop();
            setPlaying(false);
            (window as any).fraktallab_mod_playing = false;
            return;
          }
          lastPos = pos;
          currentRowRef.current = row;
          
          // Nur rendern, wenn sich das Pattern (die Position) wirklich ändert
          setCurrentPosition((prevPos) => {
            if (prevPos !== pos) {
              return pos;
            }
            return prevPos;
          });

          // Direkte DOM-Aktualisierung der Zeilen-Highlights
          const container = rowsContainerRef.current;
          if (container) {
            // Alte aktive Zeile zurücksetzen
            const prevActive = container.querySelector('[data-active="true"]');
            if (prevActive) {
              prevActive.setAttribute('data-active', 'false');
            }
            // Neue aktive Zeile markieren
            const nextActive = container.querySelector(`[data-row-idx="${row}"]`);
            if (nextActive) {
              nextActive.setAttribute('data-active', 'true');
              
              // In die Mitte scrollen ohne Layout-Abfrage zur Vermeidung von forced reflows
              const containerHeight = containerHeightRef.current;
              const rowHeight = rowHeightRef.current;
              const rowTop = row * rowHeight;
              container.scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
            }
          }

          // Status-Zeile unten direkt aktualisieren
          const statusRow = statusRowRef.current;
          if (statusRow) {
            statusRow.innerText = `${row.toString().padStart(2, '0')}/63`;
          }
        }
      });

      player.watchNotes((noteData) => {
        if (active) {
          const ch = noteData.channel - 1;
          if (ch >= 0 && ch < 4) {
            // Lautstärke direkt im Ref eintragen (Wert 0.0 bis 1.0)
            vuLevelsRef.current[ch] = Math.max(vuLevelsRef.current[ch], noteData.volume / 64);
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

  // VU-Meter abklingen lassen über den zentralen rAF-Koordinator
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      const levels = vuLevelsRef.current;
      for (let i = 0; i < 4; i++) {
        // VU-Wert snappier reduzieren (dynamischerer Abklingeffekt)
        levels[i] = Math.max(0, levels[i] - 0.20);
        
        // VU-Balken direkt im DOM zeichnen
        const bar = vuBarsRef.current[i];
        if (bar) {
          const pct = Math.max(2, Math.round(levels[i] * 100));
          const newHeight = `${pct}%`;
          if (bar.style.height !== newHeight) {
            bar.style.height = newHeight;
          }
        }
      }
    });
    return unsubscribe;
  }, []);

  // Scrollt die aktive Zeile in die Mitte, wenn sich das Pattern ändert,
  // und misst einmalig die Höhen, um Layout-Thrashing beim Abspielen zu vermeiden.
  useEffect(() => {
    const container = rowsContainerRef.current;
    if (!container) return;
    const activeRowEl = container.querySelector('[data-active="true"]') as HTMLElement;
    if (!activeRowEl) return;
    const containerHeight = container.clientHeight;
    const rowHeight = activeRowEl.clientHeight;
    containerHeightRef.current = containerHeight || 200;
    rowHeightRef.current = rowHeight || 15;
    const rowTop = activeRowEl.offsetTop;
    container.scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
  }, [currentPosition]);

  // Abspielen / Stoppen umschalten mit Audio-Fokus
  const handlePlayToggle = () => {
    const player = playerRef.current;
    if (!player || loading) return;

    if (playing) {
      player.stop();
      setPlaying(false);
      (window as any).fraktallab_mod_playing = false;
      releaseAudioFocus(AUDIO_ID);
    } else {
      player.resumeContext();
      requestAudioFocus(AUDIO_ID);
      player.play();
      setPlaying(true);
      (window as any).fraktallab_mod_playing = true;
    }
  };

  // ── Tracker Tabelle berechnen ──────────────────────────────────────────────
  const patternIdxInTable = mod && currentPosition < mod.patternTable.length 
    ? mod.patternTable[currentPosition] 
    : 0;
  const pattern = mod && patternIdxInTable < mod.patterns.length 
    ? mod.patterns[patternIdxInTable] 
    : null;

  const allRows = pattern ? pattern.rows : [];

  // Instrumentenliste erstellen
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

        {/* ─── Amiga-Style Fenster-Titelleiste ────────────────────────────── */}
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

        {/* ─── Steuerung (Controls Bar) ────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1 bg-[#c0c0c0] border-b border-[#808080] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-neutral-800 text-[10px] font-bold">SONG:</span>
            <select
              value={trackIdx}
              onChange={(e) => {
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

        {/* ─── Hauptbereich ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0 bg-[#808080] p-1 gap-1">

          {/* ── VU-Meter (links) ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-2 px-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 shrink-0 w-9 py-1 rounded-sm">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-neutral-700 font-bold text-[8px]">
                  CH{i + 1}
                </span>
                <div
                  className="w-4 bg-black border border-neutral-600 relative overflow-hidden"
                  style={{ height: '38px' }}
                >
                  <div
                    ref={(el) => { vuBarsRef.current[i] = el; }}
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: '2%',
                      background: 'linear-gradient(to top, #00aa00 0%, #00ff00 65%, #ffff00 65%, #ffaa00 85%, #ff0000 85%, #ff3333 100%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Tracker-Tabelle (Mitte) ──────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#000022] border-2 border-t-neutral-700 border-l-neutral-700 border-b-white border-r-white">
            {/* Spaltenköpfe */}
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

            {/* Zeilen (Rows) */}
            <div
              ref={rowsContainerRef}
              className="flex-1 overflow-y-auto no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                
                /* Optimiertes Styling für die Tracker-Zeilen */
                .mod-row {
                  font-size: 11px;
                  line-height: 1.3;
                  transition: background-color 0.05s ease;
                }
                .mod-row[data-active="true"] {
                  background-color: #0044bb !important;
                  color: #ffffff !important;
                }
                .mod-row[data-active="false"] {
                  background-color: transparent !important;
                  color: #00aa00 !important;
                }
                
                /* Zeilennummer */
                .mod-row-idx {
                  color: #737373;
                }
                .mod-row[data-active="true"] .mod-row-idx {
                  color: #ffffff !important;
                }
                
                /* Notenblock-Container */
                .mod-note-block {
                  color: #005500;
                }
                .mod-note-block.has-note {
                  color: #ffffff;
                }
                .mod-row[data-active="true"] .mod-note-block {
                  color: #ffffff !important;
                }
                
                /* Notenname */
                .mod-note-name {
                  color: inherit;
                }
                .mod-note-block.has-note .mod-note-name {
                  color: #aaeebb;
                }
                .mod-row[data-active="true"] .mod-note-name {
                  color: #ffffff !important;
                }
                
                /* Instrument */
                .mod-inst {
                  color: inherit;
                }
                .mod-inst.has-inst {
                  color: #ffcc00;
                }
                .mod-row[data-active="true"] .mod-inst {
                  color: #ffff55 !important;
                }
                
                /* Effekt */
                .mod-fx {
                  color: inherit;
                }
                .mod-fx.has-fx {
                  color: #00ccff;
                }
                .mod-row[data-active="true"] .mod-fx {
                  color: #55ffff !important;
                }
              `}</style>
              {loading ? (
                <div className="h-full flex items-center justify-center text-[#00ccff] animate-pulse text-xs">
                  LOADING RETRO TRACKER MODULE...
                </div>
              ) : allRows.length > 0 ? (
                allRows.map((row, absoluteRow) => {
                  const isActive = absoluteRow === currentRowRef.current;
                  return (
                    <div
                      key={absoluteRow}
                      data-row-idx={absoluteRow}
                      data-active={isActive ? "true" : "false"}
                      className="mod-row flex items-center px-1"
                    >
                      <span className="mod-row-idx w-9 shrink-0 font-bold">
                        {absoluteRow.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                      {row.notes.map((note, ci) => {
                        const noteName = getNoteName(note.period);
                        const inst = formatInstrument(note);
                        const fx = formatEffect(note);
                        const hasNote = noteName !== '---';
                        const hasInst = inst !== '--';
                        const hasFx = fx !== '000';
                        return (
                          <span
                            key={ci}
                            className={`mod-note-block flex-1 text-center font-bold ${hasNote ? 'has-note' : ''}`}
                            style={{
                              minWidth: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span className="mod-note-name">
                              {noteName}
                            </span>
                            {' '}
                            <span className={`mod-inst ${hasInst ? 'has-inst' : ''}`}>
                              {inst}
                            </span>
                            {' '}
                            <span className={`mod-fx ${hasFx ? 'has-fx' : ''}`}>
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
                <span ref={statusRowRef} className="text-black">
                  {currentRowRef.current.toString().padStart(2, '0')}/63
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

export default memo(AmiModPanel);
