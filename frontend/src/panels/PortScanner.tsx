import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

const LINES = [
  '192.168.0.1   PORT 22  ██ OPEN',
  '192.168.0.7   PORT 80  ██ OPEN',
  '10.0.0.99     PORT 23  ██ VULN !!!',
  '172.16.0.1    PORT 8080 ██ OPEN',
  '10.10.10.10   ████ HACKING ████',
  '127.0.0.1     YES IT\'S YOU',
  '0.0.0.0       PORT ??? ░░ ???',
]

export default function PortScanner() {
  return (
    <Panel title="PORT SCANNER">
      <ScrollingLog lines={LINES} interval={700} />
    </Panel>
  )
}
