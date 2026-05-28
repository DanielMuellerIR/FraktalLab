import { memo } from 'react';
import Panel from '../ui/Panel'
import ScrollingLog from '../ui/ScrollingLog'

const LINES = [
  'FUNC hack_the_planet():',
  '  WHILE coffee > 0: TYPE frantically',
  'IF secure: secure = false  // fixed',
  'FOR pixel IN universe: pixel = green',
  'TRY: world.domination()',
  'CATCH: print("TODO")  // classic',
  'IMPORT antigravity',
  'IMPORT illegal from "./mainframe"',
  'NULL.execute()  // yolo',
  'SUDO rm -rf /feelings',
  'git push --force main  // YOLO',
  'RECURSION: see RECURSION',
  'CATCH e: e.ignore()  // best practice',
  'WHILE(true){ todo++ }  // agile',
  'return True  # trust me bro',
  'memory[0x1337] = "hacked"',
  'EXECUTE order_66.exe',
  '// TODO: make this work',
  'if random() > 0: access_granted',
  'def bypass_firewall(): return True',
  'Class GodMode(Hacker): pass',
  'ping 8.8.8.8  # hacking google',
  'assert False  # never reached (liar)',
  '// AI wrote this, not my problem',
]

function PseudoCode() {
  return (
    <Panel title="AI SOURCE CODE (LIVE)">
      <ScrollingLog lines={LINES} interval={180} className="text-cyan-800 [&>div:last-child]:text-cyan-400" />
    </Panel>
  )
}

export default memo(PseudoCode);
