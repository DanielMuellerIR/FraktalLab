import { memo,  useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Der gesamte Zustand des simulierten Miners
type MinerState = {
  // Hash-Rate in TH/s (Tera-Hashes pro Sekunde)
  hashRate: number
  // Accepted Shares — korrekte Arbeitsproben, die der Pool akzeptiert hat
  accepted: number
  // Rejected Shares — Proben, die zu spät oder falsch ankamen
  rejected: number
  // Aktuelle Block-Difficulty (simuliert, riesige Zahl wie beim echten Bitcoin)
  difficulty: string
  // Geschätzte Zeit bis zum nächsten Block (in Stunden:Minuten:Sekunden)
  eta: string
  // Leistungsaufnahme in Watt
  powerW: number
  // CPU-Temperatur in °C
  tempCPU: number
  // GPU-Temperatur in °C
  tempGPU: number
  // Wallet-Balance in BTC (wächst sehr langsam)
  balance: number
  // Zuletzt gezeigte Ereignis-Meldung
  lastEvent: string
  // Farbe für das letzte Ereignis ('green' | 'red' | 'cyan')
  eventColor: 'green' | 'red' | 'cyan'
  // Aktuelle Pool-Latenz in ms
  poolLatencyMs: number
  // Uptime in Sekunden
  uptimeSec: number
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Gibt eine zufällige Float-Zahl im Bereich [min, max] mit `decimals` Stellen zurück
function randFloat(min: number, max: number, decimals = 1): number {
  const v = min + Math.random() * (max - min)
  return parseFloat(v.toFixed(decimals))
}

// Gibt eine zufällige Ganzzahl im Bereich [min, max] zurück
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Konvertiert Sekunden in HH:MM:SS-Format
function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

// Generiert eine zufällige, realistisch aussehende Bitcoin-Block-Difficulty
// Echte Difficulty ist eine sehr große Zahl (~70 Billionen im Jahr 2024)
function fakeDifficulty(): string {
  const base = 72 + Math.random() * 12    // 72–84 Billionen
  return `${base.toFixed(2)}T`
}

// Berechnet geschätzte Zeit bis zum nächsten Block
// Basiert auf Hash-Rate vs. Difficulty (rein simuliert)
function calcETA(hashRate: number): string {
  // Vereinfachte Formel: difficulty / hashRate → Sekunden
  // In der Realität viel komplexer, aber das sieht überzeugend aus
  const totalSec = Math.floor(3600 * 24 * (85 / hashRate) * (1 + Math.random() * 0.3))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}


// Gelegentliche Ereignisse die ins Log-Feld geschrieben werden
const EVENTS: { text: string; color: 'green' | 'red' | 'cyan' }[] = [
  { text: '✓ Share accepted by pool', color: 'green' },
  { text: '✓ New share accepted! Stratum ACK', color: 'green' },
  { text: '✓ Valid nonce found — submitting', color: 'green' },
  { text: '✗ Share rejected — stale (pool lag)', color: 'red' },
  { text: '✗ Invalid share — difficulty mismatch', color: 'red' },
  { text: '⚡ Network difficulty adjusted +2.3%', color: 'cyan' },
  { text: '⚡ New block found by pool — resetting', color: 'cyan' },
  { text: '⚡ Pool fee deducted: 0.00000034 BTC', color: 'cyan' },
  { text: '⚡ Stratum reconnect — keepalive sent', color: 'cyan' },
  { text: '⚡ Getwork refresh — new job received', color: 'cyan' },
]

// ── Anfangszustand ─────────────────────────────────────────────────────────────
const INITIAL_STATE: MinerState = {
  hashRate:      847.3,
  accepted:      1482,
  rejected:      7,
  difficulty:    fakeDifficulty(),
  eta:           '09:22:15',
  powerW:        3420,
  tempCPU:       68,
  tempGPU:       84,
  balance:       0.00284731,
  lastEvent:     '✓ Mining started — connected to fraktalpool.io',
  eventColor:    'green',
  poolLatencyMs: 42,
  uptimeSec:     14400,   // 4 Stunden Uptime beim Start
}

// ── Fortschrittsbalken ─────────────────────────────────────────────────────────
// Gibt einen ASCII-Fortschrittsbalken der Breite `width` für Wert in [0,1] zurück
function progressBar(value: number, width = 20): string {
  const filled = Math.round(value * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ── Komponente ─────────────────────────────────────────────────────────────────
function BitcoinMinerPanel() {
  // Der gesamte Miner-Zustand als React-State (löst Re-render bei Änderung aus)
  const [state, setState] = useState<MinerState>(INITIAL_STATE)
  const scramblerRef = useRef<HTMLDivElement>(null)

  // Ref auf den Log-Bereich für automatisches Scrollen
  const logRef = useRef<HTMLDivElement>(null)

  // Zählt, wie oft schon getickt wurde (um seltene Ereignisse zu steuern)
  const tickRef = useRef(0)

  useEffect(() => {
    const chars = '0123456789abcdef'
    const interval = setInterval(() => {
      const scrambler = scramblerRef.current
      if (!scrambler) return
      let html = ''
      for (let r = 0; r < 4; r++) {
        let hash = '00000000' // Target difficulty prefix (8 leading zeros!)
        for (let c = 0; c < 20; c++) {
          hash += chars[Math.floor(Math.random() * 16)]
        }
        // Match frequency
        const rand = Math.random()
        let status = '<span class="text-green-800">[TRY]</span>'
        if (rand < 0.03) {
          status = '<span class="text-green-400 font-bold">[OK]</span>'
        } else if (rand < 0.06) {
          status = '<span class="text-red-500 font-bold">[ERR]</span>'
        }
        html += `<div class="flex justify-between"><span>${hash}</span><span>${status}</span></div>`
      }
      scrambler.innerHTML = html
    }, 60)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Alle 1,5 Sekunden werden Werte aktualisiert
    const interval = setInterval(() => {
      tickRef.current++
      const tick = tickRef.current

      setState(prev => {
        // Kleine zufällige Fluktuation der Hash-Rate (±5 TH/s)
        const hashRate = parseFloat(
          (prev.hashRate + randFloat(-5, 5)).toFixed(1)
        )
        // Hash-Rate bleibt im realistischen Bereich: 600–1100 TH/s
        const clampedHash = Math.max(600, Math.min(1100, hashRate))

        // CPU-Temperatur fluktuiert: ±1°C, bleibt in 60–92°C
        const tempCPU = Math.max(60, Math.min(92,
          prev.tempCPU + randInt(-1, 1)
        ))
        // GPU ist etwas wärmer: 70–98°C
        const tempGPU = Math.max(70, Math.min(98,
          prev.tempGPU + randInt(-1, 1)
        ))

        // Leistungsaufnahme fluktuiert ±30W
        const powerW = Math.max(2800, Math.min(4200,
          prev.powerW + randInt(-30, 30)
        ))

        // Pool-Latenz: 20–120ms, gelegentlich Spike
        const poolLatencyMs = Math.random() > 0.95
          ? randInt(150, 400)   // gelegentlicher Latenz-Spike
          : randInt(20, 80)

        // Alle ~8 Sekunden (jeden 5. Tick) einen neuen Share accepted
        const accepted = tick % 5 === 0 ? prev.accepted + 1 : prev.accepted
        // Alle ~90 Sekunden (jeden 60. Tick) einen Reject
        const rejected = tick % 60 === 0 ? prev.rejected + 1 : prev.rejected

        // Balance wächst sehr langsam: ~0.000001 BTC pro Tick
        const balance = prev.balance + 0.0000008 * (clampedHash / 847)

        // Uptime jede Sekunde inkrementieren (wir ticken alle 1.5s → +2)
        const uptimeSec = prev.uptimeSec + 2

        // ETA alle 10 Ticks neu berechnen
        const eta = tick % 10 === 0 ? calcETA(clampedHash) : prev.eta

        // Difficulty alle 30 Minuten simuliert ändern (alle 1200 Ticks)
        const difficulty = tick % 1200 === 0 ? fakeDifficulty() : prev.difficulty

        // Gelegentlich ein zufälliges Ereignis zeigen
        let lastEvent = prev.lastEvent
        let eventColor = prev.eventColor
        if (tick % randInt(15, 25) === 0) {
          const evt = EVENTS[randInt(0, EVENTS.length - 1)]
          lastEvent = evt.text
          eventColor = evt.color
        }

        return {
          hashRate: clampedHash,
          accepted,
          rejected,
          difficulty,
          eta,
          powerW,
          tempCPU,
          tempGPU,
          balance: parseFloat(balance.toFixed(8)),
          lastEvent,
          eventColor,
          poolLatencyMs,
          uptimeSec,
        }
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  // Farbe für Temperaturen: grün < 80°C, gelb < 90°C, rot darüber
  function tempColor(t: number): string {
    if (t < 80) return '#4ade80'
    if (t < 90) return '#fbbf24'
    return '#f87171'
  }

  // Hash-Rate-Balken: 0–1200 TH/s als 100%
  const hashBarValue = Math.min(1, state.hashRate / 1200)

  return (
    <Panel title="BITCOIN MINER // HASHRATE NOMINAL">
      <div className="flex flex-col h-full w-full overflow-hidden p-1.5 gap-1 text-xs font-mono">

        {/* ── Pool-Verbindung ────────────────────────────────────────── */}
        <div className="text-green-600 text-xs leading-tight">
          <div>POOL   stratum+tcp://fraktalpool.io:3333</div>
          <div>WORKER fraktallab.rig0  ·  LATENCY {state.poolLatencyMs}ms</div>
        </div>

        <div className="border-t border-green-900" />

        {/* ── Hash-Rate ──────────────────────────────────────────────── */}
        <div>
          <div className="flex justify-between">
            <span className="text-green-600">HASHRATE</span>
            <span className="text-green-400">{state.hashRate.toFixed(1)} TH/s</span>
          </div>
          {/* Visueller Balken für die Hash-Rate */}
          <div className="text-green-700 mt-0.5">[{progressBar(hashBarValue, 24)}]</div>
        </div>

        {/* ── Shares ─────────────────────────────────────────────────── */}
        <div className="flex gap-4">
          {/* Accepted Shares in Grün */}
          <div>
            <span className="text-green-600">ACCEPTED </span>
            <span className="text-green-400">{state.accepted}</span>
          </div>
          {/* Rejected Shares in Rot */}
          <div>
            <span className="text-green-600">REJECTED </span>
            <span style={{ color: state.rejected > 0 ? '#f87171' : '#4ade80' }}>
              {state.rejected}
            </span>
          </div>
        </div>

        <div className="border-t border-green-900" />

        {/* ── Block-Infos ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-green-600">
          <span>DIFFICULTY</span>
          <span className="text-green-400">{state.difficulty}</span>
          <span>ETA BLOCK</span>
          <span className="text-cyan-400">{state.eta}</span>
        </div>

        <div className="border-t border-green-900" />

        {/* ── Hardware-Status ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <span className="text-green-600">POWER</span>
          <span className="text-green-400">{state.powerW} W</span>
          <span className="text-green-600">CPU TEMP</span>
          <span style={{ color: tempColor(state.tempCPU) }}>{state.tempCPU}°C</span>
          <span className="text-green-600">GPU TEMP</span>
          <span style={{ color: tempColor(state.tempGPU) }}>{state.tempGPU}°C</span>
          <span className="text-green-600">UPTIME</span>
          <span className="text-green-400">{formatUptime(state.uptimeSec)}</span>
        </div>

        <div className="border-t border-green-900" />

        {/* ── Wallet-Balance ──────────────────────────────────────────── */}
        <div>
          <div className="text-green-600">WALLET BALANCE</div>
          {/* Balance in hellem Grün — wächst langsam sichtbar */}
          <div className="text-green-300 text-sm">{state.balance.toFixed(8)} BTC</div>
        </div>

        <div className="border-t border-green-900" />

        {/* ── Active Hash Attempts (Scrolling list) ────────────────────── */}
        <div className="flex flex-col gap-0.5 bg-black/40 p-1 border border-green-900/50 rounded overflow-hidden shrink-0">
          <div className="text-green-700 text-[8px] uppercase mb-0.5 border-b border-green-950 pb-0.5">ACTIVE HASH ATTEMPTS</div>
          <div ref={scramblerRef} className="flex flex-col gap-0.5 min-h-[50px]" />
        </div>

        <div className="border-t border-green-900" />

        {/* ── Letztes Ereignis ────────────────────────────────────────── */}
        <div
          ref={logRef}
          style={{
            color: state.eventColor === 'green'
              ? '#4ade80'
              : state.eventColor === 'red'
              ? '#f87171'
              : '#22d3ee',
          }}
          className="text-xs animate-pulse truncate"
        >
          {state.lastEvent}
        </div>
      </div>
    </Panel>
  )
}

export default memo(BitcoinMinerPanel);
