import React, { useState, useEffect, useCallback, useRef, memo } from 'react'
import PanelSlot     from './ui/PanelSlot'
import { isArchived } from './panels/registry'
import FractalView   from './panels/FractalView'
import GlitchOverlay from './ui/GlitchOverlay'
import Panel         from './ui/Panel'
import { getSharedAudioContext } from './utils/shared-audio'
import { setPaused, setTimeScale } from './utils/raf-coordinator'

// ── Text-Panels ───────────────────────────────────────────────────────────────
import SystemLog         from './panels/SystemLog'
import Vitals            from './panels/Vitals'
import DataStream        from './panels/DataStream'
import PortScanner       from './panels/PortScanner'
import PseudoCode        from './panels/PseudoCode'
import AgentCodePanel    from './panels/AgentCodePanel'
import VisitorProfilePanel from './panels/VisitorProfilePanel'
import ICQChatPanel      from './panels/ICQChatPanel'
import DiskCleanupPanel  from './panels/DiskCleanupPanel'
// Archiviert 2026-05-31 (siehe panels/registry.ts ARCHIVED_PANELS):
// TrafficMonitor, SocialEngineering, NuclearTargets, PwdCracker, BitcoinMinerPanel
import StockTickerPanel  from './panels/StockTickerPanel'
import SatellitePanel    from './panels/SatellitePanel'
import ClassifiedPanel   from './panels/ClassifiedPanel'
import MetaAgentPanel    from './panels/MetaAgentPanel'


// ── Grafik-Panels ─────────────────────────────────────────────────────────────
import { VoxelDemoColor, VoxelDemoBW } from './panels/VoxelDemo'
import { VoxelThermal, VoxelNeon, VoxelLava, VoxelMatrix } from './panels/VoxelScenes'

import PlasmaDemo        from './panels/PlasmaDemo'
import EnhanceView       from './panels/EnhanceView'
import AllYourBase       from './panels/AllYourBase'
import GlobePanel        from './panels/GlobePanel'
import DaggerfallPanel   from './panels/DaggerfallPanel'
import LidarScanPanel    from './panels/LidarScanPanel'
// NeuralLinkDecoderPanel archiviert 2026-05-31 (siehe panels/registry.ts)
import DNAHelix          from './panels/DNAHelix'
import OscilloscopePanel from './panels/OscilloscopePanel'
import {
  FireScene, StarfieldScene, TunnelScene, RotozoomScene,
  MetaballsScene, DotCloudScene, ThreeBodyScene, LissajousScene,
} from './panels/DemoScenes'
import ParallaxPanel     from './panels/ParallaxPanel'
import ElitePanel        from './panels/ElitePanel'
import AmiModPanel       from './panels/AmiModPanel'
import CADRobotPanel     from './panels/CADRobotPanel'
import C64Panel          from './panels/C64Panel'
import RetroErrorPanel   from './panels/RetroErrorPanel'
import SolarSystemPanel  from './panels/SolarSystemPanel'
import RadarSweepPanel   from './panels/RadarSweepPanel'
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalSatellite, FractalTendril, FractalDragon,
  FractalDendrite, FractalSwirl,
} from './panels/FractalScenes'
import FractalJulia from './panels/FractalJulia'
import { ShaderHackingCore, ShaderMandelbox, ShaderRetroWave } from './panels/ShadertoyPanel'
import { TixyPanel } from './panels/TixyPanel'
import { IQSmoothMin, IQDigitalStorm } from './panels/IQTechniquePanel'
import { LovebyteShowcasePanel } from './panels/LovebyteShowcasePanel'
import {
  getAudioFocus,
  resetAudioFocus,
  handleFirstGesture,
  toggleAudioMuted,
  isAudioMuted,
  registerMuteListener,
} from './utils/audio-focus'
import MoonPanel from './panels/MoonPanel'
import PhysicsSandboxPanel from './panels/PhysicsSandboxPanel'
import NuclearExplosionPanel from './panels/NuclearExplosionPanel'
import ThermonuclearWarPanel from './panels/ThermonuclearWarPanel'
import { MandelbulbScene, ApollonianGasketScene, MengerSpongeScene } from './panels/DEFractalScenes'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
const POOL_TEXT: React.ComponentType[] = [
  SystemLog, DataStream, Vitals, PortScanner, PseudoCode,
  AgentCodePanel, VisitorProfilePanel, ICQChatPanel, DiskCleanupPanel,
  StockTickerPanel, SatellitePanel, ClassifiedPanel, MetaAgentPanel,
]

// Alle visuellen Panels in einem Pool — AllYourBase und EnhanceView sind normale Einträge
const POOL_GFX: React.ComponentType[] = [
  VoxelDemoColor, VoxelDemoBW, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,

  FireScene, StarfieldScene, ThreeBodyScene, /* LissajousScene, */
  OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
  PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
  ParallaxPanel, ElitePanel, AmiModPanel, CADRobotPanel, C64Panel, RetroErrorPanel, SolarSystemPanel,
  FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
  FractalElephant, FractalMini, FractalSatellite, FractalDragon,
  FractalDendrite, FractalSwirl,
  FractalJulia, RadarSweepPanel,
  ShaderHackingCore, ShaderMandelbox, ShaderRetroWave,
  DaggerfallPanel, LidarScanPanel,
  TixyPanel, IQSmoothMin, IQDigitalStorm, LovebyteShowcasePanel,
  MoonPanel, PhysicsSandboxPanel, NuclearExplosionPanel,
  ThermonuclearWarPanel,
  MandelbulbScene, ApollonianGasketScene, MengerSpongeScene,
]

POOL_TEXT.forEach((Comp, idx) => {
  POOL_TEXT[idx] = memo(Comp) as any
})

POOL_GFX.forEach((Comp, idx) => {
  POOL_GFX[idx] = memo(Comp) as any
})


// ── Zufallslayout-Generator ───────────────────────────────────────────────────

type CellType = 'fractal' | 'text' | 'gfx'

interface GridCell {
  type:       CellType
  gridColumn: string  // CSS-Wert, z.B. "1 / 3"
  gridRow:    string  // CSS-Wert, z.B. "1 / 2"
  panelIdx?:  number
}

interface GeneratedLayout {
  id:                  number   // aufsteigender Zähler für React-Keys
  gridTemplateColumns: string   // z.B. "28fr 44fr 28fr"
  gridTemplateRows:    string   // z.B. "60fr 40fr"
  cells:               GridCell[]
}

function generateMobileIndices(reviews: ReviewEntry[]): { textIdx: number; gfxIdx1: number; gfxIdx2: number; gfxIdx3: number } {
  const { textPool, gfxPool } = getFilteredPools(reviews)
  const textIndices = getWeightedIndices(textPool, reviews)
  const gfxIndices = getWeightedIndices(gfxPool, reviews)

  // Drei gfx-Slots vorbelegen.
  const gfx = [gfxIndices[0] ?? 0, gfxIndices[1] ?? 0, gfxIndices[2] ?? 0]

  // Audio-Garantie (wie im Desktop-Layout): genau ein Audio-Panel muss vorhanden
  // sein, damit die Erst-Klick-Election einen Player starten kann.
  const isAudio = (idx?: number) =>
    idx != null && AUDIO_PANELS.has(getCompName(gfxPool[idx]))
  if (!gfx.some(isAudio)) {
    const audioIdx = gfxIndices.find(isAudio)
    // audioIdx ist garantiert verschieden von gfx[*] (keiner davon war Audio).
    if (audioIdx != null) gfx[2] = audioIdx
  }

  return {
    textIdx: textIndices[0] ?? 0,
    gfxIdx1: gfx[0],
    gfxIdx2: gfx[1],
    gfxIdx3: gfx[2],
  };
}

/**
 * Teilt 100 in n positive Ganzzahlen auf, jede mindestens minPct.
 * Balanciert durch leicht verrauschte Gleichverteilung.
 */
function randomPartition(n: number): number[] {
  // Balanced weights
  const raw = Array.from({ length: n }, () => 0.8 + Math.random() * 0.4)
  const sum  = raw.reduce((a, b) => a + b, 0)
  
  // Mindestgröße je nach Anzahl der Partitionen, um extrem schmale Spalten/Zeilen zu verhindern
  let minPct = 15
  if (n === 2) minPct = 45
  else if (n === 3) minPct = 30
  else if (n === 4) minPct = 22
  else if (n === 5) minPct = 18
  else if (n === 6) minPct = 15
  else if (n === 7) minPct = 13
  else if (n >= 8) minPct = 11

  // Start with normalized values capped at minPct
  const result = raw.map(v => Math.max(minPct, Math.round(v * 100 / sum)))
  
  // Adjust sum to exactly 100 without violating minPct
  let currentSum = result.reduce((a, b) => a + b, 0)
  let attempts = 0
  while (currentSum !== 100 && attempts < 100) {
    attempts++
    const diff = 100 - currentSum
    if (diff > 0) {
      // Add 1 to the smallest element
      let minIdx = 0
      for (let i = 1; i < n; i++) {
        if (result[i] < result[minIdx]) minIdx = i
      }
      result[minIdx]++
      currentSum++
    } else {
      // Subtract 1 from the largest element, as long as it stays >= minPct
      let maxIdx = 0
      for (let i = 1; i < n; i++) {
        if (result[i] > result[maxIdx]) maxIdx = i
      }
      if (result[maxIdx] - 1 >= minPct) {
        result[maxIdx]--
        currentSum--
      } else {
        // Can't subtract without violating minPct, break to avoid infinite loop
        break
      }
    }
  }
  return result
}

const LARGE_PANELS = new Set([
  'ElitePanel',
  'SolarSystemPanel',
  'DNAHelix',
  'CADRobotPanel',
  'ShaderRetroWave',
  'NuclearExplosionPanel',
  'MoonPanel',
]);

// Die drei Audio-Player. Genau einer davon muss in jedem Layout vorhanden sein
// (Audio-Garantie in generateLayout) — Erst-Klick-Election wählt einen aus.
const AUDIO_PANELS = new Set<string>([
  'AllYourBase',       // archive.org-Video
  'OscilloscopePanel', // C64 SID-Player
  'AmiModPanel',       // ProTracker MOD-Player
])

// Geschätzte Asset-Größe pro Panel in KB (im Reviewmodus angezeigt). Die meisten
// Panels sind rein prozedural (Canvas/Shader, KEIN Asset) → 0 KB. Nur die
// Medien-Panels laden Dateien. Werte von der Platte gemessen (frontend/public/),
// Stand 2026-05-31 — bei Asset-Änderungen hier aktualisieren.
const PANEL_ASSET_KB: Record<string, number> = {
  AmiModPanel:       1253, // 12 ProTracker-MOD-Module
  OscilloscopePanel:   30, // 3 SID-Tunes (C64)
  EnhanceView:        344, // urbane Stadtfotos
  C64Panel:             7, // c64_font.png
  AllYourBase:          0, // Video extern gestreamt (archive.org) → 0 lokal
}

/** Menschlich lesbares Größen-Label fürs Review-Panel. */
function panelAssetLabel(name: string): string {
  const kb = PANEL_ASSET_KB[name] ?? 0
  if (kb === 0) return '0 KB · prozedural'
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}

const COMPONENT_NAMES = new Map<any, string>()

function getBaseComponent(Comp: any): any {
  if (!Comp) return null
  let current = Comp
  while (current && typeof current === 'object') {
    if (current.type) {
      current = current.type
    } else {
      break
    }
  }
  return current
}

function getCompName(Comp: any): string {
  const base = getBaseComponent(Comp)
  if (!base) return ''

  const name = COMPONENT_NAMES.get(base)
  if (name) return name

  if (typeof base === 'function') {
    return base.name || ''
  }
  if (typeof base === 'string') {
    return base
  }
  return ''
}

function isCellLarge(cell: GridCell): boolean {
  if (cell.type !== 'gfx') return false;
  const colParts = cell.gridColumn.split('/').map(s => parseInt(s.trim(), 10));
  const rowParts = cell.gridRow.split('/').map(s => parseInt(s.trim(), 10));
  const colSpan = colParts[1] - colParts[0];
  const rowSpan = rowParts[1] - rowParts[0];
  return colSpan > 1 || rowSpan > 1;
}

/**
 * Erzeugt ein vollständig zufälliges CSS-Grid-Layout.
 * @param id Eindeutiger Zähler — wird als React-Key verwendet
 */
function generateLayout(id: number, reviews: ReviewEntry[], targetCellCount?: number): GeneratedLayout {
  // 1. Gittergröße: cols × rows basierend auf der Bildschirmbreite
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200
  let sizes: [number, number][]

  // Layout-V2 (Density): targetCellCount überschreibt die breitenbasierte Auto-
  // Wahl mit einer FESTEN Ziel-Kachelzahl pro Auslastungs-Stufe. Statt aus festen
  // Grid-Kandidaten zu wählen (die die Höchstzahl an die Breite koppelten und z.B.
  // Proxima ~30 auf Laptops verhinderten), leiten wir cols×rows direkt aus dem Ziel
  // und dem Bildschirm-Seitenverhältnis ab. So sind auch hohe Stufen auf jedem
  // Display erreichbar.
  if (targetCellCount != null) {
    const height = typeof window !== 'undefined' ? window.innerHeight : 800
    const ratio = Math.max(0.5, width / Math.max(1, height))   // Querformat → >1

    // Auf die Zahl TATSÄCHLICH verfügbarer Distinct-Panels deckeln, damit nie
    // Duplikate nötig werden. Down-gevotete Panels (Review) verkleinern den Pool
    // → die Dichte passt sich automatisch nach unten an. Platzierbar sind: GL-
    // Panels nur bis zum WebGL-Kontingent, dazu alle Nicht-GL-GFX + alle TEXT +
    // die eine Fraktal-Zelle.
    const { textPool: tp, gfxPool: gp } = getFilteredPools(reviews)
    let glAvail = 0, nonGlAvail = 0
    gp.forEach(c => { if (isGLPanel(getCompName(c))) glAvail++; else nonGlAvail++ })
    const maxDistinct = Math.min(glAvail, MAX_GL_PANELS_PER_LAYOUT) + nonGlAvail + tp.length + 1
    const eff = Math.max(2, Math.min(targetCellCount, maxDistinct))

    // cols ~ sqrt(N · ratio). WICHTIG: cRows per FLOOR, damit cols×rows NIE über
    // eff (= verfügbare Distinct-Panels) steigt → sonst entstehen Löcher (zu viele
    // Zellen für zu wenige Panels). Lieber 1–2 Kacheln weniger als ein leeres Loch.
    let cCols = Math.round(Math.sqrt(eff * ratio))
    cCols = Math.min(8, Math.max(2, cCols))
    let cRows = Math.max(1, Math.floor(eff / cCols))
    cRows = Math.min(6, cRows)
    // Falls cols×rows durch die Caps doch noch > eff: Spalten reduzieren.
    while (cCols > 2 && cCols * cRows > eff) cCols--
    sizes = [[cCols, cRows]]
  } else if (width >= 3440) {
    // Ultra-wide / sehr große Entwickler-Bildschirme
    sizes = [[5, 3], [5, 4], [6, 4]]
  } else if (width >= 2560) {
    // QHD / 4K Bildschirme
    sizes = [[4, 3], [4, 4]]
  } else if (width >= 1920) {
    // Full HD / größere Monitore
    sizes = [[3, 3], [4, 3]]
  } else if (width >= 1440) {
    // QHD Laptop / mittlere Monitore
    sizes = [[3, 2], [3, 3]]
  } else if (width >= 1024) {
    // Standard Desktop / Tablet im Querformat
    sizes = [[2, 2], [3, 2]]
  } else {
    // Kleine Desktops / Tablet im Hochformat (ab 768px)
    sizes = [[2, 2]]
  }
  const [cols, rows] = sizes[Math.floor(Math.random() * sizes.length)]

  // 2. Spalten- und Zeilenbreiten als fr-Einheiten
  const colWidths = randomPartition(cols)
  const rowHeights = randomPartition(rows)
  const gridTemplateColumns = colWidths.map(w => `${w}fr`).join(' ')
  const gridTemplateRows    = rowHeights.map(h => `${h}fr`).join(' ')

  // 3. Fraktal-Zelle platzieren — ggf. mit Span
  const totalCells = cols * rows

  // Startposition: zufällige Zelle (0-basierter Index → col/row berechnen)
  const startIdx = Math.floor(Math.random() * totalCells)
  const startCol  = (startIdx % cols) + 1   // 1-basiert für CSS
  const startRow  = Math.floor(startIdx / cols) + 1

  // Span bestimmen: maximal 2 in einer Richtung, nicht mehr als 50% aller Zellen
  let colSpan = 1
  let rowSpan = 1

  const tryColSpan = cols >= 3 && Math.random() < 0.4
  const tryRowSpan = rows >= 3 && Math.random() < 0.4 && !tryColSpan

  if (tryColSpan && startCol + 1 <= cols && colSpan * rowSpan * 2 <= totalCells / 2) {
    colSpan = 2
  }
  if (tryRowSpan && startRow + 1 <= rows && colSpan * rowSpan * 2 <= totalCells / 2) {
    rowSpan = 2
  }

  // Sicherstellen, dass der Span nicht über den Rand geht
  let endCol = Math.min(startCol + colSpan, cols + 1)
  let endRow = Math.min(startRow + rowSpan, rows + 1)
  let actualColSpan = endCol - startCol
  let actualRowSpan = endRow - startRow

  // Sicherheitscheck: nie weniger als 3 Panels (d.h. freie Zellen >= 2)
  while (cols * rows - (actualColSpan * actualRowSpan) < 2) {
    if (actualColSpan > 1) {
      actualColSpan--
      endCol--
    } else if (actualRowSpan > 1) {
      actualRowSpan--
      endRow--
    } else {
      break
    }
  }

  // 4. Belegte Zellen markieren (1-basierte col/row-Koordinaten)
  const occupied = new Set<string>()
  for (let c = startCol; c < startCol + actualColSpan; c++) {
    for (let r = startRow; r < startRow + actualRowSpan; r++) {
      occupied.add(`${c},${r}`)
    }
  }

  // 5. Zellen-Array aufbauen
  const cells: GridCell[] = []

  // Fraktal-Zelle
  cells.push({
    type:       'fractal',
    gridColumn: `${startCol} / ${startCol + actualColSpan}`,
    gridRow:    `${startRow} / ${startRow + actualRowSpan}`,
  })

  // Optional: Eine große GFX-Zelle mit Span platzieren, falls das Grid groß genug ist (z.B. >= 6 Zellen)
  // Dies stellt sicher, dass wir auf größeren Bildschirmen eine größere Kachel haben, die für Tracker/C64/Dogfight geeignet ist.
  let largeGfxCell: GridCell | null = null;
  if (cols * rows >= 6 && Math.random() < 0.8) {
    const freeSlots: [number, number][] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (!occupied.has(`${c},${r}`)) {
          freeSlots.push([c, r]);
        }
      }
    }
    // Shuffle freeSlots
    for (let i = freeSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freeSlots[i], freeSlots[j]] = [freeSlots[j], freeSlots[i]];
    }
    // Nach einem Slot suchen, an dem wir 2x1 oder 1x2 anlegen können
    for (const [c, r] of freeSlots) {
      const canSpanCol = c + 1 <= cols && !occupied.has(`${c + 1},${r}`);
      const canSpanRow = r + 1 <= rows && !occupied.has(`${c},${r + 1}`);
      if (canSpanCol || canSpanRow) {
        let sc = 1;
        let sr = 1;
        if (canSpanCol && canSpanRow) {
          if (Math.random() < 0.5) sc = 2; else sr = 2;
        } else if (canSpanCol) {
          sc = 2;
        } else {
          sr = 2;
        }
        // Belegen markieren
        for (let tc = c; tc < c + sc; tc++) {
          for (let tr = r; tr < r + sr; tr++) {
            occupied.add(`${tc},${tr}`);
          }
        }
        largeGfxCell = {
          type:       'gfx',
          gridColumn: `${c} / ${c + sc}`,
          gridRow:    `${r} / ${r + sr}`,
        };
        cells.push(largeGfxCell);
        break;
      }
    }
  }

  // ── Pool-Größen ermitteln BEVOR Zellen zugewiesen werden ─────────────────────
  const { textPool, gfxPool } = getFilteredPools(reviews)
  const textIndices = getWeightedIndices(textPool, reviews)
  const gfxIndices = getWeightedIndices(gfxPool, reviews)

  // GFX-Indices in large/small aufteilen
  const largeGfxIndices: number[] = []
  const smallGfxIndices: number[] = []
  gfxIndices.forEach(idx => {
    const comp = gfxPool[idx]
    const name = getCompName(comp)
    if (LARGE_PANELS.has(name)) {
      largeGfxIndices.push(idx)
    } else {
      smallGfxIndices.push(idx)
    }
  })

  const maxTextCells = textIndices.length
  const maxGfxCells  = gfxIndices.length   // large + small combined

  // Verbleibende Zellen: abwechselnd 'text' und 'gfx'
  let altIdx = 0
  let textCount = 0
  let gfxCount  = 0

  // Alle Positionen im Grid durchgehen
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (occupied.has(`${c},${r}`)) continue  // bereits durch Fraktal oder große GFX belegt

      // Gewünschten Typ bestimmen (1 Text, 2 GFX, 1 Text, 2 GFX …)
      let type: CellType = altIdx % 3 === 0 ? 'text' : 'gfx'
      altIdx++

      // Pool-Overflow: wenn gewünschter Typ erschöpft, zum anderen wechseln
      if (type === 'text' && textCount >= maxTextCells) {
        type = 'gfx'
      } else if (type === 'gfx' && gfxCount >= maxGfxCells) {
        type = 'text'
      }

      // Absoluter Overflow: wenn BEIDE Pools voll → Zelle überspringen
      if ((type === 'text' && textCount >= maxTextCells) ||
          (type === 'gfx'  && gfxCount  >= maxGfxCells)) {
        continue
      }

      if (type === 'text') textCount++
      if (type === 'gfx')  gfxCount++

      cells.push({
        type,
        gridColumn: `${c} / ${c + 1}`,
        gridRow:    `${r} / ${r + 1}`,
      })
    }
  }

  // Mindestens 1× 'text' und 1× 'gfx' sicherstellen
  if (textCount === 0 && gfxCount > 1 && maxTextCells > 0) {
    const gfxCell = cells.find(cell => cell.type === 'gfx' && !isCellLarge(cell)) || cells.find(cell => cell.type === 'gfx')
    if (gfxCell) { gfxCell.type = 'text'; textCount++; gfxCount-- }
  }
  if (gfxCount === 0 && textCount > 1 && maxGfxCells > 0) {
    const textCell = cells.find(cell => cell.type === 'text')
    if (textCell) { textCell.type = 'gfx'; gfxCount++; textCount-- }
  }

  // Index-Zuweisung mit Aspect-Matching (Layout-V2): jedes Panel nur einmal,
  // nur auf Zellen mit passendem Seitenverhältnis.
  let textPtr = 0
  const usedGfxAs = new Set<number>()
  // Anzahl bereits platzierter WebGL-Panels — gegen das Browser-Kontextlimit
  // gedeckelt (s. GL_PANELS / MAX_GL_PANELS_PER_LAYOUT). Ist das Kontingent voll,
  // werden nur noch Canvas-2D-/DOM-Panels eingesetzt → kein "SLOT EVICTED" mehr.
  let glCount = 0

  cells.forEach(cell => {
    if (cell.type === 'text') {
      if (textPtr < textIndices.length) {
        cell.panelIdx = textIndices[textPtr++]
      }
    } else if (cell.type === 'gfx') {
      const cellA = cellAspect(cell)
      const glBudgetFull = glCount >= MAX_GL_PANELS_PER_LAYOUT

      // Kandidat ist gültig, wenn Aspect passt UND (GL-Budget frei ODER Panel
      // braucht keinen GL-Kontext).
      const candidateOk = (idx: number): boolean => {
        if (usedGfxAs.has(idx)) return false
        const name = getCompName(gfxPool[idx])
        const pA = PANEL_ASPECT[name] ?? 'ANY'
        if (!aspectMatches(pA, cellA)) return false
        if (glBudgetFull && isGLPanel(name)) return false
        return true
      }

      function findGfx(candidates: number[], fallback: number[]): number | undefined {
        for (const idx of candidates) if (candidateOk(idx)) return idx
        // Fallback (andere Größenklasse) — weiterhin aspect- UND GL-budget-konform.
        // Lieber Zelle leer lassen als Seitenverhältnis brechen oder Kontext-Limit
        // sprengen.
        for (const idx of fallback) if (candidateOk(idx)) return idx
        return undefined
      }

      const isLarge = isCellLarge(cell)
      let idx: number | undefined

      if (isLarge) {
        idx = findGfx(largeGfxIndices, smallGfxIndices)
        if (idx == null) idx = findGfx(smallGfxIndices, largeGfxIndices)
      } else {
        idx = findGfx(smallGfxIndices, largeGfxIndices)
        if (idx == null) idx = findGfx(largeGfxIndices, smallGfxIndices)
      }

      if (idx != null) {
        cell.panelIdx = idx
        usedGfxAs.add(idx)
        if (isGLPanel(getCompName(gfxPool[idx]))) glCount++
      }
    }
  })

  // ── Dedup-Pass: kein Panel (nach Komponenten-NAME) doppelt im Layout ────────
  // Wichtig: NICHT nur nach panelIdx prüfen. Manche Pool-Einträge sind Aliase/
  // Re-Exports (z.B. VoxelMatrix = NeuralNetPanel), und verschiedene Indizes
  // können auf denselben sichtbaren Namen auflösen. Reines Index-Dedup ließ
  // dadurch z.B. Menger 2× gleichzeitig erscheinen. Daher hier nach Name dedupen.
  for (const poolType of ['text', 'gfx'] as const) {
    const pool = poolType === 'text' ? textPool : gfxPool
    const poolIndices = poolType === 'text' ? textIndices : gfxIndices
    const usedNames = new Set<string>()
    const usedIndices = new Set<number>()

    cells.forEach(cell => {
      if (cell.type !== poolType || cell.panelIdx == null) return
      const name = getCompName(pool[cell.panelIdx])

      if (usedNames.has(name)) {
        // Duplikat-Name → ersten unbenutzten Index mit unbenutztem Namen suchen
        let replaced = false
        for (const candidate of poolIndices) {
          if (usedIndices.has(candidate)) continue
          const candName = getCompName(pool[candidate])
          if (usedNames.has(candName)) continue
          cell.panelIdx = candidate
          usedIndices.add(candidate)
          usedNames.add(candName)
          replaced = true
          break
        }
        // Kein unbenutzter Name mehr verfügbar → Zelle deaktivieren
        if (!replaced) cell.panelIdx = undefined
      } else {
        usedNames.add(name)
        usedIndices.add(cell.panelIdx)
      }
    })
  }

  // ── Füll-Pass: leere Zellen mit DISTINKTEN Nicht-GL-Panels auffüllen ─────────
  // Bei hoher Dichte (Proxima) + WebGL-Deckel bleiben sonst GFX-Zellen ohne
  // panelIdx (kein aspect-passendes Nicht-GL-Panel mehr frei) → LayoutContent
  // rendert für solche Zellen NICHTS → Löcher. Füller sind ausschließlich Nicht-
  // GL-Panels: Canvas-2D-/DOM-GFX und TEXT (kein WebGL-Kontext). WICHTIG: NUR
  // distinkte Panels — beim Laden/Density-Wechsel dürfen KEINE Duplikate
  // entstehen. Bleibt keine distinkte Wahl, bleibt die Zelle leer (selten, da
  // die Ziel-Kachelzahl ohnehin auf die verfügbaren Distinct-Panels gedeckelt
  // ist). Duplikate sind ausschließlich über die Pillen-Pfeile erlaubt.
  {
    const usedNames = new Set<string>()
    cells.forEach(c => {
      if (c.panelIdx == null) return
      const pool = c.type === 'text' ? textPool : gfxPool
      if (c.type === 'text' || c.type === 'gfx') usedNames.add(getCompName(pool[c.panelIdx]))
    })

    // Nicht-GL-GFX-Indizes — als Füller geeignet (kein WebGL-Kontext).
    const nonGlGfx = gfxIndices.filter(idx => !isGLPanel(getCompName(gfxPool[idx])))

    // Einen UNBENUTZTEN Füller für eine Zelle wählen (nie ein Duplikat).
    const pickFiller = (cellA: Aspect): { type: 'gfx' | 'text'; idx: number } | null => {
      // 1. Nicht-GL-GFX mit passendem Seitenverhältnis (behält Bild-Charakter)
      for (const idx of nonGlGfx) {
        const name = getCompName(gfxPool[idx])
        if (usedNames.has(name)) continue
        if (!aspectMatches(PANEL_ASPECT[name] ?? 'ANY', cellA)) continue
        return { type: 'gfx', idx }
      }
      // 2. TEXT-Panel (reines DOM, aspect-neutral)
      for (const idx of textIndices) {
        const name = getCompName(textPool[idx])
        if (usedNames.has(name)) continue
        return { type: 'text', idx }
      }
      return null
    }

    cells.forEach(cell => {
      if (cell.panelIdx != null) return
      const f = pickFiller(cellAspect(cell))
      if (f) {
        cell.type = f.type
        cell.panelIdx = f.idx
        const pool = f.type === 'text' ? textPool : gfxPool
        usedNames.add(getCompName(pool[f.idx]))
      }
    })
  }

  // ── Audio-Garantie: GENAU EIN Audio-Panel pro Layout ───────────────────────
  // Das Audio-Konzept (Erst-Klick-Election in audio-focus.ts) wählt zufällig
  // einen der drei Player {AllYourBase-Video, SID, MOD}. Dafür muss mindestens
  // einer im Layout vorhanden sein. Wir erzwingen exakt einen — nicht mehrere,
  // damit nicht zwei Player gleichzeitig sichtbar um den Audio-Fokus konkurrieren.
  const isAudioIdx = (idx?: number) =>
    idx != null && AUDIO_PANELS.has(getCompName(gfxPool[idx]))

  // Alle gfx-Audio-Indizes, die nicht per Review (Daumen runter) ausgefiltert sind.
  const audioPool = gfxIndices.filter(idx => AUDIO_PANELS.has(getCompName(gfxPool[idx])))

  if (audioPool.length > 0) {
    // Aktuell vergebene gfx-Indizes sammeln (für Dedup beim Umwidmen).
    const usedGfx = new Set<number>()
    cells.forEach(c => { if (c.type === 'gfx' && c.panelIdx != null) usedGfx.add(c.panelIdx) })

    const audioCells = cells.filter(c => c.type === 'gfx' && isAudioIdx(c.panelIdx))

    if (audioCells.length === 0) {
      // Kein Audio-Player platziert → einen Slot dafür umwidmen.
      // Bevorzugt eine kleine gfx-Zelle; sonst irgendeine gfx-Zelle; sonst eine
      // Text-Zelle zu gfx umwandeln (Fallback, falls das Layout keine gfx-Zelle hat).
      let target = cells.find(c => c.type === 'gfx' && c.panelIdx != null && !isCellLarge(c))
                || cells.find(c => c.type === 'gfx' && c.panelIdx != null)
      if (!target) {
        const t = cells.find(c => c.type === 'text' && c.panelIdx != null)
        if (t) { t.type = 'gfx'; target = t }
      }
      if (target) {
        const freeAudio = audioPool.find(idx => !usedGfx.has(idx)) ?? audioPool[0]
        if (target.panelIdx != null) usedGfx.delete(target.panelIdx)
        target.panelIdx = freeAudio
        usedGfx.add(freeAudio)
      }
    } else if (audioCells.length > 1) {
      // Mehr als ein Audio-Panel → Überzählige durch unbenutzte NICHT-Audio-gfx
      // ersetzen (oder deaktivieren, falls kein Ersatz frei ist).
      for (let i = 1; i < audioCells.length; i++) {
        const cell = audioCells[i]
        const replacement = gfxIndices.find(idx =>
          !usedGfx.has(idx) && !AUDIO_PANELS.has(getCompName(gfxPool[idx])))
        usedGfx.delete(cell.panelIdx!)
        if (replacement != null) {
          cell.panelIdx = replacement
          usedGfx.add(replacement)
        } else {
          cell.panelIdx = undefined  // wird unten herausgefiltert
        }
      }
    }
  }

  // Zellen ohne gültigen panelIdx entfernen (sollte nie passieren)
  const finalCells = cells.filter(cell =>
    cell.type === 'fractal' || cell.panelIdx != null
  )

  return { id, gridTemplateColumns, gridTemplateRows, cells: finalCells }
}

// ── Review-Modus: alle Panels als geordnete Liste ─────────────────────────────
// Jeder Eintrag hat einen stabilen Namen (Funktionsname) als ID für localStorage.
const ALL_PANELS: { name: string; Component: React.ComponentType }[] = [
  // --- Recently Worked-On / Overhauled Panels (First in list) ---
  { name: 'MetaAgentPanel',     Component: MetaAgentPanel },
  { name: 'FractalJulia',       Component: FractalJulia },
  { name: 'C64Panel',           Component: C64Panel },
  { name: 'FractalSeahorse',    Component: FractalSeahorse },
  { name: 'FractalSpiral',      Component: FractalSpiral },
  { name: 'FractalTendril',     Component: FractalTendril },
  { name: 'FractalLightning',   Component: FractalLightning },
  { name: 'FractalElephant',    Component: FractalElephant },
  { name: 'FractalMini',        Component: FractalMini },
  { name: 'FractalSatellite',   Component: FractalSatellite },
  { name: 'FractalDragon',      Component: FractalDragon },
  { name: 'FractalDendrite',    Component: FractalDendrite },
  { name: 'FractalSwirl',       Component: FractalSwirl },
  { name: 'AmiModPanel',        Component: AmiModPanel },
  { name: 'SolarSystemPanel',   Component: SolarSystemPanel },
  { name: 'FractalView',        Component: FractalView },

  // --- Other Graphics Panels ---
  { name: 'ThreeBodyScene',     Component: ThreeBodyScene },
  { name: 'FireScene',          Component: FireScene },
  { name: 'LissajousScene',     Component: LissajousScene },
  { name: 'TunnelScene',        Component: TunnelScene },
  { name: 'RotozoomScene',      Component: RotozoomScene },
  { name: 'PlasmaDemo',         Component: PlasmaDemo },
  { name: 'EnhanceView',        Component: EnhanceView },
  { name: 'VoxelDemoColor',     Component: VoxelDemoColor },
  { name: 'VoxelDemoBW',        Component: VoxelDemoBW },
  { name: 'GlobePanel',         Component: GlobePanel },
  { name: 'VoxelThermal',       Component: VoxelThermal },
  { name: 'VoxelLava',          Component: VoxelLava },
  { name: 'VoxelNeon',          Component: VoxelNeon },
  { name: 'VoxelMatrix',        Component: VoxelMatrix },
  { name: 'StarfieldScene',     Component: StarfieldScene },
  { name: 'OscilloscopePanel',  Component: OscilloscopePanel },
  { name: 'MetaballsScene',     Component: MetaballsScene },
  { name: 'DotCloudScene',      Component: DotCloudScene },
  { name: 'AllYourBase',        Component: AllYourBase },
  { name: 'ParallaxPanel',      Component: ParallaxPanel },
  { name: 'ElitePanel',         Component: ElitePanel },
  { name: 'CADRobotPanel',      Component: CADRobotPanel },
  { name: 'RetroErrorPanel',    Component: RetroErrorPanel },
  { name: 'RadarSweepPanel',    Component: RadarSweepPanel },
  { name: 'DNAHelix',           Component: DNAHelix },
  { name: 'ShaderHackingCore',  Component: ShaderHackingCore },
  { name: 'ShaderMandelbox',    Component: ShaderMandelbox },
  { name: 'ShaderRetroWave',    Component: ShaderRetroWave },
  { name: 'DaggerfallPanel',    Component: DaggerfallPanel },
  { name: 'LidarScanPanel',     Component: LidarScanPanel },
  { name: 'TixyPanel',          Component: TixyPanel },
  { name: 'IQSmoothMin',        Component: IQSmoothMin },
  { name: 'IQDigitalStorm',     Component: IQDigitalStorm },
  { name: 'LovebyteShowcasePanel', Component: LovebyteShowcasePanel },
  { name: 'MoonPanel',          Component: MoonPanel },
  { name: 'PhysicsSandboxPanel', Component: PhysicsSandboxPanel },
  { name: 'NuclearExplosionPanel', Component: NuclearExplosionPanel },
  { name: 'ThermonuclearWarPanel', Component: ThermonuclearWarPanel },
  { name: 'MandelbulbScene',     Component: MandelbulbScene },
  { name: 'ApollonianGasketScene', Component: ApollonianGasketScene },
  { name: 'MengerSpongeScene',   Component: MengerSpongeScene },

  // --- Text Panels ---
  { name: 'ICQChatPanel',       Component: ICQChatPanel },
  { name: 'VisitorProfilePanel',Component: VisitorProfilePanel },
  { name: 'SatellitePanel',     Component: SatellitePanel },
  { name: 'SystemLog',          Component: SystemLog },
  { name: 'DataStream',         Component: DataStream },
  { name: 'Vitals',             Component: Vitals },
  { name: 'PortScanner',        Component: PortScanner },
  { name: 'PseudoCode',         Component: PseudoCode },
  { name: 'AgentCodePanel',     Component: AgentCodePanel },
  { name: 'DiskCleanupPanel',   Component: DiskCleanupPanel },
  { name: 'StockTickerPanel',   Component: StockTickerPanel },
  { name: 'ClassifiedPanel',    Component: ClassifiedPanel },
]

ALL_PANELS.forEach(p => {
  p.Component = memo(p.Component) as any
})

function initComponentNamesMap() {
  ALL_PANELS.forEach(p => {
    const base = getBaseComponent(p.Component)
    if (base) {
      COMPONENT_NAMES.set(base, p.name)
    }
  })
}
initComponentNamesMap()

// ── Eingefrorener Review-Slot ────────────────────────────────────────────────
//
// Performance-Hintergrund (Audit-Befund B-4, siehe PERF_NOTES.md): die App ist
// Main-Thread-/CPU-gebunden, nicht GPU-gebunden. Im Review-Modus rendert die
// 2x2-Seite vier Panels gleichzeitig — wenn alle vier live animieren, summiert
// sich ihre Canvas-2D-/JS-Last auf dem Haupt-Thread. Gemessen: der geforderte
// 60-FPS-Akzeptanzfall (M-07) lieferte so nur ~9 FPS auf einer Apple Apple-Silicon-Hardware.
//
// Lösung: nur das AKTIVE Panel wird live gemountet (animiert); die drei inaktiven
// Slots zeigen statt der laufenden Komponente diesen leichten Platzhalter. Sobald
// der Nutzer einen Slot anklickt, wird er aktiv und mountet live. So animiert zu
// jedem Zeitpunkt nur ein Panel — der Haupt-Thread wird drastisch entlastet.
function FrozenReviewSlot({ name }: { name: string }) {
  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center gap-2 select-none">
      {/* Pausen-Symbol als ruhiger visueller Anker */}
      <div className="text-green-800 text-2xl leading-none">❚❚</div>
      {/* Panel-Name, damit die Seite weiterhin navigierbar/orientierbar bleibt */}
      <div className="font-mono text-xs tracking-wider text-green-700">{name}</div>
      <div className="font-mono text-[10px] tracking-wider text-green-900">
        [ KLICKEN ZUM AKTIVIEREN ]
      </div>
    </div>
  )
}

// ── localStorage-Helfer für Reviews ──────────────────────────────────────────

/** Ein einzelner Review-Eintrag */
interface ReviewEntry {
  panel:   string           // Panel-Name (stabile ID)
  rating:  'up' | 'down'   // Daumen rauf oder runter
  comment: string           // optionaler Kommentar-Text
  ts:      number           // Unix-Timestamp (ms)
}

const LS_KEY = 'fraktallab_reviews'
const SEED_KEY = 'fraktallab_reviews_seeded_2026_05_30'

const INITIAL_REVIEWS: ReviewEntry[] = [
  { panel: "MetaAgentPanel", rating: "down", comment: "", ts: 1780166214686 },
  { panel: "TunnelScene", rating: "up", comment: "", ts: 1780166236483 },
  { panel: "EnhanceView", rating: "down", comment: "", ts: 1780166240762 },
  { panel: "VoxelMatrix", rating: "up", comment: "", ts: 1780166250443 },
  { panel: "ParallaxPanel", rating: "down", comment: "", ts: 1780166282783 },
  { panel: "CADRobotPanel", rating: "down", comment: "", ts: 1780166285762 },
  { panel: "RetroErrorPanel", rating: "up", comment: "", ts: 1780166305343 },
  { panel: "ShaderHackingCore", rating: "down", comment: "", ts: 1780166337653 },
  { panel: "ShaderMandelbox", rating: "up", comment: "", ts: 1780166339905 },
  { panel: "ShaderRetroWave", rating: "up", comment: "Bitte kein Tal in der Mitte, sondern eine Ebene mit Bergen", ts: 1780166363932 },
  { panel: "DaggerfallPanel", rating: "down", comment: "", ts: 1780166367432 },
  { panel: "LidarScanPanel", rating: "up", comment: "", ts: 1780166371257 },
  { panel: "TixyPanel", rating: "up", comment: "", ts: 1780166376374 },
  { panel: "IQDigitalStorm", rating: "up", comment: "", ts: 1780166381140 },
  { panel: "NuclearExplosionPanel", rating: "up", comment: "", ts: 1780166397190 },
  { panel: "SupervolcanoPanel", rating: "down", comment: "", ts: 1780166402282 },
  { panel: "MandelbulbScene", rating: "up", comment: "", ts: 1780166406715 },
  { panel: "MengerSpongeScene", rating: "up", comment: "", ts: 1780166412482 },
  { panel: "VisitorProfilePanel", rating: "down", comment: "", ts: 1780166419907 },
  { panel: "SatellitePanel", rating: "down", comment: "", ts: 1780166423807 },
  { panel: "SystemLog", rating: "down", comment: "", ts: 1780166430132 },
  { panel: "DataStream", rating: "down", comment: "", ts: 1780166432508 },
  { panel: "Vitals", rating: "down", comment: "", ts: 1780166441532 },
  { panel: "PortScanner", rating: "down", comment: "", ts: 1780166452899 },
  { panel: "PseudoCode", rating: "down", comment: "", ts: 1780166455774 },
  { panel: "AgentCodePanel", rating: "down", comment: "", ts: 1780166458923 },
  { panel: "DiskCleanupPanel", rating: "down", comment: "", ts: 1780166461315 },
  { panel: "StockTickerPanel", rating: "down", comment: "", ts: 1780166463098 },
  { panel: "ClassifiedPanel", rating: "down", comment: "", ts: 1780166464590 }
]

function seedInitialReviewsIfNeeded(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(SEED_KEY) !== 'true') {
      let existing: ReviewEntry[] = []
      try {
        existing = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as ReviewEntry[]
        if (!Array.isArray(existing)) existing = []
      } catch {
        existing = []
      }
      
      const existingMap = new Map(existing.map(r => [r.panel, r]))
      INITIAL_REVIEWS.forEach(init => {
        existingMap.set(init.panel, init)
      })
      
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(existingMap.values())))
      localStorage.setItem(SEED_KEY, 'true')
    }
  } catch (e) {
    console.error('Failed to seed initial reviews:', e)
  }
}

/** Liest alle Reviews aus localStorage. Gibt leeres Array zurück bei Fehler. */
function loadReviews(): ReviewEntry[] {
  seedInitialReviewsIfNeeded()
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as ReviewEntry[]
  } catch {
    return []
  }
}

function getFilteredPools(reviews: ReviewEntry[]) {
  const downPanels = new Set(reviews.filter(r => r.rating === 'down').map(r => r.panel))

  // Ein Panel fliegt aus der Galerie, wenn es down-gevotet ODER archiviert ist.
  // Archivierte (deaktivierte) Panels dürfen NIE wieder auftauchen — auch dann
  // nicht, wenn sie versehentlich noch in einem POOL stehen.
  const allowed = (comp: React.ComponentType<any>) => {
    const name = getCompName(comp)
    return !downPanels.has(name) && !isArchived(name)
  }

  const textPool = POOL_TEXT.filter(allowed)
  const gfxPool  = POOL_GFX.filter(allowed)

  return { textPool, gfxPool }
}

function getWeightedIndices(pool: React.ComponentType<any>[], reviews: ReviewEntry[]): number[] {
  const scored = pool.map((comp, idx) => {
    const name = getCompName(comp)
    const review = reviews.find(r => r.panel === name)
    
    let weight = 1.0
    if (review?.rating === 'up') {
      weight = 3.0
    } else if (review?.rating === 'down') {
      weight = 0.0
    }
    
    const u = Math.random()
    const score = weight > 0 ? Math.pow(u, 1 / weight) : -1
    return { idx, score }
  })
  
  return scored
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.idx)
}

/** Speichert einen neuen/aktualisierten Review. Pro Panel nur ein Eintrag. */
function saveReview(entry: ReviewEntry): void {
  // Alten Eintrag für dasselbe Panel herausfiltern, neuen anhängen
  const existing = loadReviews().filter(r => r.panel !== entry.panel)
  localStorage.setItem(LS_KEY, JSON.stringify([...existing, entry]))
}

// ── Hilfsfunktion: prüft ob ein Audio-Panel gerade läuft ─────────────────────
// AllYourBase (Video) und AmiModPanel (WebAudio) sind die einzigen Sound-Panels.
// Layout-Wechsel wartet, bis kein Sound mehr läuft.
function isAudioPlaying(): boolean {
  return getAudioFocus() !== null
}

// ── Layout-Renderer ───────────────────────────────────────────────────────────
function LayoutContent({
  layout,
  onNavSlot,
  textPool,
  gfxPool,
}: {
  layout: GeneratedLayout
  onNavSlot: (slotIndex: number, dir: number) => void
  textPool: React.ComponentType<any>[]
  gfxPool: React.ComponentType<any>[]
}) {
  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: layout.gridTemplateColumns,
        gridTemplateRows:    layout.gridTemplateRows,
        // Platzsparend: KEINE Lücken zwischen den Kacheln — Panels berühren sich
        // direkt (rahmenlos). Maximiert die nutzbare Fläche jeder Kachel.
        gap:                 '0px',
        padding:             '0px',
        height:              '100%',
        width:               '100%',
      }}
    >
      {layout.cells.map((cell, i) => (
        <div
          key={i}
          style={{ gridColumn: cell.gridColumn, gridRow: cell.gridRow }}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          {/* Zellinhalt je nach Typ */}
          {cell.type === 'fractal' && <FractalView />}
          {cell.type === 'text'    && (
            <PanelSlot
              key={`${layout.id}-text-${i}`}
              pool={textPool}
              activeIdx={cell.panelIdx!}
              onNav={(dir) => onNavSlot(i, dir)}
              fallbackName={getCompName(textPool[cell.panelIdx!])}
              className="h-full"
            />
          )}
          {cell.type === 'gfx'     && (
            <PanelSlot
              key={`${layout.id}-gfx-${i}`}
              pool={gfxPool}
              activeIdx={cell.panelIdx!}
              onNav={(dir) => onNavSlot(i, dir)}
              fallbackName={getCompName(gfxPool[cell.panelIdx!])}
              className="h-full"
              locked={AUDIO_PANELS.has(getCompName(gfxPool[cell.panelIdx!]))}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Auslastungs-Wähler (Layout-V2, 2026-05-31) ──────────────────────────────
type DensityLevel = '25mhz' | 'turbo' | 'overclock' | 'proxima'

const DENSITY_LABELS: Record<DensityLevel, string> = {
  '25mhz': '25 MHz',
  'turbo': 'Turbo',
  'overclock': 'Overdrive',
  'proxima': 'Proxima Centauri',
}

// Vollständige (literale) Tailwind-Klassen pro Stufe — literal, damit der
// Tailwind-JIT sie beim Scannen findet. `active` = aktivierter Look (heller
// Rahmen + Text + dezenter Hintergrund), `idle` = gedimmt. Proxima bleibt auch
// im Idle leicht rötlich (Warn-Köder); Glow nur, wenn aktiv.
// Farb-Rampe grün → gelb → rot → Crazy. Buttons sind IMMER gefüllt (auffälliger),
// aktiv = kräftige Sättigung + Glow + fett. Proxima aktiv = `.density-crazy`
// (animiertes Feuer + Neon-Puls, in index.css), Glow daher per CSS, nicht inline.
const DENSITY_STYLE: Record<DensityLevel, { active: string; idle: string; glow?: string }> = {
  '25mhz':     { active: 'border-green-300 text-black bg-green-500 font-bold',    idle: 'border-green-700 text-green-300 bg-green-950/70 hover:bg-green-900',     glow: '0 0 10px rgba(34,197,94,0.85)' },
  'turbo':     { active: 'border-yellow-200 text-black bg-yellow-400 font-bold',  idle: 'border-yellow-700 text-yellow-300 bg-yellow-950/70 hover:bg-yellow-900', glow: '0 0 10px rgba(250,204,21,0.9)' },
  'overclock': { active: 'border-red-300 text-white bg-red-600 font-bold',        idle: 'border-red-800 text-red-300 bg-red-950/70 hover:bg-red-900',             glow: '0 0 12px rgba(239,68,68,0.9)' },
  'proxima':   { active: 'density-crazy font-bold',                               idle: 'border-fuchsia-800 text-fuchsia-300 bg-fuchsia-950/70 hover:bg-fuchsia-900' },
}

const DENSITY_ORDER: DensityLevel[] = ['25mhz', 'turbo', 'overclock', 'proxima']

// FESTE Ziel-Kachelzahl pro Stufe (nicht breitenabhängig). generateLayout leitet
// daraus cols×rows passend zum Bildschirm-Seitenverhältnis ab. Proxima zielt
// bewusst Richtung 30 — auf künftiger Hardware bei 120 Hz trotzdem flüssig.
function densityPanelCount(level: DensityLevel): number {
  switch (level) {
    case '25mhz':     return 6
    case 'turbo':     return 12
    case 'overclock': return 15
    // Proxima auf 20 begrenzt — komfortabel unter der Distinct-Untergrenze, damit
    // keine Löcher/Duplikate entstehen. Höhere Dichte bräuchte Roadmap-Schritt 2
    // (Freeze-to-Image für GL-Panels).
    case 'proxima':   return 20
  }
}

const LS_DENSITY = 'fraktallab_density'

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function App() {
  // Aufsteigender ID-Zähler für React-Keys — als Ref, um Stale-Closure-Probleme zu vermeiden
  const layoutIdRef = useRef(0)
  const [layout,     setLayout]     = useState<GeneratedLayout>(() => {
    const reviews = loadReviews()
    return generateLayout(0, reviews)
  })
  const [prevLayout, setPrevLayout] = useState<GeneratedLayout | null>(null)
  const [sliding,    setSliding]    = useState(false)
  // Globaler Audio-Mute-Zustand (gespiegelt aus audio-focus.ts für das Button-Label).
  const [audioMuted, setAudioMuted] = useState(() => isAudioMuted())

  // ── Auslastung (Layout-V2) ─────────────────────────────────────────────────
  // Gewählte Galerie-Dichte. Allererster Start (nichts persistiert) = `turbo`.
  // Kein Benchmark mehr (sorgte für Verspringen). Wer schwache Hardware hat, geht
  // manuell auf `25 MHz` runter. Jede Wahl wird in localStorage gemerkt und beim
  // Reload wiederhergestellt.
  const [density, setDensity] = useState<DensityLevel>(() => {
    const saved = localStorage.getItem(LS_DENSITY)
    return DENSITY_ORDER.includes(saved as DensityLevel) ? (saved as DensityLevel) : 'turbo'
  })
  // Ref-Spiegel, damit doSwitch (leere Deps) immer die aktuelle Dichte sieht.
  const densityRef = useRef<DensityLevel>(density)
  useEffect(() => { densityRef.current = density }, [density])

  const [mobileIndices, setMobileIndices] = useState(() => {
    const reviews = loadReviews()
    return generateMobileIndices(reviews)
  })

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768
    }
    return false
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Erst-Klick irgendwo auf der Seite startet GENAU EINEN Audio-Player (Election).
  // Capture-Phase, damit es vor Panel-eigenen Handlern feuert. Der Header-AUDIO-
  // Button ist ausgenommen (data-audio-toggle) — der steuert die Election selbst.
  useEffect(() => {
    const onFirstGesture = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('[data-audio-toggle]')) return
      handleFirstGesture()
    }
    const opts = { capture: true } as const
    window.addEventListener('click',      onFirstGesture, opts)
    window.addEventListener('touchstart', onFirstGesture, opts)
    window.addEventListener('keydown',    onFirstGesture, opts)
    return () => {
      window.removeEventListener('click',      onFirstGesture, opts)
      window.removeEventListener('touchstart', onFirstGesture, opts)
      window.removeEventListener('keydown',    onFirstGesture, opts)
    }
  }, [])

  // Mute-Zustand aus audio-focus.ts spiegeln, damit das Button-Label stimmt.
  useEffect(() => registerMuteListener(setAudioMuted), [])

  const reviews = loadReviews()
  const { textPool, gfxPool } = getFilteredPools(reviews)

  // ── Deterministische Vor/Zurück-Navigation (Titel-Pillen-Pfeile) ────────────
  // Baut für den Slot eine STABILE (nach Pool-Index sortierte) Liste KOMPATIBLER
  // Panels und blättert mit dir = -1/+1 durch. Kompatibel heißt: gleiches
  // Seitenverhältnis, gleiche Größenklasse und (bei GL-Panels) innerhalb des
  // WebGL-Kontingents — dieselben Aspect-/GL-Regeln wie beim Bauen des Layouts.
  // AUSNAHME (bewusst): die Pfeile dürfen ein bereits anderswo gezeigtes Panel
  // wählen (Duplikat). Sonst wäre bei kleinem Pool kaum noch Durchblättern
  // möglich. Duplikate beim LADEN/Density-Wechsel verhindert dagegen der Bau +
  // Füll-Pass; nur die Pfeile lockern das absichtlich.
  const handleNavSlot = useCallback((slotIndex: number, dir: number) => {
    setLayout(curr => {
      const cell = curr.cells[slotIndex]
      if (!cell || cell.panelIdx == null || (cell.type !== 'text' && cell.type !== 'gfx')) return curr

      const reviews = loadReviews()
      const { textPool, gfxPool } = getFilteredPools(reviews)
      const pool = cell.type === 'text' ? textPool : gfxPool

      // GL-Verbrauch der ÜBRIGEN Kacheln (dieser Slot ausgenommen) — damit ein
      // Wechsel das WebGL-Kontingent nicht sprengt.
      let otherGL = 0
      curr.cells.forEach((c, idx) => {
        if (idx === slotIndex || c.panelIdx == null) return
        if (c.type === 'gfx') {
          const name = getCompName(gfxPool[c.panelIdx])
          if (isGLPanel(name)) otherGL++
        }
      })

      const cellA = cellAspect(cell)
      const isLarge = isCellLarge(cell)

      // Stabile Kandidatenliste (Pool-Index-Reihenfolge). KEIN Dedup gegen andere
      // Slots — Pfeile dürfen Duplikate erzeugen.
      const cands: number[] = []
      pool.forEach((comp, i) => {
        const name = getCompName(comp)
        if (cell.type === 'gfx') {
          if (!aspectMatches(PANEL_ASPECT[name] ?? 'ANY', cellA)) return
          if (panelMayBeLarge(name) !== isLarge) return
          if (isGLPanel(name) && otherGL + 1 > MAX_GL_PANELS_PER_LAYOUT) return
        }
        cands.push(i)
      })
      if (cands.length === 0) return curr

      // Aktuelle Position finden und in Richtung dir weiterspringen (mit Umlauf).
      const curPos = cands.indexOf(cell.panelIdx)
      const nextPos = curPos === -1
        ? (dir > 0 ? 0 : cands.length - 1)
        : ((curPos + dir) % cands.length + cands.length) % cands.length

      const newCells = [...curr.cells]
      newCells[slotIndex] = { ...cell, panelIdx: cands[nextPos] }
      return { ...curr, cells: newCells }
    })
  }, [])

  const handleSkipMobileSlot = useCallback((slotIndex: number) => {
    setMobileIndices(curr => {
      const reviews = loadReviews()
      const { textPool, gfxPool } = getFilteredPools(reviews)
      const otherActiveComps = new Set<React.ComponentType<any>>()

      if (slotIndex !== 0) {
        const comp = textPool[curr.textIdx]
        if (comp) otherActiveComps.add(comp)
      }
      if (slotIndex !== 1) {
        const comp = gfxPool[curr.gfxIdx1]
        if (comp) otherActiveComps.add(comp)
      }
      if (slotIndex !== 2) {
        const comp = gfxPool[curr.gfxIdx2]
        if (comp) otherActiveComps.add(comp)
      }
      if (slotIndex !== 3) {
        const comp = gfxPool[curr.gfxIdx3]
        if (comp) otherActiveComps.add(comp)
      }

      let pool: React.ComponentType<any>[]
      let currentIdx: number
      if (slotIndex === 0) {
        pool = textPool
        currentIdx = curr.textIdx
      } else if (slotIndex === 1) {
        pool = gfxPool
        currentIdx = curr.gfxIdx1
      } else if (slotIndex === 2) {
        pool = gfxPool
        currentIdx = curr.gfxIdx2
      } else {
        pool = gfxPool
        currentIdx = curr.gfxIdx3
      }

      const currentComp = pool[currentIdx]
      const candidates: number[] = []
      pool.forEach((comp, i) => {
        if (comp !== currentComp && !otherActiveComps.has(comp)) {
          candidates.push(i)
        }
      })

      let chosenIdx = 0
      if (candidates.length > 0) {
        const candidateScores = candidates.map(i => {
          const comp = pool[i]
          const name = getCompName(comp)
          const review = reviews.find(r => r.panel === name)
          let weight = 1.0
          if (review?.rating === 'up') {
            weight = 3.0
          } else if (review?.rating === 'down') {
            weight = 0.0
          }
          const u = Math.random()
          const score = weight > 0 ? Math.pow(u, 1 / weight) : -1
          return { i, score }
        })
        candidateScores.sort((a, b) => b.score - a.score)
        chosenIdx = candidateScores[0].i
      } else {
        chosenIdx = Math.floor(Math.random() * pool.length)
      }

      if (slotIndex === 0) {
        return { ...curr, textIdx: chosenIdx }
      } else if (slotIndex === 1) {
        return { ...curr, gfxIdx1: chosenIdx }
      } else if (slotIndex === 2) {
        return { ...curr, gfxIdx2: chosenIdx }
      } else {
        return { ...curr, gfxIdx3: chosenIdx }
      }
    })
  }, [])

  // Automatische Review-Zurücksetzung bei Versionsänderung
  useEffect(() => {
    const RESET_VERSION = 'v1.1.0-reset-2'
    const currentReset = localStorage.getItem('fraktallab_reset_version')
    if (currentReset !== RESET_VERSION) {
      localStorage.removeItem(LS_KEY)
      localStorage.removeItem(SEED_KEY)
      localStorage.setItem('fraktallab_reset_version', RESET_VERSION)
    }
  }, [])


  // ── Review-Modus-State ─────────────────────────────────────────────────────
  const [reviewMode, setReviewMode] = useState(() => {
    return localStorage.getItem('fraktallab_review_mode') === 'true'
  })
  const [reviewIdx,  setReviewIdx]  = useState(() => {
    const val = localStorage.getItem('fraktallab_review_idx')
    return val ? parseInt(val, 10) : 0
  })
  const [hideArchived, setHideArchived] = useState(() => {
    return localStorage.getItem('fraktallab_hide_archived') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('fraktallab_review_mode', String(reviewMode))
  }, [reviewMode])

  useEffect(() => {
    localStorage.setItem('fraktallab_review_idx', String(reviewIdx))
  }, [reviewIdx])

  useEffect(() => {
    localStorage.setItem('fraktallab_hide_archived', String(hideArchived))
  }, [hideArchived])

  const activeAllPanels = React.useMemo(() => {
    if (!hideArchived) return ALL_PANELS
    return ALL_PANELS.filter(p => {
      const review = reviews.find(r => r.panel === p.name)
      return review?.rating !== 'down'
    })
  }, [hideArchived, reviews])

  // Ensure index is within range of activeAllPanels
  useEffect(() => {
    if (reviewIdx >= activeAllPanels.length) {
      setReviewIdx(Math.max(0, activeAllPanels.length - 1))
    }
  }, [activeAllPanels.length, reviewIdx])

  // Aktuelle Bewertungsauswahl (noch nicht gespeichert, nur UI-State)
  const [reviewRating, setReviewRating] = useState<'up' | 'down' | null>(null)
  // useRef für das Textarea verhindert Re-Renders beim Tippen
  const commentRef = useRef<HTMLTextAreaElement>(null)

  /** Lädt bestehende Bewertung für ein Panel und füllt die UI */
  const loadPanelReview = useCallback((panelName: string) => {
    const existing = loadReviews().find(r => r.panel === panelName) ?? null
    setReviewRating(existing?.rating ?? null)
    // Textarea direkt befüllen (kein State, kein Re-Render)
    if (commentRef.current) {
      commentRef.current.value = existing?.comment ?? ''
    }
  }, [])

  /** Wechselt zu einem Panel per Index — speichert aktuellen Stand zuerst */
  const goToPanel = useCallback((idx: number) => {
    // Auto-save falls ein Daumen gewählt wurde (Kommentar wird mitgespeichert)
    if (reviewRating && activeAllPanels[reviewIdx]) {
      saveReview({
        panel:   activeAllPanels[reviewIdx].name,
        rating:  reviewRating,
        comment: commentRef.current?.value ?? '',
        ts:      Date.now(),
      })
    }
    const safeIdx = activeAllPanels.length > 0 ? (((idx % activeAllPanels.length) + activeAllPanels.length) % activeAllPanels.length) : 0
    setReviewIdx(safeIdx)
    if (activeAllPanels[safeIdx]) {
      loadPanelReview(activeAllPanels[safeIdx].name)
    }
  }, [reviewIdx, reviewRating, loadPanelReview, activeAllPanels])

  /** Öffnet den Review-Modus und lädt die Bewertung für das erste Panel */
  const enterReview = useCallback(() => {
    setReviewMode(true)
    setReviewIdx(0)
    if (activeAllPanels[0]) {
      loadPanelReview(activeAllPanels[0].name)
    }
  }, [loadPanelReview, activeAllPanels])

  /** Wählt Daumen und speichert sofort — kein separater Save-Schritt nötig */
  const handleRating = useCallback((rating: 'up' | 'down') => {
    setReviewRating(rating)
    if (activeAllPanels[reviewIdx]) {
      saveReview({
        panel:   activeAllPanels[reviewIdx].name,
        rating,
        comment: commentRef.current?.value ?? '',
        ts:      Date.now(),
      })
    }
  }, [reviewIdx, activeAllPanels])

  // Ref für den laufenden Auto-Switch-Timer — wird bei jedem Wechsel neu gesetzt
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSwitch = useCallback((current: GeneratedLayout) => {
    // Neue ID vergeben und neues Layout generieren
    layoutIdRef.current += 1
    const reviews = loadReviews()
    // Aktuelle Dichte → feste Ziel-Kachelzahl.
    const next = generateLayout(layoutIdRef.current, reviews, densityPanelCount(densityRef.current))

    setPrevLayout(current)
    setSliding(true)
    setPaused(true)
    setLayout(next)

    // Automatically reset active audio focus on layout switch
    resetAudioFocus()

    // Animation nach 520 ms beenden (etwas länger als die 500 ms CSS-Animation)
    setTimeout(() => {
      setPrevLayout(null)
      setSliding(false)
      setPaused(false)
    }, 520)
  }, [])

  // Dichte-Stufe wählen → State setzen, persistieren und Layout mit der festen
  // Ziel-Kachelzahl neu würfeln. `persist=false` nur für die einmalige Mount-
  // Synchronisierung des Initial-Layouts (kein neuer localStorage-Schreib nötig).
  const applyDensity = useCallback((level: DensityLevel, persist: boolean) => {
    setDensity(level)
    densityRef.current = level
    // Proxima = "Crazy"-Modus: alle subscribe-basierten Animationen doppelt so
    // schnell. Audio (WebAudio-Echtzeit) bleibt unberührt. Andere Stufen: normal.
    setTimeScale(level === 'proxima' ? 2 : 1)
    if (persist) {
      try { localStorage.setItem(LS_DENSITY, level) } catch { /* Private-Mode etc. */ }
    }
    layoutIdRef.current += 1
    const reviews = loadReviews()
    const next = generateLayout(layoutIdRef.current, reviews, densityPanelCount(level))
    setLayout(next)
    resetAudioFocus()
  }, [])

  // Mount: Initial-Layout wurde ohne Ziel-Kachelzahl gewürfelt → einmalig mit der
  // aktuellen Dichte (persistiert oder Default `turbo`) neu aufbauen, damit die
  // Kachelzahl von Anfang an zur gewählten Stufe passt. Kein Benchmark.
  useEffect(() => {
    applyDensity(densityRef.current, false)
  }, [applyDensity])

  // Versucht Layout zu wechseln — wartet, falls ein Audio-Panel läuft
  const trySwitch = useCallback(() => {
    setLayout(current => {
      if (isAudioPlaying()) {
        // Alle 5 s erneut prüfen, ob das Video noch läuft
        autoTimerRef.current = setTimeout(trySwitch, 5000)
        return current
      }
      doSwitch(current)
      return current  // setLayout-Update passiert in doSwitch
    })
  }, [doSwitch])

  // Auto-Switch alle 1–3 Minuten
  const scheduleNext = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    const delay = 60_000 + Math.random() * 120_000   // 1–3 Minuten
    autoTimerRef.current = setTimeout(trySwitch, delay)
  }, [trySwitch])

  // Galerie (Relaunch 2026-05-31): KEIN automatischer Komplett-Layout-Wechsel mehr.
  // Der Nutzer erkundet selbst — Layout wechselt nur manuell (⟳-Button / Leertaste).
  // Senkt zusätzlich die Last (kein periodisches Neu-Mounten aller Panels).
  // `scheduleNext`/`trySwitch` bleiben für den manuellen Pfad erhalten, werden hier
  // aber nicht mehr automatisch angestoßen.
  void scheduleNext

  // Leertaste → sofortiger Layout-Wechsel (nicht im Review-Modus oder in Textfeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !reviewMode) {
        e.preventDefault()
        if (isAudioPlaying()) return
        setLayout(current => { doSwitch(current); return current })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSwitch, reviewMode])

  // ── Cursortasten / Arrow keys → switch panels in review mode ────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!reviewMode) return
      
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goToPanel((reviewIdx + 1) % activeAllPanels.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goToPanel((reviewIdx - 1 + activeAllPanels.length) % activeAllPanels.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewMode, reviewIdx, goToPanel, activeAllPanels.length])

  // ── abgeleitete Variablen für den Review-Modus ─────────────────────────────
  const totalPanels    = activeAllPanels.length
  const currentPanel   = activeAllPanels[reviewIdx]
  // Bereits gespeicherte Bewertung für das aktuelle Panel (für grüne Hervorhebung nach SAVE)
  const savedReviews   = reviewMode ? loadReviews() : []
  const savedForCurrent = savedReviews.find(r => r.panel === currentPanel?.name)

  return (
    <div className="bg-black text-green-400 h-screen flex flex-col font-mono overflow-hidden">

      {/* Bildstörungs-Overlay — auf Mobile ausgeblendet, zu ablenkend auf kleinen Screens */}
      <div className="hidden md:block">
        <GlitchOverlay />
      </div>

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v1.1.0
        </span>
        <span className="ml-auto text-red-800 text-xs animate-pulse">● LIVE</span>

        {/* Audio-Mute-Toggle. Erst-Klick startet einen zufälligen Player (Election),
            danach schaltet der Button stumm/laut. data-audio-toggle nimmt ihn vom
            globalen Erst-Geste-Listener aus, damit er sich nicht selbst doppelt feuert. */}
        <button
          data-audio-toggle
          onClick={() => {
            // AudioContext im User-Gesture-Callstack aufwecken (iOS/Safari-Unlock).
            try {
              const ctx = getSharedAudioContext()
              if (ctx.state === 'suspended') ctx.resume().catch(() => {})
              const buffer = ctx.createBuffer(1, 1, 22050)
              const source = ctx.createBufferSource()
              source.buffer = buffer
              source.connect(ctx.destination)
              source.start(0)
            } catch (e) {
              console.warn('Failed to unlock AudioContext on click:', e)
            }
            toggleAudioMuted()
          }}
          title="Audio stummschalten / wieder einschalten"
          className="border border-green-800 text-green-600 text-xs px-2 py-0.5
                     hover:border-green-600 hover:text-green-200 transition-colors"
        >
          {audioMuted ? 'AUDIO OFF' : 'AUDIO ON'}
        </button>

        {/* Auslastungs-Wähler (Layout-V2) — nur Desktop, im Review-Modus aus.
            Label links, dann 4 Stufen-Segmente. Aktive Stufe = aktivierter Look.
            Klick = Dichte setzen + Layout neu würfeln; erneuter Klick = neu würfeln. */}
        {!reviewMode && (
          <div className="hidden md:flex items-center gap-1">
            <span
              className="text-green-200 text-xs font-bold uppercase tracking-widest mr-1"
              style={{ textShadow: '0 0 6px rgba(74,222,128,0.7)' }}
            >
              Auslastung
            </span>
            {DENSITY_ORDER.map(level => {
              const active = density === level
              const style = DENSITY_STYLE[level]
              return (
                <button
                  key={level}
                  onClick={() => {
                    // KEIN isAudioPlaying-Guard: der Erst-Klick startet per
                    // Election einen Audio-Player → der Guard hätte den allerersten
                    // (und damit faktisch jeden) Dichte-Klick verschluckt. Dichte
                    // ändern soll immer gehen; resetAudioFocus läuft in applyDensity.
                    applyDensity(level, true)   // manuelle Wahl → persistieren
                  }}
                  title={`Galerie-Dichte: ${DENSITY_LABELS[level]} (Klick = neu würfeln)`}
                  className={`border text-xs px-2 py-0.5 transition-colors ${active ? style.active : style.idle}`}
                  style={active && style.glow ? { boxShadow: style.glow } : undefined}
                >
                  {/* Crazy-Modus: Totenkopf, wenn Proxima aktiv ist */}
                  {active && level === 'proxima' ? '💀 ' : ''}{DENSITY_LABELS[level]}
                </button>
              )
            })}
          </div>
        )}

        {/* Review-Modus-Button — auf allen Geräten sichtbar, zeigt EXIT wenn aktiv, sonst [?] */}
        {reviewMode ? (
          <button
            onClick={() => setReviewMode(false)}
            title="Review-Modus beenden"
            className="inline-flex border border-red-800 text-red-600 text-xs px-2 py-0.5
                       hover:border-red-500 hover:text-red-300 transition-colors cursor-pointer"
          >
            ✕ EXIT REVIEW
          </button>
        ) : (
          <button
            onClick={enterReview}
            title="Panel Review-Modus öffnen"
            className="inline-flex border border-green-800 text-green-600 text-xs px-2 py-0.5
                       hover:border-green-600 hover:text-green-200 transition-colors cursor-pointer"
          >
            ?
          </button>
        )}
      </header>

      {/* Haupt-Content */}
      <main className="flex-1 min-h-0 overflow-hidden relative">

        {reviewMode ? (
          /* ── Gemeinsamer Review-Modus für Desktop und Mobile ── */
          <div className="h-full flex flex-col p-1 gap-1">

            {/* Panel-Container — nimmt den Hauptteil der Höhe ein */}
            <div className="flex-1 min-h-0 bg-black flex flex-col">
              {isMobile ? (
                /* Auf Mobile (unter 768px) rendern wir NUR das eine aktive Panel */
                <div className="flex-1 min-h-0 h-full flex flex-col">
                  {(() => {
                    const panel = activeAllPanels[reviewIdx]
                    if (!panel) return <div className="p-4 text-center text-green-700">NO PANELS AVAILABLE</div>
                    const Comp = panel.Component
                    return <Comp />
                  })()}
                </div>
              ) : (
                /* Auf Desktop rendern wir das 2x2 Grid (4 Panels) */
                <div className="grid flex-1 min-h-0 grid-cols-2 grid-rows-2 gap-1 bg-black">
                  {activeAllPanels.length === 0 ? (
                    <div className="col-span-2 row-span-2 flex items-center justify-center text-xs text-green-700 uppercase">
                      [ NO ACTIVE PANELS IN REVIEW CYCLE ]
                    </div>
                  ) : (
                    [0, 1, 2, 3].map(offset => {
                      const pageStartIdx = Math.floor(reviewIdx / 4) * 4
                      const idx = pageStartIdx + offset
                      if (idx < totalPanels) {
                        const panel = activeAllPanels[idx]
                        const Comp = panel.Component
                        const isActive = idx === reviewIdx
                        const review = reviews.find(r => r.panel === panel.name)
                        const isUp = review?.rating === 'up'
                        const isDown = review?.rating === 'down'

                        return (
                          <div
                            key={panel.name}
                            className={`flex-1 min-h-0 h-full min-w-0 relative flex flex-col transition-all duration-200 cursor-pointer ${
                              isActive
                                ? isUp
                                  ? 'ring-2 ring-green-400 border border-green-400 z-10'
                                  : isDown
                                    ? 'ring-2 ring-red-500 border border-red-500 z-10'
                                    : 'ring-2 ring-green-500 border border-green-500 z-10'
                                : isUp
                                  ? 'border border-green-900/60 bg-green-950/5'
                                  : isDown
                                    ? 'border border-red-950/60 bg-red-950/5'
                                    : ''
                            }`}
                            onClick={() => goToPanel(idx)}
                          >
                            {/* Nur das aktive Panel animiert live (B-4: Main-Thread
                                entlasten). Inaktive Slots zeigen einen statischen
                                Platzhalter und mounten erst beim Anklicken. */}
                            {isActive ? <Comp /> : <FrozenReviewSlot name={panel.name} />}
                            {/* Review-Mode-Marker: Index + Kurzname des Panels. */}
                            <div className="absolute top-0.5 right-7 z-20 pointer-events-none select-none flex items-center gap-1 font-mono text-xs tracking-wider bg-black/80 border border-green-700/40 px-1.5 py-[1px] rounded-sm">
                              <span className="text-green-500 font-bold">#{idx + 1}</span>
                              <span className="text-green-700">·</span>
                              <span className="text-green-300">{panel.name}</span>
                              <span className="text-green-700">·</span>
                              {/* Asset-Größe des Panels (prozedurale Panels: 0 KB). */}
                              <span className="text-green-600">{panelAssetLabel(panel.name)}</span>
                              {isUp && <span className="ml-1 text-green-400">👍</span>}
                              {isDown && <span className="ml-1 text-red-500">👎</span>}
                            </div>
                          </div>
                        )
                      } else {
                      // Render empty placeholder panel to keep 2x2 grid balanced
                      return (
                        <div
                          key={`empty-${offset}`}
                          className="min-h-0 min-w-0 relative flex flex-col opacity-30 border border-dashed border-green-950"
                        >
                          <Panel title="REVIEW // EMPTY SLOT">
                            <div className="h-full bg-black flex items-center justify-center text-xs text-green-900">
                              [ NO SYSTEM INTEL ]
                            </div>
                          </Panel>
                        </div>
                      )
                    }
                  }))}
                </div>
              )}
            </div>

            {/* Bewertungsleiste — schmaler Streifen unten, bricht auf Mobile um */}
            <div className="border border-green-900 bg-black shrink-0 flex flex-col md:flex-row gap-2 p-2 text-xs">
              {/* Erste Zeile: Navigation, Rating & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 w-full md:w-auto">
                {/* Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      goToPanel((reviewIdx - 1 + totalPanels) % totalPanels)
                    }}
                    className="border border-green-800 text-green-500 text-xs px-2 py-1
                               hover:border-green-500 hover:text-green-200 transition-colors cursor-pointer"
                  >
                    ← PREV
                  </button>
                  <span className="text-green-800 text-xs whitespace-nowrap min-w-[70px] text-center">
                    {reviewIdx + 1} / {totalPanels}
                  </span>
                  <button
                    onClick={() => {
                      goToPanel((reviewIdx + 1) % totalPanels)
                    }}
                    className="border border-green-800 text-green-500 text-xs px-2 py-1
                               hover:border-green-500 hover:text-green-200 transition-colors cursor-pointer"
                  >
                    NEXT →
                  </button>
                </div>

                {/* Daumen rauf / runter */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRating('up')}
                    title="Daumen rauf"
                    className={`border text-xs px-2.5 py-1 transition-colors cursor-pointer
                      ${reviewRating === 'up'
                        ? 'border-green-400 text-green-200 bg-green-950'
                        : 'border-green-800 text-green-600 hover:border-green-500 hover:text-green-200'
                      }`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleRating('down')}
                    title="Daumen runter"
                    className={`border text-xs px-2.5 py-1 transition-colors cursor-pointer
                      ${reviewRating === 'down'
                        ? 'border-red-500 text-red-300 bg-red-950'
                        : 'border-green-800 text-green-600 hover:border-green-500 hover:text-green-200'
                      }`}
                  >
                    👎
                  </button>
                  {savedForCurrent && (
                    <span className="text-green-900 text-xs ml-1 whitespace-nowrap">
                      saved: {savedForCurrent.rating === 'up' ? '👍' : '👎'}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setHideArchived(prev => !prev)}
                    title="Archivierte Panels (Daumen runter) ausblenden"
                    className={`border text-[10px] px-2 py-1 transition-colors cursor-pointer ${
                      hideArchived
                        ? 'border-red-500 text-red-300 bg-red-950/20'
                        : 'border-green-800 text-green-600 hover:border-green-500 hover:text-green-300'
                    }`}
                  >
                    {hideArchived ? 'SHOW ARCHIVED' : 'HIDE ARCHIVED'}
                  </button>
                  <button
                    onClick={() => {
                      const data = loadReviews()
                      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                        .catch(() => {/* clipboard blocked */})
                    }}
                    title="Alle Bewertungen als JSON in Zwischenablage kopieren"
                    className="border border-green-800 text-green-600 hover:border-green-500 hover:text-green-300 text-[10px] px-2 py-1 transition-colors cursor-pointer"
                  >
                    COPY
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Alle Kommentare und Bewertungen zurücksetzen?")) {
                        localStorage.removeItem(LS_KEY)
                        localStorage.removeItem(SEED_KEY) // Also reset seed state to allow fresh seeding
                        window.location.reload()
                      }
                    }}
                    title="Alle Bewertungen und Kommentare löschen"
                    className="border border-red-800 text-red-600 hover:border-red-500 hover:text-red-300 text-[10px] px-2 py-1 transition-colors cursor-pointer"
                  >
                    RESET
                  </button>
                </div>
              </div>

              {/* Zweite Zeile: Kommentar-Textarea */}
              <div className="flex-1 flex items-center gap-2 w-full">
                <span className="text-green-800 text-xs hidden md:inline whitespace-nowrap">COMMENT:</span>
                <textarea
                  ref={commentRef}
                  rows={1}
                  placeholder="Optional review comment..."
                  onBlur={() => {
                    if (reviewRating) {
                      saveReview({
                        panel:   ALL_PANELS[reviewIdx].name,
                        rating:  reviewRating,
                        comment: commentRef.current?.value ?? '',
                        ts:      Date.now(),
                      })
                    }
                  }}
                  className="flex-1 bg-black border border-green-900 text-green-400 text-xs
                             font-mono resize-none px-2 py-1
                             focus:outline-none focus:border-green-600
                             placeholder:text-green-900"
                />
              </div>
            </div>

          </div>
        ) : (
          /* ── Normaler Modus: Layout-Slides ── */
          <>
            {isMobile ? (
              /* ── Mobile Layout — nur unter 768px sichtbar ── */
              <div className="flex flex-col gap-1 h-full p-1">
                {/* Panel 1: Text-Panel */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={textPool}
                    activeIdx={mobileIndices.textIdx}
                    onNav={() => handleSkipMobileSlot(0)}
                    fallbackName={getCompName(textPool[mobileIndices.textIdx])}
                    className="h-full"
                  />
                </div>
                {/* Panel 2: Grafik-Panel 1 */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={gfxPool}
                    activeIdx={mobileIndices.gfxIdx1}
                    onNav={() => handleSkipMobileSlot(1)}
                    fallbackName={getCompName(gfxPool[mobileIndices.gfxIdx1])}
                    className="h-full"
                    locked={AUDIO_PANELS.has(getCompName(gfxPool[mobileIndices.gfxIdx1]))}
                  />
                </div>
                {/* Panel 3: Grafik-Panel 2 */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={gfxPool}
                    activeIdx={mobileIndices.gfxIdx2}
                    onNav={() => handleSkipMobileSlot(2)}
                    fallbackName={getCompName(gfxPool[mobileIndices.gfxIdx2])}
                    className="h-full"
                    locked={AUDIO_PANELS.has(getCompName(gfxPool[mobileIndices.gfxIdx2]))}
                  />
                </div>
                {/* Panel 4: Grafik-Panel 3 */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={gfxPool}
                    activeIdx={mobileIndices.gfxIdx3}
                    onNav={() => handleSkipMobileSlot(3)}
                    fallbackName={getCompName(gfxPool[mobileIndices.gfxIdx3])}
                    className="h-full"
                    locked={AUDIO_PANELS.has(getCompName(gfxPool[mobileIndices.gfxIdx3]))}
                  />
                </div>
              </div>
            ) : (
              /* ── Desktop Layout — ab 768px sichtbar ── */
              <div className="h-full relative">
                {/* Outgoing Layout — animiert nach links heraus */}
                {sliding && prevLayout !== null && (
                  <div
                    key={`out-${prevLayout.id}`}
                    className="absolute inset-0 p-1 layout-slide-out"
                    aria-hidden="true"
                    style={{ contain: 'paint' }}
                  >
                    <LayoutContent layout={prevLayout} onNavSlot={() => {}} textPool={textPool} gfxPool={gfxPool} />
                  </div>
                )}

                {/* Aktuelles Layout — animiert von rechts herein (oder statisch beim ersten Render) */}
                <div
                  key={`in-${layout.id}`}
                  className={sliding ? 'absolute inset-0 p-1 layout-slide-in' : 'h-full p-1'}
                >
                  <LayoutContent layout={layout} onNavSlot={handleNavSlot} textPool={textPool} gfxPool={gfxPool} />
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}

// ── Aspect-Ratio-Gruppen (Layout-V2, 2026-05-31) ─────────────────────────────
type Aspect = 'WIDE' | 'SQUARE' | 'TALL' | 'ANY' | 'TEXT'

const PANEL_ASPECT: Record<string, Aspect> = {
  VoxelDemoColor:        'WIDE',
  VoxelDemoBW:           'WIDE',
  VoxelThermal:          'WIDE',
  VoxelLava:             'WIDE',
  StarfieldScene:        'WIDE',
  ElitePanel:            'WIDE',
  ParallaxPanel:         'WIDE',
  EnhanceView:           'WIDE',
  RetroErrorPanel:       'WIDE',
  DaggerfallPanel:       'WIDE',
  OscilloscopePanel:     'WIDE',
  ThermonuclearWarPanel: 'WIDE',
  PhysicsSandboxPanel:   'WIDE',
  GlobePanel:        'SQUARE',
  RadarSweepPanel:   'SQUARE',
  SolarSystemPanel:  'SQUARE',
  MoonPanel:         'SQUARE',
  C64Panel:          'SQUARE',
  AllYourBase:       'SQUARE',
  AmiModPanel:       'SQUARE',
  ShaderHackingCore: 'SQUARE',
  TixyPanel:         'SQUARE',
  VoxelNeon:         'SQUARE',
  ThreeBodyScene:    'SQUARE',
  TunnelScene:       'SQUARE',
  DotCloudScene:     'SQUARE',
  NuclearExplosionPanel: 'TALL',
  SystemLog:         'TEXT',
  DataStream:        'TEXT',
  Vitals:            'TEXT',
  PortScanner:       'TEXT',
  PseudoCode:        'TEXT',
  AgentCodePanel:    'TEXT',
  VisitorProfilePanel: 'TEXT',
  ICQChatPanel:      'TEXT',
  DiskCleanupPanel:  'TEXT',
  StockTickerPanel:  'TEXT',
  SatellitePanel:    'TEXT',
  ClassifiedPanel:   'TEXT',
  MetaAgentPanel:    'TEXT',
  FractalSeahorse:       'ANY',
  FractalSpiral:         'ANY',
  FractalLightning:      'ANY',
  FractalElephant:       'ANY',
  FractalMini:           'ANY',
  FractalSatellite:      'ANY',
  FractalTendril:        'ANY',
  FractalDragon:         'ANY',
  FractalDendrite:       'ANY',
  FractalSwirl:          'ANY',
  FractalJulia:          'ANY',
  PlasmaDemo:            'ANY',
  ShaderMandelbox:       'ANY',
  ShaderRetroWave:       'ANY',
  LidarScanPanel:        'ANY',
  IQSmoothMin:           'ANY',
  IQDigitalStorm:        'ANY',
  LovebyteShowcasePanel: 'ANY',
  MandelbulbScene:       'ANY',
  ApollonianGasketScene: 'ANY',
  MengerSpongeScene:     'ANY',
}

function cellAspect(cell: GridCell): Aspect {
  const colParts = cell.gridColumn.split('/').map(s => parseInt(s.trim(), 10))
  const rowParts = cell.gridRow.split('/').map(s => parseInt(s.trim(), 10))
  const colSpan = colParts[1] - colParts[0]
  const rowSpan = rowParts[1] - rowParts[0]
  if (colSpan === 1 && rowSpan === 1) return 'SQUARE'
  if (colSpan > rowSpan) return 'WIDE'
  if (rowSpan > colSpan) return 'TALL'
  return 'SQUARE'
}

function aspectMatches(panelAspect: Aspect, cellAspect: Aspect): boolean {
  if (panelAspect === 'ANY' || panelAspect === 'TEXT') return true
  return panelAspect === cellAspect
}

const NO_LARGE_PANELS = new Set([
  'C64Panel',
  'ThermonuclearWarPanel',
  'AllYourBase',
])

function panelMayBeLarge(name: string): boolean {
  if (NO_LARGE_PANELS.has(name)) return false
  if (LARGE_PANELS.has(name)) return true
  return PANEL_ASPECT[name] !== 'TEXT'
}

// ── WebGL-Kontingent (Fix "SLOT EVICTED") ───────────────────────────────────
// Browser deckeln aktive WebGL-Kontexte (~8–16/Tab). Bei hoher Auslastung
// (Proxima ~30 Kacheln) übersteigt die Zahl der GL-Panels den Pool (siehe
// utils/webgl-pool.ts, MAX_GL_CONTEXTS=12) → der Pool verdrängt überzählige
// Kontexte und die betroffenen Panels zeigen dauerhaft "SLOT EVICTED TO CONSERVE
// POWER" (sie reaktivieren nur bei Sichtbarkeitswechsel — in einer statischen
// Galerie nie). Lösung: schon im Layout NIE mehr GL-Panels platzieren als der
// Pool fasst. Überzählige Zellen bekommen Canvas-2D-/DOM-Panels. Diese Liste
// nennt alle Komponenten, die einen WebGL-Kontext belegen (three.js, Shadertoy-
// /ShaderPanel-basiert, FractalGL).
const GL_PANELS = new Set<string>([
  // Fraktal-Shader
  'FractalSeahorse', 'FractalSpiral', 'FractalLightning', 'FractalElephant',
  'FractalMini', 'FractalSatellite', 'FractalTendril', 'FractalDragon',
  'FractalDendrite', 'FractalSwirl', 'FractalJulia',
  'MandelbulbScene', 'ApollonianGasketScene', 'MengerSpongeScene',
  // Demo-Szenen (three.js / GL)
  'TunnelScene', 'RotozoomScene', 'FireScene', 'MetaballsScene',
  'LissajousScene', 'StarfieldScene', 'ThreeBodyScene', 'DotCloudScene',
  // Voxel-Renderer
  'VoxelDemoColor', 'VoxelDemoBW', 'VoxelThermal', 'VoxelLava',
  'VoxelNeon', 'VoxelNeonGrid', 'VoxelMatrix',
  // Shadertoy-/ShaderPanel-basiert
  'ShaderHackingCore', 'ShaderRetroWave', 'ShaderMandelbox',
  'IQSmoothMin', 'IQDigitalStorm', 'PlasmaDemo', 'LovebyteShowcasePanel',
  // Einzelne GL-Panels
  'GlobePanel', 'MoonPanel', 'NuclearExplosionPanel',
  'NeuralLinkDecoderPanel', 'CADRobotPanel',
])

// Sicherheitspuffer unter MAX_GL_CONTEXTS (12): das Fraktal-Hintergrundbild
// (FractalView) belegt selbst einen Kontext, daher max. 11 GL-Panels im Grid.
const MAX_GL_PANELS_PER_LAYOUT = 11

function isGLPanel(name: string): boolean {
  return GL_PANELS.has(name)
}

