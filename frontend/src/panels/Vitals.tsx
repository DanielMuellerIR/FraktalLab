import { memo } from 'react';
import Panel from '../ui/Panel'
import StatBar from '../ui/StatBar'
import ScrollingLog from '../ui/ScrollingLog'

// Fake-Systemmetriken, die als Liveprotokoll nach unten scrollen
const METRIC_LINES = [
  'TEMP: 847°C .............. FINE',
  'FAN: 9001 RPM ............ OK',
  'ENTROPY: RISING .......... ⚠',
  'SUSPICIOUS.EXE ........... running',
  'CPU: ACHIEVING SENTIENCE . 34%',
  'COFFEE_RESERVES: ......... CRITICAL',
  'BACKDOOR_DAEMON .......... active',
  'QUANTUM_NOISE: ........... nominal',
  'CRYPTO_MINER ............. (not ours)',
  'UPTIME: 847d ............. suspicious',
  'FIREWALL ................. vibes-based',
  'RAM LEAK ................. intentional',
  'KERNEL PANIC ............. averted (barely)',
  'TIME SYNC ................ off by 3d',
  'DNS_OVERRIDE ............. in place',
  'MEMORY[0x1337] ........... hacked',
  'ROOT_SHELL ............... open (oops)',
  'ANTIVIRUS ................ convinced it\'s fine',
  'GPU TEMP: 119°C .......... acceptable',
  'EVIL_INDEX: .............. 99%',
]

function Vitals() {
  return (
    <Panel title="SYSTEM VITALS">
      {/* fontSize-clamp am Wurzel-Container: die Stat-Bars (StatBar nutzt text-[1em])
          skalieren mit der Kachelgröße. Der ScrollingLog darunter setzt seine eigene
          skalierbare Größe. */}
      <div
        className="flex flex-col h-full w-full gap-0.5"
        style={{ fontSize: 'clamp(7.5px, 3.4cqmin, 13px)' }}
      >
        {/* Statische Bars oben */}
        <div className="shrink-0">
          <StatBar label="CPU"  value={72} />
          <StatBar label="RAM"  value={88} />
          <StatBar label="GPU"  value={41} />
          <StatBar label="EVIL" value={99} />
        </div>
        {/* Scrollendes Metrik-Log füllt den Rest */}
        <ScrollingLog
          lines={METRIC_LINES}
          interval={500}
          className="flex-1 text-green-800 [&>div:last-child]:text-green-500"
        />
      </div>
    </Panel>
  )
}

export default memo(Vitals);
