// ─────────────────────────────────────────────────────────────────────────────
// gen-panel-sizes.mjs
//
// Erzeugt src/panels/panel-sizes.generated.ts mit der transitive lokalen
// Quellgraph-Größe jedes Panels für die Anzeige im Review-Modus.
//
// Vorgehen:
//   • Panel-Namen aus der Registry (panel-registry.ts) lesen.
//   • Ab der definierenden Datei alle statischen/dynamischen lokalen Imports
//     rekursiv verfolgen. Geteilte Abhängigkeiten zählen pro Panel vollständig.
//   • Nicht importierbare Laufzeitdateien (Audio-Worklets) explizit addieren.
//   • Für die beiden Player zusätzlich die Musik-Gesamtgröße (aus public/audio/botb).
//
// Erneut ausführen nach Code-/Audio-Änderungen:  node scripts/gen-panel-sizes.mjs
// (idealerweise zusammen mit build-audio-manifest.mjs vor dem Build).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')
const PANELS_DIR = join(FRONTEND, 'src', 'panels')
const SRC_DIR = join(FRONTEND, 'src')
const AUDIO_BOTB = join(FRONTEND, 'public', 'audio', 'botb')
const REGISTRY = join(PANELS_DIR, 'panel-registry.ts')
const OUT = join(PANELS_DIR, 'panel-sizes.generated.ts')
// Die Registry ist der Composition Root und importiert ihrerseits ALLE Panels.
// Beim Rueckweg ueber panel-speed waere sonst jeder Panelgraph der gesamte Build.
const GRAPH_BOUNDARIES = new Set([REGISTRY, OUT])

const sizeOf = p => (existsSync(p) ? statSync(p).size : 0)
const sumDir = (dir, re) =>
  existsSync(dir)
    ? readdirSync(dir).filter(f => re.test(f)).reduce((n, f) => n + sizeOf(join(dir, f)), 0)
    : 0

// Panel-Namen aus der Registry holen.
const regText = readFileSync(REGISTRY, 'utf8')
const names = [...regText.matchAll(/^\s*\{\s*name:\s*'([^']+)'/gm)].map(m => m[1])

// Alle Panel-Quelldateien einlesen (Name → Inhalt), um die definierende Datei zu finden.
const panelFiles = readdirSync(PANELS_DIR).filter(f => /\.(tsx|ts)$/.test(f) && !f.endsWith('.generated.ts') && f !== 'panel-registry.ts')
const fileContents = new Map(panelFiles.map(f => [f, readFileSync(join(PANELS_DIR, f), 'utf8')]))

// Findet die Datei, die `name` exportiert (export const/function/default).
function definingFile(name) {
  // 1) Datei heißt exakt wie das Panel.
  if (fileContents.has(`${name}.tsx`)) return `${name}.tsx`
  if (fileContents.has(`${name}.ts`)) return `${name}.ts`
  // 2) Export-Deklaration in irgendeiner Datei.
  const reExport = new RegExp(`export\\s+(?:const|function|default\\s+function)\\s+${name}\\b`)
  const reMemo = new RegExp(`export\\s+const\\s+${name}\\s*=`)
  const reList = new RegExp(`\\b${name}\\b`)
  for (const [f, c] of fileContents) {
    if (reExport.test(c) || reMemo.test(c)) return f
  }
  // 3) Default-Export-Datei, deren interne Funktion so heißt.
  for (const [f, c] of fileContents) {
    if (new RegExp(`function\\s+${name}\\b`).test(c) && /export default/.test(c)) return f
  }
  // 4) Fallback: irgendeine Datei, die den Namen erwähnt.
  for (const [f, c] of fileContents) {
    if (reList.test(c)) return f
  }
  return null
}

const SOURCE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.svg', '.png']

function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  const candidates = SOURCE_EXTENSIONS.flatMap(ext => [base + ext, join(base, `index${ext}`)])
  return candidates.find(candidate => {
    if (!candidate.startsWith(`${SRC_DIR}/`) || !existsSync(candidate)) return false
    return statSync(candidate).isFile()
  }) ?? null
}

function localImports(file) {
  if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) return []
  const source = readFileSync(file, 'utf8')
  const specs = []
  const staticImport = /^\s*import(?:\s+type)?(?:\s+[\s\S]*?\s+from)?\s+['\"]([^'\"]+)['\"]/gm
  const reExport = /^\s*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['\"]([^'\"]+)['\"]/gm
  const dynamicImport = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g
  for (const re of [staticImport, reExport, dynamicImport]) {
    for (const match of source.matchAll(re)) specs.push(match[1])
  }
  return specs.map(spec => resolveLocalImport(file, spec)).filter(Boolean)
}

function sourceGraphBytes(entryFile) {
  const pending = [entryFile]
  const visited = new Set()
  while (pending.length) {
    const file = pending.pop()
    if (!file || visited.has(file)) continue
    if (GRAPH_BOUNDARIES.has(file)) continue
    visited.add(file)
    pending.push(...localImports(file))
  }
  return [...visited].reduce((bytes, file) => bytes + sizeOf(file), 0)
}

const MOD_WORKLET = sizeOf(join(FRONTEND, 'public', 'audio', 'mod-player-worklet.js'))
const SID_WORKLET = sizeOf(join(FRONTEND, 'public', 'audio', 'sid-player-worklet.js'))

const MOD_MUSIC = sumDir(AUDIO_BOTB, /\.mod$/i)
const SID_MUSIC = sumDir(AUDIO_BOTB, /\.sid$/i)

const codeBytes = {}
for (const name of names) {
  const f = definingFile(name)
  let bytes = f ? sourceGraphBytes(join(PANELS_DIR, f)) : 0
  if (name === 'AmiModPanel') bytes += MOD_WORKLET
  if (name === 'OscilloscopePanel') bytes += SID_WORKLET
  codeBytes[name] = bytes
  if (!bytes) console.warn(`[panel-sizes] WARN: 0 Bytes für ${name} (Datei: ${f})`)
}

const entries = names.map(n => `  '${n}': ${codeBytes[n]},`).join('\n')
const out = `// AUTO-GENERIERT von scripts/gen-panel-sizes.mjs — NICHT von Hand ändern.
// Neu erzeugen:  node scripts/gen-panel-sizes.mjs
//
// PANEL_CODE_BYTES: transitive lokale Quellgraph-Größe ab der definierenden Datei
// (+ nicht importierbare Audio-Worklets). Der Composition Root panel-registry.ts
// ist als Rueckkante ausgeschlossen; geteilte Abhängigkeiten werden bei jedem
// beteiligten Panel voll gezählt. Das ist bewusst keine komprimierte Chunk-Größe.
// MOD_/SID_MUSIC_BYTES: Gesamtgröße der mitgelieferten Musik (dynamisch aus den Dateien).

export const PANEL_CODE_BYTES: Record<string, number> = {
${entries}
}

export const MOD_MUSIC_BYTES = ${MOD_MUSIC}
export const SID_MUSIC_BYTES = ${SID_MUSIC}
`
writeFileSync(OUT, out)
console.log(`[panel-sizes] ${names.length} Panels → ${OUT}`)
console.log(`[panel-sizes] MOD-Musik ${(MOD_MUSIC/1024).toFixed(0)} KB · SID-Musik ${(SID_MUSIC/1024).toFixed(0)} KB`)
