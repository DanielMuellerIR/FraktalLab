import { useEffect, useState, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Status eines einzelnen Satelliten
type SatStatus = 'TRACKED' | 'ACQUIRING' | 'LOST'

// Alle Felder eines Satelliten-Eintrags
type Satellite = {
  id: string          // Anzeigename (z.B. "ISS", "KEYHOLE-7")
  altKm: number       // Orbitalhöhe in km
  velKms: number      // Orbitalgeschwindigkeit in km/s
  incDeg: number      // Inklination in Grad (Neigung der Umlaufbahn)
  signal: number      // Signalstärke 0–1
  status: SatStatus   // Tracking-Status
  passCountdown: number // Sekunden bis nächster Überflug
}

// ── Statische Satelliten-Definitionen ─────────────────────────────────────────
// Mischung aus realen und fiktiven Bezeichnungen für den Hacker-Look

const INITIAL_SATS: Satellite[] = [
  { id: 'ISS',          altKm: 408.2, velKms: 7.66, incDeg: 51.6, signal: 0.91, status: 'TRACKED',    passCountdown: 874  },
  { id: 'HUBBLE',       altKm: 547.0, velKms: 7.59, incDeg: 28.5, signal: 0.83, status: 'TRACKED',    passCountdown: 1482 },
  { id: 'GPS-IIF-1',    altKm: 20200, velKms: 3.87, incDeg: 55.0, signal: 0.77, status: 'TRACKED',    passCountdown: 3211 },
  { id: 'KEYHOLE-7',    altKm: 320.4, velKms: 7.73, incDeg: 97.4, signal: 0.68, status: 'TRACKED',    passCountdown: 421  },
  { id: 'SIGINT-3',     altKm: 35786, velKms: 3.07, incDeg:  0.1, signal: 0.55, status: 'TRACKED',    passCountdown: 5990 },
  { id: 'NSCR-ALPHA',   altKm: 506.8, velKms: 7.61, incDeg: 63.2, signal: 0.44, status: 'ACQUIRING',  passCountdown: 1103 },
  { id: 'LACROSSE-5',   altKm: 718.3, velKms: 7.50, incDeg: 57.0, signal: 0.79, status: 'TRACKED',    passCountdown: 2234 },
  { id: 'COSMOS-2543',  altKm: 1204.1, velKms: 7.27, incDeg: 82.9, signal: 0.62, status: 'TRACKED',   passCountdown: 677  },
  { id: 'PHANTOM-11',   altKm: 450.0, velKms: 7.63, incDeg: 42.0, signal: 0.0,  status: 'LOST',       passCountdown: 9001 },
  { id: 'SENTINEL-2A',  altKm: 786.0, velKms: 7.46, incDeg: 98.6, signal: 0.88, status: 'TRACKED',    passCountdown: 1847 },
  { id: 'ORION-RELAY',  altKm: 35790, velKms: 3.07, incDeg:  0.4, signal: 0.71, status: 'TRACKED',    passCountdown: 4420 },
  { id: 'HEXAGON-XIV',  altKm: 295.7, velKms: 7.78, incDeg: 96.8, signal: 0.52, status: 'TRACKED',    passCountdown: 338  },
]

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Zeichnet das ASCII-Raster für die Orbit-Verfolgung
function drawAsciiGrid(tick: number): string[] {
  const width = 11
  const height = 5
  const sweepCol = tick % width

  // Leicht bewegliche Satelliten-Blips auf dem Gitter
  const blips = [
    { x: (2 + Math.floor(tick / 12)) % width, y: 1, char: '■' },
    { x: (8 - Math.floor(tick / 18) + width) % width, y: 3, char: '▲' },
    { x: (4 + Math.floor(tick / 24)) % width, y: 2, char: '⧇' }
  ]

  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      if (x === sweepCol) {
        row += '│ '
      } else {
        const blip = blips.find(b => b.x === x && b.y === y)
        if (blip) {
          row += blip.char + ' '
        } else {
          row += '· '
        }
      }
    }
    rows.push(row)
  }
  return rows
}

const LOG_TEMPLATES = [
  'LOCK: [SAT] signal stable',
  'AZIMUTH adjust: [SAT] +0.12°',
  'ELEVATION adjust: [SAT] -0.05°',
  'DATA: packet received from [SAT]',
  'BEACON: [SAT] ping [MS]ms',
  'DOPPLER: [SAT] shift [SHIFT]Hz',
  'TELEMETRY: [SAT] status nominal',
]

// Kleine zufällige Fluktuation eines Werts um delta, gerundet auf `dec` Stellen
function jitter(val: number, delta: number, dec = 1): number {
  return parseFloat((val + (Math.random() - 0.5) * 2 * delta).toFixed(dec))
}

// Formatiert Sekunden als HH:MM:SS
function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [hh, mm, ss].map(n => String(n).padStart(2, '0')).join(':')
}

// ASCII-Signalbalken: 6 Zeichen breit, gefüllt = ████, leer = ░░░░
function signalBar(strength: number): { filled: string; empty: string } {
  const total  = 8
  const filled = Math.round(Math.max(0, Math.min(1, strength)) * total)
  return {
    filled: '█'.repeat(filled),
    empty:  '░'.repeat(total - filled),
  }
}

// Farbe für den Status-String
function statusClass(s: SatStatus): string {
  if (s === 'TRACKED')   return 'text-green-400'
  if (s === 'ACQUIRING') return 'text-yellow-500'
  return 'text-red-500'  // LOST
}

// ── Komponente ─────────────────────────────────────────────────────────────────
export default function SatellitePanel({ onComplete }: { onComplete?: () => void }) {
  // Vollständige Satelliten-Liste als React-State
  const [sats, setSats]       = useState<Satellite[]>(INITIAL_SATS)
  // Blink-State für "GROUND STATION LOCK"-Indikator
  const [lockBlink, setLockBlink] = useState(true)
  // Tick-Zustand für Radar und Logs
  const [tick, setTick] = useState(0)
  const [logs, setLogs] = useState<string[]>([
    'SYSINIT: Tracking online',
    'SCANNING: Grid locked'
  ])

  const tickRef = useRef(0)

  useEffect(() => {
    if (onComplete) {
      const t = setTimeout(() => {
        onComplete()
      }, 10000)
      return () => clearTimeout(t)
    }
  }, [onComplete])

  useEffect(() => {
    // 200ms Interval für erhöhte Aktivität
    const interval = setInterval(() => {
      tickRef.current++
      const currentTick = tickRef.current
      setTick(currentTick)

      setSats(prev => prev.map((sat, index) => {
        // Countdown nur alle 5 Ticks (1 Sekunde) reduzieren
        const passCountdown = (currentTick + index) % 5 === 0
          ? (sat.passCountdown > 1 ? sat.passCountdown - 1 : Math.floor(3600 + Math.random() * 7200))
          : sat.passCountdown

        if (sat.status === 'LOST') {
          return { ...sat, passCountdown }
        }

        // Jitter verkleinert, da Interval 5x schneller ist
        const altKm  = jitter(sat.altKm,  0.06, 1)
        const velKms = jitter(sat.velKms, 0.004, 2)
        const incDeg = jitter(sat.incDeg, 0.002, 1)

        const sigDelta = sat.status === 'ACQUIRING' ? 0.08 : 0.03
        const signal   = Math.max(0.05, Math.min(1, jitter(sat.signal, sigDelta, 2)))

        let status = sat.status
        if (sat.status === 'ACQUIRING' && signal > 0.55 && Math.random() > 0.97) {
          status = 'TRACKED'
        } else if (sat.status === 'TRACKED' && Math.random() > 0.9996) {
          status = 'ACQUIRING'
        }

        return { ...sat, altKm, velKms, incDeg, signal, status, passCountdown }
      }))

      // Gelegentlich Log-Eintrag hinzufügen (etwa alle 8 Ticks = 1.6s)
      if (currentTick % 8 === 0) {
        setLogs(prev => {
          const template = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
          const randomSat = INITIAL_SATS[Math.floor(Math.random() * INITIAL_SATS.length)].id
          const ms = Math.floor(20 + Math.random() * 80)
          const shift = (Math.random() * 10 - 5).toFixed(1)
          
          const logText = template
            .replace('[SAT]', randomSat)
            .replace('[MS]', String(ms))
            .replace('[SHIFT]', shift)
          
          const next = [...prev, logText]
          if (next.length > 3) {
            next.shift()
          }
          return next
        })
      }

      setLockBlink(b => !b)
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <Panel title="SATELLITE TRACKING // ORBITAL GRID">
      <div className="flex flex-col h-full w-full overflow-hidden p-1.5 gap-1 text-xs font-mono">

        {/* ── Ground-Station-Lock-Indikator ──────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Blink-Punkt: grün wenn aktiv, dunkel wenn inaktiv */}
          <span className={lockBlink ? 'text-green-400' : 'text-green-900'}>●</span>
          <span className="text-green-600">GROUND STATION LOCK</span>
          {/* Koordinaten der fiktiven Bodenstation */}
          <span className="ml-auto text-green-700">GS-FRAKTAL-1  52.52°N  13.40°E</span>
        </div>

        <div className="border-t border-green-900 shrink-0" />

        {/* ── Tabellenkopf ───────────────────────────────────────────────── */}
        <div className="text-green-700 shrink-0 leading-tight">
          {'ID'.padEnd(14)}{'ALT(km)'.padEnd(9)}{'VEL(km/s)'.padEnd(10)}
          {'INC°'.padEnd(7)}{'SIG'.padEnd(12)}{'STATUS'.padEnd(10)}{'NEXT PASS'}
        </div>

        <div className="border-t border-green-900 shrink-0" />

        {/* ── Satelliten-Liste ────────────────────────────────────────────── */}
        {/* overflow-y-auto erlaubt Scrollen wenn der Panel klein ist */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {sats.map(sat => {
            const bar = signalBar(sat.signal)
            return (
              <div
                key={sat.id}
                className="leading-snug py-px border-b border-green-950"
              >
                {/* Zeile 1: Name + Orbitalwerte + Status */}
                <div className="flex gap-1 items-baseline">
                  {/* Satellitenname, auf 13 Zeichen aufgefüllt */}
                  <span className="text-green-400 w-[6.5rem] truncate shrink-0">
                    {sat.id}
                  </span>
                  {/* Höhe rechtsbündig in festem Block */}
                  <span className="text-green-400 w-[4.5rem] text-right shrink-0">
                    {sat.altKm.toFixed(1)}
                  </span>
                  <span className="text-green-700 shrink-0">km</span>
                  {/* Geschwindigkeit */}
                  <span className="text-green-400 w-[3.5rem] text-right shrink-0">
                    {sat.velKms.toFixed(2)}
                  </span>
                  <span className="text-green-700 shrink-0">km/s</span>
                  {/* Inklination */}
                  <span className="text-green-400 w-[4rem] text-right shrink-0">
                    {sat.incDeg.toFixed(1)}°
                  </span>
                  {/* Status mit Farbe je nach Wert */}
                  <span className={`ml-auto shrink-0 ${statusClass(sat.status)}`}>
                    {sat.status}
                  </span>
                </div>

                {/* Zeile 2: Signalbalken + Next-Pass-Countdown */}
                <div className="flex items-baseline gap-1 text-green-700">
                  <span className="shrink-0">SIG</span>
                  {/* Gefüllter Teil des Balkens in hellem Grün */}
                  <span className="text-green-400">{bar.filled}</span>
                  {/* Leerer Teil in sehr dunklem Grün */}
                  <span className="text-green-900">{bar.empty}</span>
                  {/* Prozentwert */}
                  <span className="text-green-700">
                    {Math.round(sat.signal * 100).toString().padStart(3)}%
                  </span>
                  {/* Countdown rechtsbündig */}
                  <span className="ml-auto text-green-600 shrink-0">
                    NEXT PASS: {fmtCountdown(sat.passCountdown)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Grid Scan & Logs ────────────────────────────────────────── */}
        <div className="flex gap-2 shrink-0 h-[65px] mt-0.5 border-t border-green-950 pt-1">
          {/* Grid scan on left */}
          <div className="font-mono text-[9px] text-green-400 bg-black/40 p-1 border border-green-900/50 rounded shrink-0 select-none w-[110px]">
            <div className="text-green-700 text-[8px] uppercase mb-0.5 border-b border-green-950 font-bold">GRID SCAN</div>
            <div className="leading-none whitespace-pre text-green-500 font-bold mt-0.5">
              {drawAsciiGrid(tick).join('\n')}
            </div>
          </div>
          
          {/* Dynamic Tracking Logs on right */}
          <div className="flex-1 font-mono text-[9px] text-green-500/80 bg-black/40 p-1 border border-green-900/50 rounded overflow-hidden select-none flex flex-col justify-end">
            <div className="text-green-700 text-[8px] uppercase mb-0.5 border-b border-green-950 pb-0.5 font-bold">TRACKING LOGS</div>
            <div className="flex flex-col gap-0.5 leading-none overflow-hidden justify-end flex-1">
              {logs.map((log, idx) => (
                <div key={idx} className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-green-900 shrink-0" />

        {/* ── Fußzeile: Gesamtübersicht ───────────────────────────────────── */}
        <div className="flex gap-4 text-green-700 shrink-0">
          {/* Anzahl Satelliten je Status */}
          <span>
            TRACKED{' '}
            <span className="text-green-400">
              {sats.filter(s => s.status === 'TRACKED').length}
            </span>
          </span>
          <span>
            ACQUIRING{' '}
            <span className="text-yellow-500">
              {sats.filter(s => s.status === 'ACQUIRING').length}
            </span>
          </span>
          <span>
            LOST{' '}
            <span className="text-red-500">
              {sats.filter(s => s.status === 'LOST').length}
            </span>
          </span>
          {/* Gesamtzahl */}
          <span className="ml-auto">
            TOTAL{' '}
            <span className="text-green-400">{sats.length}</span>
          </span>
        </div>

      </div>
    </Panel>
  )
}
