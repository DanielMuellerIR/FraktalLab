import { memo } from 'react';
import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

// Fake binary/hex data für den "wir hacken das Mainframe"-Look
const LINES = [
  '01001000 01000001 01000011 01001011',
  '> STREAM INIT 0xDEADBEEF',
  '0xFF 0x1A 0x4C ... INJECTING',
  'BUFFER OVERFLOW: contained',
  'KERNEL MODULE LOADED: evil.ko',
  '0x7FFF SEGFAULT (intended)',
  'ENTROPY: 99.97% (very random)',
  'PACKET 4721/∞ ... SENT',
  'CRC MISMATCH: who cares',
  '> BYPASS SEQUENCE ALPHA',
  'HEXDUMP: [redacted for your safety]',
  '10110101 11001010 01110011',
  '>>> EXECUTING PAYLOAD',
  'STACK SMASH: feature not bug',
]

function DataStream() {
  return (
    <Panel title="DATA STREAM" className="text-cyan-800 [&>div:last-child]:text-cyan-300">
      <ScrollingLog lines={LINES} interval={80} />
    </Panel>
  )
}

export default memo(DataStream);
