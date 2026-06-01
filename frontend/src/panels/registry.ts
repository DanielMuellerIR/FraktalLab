// ─────────────────────────────────────────────────────────────────────────────
// Panel-Inventar / Status-Registry
//
// Single source of truth für den *Status* von Panels (aktiv / archiviert / locked).
// Die konkreten Pool-Listen (welches Panel in POOL_GFX / POOL_TEXT) leben noch in
// App.tsx — beim geplanten Galerie-Layout-Redesign wandert das komplett hierher.
//
// "Archiviert" = bewusst deaktiviert, Code bleibt im Repo (Git-History + Panel-
// Dateien) und lässt sich durch Entfernen aus ARCHIVED_PANELS jederzeit wieder
// aktivieren. NICHTS wird gelöscht.
// ─────────────────────────────────────────────────────────────────────────────

// Deaktiviert am 2026-05-31: Dashboard ist reif genug, die reinen Fake-Hacker-
// Text-Panels braucht es nicht mehr. Re-aktivieren = Name hier entfernen UND
// wieder in die Pools/ALL_PANELS in App.tsx aufnehmen.
export const ARCHIVED_PANELS = new Set<string>([
  'NeuralLinkDecoderPanel',
  'BitcoinMinerPanel',
  'SocialEngineering',
  'TrafficMonitor',
  'NuclearTargets',
  'PwdCracker',
  'SupervolcanoPanel',
  // Deaktiviert am 2026-06-01 auf Wunsch des Nutzers.
  'RadarSweepPanel',
  'ThermonuclearWarPanel',
])

// Medien-Panels, die NIE automatisch (Auto-Switch / Layout-Wechsel) verdrängt
// werden dürfen, solange sie laufen — sonst bricht die Wiedergabe mittendrin ab.
// AllYourBase darf erst nach Videoende wechseln (Logik im Panel selbst).
export const LOCKED_PANELS = new Set<string>([
  'OscilloscopePanel', // C64 SID-Player
  'AmiModPanel',       // ProTracker MOD-Player
  'AllYourBase',       // archive.org-Video
])

/** Ist dieses Panel aktuell archiviert (deaktiviert)? */
export function isArchived(name: string): boolean {
  return ARCHIVED_PANELS.has(name)
}

/** Darf dieses Panel automatisch verdrängt werden? */
export function isLocked(name: string): boolean {
  return LOCKED_PANELS.has(name)
}
