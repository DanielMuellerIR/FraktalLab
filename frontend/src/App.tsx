import { useState, useEffect, useCallback } from 'react'
import PanelSlot from './ui/PanelSlot'
import FractalView from './panels/FractalView'
import GlitchOverlay from './ui/GlitchOverlay'

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

// ── Demoscene-Panels ──────────────────────────────────────────────────────────
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

// ── Fraktal-Mini-Panels ───────────────────────────────────────────────────────
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalDendrite,
  FractalSwirl, FractalSatellite, FractalTendril,
} from './panels/FractalScenes'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
// Text-Pools
const POOL_A = [SystemLog, DataStream, SocialEngineering]
const POOL_B = [Vitals, TrafficMonitor]
const POOL_D = [NuclearTargets]
const POOL_E = [PwdCracker]
const POOL_F = [PortScanner]
const POOL_G = [PseudoCode]

// Grafische Pools — rotieren durch visuelle Szenen
const POOL_V1: React.ComponentType[] = [
  VoxelDemo, GlobePanel, VoxelThermal, VoxelLava,
  FireScene, StarfieldScene, BoingScene, LissajousScene,
  OscilloscopePanel, FractalSeahorse, FractalSpiral, FractalTendril,
  FractalLightning, TunnelScene, MetaballsScene,
]
const POOL_V2: React.ComponentType[] = [
  VoxelNeon, VoxelMatrix, DNAHelix, PlasmaDemo,
  RotozoomScene, DotCloudScene,
  FractalElephant, FractalMini,
  FractalDendrite, FractalSwirl, FractalSatellite,
]

// Dedizierte Single-Item-Pools: garantiert immer sichtbar, rotieren nie raus
const POOL_ALLYOURBASE: React.ComponentType[] = [AllYourBase]
const POOL_ENHANCE:     React.ComponentType[] = [EnhanceView]

// ── Layout-System ─────────────────────────────────────────────────────────────
// Grafische Panels bekommen immer einen Container mit GFX_H → querformat-sicher.
const LAYOUT_COUNT = 5
const GFX_H = '30vh'

export default function App() {
  const [layoutIdx, setLayoutIdx] = useState(() => Math.floor(Math.random() * LAYOUT_COUNT))
  const [visible,   setVisible]   = useState(true)

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

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v0.9.4
        </span>
        <span className="text-green-900 text-xs italic">
          built with claude sonnet — opus would've been too easy
        </span>
        <span className="ml-auto text-red-800 text-xs animate-pulse">● LIVE</span>
        {/* Layout-Button mit Lichtreflexions-Animation */}
        <button
          onClick={skipLayout}
          title="Layout wechseln (Leertaste)"
          className="relative border border-green-800 text-green-600 text-xs px-2 py-0.5
                     hover:border-green-600 hover:text-green-200 transition-colors overflow-hidden"
        >
          {/* Shine-Strahl über den Button */}
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

        {/* ── Layout 1: 3 Spalten, 4 Grafik-Panels in einer Reihe ──────────── */}
        {layoutIdx === 0 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[13%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1}         className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ALLYOURBASE} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ENHANCE}     className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2}         className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-[18%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_F} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 2: 3 Spalten, breite Mitte, AllYourBase rechts oben ──── */}
        {layoutIdx === 1 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[13%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1}         className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2}         className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ALLYOURBASE} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ENHANCE}     className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-[20%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_G} className="flex-1 min-h-0" />
              <PanelSlot pool={[...POOL_E, ...POOL_F]} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 3: breite Grafik-Spalte, schmale Textspalten ──────────── */}
        {layoutIdx === 2 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[12%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 w-[66%] min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1}         className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ALLYOURBASE} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ENHANCE}     className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2}         className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
              <PanelSlot pool={[...POOL_F, ...POOL_G]} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 4: 2 Spalten, Grafik sehr dominant ─────────────────────── */}
        {layoutIdx === 3 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[72%] min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1}         className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ALLYOURBASE} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_ENHANCE}     className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2}         className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={[...POOL_B, ...POOL_E, ...POOL_F, ...POOL_G]} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 5: Panorama — Grafik oben, Text unten ──────────────────── */}
        {layoutIdx === 4 && (
          <div className="flex flex-col gap-1 h-full min-h-0">
            {/* Grafik-Reihe oben: Fraktal + 3 Grafik-Panels */}
            <div className="flex gap-1 min-h-0 shrink-0" style={{ height: '50%' }}>
              <div className="flex-1 min-w-0 min-h-0">
                <FractalView />
              </div>
              <PanelSlot pool={POOL_V1}         className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_ALLYOURBASE} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_ENHANCE}     className="flex-1 min-h-0" />
            </div>
            {/* Text-Reihe unten */}
            <div className="flex gap-1 flex-1 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_V2}         className="flex-1 min-h-0" />
              <PanelSlot pool={[...POOL_E, ...POOL_F, ...POOL_G]} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
