// ─────────────────────────────────────────────────────────────────────────────
// build-audio-manifest.mjs
//
// Liest die BotB-Quelldateien aus  ../sid_mod_dl/  (Repo-Root), kopiert sie mit
// ASCII-sicheren Namen nach  public/audio/botb/  und generiert daraus die Datei
//   src/utils/botb-tracks.generated.ts
// mit Metadaten (Titel, Autor, Entry-ID, Lizenz-/Quell-Links) UND den echten
// Byte-Größen jeder Datei + Summen pro Player.
//
// Damit sind die im UI/Review-Modus angezeigten Dateigrößen IMMER korrekt:
// bei Änderungen an den sids/mods einfach dieses Skript erneut laufen lassen:
//   node scripts/build-audio-manifest.mjs
//
// Dateinamen-Schema der Quelle:  "BotB <EntryID> <Autor> - <Titel>.<ext>"
// Vorsicht: Titel können beliebige Zeichen enthalten (auch CJK) → Zielname wird
// rein numerisch (botb-<id>.<ext>), die Originaldaten landen nur als Metadaten.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')
const SRC_DIR = resolve(FRONTEND, '..', 'sid_mod_dl')        // Repo-Root/sid_mod_dl
const OUT_AUDIO = join(FRONTEND, 'public', 'audio', 'botb')
const OUT_TS = join(FRONTEND, 'src', 'utils', 'botb-tracks.generated.ts')

const LICENSE_URL = 'https://battleofthebits.com/lyceum/View/BotB%2BCC%2BLicense/'

// Dateiname → {id, author, title, ext}
function parseName(filename) {
  const m = filename.match(/^BotB\s+(\d+)\s+(.+?)\s+-\s+(.+)\.(sid|mod)$/i)
  if (!m) return null
  return { id: m[1], author: m[2].trim(), title: m[3].trim(), ext: m[4].toLowerCase() }
}

// Entry-URL bauen (Slug = Titel.ext mit Leerzeichen→+, Rest URL-kodiert).
function entryUrl(title, ext, id) {
  const slug = encodeURIComponent(`${title}.${ext}`).replace(/%20/g, '+')
  return `https://battleofthebits.com/arena/Entry/${slug}/${id}/`
}

mkdirSync(OUT_AUDIO, { recursive: true })

const files = readdirSync(SRC_DIR).filter(f => /\.(sid|mod)$/i.test(f))
const tracks = []
for (const f of files) {
  const meta = parseName(f)
  if (!meta) {
    console.warn(`[audio-manifest] Übersprungen (Name passt nicht zum Schema): ${f}`)
    continue
  }
  const srcPath = join(SRC_DIR, f)
  const safeName = `botb-${meta.id}.${meta.ext}`
  const destPath = join(OUT_AUDIO, safeName)
  copyFileSync(srcPath, destPath)
  const bytes = statSync(destPath).size
  tracks.push({ ...meta, file: `audio/botb/${safeName}`, bytes, entryUrl: entryUrl(meta.title, meta.ext, meta.id) })
}

tracks.sort((a, b) => Number(a.id) - Number(b.id))
const mods = tracks.filter(t => t.ext === 'mod')
const sids = tracks.filter(t => t.ext === 'sid')
const sum = arr => arr.reduce((n, t) => n + t.bytes, 0)

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const lit = t =>
  `  { id: '${t.id}', file: '${t.file}', title: '${esc(t.title)}', author: '${esc(t.author)}', ext: '${t.ext}', bytes: ${t.bytes}, entryUrl: '${t.entryUrl}' },`

const out = `// AUTO-GENERIERT von scripts/build-audio-manifest.mjs — NICHT von Hand ändern.
// Neu erzeugen nach Änderung der sids/mods:  node scripts/build-audio-manifest.mjs
//
// Quelle: Battle of the Bits (https://battleofthebits.com), Lizenz für alle Tracks:
// Creative Commons Attribution-NonCommercial-ShareAlike. Keine Änderungen an den
// Originaldateien vorgenommen ("No changes made").

export interface BotbTrack {
  id: string        // BotB-Entry-ID
  file: string      // Pfad relativ zu BASE_URL (z.B. "audio/botb/botb-14870.sid")
  title: string
  author: string
  ext: 'sid' | 'mod'
  bytes: number     // echte Dateigröße
  entryUrl: string  // Link zum BotB-Entry
}

export const BOTB_LICENSE = 'Creative Commons Attribution-NonCommercial-ShareAlike'
export const BOTB_LICENSE_SHORT = 'CC BY-NC-SA'
export const BOTB_LICENSE_URL = '${LICENSE_URL}'
export const BOTB_SOURCE = 'Battle of the Bits'

export const MOD_TRACKS: BotbTrack[] = [
${mods.map(lit).join('\n')}
]

export const SID_TRACKS: BotbTrack[] = [
${sids.map(lit).join('\n')}
]

// Echte Gesamtgrößen (Bytes) der mitgelieferten Musikdateien pro Player.
export const MOD_TRACKS_TOTAL_BYTES = ${sum(mods)}
export const SID_TRACKS_TOTAL_BYTES = ${sum(sids)}
`

writeFileSync(OUT_TS, out)
console.log(`[audio-manifest] ${mods.length} MODs + ${sids.length} SIDs → ${OUT_AUDIO}`)
console.log(`[audio-manifest] MOD total ${(sum(mods) / 1024).toFixed(0)} KB · SID total ${(sum(sids) / 1024).toFixed(0)} KB`)
console.log(`[audio-manifest] manifest → ${OUT_TS}`)
