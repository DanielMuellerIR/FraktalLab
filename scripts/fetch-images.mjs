// Lädt Thumbnails von Wikimedia Commons und schreibt ein manifest.json.
// Suchbegriff: "pedestrian street crossing", bis zu 6 Bilder à 400px Breite.
// Zielordner: frontend/public/enhance/

import { mkdir, writeFile } from 'fs/promises'
import { join, dirname }    from 'path'
import { fileURLToPath }    from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../frontend/public/enhance')

// Wikimedia-Commons-API: Suche nach Bilddateien mit Thumbnail-URLs
const params = new URLSearchParams({
  action:       'query',
  generator:    'search',
  gsrsearch:    'pedestrian street crossing',
  gsrnamespace: '6',          // Namespace 6 = File:
  gsrlimit:     '20',
  prop:         'imageinfo',
  iiprop:       'url|mediatype|size',
  iiurlwidth:   '400',        // Thumbnail-Breite
  format:       'json',
  origin:       '*',
})

const res  = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
const data = await res.json()

// Nur Bitmap-Bilder mit thumburl verwenden
const pages = Object.values(data.query?.pages ?? {})
const candidates = pages
  .filter(p => p.imageinfo?.[0]?.thumburl && p.imageinfo[0].mediatype === 'BITMAP')
  .map(p => ({ thumb: p.imageinfo[0].thumburl, title: p.title }))

await mkdir(OUT, { recursive: true })
const manifest = []

// Bis zu 6 Bilder herunterladen
for (let i = 0; i < Math.min(6, candidates.length); i++) {
  try {
    const r = await fetch(candidates[i].thumb)
    if (!r.ok) continue
    const buf   = await r.arrayBuffer()
    const fname = `street-${i}.jpg`
    await writeFile(join(OUT, fname), Buffer.from(buf))
    manifest.push(fname)
    console.log(`✓ ${fname}  (${candidates[i].title})`)
  } catch (e) {
    console.warn(`✗ skip ${i}:`, e.message)
  }
}

// Manifest schreiben — EnhancePhoto.tsx liest daraus
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Done: ${manifest.length} images → frontend/public/enhance/`)
