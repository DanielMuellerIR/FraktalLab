import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Eine einzelne Zeile im "Scan"-Output
type ScanLine = {
  text: string
  // Farbe der Zeile (CSS-Farbe)
  color?: string
  // Verzögerung in ms vor dieser Zeile
  delay: number
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Gibt eine zufällige Ganzzahl im Bereich [min, max] zurück
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Generiert eine zufällige (fake) IP-Adresse, die realistisch aussieht
function fakeIP(): string {
  // Öffentliche IP-Ranges (keine privaten wie 192.168.x.x)
  const first = [5, 46, 78, 89, 91, 95, 109, 178, 185, 188, 193, 212, 217]
  const a = first[randInt(0, first.length - 1)]
  return `${a}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`
}

// Generiert einen zufälligen (fake) Canvas-Fingerprint als 8-stellige Hex-Zahl
function fakeFingerprint(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0')
}

// Gibt eine der deutschen Städte zurück (glaubwürdige Geolocation)
function fakeGeoLocation(): string {
  const cities = [
    'Munich, Bavaria, DE',
    'Berlin, Brandenburg, DE',
    'Hamburg, Hamburg, DE',
    'Frankfurt, Hesse, DE',
    'Cologne, NRW, DE',
    'Vienna, Vienna, AT',
    'Zurich, Zurich, CH',
  ]
  return cities[randInt(0, cities.length - 1)]
}

// Fake-ISP passend zur deutschen Region
function fakeISP(): string {
  const isps = [
    'Deutsche Telekom AG',
    'Vodafone GmbH',
    'Unitymedia / Vodafone',
    '1&1 Versatel',
    'NetCologne GmbH',
    'M-net Telekommunikations GmbH',
    'A1 Telekom Austria',
  ]
  return isps[randInt(0, isps.length - 1)]
}

// Liest echte Browser-Infos aus navigator.userAgent
// und versucht, Browser und OS zu erkennen
function parseBrowserInfo(): string {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  let os = 'Unknown'

  // Browser erkennen (Reihenfolge wichtig: Edge vor Chrome prüfen!)
  if (ua.includes('Edg/')) {
    const m = ua.match(/Edg\/([\d.]+)/)
    browser = `Edge ${m?.[1]?.split('.')[0] ?? ''}`
  } else if (ua.includes('Firefox/')) {
    const m = ua.match(/Firefox\/([\d.]+)/)
    browser = `Firefox ${m?.[1]?.split('.')[0] ?? ''}`
  } else if (ua.includes('Chrome/')) {
    const m = ua.match(/Chrome\/([\d.]+)/)
    browser = `Chrome ${m?.[1]?.split('.')[0] ?? ''}`
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const m = ua.match(/Version\/([\d.]+)/)
    browser = `Safari ${m?.[1]?.split('.')[0] ?? ''}`
  }

  // Betriebssystem erkennen
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11'
  else if (ua.includes('Windows NT 6')) os = 'Windows 8'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('iPhone')) os = 'iOS'
  else if (ua.includes('Android')) os = 'Android'

  return `${browser} / ${os}`
}

// Liest echte Plugin-Namen aus navigator.plugins (falls vorhanden)
function getPlugins(): string {
  const plugins = Array.from(navigator.plugins).map(p => p.name)
  if (plugins.length === 0) return 'NONE DETECTED'
  return plugins.slice(0, 3).join(', ')
}

// Witzige Abschluss-Zeilen, die zeigen: das ist ein Joke
const JOKES = [
  "Don't worry, we only sell your data to 4 AIs.",
  'Your browser history is safe. (We already have a copy.)',
  'Threat level: CIVILIAN with questionable taste in websites.',
  'Relax. The surveillance is purely for quality assurance.',
  'You passed the Turing Test. Unfortunately.',
  'Your cat browsing history: classified.',
]

// ── Monitoring-Ereignisse für die Loop nach dem Scan ─────────────────────────
// Diese Zeilen erscheinen alle ~30 Sekunden und simulieren "neue Aktivität"
const MONITOR_EVENTS = [
  '> CURSOR MOVEMENT DETECTED — bearing 047° from center',
  '> TAB SWITCH DETECTED — classified target acquired',
  '> IDLE TIMEOUT — subject distracted (social media suspected)',
  '> SCROLL EVENT — reading speed: 180 WPM (below average)',
  '> FOCUS LOSS — alt+tab to competitor site? Logging.',
  '> NETWORK PING SPIKE — 240ms. ISP throttling detected.',
  '> CANVAS FINGERPRINT UNCHANGED — identity confirmed',
  '> MEMORY SNAPSHOT — 2.3 GB heap in use. Heavy tab.',
  '> CLICK REGISTERED — pixel-perfect. Suspicious.',
  '> VISIBILITYCHANGE — subject returned. Missed us?',
]

// ── Scan-Zeilen aufbauen ───────────────────────────────────────────────────────
// Erstellt die komplette Liste von Scan-Ausgabe-Zeilen mit echten Browser-Daten
function buildScanLines(): ScanLine[] {
  const ip     = fakeIP()
  const geo    = fakeGeoLocation()
  const isp    = fakeISP()
  const ua     = navigator.userAgent
  const browser = parseBrowserInfo()
  const screen_ = `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x DPR`
  const lang   = navigator.language || 'UNKNOWN'
  const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UNKNOWN'
  const fp     = fakeFingerprint()
  const plugins = getPlugins()
  const joke   = JOKES[randInt(0, JOKES.length - 1)]
  // Fake-Batterie (BatteryManager API ist deprecated und selten verfügbar)
  const battery = `${randInt(12, 97)}% — ${Math.random() > 0.4 ? 'DISCHARGING' : 'CHARGING'}`

  // Typ der Verbindung (Connection API — nicht überall verfügbar)
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } }
  const connType = nav.connection?.effectiveType?.toUpperCase() ?? '4G'

  return [
    { text: '> INITIATING VISITOR SCAN...', color: '#4ade80', delay: 200 },
    { text: '> ESTABLISHING CONNECTION...',  color: '#4ade80', delay: 400 },
    { text: '> [████████████████] 100% — LINK ESTABLISHED', color: '#4ade80', delay: 600 },
    { text: '', delay: 100 },
    { text: `> IP ADDRESS       : ${ip}`, color: '#86efac', delay: 350 },
    { text: `> GEOLOCATION      : ${geo}`, color: '#86efac', delay: 300 },
    { text: `> ISP              : ${isp}`, color: '#86efac', delay: 280 },
    { text: '', delay: 80 },
    { text: `> USER AGENT       : ${ua.slice(0, 60)}`, color: '#a3e635', delay: 280 },
    { text: `>                  : …${ua.slice(60, 100)}`, color: '#a3e635', delay: 80 },
    { text: `> BROWSER / OS     : ${browser}`, color: '#86efac', delay: 250 },
    { text: `> SCREEN           : ${screen_}`, color: '#86efac', delay: 220 },
    { text: `> LANGUAGE         : ${lang}`, color: '#86efac', delay: 200 },
    { text: `> TIMEZONE         : ${tz}`, color: '#86efac', delay: 200 },
    { text: `> CONNECTION       : ${connType}`, color: '#86efac', delay: 180 },
    { text: '', delay: 80 },
    { text: `> CANVAS FP        : 0x${fp} [FINGERPRINT STORED]`, color: '#22d3ee', delay: 400 },
    { text: `> BATTERY STATUS   : ${battery}`, color: '#22d3ee', delay: 280 },
    { text: `> PLUGINS          : ${plugins}`, color: '#22d3ee', delay: 250 },
    { text: '', delay: 80 },
    { text: '> RUNNING THREAT ASSESSMENT...', color: '#fbbf24', delay: 600 },
    { text: '> CROSS-REFERENCING GLOBAL WATCHLISTS...', color: '#fbbf24', delay: 500 },
    { text: '> THREAT LEVEL     : CIVILIAN ✓', color: '#4ade80', delay: 700 },
    { text: '> STATUS           : BEING MONITORED', color: '#f87171', delay: 200 },
    { text: '', delay: 150 },
    { text: `> NOTE             : ${joke}`, color: '#d8b4fe', delay: 300 },
    { text: '', delay: 200 },
    { text: '─────────────────────────────────────────────', color: '#166534', delay: 100 },
    { text: '> MONITORING LOOP ACTIVE — WATCHING FOR EVENTS', color: '#4ade80', delay: 300 },
  ]
}

// ── Komponente ─────────────────────────────────────────────────────────────────
export default function VisitorProfilePanel({ onComplete }: { onComplete?: () => void }) {
  // Ref auf den scrollbaren Ausgabe-Bereich
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Alle laufenden Timeouts und Intervalle für den Cleanup merken
    const timers: ReturnType<typeof setTimeout>[] = []
    let monitorInterval: ReturnType<typeof setInterval> | null = null

    // Hängt eine neue HTML-Zeile an den Output an
    function appendLine(text: string, color: string = '#86efac') {
      if (!outputRef.current) return
      const el = document.createElement('div')
      el.textContent = text
      el.style.color = color
      outputRef.current.appendChild(el)
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }

    // Spielt alle Scan-Zeilen mit ihren Delays nacheinander ab
    function playScan(lines: ScanLine[], idx: number, onDone: () => void) {
      if (idx >= lines.length) { onDone(); return }
      const line = lines[idx]
      const t = setTimeout(() => {
        appendLine(line.text, line.color ?? '#86efac')
        playScan(lines, idx + 1, onDone)
      }, line.delay)
      timers.push(t)
    }

    // Startet die Monitoring-Loop: alle 28–35 Sekunden ein zufälliges Ereignis
    let monitorIdx = 0
    function startMonitoring() {
      // Shuffle die Ereignisliste einmalig
      const events = [...MONITOR_EVENTS].sort(() => Math.random() - 0.5)

      monitorInterval = setInterval(() => {
        const evt = events[monitorIdx % events.length]
        appendLine('', '#166534')  // Leerzeile als Trenner
        appendLine(evt, '#fbbf24')
        monitorIdx++
      }, randInt(28000, 36000))
    }

    // Startet den gesamten Ablauf
    function start() {
      if (outputRef.current) outputRef.current.innerHTML = ''
      const lines = buildScanLines()
      // Gesamte Scan-Dauer: Summe aller Delays (ca. 7–9 Sekunden)
      playScan(lines, 0, () => {
        startMonitoring()
        if (onComplete) {
          const t = setTimeout(() => {
            onComplete()
          }, 10000)
          timers.push(t)
        }
      })
    }

    start()

    // Cleanup beim Unmount
    return () => {
      for (const t of timers) clearTimeout(t)
      if (monitorInterval) clearInterval(monitorInterval)
    }
  }, [onComplete])

  return (
    <Panel title="VISITOR PROFILE // BIOMETRIC SCAN ACTIVE">
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto text-xs font-mono leading-relaxed p-1 min-h-0"
        style={{ scrollbarWidth: 'none' }}
      />
    </Panel>
  )
}
