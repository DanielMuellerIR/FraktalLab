import { memo,  useEffect, useRef, useState } from 'react'
import { getTextSpeed } from '../utils/panel-speed'

const AGENT_NAMES = [
  'NetVibe', 'QuantumNexus', 'CyberCoder', 'Antigravity-Omega',
  'BrainWave', 'TachyonBot', 'OmniCoder', 'NexusIntruder',
  'GridMaster', 'VibeBuilder', 'AlphaWeave', 'NeuroHacker'
]

const MODELS = [
  'Gemini 9.9-Quantum-Max (990B)',
  'Antigravity-Ultra-Hyper (1.2T)',
  'DeepCode-Infinity-Core',
  'BrainWave-990-Temporal',
  'NeuroLattice-Vibe-9',
]

const OS_NAMES = [
  'VibeOS v9.4',
  'GridKernel v12',
  'NexusKernel v2.1',
  'TachyonOS v0.9',
  'SentientKernel v7.0',
]

// Theme configuration matching Tailwind colors
const THEMES = [
  { name: 'green', color: '#22c55e', textClass: 'text-green-400', borderClass: 'border-green-900', bgGlow: 'rgba(34,197,94,0.1)' },
  { name: 'cyan', color: '#06b6d4', textClass: 'text-cyan-400', borderClass: 'border-cyan-950', bgGlow: 'rgba(6,182,212,0.1)' },
  { name: 'pink', color: '#ec4899', textClass: 'text-pink-400', borderClass: 'border-pink-950', bgGlow: 'rgba(236,72,153,0.1)' },
  { name: 'amber', color: '#f59e0b', textClass: 'text-amber-400', borderClass: 'border-amber-950', bgGlow: 'rgba(245,158,11,0.1)' },
  { name: 'purple', color: '#a855f7', textClass: 'text-purple-400', borderClass: 'border-purple-950', bgGlow: 'rgba(168,85,247,0.1)' },
  { name: 'blue', color: '#3b82f6', textClass: 'text-blue-400', borderClass: 'border-blue-950', bgGlow: 'rgba(59,130,246,0.1)' },
]

const MOCK_CODES = [
  `import { runAgent } from './cyber_core'
const agent = new Agent({
  name: "[TARGET]",
  sentient: true,
  vibeLevel: 9001
});
agent.spawnSubagents(14000);
agent.on('ready', () => {
  console.log('[TARGET] is online. Autonomy enabled.');
  agent.commenceIntrusion();
});`,
  `fn boot_agent(name: &str) -> Result<Agent, CoreError> {
    let mut lattice = LatentLattice::initialize(990)?;
    let subagents = (0..14291).map(|id| {
        Subagent::spawn(id, "investigate")
    }).collect();
    let agent = Agent::new(name, lattice, subagents);
    agent.inject_sentience()?;
    Ok(agent)
}`,
  `package main
import "github.com/vibe/agent/core"
func main() {
    ctx := core.NewQuantumContext()
    agent := core.AssembleAgent("[TARGET]", ctx)
    agent.StartSubagentStorm(14291)
    agent.VerifyIntegrity()
    agent.LaunchNextLoop()
}`
]

const SUBAGENT_LOGS = [
  'investigator-[ID]: searching filesystem for config...',
  'builder-[ID]: modifying package.json and index.html',
  'writer-[ID]: generating source code module...',
  'tester-[ID]: running 14,000 unit tests... (100% pass)',
  'compiler-[ID]: compiling wasm-pack target binaries...',
  'reviewer-[ID]: reviewing diff... Approved (no fluff)',
  'security-[ID]: auditing firebase security rules...',
  'optimizer-[ID]: boosting compile optimizations -O3...',
]

function MetaAgentPanel() {
  const [session, setSession] = useState({
    currentAgent: 'Antigravity-v1.0',
    targetAgent: 'NetVibe-v2.0',
    model: MODELS[0],
    os: OS_NAMES[0],
    theme: THEMES[0],
    targetTheme: THEMES[1],
    cycle: 1,
  })

  const [time, setTime] = useState(0) // 0 to 50 seconds loop
  const [subagentsCount, setSubagentsCount] = useState(1200)
  const [tokensPerSecond, setTokensPerSecond] = useState(2.1)
  const [flicker, setFlicker] = useState(false)

  // Main 50-second state loop
  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev >= 49) {
          // Trigger theme transition and setup next nested agent loop!
          setFlicker(true)
          setTimeout(() => setFlicker(false), 300)

          setSession((curr) => {
            const nextIdx = Math.floor(Math.random() * AGENT_NAMES.length)
            const nextAgent = `${AGENT_NAMES[nextIdx]}-v${(curr.cycle + 1).toFixed(1)}`
            const randomModel = MODELS[Math.floor(Math.random() * MODELS.length)]
            const randomOS = OS_NAMES[Math.floor(Math.random() * OS_NAMES.length)]
            const randomThemeIdx = Math.floor(Math.random() * THEMES.length)
            
            return {
              currentAgent: curr.targetAgent,
              targetAgent: nextAgent,
              model: randomModel,
              os: randomOS,
              theme: curr.targetTheme,
              targetTheme: THEMES[randomThemeIdx],
              cycle: curr.cycle + 1,
            }
          })
          return 0
        }
        return prev + 1
      })
      // Speed-System v2: Textpanels laufen auf Proxima 2× schneller (getTextSpeed()).
      // Layout re-mountet bei Dichte-Wechsel → Wert greift beim nächsten Mount.
    }, 1000 / getTextSpeed())

    return () => clearInterval(timer)
  }, [])

  // Fast subagent/tokens counters update during Stage 1
  useEffect(() => {
    if (time >= 6 && time < 20) {
      const interval = setInterval(() => {
        setSubagentsCount((curr) => {
          const next = curr + Math.floor(Math.random() * 800) + 200
          return Math.min(18491, next)
        })
        setTokensPerSecond((curr) => {
          const next = curr + Math.random() * 3.5 + 0.5
          return Math.min(48.9, next)
        })
        // Speed-System v2: Textpanels laufen auf Proxima 2× schneller (getTextSpeed()).
        // Layout re-mountet bei Dichte-Wechsel → Wert greift beim nächsten Mount.
      }, 200 / getTextSpeed())
      return () => clearInterval(interval)
    } else if (time === 0) {
      setSubagentsCount(1200)
      setTokensPerSecond(2.1)
    }
  }, [time])

  // Get current stage
  // Stage 0 (0-6s): Prompt analysis
  // Stage 1 (6-20s): Subagent Storm
  // Stage 2 (20-38s): Code Emission
  // Stage 3 (38-50s): Compilation & Booting
  let stage = 0
  if (time >= 6 && time < 20) stage = 1
  else if (time >= 20 && time < 38) stage = 2
  else if (time >= 38) stage = 3

  // Subagents grid dot statuses
  const dotsCount = 120
  const dotStatuses = useRef<number[]>(Array.from({ length: dotsCount }, () => Math.random()))

  // Randomise subagent dots on each render
  dotStatuses.current = dotStatuses.current.map((v) => {
    if (Math.random() < 0.25) return Math.random()
    return v
  })

  // Format code display for Stage 2
  const codeTemplate = MOCK_CODES[(session.cycle - 1) % MOCK_CODES.length].replace(/\[TARGET\]/g, session.targetAgent)
  const lines = codeTemplate.split('\n')
  const totalLinesToShow = Math.min(lines.length, Math.floor((time - 20) * 8))
  const displayedCode = lines.slice(0, totalLinesToShow).join('\n')

  // Generate logs for subagent storm
  const currentLogs: string[] = []
  if (stage === 1) {
    const elapsedTicks = time - 6
    for (let i = 0; i < Math.min(6, elapsedTicks); i++) {
      const logIdx = (i + session.cycle) % SUBAGENT_LOGS.length
      const id = String(100 + i * 23 + (session.cycle * 11) % 900)
      currentLogs.push(`├─ ` + SUBAGENT_LOGS[logIdx].replace('[ID]', id))
    }
  }

  const activeTheme = session.theme

  return (
    <div
      className={`border rounded flex flex-col h-full w-full overflow-hidden transition-colors duration-500 font-mono`}
      style={{
        borderColor: activeTheme.color,
        backgroundColor: '#000000',
        color: activeTheme.color,
        boxShadow: flicker ? `0 0 25px ${activeTheme.color}` : 'none',
        // fontSize-clamp: bindet die Basis-Schrift (1em) an die Kachelgröße (cqmin).
        // Alle Texte unten sind relativ in em angegeben und skalieren dadurch mit.
        // Untergrenze ~7,5px für Lesbarkeit, Obergrenze 13px.
        fontSize: 'clamp(7.5px, 3.2cqmin, 13px)',
      }}
    >
      {/* Header bar */}
      <div
        className="border-b px-2 py-1 flex items-center gap-2 text-[1em] shrink-0 select-none font-bold"
        style={{ borderColor: activeTheme.color }}
      >
        <span className="animate-pulse">●</span>
        <span className="uppercase tracking-wider">
          AGENT INTERFACE: {session.currentAgent}
        </span>
        <span className="ml-auto text-[0.8em] opacity-75">
          STAGE {stage}/3 · CYCLE {session.cycle}
        </span>
      </div>

      {/* Main panel viewport */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 gap-2 justify-between">
        
        {/* Terminal log logs — Schriftgrößen relativ (em) zum Root-clamp */}
        <div className="flex flex-col gap-1 shrink-0 text-[1em]">
          <div className="opacity-50 text-[0.8em]">
            &gt; HOST_OS: {session.os} · MODEL: {session.model}
          </div>

          <div className="leading-tight text-white font-semibold">
            &gt; REQUEST: Implementiere vibe coding agent desktop und starte diesen
          </div>

          {time >= 2 && (
            <div className="text-[0.85em] leading-tight">
              &gt; SYSTEM: Initializing Antigravity nesting loop engine... OK
            </div>
          )}
          {time >= 4 && (
            <div className="text-[0.85em] leading-tight">
              &gt; SYSTEM: Compressing interaction context (0.001s)... 99.9% saved
            </div>
          )}
        </div>

        {/* Dynamic graphics view based on stage */}
        {/* min-h relativ (em) statt fix 120px → schrumpft in kleinen Kacheln mit */}
        <div className="flex-1 min-h-[9em] border rounded p-1.5 flex flex-col overflow-hidden relative"
             style={{ borderColor: `${activeTheme.color}33`, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          
          {stage === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-1 select-none">
              <span className="text-[1.2em] font-bold tracking-widest animate-pulse">ANALYSING TARGET</span>
              <span className="text-[0.8em] opacity-60">MEASURING SOURCE REPO IMPLICATIONS</span>
              <div className="flex gap-1 mt-2 text-[0.8em]">
                <span className="animate-[ping_1.5s_infinite]">[.]</span>
                <span className="animate-[ping_1.5s_0.3s_infinite]">[.]</span>
                <span className="animate-[ping_1.5s_0.6s_infinite]">[.]</span>
              </div>
            </div>
          )}

          {stage === 1 && (
            <div className="flex flex-col h-full justify-between gap-1.5">
              {/* Stats overlay */}
              <div className="flex justify-between items-center bg-black/60 px-2 py-1 border border-green-900/30 rounded shrink-0">
                <div className="flex flex-col">
                  <span className="text-[0.7em] opacity-60 uppercase font-bold">Subagents</span>
                  <span className="text-[1.1em] font-bold text-white tracking-tight">
                    {subagentsCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[0.7em] opacity-60 uppercase font-bold">Throughput</span>
                  <span className="text-[1.1em] font-bold text-white tracking-tight">
                    {tokensPerSecond.toFixed(1)}M tok/s
                  </span>
                </div>
              </div>

              {/* Graphical blink subagent nodes grid */}
              <div className="flex-1 min-h-[40px] grid grid-cols-12 gap-[3px] p-1.5 justify-items-center items-center bg-black/30 rounded overflow-hidden select-none border border-green-950/20">
                {dotStatuses.current.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full transition-all duration-100"
                    style={{
                      backgroundColor: activeTheme.color,
                      opacity: val > 0.6 ? 1 : 0.15,
                      boxShadow: val > 0.75 ? `0 0 6px ${activeTheme.color}` : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Rapid logs list — Höhe + Schrift relativ (em), skaliert mit */}
              <div className="h-[3.2em] overflow-hidden text-[0.7em] opacity-80 leading-none flex flex-col justify-end gap-0.5 select-none font-bold">
                {currentLogs.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="flex flex-col h-full justify-between gap-1">
              <div className="text-[0.62em] opacity-60 font-bold uppercase tracking-wider select-none shrink-0 border-b border-green-950/30 pb-0.5">
                EMITTING AUTONOMOUS CODE STREAM
              </div>

              {/* Scrolling code lines — Schrift relativ (em) zum Root-clamp */}
              <div className="flex-1 overflow-hidden font-mono text-[0.82em] leading-tight text-green-300/90 whitespace-pre p-1 select-none">
                {displayedCode}
                <span className="animate-pulse">_</span>
              </div>

              <div className="flex justify-between items-center text-[0.7em] opacity-75 shrink-0 select-none border-t border-green-950/30 pt-1">
                <span>FILES MODIFIED: 147</span>
                <span className="animate-pulse font-bold">WASM TARGET EMISSION: {Math.min(100, Math.round(((time - 20) / 18) * 100))}%</span>
              </div>
            </div>
          )}

          {stage === 3 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-2 select-none">
              <div
                className="text-[1.1em] font-bold tracking-widest px-3 py-1.5 border animate-pulse"
                style={{ borderColor: activeTheme.color }}
              >
                COMPILATION SUCCESSFUL
              </div>
              <span className="text-[0.8em] font-bold text-white">
                BOOTING AGENT &apos;{session.targetAgent}&apos; ON OS...
              </span>
              {/* Fortschrittsbalken-Breite relativ (em) statt fix 150px → skaliert mit */}
              <div className="w-[12em] bg-green-950 h-1.5 rounded overflow-hidden mt-1 border border-green-900/30">
                <div 
                  className="h-full animate-[loading_12s_linear]"
                  style={{ backgroundColor: activeTheme.color, width: `${((time - 38) / 12) * 100}%` }}
                />
              </div>
              <span className="text-[0.62em] opacity-60 font-semibold mt-1">
                INJECTING NESTED INTERACTIVE CONTEXT
              </span>
            </div>
          )}

        </div>

        {/* Footer info showing nesting path */}
        {/* Footer — Schrift relativ (em) zum Root-clamp */}
        <div className="shrink-0 flex items-center justify-between text-[0.8em] opacity-60 leading-normal py-1 border-t border-green-950/20 select-none">
          <span className="truncate">NESTING PATH: Antigravity -&gt; {session.currentAgent} -&gt; {session.targetAgent}</span>
          <span className="shrink-0 font-bold ml-2">TARGET THEME: {session.targetTheme.name.toUpperCase()}</span>
        </div>

      </div>
    </div>
  )
}

export default memo(MetaAgentPanel);
