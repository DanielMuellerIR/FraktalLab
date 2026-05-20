import { useState, useEffect, useCallback, useRef } from 'react'
import PanelSlot     from './ui/PanelSlot'
import FractalView   from './panels/FractalView'
import GlitchOverlay from './ui/GlitchOverlay'
import AmbientSound  from './ui/AmbientSound'

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
import DaggerfallPanel   from './panels/DaggerfallPanel'
import ElitePanel        from './panels/ElitePanel'
import AmiModPanel       from './panels/AmiModPanel'
import CADRobotPanel     from './panels/CADRobotPanel'
import C64Panel          from './panels/C64Panel'
import RetroErrorPanel   from './panels/RetroErrorPanel'
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalDendrite, FractalSwirl, FractalSatellite, FractalTendril,
} from './panels/FractalScenes'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
const POOL_TEXT: React.ComponentType[] = [
  SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
  NuclearTargets, PwdCracker, PortScanner, PseudoCode,
  ClaudeCodePanel, VisitorProfilePanel, ICQChatPanel, BitcoinMinerPanel, DiskCleanupPanel,
]

// Alle visuellen Panels in einem Pool — AllYourBase und EnhanceView sind normale Einträge
const POOL_GFX: React.ComponentType[] = [
  VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,
  FireScene, StarfieldScene, BoingScene, LissajousScene,
  OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
  PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
  ParallaxPanel, DaggerfallPanel, ElitePanel, AmiModPanel, CADRobotPanel, C64Panel, RetroErrorPanel,
  FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
  FractalElephant, FractalMini, FractalDendrite, FractalSwirl, FractalSatellite,
]

const LAYOUT_COUNT = 3

// ── Hilfsfunktion: prüft ob ein Audio-Panel gerade läuft ─────────────────────
// AllYourBase (Video) und AmiModPanel (WebAudio) sind die einzigen Sound-Panels.
// Layout-Wechsel wartet, bis kein Sound mehr läuft.
function isAudioPlaying(): boolean {
  const vid = document.querySelector<HTMLVideoElement>('video')
  return !!vid && !vid.muted && !vid.paused
}

// ── Layouts als eigene Komponente ─────────────────────────────────────────────
function LayoutContent({ idx }: { idx: number }) {
  return (
    <>
      {/* ── Layout 1: Klassisch ── */}
      {idx === 0 && (
        <div className="flex gap-1 h-full min-h-0">
          {/* Links: 1 Text-Panel (schmal) */}
          <div className="flex flex-col gap-1 w-[14%] min-w-0 min-h-0">
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
          </div>
          {/* Mitte: FractalView + 2 GFX-Panels unten */}
          <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
            <FractalView />
            <div className="flex gap-1 min-h-0 shrink-0" style={{ height: '38%' }}>
              <PanelSlot pool={POOL_GFX} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_GFX} className="flex-1 min-h-0" />
            </div>
          </div>
          {/* Rechts: GFX oben + Text unten */}
          <div className="flex flex-col gap-1 w-[27%] min-w-0 min-h-0">
            <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
          </div>
        </div>
      )}

      {/* ── Layout 2: Dominant — FractalView groß ── */}
      {idx === 1 && (
        <div className="flex gap-1 h-full min-h-0">
          {/* Links: 2 Text-Panels gestapelt */}
          <div className="flex flex-col gap-1 w-[15%] min-w-0 min-h-0">
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
          </div>
          {/* Mitte-Links: FractalView groß */}
          <div className="flex flex-col gap-1 w-[42%] min-w-0 min-h-0">
            <FractalView />
          </div>
          {/* Mitte-Rechts: GFX oben + GFX unten */}
          <div className="flex flex-col gap-1 w-[27%] min-w-0 min-h-0">
            <PanelSlot pool={POOL_GFX} className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_GFX} className="flex-1 min-h-0" />
          </div>
          {/* Rechts: GFX + Text */}
          <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
            <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
          </div>
        </div>
      )}

      {/* ── Layout 3: Panorama — breite obere Reihe ── */}
      {idx === 2 && (
        <div className="flex flex-col gap-1 h-full min-h-0">
          {/* Obere Reihe: FractalView + GFX nebeneinander */}
          <div className="flex gap-1 flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0">
              <FractalView />
            </div>
            <div className="flex flex-col gap-1 w-[38%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            </div>
          </div>
          {/* Untere Reihe: 3 gleichbreite Panels */}
          <div className="flex gap-1 shrink-0" style={{ height: '35%' }}>
            <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
            <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
          </div>
        </div>
      )}
    </>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function App() {
  const [layoutIdx,  setLayoutIdx]  = useState(() => Math.floor(Math.random() * LAYOUT_COUNT))
  const [prevIdx,    setPrevIdx]    = useState<number | null>(null)
  const [sliding,    setSliding]    = useState(false)
  // Ambient Sound: standardmäßig eingeschaltet
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Ref für den laufenden Auto-Switch-Timer — wird bei jedem Wechsel neu gesetzt
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSwitch = useCallback((current: number) => {
    let next = current
    while (next === current) next = Math.floor(Math.random() * LAYOUT_COUNT)

    setPrevIdx(current)
    setSliding(true)
    setLayoutIdx(next)

    // Animation nach 520 ms beenden (etwas länger als die 500 ms CSS-Animation)
    setTimeout(() => {
      setPrevIdx(null)
      setSliding(false)
    }, 520)
  }, [])

  // Versucht Layout zu wechseln — wartet, falls ein Audio-Panel läuft
  const trySwitch = useCallback(() => {
    setLayoutIdx(current => {
      if (isAudioPlaying()) {
        // Alle 5 s erneut prüfen, ob das Video noch läuft
        autoTimerRef.current = setTimeout(trySwitch, 5000)
        return current
      }
      doSwitch(current)
      return current  // setLayoutIdx-Update passiert in doSwitch
    })
  }, [doSwitch])

  // Auto-Switch alle 1–3 Minuten
  const scheduleNext = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    const delay = 60_000 + Math.random() * 120_000   // 1–3 Minuten
    autoTimerRef.current = setTimeout(trySwitch, delay)
  }, [trySwitch])

  // Immer wenn sich layoutIdx ändert, neuen Timer setzen
  useEffect(() => {
    scheduleNext()
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }, [layoutIdx, scheduleNext])

  // Leertaste → sofortiger Layout-Wechsel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault()
        setLayoutIdx(current => { doSwitch(current); return current })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSwitch])

  return (
    <div className="bg-black text-green-400 h-screen flex flex-col font-mono overflow-hidden">

      {/* Bildstörungs-Overlay */}
      <GlitchOverlay />

      {/* Ambient-Sound — rendert nichts, erzeugt nur Töne */}
      <AmbientSound enabled={soundEnabled} />

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v0.9.7
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
      </header>

      {/* Haupt-Content — overflow-hidden + relative für die Slide-Animation */}
      <main className="flex-1 min-h-0 overflow-hidden relative">

        {/* Outgoing Layout — animiert nach links heraus */}
        {sliding && prevIdx !== null && (
          <div
            key={`out-${prevIdx}`}
            className="absolute inset-0 p-1 layout-slide-out"
            aria-hidden="true"
          >
            <LayoutContent idx={prevIdx} />
          </div>
        )}

        {/* Aktuelles Layout — animiert von rechts herein (oder statisch beim ersten Render) */}
        <div
          key={`in-${layoutIdx}`}
          className={sliding ? 'absolute inset-0 p-1 layout-slide-in' : 'h-full p-1'}
        >
          <LayoutContent idx={layoutIdx} />
        </div>

      </main>
    </div>
  )
}
