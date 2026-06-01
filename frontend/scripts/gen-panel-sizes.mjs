// ─────────────────────────────────────────────────────────────────────────────
// gen-panel-sizes.mjs
//
// Erzeugt  src/panels/panel-sizes.generated.ts  mit der echten Quell-Größe (Bytes)
// jedes Panels für die Anzeige im Review-Modus ("wie viel Platz nimmt das Panel
// im Production-Build ein"). Damit steht nie mehr fälschlich "0 KB".
//
// Vorgehen:
//   • Panel-Namen aus der Registry (panel-registry.ts) lesen.
//   • Für jeden Namen die DEFINIERENDE Quelldatei in src/panels/ finden (die Datei,
//     die das Panel exportiert) und deren Größe nehmen. Teilen sich mehrere Panels
//     eine .tsx, zeigt jedes die Größe dieser geteilten Datei (so gewünscht).
//   • Panel-spezifische Zusatzdateien (Shader-Strings, Voxel-/Player-Engines,
//     Worklets) werden über EXTRA addiert.
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
const UTILS_DIR = join(FRONTEND, 'src', 'utils')
const UI_DIR = join(FRONTEND, 'src', 'ui')
const AUDIO_BOTB = join(FRONTEND, 'public', 'audio', 'botb')
const REGISTRY = join(PANELS_DIR, 'panel-registry.ts')
const OUT = join(PANELS_DIR, 'panel-sizes.generated.ts')

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

// Panel-spezifische Zusatzdateien (zur definierenden Datei addiert).
const SHADER_PANEL = join(UI_DIR, 'ShaderPanel.tsx')
const EXTRA = {
  // Shadertoy-/IQ-/Plasma-/Lovebyte-/Fractal-/DE-/Demo-Shader nutzen ShaderPanel + Shader-Strings.
  __shaderPanelBytes: sizeOf(SHADER_PANEL),
  __deFractalShaders: sizeOf(join(UTILS_DIR, 'de-fractals-shaders.ts')),
  __fractalGlShader: sizeOf(join(UTILS_DIR, 'fractal-gl-shader.ts')),
  __palettes: sizeOf(join(UTILS_DIR, 'palettes.ts')),
}

// Player-Engines + Worklets.
const MOD_ENGINE = sumDir(join(UTILS_DIR, 'modplayer'), /\.ts$/) + sizeOf(join(FRONTEND, 'public', 'audio', 'mod-player-worklet.js'))
const SID_ENGINE = sizeOf(join(UTILS_DIR, 'sidplayer.ts')) + sizeOf(join(FRONTEND, 'public', 'audio', 'sid-player-worklet.js'))

const MOD_MUSIC = sumDir(AUDIO_BOTB, /\.mod$/i)
const SID_MUSIC = sumDir(AUDIO_BOTB, /\.sid$/i)

const codeBytes = {}
for (const name of names) {
  const f = definingFile(name)
  let bytes = f ? sizeOf(join(PANELS_DIR, f)) : 0
  // ShaderPanel-Nutzer: ShaderPanel-Datei dazurechnen.
  if (f && /ShaderPanel/.test(fileContents.get(f) || '')) bytes += EXTRA.__shaderPanelBytes
  if (f === 'DEFractalScenes.tsx') bytes += EXTRA.__deFractalShaders
  if (name.startsWith('Fractal')) bytes += EXTRA.__fractalGlShader
  // Player-Engines.
  if (name === 'AmiModPanel') bytes += MOD_ENGINE
  if (name === 'OscilloscopePanel') bytes += SID_ENGINE
  codeBytes[name] = bytes
  if (!bytes) console.warn(`[panel-sizes] WARN: 0 Bytes für ${name} (Datei: ${f})`)
}

const entries = names.map(n => `  '${n}': ${codeBytes[n]},`).join('\n')
const out = `// AUTO-GENERIERT von scripts/gen-panel-sizes.mjs — NICHT von Hand ändern.
// Neu erzeugen:  node scripts/gen-panel-sizes.mjs
//
// PANEL_CODE_BYTES: Quell-Größe (Bytes) der definierenden .tsx (+ panel-spezifische
// Zusatzdateien wie ShaderPanel/Shader-Strings/Player-Engine). Geteilte Dateien
// werden bei jedem beteiligten Panel voll gezählt (so gewünscht).
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
