import { memo,  useEffect, useMemo, useRef, useState } from 'react';
import Panel from '../ui/Panel';
import { ModPlayer } from '../utils/modplayer/player';
import { Mod, Note } from '../utils/modplayer/mod';
import { subscribe } from '../utils/raf-coordinator';
import { registerAudioFocusListener, requestAudioFocus, releaseAudioFocus } from '../utils/audio-focus';

const AUDIO_ID = 'ami-mod-player';


// ─── Musik-Tracks ─────────────────────────────────────────────────────────────
//
// Es gibt zwei Quellen fuer MODs:
//   1. DEFAULT_TRACKS — mitgelieferte MODs aus frontend/public/audio/.
//   2. User-Uploads zur Laufzeit — per Drag&Drop, File-Picker oder
//      Folder-Picker. Diese landen in einer separaten Liste im
//      Component-State und werden ueber blob:-URLs geladen, sodass der
//      bestehende fetch-basierte player.load()-Pfad weiterhin
//      funktioniert.
//
// Beide Quellen erscheinen gemeinsam im Dropdown.
interface Track {
  id: string;
  name: string;
  url: string;
  // Optionale Metadaten (nur fuer mitgelieferte Defaults sinnvoll gesetzt).
  // arranger ist beibehalten fuer Faelle, in denen Komponist != Arranger
  // (z. B. Speedball 2: Komposition Simon Rogers, Amiga-Arrangement
  // Richard Joseph). publisher = Spiele-Verlag oder Demoszene-Gruppe.
  composer?: string;
  arranger?: string;
  publisher?: string;
  year?: string;
  // Markiert User-Uploads. Wird genutzt, um beim Unmount Object-URLs wieder
  // freizugeben und im UI das User-/Default-Segment optisch zu trennen.
  isUser?: boolean;
}

const BASE = import.meta.env.BASE_URL;

// Mitgelieferte Default-Tracks. Dateien liegen unter frontend/public/audio/.
// Endung .mod (kanonisch); Apache MIME-Type ist in der .htaccess gesetzt.
// Encoded URLs (Spaces als %20), weil fetch zwar tolerant ist, aber manche
// Server-Konfigurationen sonst patzig sind.
//
// Urheberangaben: Best-Effort recherchiert (siehe Audit-Session 2026-05-29
// und Wikipedia / Hardcore Gaming 101 / Khinsider als Quellen). Diese
// Attribution dient als "good faith"-Hinweis und ist keine Lizenz. Im
// Footer steht ein entsprechender Disclaimer, takedown-on-request gilt.
const DEFAULT_TRACKS: Track[] = [
  { id: 'agony',         name: 'Agony (Intro)',                url: `${BASE}audio/agony-Intro.mod`,                composer: 'Tim Wright (CoLD SToRAGE)', arranger: 'Tim Wright',          publisher: 'Psygnosis / Art & Magic',     year: '1992' },
  { id: 'lotus2',        name: 'Lotus 2',                      url: `${BASE}audio/Lotus2.mod`,                     composer: 'Barry Leitch',              arranger: 'Barry Leitch',        publisher: 'Magnetic Fields / Gremlin',   year: '1991' },
  { id: 'lotus3',        name: 'Lotus 3 (Title)',              url: `${BASE}audio/Lotus3-Title.mod`,               composer: 'Barry Leitch',              arranger: 'Barry Leitch',        publisher: 'Magnetic Fields / Gremlin',   year: '1992' },
  { id: 'rtype',         name: 'R-Type',                       url: `${BASE}audio/Rtype.mod`,                      composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Factor 5 / Activision',       year: '1989' },
  { id: 'simon',         name: 'Simon the Sorcerer (Village)', url: `${BASE}audio/Simon_the_Sorcerer-Village.mod`, composer: 'Mark McLeod & Adam Gilmore',arranger: 'Mark McLeod',         publisher: 'Adventure Soft',              year: '1993' },
  { id: 'speedball2',    name: 'Speedball 2',                  url: `${BASE}audio/Speedball%202.mod`,              composer: 'Simon Rogers',              arranger: 'Richard Joseph',      publisher: 'Bitmap Brothers / Image Works', year: '1990' },
  { id: 'stardust',      name: 'Stardust Memories',            url: `${BASE}audio/Stardust%20Memories.mod`,        composer: 'Volker Tripp (Jester)',     arranger: 'Volker Tripp (Jester)', publisher: 'Sanity (demoscene)',         year: '1992' },
  { id: 'turrican',      name: 'Turrican',                     url: `${BASE}audio/TURRICAN.MOD`,                   composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1990' },
  { id: 'turrican-ii',   name: 'Turrican II',                  url: `${BASE}audio/turrican%20ii.mod`,              composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1991' },
  { id: 'turrican-2-1',  name: 'Turrican II — Level 2.1',      url: `${BASE}audio/turrican%202.1.mod`,             composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1991' },
  { id: 'turrican-2-3',  name: 'Turrican II — Level 2.3',      url: `${BASE}audio/turrican%202.3.mod`,             composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1991' },
  { id: 'turrican-end',  name: 'Turrican — End Part',          url: `${BASE}audio/turrican%20end-part.mod`,        composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1990' },
  { id: 'turrican-hs',   name: 'Turrican — Highscore',         url: `${BASE}audio/turrican%20highscore.mod`,       composer: 'Chris Hülsbeck',            arranger: 'Chris Hülsbeck',      publisher: 'Rainbow Arts',                year: '1990' },
];

// Heuristik fuer MOD-Dateinamen: moderne .mod-Endung ODER klassische
// Amiga-Konvention mit Praefix "mod." (z. B. "mod.elysium").
function isModName(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith('.mod') || n.startsWith('mod.');
}

// Liest rekursiv alle Files aus einem DataTransfer — inklusive Ordnern.
// Browser-API: DataTransferItem.webkitGetAsEntry() → FileEntry oder
// DirectoryEntry. Ordner werden via DirectoryReader.readEntries() in
// Batches durchlaufen (deshalb die while-Schleife).
async function collectDroppedFiles(dt: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  const items = dt.items;
  // Pruefen, ob webkitGetAsEntry verfuegbar ist (Chrome, Edge, Safari, neuere FF).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (items && items.length && typeof (items[0] as any).webkitGetAsEntry === 'function') {
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = (items[i] as any).webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    for (const entry of entries) await walkEntry(entry, out);
    return out;
  }
  // Fallback: keine Entry-API → nur direkt gedroppte Dateien, keine Ordner.
  for (let i = 0; i < dt.files.length; i++) out.push(dt.files[i]);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function walkEntry(entry: any, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file: File = await new Promise((res, rej) => entry.file(res, rej));
    out.push(file);
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    // readEntries liefert in Batches, leeres Array signalisiert das Ende.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) await walkEntry(child, out);
    }
  }
}

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
  // vuLevelsRef = das, was tatsaechlich gezeichnet wird (geglaettet).
  // vuTargetsRef = der letzte rohe Peak-Wert aus dem Worklet (~47x/sec).
  // Die rAF-Loop bewegt vuLevels zeitlich gedaempft Richtung vuTargets via
  // asymmetrischer EMA (Attack 0.35 / Release 0.08). Pattern aus dem
  // Standalone-Player portiert (Hybrid-Reintegration, ProTracker-Audit).
  const vuLevelsRef = useRef<VuLevels>([0, 0, 0, 0]);
  const vuTargetsRef = useRef<VuLevels>([0, 0, 0, 0]);

  // HTML-Refs für direkten DOM-Zugriff
  const vuBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const statusRowRef = useRef<HTMLSpanElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  // Aktuell hervorgehobene Tracker-Zeile gecacht, damit der watchRows-Callback
  // nicht pro Row ein querySelector('[data-active="true"]') feuern muss
  // (Layout-Thrash-Vermeidung, ProTracker-Audit-Befund).
  const activeRowElRef = useRef<HTMLElement | null>(null);

  // Caching für Container- und Zeilenhöhe zur Vermeidung von Layout-Thrashing (Forced Reflow)
  const rowHeightRef = useRef<number>(15);
  const containerHeightRef = useRef<number>(200);

  // ModPlayer einmalig für die Lebensdauer der Komponente erzeugen
  const [player] = useState(() => new ModPlayer());
  const playerRef = useRef<ModPlayer>(player);
  const shouldAutoPlayRef = useRef(false);

  // User-Uploads (Drop / File-Picker / Folder-Picker). Object-URLs werden
  // bei Unmount aktiv freigegeben (siehe useEffect weiter unten).
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  // Drop-Overlay-Sichtbarkeit. dragDepth zaehlt verschachtelte
  // dragenter/dragleave-Events, damit das Overlay nicht flackert, wenn
  // die Maus ueber innere Elemente faehrt.
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  // Refs auf die unsichtbaren File-/Folder-Pickers — der Button-Klick
  // delegiert per .click() an diese Inputs.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Defaults + User-Uploads in einer einzigen Liste. Reihenfolge: zuerst
  // Defaults (stabile Indizes), dann User-Uploads in Hinzufuege-Reihenfolge.
  const allTracks = useMemo<Track[]>(
    () => [...DEFAULT_TRACKS, ...userTracks],
    [userTracks]
  );

  // Object-URLs der User-Tracks beim Unmount der Komponente freigeben.
  // Wichtig: nicht jedes Mal beim Update von userTracks, sondern erst beim
  // endgueltigen Verschwinden — sonst wuerde der gerade aktive Track die
  // URL unter den Fuessen verlieren.
  useEffect(() => {
    return () => {
      for (const t of userTracks) {
        if (t.isUser && t.url.startsWith('blob:')) {
          try { URL.revokeObjectURL(t.url); } catch (_) {}
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const randIdx = Math.floor(Math.random() * DEFAULT_TRACKS.length);
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
    vuTargetsRef.current = [0, 0, 0, 0];
    activeRowElRef.current = null;

    player.load(allTracks[trackIdx].url, `${BASE}audio/mod-player-worklet.js`).then(() => {
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

          // Direkte DOM-Aktualisierung der Zeilen-Highlights.
          // Vorher: pro Row-Event zweimal querySelector — einmal fuer die alte
          // aktive Zeile, einmal fuer die neue. Bei ~50 Row-Events/Sekunde war
          // das ein messbarer Layout-Thrash-Trigger (ProTracker-Audit).
          // Jetzt: die letzte aktive Zeile in activeRowElRef cachen, nur die
          // neue per data-row-idx-Selector holen.
          const container = rowsContainerRef.current;
          if (container) {
            const prevActive = activeRowElRef.current;
            if (prevActive) {
              prevActive.setAttribute('data-active', 'false');
            }
            const nextActive = container.querySelector(`[data-row-idx="${row}"]`) as HTMLElement | null;
            if (nextActive) {
              nextActive.setAttribute('data-active', 'true');
              activeRowElRef.current = nextActive;

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

      // VU-Pegel direkt aus dem Worklet (echtes Per-Channel-Peak ~47x/sec).
      // Skala kommt im Bereich 0..~0.5 (siehe Channel.nextOutput() im Worklet)
      // — *2 mappt grob nach 0..1. Wert landet in vuTargetsRef; die
      // eigentliche zeitliche Glaettung macht der rAF-Loop (EMA).
      player.watchLevels((peaks: number[]) => {
        if (!active) return;
        const targets = vuTargetsRef.current;
        targets[0] = Math.min(1, peaks[0] * 2);
        targets[1] = Math.min(1, peaks[1] * 2);
        targets[2] = Math.min(1, peaks[2] * 2);
        targets[3] = Math.min(1, peaks[3] * 2);
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

  // VU-Meter: asymmetrische, ZEITBASIERTE EMA gegen den vom Worklet
  // gelieferten Peak-Zielwert.
  //
  // Erste Variante (aus Standalone v0.3.2 portiert) nutzte feste Per-Frame-
  // Faktoren (Attack 0.35 / Release 0.08). Das funktioniert dort gut, weil
  // der Standalone-Player allein laeuft und stabil ~60 fps tickt.
  // In FraktalLab teilen sich >20 Panels den Hauptthread; unter Last sinkt
  // die rAF-Rate, frame-count-basierte EMA schreitet entsprechend langsamer
  // voran und das Meter wirkt extrem traege.
  //
  // Loesung: Decay-Faktor pro Tick aus `dt` (Millisekunden seit letztem
  // Tick) und einer Zeitkonstante (tau) berechnen:
  //     alpha = 1 - exp(-dt / tau)
  // Bei doppeltem dt verdoppelt sich grob alpha, das Meter zieht
  // automatisch nach.
  //
  // Tau-Werte snappier als die Standalone-Variante:
  //   tau_attack  = 25 ms → bei 60 fps ~ alpha 0.49 (Meter springt fast
  //                         auf Peak)
  //   tau_release = 80 ms → bei 60 fps ~ alpha 0.19 (95 % Decay in
  //                         ~240 ms — Auge folgt schnellem Fall, aber
  //                         ohne Flimmern)
  useEffect(() => {
    const TAU_ATTACK_MS = 25;
    const TAU_RELEASE_MS = 80;
    let lastTickT = 0;
    const unsubscribe = subscribe((t: number) => {
      // Erster Tick: dt initialisieren statt grosser Initialwerte.
      const dt = lastTickT === 0 ? 16.7 : Math.min(100, t - lastTickT);
      lastTickT = t;
      const aAttack = 1 - Math.exp(-dt / TAU_ATTACK_MS);
      const aRelease = 1 - Math.exp(-dt / TAU_RELEASE_MS);

      const levels = vuLevelsRef.current;
      const targets = vuTargetsRef.current;
      for (let i = 0; i < 4; i++) {
        const target = targets[i];
        const cur = levels[i];
        const a = target > cur ? aAttack : aRelease;
        levels[i] = cur + (target - cur) * a;

        // VU-Balken direkt im DOM zeichnen — nur schreiben, wenn sich der
        // Wert sichtbar geaendert hat (Reflow-Schutz).
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

  // Scrollt die aktive Zeile in die Mitte, wenn sich das Pattern aendert,
  // und misst einmalig die Hoehen, um Layout-Thrashing beim Abspielen zu
  // vermeiden. Pattern-Wechsel bedeutet React-Re-Render der Tracker-Zeilen,
  // d. h. das vorher gecachte activeRowElRef-Node ist nicht mehr im DOM —
  // hier wird die neue Referenz frisch gefasst.
  useEffect(() => {
    const container = rowsContainerRef.current;
    if (!container) return;
    const activeRowEl = container.querySelector('[data-active="true"]') as HTMLElement;
    if (!activeRowEl) return;
    activeRowElRef.current = activeRowEl;
    const containerHeight = container.clientHeight;
    const rowHeight = activeRowEl.clientHeight;
    containerHeightRef.current = containerHeight || 200;
    rowHeightRef.current = rowHeight || 15;
    const rowTop = activeRowEl.offsetTop;
    container.scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
  }, [currentPosition]);

  // ── User-Upload-Handling ───────────────────────────────────────────────────
  // Fuegt eine Liste von Files der User-Track-Liste hinzu. Filtert auf MOD-
  // Dateinamen, erzeugt Object-URLs, dedupliziert per Name+Size. Anschliessend
  // optional den ersten neu hinzugefuegten Track sofort laden.
  const addUserFiles = (files: File[], playFirstAdded: boolean): Track | null => {
    const fresh: { file: File; track: Track }[] = [];
    setUserTracks((prev) => {
      const next: Track[] = [...prev];
      for (const f of files) {
        if (!isModName(f.name)) continue;
        // Duplikate (gleicher Name + gleiche Groesse) ueberspringen — sonst
        // landen identische Dateien mehrfach im Dropdown.
        const existing = next.find((t) => t.isUser && t.name === f.name && (t as any).__size === f.size);
        if (existing) continue;
        const objUrl = URL.createObjectURL(f);
        const baseName = f.name.replace(/\.mod$/i, '').replace(/^mod\./i, '');
        const track: Track = {
          id: 'user:' + f.name + ':' + f.size,
          name: baseName || f.name,
          url: objUrl,
          isUser: true,
        };
        // Groesse als nicht-sichtbares Property mitgeben fuer Dedup-Check.
        (track as any).__size = f.size;
        next.push(track);
        fresh.push({ file: f, track });
      }
      return next;
    });
    if (!fresh.length) return null;
    if (playFirstAdded) {
      // setUserTracks wird asynchron. Index des neuen Tracks ergibt sich nach
      // dem React-Render. Deshalb Index hier nach Anzahl bestehender Tracks
      // berechnen — funktioniert weil setUserTracks oben "next" voll baut.
      // Auswahl per Microtask, damit der State-Update durch ist.
      const firstAddedName = fresh[0].track.name;
      const firstAddedSize = (fresh[0].track as any).__size;
      queueMicrotask(() => {
        setUserTracks((prev) => {
          const idxInList = prev.findIndex((t) => t.name === firstAddedName && (t as any).__size === firstAddedSize);
          if (idxInList >= 0) {
            shouldAutoPlayRef.current = true;
            setTrackIdx(DEFAULT_TRACKS.length + idxInList);
          }
          return prev;
        });
      });
    }
    return fresh[0].track;
  };

  const onFilePickerChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addUserFiles(files, true);
    // Input-Wert zuruecksetzen, damit dieselbe Datei erneut waehlbar ist.
    e.target.value = '';
  };

  const onFolderPickerChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const all = e.target.files ? Array.from(e.target.files) : [];
    const mods = all.filter((f) => isModName(f.name));
    if (mods.length) addUserFiles(mods, true);
    e.target.value = '';
  };

  // ── Drag & Drop (Panel-weit) ──────────────────────────────────────────────
  // dragenter/dragover muessen preventDefault aufrufen, damit drop ueberhaupt
  // feuert. dragDepth zaehlt verschachtelte enter/leave-Events, damit das
  // Overlay nicht flackert.
  const onDragEnter: React.DragEventHandler = (e) => {
    e.preventDefault();
    dragDepthRef.current++;
    if (!dragOver) setDragOver(true);
  };
  const onDragOver: React.DragEventHandler = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave: React.DragEventHandler = (e) => {
    e.preventDefault();
    dragDepthRef.current--;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragOver(false);
    }
  };
  const onDrop: React.DragEventHandler = async (e) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragOver(false);
    try {
      const files = await collectDroppedFiles(e.dataTransfer);
      const mods = files.filter((f) => isModName(f.name));
      if (mods.length) addUserFiles(mods, true);
    } catch (err) {
      console.error('Drop-Verarbeitung fehlgeschlagen:', err);
      // Fallback: nur direkt gedroppte Dateien, keine Ordner.
      const direct = Array.from(e.dataTransfer.files || []);
      const mods = direct.filter((f) => isModName(f.name));
      if (mods.length) addUserFiles(mods, true);
    }
  };

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
      <div
        className="relative flex flex-col h-full overflow-hidden bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] font-mono text-xs select-none p-0.5"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Drop-Overlay — wird waehrend eines Drag-Vorgangs ueber das Panel
            sichtbar. pointer-events:none, damit die Drag-Events weiterhin
            den darunterliegenden Panel-Container treffen. */}
        {dragOver && (
          <div
            aria-hidden="true"
            style={{ pointerEvents: 'none' }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-[#0055aa]/70 border-4 border-dashed border-white text-white font-bold text-sm"
          >
            DROP .MOD FILES OR FOLDER
          </div>
        )}

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
              {/* Defaults zuerst (Indizes 0..DEFAULT_TRACKS.length-1). */}
              <optgroup label="Built-in">
                {DEFAULT_TRACKS.map((t, idx) => (
                  <option key={t.id} value={idx}>{t.name}</option>
                ))}
              </optgroup>
              {/* User-Uploads danach, Indizes verschoben. Optgroup nur anzeigen,
                  wenn der Nutzer ueberhaupt etwas hochgeladen hat. */}
              {userTracks.length > 0 && (
                <optgroup label="User MODs">
                  {userTracks.map((t, i) => (
                    <option key={t.id} value={DEFAULT_TRACKS.length + i}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {/* Datei-Picker (einzelne .mod). Klick auf den sichtbaren Button
                delegiert per .click() an das unsichtbare Input-Element. */}
            <button
              type="button"
              title="Eigene .mod-Datei laden"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 active:border-t-neutral-700 active:border-l-neutral-700 active:border-b-white active:border-r-white px-1.5 py-0.5 text-[10px] font-bold text-black cursor-pointer"
            >
              LOAD…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mod,application/octet-stream"
              multiple
              onChange={onFilePickerChange}
              style={{ display: 'none' }}
            />
            {/* Ordner-Picker. webkitdirectory ist nicht-standard, wird aber
                von allen modernen Desktop-Browsern unterstuetzt. */}
            <button
              type="button"
              title="Ganzen Ordner mit .mod-Dateien laden"
              onClick={() => folderInputRef.current?.click()}
              className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-neutral-700 border-r-neutral-700 active:border-t-neutral-700 active:border-l-neutral-700 active:border-b-white active:border-r-white px-1.5 py-0.5 text-[10px] font-bold text-black cursor-pointer"
            >
              DIR…
            </button>
            <input
              ref={folderInputRef}
              type="file"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={onFolderPickerChange}
              style={{ display: 'none' }}
            />
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
              {/* Fuer User-Uploads gibt es keine Metadaten — Strich anzeigen.
                  ARRANGER nur einblenden, wenn er sich vom Composer unter-
                  scheidet (z. B. Speedball 2: Simon Rogers / Richard Joseph). */}
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>COMPOSER:</span>
                <span className="text-black truncate max-w-[100px]" title={allTracks[trackIdx]?.composer || ''}>
                  {allTracks[trackIdx]?.composer || '—'}
                </span>
              </div>
              {allTracks[trackIdx]?.arranger && allTracks[trackIdx]?.arranger !== allTracks[trackIdx]?.composer && (
                <div className="flex justify-between text-neutral-700 font-bold">
                  <span>ARRANGER:</span>
                  <span className="text-black truncate max-w-[100px]" title={allTracks[trackIdx]?.arranger || ''}>
                    {allTracks[trackIdx]?.arranger}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>PUBLISHER:</span>
                <span className="text-black truncate max-w-[100px]" title={allTracks[trackIdx]?.publisher || ''}>
                  {allTracks[trackIdx]?.publisher || '—'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-700 font-bold">
                <span>YEAR:</span>
                <span className="text-black">
                  {allTracks[trackIdx]?.year || '—'}
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
          <span>♦ AMIGA PROTRACKER RENDERER ♦ TECH SHOWCASE — MUSIC © RESPECTIVE COMPOSERS &amp; PUBLISHERS</span>
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
