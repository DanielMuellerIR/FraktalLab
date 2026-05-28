import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Typen ──────────────────────────────────────────────────────────────────────

// Die Phasen des Cleanup-Ablaufs
type Phase =
  | 'scanning'     // scrollende Dateinamen-Liste
  | 'analyzing'    // Kategorien und Größen zeigen
  | 'deleting'     // Dateien eine nach der anderen "löschen"
  | 'done'         // Ergebnis anzeigen
  | 'waiting'      // Kurze Pause vor dem Neustart

// ── Datei-Pools ───────────────────────────────────────────────────────────────
// Mix aus Windows- und Unix-Pfaden, damit es realistisch und dramatisch wirkt

const TEMP_FILES: string[] = [
  '/var/tmp/render_cache_2847.tmp',
  '/var/tmp/chromium_gpu_cache_8B3F.bin',
  '/tmp/session_token_expired_4491.lock',
  '/tmp/.npm_cache_unpack_8823/',
  '/tmp/vite_hmr_socket_remnant.sock',
  'C:\\Windows\\Temp\\~WRS0001.tmp',
  'C:\\Windows\\Temp\\DD_SetupOrchestrator_2024.log',
  'C:\\Users\\DANM~1\\AppData\\Local\\Temp\\7zS2A48.tmp',
  'C:\\Windows\\Prefetch\\CHROME.EXE-A82C4B1F.pf',
  'C:\\Users\\Public\\AppData\\nvidia_crash_dump_3.bin',
  '/private/var/folders/zx/gh8k3_f44/T/TemporaryItems/',
  '/Library/Caches/com.apple.dt.Xcode/ModuleCache/',
  '~/.npm/_cacache/content-v2/sha512/0e/',
  '~/.cargo/registry/cache/.crates2.json.tmp',
  '/run/user/1000/gvfs-metadata/',
  'C:\\ProgramData\\Microsoft\\Windows Defender\\Scans\\History\\',
  '/var/log/kern.log.1.gz',
  '/tmp/rust_typecheck_cache_f92.bin',
]

const CACHE_FILES: string[] = [
  '~/.cache/thumbnails/large/ab3f.png',
  '~/.cache/thumbnails/normal/8cc1.png',
  '/Library/Caches/CloudKit/CloudKitMetadata-dev.db-shm',
  '/var/cache/apt/archives/libglib2.0-0_2.76.deb',
  'C:\\Users\\AppData\\Roaming\\Code\\Cache\\f_000001',
  'C:\\Users\\AppData\\Roaming\\Chrome\\User Data\\Default\\Cache\\data_2',
  '~/.cache/pip/wheels/cp311/torch-2.1.0.whl',
  '/usr/local/var/homebrew/downloads/node-22.2.0.pkg',
  '~/.gradle/caches/transforms-3/a8f12/transformed/',
  'C:\\ProgramData\\chocolatey\\lib\\vscode.install\\tools\\',
  '/var/cache/man/en/cat1/grep.1.gz',
  '~/.cache/mozilla/firefox/default/cache2/entries/',
  'C:\\Windows\\SoftwareDistribution\\Download\\',
]

const LOG_FILES: string[] = [
  '/var/log/syslog.2.gz',
  '/var/log/auth.log.1',
  '/var/log/kern.log',
  'C:\\Windows\\System32\\winevt\\Logs\\Application.evtx',
  'C:\\Users\\AppData\\Local\\Temp\\install_2024-01-08.log',
  '/Library/Logs/DiagnosticReports/Spotlight_2024-03-12.crash',
  '~/.pm2/logs/app-out.log',
  '/home/user/.local/share/recently-used.xbel',
  'C:\\inetpub\\logs\\LogFiles\\W3SVC1\\u_ex240312.log',
  '/opt/homebrew/var/log/nginx/access.log.1',
]

// Alle gefundenen Datei-Kategorien mit simulierten Größen
type Category = {
  label: string
  // Größe in GB (float)
  sizeGB: number
  files: string[]
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Gibt eine zufällige Ganzzahl im Bereich [min, max] zurück
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Gibt ein zufälliges Element aus einem Array zurück
function randPick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

// Mischt ein Array in zufälliger Reihenfolge (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Formatiert eine Größe in GB/MB: unter 1 GB → MB-Anzeige
function fmtSize(gb: number): string {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`
  return `${gb.toFixed(2)} GB`
}

// Generiert eine zufällige Fortschrittsleiste als String
// value: 0–100 (Prozent), width: Breite in Zeichen
function progressBar(value: number, width = 28): string {
  const filled = Math.round((value / 100) * width)
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']'
}

// Lustige Abschluss-Kommentare
const DONE_JOKES = [
  'Your computer is now slightly less of a disaster.',
  'Performance improvement: imperceptible. Satisfaction: maximum.',
  'The disk is clean. Your life choices are not our department.',
  'Garbage collected. Unlike your code.',
  'Everything is gone. The files, the memories, the excuses.',
]

// ── Komponente ─────────────────────────────────────────────────────────────────
function DiskCleanupPanel() {
  // Ref auf den scrollbaren Output-Bereich
  const outputRef = useRef<HTMLDivElement>(null)
  // Aktuelle Phase — als Ref statt State, da wir direkt ins DOM schreiben
  const phaseRef = useRef<Phase>('scanning')

  useEffect(() => {
    // Alle laufenden Timeouts für den Cleanup
    const timers: ReturnType<typeof setTimeout>[] = []

    // ── DOM-Helfer ─────────────────────────────────────────────────────────────

    // Hängt eine neue Zeile an den Output an
    function appendLine(text: string, color = '#4ade80') {
      if (!outputRef.current) return
      const el = document.createElement('div')
      el.textContent = text
      el.style.color = color
      outputRef.current.appendChild(el)
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }

    // Leert den Output (für den Neustart)
    function clearOutput() {
      if (outputRef.current) outputRef.current.innerHTML = ''
    }

    // Fügt eine leere Trennzeile ein
    function appendBlank() { appendLine('') }

    // ── PHASE 1: SCAN ──────────────────────────────────────────────────────────
    // Scrollt eine zufällige Auswahl von Dateinamen durch (ca. 3 Sekunden)

    function startScan(onDone: () => void) {
      phaseRef.current = 'scanning'
      appendLine('> DISK CLEANUP v3.1.4 — INITIATING SCAN', '#22d3ee')
      appendLine(`> TARGET: /dev/disk0 (${randInt(500, 2000)} GB)`, '#22d3ee')
      appendBlank()

      // Alle Dateien mischen und dann sequenziell anzeigen
      const allFiles = shuffle([...TEMP_FILES, ...CACHE_FILES, ...LOG_FILES])
      let idx = 0

      function showNext() {
        if (idx >= allFiles.length) { onDone(); return }
        const f = allFiles[idx++]
        appendLine(`  SCAN  ${f}`, '#374151')
        // Jede Zeile erscheint nach 80–180ms
        const t = setTimeout(showNext, randInt(80, 160))
        timers.push(t)
      }
      showNext()
    }

    // ── PHASE 2: ANALYSE ───────────────────────────────────────────────────────
    // Zeigt Kategorien und simulierte Größen

    function startAnalysis(onDone: (cats: Category[]) => void) {
      phaseRef.current = 'analyzing'
      appendBlank()
      appendLine('> ANALYSIS COMPLETE — FOUND:', '#fbbf24')
      appendBlank()

      // Zufällige Größen für jede Kategorie
      const categories: Category[] = [
        {
          label: 'Temporary Files',
          sizeGB: randInt(8, 24) + Math.random(),
          files: shuffle(TEMP_FILES),
        },
        {
          label: 'Browser / App Cache',
          sizeGB: randInt(3, 12) + Math.random(),
          files: shuffle(CACHE_FILES),
        },
        {
          label: 'System Logs',
          sizeGB: (randInt(120, 480)) / 1000,  // MB-Bereich
          files: shuffle(LOG_FILES),
        },
        {
          label: 'Package Manager Cache',
          sizeGB: randInt(2, 8) + Math.random(),
          files: [],
        },
        {
          label: 'Crash Dumps',
          sizeGB: (randInt(200, 900)) / 1000,
          files: [],
        },
      ]

      // Kategorien nacheinander anzeigen
      let catIdx = 0
      function showCat() {
        if (catIdx >= categories.length) {
          appendBlank()
          const total = categories.reduce((s, c) => s + c.sizeGB, 0)
          appendLine(`> TOTAL RECOVERABLE: ${fmtSize(total)}`, '#f87171')
          appendBlank()
          const t = setTimeout(() => onDone(categories), 800)
          timers.push(t)
          return
        }
        const cat = categories[catIdx++]
        appendLine(
          `  ${cat.label.padEnd(28)} ${fmtSize(cat.sizeGB)}`,
          '#86efac'
        )
        const t = setTimeout(showCat, 220)
        timers.push(t)
      }
      showCat()
    }

    // ── PHASE 3: DELETION ──────────────────────────────────────────────────────
    // Löscht Dateien eine nach der anderen, zeigt Fortschrittsbalken

    function startDeletion(categories: Category[], onDone: () => void) {
      phaseRef.current = 'deleting'
      appendLine('> INITIATING SECURE DELETION...', '#f87171')
      appendBlank()

      // Alle zu löschenden Dateien einsammeln (+ generierte Phantomdateien)
      const toDelete: string[] = []
      for (const cat of categories) {
        toDelete.push(...cat.files.slice(0, 4))
        // Extra generierte Pfade hinzufügen
        const count = randInt(2, 5)
        for (let i = 0; i < count; i++) {
          toDelete.push(randPick([...TEMP_FILES, ...CACHE_FILES]))
        }
      }
      const shuffled = shuffle(toDelete)

      let idx = 0
      function deleteNext() {
        if (idx >= shuffled.length) {
          appendBlank()
          onDone()
          return
        }
        const f = shuffled[idx]
        const pct = Math.round((idx / shuffled.length) * 100)
        // Fortschrittsbalken überschreiben (letzten Eintrag updaten)
        // Einfacher Ansatz: neue Zeile pro Datei (wie ein echtes rm-Log)
        appendLine(
          `  DEL  ${f.length > 48 ? '…' + f.slice(-47) : f}`,
          '#ef4444'
        )
        // Alle 5 Dateien den Fortschrittsbalken aktualisieren
        if (idx % 5 === 0) {
          appendLine(`  ${progressBar(pct)} ${pct}%`, '#374151')
        }
        idx++
        const t = setTimeout(deleteNext, randInt(90, 220))
        timers.push(t)
      }
      deleteNext()
    }

    // ── PHASE 4: DONE ──────────────────────────────────────────────────────────

    function showDone(categories: Category[], onDone: () => void) {
      phaseRef.current = 'done'
      const total = categories.reduce((s, c) => s + c.sizeGB, 0)
      appendLine(`  ${progressBar(100)} 100%`, '#374151')
      appendBlank()
      appendLine('> DELETION COMPLETE', '#4ade80')
      appendLine(`> ${fmtSize(total)} FREED FROM DISK`, '#4ade80')
      appendBlank()
      appendLine(`> ${randPick(DONE_JOKES)}`, '#d8b4fe')
      appendBlank()
      appendLine('> Restarting in 5 seconds…', '#374151')

      // Nach 5 Sekunden von vorne
      const t = setTimeout(onDone, 5000)
      timers.push(t)
    }

    // ── Haupt-Loop ─────────────────────────────────────────────────────────────

    function runLoop() {
      clearOutput()
      startScan(() => {
        startAnalysis(cats => {
          startDeletion(cats, () => {
            showDone(cats, runLoop)
          })
        })
      })
    }

    runLoop()

    // Cleanup beim Unmount
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  return (
    <Panel title="DISK CLEANUP // PURGING DATA">
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto text-xs font-mono leading-relaxed p-1.5 min-h-0"
        style={{ scrollbarWidth: 'none' }}
      />
    </Panel>
  )
}

export default memo(DiskCleanupPanel);
