// ── Per-Panel-/Per-Stufe-Animationstempo (Speed-System v2) ───────────────────
//
// Das effektive Animationstempo eines Panels hängt von ZWEI Dingen ab:
//   1. der Panel-Klasse (Player / Text / GFX, plus GFX-Proxima-Faktor)
//   2. der aktuell gewählten Auslastungs-Stufe (Dichte: 25 MHz … Proxima)
//
// WICHTIG: Die Panel-Klassifikation (wer Player/Text/GFX ist, welcher GFX-Faktor
// auf Proxima gilt) wird NICHT hier definiert, sondern zentral in der
// `panel-registry.ts` (Single Source of Truth). Dieses Modul kennt nur noch die
// reine Stufen-Logik und fragt pro Panel `getSpeedInfo(name)` aus der Registry ab.
// So kann eine Tempo-Regel an genau einer Stelle geändert werden.
//
// Regelwerk (siehe AGENTS.md → „Panel-Regelwerk" R1):
//   - Player (MOD/SID):  IMMER 1× — Audio UND Visuals, auf KEINER Stufe anders.
//   - Textpanels:        25 MHz/Turbo/Overdrive 1× · Proxima 2×.
//   - GFX-Panels:        25 MHz 0.5× · Turbo/Overdrive 1× · Proxima = Faktor aus
//                        der Registry (Default 2×, einzelne Panels schneller).

import { getSpeedInfo } from '../panels/panel-registry'

// Dichte-Stufen — identisch zu den Strings in App.tsx (DensityLevel).
export type SpeedDensity = '25mhz' | 'turbo' | 'overclock' | 'proxima'

// Aktuell gewählte Stufe. App.tsx ruft setSpeedDensity() in applyDensity().
let currentDensity: SpeedDensity = 'turbo'

export function setSpeedDensity(level: SpeedDensity) {
  currentDensity = level
}

/**
 * Tempo-Faktor für Textpanels (25 MHz/Turbo/Overdrive 1×, Proxima 2×).
 * Praktisch für intervall-basierte Textpanels: `setInterval(fn, BASE / getTextSpeed())`.
 * Da das Layout bei Dichte-Wechsel neu gebaut wird (Panels re-mounten), greift der
 * Wert beim nächsten Mount automatisch.
 */
export function getTextSpeed(): number {
  return currentDensity === 'proxima' ? 2 : 1
}

/**
 * Effektiver Tempo-Faktor für ein Panel auf der aktuellen Dichte-Stufe.
 * Klassifikation + Proxima-Faktor kommen aus der Registry.
 * @param name Komponentenname (z.B. "MandelbulbScene"). Leer/unbekannt → GFX-Default.
 */
export function getSpeed(name: string): number {
  const { cls, proxima } = getSpeedInfo(name)

  // Player: immer 1×, egal welche Stufe.
  if (cls === 'player') return 1

  // Textpanels: nur auf Proxima beschleunigt.
  if (cls === 'text') return currentDensity === 'proxima' ? 2 : 1

  // GFX-Panels (inkl. unbekannte/leere Namen = GFX-Default).
  switch (currentDensity) {
    case '25mhz':     return 0.5
    case 'turbo':     return 1
    case 'overclock': return 1
    case 'proxima':   return proxima
  }
}
