import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

const LINES = [
  'SCANNING    nukeplant-wiesbaden.gov ... FOUND',
  'CONNECTING  nukeplant-wiesbaden.gov ... OK',
  'AUTH        admin:nuclear123 ........... ✗',
  'AUTH        operator:1234 .............. ✓ !!!',
  'ACCESS      REACTOR CONTROL PANEL ...... OK',
  'STATUS      CORE TEMP: 847°C ........... FINE',
  'SCANNING    pentagon.mil ............... FOUND',
  'AUTH        general:1234 ............... ✓',
  'WARNING     THIS IS ILLEGAL ............ ignored',
  'SCANNING    kremlin-api.ru ............. FOUND',
  'AUTH        putin:password ............. ✓ lol',
  'SCANNING    norad.smil.mil ............. FOUND',
  'AUTH        captain:coffee ............. ✓',
  'MISSILES    STATUS: armed .............. 👍',
  'TODO        actually disarm them ........ later',
  'DOWNLOADING classified_stuff.zip ....... 3%',
]

export default function NuclearTargets() {
  return (
    <Panel title="☢ NUCLEAR SITE INFILTRATION">
      <ScrollingLog lines={LINES} interval={1100} className="text-yellow-700 [&>div:last-child]:text-yellow-400" />
    </Panel>
  )
}
