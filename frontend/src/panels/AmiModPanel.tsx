import { memo,  useEffect, useMemo, useRef, useState } from 'react';
import Panel from '../ui/Panel';
import { ModPlayer } from '../utils/modplayer/player';
import { Mod, Note } from '../utils/modplayer/mod';
import { subscribe } from '../utils/raf-coordinator';
import { registerAudioFocusListener, requestAudioFocus, releaseAudioFocus, registerAudioCandidate, notifyAudioEnded } from '../utils/audio-focus';
import { MOD_TRACKS, BOTB_SOURCE, BOTB_LICENSE_SHORT, BOTB_LICENSE_URL } from '../utils/botb-tracks.generated';

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
  // BotB-Attribution (CC BY-NC-SA): Quelle, Lizenz-Kürzel und Entry-Link.
  source?: string;
  license?: string;
  entryUrl?: string;
  // Markiert User-Uploads. Wird genutzt, um beim Unmount Object-URLs wieder
  // freizugeben und im UI das User-/Default-Segment optisch zu trennen.
  isUser?: boolean;
}

const BASE = import.meta.env.BASE_URL;

// Mitgelieferte Default-Tracks: MODs von Battle of the Bits (CC BY-NC-SA).
// Die Liste wird AUTOMATISCH aus dem Manifest (botb-tracks.generated.ts) abgeleitet,
// das wiederum vom Skript scripts/build-audio-manifest.mjs erzeugt wird. So bleiben
// Tracks, Attribution UND Dateigrößen synchron, wenn sich die mods/sids ändern.
const DEFAULT_TRACKS: Track[] = MOD_TRACKS.map(t => ({
  id:        `botb-${t.id}`,
  name:      t.title,
  url:       `${BASE}${t.file}`,
  composer:  t.author,            // Autor des Tracks
  publisher: BOTB_SOURCE,         // "Battle of the Bits"
  year:      `Entry ${t.id}`,     // BotB-Entry-ID statt Jahr
  source:    BOTB_SOURCE,
  license:   BOTB_LICENSE_SHORT,  // "CC BY-NC-SA"
  entryUrl:  t.entryUrl,
}));

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
  // Generation des aktuell gueltigen Track-Loads. Wird bei jedem trackIdx-
  // Wechsel inkrementiert. Watcher-Callbacks und das spaete .then() vom
  // Player.load() pruefen myGen gegen den aktuellen Wert, sodass stale
  // Effects nichts mehr veraendern. Notwendig wegen Race bei schnellem
  // Track-Wechsel — angezeigter Name + Tracker passten dann nicht zum
  // hoerbaren Song.
  const loadGenRef = useRef(0);
  // Loop-Ende-Detektion in watchRows: wenn die Position des Worklets
  // unerwartet zurueckspringt UND es nicht durch User-Scrubbing
  // verursacht wurde, gilt der Song als am Ende. Beide Werte werden als
  // Ref gefuehrt, damit der Scrub-Handler sie aktualisieren kann.
  const lastPosRef = useRef(0);
  const justScrubbedRef = useRef(false);

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

  // ResizeObserver für responsive Darstellung in kleinen Grid-Zellen
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 350 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isNarrow = dimensions.width < 500;
  const isUltraNarrow = dimensions.width < 365;
  const isShort = dimensions.height < 320;
  // Drei Layout-Stufen:
  // - Tiny-Strip: breite, sehr flache Mobile-Kacheln (z.B. Turbo Portrait).
  //   Keine Tracker-Zeilen, weil sie dort nur statisch/abgeschnitten wirken.
  //   Stattdessen: animierte VU-Meter + Status, also sichtbar lebendiger Inhalt.
  // - Compact: kleine, aber ausreichend hohe Kacheln; echter scrollender Tracker.
  // - Full: Desktop/hohe Kacheln mit kompletter Tracker-Tabelle.
  const isTinyStripPlayer = dimensions.height < 210;
  // Compact-Modus ist nur fuer wirklich kleine Mobile-Kacheln gedacht. Auf
  // Retina-Desktop wirken Panels optisch gross, haben in CSS-Pixeln aber oft nur
  // knapp ueber 300 px Hoehe; die alte 330px-Schwelle schaltete dann faelschlich
  // auf den Mini-Tracker mit fester 7em-Hoehe und liess darunter viel Leerraum.
  const isCompactPlayer = !isTinyStripPlayer && (dimensions.height < 260 || (dimensions.width < 330 && dimensions.height < 360));
  const hideTrackPicker = dimensions.width < 330 || dimensions.height < 220;
  const showMainArea = dimensions.height >= 120;

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

  // Als Election-Kandidat registrieren. start() spielt den (beim Mount zufällig
  // gewählten) Track ab + holt Fokus; setMuted() stoppt/startet, behält aber den
  // Fokus (Pause-Verhalten). Liest player.mod LIVE statt aus React-State, damit
  // der einmalig registrierte Callback nicht auf veralteten Ladestand zugreift.
  useEffect(() => {
    const failPlay = (err: unknown) => {
      console.error('MOD play failed:', err);
      setPlaying(false);
      (window as any).fraktallab_mod_playing = false;
      setLoadError(err instanceof Error ? err.message : String(err));
      releaseAudioFocus(AUDIO_ID);
    };

    const playTrack = () => {
      const p = playerRef.current;
      requestAudioFocus(AUDIO_ID);
      if (p.mod) {
        lastPosRef.current = 0;
        justScrubbedRef.current = false;
        p.resumeContext();
        p.play()
          .then(() => {
            setPlaying(true);
            (window as any).fraktallab_mod_playing = true;
          })
          .catch(failPlay);
      } else {
        // Track lädt noch → der Load-Finish-Pfad startet dann automatisch.
        // WICHTIG: den (geteilten) AudioContext TROTZDEM schon hier — also
        // WÄHREND der User-Geste (Erst-Klick) — entsperren. Sonst spielt der
        // spätere Auto-Start im load().then() außerhalb einer Geste, und Chrome
        // lässt den Context dann suspended → MOD bleibt stumm (das war der Bug;
        // der SID-Player entsperrt im Geste-Pfad und war deshalb nie betroffen).
        p.resumeContext();
        shouldAutoPlayRef.current = true;
      }
    };
    return registerAudioCandidate(AUDIO_ID, {
      start: playTrack,
      setMuted: (m) => {
        const p = playerRef.current;
        if (m) {
          p.stop();
          setPlaying(false);
          (window as any).fraktallab_mod_playing = false;
        } else {
          playTrack();
        }
      },
    });
  }, []);

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
    // Diese Effect-Instanz bekommt eine eigene Generation. Spaetere Effects
    // bumpen den Counter; alle Callbacks dieses Effects pruefen ihren
    // myGen gegen loadGenRef.current und kuendigen sich selbst, sobald sie
    // stale sind. Wichtig wegen Race bei schnellem Track-Wechsel.
    const myGen = ++loadGenRef.current;
    let active = true;
    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    currentRowRef.current = 0;
    setCurrentPosition(0);
    vuLevelsRef.current = [0, 0, 0, 0];
    vuTargetsRef.current = [0, 0, 0, 0];
    activeRowElRef.current = null;

    player.load(allTracks[trackIdx].url, `${BASE}audio/mod-player-worklet.js?v=${__APP_VERSION__}`).then(() => {
      // Stale-Check: entweder Effect schon unmounted (active=false) oder
      // ein neuer Track-Wechsel hat die Generation hochgesetzt.
      if (!active || myGen !== loadGenRef.current) {
        return;
      }
      // Mod lokal capturen, damit kein Callback spaeter player.mod liest,
      // das durch einen ueberlappenden load() bereits ueberschrieben wurde.
      const myMod = player.mod;
      if (!myMod) {
        // load() wurde vom Generation-Guard im Player verworfen — nichts tun.
        return;
      }
      setLoading(false);
      setMod(myMod);

      if (shouldAutoPlayRef.current) {
        requestAudioFocus(AUDIO_ID);
        // Atomare Uebergabe: play() schickt myMod explizit ans Worklet,
        // statt aus this.mod zu lesen.
        player.play(myMod)
          .then(() => {
            setPlaying(true);
            (window as any).fraktallab_mod_playing = true;
          })
          .catch((err) => {
            console.error('MOD autoplay failed:', err);
            setPlaying(false);
            (window as any).fraktallab_mod_playing = false;
            setLoadError(err instanceof Error ? err.message : String(err));
            releaseAudioFocus(AUDIO_ID);
          });
        shouldAutoPlayRef.current = false;
      }

      // Subscriptions (Registrierung der Player-Ereignisse).
      // Closures nutzen myMod / myGen — kein Zugriff mehr auf das mutable
      // player.mod aus Callbacks heraus.
      // lastPos liegt in einem Ref, nicht im Closure — der Scrubber-
      // Handler kann es aktualisieren, sodass ein User-initiiertes
      // Rueckwaertsspringen nicht als "Song zu Ende" missinterpretiert wird.
      lastPosRef.current = 0;
      justScrubbedRef.current = false;
      player.watchRows((pos, row) => {
        if (active && myGen === loadGenRef.current) {
          // Wenn der User gerade gescrubbt hat: keine Loop-Ende-Detektion.
          // Stattdessen nur State synchronisieren und die Flag wieder
          // freigeben fuer den naechsten Tick.
          if (justScrubbedRef.current) {
            justScrubbedRef.current = false;
            lastPosRef.current = pos;
          }
          // Erkennen, wenn der Song zum Anfang zurückspringt (Loop-Ende erreicht).
          // Nur dann auto-stoppen, wenn die alte Position nahe am Songende
          // lag — sonst sind harmlose Pattern-Breaks zu falschen Stops geworden.
          const totalPatterns = myMod.length || 1;
          const loopedBack = pos < lastPosRef.current && lastPosRef.current >= myMod.length - 1;
          if (loopedBack || (totalPatterns === 1 && row === 0 && currentRowRef.current === 63)) {
            player.stop();
            setPlaying(false);
            (window as any).fraktallab_mod_playing = false;
            // Song zu Ende → an einen anderen Player übergeben (z.B. SID/Video).
            notifyAudioEnded(AUDIO_ID);
            return;
          }
          lastPosRef.current = pos;
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
        if (!active || myGen !== loadGenRef.current) return;
        const targets = vuTargetsRef.current;
        targets[0] = Math.min(1, peaks[0] * 2);
        targets[1] = Math.min(1, peaks[1] * 2);
        targets[2] = Math.min(1, peaks[2] * 2);
        targets[3] = Math.min(1, peaks[3] * 2);
      });

      player.watchStop(() => {
        if (active && myGen === loadGenRef.current) {
          setPlaying(false);
          (window as any).fraktallab_mod_playing = false;
        }
      });
    }).catch((err) => {
      // Promise-rejected. Wir geben den Fehler nur dann ans UI, wenn dieser
      // Effect noch aktuell ist — sonst ueberschreibt ein stale Fehler den
      // Status des laufenden Loads.
      if (!active || myGen !== loadGenRef.current) return;
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
    }, 'AmiModPanel'); // Player → Faktor 1× auf jeder Stufe (Audio + VU-Visual)
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
      // Worklet beginnt bei 'play' wieder von Position 0/Row 0. lastPosRef
      // muss daher zurueckgesetzt werden, sonst feuert die Loop-Ende-
      // Detektion sofort wieder (pos=0 < lastPos vom letzten Auto-Stop)
      // und kein Audio wird hoerbar.
      lastPosRef.current = 0;
      justScrubbedRef.current = false;
      player.resumeContext();
      requestAudioFocus(AUDIO_ID);
      player.play()
        .then(() => {
          setPlaying(true);
          (window as any).fraktallab_mod_playing = true;
        })
        .catch((err) => {
          console.error('MOD play failed:', err);
          setPlaying(false);
          (window as any).fraktallab_mod_playing = false;
          setLoadError(err instanceof Error ? err.message : String(err));
          releaseAudioFocus(AUDIO_ID);
        });
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
    <Panel title="MOD PLAYER // PROTRACKER">
      {/* MODERNES, RANDLOSES Design auf Schwarz — passend zum SID-Player.
          Keine Workbench-Bevels mehr. Die Schrift skaliert per Container-Query
          mit der Kachelgroesse: der Wurzel-Container setzt eine fontSize-clamp
          (Untergrenze ~7,5px), alle Kind-Elemente nutzen relative em-Groessen,
          sodass das ganze Panel in kleinen Kacheln mitschrumpft. Der
          aussenliegende PanelSlot stellt `container-type: size` bereit. */}
      <div
        ref={containerRef}
        className="relative flex flex-col h-full overflow-hidden bg-black text-[#4ade80] font-mono select-none p-1 gap-1"
        style={{ fontSize: 'clamp(7.5px, 3cqmin, 13px)' }}
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
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 border-2 border-dashed border-[#4ade80] text-[#4ade80] font-bold"
          >
            DROP .MOD FILES OR FOLDER
          </div>
        )}

        {/* ─── Steuerung (Controls Bar) ─────────────────────────────────
            Flach, schwarz, duenne Linien. Track-Auswahl + Datei-/Ordner-Picker
            links, Position + Play/Pause rechts. */}
        <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2 px-1.5 py-1 bg-[#0a0a0a] border border-[#1f2937] rounded shrink-0">
          {!hideTrackPicker && (
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-neutral-400 font-bold" style={{ fontSize: '0.85em' }}>SONG:</span>
              <select
                value={trackIdx}
                onChange={(e) => {
                  player.resumeContext();
                  setTrackIdx(Number(e.target.value));
                  shouldAutoPlayRef.current = true;
                }}
                disabled={loading}
                className={`bg-black border border-[#334155] text-[#4ade80] px-1 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50 truncate rounded-sm ${
                  isUltraNarrow ? 'max-w-[75px]' : isNarrow ? 'max-w-[100px]' : 'max-w-[150px]'
                }`}
                style={{ fontSize: '0.85em' }}
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
                className="bg-[#0f172a] border border-[#334155] active:bg-[#1e293b] px-1.5 py-0.5 font-bold text-neutral-300 cursor-pointer rounded-sm"
                style={{ fontSize: '0.85em' }}
              >
                LOAD…
              </button>
            </div>
          )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mod,application/octet-stream"
              multiple
              onChange={onFilePickerChange}
              style={{ display: 'none' }}
            />
            {/* Ordner-Picker. Nur auf größeren Panel-Größen einblenden */}
            {!isNarrow && !hideTrackPicker && (
              <>
                <button
                  type="button"
                  title="Ganzen Ordner mit .mod-Dateien laden"
                  onClick={() => folderInputRef.current?.click()}
                  className="bg-[#0f172a] border border-[#334155] active:bg-[#1e293b] px-1.5 py-0.5 font-bold text-neutral-300 cursor-pointer rounded-sm"
                  style={{ fontSize: '0.85em' }}
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
              </>
            )}
          <div className={`flex items-center gap-1.5 ${hideTrackPicker ? 'w-full justify-between' : ''}`}>
            {hideTrackPicker && (
              <span className="text-neutral-400 font-bold truncate pr-1" style={{ fontSize: '0.85em' }}>
                {allTracks[trackIdx]?.name || 'MOD'}
              </span>
            )}
            {mod && !isUltraNarrow && (
              <span className="text-neutral-400 font-bold whitespace-nowrap tabular-nums" style={{ fontSize: '0.85em' }}>
                POS: {String(currentPosition + 1).padStart(2, '0')}/{String(mod.length).padStart(2, '0')}
              </span>
            )}
            <button
              onClick={handlePlayToggle}
              disabled={loading}
              className={`border font-bold px-2 py-0.5 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap rounded-sm ${
                playing
                  ? 'bg-red-900/40 border-red-500/60 text-red-300 active:bg-red-800/60'
                  : 'bg-[#0f172a] border-[#334155] text-[#4ade80] active:bg-[#1e293b]'
              }`}
              style={{ fontSize: '0.85em' }}
            >
              {loading ? '⏳ LOAD...' : playing ? '■ STOP' : (isUltraNarrow ? '▶ PLAY' : '▶ PLAY AUDIO')}
            </button>
          </div>
        </div>

        {/* ─── Positionsregler (Scrubber) ─────────────────────────────────
            Range-Slider ueber die Pattern-Positionen des aktuellen Mods.
            Versteckt bei kleinen Panel-Höhen um vertikalen Platz zu sparen.
            Flacher, duenner Slider mit Gruen-Akzent (accent-Property) statt
            Workbench-Bevels. */}
        {mod && mod.length > 1 && !isShort && !isCompactPlayer && (
          <div className="flex items-center gap-2 px-1.5 py-0.5 shrink-0">
            <span className="text-neutral-500 font-bold shrink-0" style={{ fontSize: '0.8em' }}>
              POS
            </span>
            <input
              type="range"
              min={0}
              max={mod.length - 1}
              step={1}
              value={currentPosition}
              disabled={loading}
              onChange={(e) => {
                const newPos = Number(e.target.value);
                justScrubbedRef.current = true;
                lastPosRef.current = newPos;
                setCurrentPosition(newPos);
                currentRowRef.current = 0;
                player.setRow(newPos, 0);
              }}
              onPointerDown={(e) => {
                if (loading) return;
                const target = e.currentTarget;
                const rect = target.getBoundingClientRect();
                if (rect.width <= 0) return;
                const pct = (e.clientX - rect.left) / rect.width;
                const clamped = Math.max(0, Math.min(1, pct));
                const newPos = Math.round(clamped * (mod.length - 1));
                if (newPos === currentPosition) return;
                justScrubbedRef.current = true;
                lastPosRef.current = newPos;
                setCurrentPosition(newPos);
                currentRowRef.current = 0;
                player.setRow(newPos, 0);
              }}
              className="flex-1 h-1 accent-[#4ade80] cursor-pointer disabled:opacity-50"
              aria-label="Position im Song"
            />
            <span className="text-neutral-500 font-bold shrink-0 tabular-nums" style={{ fontSize: '0.8em' }}>
              {String(currentPosition + 1).padStart(2, '0')}/{String(mod.length).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* ─── Metadaten-Zeile (Titel / Composer) ───────────────────────────
            Wie beim SID-Player: kompakte Kopfzeile mit Songtitel und
            Urheberangaben statt der Workbench-Titelleiste. */}
        <div className="flex flex-col gap-0.5 px-1.5 py-1 bg-black/60 border-y border-[#111827] shrink-0" style={{ fontSize: (isTinyStripPlayer || isCompactPlayer) ? '0.78em' : '0.85em' }}>
          <div className="flex justify-between gap-2">
            <span className="text-neutral-400 truncate">
              Title: <strong className="text-white">{mod?.name?.trim() || 'UNTITLED'}</strong>
            </span>
            {!isUltraNarrow && !isCompactPlayer && !isTinyStripPlayer && (
              <span className="text-neutral-400 truncate shrink-0">
                Composer: <strong className="text-[#38bdf8]">{allTracks[trackIdx]?.composer || '—'}</strong>
              </span>
            )}
          </div>
          {/* Zweite Zeile mit weiteren Metadaten (nur auf breiteren Panels).
              ARRANGER nur, wenn er sich vom Composer unterscheidet
              (z. B. Speedball 2: Simon Rogers / Richard Joseph). */}
          {!isNarrow && !isCompactPlayer && !isTinyStripPlayer && (
            <div className="text-neutral-500 italic truncate">
              {allTracks[trackIdx]?.arranger && allTracks[trackIdx]?.arranger !== allTracks[trackIdx]?.composer
                ? `arr. ${allTracks[trackIdx]?.arranger} · `
                : ''}
              {allTracks[trackIdx]?.publisher || '—'}
              {allTracks[trackIdx]?.year ? ` · ${allTracks[trackIdx]?.year}` : ''}
            </div>
          )}
          {/* CC-Attribution (TASL: Title/Author/Source/Licence) — bei User-Uploads
              ausgeblendet. Autoscroll-Laufschrift, falls der Text breiter als die
              Kachel ist (siehe .marquee in index.css). Link führt zum BotB-Entry. */}
          {allTracks[trackIdx]?.license && !allTracks[trackIdx]?.isUser && !isTinyStripPlayer && (
            <div className="marquee text-[#6ee7b7]/80 border-t border-[#111827] pt-0.5" style={{ fontSize: '0.92em' }}>
              <span className="marquee__inner">
                {allTracks[trackIdx]?.name} — {allTracks[trackIdx]?.composer}, {allTracks[trackIdx]?.source} {allTracks[trackIdx]?.year},
                {' '}{allTracks[trackIdx]?.license} · No changes made ·{' '}
                <a href={allTracks[trackIdx]?.entryUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">BotB-Entry</a>
                {' · '}
                <a href={BOTB_LICENSE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Lizenz</a>
              </span>
            </div>
          )}
          {loadError && <div className="text-red-500 font-bold mt-0.5">ERROR: {loadError}</div>}
        </div>

        {/* ─── Hauptbereich ─────────────────────────────────────────────
            VU-Meter links, Tracker-Tabelle Mitte, Instrumentenliste rechts.
            Alles flach auf Schwarz mit duennen Trennlinien. */}
        {showMainArea && (
        <div className="flex flex-1 overflow-hidden min-h-0 gap-1">
          {isTinyStripPlayer ? (
            <div className="flex-1 min-w-0 bg-[#050505] border border-[#1f2937] rounded px-1 py-0.5 flex flex-col gap-0.5 overflow-hidden">
              <div className="flex justify-between gap-2 text-neutral-500 font-bold shrink-0" style={{ fontSize: '0.72em' }}>
                <span className="truncate">{mod?.name?.trim() || allTracks[trackIdx]?.name || 'UNTITLED'}</span>
                <span className={playing ? 'text-[#4ade80] animate-pulse' : 'text-neutral-600'}>
                  {playing ? 'PLAYING' : loading ? 'LOADING' : 'STOPPED'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500 font-bold tabular-nums shrink-0" style={{ fontSize: '0.68em' }}>
                <span>POS {mod ? `${String(currentPosition + 1).padStart(2, '0')}/${String(mod.length).padStart(2, '0')}` : '--/--'}</span>
                <span ref={statusRowRef}>{currentRowRef.current.toString().padStart(2, '0')}/63</span>
              </div>
              <div className="grid grid-cols-4 gap-1 flex-1 min-h-0 pt-0.5 border-t border-[#111827]">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col min-h-0 items-center gap-0.5">
                    <span className="text-neutral-500 font-bold leading-none" style={{ fontSize: '0.62em' }}>
                      CH{i + 1}
                    </span>
                    <div className="w-full max-w-[1.6em] flex-1 min-h-[1.4em] bg-black border border-[#1f2937] relative overflow-hidden">
                      <div
                        ref={(el) => { vuBarsRef.current[i] = el; }}
                        className="absolute bottom-0 left-0 right-0"
                        style={{
                          height: '2%',
                          background: 'linear-gradient(to top, #166534 0%, #4ade80 60%, #38bdf8 85%, #facc15 100%)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isCompactPlayer ? (
            <>
              {/* Kompaktmodus fuer Mobile/kleine Kacheln: links kleine VU-Meter,
                  rechts ein echter scrollender Tracker mit aktiver Row. */}
              <div
                className="grid grid-cols-2 grid-rows-2 gap-1 px-1 py-1 bg-[#0a0a0a] border border-[#1f2937] shrink-0 w-[5.2em] rounded self-center"
                style={{ height: 'min(100%, 11em)' }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-end gap-0.5 min-h-0">
                    <span className="text-neutral-500 font-bold leading-none" style={{ fontSize: '0.62em' }}>
                      {i + 1}
                    </span>
                    <div
                      className="flex-1 min-w-[0.6em] bg-black border border-[#1f2937] relative overflow-hidden"
                      style={{ height: '100%' }}
                    >
                      <div
                        ref={(el) => { vuBarsRef.current[i] = el; }}
                        className="absolute bottom-0 left-0 right-0"
                        style={{
                          height: '2%',
                          background: 'linear-gradient(to top, #166534 0%, #4ade80 60%, #38bdf8 85%, #facc15 100%)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0 bg-[#050505] border border-[#1f2937] rounded px-1 py-0.5 flex flex-col overflow-hidden">
                <div className="flex justify-between gap-2 text-neutral-500 font-bold shrink-0" style={{ fontSize: '0.72em' }}>
                  <span className="truncate">{mod?.name?.trim() || allTracks[trackIdx]?.name || 'UNTITLED'}</span>
                  <span className={playing ? 'text-[#4ade80] animate-pulse' : 'text-neutral-600'}>
                    {playing ? 'PLAYING' : loading ? 'LOADING' : 'STOPPED'}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-500 font-bold tabular-nums shrink-0" style={{ fontSize: '0.68em' }}>
                  <span>POS {mod ? `${String(currentPosition + 1).padStart(2, '0')}/${String(mod.length).padStart(2, '0')}` : '--/--'}</span>
                  <span ref={statusRowRef}>{currentRowRef.current.toString().padStart(2, '0')}/63</span>
                </div>
                <div
                  ref={rowsContainerRef}
                  className="mt-0.5 flex-1 min-h-0 overflow-y-auto no-scrollbar border-t border-[#111827] pt-0.5"
                  style={{ fontSize: '0.66em', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <style>{`
                    .mod-compact-row {
                      line-height: 1.25;
                      color: #2f7d4f;
                    }
                    .mod-compact-row[data-active="true"] {
                      background-color: rgba(74, 222, 128, 0.16);
                      color: #ffffff;
                      box-shadow: inset 2px 0 0 #4ade80;
                    }
                    .mod-compact-row[data-active="true"] .mod-compact-row-idx {
                      color: #4ade80;
                    }
                  `}</style>
                  {loading ? (
                    <div className="text-[#38bdf8] animate-pulse">LOADING MODULE...</div>
                  ) : allRows.length > 0 ? (
                    allRows.map((row, absoluteRow) => (
                      <div
                        key={absoluteRow}
                        data-row-idx={absoluteRow}
                        data-active={absoluteRow === currentRowRef.current ? 'true' : 'false'}
                        className="mod-compact-row flex tabular-nums"
                      >
                        <span className="mod-compact-row-idx w-5 shrink-0 text-neutral-500">{absoluteRow.toString(16).toUpperCase().padStart(2, '0')}</span>
                        {row.notes.map((note, ci) => (
                          <span key={ci} className="flex-1 min-w-0 text-center truncate">
                            {getNoteName(note.period)} {formatInstrument(note)} {formatEffect(note)}
                          </span>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className={loadError ? 'text-red-500' : 'text-neutral-600'}>
                      {loadError ? `ERROR: ${loadError}` : 'NO SEQUENCE DATA'}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>

          {/* ── VU-Meter (links) ─────────────────────────────────────────── */}
          {!isUltraNarrow && (
            <div className="flex flex-col justify-center gap-1.5 px-1 bg-[#0a0a0a] border border-[#1f2937] shrink-0 w-8 py-1 rounded">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-neutral-500 font-bold" style={{ fontSize: '0.7em' }}>
                    CH{i + 1}
                  </span>
                  <div
                    className="w-3 bg-black border border-[#1f2937] relative overflow-hidden"
                    style={{ height: '34px' }}
                  >
                    <div
                      ref={(el) => { vuBarsRef.current[i] = el; }}
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        height: '2%',
                        // Gruen → Cyan → Gelb Verlauf, passend zur Akzentfarbe.
                        background: 'linear-gradient(to top, #166534 0%, #4ade80 60%, #38bdf8 85%, #facc15 100%)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tracker-Tabelle (Mitte) ──────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0 bg-[#050505] border border-[#1f2937] rounded">
            {/* Spaltenköpfe */}
            <div
              className="flex items-center bg-[#0a0a0a] border-b border-[#1f2937] shrink-0 px-1 py-0.5 font-bold text-neutral-500"
              style={{ fontSize: '0.85em' }}
            >
              <span className="w-7 shrink-0">ROW</span>
              {['CH1', 'CH2', 'CH3', 'CH4'].map((ch, i) => (
                <span
                  key={i}
                  className="flex-1 text-center"
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

                /* Flaches, modernes Styling fuer die Tracker-Zeilen.
                   font-size: inherit → uebernimmt die kachelgroessen-
                   abhaengige clamp-Schrift des Wurzel-Containers. Aktive
                   Zeile bekommt einen dezenten Gruen-Streifen statt des
                   alten Workbench-Blau. */
                .mod-row {
                  font-size: inherit;
                  line-height: 1.35;
                  transition: background-color 0.05s ease;
                }
                .mod-row[data-active="true"] {
                  background-color: rgba(74, 222, 128, 0.14) !important;
                  color: #ffffff !important;
                  box-shadow: inset 2px 0 0 #4ade80;
                }
                .mod-row[data-active="false"] {
                  background-color: transparent !important;
                  color: #2f7d4f !important;
                }

                /* Zeilennummer */
                .mod-row-idx {
                  color: #525252;
                }
                .mod-row[data-active="true"] .mod-row-idx {
                  color: #4ade80 !important;
                }

                /* Notenblock-Container */
                .mod-note-block {
                  color: #1f5135;
                }
                .mod-note-block.has-note {
                  color: #d1fae5;
                }
                .mod-row[data-active="true"] .mod-note-block {
                  color: #ffffff !important;
                }

                /* Notenname */
                .mod-note-name {
                  color: inherit;
                }
                .mod-note-block.has-note .mod-note-name {
                  color: #86efac;
                }
                .mod-row[data-active="true"] .mod-note-name {
                  color: #ffffff !important;
                }

                /* Instrument */
                .mod-inst {
                  color: inherit;
                }
                .mod-inst.has-inst {
                  color: #facc15;
                }
                .mod-row[data-active="true"] .mod-inst {
                  color: #fde047 !important;
                }

                /* Effekt */
                .mod-fx {
                  color: inherit;
                }
                .mod-fx.has-fx {
                  color: #38bdf8;
                }
                .mod-row[data-active="true"] .mod-fx {
                  color: #7dd3fc !important;
                }
              `}</style>
              {loading ? (
                <div className="h-full flex items-center justify-center text-[#38bdf8] animate-pulse">
                  LOADING MODULE...
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
                      <span className="mod-row-idx w-7 shrink-0 font-bold">
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
                <div className="h-full flex items-center justify-center text-red-500 p-2 text-center">
                  LOAD ERROR: {loadError}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600">
                  NO SEQUENCE DATA AVAILABLE
                </div>
              )}
            </div>
          </div>

          {/* ── Sample-Liste (rechts) ────────────────────────────────────── */}
          {!isNarrow && (
            <div
              className="bg-[#0a0a0a] border border-[#1f2937] shrink-0 flex flex-col overflow-hidden rounded"
              style={{ width: '170px' }}
            >
              <div
                className="border-b border-[#1f2937] px-1 py-0.5 text-neutral-500 font-bold text-center"
                style={{ fontSize: '0.85em' }}
              >
                INSTRUMENTS
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-1 bg-black border-b border-[#1f2937]" style={{ fontSize: '0.78em' }}>
                {instrumentsToDisplay.length > 0 ? (
                  instrumentsToDisplay.map((inst, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1"
                      style={{
                        lineHeight: '1.35',
                        color: inst.name ? '#d1fae5' : '#525252',
                      }}
                    >
                      <span className="text-[#38bdf8] font-bold shrink-0">{inst.num}</span>
                      <span className="truncate" title={inst.name}>{inst.name || "---"}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-1 text-neutral-600 text-center">NO INST LOADED</div>
                )}
              </div>

              {/* Status-Anzeige unten */}
              <div
                className="px-1 py-1 flex flex-col gap-0.5 bg-[#0a0a0a]"
                style={{ fontSize: '0.78em' }}
              >
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>STATUS:</span>
                  <span className={playing ? 'text-[#4ade80] font-bold animate-pulse' : 'text-neutral-600'}>
                    {playing ? 'PLAYING' : 'STOPPED'}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>ROW:</span>
                  <span ref={statusRowRef} className="text-neutral-300 tabular-nums">
                    {currentRowRef.current.toString().padStart(2, '0')}/63
                  </span>
                </div>
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>NAME:</span>
                  <span className="text-neutral-300 truncate max-w-[100px]" title={mod?.name}>
                    {mod?.name || '---'}
                  </span>
                </div>
                {/* Fuer User-Uploads gibt es keine Metadaten — Strich anzeigen.
                    ARRANGER nur einblenden, wenn er sich vom Composer unter-
                    scheidet (z. B. Speedball 2: Simon Rogers / Richard Joseph). */}
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>COMPOSER:</span>
                  <span className="text-neutral-300 truncate max-w-[100px]" title={allTracks[trackIdx]?.composer || ''}>
                    {allTracks[trackIdx]?.composer || '—'}
                  </span>
                </div>
                {allTracks[trackIdx]?.arranger && allTracks[trackIdx]?.arranger !== allTracks[trackIdx]?.composer && (
                  <div className="flex justify-between text-neutral-500 font-bold">
                    <span>ARRANGER:</span>
                    <span className="text-neutral-300 truncate max-w-[100px]" title={allTracks[trackIdx]?.arranger || ''}>
                      {allTracks[trackIdx]?.arranger}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>PUBLISHER:</span>
                  <span className="text-neutral-300 truncate max-w-[100px]" title={allTracks[trackIdx]?.publisher || ''}>
                    {allTracks[trackIdx]?.publisher || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-500 font-bold">
                  <span>YEAR:</span>
                  <span className="text-neutral-300 tabular-nums">
                    {allTracks[trackIdx]?.year || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
        )}

        {/* ── Fußzeile ────────────────────────────────────────────────────── */}
        {!isShort && (
          <div
            className="px-1.5 py-0.5 shrink-0 flex items-center justify-between text-neutral-600 font-bold"
            style={{ fontSize: '0.7em' }}
          >
            <span className="truncate">PROTRACKER RENDERER — MUSIC © RESPECTIVE COMPOSERS &amp; PUBLISHERS</span>
            <span className="shrink-0 pl-2">
              {playing ? (
                <span className="text-[#4ade80] animate-pulse">▶ ACTIVE</span>
              ) : (
                <span className="text-neutral-600">■ IDLE</span>
              )}
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default memo(AmiModPanel);
