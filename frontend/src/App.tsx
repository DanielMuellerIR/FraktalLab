import { useState, useEffect } from 'react'
import PanelSlot from './ui/PanelSlot'
import FractalView from './panels/FractalView'

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
import {
  FireScene, StarfieldScene, TunnelScene, RotozoomScene,
  MetaballsScene, DotCloudScene, BoingScene, LissajousScene,
} from './panels/DemoScenes'

// ── Fraktal-Mini-Panels ───────────────────────────────────────────────────────
import {
  FractalSeahorse, FractalSpiral, FractalLightning, FractalElephant,
  FractalMini, FractalDendrite, FractalAntenna, FractalSwirl,
  FractalSatellite, FractalTendril,
} from './panels/FractalScenes'

// ── Panel-Pools ───────────────────────────────────────────────────────────────
// Text-Pools — schmal und hoch ist OK
const POOL_A = [SystemLog, DataStream, SocialEngineering]
const POOL_B = [Vitals, TrafficMonitor]
const POOL_D = [NuclearTargets]
const POOL_E = [PwdCracker]
const POOL_F = [PortScanner]
const POOL_G = [PseudoCode]

// Visuelle Pools — grafische Panels, brauchen querformatige Container.
// Die Rotation sorgt dafür, dass im Laufe der Zeit alle Szenen erscheinen.
// Voxel-Szenen stehen bewusst vorne (sofort sichtbar bei Layout-Start).
const POOL_V1: React.ComponentType[] = [
  VoxelDemo, VoxelThermal, VoxelLava, EnhanceView, FireScene, StarfieldScene,
  BoingScene, LissajousScene, FractalSeahorse, FractalSpiral, FractalTendril, AllYourBase,
]
const POOL_V2: React.ComponentType[] = [
  VoxelNeon, VoxelMatrix, PlasmaDemo, TunnelScene, RotozoomScene, MetaballsScene,
  DotCloudScene, FractalLightning, FractalElephant, FractalMini,
  FractalDendrite, FractalAntenna, FractalSwirl, FractalSatellite,
]

// ── Layout-System ─────────────────────────────────────────────────────────────
// Grafische Panels bekommen immer einen Container mit h-[28vh] → querformat-sicher.
// Bei 900 px Viewport-Höhe = 252 px. Panel-Breite ≥ 300 px → immer Querformat.

const LAYOUT_COUNT = 5

// Gemeinsamer Wrapper für die Zeile der grafischen Mini-Panels
const GFX_H = '28vh'

export default function App() {
  // Zufälliges Start-Layout
  const [layoutIdx, setLayoutIdx]   = useState(() => Math.floor(Math.random() * LAYOUT_COUNT))
  const [visible,   setVisible]     = useState(true)

  // Automatischer Layout-Wechsel alle 3–7 Minuten
  useEffect(() => {
    const delay = 180_000 + Math.random() * 240_000
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => {
        // Nie dasselbe Layout zweimal hintereinander
        setLayoutIdx(i => {
          let next = i
          while (next === i) next = Math.floor(Math.random() * LAYOUT_COUNT)
          return next
        })
        setVisible(true)
      }, 500)
    }, delay)
    return () => clearTimeout(t)
  }, [layoutIdx])

  const skipLayout = () => {
    setVisible(false)
    setTimeout(() => {
      setLayoutIdx(i => { let n=i; while(n===i) n=Math.floor(Math.random()*LAYOUT_COUNT); return n })
      setVisible(true)
    }, 300)
  }

  return (
    <div className="bg-black text-green-400 h-screen flex flex-col font-mono overflow-hidden">

      {/* Kopfzeile */}
      <header className="border-b border-green-900 px-3 py-1 flex items-center gap-3 shrink-0">
        <span className="text-green-600 text-xs uppercase tracking-widest">
          ◈ FRAKTALLAB // NEURAL INTRUSION DASHBOARD v0.9.2
        </span>
        <span className="text-green-900 text-xs italic">
          built with claude sonnet — opus would've been too easy
        </span>
        <span className="ml-auto text-red-800 text-xs animate-pulse">● LIVE</span>
        <button
          onClick={skipLayout}
          className="border border-green-800 text-green-700 text-xs px-2 py-0.5
                     hover:bg-green-900 hover:text-green-300 transition-colors"
        >
          [LAYOUT {layoutIdx + 1}/{LAYOUT_COUNT}]
        </button>
      </header>

      {/* Haupt-Content */}
      <main
        className={`flex-1 min-h-0 p-1 overflow-hidden transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >

        {/* ── Layout 1: 4 Spalten ────────────────────────────────────────────── */}
        {layoutIdx === 0 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[12%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 w-[44%] min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2} className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-[22%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <PanelSlot pool={POOL_F} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_G} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 2: 3 Spalten, breite Mitte ─────────────────────────────── */}
        {layoutIdx === 1 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[14%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2} className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-[26%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
              <PanelSlot pool={[...POOL_F, ...POOL_G]} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 3: 3 Spalten, 3 Grafik-Panels nebeneinander ────────────── */}
        {layoutIdx === 2 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[16%] min-w-0 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
            </div>
            <div className="flex flex-col gap-1 w-[60%] min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_D}  className="flex-1 min-h-0" />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 min-h-0">
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_F} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_G} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

        {/* ── Layout 4: 2 Spalten, Grafik dominant ──────────────────────────── */}
        {layoutIdx === 3 && (
          <div className="flex gap-1 h-full min-h-0">
            <div className="flex flex-col gap-1 w-[62%] min-w-0 min-h-0">
              <FractalView />
              <div className="flex gap-1 min-h-0 shrink-0" style={{ height: GFX_H }}>
                <PanelSlot pool={POOL_V1} className="flex-1 min-h-0" />
                <PanelSlot pool={POOL_V2} className="flex-1 min-h-0" />
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
            {/* Grafik-Reihe oben */}
            <div className="flex gap-1 min-h-0 shrink-0" style={{ height: '48%' }}>
              <div className="flex-1 min-w-0 min-h-0">
                <FractalView />
              </div>
              <PanelSlot pool={POOL_V1} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_V2} className="flex-1 min-h-0" />
            </div>
            {/* Text-Reihe unten */}
            <div className="flex gap-1 flex-1 min-h-0">
              <PanelSlot pool={POOL_A} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_B} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_D} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_E} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_F} className="flex-1 min-h-0" />
              <PanelSlot pool={POOL_G} className="flex-1 min-h-0" />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
