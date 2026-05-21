import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Ein "Schritt" im simulierten Chat-Ablauf.
// role: wer tippt (user = Eingabezeile, claude = Antwort, system = Statusmeldung)
// text: der vollständige Text, der Zeichen für Zeichen erscheint
type Step = {
  role: 'user' | 'claude' | 'system'
  text: string
  // optionale Verzögerung in ms, bevor der Schritt beginnt
  pauseBefore?: number
}

// ── Skript: simulierter Claude-Code-Dialog ─────────────────────────────────────
// Das hier ist das "Drehbuch", das immer wieder abgespielt wird.
// Es sieht aus wie eine echte Claude-Code-Session im Terminal.
const SCRIPT: Step[] = [
  // 1. Nutzer öffnet die Claude CLI
  { role: 'user',   text: 'claude', pauseBefore: 800 },
  // 2. System-Banner (erscheint sofort, ohne Tipp-Animation)
  {
    role: 'system',
    text: [
      '╔════════════════════════════════════════╗',
      '║  Claude Code  v1.0  ·  Anthropic       ║',
      '║  Type /help for commands               ║',
      '╚════════════════════════════════════════╝',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 3. Erster User-Prompt
  {
    role: 'user',
    text: 'Ich möchte ein Hacker-Dashboard bauen, React mit Canvas-Animationen, WASM für Fraktale. Was ist dein Plan?',
    pauseBefore: 600,
  },
  // 4. Claude erklärt den Plan
  {
    role: 'claude',
    text: [
      'Guter Plan. Hier mein Vorschlag:',
      '',
      '  Tech-Stack:',
      '    • React 19 + Vite + TypeScript + Tailwind v4',
      '    • Rust → wasm-pack → WebAssembly für Fraktale',
      '    • Canvas 2D für Demoscene-Effekte (kein WebGL nötig)',
      '',
      '  Architektur:',
      '    1. Grid-Layout mit austauschbaren Panel-Slots',
      '    2. Pool-System: Panels rotieren automatisch',
      '    3. WASM-Modul rendert Mandelbrot in Pixel-Buffer',
      '    4. rAF-Loop überträgt Buffer via ImageData',
      '',
      '  Start mit: npm create vite@latest + wasm-pack init',
    ].join('\n'),
    pauseBefore: 400,
  },
  // 5. Nächste Aufgabe
  {
    role: 'user',
    text: 'Gut. Baue jetzt den VoxelDemo-Panel.',
    pauseBefore: 700,
  },
  // 6. Claude liefert Code-Snippet
  {
    role: 'claude',
    text: [
      'Erstelle frontend/src/panels/VoxelDemo.tsx …',
      '',
      '  const W = 120, H = 80',
      '  const buf = new Uint8ClampedArray(W * H * 4)',
      '',
      '  function project(x,y,z) {',
      '    const fov = 120',
      '    const px = x / (z + fov) * fov + W/2',
      '    const py = y / (z + fov) * fov + H/2',
      '    return [px, py]',
      '  }',
      '',
      '  // Voxel-Grid: 16×16, jede Zelle eine Farbe',
      '  // Painter\'s Algorithm: hinten → vorne rendern',
      '',
      '✓  VoxelDemo.tsx — 187 lines written.',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 7. Nächste Aufgabe: GlobePanel
  {
    role: 'user',
    text: 'Jetzt einen rotierenden Wireframe-Globus.',
    pauseBefore: 600,
  },
  {
    role: 'claude',
    text: [
      'Erstelle frontend/src/panels/GlobePanel.tsx …',
      '',
      '  // Icosphere aus lat/lon-Gitter (36 × 18 Punkte)',
      '  // Rotation um Y-Achse mit Quaternion-freiem Trick:',
      '  //   x\' = x·cos(t) + z·sin(t)',
      '  //   z\' = -x·sin(t) + z·cos(t)',
      '  // Hauptstädte als beschriftete Punkte eingebaut.',
      '',
      '✓  GlobePanel.tsx — 312 lines written.',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 8. Kurze Frage
  {
    role: 'user',
    text: 'Wie speichere ich WASM-State über Re-renders?',
    pauseBefore: 500,
  },
  {
    role: 'claude',
    text: [
      'Mit useRef — der Wert bleibt über Re-renders erhalten,',
      'löst aber KEINEN erneuten Render aus (anders als useState).',
      '',
      '  const wasmRef = useRef<WasmModule | null>(null)',
      '',
      '  useEffect(() => {',
      '    init().then(m => { wasmRef.current = m })',
      '  }, [])   // leeres Array → nur beim Mount',
      '',
      '  // Im rAF-Callback:',
      '  wasmRef.current?.render(buf, zoom, cx, cy)',
    ].join('\n'),
    pauseBefore: 400,
  },
  // 9. Letzter Schritt vor Neustart
  {
    role: 'user',
    text: '/cost',
    pauseBefore: 600,
  },
  {
    role: 'system',
    text: [
      'Session cost: $0.23  |  Tokens in: 14 820  |  out: 4 103',
      'Cache read: 81%  |  Cache write: 19%',
    ].join('\n'),
    pauseBefore: 200,
  },
]

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Gibt eine zufällige Ganzzahl im Bereich [min, max] zurück
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Komponente ─────────────────────────────────────────────────────────────────
export default function ClaudeCodePanel() {
  // Ref auf das scrollbare Terminal-Ausgabe-Div
  const outputRef = useRef<HTMLDivElement>(null)
  // Ref auf die aktuelle Eingabezeile (unten, mit blinkendem Cursor)
  const inputLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Alle laufenden Timeouts merken, damit wir sie beim Unmount abbrechen können
    const timers: ReturnType<typeof setTimeout>[] = []

    // Hilfsfunktion: hängt eine neue Zeile an den Terminal-Output an
    function appendLine(html: string) {
      if (!outputRef.current) return
      const line = document.createElement('div')
      line.innerHTML = html
      outputRef.current.appendChild(line)
      // Automatisch nach unten scrollen
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }

    // Löscht den gesamten Output (für den Neustart der Schleife)
    function clearOutput() {
      if (outputRef.current) outputRef.current.innerHTML = ''
      if (inputLineRef.current) inputLineRef.current.textContent = ''
    }

    // Zeigt den "Prompt"-Teil links in der aktuellen Eingabezeile
    function setPrompt(text: string) {
      if (inputLineRef.current)
        inputLineRef.current.textContent = text
    }

    // Hauptfunktion: spielt einen einzelnen Schritt des Skripts ab,
    // dann ruft onDone auf, wenn er fertig ist.
    function playStep(step: Step, onDone: () => void) {
      const delay = step.pauseBefore ?? 0

      const t = setTimeout(() => {
        if (step.role === 'system') {
          // System-Meldungen erscheinen sofort als Block (kein Tipp-Effekt)
          const lines = step.text.split('\n')
          for (const l of lines) {
            appendLine(`<span style="color:#4ade80;opacity:0.6">${escHtml(l)}</span>`)
          }
          onDone()
          return
        }

        if (step.role === 'user') {
          // Prompt-Zeichen anzeigen, dann Zeichen für Zeichen "tippen"
          setPrompt('$ ')
          typeText(step.text, () => {
            // Nach dem Tippen: Eingabe in Output-Liste übernehmen
            appendLine(
              `<span style="color:#86efac">$ </span>` +
              `<span style="color:#d4d4d4">${escHtml(step.text)}</span>`
            )
            setPrompt('')
            onDone()
          })
          return
        }

        if (step.role === 'claude') {
          // Claude-Antwort: Zeile für Zeile mit Tipp-Verzögerung
          setPrompt('')
          // Zuerst eine leere "Claude:"-Zeile einblenden
          appendLine(`<span style="color:#c084fc;font-weight:bold">◆ Claude</span>`)
          const lines = step.text.split('\n')
          typeLines(lines, 0, onDone)
          return
        }
      }, delay)
      timers.push(t)
    }

    // Tippt einen String Zeichen für Zeichen in die inputLine
    function typeText(text: string, onDone: () => void) {
      let i = 0
      function nextChar() {
        if (i >= text.length) { onDone(); return }
        // Geschwindigkeit leicht variieren: 40–80 ms pro Zeichen
        const delay = randInt(40, 80)
        const t = setTimeout(() => {
          if (inputLineRef.current)
            inputLineRef.current.textContent = '$ ' + text.slice(0, i + 1)
          i++
          nextChar()
        }, delay)
        timers.push(t)
      }
      nextChar()
    }

    // Tippt mehrere Zeilen nacheinander (für Claude-Antworten)
    function typeLines(lines: string[], idx: number, onDone: () => void) {
      if (idx >= lines.length) { onDone(); return }
      const line = lines[idx]
      // Leere Zeilen sofort einfügen
      if (line === '') {
        appendLine('<span style="color:#bbf7d0;opacity:0.7">&nbsp;</span>')
        const t = setTimeout(() => typeLines(lines, idx + 1, onDone), 40)
        timers.push(t)
        return
      }
      // Zeile Zeichen für Zeichen aufbauen
      let i = 0
      // Neue Zeile anlegen, die wir dann live befüllen
      if (!outputRef.current) return
      const lineEl = document.createElement('div')
      lineEl.style.color = '#bbf7d0'
      lineEl.style.opacity = '0.9'
      outputRef.current.appendChild(lineEl)

      function nextChar() {
        if (i >= line.length) {
          // Zeilenabstand zum Scrollen
          outputRef.current!.scrollTop = outputRef.current!.scrollHeight
          const t = setTimeout(() => typeLines(lines, idx + 1, onDone), randInt(20, 60))
          timers.push(t)
          return
        }
        const charDelay = randInt(15, 45)   // Claude tippt schneller als der User
        const t = setTimeout(() => {
          lineEl.textContent = escHtmlText(line.slice(0, i + 1))
          outputRef.current!.scrollTop = outputRef.current!.scrollHeight
          i++
          nextChar()
        }, charDelay)
        timers.push(t)
      }
      nextChar()
    }

    // Spielt alle Skript-Schritte der Reihe nach ab,
    // wartet nach dem letzten 3 Sekunden, dann startet es von vorne.
    function playAll(stepIdx: number) {
      if (stepIdx >= SCRIPT.length) {
        // Kurz warten, dann alles leeren und neu starten
        const t = setTimeout(() => {
          clearOutput()
          playAll(0)
        }, 3000)
        timers.push(t)
        return
      }
      playStep(SCRIPT[stepIdx], () => playAll(stepIdx + 1))
    }

    playAll(0)

    // Cleanup: alle Timeouts abbrechen wenn die Komponente unmountet
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  return (
    <Panel title="CLAUDE CODE // NEURAL ARCHITECT">
      {/* Äußeres Wrapper-Div: füllt den Panel-Inhalt komplett */}
      <div className="flex flex-col h-full w-full overflow-hidden p-1 gap-0.5">

        {/* Scrollbarer Ausgabe-Bereich */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto text-xs font-mono leading-relaxed min-h-0"
          style={{ scrollbarWidth: 'none' }}
        />

        {/* Aktuelle Eingabezeile mit blinkendem Cursor */}
        <div className="flex items-center text-xs font-mono text-green-300 shrink-0 border-t border-green-900 pt-0.5">
          <span
            ref={inputLineRef}
            className="flex-1 whitespace-pre-wrap break-all"
          />
          {/* Blinkender Block-Cursor */}
          <span
            className="inline-block w-1.5 h-3 bg-green-400 ml-px animate-pulse"
            style={{ animationDuration: '800ms' }}
          />
        </div>
      </div>
    </Panel>
  )
}

// ── HTML-Escape-Hilfsfunktionen ───────────────────────────────────────────────

// Für innerHTML: maskiert < > & " '
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Für textContent-Zuweisung: Gibt den String unverändert zurück.
// textContent braucht kein HTML-Escaping — der Browser macht das automatisch.
function escHtmlText(s: string): string {
  return s
}
