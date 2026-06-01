// ── Per-Panel-/Per-Stufe-Animationstempo (Speed-System v2) ───────────────────
//
// Das effektive Animationstempo eines Panels hängt von ZWEI Dingen ab:
//   1. dem Panel-Typ (Player / Text / GFX, plus GFX-Sonderfaktoren)
//   2. der aktuell gewählten Auslastungs-Stufe (Dichte: 25 MHz … Proxima)
//
// Regelwerk siehe AGENTS.md → "Panel-Regelwerk" R1. Kurzfassung:
//   - Player (MOD/SID): IMMER 1× — Audio UND Visuals, auf KEINER Stufe anders.
//   - Textpanels:        25 MHz 1× · Turbo/Overdrive 1× · Proxima 2×.
//   - GFX-Panels:        25 MHz 0.5× · Turbo/Overdrive 1× · Proxima = Override
//                        (Default 2×, einzelne Panels schneller — s. Map unten).
//
// Der zentrale `raf-coordinator` liest pro Subscriber `getSpeed(name)` und
// skaliert dessen virtuelle Zeit damit. Panels mit EIGENER Schleife/Timer lesen
// `getSpeed(name)` ebenfalls und multiplizieren ihr dt / teilen ihr Intervall.

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

// ── Panel-Klassifikation ──────────────────────────────────────────────────────

// Player-Panels: Audio + Visuals strikt 1× auf JEDER Stufe. Neue Audio-Panels
// hier ergänzen, dann erben sie die Regel automatisch.
const PLAYER_PANELS = new Set<string>([
  'AmiModPanel',        // MOD / Protracker
  'OscilloscopePanel',  // C64 SID
])

// Textpanels (alle 13). Tempo: 25 MHz/Turbo/Overdrive 1×, Proxima 2×.
const TEXT_PANELS = new Set<string>([
  'SystemLog', 'DataStream', 'Vitals', 'PortScanner', 'PseudoCode',
  'AgentCodePanel', 'VisitorProfilePanel', 'ICQChatPanel', 'DiskCleanupPanel',
  'StockTickerPanel', 'SatellitePanel', 'ClassifiedPanel', 'MetaAgentPanel',
])

// GFX-Sonderfaktoren auf Proxima. Nicht genannte GFX laufen mit Default 2×.
// (Fractal*-Panels werden per Präfix behandelt, s. unten.)
const PROXIMA_GFX_OVERRIDE: Record<string, number> = {
  MandelbulbScene: 16,

  DNAHelix: 8,
  PlasmaDemo: 8,
  TixyPanel: 8,
  IQDigitalStorm: 8,

  ShaderRetroWave: 4,
  LovebyteShowcasePanel: 4,
  MengerSpongeScene: 4,
  TunnelScene: 4,
  FireScene: 4,
  ApollonianGasketScene: 4,
  // ShaderMandelbox bleibt bei 2× (Default) — bewusst nicht hier gelistet.
}

const PROXIMA_GFX_DEFAULT = 2

/**
 * Effektiver Tempo-Faktor für ein Panel auf der aktuellen Dichte-Stufe.
 * @param name Komponentenname (z.B. "MandelbulbScene"). Leer/unbekannt → GFX-Default.
 */
export function getSpeed(name: string): number {
  // Player: immer 1×, egal welche Stufe.
  if (PLAYER_PANELS.has(name)) return 1

  // Textpanels: nur auf Proxima beschleunigt.
  if (TEXT_PANELS.has(name)) {
    return currentDensity === 'proxima' ? 2 : 1
  }

  // Ab hier: GFX-Panels (inkl. unbekannte/leere Namen = GFX-Default).
  switch (currentDensity) {
    case '25mhz':    return 0.5
    case 'turbo':    return 1
    case 'overclock': return 1
    case 'proxima': {
      // Alle Fractal*-Panels: 4×.
      if (name.startsWith('Fractal')) return 4
      return PROXIMA_GFX_OVERRIDE[name] ?? PROXIMA_GFX_DEFAULT
    }
  }
}
