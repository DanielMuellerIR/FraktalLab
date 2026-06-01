// ─────────────────────────────────────────────────────────────────────────────
// ZENTRALE PANEL-REGISTRY — Single Source of Truth für ALLE Panel-Regeln
//
// Jede Frage „welches Panel darf was?" wird HIER beantwortet, an genau einer
// Stelle. Alle anderen Module (App.tsx, panel-speed.ts, …) leiten ihre Listen,
// Sets und Maps aus dieser Datei ab — sie definieren NICHTS doppelt. Wer eine
// Regel ändern will, ändert nur den passenden Eintrag in `PANELS`; alle
// abhängigen Stellen werden automatisch korrekt.
//
// Geregelt wird hier:
//   • active        — ist das Panel in der Galerie aktiv? (UNABHÄNGIG von Reviews!
//                     Reviews/Daumen sind nur Notiz-Hilfsmittel des Nutzers und
//                     dürfen NIE über aktiv/inaktiv entscheiden.)
//   • pool          — Text- oder Grafik-Pool
//   • aspect        — Seitenverhältnis-Gruppe (Layout-Matching)
//   • size          — 'prefer-large' (gern groß) / 'no-large' (NIE groß) / 'normal'
//   • gl            — belegt einen WebGL-Kontext? (Kontingent-Deckelung)
//   • audio         — Audio-Player? Davon ist IMMER nur genau EINER gleichzeitig
//                     sichtbar (Auto-Wechsel-Ausschluss) und er ist „locked"
//                     (rotiert nicht automatisch weg).
//   • proximaSpeed  — Tempo-Faktor auf Stufe „Proxima" (nur GFX; Default 2×).
// Größen-Label (Review-Modus) = echte Quell-/Musikgröße aus den auto-generierten
// Dateien (scripts/gen-panel-sizes.mjs + build-audio-manifest.mjs), nicht von Hand.
//
// Reviews (Daumen rauf/runter) sind ein reines Hilfsmittel, um Todos zu übergeben,
// und beeinflussen NICHT, welche Panels aktiv sind oder angezeigt werden.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType } from 'react'
import { memo } from 'react'
// Echte Quell-/Musik-Größen (auto-generiert von scripts/gen-panel-sizes.mjs).
import { PANEL_CODE_BYTES, MOD_MUSIC_BYTES, SID_MUSIC_BYTES } from './panel-sizes.generated'

// ── Text-Panels ──
import SystemLog           from './SystemLog'
import Vitals              from './Vitals'
import DataStream          from './DataStream'
import PortScanner         from './PortScanner'
import PseudoCode          from './PseudoCode'
import AgentCodePanel      from './AgentCodePanel'
import VisitorProfilePanel from './VisitorProfilePanel'
import ICQChatPanel        from './ICQChatPanel'
import DiskCleanupPanel    from './DiskCleanupPanel'
import StockTickerPanel    from './StockTickerPanel'
import SatellitePanel      from './SatellitePanel'
import ClassifiedPanel     from './ClassifiedPanel'
import MetaAgentPanel      from './MetaAgentPanel'
import PwdCracker          from './PwdCracker'

// ── Grafik-Panels ──
import { VoxelDemoColor, VoxelDemoBW } from './VoxelDemo'
import { VoxelThermal, VoxelNeon, VoxelLava, VoxelMatrix } from './VoxelScenes'
import PlasmaDemo        from './PlasmaDemo'
import EnhanceView       from './EnhanceView'
import GlobePanel        from './GlobePanel'
import DaggerfallPanel   from './DaggerfallPanel'
import LidarScanPanel    from './LidarScanPanel'
import DNAHelix          from './DNAHelix'
import OscilloscopePanel from './OscilloscopePanel'
import {
  FireScene, StarfieldScene, TunnelScene, RotozoomScene,
  MetaballsScene, DotCloudScene, ThreeBodyScene, LissajousScene,
} from './DemoScenes'
import ParallaxPanel     from './ParallaxPanel'
import ElitePanel        from './ElitePanel'
import AmiModPanel       from './AmiModPanel'
import CADRobotPanel     from './CADRobotPanel'
import C64Panel          from './C64Panel'
import RetroErrorPanel   from './RetroErrorPanel'
import SolarSystemPanel  from './SolarSystemPanel'
import RadarSweepPanel   from './RadarSweepPanel'
import FractalView       from './FractalView'
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalSatellite, FractalTendril, FractalDragon,
  FractalDendrite, FractalSwirl,
} from './FractalScenes'
import FractalJulia from './FractalJulia'
import { ShaderHackingCore, ShaderMandelbox, ShaderRetroWave } from './ShadertoyPanel'
import { TixyPanel } from './TixyPanel'
import { IQSmoothMin, IQDigitalStorm } from './IQTechniquePanel'
import { LovebyteShowcasePanel } from './LovebyteShowcasePanel'
import MoonPanel from './MoonPanel'
import PhysicsSandboxPanel from './PhysicsSandboxPanel'
import NuclearExplosionPanel from './NuclearExplosionPanel'
import ThermonuclearWarPanel from './ThermonuclearWarPanel'
import { MandelbulbScene, ApollonianGasketScene, MengerSpongeScene } from './DEFractalScenes'

// ── Typen ────────────────────────────────────────────────────────────────────

// Seitenverhältnis-Gruppe einer Kachel/eines Panels. ANY passt überall, TEXT ist
// flexibel und wird nie groß skaliert.
export type Aspect = 'WIDE' | 'SQUARE' | 'TALL' | 'ANY' | 'TEXT'

// Größen-Politik: ob ein Panel groß (mehrere Zellen) dargestellt werden darf.
//   'prefer-large' = soll groß gezeigt werden, wenn möglich
//   'no-large'     = NIE groß (zu unspektakulär / Layout-Gründe)
//   'normal'       = darf groß sein, wird aber nicht bevorzugt
type SizePolicy = 'prefer-large' | 'no-large' | 'normal'

export interface PanelDef {
  name: string
  Component: ComponentType<any>
  /** Aktiv in der Galerie? UNABHÄNGIG von Reviews. */
  active: boolean
  pool: 'text' | 'gfx'
  aspect: Aspect
  size: SizePolicy
  /** Belegt einen WebGL-Kontext (zählt gegen das GL-Kontingent). */
  gl: boolean
  /** Audio-Player — davon immer nur EINER gleichzeitig sichtbar + locked. */
  audio: boolean
  /** Tempo-Faktor auf Stufe „Proxima" (nur GFX relevant; Default 2). */
  proximaSpeed: number
}

// Roh-Eintrag: nur die abweichenden Felder angeben, der Rest wird unten mit
// sinnvollen Defaults aufgefüllt (normalize()).
interface RawPanel {
  name: string
  Component: ComponentType<any>
  pool: 'text' | 'gfx'
  aspect: Aspect
  active?: boolean        // Default: true
  size?: SizePolicy       // Default: 'normal'
  gl?: boolean            // Default: false
  audio?: boolean         // Default: false
  proximaSpeed?: number   // Default: 2 (GFX). Audio/Text ignorieren den Wert.
}

function normalize(r: RawPanel): PanelDef {
  return {
    name: r.name,
    Component: memo(r.Component) as ComponentType<any>,
    active: r.active ?? true,
    pool: r.pool,
    aspect: r.aspect,
    size: r.size ?? 'normal',
    gl: r.gl ?? false,
    audio: r.audio ?? false,
    proximaSpeed: r.proximaSpeed ?? 2,
  }
}

// ── DIE REGISTRY ───────────────────────────────────────────────────────────────
// Reihenfolge = Anzeige-Reihenfolge im Review-Modus (zuletzt überarbeitete oben).
const RAW: RawPanel[] = [
  // ── Zuletzt überarbeitete / hervorgehobene Panels ──
  { name: 'MetaAgentPanel',        Component: MetaAgentPanel,        pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'FractalJulia',          Component: FractalJulia,          pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'C64Panel',              Component: C64Panel,              pool: 'gfx',  aspect: 'SQUARE', size: 'no-large' },
  { name: 'FractalSeahorse',       Component: FractalSeahorse,       pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalSpiral',         Component: FractalSpiral,         pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalTendril',        Component: FractalTendril,        pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalLightning',      Component: FractalLightning,      pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalElephant',       Component: FractalElephant,       pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalMini',           Component: FractalMini,           pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalSatellite',      Component: FractalSatellite,      pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalDragon',         Component: FractalDragon,         pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalDendrite',       Component: FractalDendrite,       pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'FractalSwirl',          Component: FractalSwirl,          pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'AmiModPanel',           Component: AmiModPanel,           pool: 'gfx',  aspect: 'SQUARE', audio: true },
  { name: 'SolarSystemPanel',      Component: SolarSystemPanel,      pool: 'gfx',  aspect: 'SQUARE', size: 'prefer-large' },
  { name: 'FractalView',           Component: FractalView,          pool: 'gfx',  aspect: 'ANY',  gl: true }, // Fraktal-Hintergrund + wählbares GFX-Panel (aktiv)

  // ── Übrige Grafik-Panels ──
  { name: 'ThreeBodyScene',        Component: ThreeBodyScene,        pool: 'gfx',  aspect: 'SQUARE', gl: true },
  { name: 'FireScene',             Component: FireScene,             pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'LissajousScene',        Component: LissajousScene,        pool: 'gfx',  aspect: 'ANY',  gl: true, active: false }, // aktuell nicht im Pool
  { name: 'TunnelScene',           Component: TunnelScene,           pool: 'gfx',  aspect: 'SQUARE', gl: true, proximaSpeed: 4 },
  { name: 'RotozoomScene',         Component: RotozoomScene,         pool: 'gfx',  aspect: 'ANY',  gl: true },
  { name: 'PlasmaDemo',            Component: PlasmaDemo,            pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 8 },
  { name: 'EnhanceView',           Component: EnhanceView,           pool: 'gfx',  aspect: 'WIDE', size: 'no-large' },
  { name: 'VoxelDemoColor',        Component: VoxelDemoColor,        pool: 'gfx',  aspect: 'WIDE', gl: true },
  { name: 'VoxelDemoBW',           Component: VoxelDemoBW,            pool: 'gfx',  aspect: 'WIDE', gl: true },
  { name: 'GlobePanel',            Component: GlobePanel,            pool: 'gfx',  aspect: 'SQUARE', gl: true },
  { name: 'VoxelThermal',          Component: VoxelThermal,          pool: 'gfx',  aspect: 'WIDE', gl: true },
  { name: 'VoxelLava',             Component: VoxelLava,             pool: 'gfx',  aspect: 'WIDE', gl: true },
  { name: 'VoxelNeon',             Component: VoxelNeon,             pool: 'gfx',  aspect: 'SQUARE', gl: true },
  { name: 'VoxelMatrix',           Component: VoxelMatrix,           pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 }, // = MengerSpongeScene-Alias
  { name: 'StarfieldScene',        Component: StarfieldScene,        pool: 'gfx',  aspect: 'WIDE', gl: true },
  { name: 'OscilloscopePanel',     Component: OscilloscopePanel,     pool: 'gfx',  aspect: 'WIDE', audio: true },
  { name: 'MetaballsScene',        Component: MetaballsScene,        pool: 'gfx',  aspect: 'SQUARE', gl: true },
  { name: 'DotCloudScene',         Component: DotCloudScene,         pool: 'gfx',  aspect: 'SQUARE', gl: true },
  // AllYourBase (archive.org-Video) am 2026-06-01 entfernt: nur per nicht-steuerbarem
  // iframe rechtlich sauber einbindbar → unvereinbar mit Audio-Election/Mute/Handoff.
  { name: 'ParallaxPanel',         Component: ParallaxPanel,         pool: 'gfx',  active: false, aspect: 'WIDE' },
  { name: 'ElitePanel',            Component: ElitePanel,            pool: 'gfx',  aspect: 'WIDE', size: 'prefer-large' },
  { name: 'CADRobotPanel',         Component: CADRobotPanel,         pool: 'gfx',  aspect: 'WIDE', size: 'no-large', gl: true },
  { name: 'RetroErrorPanel',       Component: RetroErrorPanel,       pool: 'gfx',  aspect: 'WIDE' },
  { name: 'RadarSweepPanel',       Component: RadarSweepPanel,       pool: 'gfx',  aspect: 'SQUARE', active: false }, // deaktiviert 2026-06-01
  { name: 'DNAHelix',              Component: DNAHelix,              pool: 'gfx',  aspect: 'ANY',  size: 'prefer-large', proximaSpeed: 8 },
  { name: 'ShaderHackingCore',     Component: ShaderHackingCore,     pool: 'gfx',  aspect: 'SQUARE', size: 'no-large', gl: true },
  { name: 'ShaderMandelbox',       Component: ShaderMandelbox,       pool: 'gfx',  aspect: 'ANY',  gl: true }, // Default 2×
  { name: 'ShaderRetroWave',       Component: ShaderRetroWave,       pool: 'gfx',  aspect: 'ANY',  size: 'prefer-large', gl: true, proximaSpeed: 4 },
  { name: 'DaggerfallPanel',       Component: DaggerfallPanel,       pool: 'gfx',  active: false, aspect: 'WIDE' },
  { name: 'LidarScanPanel',        Component: LidarScanPanel,        pool: 'gfx',  aspect: 'ANY' },
  { name: 'TixyPanel',             Component: TixyPanel,             pool: 'gfx',  aspect: 'SQUARE', gl: true, proximaSpeed: 8 },
  { name: 'IQSmoothMin',           Component: IQSmoothMin,           pool: 'gfx',  aspect: 'ANY',  gl: true },
  { name: 'IQDigitalStorm',        Component: IQDigitalStorm,        pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 8 },
  { name: 'LovebyteShowcasePanel', Component: LovebyteShowcasePanel, pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'MoonPanel',             Component: MoonPanel,             pool: 'gfx',  aspect: 'SQUARE', size: 'prefer-large', gl: true },
  { name: 'PhysicsSandboxPanel',   Component: PhysicsSandboxPanel,   pool: 'gfx',  aspect: 'WIDE' },
  { name: 'NuclearExplosionPanel', Component: NuclearExplosionPanel, pool: 'gfx',  aspect: 'TALL', size: 'prefer-large', gl: true },
  { name: 'ThermonuclearWarPanel', Component: ThermonuclearWarPanel, pool: 'gfx',  aspect: 'WIDE', active: false }, // deaktiviert 2026-06-01
  { name: 'MandelbulbScene',       Component: MandelbulbScene,       pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 16 },
  { name: 'ApollonianGasketScene', Component: ApollonianGasketScene, pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },
  { name: 'MengerSpongeScene',     Component: MengerSpongeScene,     pool: 'gfx',  aspect: 'ANY',  gl: true, proximaSpeed: 4 },

  // ── Text-Panels ──
  { name: 'ICQChatPanel',          Component: ICQChatPanel,          pool: 'text', aspect: 'TEXT' },
  { name: 'VisitorProfilePanel',   Component: VisitorProfilePanel,   pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'SatellitePanel',        Component: SatellitePanel,        pool: 'text', aspect: 'TEXT', size: 'no-large' },
  { name: 'SystemLog',             Component: SystemLog,             pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'DataStream',            Component: DataStream,            pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'Vitals',                Component: Vitals,                pool: 'text', aspect: 'TEXT', size: 'no-large' },
  { name: 'PortScanner',           Component: PortScanner,           pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'PseudoCode',            Component: PseudoCode,            pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'AgentCodePanel',        Component: AgentCodePanel,        pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'DiskCleanupPanel',      Component: DiskCleanupPanel,      pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'StockTickerPanel',      Component: StockTickerPanel,      pool: 'text', active: false, aspect: 'TEXT' },
  { name: 'ClassifiedPanel',       Component: ClassifiedPanel,       pool: 'text', aspect: 'TEXT', size: 'no-large' },
  { name: 'PwdCracker',            Component: PwdCracker,            pool: 'text', aspect: 'TEXT', size: 'no-large' }, // reaktiviert 2026-06-01
]

/** Die vollständige Registry — eine Wahrheit für alle Panel-Fragen. */
export const PANELS: PanelDef[] = RAW.map(normalize)

// ── Schnellzugriff-Indizes ─────────────────────────────────────────────────────
const BY_NAME = new Map<string, PanelDef>(PANELS.map(p => [p.name, p]))

// Komponente → Name. Nötig, weil memo()-Wrapper den Funktionsnamen verlieren.
const COMPONENT_NAMES = new Map<any, string>()
function getBaseComponent(Comp: any): any {
  if (!Comp) return null
  let current = Comp
  while (current && typeof current === 'object') {
    if (current.type) current = current.type
    else break
  }
  return current
}
PANELS.forEach(p => {
  const base = getBaseComponent(p.Component)
  if (base) COMPONENT_NAMES.set(base, p.name)
})

/** Liefert den stabilen Panel-Namen zu einer (ggf. memo-gewrappten) Komponente. */
export function getCompName(Comp: any): string {
  const base = getBaseComponent(Comp)
  if (!base) return ''
  const name = COMPONENT_NAMES.get(base)
  if (name) return name
  if (typeof base === 'function') return base.name || ''
  if (typeof base === 'string') return base
  return ''
}

/** Panel-Definition per Name (oder undefined). */
export function getPanelDef(name: string): PanelDef | undefined {
  return BY_NAME.get(name)
}

// ── Abgeleitete Listen / Helfer (NICHTS hiervon doppelt definieren!) ───────────

/** Vollständige Liste für den Review-Modus (aktiv + inaktiv, in Registry-Reihenfolge). */
export const ALL_PANELS: { name: string; Component: ComponentType<any> }[] =
  PANELS.map(p => ({ name: p.name, Component: p.Component }))

/** Ist das Panel aktiv (in der Galerie nutzbar)? UNABHÄNGIG von Reviews. */
export function isActive(name: string): boolean {
  return BY_NAME.get(name)?.active ?? false
}

/** Aktive Komponenten des jeweiligen Pools (Reihenfolge = Registry-Reihenfolge). */
export const POOL_TEXT: ComponentType<any>[] =
  PANELS.filter(p => p.active && p.pool === 'text').map(p => p.Component)
export const POOL_GFX: ComponentType<any>[] =
  PANELS.filter(p => p.active && p.pool === 'gfx').map(p => p.Component)

/** Seitenverhältnis eines Panels (Default ANY, falls unbekannt). */
export function panelAspect(name: string): Aspect {
  return BY_NAME.get(name)?.aspect ?? 'ANY'
}

/** Audio-Player? Davon ist immer nur EINER gleichzeitig sichtbar. */
export function isAudioPanel(name: string): boolean {
  return BY_NAME.get(name)?.audio ?? false
}
/** Namen aller Audio-Player. */
export const AUDIO_PANELS = new Set<string>(PANELS.filter(p => p.audio).map(p => p.name))

/** „Locked" = darf nicht automatisch wegrotieren. Gilt für die Audio-Player. */
export function isLocked(name: string): boolean {
  return isAudioPanel(name)
}

/** Belegt einen WebGL-Kontext? */
export function isGLPanel(name: string): boolean {
  return BY_NAME.get(name)?.gl ?? false
}

// Sicherheitspuffer unter MAX_GL_CONTEXTS (12, siehe utils/webgl-pool.ts): das
// Fraktal-Hintergrundbild (FractalView) belegt selbst einen Kontext → max. 11.
export const MAX_GL_PANELS_PER_LAYOUT = 11

/** Darf das Panel groß (mehrere Zellen) dargestellt werden? */
export function panelMayBeLarge(name: string): boolean {
  const def = BY_NAME.get(name)
  if (!def) return false
  if (def.size === 'no-large') return false
  if (def.size === 'prefer-large') return true
  // 'normal': groß erlaubt, außer reine TEXT-Panels.
  return def.aspect !== 'TEXT'
}

/** Soll das Panel bevorzugt groß gezeigt werden? */
export function panelPrefersLarge(name: string): boolean {
  return BY_NAME.get(name)?.size === 'prefer-large'
}

/** Bytes → "KB"/"MB"-String. */
function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/**
 * Größen-Label fürs Review-Panel: echte Quell-Größe (Code) des Panels.
 * Werte stammen aus panel-sizes.generated.ts (Skript gen-panel-sizes.mjs).
 * Die beiden Player zeigen ZWEI Werte: Code allein / Code + Musikdateien,
 * z.B. "89 KB / 1.1 MB". Die Musikgröße ist dynamisch aus den Dateien berechnet.
 */
export function panelAssetLabel(name: string): string {
  const code = PANEL_CODE_BYTES[name] ?? 0
  if (name === 'AmiModPanel') return `${fmtBytes(code)} / ${fmtBytes(code + MOD_MUSIC_BYTES)}`
  if (name === 'OscilloscopePanel') return `${fmtBytes(code)} / ${fmtBytes(code + SID_MUSIC_BYTES)}`
  return fmtBytes(code)
}

// ── Tempo-Daten für panel-speed.ts bereitstellen ──────────────────────────────
// Damit das Speed-System die Tempo-Regeln NICHT erneut definieren muss, exportiert
// die Registry pro Panel seine Speed-Klasse + den Proxima-Faktor. panel-speed.ts
// liest das (über getSpeedInfo) und braucht selbst keine Panel-Listen mehr.
export type SpeedClass = 'player' | 'text' | 'gfx'

export function getSpeedInfo(name: string): { cls: SpeedClass; proxima: number } {
  const def = BY_NAME.get(name)
  if (!def) return { cls: 'gfx', proxima: 2 }   // Unbekannt → GFX-Default
  const cls: SpeedClass = def.audio ? 'player' : def.pool === 'text' ? 'text' : 'gfx'
  return { cls, proxima: def.proximaSpeed }
}
