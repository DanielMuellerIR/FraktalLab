import { useEffect, useState, memo } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'
import { APOLLONIAN_SHADER } from '../utils/de-fractals-shaders'

interface DecryptRow {
  synapseId: string
  address: string
  hash: string
  signalLevel: number
  status: 'DECRYPTING' | 'SYNCHRONISED' | 'OVERLOAD'
}

const SCI_FI_LABELS = [
  'THALAMIC_BRIDGE', 'AXON_GRID_A', 'CORTICAL_LINK', 'MYELIN_TRACE',
  'SYNAPSE_CORE', 'HIPPOCAMPUS_P1', 'OPTIC_DECODER', 'Dopamine_CH1'
]

export function NeuralLinkDecoderPanel() {
  const [rows, setRows] = useState<DecryptRow[]>(() => 
    Array.from({ length: 10 }, (_, i) => ({
      synapseId: SCI_FI_LABELS[i % SCI_FI_LABELS.length],
      address: `0x${(0x7F2A + i * 0x3F).toString(16).toUpperCase()}`,
      hash: Math.random().toString(16).substring(2, 8).toUpperCase(),
      signalLevel: 20 + Math.random() * 80,
      status: Math.random() > 0.4 ? 'DECRYPTING' : 'SYNCHRONISED'
    }))
  )

  const [telemetry, setTelemetry] = useState({
    bandwidth: 742.4,
    stability: 99.8,
    synapsesSecured: 4,
    totalNeurons: 4096
  })

  // Telemetry simulation
  useEffect(() => {
    let alive = true
    const interval = setInterval(() => {
      if (!alive) return
      
      // Update rows
      setRows(curr => curr.map(r => {
        if (Math.random() > 0.8) {
          const nextStatus = r.status === 'DECRYPTING' 
            ? (Math.random() > 0.3 ? 'SYNCHRONISED' : 'OVERLOAD')
            : 'DECRYPTING'
          return {
            ...r,
            hash: Math.random().toString(16).substring(2, 8).toUpperCase(),
            signalLevel: 10 + Math.random() * 90,
            status: nextStatus as any
          }
        } else if (r.status === 'DECRYPTING') {
          return {
            ...r,
            hash: Math.random().toString(16).substring(2, 8).toUpperCase(),
            signalLevel: Math.max(10, Math.min(100, r.signalLevel + (Math.random() - 0.5) * 15))
          }
        }
        return r
      }))

      // Update global telemetry
      setTelemetry(() => ({
        bandwidth: +(700 + Math.sin(Date.now() * 0.001) * 80 + Math.random() * 10).toFixed(1),
        stability: +(95.0 + Math.random() * 4.9).toFixed(2),
        synapsesSecured: Math.floor(3 + Math.random() * 3),
        totalNeurons: 4096 + Math.floor(Math.sin(Date.now() * 0.0005) * 512)
      }))
    }, 800)

    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [])

  return (
    <Panel title="NEURAL LINK // CORTICAL SYNAPSE DECODER">
      <div className="w-full h-full relative overflow-hidden select-none">
        
        {/* Background GPU DE-fractal: Apollonian Gasket */}
        <div className="absolute inset-0 z-0">
          <ShaderPanel
            fragmentShader={APOLLONIAN_SHADER}
            title=""
            noPanel={true}
          />
        </div>

        {/* Ambient CRT/VHS scanner layer overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/80 pointer-events-none z-1" />

        {/* Hard Sci-Fi Text UI Overlays (Neon Cyan & Magenta) */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 font-mono text-[9px] text-slate-100 z-10">
          
          {/* Top Panel Bar */}
          <div className="flex justify-between items-start bg-black/65 border border-slate-800/40 p-2 rounded backdrop-blur-md">
            <div>
              <div className="text-cyan-400 font-bold text-[10px] tracking-widest">COGNITIVE INTERCEPT INTERFACE</div>
              <div className="text-slate-400 mt-0.5">MATRIX DENSITY: {telemetry.totalNeurons} NEURONS // STABILITY: <span className={telemetry.stability < 96.5 ? 'text-rose-500 font-bold' : 'text-cyan-400 font-bold'}>{telemetry.stability}%</span></div>
            </div>
            <div className="text-right">
              <div className="text-fuchsia-400 font-bold">BANDWIDTH: {telemetry.bandwidth} GB/s</div>
              <div className="text-slate-500">SECURE TARGETS: {telemetry.synapsesSecured} / 12 ACTIVE</div>
            </div>
          </div>

          {/* Center Split Grid */}
          <div className="flex-1 my-2 flex gap-2 min-h-0 overflow-hidden">
            
            {/* Left Box: Active Synapses Table */}
            <div className="flex-1 bg-black/70 border border-slate-800/45 p-2 rounded backdrop-blur-sm overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              <div className="text-cyan-400/80 font-bold border-b border-slate-800/60 pb-1 mb-1.5 flex justify-between uppercase tracking-wider text-[8px]">
                <span>Synapse ID</span>
                <span>Addr</span>
                <span>Signal</span>
                <span className="text-right">Decryption Lock</span>
              </div>
              <div className="space-y-1.5">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 truncate w-[75px] font-semibold">{row.synapseId}</span>
                    <span className="text-cyan-500/80">{row.address}</span>
                    
                    {/* Signal Progress Dot */}
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.status === 'OVERLOAD' ? '#f43f5e' : row.status === 'SYNCHRONISED' ? '#a855f7' : '#06b6d4' }} />
                      <span>{row.signalLevel.toFixed(0)}dB</span>
                    </span>

                    {/* Status Value */}
                    <span className="text-right font-bold w-[75px] truncate">
                      {row.status === 'DECRYPTING' && (
                        <span className="text-cyan-400 animate-pulse">{row.hash} [DCR]</span>
                      )}
                      {row.status === 'SYNCHRONISED' && (
                        <span className="text-fuchsia-400">SECURED</span>
                      )}
                      {row.status === 'OVERLOAD' && (
                        <span className="text-rose-500 font-bold animate-bounce">OVERFLOW</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Live Telemetry Stream */}
            <div className="w-[110px] bg-black/70 border border-slate-800/45 p-2 rounded backdrop-blur-sm flex flex-col justify-between">
              <div>
                <div className="text-fuchsia-400 font-bold mb-1 border-b border-slate-800/50 pb-0.5 uppercase text-[8px] tracking-wider">SPECTRAL TONES</div>
                <div className="space-y-1 text-slate-400">
                  <div className="flex justify-between"><span>LOBE-L</span><span className="text-slate-300">0.24ms</span></div>
                  <div className="flex justify-between"><span>LOBE-R</span><span className="text-slate-300">0.18ms</span></div>
                  <div className="flex justify-between"><span>AXON-S</span><span className="text-fuchsia-400 font-bold">STABLE</span></div>
                  <div className="flex justify-between"><span>THETA</span><span className="text-cyan-400">8.2Hz</span></div>
                  <div className="flex justify-between"><span>GAMMA</span><span className="text-cyan-400">42.1Hz</span></div>
                </div>
              </div>
              
              <div className="border-t border-slate-800/50 pt-1.5 mt-1">
                <div className="text-[7px] text-slate-500">DECRYPT PATTERN</div>
                <div className="text-cyan-400 font-bold text-[10px] leading-tight font-mono tracking-wider animate-pulse">01101011</div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Synchronisation Progress */}
          <div className="bg-black/70 border border-slate-800/40 p-2 rounded backdrop-blur-md">
            <div className="flex justify-between mb-1 text-slate-400">
              <span>DECRYPTING INTEGRATED DATA BLOCK...</span>
              <span className="text-cyan-400 font-bold">{(telemetry.stability / 100 * 87.5).toFixed(1)}% SECURED</span>
            </div>
            
            {/* Progress Bar Container */}
            <div className="h-2 w-full bg-slate-900 border border-slate-800 rounded-sm overflow-hidden flex">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-400 transition-all duration-700" 
                style={{ width: `${(telemetry.stability / 100 * 87.5)}%` }} 
              />
            </div>
          </div>

        </div>

      </div>
    </Panel>
  )
}

export default memo(NeuralLinkDecoderPanel)
