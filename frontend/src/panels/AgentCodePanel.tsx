import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Ein "Schritt" im simulierten Chat-Ablauf.
// role: wer tippt (user = Eingabezeile, agent = Antwort, system = Statusmeldung)
// text: der vollständige Text, der Zeichen für Zeichen erscheint
type Step = {
  role: 'user' | 'agent' | 'system'
  text: string
  // optionale Verzögerung in ms, bevor der Schritt beginnt
  pauseBefore?: number
}

// ── Skript: simulierter Agenten-Code-Dialog ─────────────────────────────────────
// Das hier ist das "Drehbuch", das immer wieder abgespielt wird.
// Es sieht aus wie eine echte AI-Agent-Session im Terminal.
const SCRIPT: Step[] = [
  // 1. Nutzer öffnet die CLI
  { role: 'user',   text: 'agent-dev-cli', pauseBefore: 800 },
  // 2. System-Banner (erscheint sofort, ohne Tipp-Animation)
  {
    role: 'system',
    text: [
      '╔════════════════════════════════════════╗',
      '║  Agent Dev Console  v1.5  ·  AI Agent  ║',
      '║  Type /help for commands               ║',
      '╚════════════════════════════════════════╝',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 3. Erster User-Prompt: Layout-Anpassung
  {
    role: 'user',
    text: 'Passe das FraktalLab Dashboard-Layout an: Zeige auf großen Bildschirmen mehr Panels und auf kleinen weniger, aber nie weniger als 3 und keine sehr schmalen Bereiche erzeugen.',
    pauseBefore: 600,
  },
  // 4. Agent erklärt den Plan
  {
    role: 'agent',
    text: [
      'Analysiere frontend/src/App.tsx …',
      'Passe Spalten- und Layout-Berechnung von FraktalLab an. Verwende:',
      '  • Ultra-wide (width >= 2560): bis zu 24 Panels (5x4, 6x3, 6x4 Grid)',
      '  • Large screens (width >= 2000): bis zu 20 Panels (4x4, 5x3, 5x4 Grid)',
      '  • minPct erhöht (2 cols: 40%, 3 cols: 28%, 4 cols: 20%, 5 cols: 16%, >=6 cols: 12%)',
      '  • Sicherheitscheck: Immer >= 3 Panels auf Desktop.',
      '',
      '✓ FraktalLab Layout in App.tsx erfolgreich angepasst.',
    ].join('\n'),
    pauseBefore: 400,
  },
  // 5. Nächste Aufgabe: Review-Grid
  {
    role: 'user',
    text: 'Passe die FraktalLab Eval-Seite (Review-Modus) an: Immer vier gleich große Panels im 2x2 Grid anzeigen (mit Platzhaltern falls die Seite nicht voll ist). Sortiere die kürzlich geänderten Panels an den Anfang.',
    pauseBefore: 700,
  },
  // 6. Agent liefert Code-Snippet
  {
    role: 'agent',
    text: [
      'Bearbeite reviewMode-Rendering in App.tsx …',
      '  • Setze Grid-Layout fest auf 2x2 (grid-cols-2 grid-rows-2).',
      '  • Fülle unvollständige Seiten mit [ NO SYSTEM INTEL ] Platzhaltern auf.',
      '  • Sortiere geänderte Panels (AmiModPanel, FractalJulia, EnhanceView, AgentCodePanel) nach vorn.',
      '  • Klickbarer Exit-Review und Kopier-Button für localStorage JSON.',
      '',
      '✓ FraktalLab 2x2 Review-System mit Platzhaltern einsatzbereit.',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 7. Nächste Aufgabe: Amiga Mod Player
  {
    role: 'user',
    text: 'Baue jetzt den echten Amiga Mod Player! Die synthetischen Beeps im AmiModPanel.tsx sind Müll.',
    pauseBefore: 600,
  },
  {
    role: 'agent',
    text: [
      'Implementiere WebAudio ProTracker Parser und Driver …',
      '  • Erstelle loader.ts, mod.ts und player.ts.',
      '  • Lade AudioWorklet mod-player-worklet.js auf Port-Ebene.',
      '  • Downloade echte .mod-Tracks in public/audio/.',
      '  • Verbinde watchNotes mit VU-Meter-Animation in AmiModPanel.tsx.',
      '  • Verhindere Layout-Autoswitch (window.fraktallab_mod_playing).',
      '',
      '✓ Amiga Mod Player läuft einwandfrei mit echten Tracker-Files.',
    ].join('\n'),
    pauseBefore: 300,
  },
  // 8. Letzter Schritt vor Neustart
  {
    role: 'user',
    text: '/cost',
    pauseBefore: 600,
  },
  {
    role: 'system',
    text: [
      'Session cost: $0.18  |  Tokens in: 24,192  |  out: 6,432',
      'Cache read: 92%  |  Cache write: 8%',
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
export default function AgentCodePanel() {
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

        if (step.role === 'agent') {
          // Agent-Antwort: Zeile für Zeile mit Tipp-Verzögerung
          setPrompt('')
          // Zuerst eine leere "Agent:"-Zeile einblenden
          appendLine(`<span style="color:#c084fc;font-weight:bold">◆ Agent</span>`)
          const lines = step.text.split('\n')
          typeLines(lines, 0, onDone)
          return;
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

    // Tippt mehrere Zeilen nacheinander (für Agenten-Antworten)
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
        const charDelay = randInt(15, 45)   // Agent tippt schneller als der User
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
    <Panel title="AGENTIC DEV TERMINAL // SYSTEM ARCHITECT">
      {/* Äußeres Wrapper-Div: füllt den Panel-Inhalt komplett */}
      <div className="flex flex-col h-full w-full overflow-hidden p-1 gap-0.5">

        {/* Scrollbarer Ausgabe-Bereich */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto text-xs font-mono leading-relaxed min-h-0 whitespace-pre-wrap"
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
