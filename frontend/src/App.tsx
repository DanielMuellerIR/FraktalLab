import React, { useState, useEffect, useCallback, useRef, memo } from 'react'
import PanelSlot     from './ui/PanelSlot'
import FractalView   from './panels/FractalView'
import GlitchOverlay from './ui/GlitchOverlay'
import AmbientSound  from './ui/AmbientSound'
import Panel         from './ui/Panel'
import { getSharedAudioContext } from './utils/shared-audio'

// ── Text-Panels ───────────────────────────────────────────────────────────────
import SystemLog         from './panels/SystemLog'
import Vitals            from './panels/Vitals'
import DataStream        from './panels/DataStream'
import TrafficMonitor    from './panels/TrafficMonitor'
import SocialEngineering from './panels/SocialEngineering'
import NuclearTargets    from './panels/NuclearTargets'
import PwdCracker        from './panels/PwdCracker'
import PortScanner       from './panels/PortScanner'
import PseudoCode        from './panels/PseudoCode'
import AgentCodePanel    from './panels/AgentCodePanel'
import VisitorProfilePanel from './panels/VisitorProfilePanel'
import ICQChatPanel      from './panels/ICQChatPanel'
import BitcoinMinerPanel from './panels/BitcoinMinerPanel'
import DiskCleanupPanel  from './panels/DiskCleanupPanel'
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

// ── Panel-Pools ───────────────────────────────────────────────────────────────
const POOL_TEXT: React.ComponentType[] = [
  SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
  NuclearTargets, PwdCracker, PortScanner, PseudoCode,
  AgentCodePanel, VisitorProfilePanel, ICQChatPanel, BitcoinMinerPanel, DiskCleanupPanel,
  StockTickerPanel, SatellitePanel, ClassifiedPanel, MetaAgentPanel,
]

// Alle visuellen Panels in einem Pool — AllYourBase und EnhanceView sind normale Einträge
const POOL_GFX: React.ComponentType[] = [
  VoxelDemoColor, VoxelDemoBW, /* GlobePanel, */ VoxelThermal, VoxelLava, VoxelNeon, /* VoxelMatrix, */

  FireScene, StarfieldScene, ThreeBodyScene, /* LissajousScene, */
  /* OscilloscopePanel, */ TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
  PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
  ParallaxPanel, ElitePanel, AmiModPanel, CADRobotPanel, C64Panel, RetroErrorPanel, SolarSystemPanel,
  FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
  FractalElephant, FractalMini, FractalSatellite, FractalDragon,
  FractalDendrite, FractalSwirl,
  FractalJulia, RadarSweepPanel,
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

function generateMobileIndices(): { combinedIdx: number; gfxIdx: number; textIdx: number } {
  const gfxIdx = Math.floor(Math.random() * POOL_GFX.length);
  const textIdx = Math.floor(Math.random() * POOL_TEXT.length);
  const gfxComp = POOL_GFX[gfxIdx];
  const textComp = POOL_TEXT[textIdx];

  const combinedPool = [...POOL_TEXT, ...POOL_GFX];
  const eligibleCombined: number[] = [];
  combinedPool.forEach((comp, i) => {
    if (comp !== gfxComp && comp !== textComp) {
      eligibleCombined.push(i);
    }
  });

  const combinedIdx = eligibleCombined[Math.floor(Math.random() * eligibleCombined.length)];
  return { combinedIdx, gfxIdx, textIdx };
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

/**
 * Erzeugt ein vollständig zufälliges CSS-Grid-Layout.
 * @param id Eindeutiger Zähler — wird als React-Key verwendet
 */
function generateLayout(id: number): GeneratedLayout {
  // 1. Gittergröße: cols × rows basierend auf der Bildschirmbreite
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200
  let sizes: [number, number][]

  if (width >= 3440) {
    // Ultra-wide / massive developer screens: noch mehr Panels zeigen!
    sizes = [[6, 4], [7, 4], [8, 4]]
  } else if (width >= 2560) {
    // QHD / 4K Bildschirme
    sizes = [[5, 4], [6, 3], [6, 4]]
  } else if (width >= 1920) {
    // Full HD / größere Monitore
    sizes = [[4, 3], [4, 4], [5, 3]]
  } else if (width >= 1440) {
    // QHD Laptop / mittlere Monitore
    sizes = [[3, 3], [4, 3]]
  } else if (width >= 1024) {
    // Standard Desktop / Tablet im Querformat
    sizes = [[3, 2], [3, 3]]
  } else {
    // Kleine Desktops / Tablet im Hochformat (ab 768px)
    sizes = [[2, 2], [3, 2]]
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

  // Verbleibende Zellen: abwechselnd 'text' und 'gfx'
  let altIdx = 0
  let hasText = false
  let hasGfx  = false

  // Alle Positionen im Grid durchgehen
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (occupied.has(`${c},${r}`)) continue  // bereits durch Fraktal belegt

      // Typen abwechseln
      const type: CellType = altIdx % 2 === 0 ? 'text' : 'gfx'
      altIdx++

      if (type === 'text') hasText = true
      if (type === 'gfx')  hasGfx  = true

      cells.push({
        type,
        gridColumn: `${c} / ${c + 1}`,
        gridRow:    `${r} / ${r + 1}`,
      })
    }
  }

  // Mindestens 1× 'text' und 1× 'gfx' sicherstellen
  // (kann bei kleinen Grids mit großem Span fehlen)
  if (!hasText) {
    // Erste 'gfx'-Zelle zu 'text' machen
    const gfxCell = cells.find(cell => cell.type === 'gfx')
    if (gfxCell) gfxCell.type = 'text'
  }
  if (!hasGfx) {
    // Erste 'text'-Zelle (die nicht fractal ist) zu 'gfx' machen
    const textCell = cells.find(cell => cell.type === 'text')
    if (textCell) textCell.type = 'gfx'
  }

  // Assign unique indices for text and gfx cells
  const textIndices = Array.from({ length: POOL_TEXT.length }, (_, i) => i)
  const gfxIndices = Array.from({ length: POOL_GFX.length }, (_, i) => i)

  // Shuffle textIndices
  for (let i = textIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [textIndices[i], textIndices[j]] = [textIndices[j], textIndices[i]]
  }

  // Shuffle gfxIndices
  for (let i = gfxIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gfxIndices[i], gfxIndices[j]] = [gfxIndices[j], gfxIndices[i]]
  }

  let textIdxPtr = 0
  let gfxIdxPtr = 0

  cells.forEach(cell => {
    if (cell.type === 'text') {
      cell.panelIdx = textIndices[textIdxPtr++ % textIndices.length]
    } else if (cell.type === 'gfx') {
      cell.panelIdx = gfxIndices[gfxIdxPtr++ % gfxIndices.length]
    }
  })

  return { id, gridTemplateColumns, gridTemplateRows, cells }
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

  // --- Text Panels ---
  { name: 'ICQChatPanel',       Component: ICQChatPanel },
  { name: 'VisitorProfilePanel',Component: VisitorProfilePanel },
  { name: 'SatellitePanel',     Component: SatellitePanel },
  { name: 'BitcoinMinerPanel',  Component: BitcoinMinerPanel },
  { name: 'SystemLog',          Component: SystemLog },
  { name: 'DataStream',         Component: DataStream },
  { name: 'SocialEngineering',  Component: SocialEngineering },
  { name: 'Vitals',             Component: Vitals },
  { name: 'TrafficMonitor',     Component: TrafficMonitor },
  { name: 'NuclearTargets',     Component: NuclearTargets },
  { name: 'PwdCracker',         Component: PwdCracker },
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

// ── localStorage-Helfer für Reviews ──────────────────────────────────────────

/** Ein einzelner Review-Eintrag */
interface ReviewEntry {
  panel:   string           // Panel-Name (stabile ID)
  rating:  'up' | 'down'   // Daumen rauf oder runter
  comment: string           // optionaler Kommentar-Text
  ts:      number           // Unix-Timestamp (ms)
}

const LS_KEY = 'fraktallab_reviews'

/** Liest alle Reviews aus localStorage. Gibt leeres Array zurück bei Fehler. */
function loadReviews(): ReviewEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as ReviewEntry[]
  } catch {
    return []
  }
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
  const vid = document.querySelector<HTMLVideoElement>('video')
  const vidPlaying = !!vid && !vid.muted && !vid.paused
  const modPlaying = !!(window as any).fraktallab_mod_playing
  return vidPlaying || modPlaying
}

// ── Layout-Renderer ───────────────────────────────────────────────────────────
function LayoutContent({
  layout,
  onSkipSlot,
}: {
  layout: GeneratedLayout
  onSkipSlot: (slotIndex: number) => void
}) {
  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: layout.gridTemplateColumns,
        gridTemplateRows:    layout.gridTemplateRows,
        gap:                 '4px',
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
              pool={POOL_TEXT}
              activeIdx={cell.panelIdx!}
              onSkip={() => onSkipSlot(i)}
              className="h-full"
            />
          )}
          {cell.type === 'gfx'     && (
            <PanelSlot
              key={`${layout.id}-gfx-${i}`}
              pool={POOL_GFX}
              activeIdx={cell.panelIdx!}
              onSkip={() => onSkipSlot(i)}
              className="h-full"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function App() {
  // Aufsteigender ID-Zähler für React-Keys — als Ref, um Stale-Closure-Probleme zu vermeiden
  const layoutIdRef = useRef(0)
  const [layout,     setLayout]     = useState<GeneratedLayout>(() => generateLayout(0))
  const [prevLayout, setPrevLayout] = useState<GeneratedLayout | null>(null)
  const [sliding,    setSliding]    = useState(false)
  // Ambient Sound: standardmäßig eingeschaltet
  const [soundEnabled, setSoundEnabled] = useState(true)

  const [mobileIndices, setMobileIndices] = useState(() => generateMobileIndices())

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

  const handleSkipSlot = useCallback((slotIndex: number) => {
    setLayout(curr => {
      const cell = curr.cells[slotIndex]
      if (!cell) return curr

      const pool = cell.type === 'text' ? POOL_TEXT : POOL_GFX

      // Get all currently active components in OTHER slots of this layout
      const otherActiveComps = new Set<React.ComponentType<any>>()
      curr.cells.forEach((c, idx) => {
        if (idx !== slotIndex) {
          if (c.type === 'text') {
            otherActiveComps.add(POOL_TEXT[c.panelIdx!])
          } else if (c.type === 'gfx') {
            otherActiveComps.add(POOL_GFX[c.panelIdx!])
          }
        }
      })

      const currentComp = pool[cell.panelIdx!]
      const candidates: number[] = []
      pool.forEach((comp, i) => {
        if (comp !== currentComp && !otherActiveComps.has(comp)) {
          candidates.push(i)
        }
      })

      const chosenIdx = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.floor(Math.random() * pool.length)

      const newCells = [...curr.cells]
      newCells[slotIndex] = {
        ...cell,
        panelIdx: chosenIdx,
      }

      return {
        ...curr,
        cells: newCells,
      }
    })
  }, [])

  const handleSkipMobileSlot = useCallback((slotIndex: number) => {
    setMobileIndices(curr => {
      const combinedPool = [...POOL_TEXT, ...POOL_GFX]
      const otherActiveComps = new Set<React.ComponentType<any>>()

      if (slotIndex !== 0) {
        otherActiveComps.add(combinedPool[curr.combinedIdx])
      }
      if (slotIndex !== 1) {
        otherActiveComps.add(POOL_GFX[curr.gfxIdx])
      }
      if (slotIndex !== 2) {
        otherActiveComps.add(POOL_TEXT[curr.textIdx])
      }

      let pool: React.ComponentType<any>[]
      let currentIdx: number
      if (slotIndex === 0) {
        pool = combinedPool
        currentIdx = curr.combinedIdx
      } else if (slotIndex === 1) {
        pool = POOL_GFX
        currentIdx = curr.gfxIdx
      } else {
        pool = POOL_TEXT
        currentIdx = curr.textIdx
      }

      const currentComp = pool[currentIdx]
      const candidates: number[] = []
      pool.forEach((comp, i) => {
        if (comp !== currentComp && !otherActiveComps.has(comp)) {
          candidates.push(i)
        }
      })

      const chosenIdx = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.floor(Math.random() * pool.length)

      if (slotIndex === 0) {
        return { ...curr, combinedIdx: chosenIdx }
      } else if (slotIndex === 1) {
        return { ...curr, gfxIdx: chosenIdx }
      } else {
        return { ...curr, textIdx: chosenIdx }
      }
    })
  }, [])

  // Automatische Review-Zurücksetzung bei Versionsänderung
  useEffect(() => {
    const RESET_VERSION = 'v1.1.0-reset-1'
    const currentReset = localStorage.getItem('fraktallab_reset_version')
    if (currentReset !== RESET_VERSION) {
      localStorage.removeItem(LS_KEY)
      localStorage.setItem('fraktallab_reset_version', RESET_VERSION)
    }
  }, [])


  // ── Review-Modus-State ─────────────────────────────────────────────────────
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIdx,  setReviewIdx]  = useState(0)
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
    if (reviewRating) {
      saveReview({
        panel:   ALL_PANELS[reviewIdx].name,
        rating:  reviewRating,
        comment: commentRef.current?.value ?? '',
        ts:      Date.now(),
      })
    }
    setReviewIdx(idx)
    loadPanelReview(ALL_PANELS[idx].name)
  }, [reviewIdx, reviewRating, loadPanelReview])

  /** Öffnet den Review-Modus und lädt die Bewertung für das erste Panel */
  const enterReview = useCallback(() => {
    setReviewMode(true)
    setReviewIdx(0)
    loadPanelReview(ALL_PANELS[0].name)
  }, [loadPanelReview])

  /** Wählt Daumen und speichert sofort — kein separater Save-Schritt nötig */
  const handleRating = useCallback((rating: 'up' | 'down') => {
    setReviewRating(rating)
    saveReview({
      panel:   ALL_PANELS[reviewIdx].name,
      rating,
      comment: commentRef.current?.value ?? '',
      ts:      Date.now(),
    })
  }, [reviewIdx])

  // Ref für den laufenden Auto-Switch-Timer — wird bei jedem Wechsel neu gesetzt
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSwitch = useCallback((current: GeneratedLayout) => {
    // Neue ID vergeben und neues Layout generieren
    layoutIdRef.current += 1
    const next = generateLayout(layoutIdRef.current)

    setPrevLayout(current)
    setSliding(true)
    setLayout(next)

    // Animation nach 520 ms beenden (etwas länger als die 500 ms CSS-Animation)
    setTimeout(() => {
      setPrevLayout(null)
      setSliding(false)
    }, 520)
  }, [])

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

  // Immer wenn sich layout ändert, neuen Auto-Switch-Timer setzen
  useEffect(() => {
    scheduleNext()
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }, [layout, scheduleNext])

  // Leertaste → sofortiger Layout-Wechsel (nicht im Review-Modus oder in Textfeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !reviewMode) {
        e.preventDefault()
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
        goToPanel((reviewIdx + 1) % ALL_PANELS.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goToPanel((reviewIdx - 1 + ALL_PANELS.length) % ALL_PANELS.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewMode, reviewIdx, goToPanel])

  // ── abgeleitete Variablen für den Review-Modus ─────────────────────────────
  const totalPanels    = ALL_PANELS.length
  const currentPanel   = ALL_PANELS[reviewIdx]
  // Bereits gespeicherte Bewertung für das aktuelle Panel (für grüne Hervorhebung nach SAVE)
  const savedReviews   = reviewMode ? loadReviews() : []
  const savedForCurrent = savedReviews.find(r => r.panel === currentPanel?.name)

  return (
    <div className="bg-black text-green-400 h-screen flex flex-col font-mono overflow-hidden">

      {/* Bildstörungs-Overlay — auf Mobile ausgeblendet, zu ablenkend auf kleinen Screens */}
      <div className="hidden md:block">
        <GlitchOverlay />
      </div>

      {/* Ambient-Sound — rendert nichts, erzeugt nur Töne */}
      <AmbientSound enabled={soundEnabled} />

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v1.1.0
        </span>
        <span className="ml-auto text-red-800 text-xs animate-pulse">● LIVE</span>

        {/* Ambient-Sound-Toggle */}
        <button
          onClick={() => {
            if (!soundEnabled) {
              // AudioContext im User-Gesture-Callstack vorab aufwecken/erstellen
              try {
                const ctx = getSharedAudioContext()
                if (ctx.state === 'suspended') {
                  ctx.resume().catch(() => {})
                }
                const buffer = ctx.createBuffer(1, 1, 22050)
                const source = ctx.createBufferSource()
                source.buffer = buffer
                source.connect(ctx.destination)
                source.start(0)
              } catch (e) {
                console.warn('Failed to unlock AudioContext on click:', e)
              }
            }
            setSoundEnabled(e => !e)
          }}
          title="Ambient Sound umschalten"
          className="border border-green-800 text-green-600 text-xs px-2 py-0.5
                     hover:border-green-600 hover:text-green-200 transition-colors"
        >
          {soundEnabled ? 'AUDIO ON' : 'AUDIO OFF'}
        </button>

        {/* Layout-Wechsel-Button — nur auf Desktop, im Review-Modus ausgeblendet */}
        {!reviewMode && (
          <button
            onClick={() => setLayout(current => { doSwitch(current); return current })}
            title="Zufälliges neues Layout generieren (auch: Leertaste)"
            className="hidden md:inline-flex border border-green-800 text-green-600 text-xs px-2 py-0.5
                       hover:border-green-600 hover:text-green-200 transition-colors"
          >
            ⟳ LAYOUT
          </button>
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
            <div className="flex-1 min-h-0 bg-black">
              {isMobile ? (
                /* Auf Mobile (unter 768px) rendern wir NUR das eine aktive Panel */
                <div className="h-full flex flex-col">
                  {(() => {
                    const panel = ALL_PANELS[reviewIdx]
                    const Comp = panel.Component
                    const labelText = `${String(reviewIdx + 1).padStart(2, '0')} ${panel.name}`
                    return (
                      <Panel
                        title={`REVIEW // ${panel.name} [${reviewIdx + 1}/${totalPanels}]`}
                        rightLabel={labelText}
                      >
                        <Comp />
                      </Panel>
                    )
                  })()}
                </div>
              ) : (
                /* Auf Desktop rendern wir das 2x2 Grid (4 Panels) */
                <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 bg-black">
                  {[0, 1, 2, 3].map(offset => {
                    const pageStartIdx = Math.floor(reviewIdx / 4) * 4
                    const idx = pageStartIdx + offset
                    if (idx < totalPanels) {
                      const panel = ALL_PANELS[idx]
                      const Comp = panel.Component
                      const isActive = idx === reviewIdx
                      const labelText = `${String(idx + 1).padStart(2, '0')} ${panel.name}`
                      return (
                        <div
                          key={panel.name}
                          className={`min-h-0 min-w-0 relative flex flex-col transition-all duration-200 cursor-pointer ${
                            isActive ? 'ring-2 ring-green-500 border border-green-500 z-10' : 'opacity-65 hover:opacity-95'
                          }`}
                          onClick={() => goToPanel(idx)}
                        >
                          <Panel
                            title={`REVIEW // ${panel.name} [${idx + 1}/${totalPanels}]`}
                            className={isActive ? 'border-green-500' : ''}
                            rightLabel={labelText}
                          >
                            <Comp />
                          </Panel>
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
                  })}
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
                {/* Panel 1: gemischter Pool aus Text und GFX */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={[...POOL_TEXT, ...POOL_GFX]}
                    activeIdx={mobileIndices.combinedIdx}
                    onSkip={() => handleSkipMobileSlot(0)}
                    className="h-full"
                  />
                </div>
                {/* Panel 2: Grafik-Panel */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={POOL_GFX}
                    activeIdx={mobileIndices.gfxIdx}
                    onSkip={() => handleSkipMobileSlot(1)}
                    className="h-full"
                  />
                </div>
                {/* Panel 3: Text-Panel */}
                <div className="flex-1 min-h-0">
                  <PanelSlot
                    pool={POOL_TEXT}
                    activeIdx={mobileIndices.textIdx}
                    onSkip={() => handleSkipMobileSlot(2)}
                    className="h-full"
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
                    <LayoutContent layout={prevLayout} onSkipSlot={() => {}} />
                  </div>
                )}

                {/* Aktuelles Layout — animiert von rechts herein (oder statisch beim ersten Render) */}
                <div
                  key={`in-${layout.id}`}
                  className={sliding ? 'absolute inset-0 p-1 layout-slide-in' : 'h-full p-1'}
                >
                  <LayoutContent layout={layout} onSkipSlot={handleSkipSlot} />
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}
