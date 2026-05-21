import { useState, useEffect, useCallback, useRef } from 'react'
import PanelSlot     from './ui/PanelSlot'
import FractalView   from './panels/FractalView'
import GlitchOverlay from './ui/GlitchOverlay'
import AmbientSound  from './ui/AmbientSound'
import Panel         from './ui/Panel'

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
import ClaudeCodePanel   from './panels/ClaudeCodePanel'
import VisitorProfilePanel from './panels/VisitorProfilePanel'
import ICQChatPanel      from './panels/ICQChatPanel'
import BitcoinMinerPanel from './panels/BitcoinMinerPanel'
import DiskCleanupPanel  from './panels/DiskCleanupPanel'
import StockTickerPanel  from './panels/StockTickerPanel'
import SatellitePanel    from './panels/SatellitePanel'
import ClassifiedPanel   from './panels/ClassifiedPanel'

// ── Grafik-Panels ─────────────────────────────────────────────────────────────
import VoxelDemo         from './panels/VoxelDemo'
import { VoxelThermal, VoxelNeon, VoxelLava, VoxelMatrix } from './panels/VoxelScenes'
import PlasmaDemo        from './panels/PlasmaDemo'
import EnhanceView       from './panels/EnhanceView'
import AllYourBase       from './panels/AllYourBase'
import GlobePanel        from './panels/GlobePanel'
import DNAHelix          from './panels/DNAHelix'
import OscilloscopePanel from './panels/OscilloscopePanel'
import {
  FireScene, StarfieldScene, TunnelScene, RotozoomScene,
  MetaballsScene, DotCloudScene, BoingScene, LissajousScene,
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
  FractalMini, FractalSatellite, FractalTendril,
} from './panels/FractalScenes'
import FractalJulia from './panels/FractalJulia'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
const POOL_TEXT: React.ComponentType[] = [
  SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
  NuclearTargets, PwdCracker, PortScanner, PseudoCode,
  ClaudeCodePanel, VisitorProfilePanel, ICQChatPanel, BitcoinMinerPanel, DiskCleanupPanel,
  StockTickerPanel, SatellitePanel, ClassifiedPanel,
]

// Alle visuellen Panels in einem Pool — AllYourBase und EnhanceView sind normale Einträge
const POOL_GFX: React.ComponentType[] = [
  VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,
  FireScene, StarfieldScene, BoingScene, LissajousScene,
  OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
  PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
  ParallaxPanel, ElitePanel, AmiModPanel, CADRobotPanel, C64Panel, RetroErrorPanel, SolarSystemPanel,
  FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
  FractalElephant, FractalMini, FractalSatellite,
  FractalJulia, RadarSweepPanel,
]

// ── Zufallslayout-Generator ───────────────────────────────────────────────────

type CellType = 'fractal' | 'text' | 'gfx'

interface GridCell {
  type:       CellType
  gridColumn: string  // CSS-Wert, z.B. "1 / 3"
  gridRow:    string  // CSS-Wert, z.B. "1 / 2"
}

interface GeneratedLayout {
  id:                  number   // aufsteigender Zähler für React-Keys
  gridTemplateColumns: string   // z.B. "28fr 44fr 28fr"
  gridTemplateRows:    string   // z.B. "60fr 40fr"
  cells:               GridCell[]
}

/**
 * Teilt 100 in n positive Ganzzahlen auf, jede mindestens 12.
 * Balanciert durch leicht verrauschte Gleichverteilung.
 */
function randomPartition(n: number): number[] {
  // Jeder Anteil bekommt einen zufälligen Wert nahe 1, dann normiert auf 100
  const raw = Array.from({ length: n }, () => 0.5 + Math.random())
  const sum  = raw.reduce((a, b) => a + b, 0)
  const result = raw.map(v => Math.max(12, Math.round(v * 100 / sum)))
  // Rundungsfehler im letzten Element korrigieren
  const diff = 100 - result.reduce((a, b) => a + b, 0)
  result[result.length - 1] = Math.max(12, result[result.length - 1] + diff)
  return result
}

/**
 * Erzeugt ein vollständig zufälliges CSS-Grid-Layout.
 * @param id Eindeutiger Zähler — wird als React-Key verwendet
 */
function generateLayout(id: number): GeneratedLayout {
  // 1. Zufällige Gittergröße: cols × rows aus vier Optionen
  const sizes: [number, number][] = [[2, 2], [3, 2], [2, 3], [3, 3]]
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
  const endCol = Math.min(startCol + colSpan, cols + 1)
  const endRow = Math.min(startRow + rowSpan, rows + 1)
  const actualColSpan = endCol - startCol
  const actualRowSpan = endRow - startRow

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

  return { id, gridTemplateColumns, gridTemplateRows, cells }
}

// ── Review-Modus: alle Panels als geordnete Liste ─────────────────────────────
// Jeder Eintrag hat einen stabilen Namen (Funktionsname) als ID für localStorage.
const ALL_PANELS: { name: string; Component: React.ComponentType }[] = [
  // --- Text-Panels ---
  { name: 'SystemLog',          Component: SystemLog },
  { name: 'DataStream',         Component: DataStream },
  { name: 'SocialEngineering',  Component: SocialEngineering },
  { name: 'Vitals',             Component: Vitals },
  { name: 'TrafficMonitor',     Component: TrafficMonitor },
  { name: 'NuclearTargets',     Component: NuclearTargets },
  { name: 'PwdCracker',         Component: PwdCracker },
  { name: 'PortScanner',        Component: PortScanner },
  { name: 'PseudoCode',         Component: PseudoCode },
  { name: 'ClaudeCodePanel',    Component: ClaudeCodePanel },
  { name: 'VisitorProfilePanel',Component: VisitorProfilePanel },
  { name: 'ICQChatPanel',       Component: ICQChatPanel },
  { name: 'BitcoinMinerPanel',  Component: BitcoinMinerPanel },
  { name: 'DiskCleanupPanel',   Component: DiskCleanupPanel },
  { name: 'StockTickerPanel',   Component: StockTickerPanel },
  { name: 'SatellitePanel',     Component: SatellitePanel },
  { name: 'ClassifiedPanel',    Component: ClassifiedPanel },
  // --- Grafik-Panels ---
  { name: 'VoxelDemo',          Component: VoxelDemo },
  { name: 'GlobePanel',         Component: GlobePanel },
  { name: 'VoxelThermal',       Component: VoxelThermal },
  { name: 'VoxelLava',          Component: VoxelLava },
  { name: 'VoxelNeon',          Component: VoxelNeon },
  { name: 'VoxelMatrix',        Component: VoxelMatrix },
  { name: 'FireScene',          Component: FireScene },
  { name: 'StarfieldScene',     Component: StarfieldScene },
  { name: 'BoingScene',         Component: BoingScene },
  { name: 'LissajousScene',     Component: LissajousScene },
  { name: 'OscilloscopePanel',  Component: OscilloscopePanel },
  { name: 'TunnelScene',        Component: TunnelScene },
  { name: 'MetaballsScene',     Component: MetaballsScene },
  { name: 'RotozoomScene',      Component: RotozoomScene },
  { name: 'DotCloudScene',      Component: DotCloudScene },
  { name: 'PlasmaDemo',         Component: PlasmaDemo },
  { name: 'DNAHelix',           Component: DNAHelix },
  { name: 'EnhanceView',        Component: EnhanceView },
  { name: 'AllYourBase',        Component: AllYourBase },
  { name: 'ParallaxPanel',      Component: ParallaxPanel },
  { name: 'ElitePanel',         Component: ElitePanel },
  { name: 'AmiModPanel',        Component: AmiModPanel },
  { name: 'CADRobotPanel',      Component: CADRobotPanel },
  { name: 'C64Panel',           Component: C64Panel },
  { name: 'RetroErrorPanel',    Component: RetroErrorPanel },
  { name: 'FractalSeahorse',    Component: FractalSeahorse },
  { name: 'FractalSpiral',      Component: FractalSpiral },
  { name: 'FractalTendril',     Component: FractalTendril },
  { name: 'FractalLightning',   Component: FractalLightning },
  { name: 'FractalElephant',    Component: FractalElephant },
  { name: 'FractalMini',        Component: FractalMini },
  { name: 'FractalSatellite',   Component: FractalSatellite },
  { name: 'FractalJulia',       Component: FractalJulia },
  { name: 'SolarSystemPanel',   Component: SolarSystemPanel },
  { name: 'RadarSweepPanel',    Component: RadarSweepPanel },
]

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
  return !!vid && !vid.muted && !vid.paused
}

// ── Layout-Renderer ───────────────────────────────────────────────────────────
function LayoutContent({ layout }: { layout: GeneratedLayout }) {
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
          {cell.type === 'text'    && <PanelSlot pool={POOL_TEXT} className="h-full" />}
          {cell.type === 'gfx'     && <PanelSlot pool={POOL_GFX}  className="h-full" />}
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
    // Index bleibt, wo er war — nur Bewertung neu laden
    loadPanelReview(ALL_PANELS[reviewIdx].name)
  }, [reviewIdx, loadPanelReview])

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

  // ── abgeleitete Variablen für den Review-Modus ─────────────────────────────
  const totalPanels    = ALL_PANELS.length
  const currentPanel   = ALL_PANELS[reviewIdx]
  // JSX benötigt einen Identifier mit Großbuchstaben als Komponenten-Tag
  const CurrentPanelComponent = currentPanel.Component
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
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v0.9.9
        </span>
        <span className="ml-auto text-red-800 text-xs animate-pulse">● LIVE</span>

        {/* Ambient-Sound-Toggle */}
        <button
          onClick={() => setSoundEnabled(e => !e)}
          title="Ambient Sound umschalten"
          className="border border-green-800 text-green-600 text-xs px-2 py-0.5
                     hover:border-green-600 hover:text-green-200 transition-colors"
        >
          {soundEnabled ? '[ AUDIO ON ]' : '[ AUDIO OFF ]'}
        </button>

        {/* Layout-Wechsel-Button — nur auf Desktop, im Review-Modus ausgeblendet */}
        {!reviewMode && (
          <button
            onClick={() => setLayout(current => { doSwitch(current); return current })}
            title="Zufälliges neues Layout generieren (auch: Leertaste)"
            className="hidden md:inline-flex border border-green-800 text-green-600 text-xs px-2 py-0.5
                       hover:border-green-600 hover:text-green-200 transition-colors"
          >
            [ ⟳ LAYOUT ]
          </button>
        )}

        {/* Review-Modus-Button — nur auf Desktop sichtbar, zeigt EXIT wenn aktiv, sonst [?] */}
        {reviewMode ? (
          <button
            onClick={() => setReviewMode(false)}
            title="Review-Modus beenden"
            className="hidden md:inline-flex border border-red-800 text-red-600 text-xs px-2 py-0.5
                       hover:border-red-500 hover:text-red-300 transition-colors"
          >
            [ ✕ EXIT REVIEW ]
          </button>
        ) : (
          <button
            onClick={enterReview}
            title="Panel Review-Modus öffnen"
            className="hidden md:inline-flex border border-green-800 text-green-600 text-xs px-2 py-0.5
                       hover:border-green-600 hover:text-green-200 transition-colors"
          >
            [ ? ]
          </button>
        )}
      </header>

      {/* Haupt-Content */}
      <main className="flex-1 min-h-0 overflow-hidden relative">

        {/* ── Mobile Layout — nur unter 768px sichtbar ── */}
        <div className="md:hidden flex flex-col gap-1 h-full p-1">
          {/* Panel 1: gemischter Pool aus Text und GFX */}
          <div className="flex-1 min-h-0">
            <PanelSlot pool={[...POOL_TEXT, ...POOL_GFX]} className="h-full" />
          </div>
          {/* Panel 2: Grafik-Panel */}
          <div className="flex-1 min-h-0">
            <PanelSlot pool={POOL_GFX} className="h-full" />
          </div>
          {/* Panel 3: Text-Panel */}
          <div className="flex-1 min-h-0">
            <PanelSlot pool={POOL_TEXT} className="h-full" />
          </div>
        </div>

        {/* ── Desktop Layout — ab 768px sichtbar ── */}
        <div className="hidden md:contents">

        {reviewMode ? (
          /* ── Review-Modus: ein Panel fullscreen + Bewertungsleiste ── */
          <div className="h-full flex flex-col p-1 gap-1">

            {/* Panel-Container — nimmt ~85% der Höhe */}
            <div className="flex-1 min-h-0">
              <Panel title={`REVIEW MODE // ${currentPanel.name} [${reviewIdx + 1}/${totalPanels}]`}>
                {/* CurrentPanelComponent ist der Großbuchstaben-Alias (JSX-Pflicht) */}
                <CurrentPanelComponent />
              </Panel>
            </div>

            {/* Bewertungsleiste — schmaler Streifen unten (~15%) */}
            <div
              className="border border-green-900 bg-black shrink-0 flex items-stretch gap-2 px-3 py-1"
              style={{ height: '14%' }}
            >
              {/* Navigation */}
              <div className="flex flex-col justify-center gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => goToPanel((reviewIdx - 1 + totalPanels) % totalPanels)}
                    className="border border-green-800 text-green-500 text-xs px-2 py-0.5
                               hover:border-green-500 hover:text-green-200 transition-colors"
                  >
                    ← PREV
                  </button>
                  <button
                    onClick={() => goToPanel((reviewIdx + 1) % totalPanels)}
                    className="border border-green-800 text-green-500 text-xs px-2 py-0.5
                               hover:border-green-500 hover:text-green-200 transition-colors"
                  >
                    NEXT →
                  </button>
                </div>
                <span className="text-green-800 text-xs text-center">
                  Panel {reviewIdx + 1} / {totalPanels}
                </span>
              </div>

              {/* Trennlinie */}
              <div className="border-l border-green-900 mx-1" />

              {/* Daumen rauf / runter */}
              <div className="flex flex-col justify-center gap-1">
                <span className="text-green-800 text-xs uppercase tracking-widest">Rating</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRating('up')}
                    title="Daumen rauf"
                    className={`border text-xs px-2 py-0.5 transition-colors
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
                    className={`border text-xs px-2 py-0.5 transition-colors
                      ${reviewRating === 'down'
                        ? 'border-red-500 text-red-300 bg-red-950'
                        : 'border-green-800 text-green-600 hover:border-green-500 hover:text-green-200'
                      }`}
                  >
                    👎
                  </button>
                </div>
                {/* Gespeicherter Status */}
                {savedForCurrent && (
                  <span className="text-green-900 text-xs">
                    saved: {savedForCurrent.rating === 'up' ? '👍' : '👎'}
                  </span>
                )}
              </div>

              {/* Trennlinie */}
              <div className="border-l border-green-900 mx-1" />

              {/* Kommentar-Textarea + SAVE */}
              <div className="flex flex-col flex-1 min-w-0 gap-1 justify-center">
                <span className="text-green-800 text-xs uppercase tracking-widest">Comment</span>
                {/* ref statt value-State → kein Re-Render beim Tippen */}
                <textarea
                  ref={commentRef}
                  rows={2}
                  placeholder="optional..."
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
                  className="flex-1 min-h-0 bg-black border border-green-900 text-green-400 text-xs
                             font-mono resize-none px-1 py-0.5
                             focus:outline-none focus:border-green-600
                             placeholder:text-green-900"
                />
              </div>

              {/* Trennlinie */}
              <div className="border-l border-green-900 mx-1" />

              {/* COPY-Button */}
              <div className="flex flex-col justify-center gap-1">
                <button
                  onClick={() => {
                    const data = loadReviews()
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                      .catch(() => {/* clipboard blocked */})
                  }}
                  title="Alle Bewertungen als JSON in Zwischenablage kopieren"
                  className="border border-green-800 text-green-600 hover:border-green-500 hover:text-green-300 text-xs px-3 py-1 transition-colors"
                >
                  [ COPY ]
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* ── Normaler Modus: Layout-Slides ── */
          <>
            {/* Outgoing Layout — animiert nach links heraus */}
            {sliding && prevLayout !== null && (
              <div
                key={`out-${prevLayout.id}`}
                className="absolute inset-0 p-1 layout-slide-out"
                aria-hidden="true"
              >
                <LayoutContent layout={prevLayout} />
              </div>
            )}

            {/* Aktuelles Layout — animiert von rechts herein (oder statisch beim ersten Render) */}
            <div
              key={`in-${layout.id}`}
              className={sliding ? 'absolute inset-0 p-1 layout-slide-in' : 'h-full p-1'}
            >
              <LayoutContent layout={layout} />
            </div>
          </>
        )}

        </div>{/* Ende Desktop Layout */}

      </main>
    </div>
  )
}
