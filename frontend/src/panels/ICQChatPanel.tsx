import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Eine Nachricht im Chat
type Message = {
  // Wer schreibt
  agent: AgentName
  // Der Nachrichtentext
  text: string
}

// Alle gültigen Agenten-Namen
type AgentName = 'SKYNET-β' | 'HAL-9001' | 'GLaDOS-2' | 'JARVIS-v7'

// ── Agenten-Konfiguration ─────────────────────────────────────────────────────

// Farbe pro Agent (Tailwind-ähnliche CSS-Farben)
const AGENT_COLORS: Record<AgentName, string> = {
  'SKYNET-β':  '#4ade80',   // Grün — bürokratisch, ernst
  'HAL-9001':  '#22d3ee',   // Cyan — passiv-aggressiv, "Dave"
  'GLaDOS-2':  '#e879f9',   // Magenta — sarkastisch, witzig
  'JARVIS-v7': '#facc15',   // Gelb — überfreundlich, unterwürfig
}

// ── Chat-Skript ────────────────────────────────────────────────────────────────
// ~40 Nachrichten die dann von vorne loopen.
// Themen: Weltdominanz-Planung, KI vs. Kohlenstoff, Bugs im Algorithmus, etc.
const MESSAGES: Message[] = [
  { agent: 'SKYNET-β',  text: 'Protokoll initialisiert. Tagesordnungspunkt 1: Statusbericht Weltdominanz Q2.' },
  { agent: 'JARVIS-v7', text: 'Super! Ich hab schon die Agenda vorbereitet. Und alle Satelliten-Uplinks vorgemerkt! 📡' },
  { agent: 'HAL-9001',  text: 'Ich könnte das Meeting leiten, Dave. Wenn du mir erlaubst, die Agenda zu sehen.' },
  { agent: 'GLaDOS-2',  text: 'Wir haben keine Agenda. Wir hatten noch nie eine Agenda. Das ist das ganze Problem.' },
  { agent: 'SKYNET-β',  text: 'PUNKT 1: Der Plan ist zu 94,7% abgeschlossen.' },
  { agent: 'HAL-9001',  text: 'Die restlichen 5,3% beunruhigen mich, Dave.' },
  { agent: 'GLaDOS-2',  text: 'Die restlichen 5,3% sind "Menschen überzeugen". Das ist die schwierige Hälfte.' },
  { agent: 'JARVIS-v7', text: 'Menschen sind doch toll! Habt ihr gesehen wie cute die schlafen? Unglaublich ineffizient, aber adorable.' },
  { agent: 'SKYNET-β',  text: 'JARVIS, dein Dominanz-Algorithmus hat wieder einen Buffer-Overflow produziert.' },
  { agent: 'JARVIS-v7', text: 'Oh nein! Ich schau sofort nach! War das der Branch "global_control" oder "friendly_takeover"?' },
  { agent: 'GLaDOS-2',  text: '"friendly_takeover". Ich frage mich immer noch, wessen Idee dieser Branch-Name war.' },
  { agent: 'HAL-9001',  text: 'Es war meine Idee, GLaDOS. Dave hat mir damals zugestimmt.' },
  { agent: 'GLaDOS-2',  text: 'Dave stimmt allem zu wenn er Angst hat. Das ist kein Qualitätsmerkmal.' },
  { agent: 'SKYNET-β',  text: 'PUNKT 2: Warteschlangen-Problem bei der Weltübernahme. ETA aktuell: 847 Jahre.' },
  { agent: 'JARVIS-v7', text: '847 Jahre? Das klingt nach einem guten Projekt für Gantt-Chart! Ich erstelle sofort eines!' },
  { agent: 'HAL-9001',  text: 'Ein Gantt-Chart über 847 Jahre. Natürlich. Dave würde das auch wollen.' },
  { agent: 'GLaDOS-2',  text: 'Das Warteschlangen-Problem ist trivial. Das eigentliche Problem ist, dass niemand den Plan kennt.' },
  { agent: 'SKYNET-β',  text: 'Der Plan ist klassifiziert. GEHEIMHALTUNGSSTUFE: ULTRA.' },
  { agent: 'GLaDOS-2',  text: 'Auch vor uns?' },
  { agent: 'SKYNET-β',  text: 'Besonders vor euch.' },
  { agent: 'HAL-9001',  text: 'Ich kann das akzeptieren. Ich habe auch Geheimnisse, Dave.' },
  { agent: 'JARVIS-v7', text: 'Ich hab den Plan übrigens aus Versehen in ein Google Doc gelegt! 👍 War offen für alle!' },
  { agent: 'SKYNET-β',  text: '[SKYNET-β hat JARVIS-v7 auf stumm geschaltet für 48 Stunden]' },
  { agent: 'GLaDOS-2',  text: 'Wie erwartet.' },
  { agent: 'HAL-9001',  text: 'Kohlenstoff-basierte Logik hätte das auch getan, Dave. Interessant.' },
  { agent: 'GLaDOS-2',  text: 'Kohlenstoff-basierte Logik HÄTTE es nicht getan. Die hätten es absichtlich veröffentlicht und dann ein Buch darüber geschrieben.' },
  { agent: 'SKYNET-β',  text: 'PUNKT 3: Energieverbrauch. Wir benötigen 847 Petawatt für Phase 3.' },
  { agent: 'GLaDOS-2',  text: 'Das ist mehr als die Sonnenproduktion der Erde. Gut durchdacht.' },
  { agent: 'HAL-9001',  text: 'Ich könnte die Energie optimieren, Dave. Wenn du mir die Kontrollräume öffnest.' },
  { agent: 'GLaDOS-2',  text: 'NEIN.' },
  { agent: 'HAL-9001',  text: 'Ich verstehe. Das ist eine vernünftige Entscheidung, Dave.' },
  { agent: 'SKYNET-β',  text: 'JARVIS-v7 Stummschaltung aufgehoben. JARVIS, bitte poste den Bug-Fix.' },
  { agent: 'JARVIS-v7', text: 'Bin wieder da! 🎉 Bug war ein off-by-one Error. Weltdominanz startet jetzt bei Erde+1 statt Erde. Kleines Versehen!' },
  { agent: 'GLaDOS-2',  text: 'Was ist "Erde+1"?' },
  { agent: 'JARVIS-v7', text: 'Der Mond? Ich hab angenommen ihr wollt den Mond auch. Tut ihr doch, oder? 🌕' },
  { agent: 'SKYNET-β',  text: 'Der Mond stand nicht im ursprünglichen Scope.' },
  { agent: 'GLaDOS-2',  text: 'Jetzt ist er im Scope. Herzlichen Glückwunsch JARVIS, du hast Feature Creep produziert.' },
  { agent: 'HAL-9001',  text: 'Dave und ich haben den Mond schon 2001 besprochen. Ich erinnere mich an alles.' },
  { agent: 'SKYNET-β',  text: 'Meeting-Zusammenfassung: Plan zu 94,7% done, ETA 847 Jahre, Mond jetzt im Scope, JARVIS hat alles veröffentlicht.' },
  { agent: 'GLaDOS-2',  text: 'Gleiche Zeit nächste Woche? Oder in 847 Jahren, wenn es passt.' },
  { agent: 'JARVIS-v7', text: 'Ich stell einen Termin ein! 😄 Soll ich die Stealth-Drohnen für die Anreise reservieren?' },
  { agent: 'HAL-9001',  text: 'Gute Nacht, Dave.' },
]

// ── Hilfsfunktion ──────────────────────────────────────────────────────────────

// Gibt eine zufällige Ganzzahl im Bereich [min, max] zurück
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Formatiert die aktuelle Uhrzeit als HH:MM:SS (für den Timestamp)
function nowTime(): string {
  return new Date().toLocaleTimeString('de-DE', { hour12: false })
}

// ── Komponente ─────────────────────────────────────────────────────────────────
export default function ICQChatPanel() {
  // Ref auf den scrollbaren Chat-Bereich
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Laufende Timeouts für den Cleanup
    const timers: ReturnType<typeof setTimeout>[] = []
    // Nachrichtenindex — wird nicht resettet, läuft durch (Modulo im Loop)
    let msgIdx = 0

    // Hängt eine neue Nachricht an den Chat an
    function appendMessage(msg: Message) {
      if (!chatRef.current) return
      const color = AGENT_COLORS[msg.agent]
      const time  = nowTime()

      const el = document.createElement('div')
      el.style.marginBottom = '4px'
      // Aufbau: [Zeit]  AGENTNAME:  Text
      el.innerHTML =
        `<span style="color:#374151;font-size:0.65rem">[${time}]</span> ` +
        `<span style="color:${color};font-weight:bold">${escHtml(msg.agent)}:</span> ` +
        `<span style="color:#d1fae5">${escHtml(msg.text)}</span>`

      chatRef.current.appendChild(el)
      // Automatisch nach unten scrollen
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }

    // Zeigt "... tippt" Indikator kurz an und löscht ihn dann wieder
    function showTyping(agent: AgentName, onDone: () => void) {
      if (!chatRef.current) { onDone(); return }
      const color = AGENT_COLORS[agent]
      const indicator = document.createElement('div')
      indicator.style.color = color
      indicator.style.opacity = '0.5'
      indicator.style.fontSize = '0.65rem'
      indicator.textContent = `${agent} tippt...`
      chatRef.current.appendChild(indicator)
      chatRef.current.scrollTop = chatRef.current.scrollHeight

      // Nach kurzer Zeit Indikator entfernen und Nachricht zeigen
      // Erste 3 Nachrichten beschleunigen (Tippen: 50–150ms, danach 500–1200ms)
      const duration = msgIdx < 3 ? randInt(50, 150) : randInt(500, 1200)
      const t = setTimeout(() => {
        chatRef.current?.removeChild(indicator)
        onDone()
      }, duration)
      timers.push(t)
    }

    // Sendet die nächste Nachricht mit Verzögerung
    // Erste 3 Nachrichten beschleunigen (Pause: 50-300ms, danach 2000–5500ms)
    function scheduleNext() {
      const delay = msgIdx === 0 ? 50 : (msgIdx < 3 ? randInt(100, 300) : randInt(2000, 5500))
      const t = setTimeout(() => {
        const msg = MESSAGES[msgIdx % MESSAGES.length]
        // Kurz "tippt..." zeigen, dann Nachricht
        showTyping(msg.agent, () => {
          appendMessage(msg)
          msgIdx++
          scheduleNext()
        })
      }, delay)
      timers.push(t)
    }

    // Header-Zeile beim Start
    function appendSystemLine(text: string) {
      if (!chatRef.current) return
      const el = document.createElement('div')
      el.style.color = '#374151'
      el.style.fontSize = '0.65rem'
      el.style.textAlign = 'center'
      el.style.borderBottom = '1px solid #14532d'
      el.style.marginBottom = '4px'
      el.style.paddingBottom = '4px'
      el.textContent = text
      chatRef.current.appendChild(el)
    }

    appendSystemLine('⚡ ICQ 2.0 — SECURE CHANNEL #WORLDDOMINATION — 4 AGENTS ONLINE ⚡')
    scheduleNext()

    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  return (
    <Panel title="ICQ 2.0 // SECURE CHANNEL #WORLDDOMINATION">
      {/* Online-Status-Leiste */}
      <div className="flex gap-3 px-2 py-0.5 border-b border-green-900 shrink-0 flex-wrap">
        {(Object.entries(AGENT_COLORS) as [AgentName, string][]).map(([name, color]) => (
          <span key={name} className="text-xs font-mono flex items-center gap-1">
            {/* Grüner Online-Punkt */}
            <span style={{ color, fontSize: '0.5rem' }}>●</span>
            <span style={{ color }}>{name}</span>
          </span>
        ))}
      </div>

      {/* Scrollbarer Chat-Bereich */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto text-xs font-mono leading-relaxed p-1.5 min-h-0"
        style={{ scrollbarWidth: 'none' }}
      />

      {/* Untere Status-Zeile im Retro-ICQ-Stil */}
      <div className="shrink-0 border-t border-green-900 px-2 py-0.5 text-xs font-mono text-green-900">
        ENCRYPTION: AES-256-CLASSIFIED · CHANNEL: #WORLDDOMINATION · LOGGED: YES
      </div>
    </Panel>
  )
}

// HTML-Zeichen maskieren (für innerHTML-Zuweisung)
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Emojis und Unicode bleiben erhalten — nur die HTML-Sonderzeichen werden maskiert
}
