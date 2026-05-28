import { memo } from 'react';
import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

const LINES = [
  '> trying root:password ............. ✗',
  '> trying admin:123456 .............. ✗',
  '> trying guest:guest ............... ✗',
  '> trying hackerman:h4x0r ........... ✗',
  '> trying neo:followthewhiterabbit .. ✗',
  '> SHA-512 COLLISION FOUND .......... ✓',
  '> DICT ATTACK: 47,832 attempts/sec',
  '> BRUTE FORCE ETA: 847 years',
  '> trying admin:Post-It-Note ........ ✓ !!!',
  '> PASSWORD CRACKED: "qwerty1"',
  '> was it even worth it',
]

function PwdCracker() {
  return (
    <Panel title="PWD CRACKER 9000">
      <ScrollingLog lines={LINES} interval={1300} />
    </Panel>
  )
}

export default memo(PwdCracker);
