import { useState, useEffect, useCallback } from 'react'
import PanelSlot    from './ui/PanelSlot'
import FractalView  from './panels/FractalView'
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

// ── Neue Text-Panels ──────────────────────────────────────────────────────────
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

// ── Neue Grafik-Panels ────────────────────────────────────────────────────────
import ParallaxPanel     from './panels/ParallaxPanel'
import DaggerfallPanel   from './panels/DaggerfallPanel'
import ElitePanel        from './panels/ElitePanel'

// ── Fraktal-Mini-Panels ───────────────────────────────────────────────────────
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalDendrite, FractalSwirl, FractalSatellite, FractalTendril,
} from './panels/FractalScenes'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
// Ein großer Text-Pool: alle Text-Panels rotieren durch die Text-Slots
const POOL_TEXT: React.ComponentType[] = [
  SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
  NuclearTargets, PwdCracker, PortScanner, PseudoCode,
  ClaudeCodePanel, VisitorProfilePanel, ICQChatPanel, BitcoinMinerPanel, DiskCleanupPanel,
]

// Ein großer Grafik-Pool: alle visuellen Panels rotieren durch Grafik-Slots
const POOL_GFX: React.ComponentType[] = [
  VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,
  FireScene, StarfieldScene, BoingScene, LissajousScene,
  OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
  PlasmaDemo, DNAHelix,
  ParallaxPanel, DaggerfallPanel, ElitePanel,
  FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
  FractalElephant, FractalMini, FractalDendrite, FractalSwirl, FractalSatellite,
]

// Dedizierte Pools — diese Slots zeigen immer nur diesen einen Inhalt
const POOL_ALLYOURBASE: React.ComponentType[] = [AllYourBase]
const POOL_ENHANCE:     React.ComponentType[] = [EnhanceView]

// ── Layout-Konstanten ─────────────────────────────────────────────────────────
const LAYOUT_COUNT = 3

export default function App() {
  const [layoutIdx,     setLayoutIdx]     = useState(() => Math.floor(Math.random() * LAYOUT_COUNT))
  const [visible,       setVisible]       = useState(true)
  // Ambient Sound: startet stumm, Nutzer kann ihn einschalten
  const [soundEnabled,  setSoundEnabled]  = useState(false)

  const skipLayout = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setLayoutIdx(i => {
        let n = i
        while (n === i) n = Math.floor(Math.random() * LAYOUT_COUNT)
        return n
      })
      setVisible(true)
    }, 300)
  }, [])

  // Automatischer Layout-Wechsel alle 3–7 Minuten
  useEffect(() => {
    const delay = 180_000 + Math.random() * 240_000
    const t = setTimeout(skipLayout, delay)
    return () => clearTimeout(t)
  }, [layoutIdx, skipLayout])

  // Leertaste → Layout wechseln
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault()
        skipLayout()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skipLayout])

  return (
    <div className="bg-black text-green-400 h-screen flex flex-col font-mono overflow-hidden">

      {/* Bildstörungs-Overlay — liegt über allem, reagiert nicht auf Maus */}
      <GlitchOverlay />

      {/* Ambient-Sound-Komponente — rendert nichts, erzeugt nur Töne */}
      <AmbientSound enabled={soundEnabled} />

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v0.9.5
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

        {/* Layout-Button mit Shine-Animation */}
        <button
          onClick={skipLayout}
          title="Layout wechseln (Leertaste)"
          className="relative border border-green-800 text-green-600 text-xs px-2 py-0.5
                     hover:border-green-600 hover:text-green-200 transition-colors overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 35%, rgba(0,255,80,0.25) 50%, transparent 65%)',
              backgroundSize: '200% 100%',
              animation: 'shine 2.8s linear infinite',
            }}
          />
          [LAYOUT {layoutIdx + 1}/{LAYOUT_COUNT}]
        </button>
      </header>

      {/* Haupt-Content */}
      <main
        className={`flex-1 min-h-0 p-1 overflow-hidden transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >

        {/* ────────────────────────────────────────────────────────────────────
            Layout 1: Klassisch — 3 Spalten, AllYourBase 16:9 rechts
            Links: 1 Text-Panel (schmal)
            Mitte: FractalView oben + 2 GFX-Panels unten
            Rechts: AllYourBase (16:9) oben + 1 Text-Panel unten
        ──────────────────────────────────────────────────────────────────── */}
        {layoutIdx === 0 && (
          <div className="flex gap-1 h-full min-h-0">

            {/* Linke Spalte: 1 Text-Panel */}
            <div className="flex flex-col gap-1 w-[14%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            </div>

            {/* Mitte: FractalView + 2 GFX-Panels */}
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: '38%' }}>
                <PanelSlot pool={POOL_GFX}    className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ENHANCE} className="flex-1 min-h-0" />
              </div>
            </div>

            {/* Rechte Spalte: AllYourBase 16:9 + Text darunter */}
            <div className="flex flex-col gap-1 w-[27%] min-w-0 min-h-0">
              {/* 16:9 Container für AllYourBase */}
              <div style={{ aspectRatio: '16/9', width: '100%', flexShrink: 0 }}>
                <PanelSlot pool={POOL_ALLYOURBASE} className="h-full" />
              </div>
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            </div>

          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            Layout 2: Groß — FractalView dominant, AllYourBase in Mitte
            Links: 2 Text-Panels gestapelt
            Mitte-Links: FractalView (groß)
            Mitte-Rechts: AllYourBase 16:9 oben + 1 GFX unten
            Rechts: 1 GFX-Panel
        ──────────────────────────────────────────────────────────────────── */}
        {layoutIdx === 1 && (
          <div className="flex gap-1 h-full min-h-0">

            {/* Links: 2 Text-Panels */}
            <div className="flex flex-col gap-1 w-[15%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            </div>

            {/* Mitte-Links: FractalView groß */}
            <div className="flex flex-col gap-1 w-[42%] min-w-0 min-h-0">
              <FractalView />
            </div>

            {/* Mitte-Rechts: AllYourBase 16:9 + GFX darunter */}
            <div className="flex flex-col gap-1 w-[27%] min-w-0 min-h-0">
              <div style={{ aspectRatio: '16/9', width: '100%', flexShrink: 0 }}>
                <PanelSlot pool={POOL_ALLYOURBASE} className="h-full" />
              </div>
              <PanelSlot pool={POOL_GFX} className="flex-1 min-h-0" />
            </div>

            {/* Rechts: 1 GFX-Panel */}
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <PanelSlot pool={POOL_GFX}  className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_TEXT} className="flex-1 min-h-0" />
            </div>

          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            Layout 3: Panorama — FractalView und AllYourBase nebeneinander
            oben (Höhe durch AllYourBase 16:9 bei 42% Breite bestimmt),
            unten 3 breitere Panels
        ──────────────────────────────────────────────────────────────────── */}
        {layoutIdx === 2 && (
          <div className="flex flex-col gap-1 h-full min-h-0">

            {/* Obere Reihe: Höhe ergibt sich aus AllYourBase-Breite × 9/16 */}
            <div className="flex gap-1 shrink-0">
              <div className="flex-1 min-w-0 min-h-0">
                <FractalView />
              </div>
              {/* 42% Breite → Höhe = 42% × Viewport-Breite × 9/16 ≈ 300px bei 1280px */}
              <div style={{ width: '42%', aspectRatio: '16/9', flexShrink: 0 }}>
                <PanelSlot pool={POOL_ALLYOURBASE} className="h-full w-full" />
              </div>
            </div>

            {/* Untere Reihe: füllt verbleibenden Platz */}
            <div className="flex gap-1 flex-1 min-h-0">
              <PanelSlot pool={POOL_TEXT}    className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_GFX}     className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_ENHANCE} className="flex-1 min-h-0" />
            </div>

          </div>
        )}

      </main>
    </div>
  )
}
