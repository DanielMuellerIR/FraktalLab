import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

// Gefälschter Netzwerk-Traffic — klassischer Überwachungsmonitor-Look
const LINES = [
  'IN  192.168.1.14 → 10.0.0.1  TCP  1337 bytes',
  'OUT 10.0.0.1 → 8.8.8.8   UDP  420  bytes',
  'IN  172.16.0.5 → LOCAL  HTTP 200  /api/secrets',
  'OUT LOCAL → NSA-RELAY  TLS  ??? bytes',
  '⚡ SPIKE: 9.4 GB/s (normal)',
  'IN  0.0.0.0 → HERE  ???  0 bytes (spooky)',
  'DROP 192.168.99.99 (sus)',
  'OUT LOCAL → DARKWEB:8080 encrypted',
  'TOTAL: 1.21 GIGABYTES since boot',
  'LATENCY: 2ms to moon (nice)',
  'IN  ROUTER → AI  FEED  all your data',
  'BANDWIDTH: technically infinite',
  'PACKET LOSS: 0% (lying)',
]

export default function TrafficMonitor() {
  return (
    <Panel title="TRAFFIC MONITOR" className="text-amber-900 [&>div:last-child]:text-amber-400">
      <ScrollingLog lines={LINES} interval={500} />
    </Panel>
  )
}
