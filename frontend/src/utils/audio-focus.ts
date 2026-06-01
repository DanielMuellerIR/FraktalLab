type AudioFocusListener = (focusedId: string | null) => void;

let currentFocusId: string | null = null;
const listeners = new Set<AudioFocusListener>();

export function getAudioFocus(): string | null {
  return currentFocusId;
}

export function requestAudioFocus(id: string): void {
  if (currentFocusId === id) return;
  currentFocusId = id;
  notifyListeners();
}

export function releaseAudioFocus(id: string): void {
  if (currentFocusId === id) {
    currentFocusId = null;
    notifyListeners();
  }
}

export function resetAudioFocus(): void {
  currentFocusId = null;
  notifyListeners();
}

export function registerAudioFocusListener(listener: AudioFocusListener): () => void {
  listeners.add(listener);
  // Emit immediately on registration
  listener(currentFocusId);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentFocusId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Erst-Klick-Election + zentrale Mute-Steuerung
//
// Audio-Konzept (2026-05-31): Beim ersten Klick irgendwo auf der Seite startet
// GENAU EIN zufällig gewählter Audio-Player ({AllYourBase-Video, SID, MOD}).
// Der Header-AUDIO-Button steuert danach nur noch Mute/Unmute (Pause-Verhalten,
// Position bleibt soweit möglich erhalten). Wenn ein Track natürlich endet
// (Video zu Ende, MOD-Loop-Ende), übernimmt automatisch ein anderer Player.
//
// Die eigentliche Exklusivität (nur ein Player gleichzeitig hörbar) wird weiter
// über den oben definierten Audio-Fokus erzwungen: candidate.start() ruft intern
// requestAudioFocus(), wodurch alle anderen Player sich via Listener stummschalten.
// ─────────────────────────────────────────────────────────────────────────────

// Ein registrierter Audio-Kandidat. Jeder der drei Player meldet sich beim Mount
// mit diesen zwei Callbacks an:
//   start()        — beginnt Wiedergabe eines ZUFÄLLIGEN Songs + holt Audio-Fokus
//   setMuted(m)    — schaltet stumm/laut OHNE den Fokus aufzugeben (Pause-Verhalten)
interface AudioCandidate {
  start: () => void;
  setMuted: (muted: boolean) => void;
}

const candidates = new Map<string, AudioCandidate>();
let activeId: string | null = null;   // welcher Kandidat zuletzt die Election gewann
let firstGestureHandled = false;       // wurde der Erst-Klick schon verarbeitet?
let muted = false;                     // globaler Mute-Zustand (Header-AUDIO-Button)
const muteListeners = new Set<(muted: boolean) => void>();

/**
 * Einen Audio-Player als Election-Kandidaten registrieren. Aufruf beim Mount.
 * Gibt eine Unregister-Funktion für den Cleanup (Unmount) zurück.
 */
export function registerAudioCandidate(id: string, candidate: AudioCandidate): () => void {
  candidates.set(id, candidate);
  return () => {
    candidates.delete(id);
    if (activeId === id) activeId = null;
  };
}

/**
 * Wählt zufällig einen registrierten Kandidaten und startet ihn.
 * @param excludeId  optional: diesen Kandidaten NICHT wählen (für Handoff nach Songende)
 */
function elect(excludeId?: string): void {
  const all = [...candidates.keys()];
  // Bevorzugt einen ANDEREN Player als den gerade beendeten; nur wenn keiner
  // übrig ist, darf derselbe nochmal dran.
  const filtered = all.filter(id => id !== excludeId);
  const pool = filtered.length ? filtered : all;
  if (pool.length === 0) return; // kein Audio-Panel im Layout — bleibt still

  const id = pool[Math.floor(Math.random() * pool.length)];
  activeId = id;
  candidates.get(id)!.start();
}

/**
 * Beim ersten User-Gesten-Event global aufrufen (Click/Touch/Keydown).
 * Idempotent: greift nur beim allerersten Mal.
 */
export function handleFirstGesture(): void {
  if (firstGestureHandled) return;
  firstGestureHandled = true;
  if (!muted) elect();
}

/**
 * Ein Player meldet, dass sein Track natürlich zu Ende ist (Video-Ende,
 * MOD-Loop-Ende). Übergibt die Wiedergabe an einen anderen Player.
 */
export function notifyAudioEnded(id: string): void {
  if (activeId !== id) return;      // nicht der aktive Player → ignorieren
  activeId = null;
  if (!muted) elect(id);            // anderen Player starten (z.B. nach Video → SID/MOD)
}

export function isAudioMuted(): boolean {
  return muted;
}

/** Header-AUDIO-Button. Erst-Klick startet Election, danach Mute-Toggle. */
export function toggleAudioMuted(): void {
  if (!firstGestureHandled) {
    // Allererste Interaktion war der AUDIO-Button selbst → nur starten, nicht muten.
    handleFirstGesture();
    return;
  }
  setAudioMuted(!muted);
}

export function setAudioMuted(nextMuted: boolean): void {
  if (nextMuted === muted) return;
  muted = nextMuted;
  if (activeId) {
    // Aktiven Player stumm/laut schalten (Pause-Verhalten, Fokus bleibt).
    candidates.get(activeId)?.setMuted(muted);
  } else if (!muted && firstGestureHandled) {
    // War stumm und nichts aktiv → beim Entstummen neu elektieren.
    elect();
  }
  muteListeners.forEach(l => l(muted));
}

/** UI (Header-Button) abonniert den Mute-Zustand, um sein Label zu aktualisieren. */
export function registerMuteListener(listener: (muted: boolean) => void): () => void {
  muteListeners.add(listener);
  listener(muted); // sofort aktuellen Stand liefern
  return () => { muteListeners.delete(listener); };
}
