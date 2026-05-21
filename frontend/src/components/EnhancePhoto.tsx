import { useEffect, useRef } from 'react'

// Enhance-Slideshow: lade → pixeliert → enhance in 12 Phasen → 2s scharfes Bild → nächstes Foto.
// 12 × 333 ms ≈ 4 s für die Enhance-Animation, dann 2 s Pause auf scharfem Bild.

// Jede Phase: Blockgröße für Pixelierung + Statuslabel + Fortschrittsbalken (0–100).
const STAGES = [
  { block: 48, label: 'ESTABLISHING UPLINK...',          pct:   0 },
  { block: 32, label: 'RECEIVING SIGNAL...',             pct:   9 },
  { block: 24, label: 'DECRYPTING DATASTREAM...',        pct:  18 },
  { block: 16, label: 'ANALYZING PIXEL DATA...',         pct:  27 },
  { block: 12, label: 'MAPPING FACIAL GEOMETRY...',      pct:  36 },
  { block:  8, label: 'EXTRAPOLATING MISSING INFO...',   pct:  45 },
  { block:  6, label: 'CROSS-REFERENCING DATABASE...',   pct:  54 },
  { block:  4, label: 'ENHANCING RESOLUTION...',         pct:  63 },
  { block:  3, label: 'APPLYING SHARPNESS MATRIX...',    pct:  72 },
  { block:  2, label: 'NOISE REDUCTION PASS 2...',       pct:  81 },
  { block:  1, label: 'FINALIZING OUTPUT...',            pct:  90 },
  { block:  1, label: 'ENHANCEMENT COMPLETE',            pct: 100 },
]

// Dauer pro Phase in ms — 12 × 333 ms ≈ 4 s Gesamtdauer
const PHASE_MS = 333

// Dauer, wie lange das fertig enhancete (scharfe) Bild stehen bleibt, bevor es weitergeht
const HOLD_MS = 2000

// Lokale Dateien (6 Fotos) + loremflickr ausschließlich mit Großstadt-Menschen-Keywords.
// Kein Natur/Wald — nur urbane Settings mit Menschen in der Öffentlichkeit.
const LOCAL = [0, 1, 2, 3, 4, 5].map(i => `/enhance/street-${i}.jpg`)
const FLICKR_TAGS = [
  'crowd,city', 'subway,people', 'street,people', 'market,city',
  'commuters', 'pedestrians,downtown', 'urban,crowd', 'city,people',
]
const FLICKR = Array.from({ length: 32 }, (_, i) => {
  const tag = FLICKR_TAGS[i % FLICKR_TAGS.length]
  return `https://loremflickr.com/320/213/${tag}?lock=${i + 1}`
})
const PHOTOS = [...LOCAL, ...FLICKR]

// Zeichnet das Bild pixeliert (blockSize > 1) oder scharf (blockSize <= 1)
function drawPixelated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  blockSize: number,
  w: number,
  h: number,
) {
  if (blockSize <= 1) {
    // Scharf zeichnen
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, w, h)
    return
  }
  // Auf winzige Zwischenleinwand skalieren, dann ohne Smoothing hochskalieren
  const tmp    = document.createElement('canvas')
  tmp.width    = Math.max(1, Math.floor(w / blockSize))
  tmp.height   = Math.max(1, Math.floor(h / blockSize))
  const tc     = tmp.getContext('2d')!
  tc.drawImage(img, 0, 0, tmp.width, tmp.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, w, h)
}

// Zeichnet Scanlinien, Vignette und Statusleiste über das Bild
function drawOverlays(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: string,
  pct: number,
) {
  // Grüne Scanlinien
  ctx.fillStyle = 'rgba(0,255,0,0.03)'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)

  // Vignette
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Statuszeile unten
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, h - 22, w, 22)
  ctx.fillStyle = '#4ade80'
  ctx.font      = '10px monospace'
  const filled = Math.round(pct / 10)
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled)
  ctx.fillText(`${bar}  ${label}`, 5, h - 7)
}

export default function EnhancePhoto() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Speichert die Cleanup-Funktion des aktuell laufenden Zyklus
  const cancelRef    = useRef<(() => void) | null>(null)
  const indexRef     = useRef(Math.floor(Math.random() * PHOTOS.length))

  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Canvas auf Container-Größe setzen
    function resize() {
      if (!canvas || !container) return
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }

    // Bild + Stage ins Canvas malen
    function redraw(img: HTMLImageElement, stageIdx: number) {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { block, label, pct } = STAGES[stageIdx]
      drawPixelated(ctx, img, block, canvas.width, canvas.height)
      drawOverlays(ctx, canvas.width, canvas.height, label, pct)
    }

    // Startet einen vollständigen Enhance-Zyklus für ein Foto.
    // Gibt eine Cleanup-Funktion zurück, die alle ausstehenden Timeouts abbricht.
    function runCycle() {
      // Laufenden Zyklus abbrechen, bevor ein neuer startet
      if (cancelRef.current) {
        cancelRef.current()
        cancelRef.current = null
      }

      // --- Abbruch-Mechanismus ---
      // `cancel` wird auf true gesetzt, wenn dieser Zyklus abgebrochen werden soll.
      // `timeouts` sammelt alle setTimeout-Handles dieses Zyklus.
      let cancel = false
      const timeouts: ReturnType<typeof setTimeout>[] = []

      // Sicheres setTimeout: führt fn nur aus, wenn der Zyklus noch aktiv ist
      function safeTimeout(fn: () => void, ms: number) {
        const t = setTimeout(() => { if (!cancel) fn() }, ms)
        timeouts.push(t)
      }

      // Cleanup: Zyklus als abgebrochen markieren und alle Timeouts löschen
      function cleanup() {
        cancel = true
        timeouts.forEach(clearTimeout)
      }

      // Cleanup-Funktion für externen Zugriff (z.B. beim Unmount oder neuem Zyklus) speichern
      cancelRef.current = cleanup

      // Nächstes Foto auswählen (kein unmittelbares Repeat)
      const prev = indexRef.current
      let   next = prev
      while (next === prev) next = Math.floor(Math.random() * PHOTOS.length)
      indexRef.current = next

      const img       = new Image()
      img.crossOrigin = 'anonymous'
      img.src         = PHOTOS[next]

      img.onload = () => {
        if (cancel) return
        resize()
        redraw(img, 0)

        // 12 Enhance-Phasen à PHASE_MS Millisekunden durchlaufen
        let phase = 0
        function advance() {
          if (cancel) return
          phase++
          if (phase < STAGES.length) {
            // Nächste Phase zeichnen
            redraw(img, phase)
            safeTimeout(advance, PHASE_MS)
          } else {
            // Alle Phasen durchlaufen → scharfes Bild HOLD_MS lang halten, dann nächstes Foto
            safeTimeout(runCycle, HOLD_MS)
          }
        }
        safeTimeout(advance, PHASE_MS)
      }

      img.onerror = () => {
        // Ladefehler → kurz warten, dann nächstes Bild versuchen
        if (!cancel) safeTimeout(runCycle, 200)
      }
    }

    resize()
    runCycle()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      // Beim Unmount: laufenden Zyklus abbrechen
      if (cancelRef.current) {
        cancelRef.current()
        cancelRef.current = null
      }
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Statisches Kamera-Label oben links */}
      <div className="absolute top-1 left-1 font-mono text-xs text-green-500 bg-black/70 px-1 pointer-events-none select-none">
        CAM-07 ● APOLLO SECTOR ● {new Date().toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}
