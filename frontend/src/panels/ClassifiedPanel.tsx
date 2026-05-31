import { memo,  useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Klassifizierungsstufen — sortiert nach "Dramatik"
type ClassLevel = 'TOP SECRET // SCI' | 'TOP SECRET // EYES ONLY' | 'SECRET // NOFORN' | 'CLASSIFIED' | 'CONFIDENTIAL'

// Ein einzelnes Fake-Dokument
type Doc = {
  level: ClassLevel
  docId: string
  date: string
  subject: string
  // Segmente: normaler Text oder [REDACTED]-Block (isRedacted: true)
  body: Segment[]
}

// Ein Textsegment innerhalb eines Dokuments
type Segment = {
  text: string
  isRedacted?: boolean  // wenn true → unsichtbarer Text auf dunklem Hintergrund
}

// ── Dokument-Datenbank ─────────────────────────────────────────────────────────
// Alle 8 Fake-Dokumente. [REDACTED]-Blöcke sind als Segmente mit isRedacted: true
// markiert — die Komponente rendert sie später als dunkle Balken.

const DOCS: Doc[] = [
  {
    level: 'TOP SECRET // SCI',
    docId: 'NSA-PRISM-7731-ALPHA',
    date: '2024-03-14',
    subject: 'OPERATION MIDNIGHT CIPHER — Status Report',
    body: [
      { text: 'EXECUTIVE SUMMARY:\n\nSubject designated ' },
      { text: 'CARDINAL BLUE', isRedacted: true },
      { text: ' has been under surveillance since ' },
      { text: '14 MONTHS AGO', isRedacted: true },
      { text: '. All communication channels including encrypted\nmessengers, legacy PSTN lines, and satellite uplinks\nhave been compromised as of ' },
      { text: '2024-01-09 03:41Z', isRedacted: true },
      { text: '.\n\nPhase 2 insertion team deployed via ' },
      { text: 'LOCATION WITHHELD PER EO 12958', isRedacted: true },
      { text: '. Asset confirms target unaware of\ncurrent operational status.\n\nNext scheduled contact: ' },
      { text: '[TIMESTAMP REDACTED]', isRedacted: true },
      { text: '.\n\nThis document is to be destroyed within 72 hours of\nreceipt. Unauthorized reproduction is punishable under\n18 U.S.C. § 798.' },
    ],
  },
  {
    level: 'TOP SECRET // EYES ONLY',
    docId: 'CIA-COV-0042-DELTA',
    date: '2023-11-29',
    subject: 'PERSONNEL FILE — Operative GHOST ORCHID',
    body: [
      { text: 'NAME:          ' },
      { text: '████████████████', isRedacted: true },
      { text: '\nALIASES:       ' },
      { text: 'GHOST ORCHID / KESSLER / MIREILLE FONTAINE', isRedacted: true },
      { text: '\nDOB:           ' },
      { text: '██/██/19██', isRedacted: true },
      { text: '\nNATIONALITY:   ' },
      { text: 'DUAL — EU AND ██████', isRedacted: true },
      { text: '\nCLEARANCE:     TS/SCI + SAP\n\nSPECIALTIES:\n  - HUMINT / SIGINT crossover analysis\n  - Deep-cover placement (avg. ' },
      { text: '██ months', isRedacted: true },
      { text: ')\n  - Fluent in ' },
      { text: '6 languages (LIST CLASSIFIED)', isRedacted: true },
      { text: '\n\nLAST KNOWN LOCATION: ' },
      { text: 'REDACTED PER DIRECTOR ORDER #44', isRedacted: true },
      { text: '\n\nSTATUS: ACTIVE / DO NOT CONTACT DIRECTLY' },
    ],
  },
  {
    level: 'SECRET // NOFORN',
    docId: 'DIA-ANOM-2291-WHISKEY',
    date: '2024-07-03',
    subject: 'ANOMALY REPORT — Unidentified Signal Event, Grid ' ,
    body: [
      { text: 'At 02:17 local time, monitoring station ' },
      { text: 'ECHO-9', isRedacted: true },
      { text: ' detected\nan uncharacterized electromagnetic burst lasting\napprox. 11.4 seconds on frequency ' },
      { text: '███.██ MHz', isRedacted: true },
      { text: '.\n\nSpectral analysis indicates encoding pattern\nconsistent with ' },
      { text: 'PROJECT LOOKING GLASS PARAMETERS', isRedacted: true },
      { text: '.\nNo known adversary capability matches this signature.\n\nPersonnel present: ' },
      { text: 'SGT. KAWAKAMI / DR. ELLISON / CONTRACTOR UNKNOWN', isRedacted: true },
      { text: '\n\nAll raw telemetry has been transferred to ' },
      { text: 'VAULT 7-SIERRA', isRedacted: true },
      { text: '.\nFollow-up assessment by ' },
      { text: 'ADVANCED THREAT LAB', isRedacted: true },
      { text: ' pending.\n\nIncident classification pending review.\nDo not discuss on unsecured channels.' },
    ],
  },
  {
    level: 'TOP SECRET // SCI',
    docId: 'NSA-SIGINT-9901-FOXTROT',
    date: '2023-08-18',
    subject: 'MISSION BRIEFING — OPERATION SILENT HARBOR',
    body: [
      { text: 'OBJECTIVE: Gain access to ' },
      { text: 'TARGET NETWORK BRAVO-7', isRedacted: true },
      { text: ' and\nexfiltrate documents pertaining to ' },
      { text: 'PROGRAM ██████', isRedacted: true },
      { text: '.\n\nTEAM:\n  Lead Operator: ' },
      { text: 'CALLSIGN: ORACLE', isRedacted: true },
      { text: '\n  Technical:     ' },
      { text: 'CALLSIGN: MANTIS', isRedacted: true },
      { text: '\n  Extraction:    ' },
      { text: '3 PERSONNEL — NAMES CLASSIFIED', isRedacted: true },
      { text: '\n\nINFILTRATION METHOD: ' },
      { text: 'REDACTED — SEE ANNEX C', isRedacted: true },
      { text: '\nEXFIL WINDOW: ' },
      { text: '04:00–05:30 LOCAL', isRedacted: true },
      { text: '\nABORT CODE: ' },
      { text: 'NOVEMBER-GOLF-SEVEN', isRedacted: true },
      { text: '\n\nINTEL CONFIDENCE: HIGH (87%)\nOPERATIONAL RISK: MEDIUM-HIGH\n\nBRIEFING EXPIRES: 48 HOURS FROM TIMESTAMP' },
    ],
  },
  {
    level: 'CLASSIFIED',
    docId: 'FBI-SURV-0077-INDIA',
    date: '2024-02-22',
    subject: 'SURVEILLANCE LOG — Subject "BISHOP"',
    body: [
      { text: 'SUBJECT: ' },
      { text: 'DR. ██████ ████████', isRedacted: true },
      { text: '\nAFFILIATION: ' },
      { text: 'TECH FIRM — NAME WITHHELD', isRedacted: true },
      { text: '\n\nDATE       TIME     ACTIVITY\n────────── ──────── ───────────────────────────\n2024-02-19 08:43    Arrived ' },
      { text: 'LOCATION A', isRedacted: true },
      { text: '\n2024-02-19 11:12    Met with ' },
      { text: 'INDIVIDUAL FOXTROT-3', isRedacted: true },
      { text: '\n2024-02-19 13:55    Accessed ' },
      { text: 'SECURE TERMINAL — BADGE ID ████', isRedacted: true },
      { text: '\n2024-02-20 09:01    Transmitted file to ' },
      { text: 'UNKNOWN RECIPIENT', isRedacted: true },
      { text: '\n2024-02-21 ██:██   ' },
      { text: 'GAP IN SURVEILLANCE — CAUSE UNKNOWN', isRedacted: true },
      { text: '\n2024-02-22 07:30    Under renewed observation\n\nRECOMMENDATION: Escalate to ' },
      { text: 'TIER 2 MONITORING', isRedacted: true },
    ],
  },
  {
    level: 'TOP SECRET // EYES ONLY',
    docId: 'MJ12-DOC-0001-ZULU',
    date: '1952-09-17',
    subject: 'MAJESTIC-12 — Preliminary Assessment, Roswell Debris',
    body: [
      { text: 'FOR: ' },
      { text: 'PRESIDENT OF THE UNITED STATES', isRedacted: true },
      { text: '\nFROM: SPECIAL COMMITTEE MJ-12\n\nThe recovered craft (hereafter "OBJECT-A") measures\napprox. ' },
      { text: '██ FEET IN DIAMETER', isRedacted: true },
      { text: '. Structural analysis\nindicates alloy composition unlike any known\nterrestrial material. Yield strength exceeds ' },
      { text: '████ MPa', isRedacted: true },
      { text: '.\n\n' },
      { text: 'FOUR ENTITIES', isRedacted: true },
      { text: ' recovered from crash site.\n' },
      { text: 'ONE SURVIVOR — CONDITION: CRITICAL', isRedacted: true },
      { text: '\nTransferred to ' },
      { text: 'FACILITY PAPA-KILO', isRedacted: true },
      { text: '.\n\nPublic cover story (weather balloon) in effect.\nMedia liaisons briefed. Press blackout holding.\n\nAll further details in ' },
      { text: 'ANNEX 12-D (EYES ONLY)', isRedacted: true },
    ],
  },
  {
    level: 'SECRET // NOFORN',
    docId: 'GCHQ-INT-5540-ROMEO',
    date: '2024-05-09',
    subject: 'SIGNALS INTERCEPT SUMMARY — TARGET GROUP SIGMA',
    body: [
      { text: 'INTERCEPT DATE: 2024-05-07 / 2024-05-08\nSOURCE: ' },
      { text: 'COLLECTION PLATFORM ECHO-FOXTROT', isRedacted: true },
      { text: '\n\nKEY EXTRACTS:\n\n[MSG 001 / 2024-05-07 21:14Z]\n"...the transfer must go through ' },
      { text: 'NODE AMSTERDAM', isRedacted: true },
      { text: ' before\n the deadline. ' },
      { text: 'CONTACT WREN', isRedacted: true },
      { text: ' has confirmed receipt..."\n\n[MSG 002 / 2024-05-08 03:49Z]\n"Package is ' },
      { text: '██ KG. COORDINATES ATTACHED.', isRedacted: true },
      { text: ' Do\n not use the ' },
      { text: 'SECONDARY CHANNEL', isRedacted: true },
      { text: ' again."\n\n[MSG 003 / 2024-05-08 09:22Z]\n"' },
      { text: 'ABORT PROTOCOL SEVEN IF EAGLE LANDS EARLY', isRedacted: true },
      { text: '"\n\nANALYST NOTE: Pattern consistent with known\n' },
      { text: 'GROUP SIGMA LOGISTICS CELL', isRedacted: true },
      { text: '. Recommend\nimmediate escalation.' },
    ],
  },
  {
    level: 'CONFIDENTIAL',
    docId: 'DOE-NUKE-3301-LIMA',
    date: '2024-09-30',
    subject: 'INCIDENT REPORT — Unauthorized Access, Site ' ,
    body: [
      { text: 'FACILITY: ' },
      { text: 'SITE ██ — CLASSIFIED LOCATION', isRedacted: true },
      { text: '\nDATE OF INCIDENT: 2024-09-28 / 23:55 LOCAL\n\nAt 23:55, perimeter sensor ' },
      { text: 'BRAVO-14', isRedacted: true },
      { text: ' triggered\nalpha-alert. Security team ' },
      { text: 'UNIT SEVEN', isRedacted: true },
      { text: ' dispatched.\nUpon arrival, inner gate ' },
      { text: 'G-4', isRedacted: true },
      { text: ' found\najar. Badge log shows no authorized entry.\n\nInventory check of ' },
      { text: 'VAULT 3 (FISSILE MATERIAL)', isRedacted: true },
      { text: ':\n  Status — ' },
      { text: 'ALL ITEMS ACCOUNTED FOR', isRedacted: true },
      { text: '\n\nCAMERA FOOTAGE: ' },
      { text: '7-MINUTE GAP — UNDER INVESTIGATION', isRedacted: true },
      { text: '\n\nNo suspects in custody. Investigation ongoing.\nDo not distribute outside ' },
      { text: 'NEED-TO-KNOW LIST ALPHA', isRedacted: true },
    ],
  },
]

// ── Hilfsfunktion: Alle Segmente eines Dokuments als Rohtext zusammensetzen ────
// Redacted-Blöcke werden mit fester Leerzeichen-Platzhalter-Länge eingerechnet,
// damit die Schreibmaschine auch über sie hinwegläuft.
function flattenToRaw(body: Segment[]): string {
  return body.map(seg => seg.text).join('')
}

// Berechnet, bei welchem Zeichenindex (im Rohtext) jedes Segment beginnt ────────
function segmentOffsets(body: Segment[]): number[] {
  const offsets: number[] = []
  let pos = 0
  for (const seg of body) {
    offsets.push(pos)
    pos += seg.text.length
  }
  return offsets
}

// ── Komponente ─────────────────────────────────────────────────────────────────
function ClassifiedPanel() {
  // Index des aktuell angezeigten Dokuments
  const [docIdx, setDocIdx] = useState(0)
  // Wie viele Zeichen des Rohtexts wurden bisher enthüllt (Typewriter-Fortschritt)
  const [revealed, setRevealed] = useState(0)

  // Ref auf Timer-IDs für sauberes Cleanup beim Unmount / Dok-Wechsel
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref auf den Typewriter-Intervall
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref für den scrollbaren Body-Bereich
  const bodyRef = useRef<HTMLDivElement>(null)

  const doc = DOCS[docIdx]
  const rawText = flattenToRaw(doc.body)

  // ── Typewriter-Effekt ────────────────────────────────────────────────────────
  // Startet neu wenn sich docIdx ändert, räumt vorherigen Intervall auf.
  useEffect(() => {
    // Alles zurücksetzen
    setRevealed(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)

    // Kurze Pause bevor das Tippen beginnt (Dokument-Wechsel-Effekt)
    timerRef.current = setTimeout(() => {
      let pos = 0
      intervalRef.current = setInterval(() => {
        pos++
        setRevealed(pos)
        // Auto-Scroll nach unten damit der tippende Text immer sichtbar bleibt
        if (bodyRef.current) {
          bodyRef.current.scrollTop = bodyRef.current.scrollHeight
        }
        if (pos >= rawText.length) {
          // Typewriter fertig — Intervall stoppen, nach Pause zum nächsten Dok
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          // Zufällige Wartezeit 8–12 Sekunden vor dem nächsten Dokument
          const wait = 8000 + Math.random() * 4000
          timerRef.current = setTimeout(() => {
            setDocIdx(prev => (prev + 1) % DOCS.length)
          }, wait)
        }
      }, 30) // ~30ms pro Zeichen → ca. 33 Zeichen/Sekunde
    }, 600) // 600ms Anlauf-Pause nach Dokument-Wechsel

    // Cleanup wenn Komponente unmountet oder docIdx sich erneut ändert
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [docIdx, rawText.length])  // rawText.length ist stabil pro Dok, explizit als Dep

  // ── Render-Logik: Segmente mit Typewriter-Stand überblenden ──────────────────
  // Wir berechnen, welche Segmente (oder Teile davon) schon enthüllt sind,
  // und bauen daraus JSX-Spans auf.
  const offsets = segmentOffsets(doc.body)

  const renderedSegments = doc.body.map((seg, i) => {
    const segStart = offsets[i]
    const segEnd   = segStart + seg.text.length

    // Wieviele Zeichen dieses Segments sind schon sichtbar?
    const visibleChars = Math.max(0, Math.min(revealed - segStart, seg.text.length))

    if (visibleChars === 0) return null  // noch gar nichts von diesem Segment sichtbar

    // Den sichtbaren Teil des Segments
    const visibleText = seg.text.slice(0, visibleChars)
    // Noch nicht enthüllter Rest (für Platzhalter-Breite)
    const hiddenText  = seg.text.slice(visibleChars)
    const isFullyVisible = segEnd <= revealed

    if (seg.isRedacted) {
      // Redacted-Block: dunkles Rechteck — Text ist unsichtbar (gleiche Farbe wie Hintergrund)
      // Bereits sichtbarer Teil des Blocks + optionaler versteckter Rest
      return (
        <span key={i}>
          {/* Sichtbarer (bereits "getippter") Redacted-Teil */}
          {visibleText && (
            <span className="bg-green-900 text-green-900 px-0.5 mx-px">
              {visibleText}
            </span>
          )}
          {/* Noch nicht getippter Rest des Blocks (unsichtbar halten bis Cursor erreicht) */}
          {!isFullyVisible && hiddenText && (
            <span className="text-transparent select-none">{hiddenText}</span>
          )}
        </span>
      )
    }

    // Normaler Text
    return (
      <span key={i} className="whitespace-pre-wrap">
        {visibleText}
        {/* Noch nicht getippter Rest bleibt unsichtbar (kein Platzhalter nötig bei Fließtext) */}
        {!isFullyVisible && (
          <span className="text-transparent select-none">{hiddenText}</span>
        )}
      </span>
    )
  })

  // ── Klassifizierungs-Banner — Farbe je nach Stufe ──────────────────────────
  // Höchste Stufen rot, niedrigere gelb/orange
  const levelColor =
    doc.level.startsWith('TOP SECRET') ? 'text-red-500' :
    doc.level.startsWith('SECRET')     ? 'text-orange-400' :
    doc.level === 'CLASSIFIED'         ? 'text-yellow-400' :
                                          'text-yellow-300'

  return (
    <Panel title="CLASSIFIED // EYES ONLY">
      {/* fontSize-clamp am Wurzel-Container: Banner, Header, Body und Footer erben
          die kachelgrößenabhängige Schrift (text-xs entfernt). In kleinen Kacheln
          schrumpft das ganze Dokument mit – Untergrenze ~7,5px. */}
      <div
        className="flex flex-col h-full w-full overflow-hidden p-2 gap-1 font-mono"
        style={{ fontSize: 'clamp(7.5px, 3.2cqmin, 13px)' }}
      >

        {/* ── Klassifizierungs-Banner oben ── */}
        <div className={`text-center font-bold tracking-widest border border-current py-0.5 shrink-0 ${levelColor}`}>
          ★ {doc.level} ★
        </div>

        {/* ── Dokument-Header ── */}
        <div className="text-green-600 shrink-0 leading-tight border-b border-green-900 pb-1">
          <div className="flex justify-between">
            <span>DOC ID: <span className="text-green-400">{doc.docId}</span></span>
            <span>DATE: <span className="text-green-400">{doc.date}</span></span>
          </div>
          <div className="mt-0.5">
            SUBJECT: <span className="text-green-300 font-bold">{doc.subject}</span>
          </div>
        </div>

        {/* ── Dokument-Body mit Typewriter ── */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto text-green-400 leading-relaxed min-h-0"
          style={{ scrollbarWidth: 'none' }}
        >
          <p className="whitespace-pre-wrap break-words">
            {renderedSegments}
            {/* Blinkender Cursor am Tipp-Punkt, nur solange das Tippen läuft */}
            {revealed < rawText.length && (
              <span
                className="inline-block w-[0.5em] h-[1em] bg-green-400 ml-px align-middle"
                style={{ animation: 'pulse 800ms step-end infinite' }}
              />
            )}
          </p>
        </div>

        {/* ── Footer: Dokument-Fortschritt ── */}
        <div className="shrink-0 border-t border-green-900 pt-0.5 flex justify-between text-green-800">
          <span>DOC {docIdx + 1}/{DOCS.length}</span>
          <span className="animate-pulse">■ SECURE CHANNEL</span>
          <span>{Math.round((revealed / rawText.length) * 100)}% DECRYPTED</span>
        </div>
      </div>
    </Panel>
  )
}

export default memo(ClassifiedPanel);
