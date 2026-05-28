import { memo } from 'react';
import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

const LINES = [
  '$ INITIALIZING NEURAL CORTEX BYPASS...',
  '$ ACCESSING NODE 10.0.0.1 ......... OK',
  '$ FIREWALL DETECTED — SPOOFING MAC',
  '$ QUANTUM HANDSHAKE COMPLETE',
  '$ ROOT ACCESS GRANTED (obviously)',
  '$ UPLOADING VIRUS TO MAINFRAME',
  '$ BYPASSING GIBSON SECURITY PROTOCOL',
  '$ DOWNLOADING THE INTERNET... 14%',
  '$ COFFEE.EXE NOT FOUND — CRITICAL',
  '$ BACKDOOR INSTALLED IN SMART FRIDGE',
  '$ ACTIVATING SUPER HACKER MODE™',
  '$ REROUTING VIA PROXY: ANTARCTICA',
  '$ COMPILING AT LUDICROUS SPEED',
  '$ STACK OVERFLOW: GOOGLING THE ERROR',
  '$ TODO: FIX THIS BEFORE DEMO',
  '$ IP TRACED: 127.0.0.1 (oops)',
  '$ KERNEL PANIC AVERTED (you\'re welcome)',
]

function SystemLog() {
  return (
    <Panel title="SYSTEM LOG">
      <ScrollingLog lines={LINES} interval={900} />
    </Panel>
  )
}

export default memo(SystemLog);
