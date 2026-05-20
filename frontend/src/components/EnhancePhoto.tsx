import { useEffect, useRef } from 'react'

// Enhance-Slideshow: lade → pixeliert → enhance in 6 Phasen → kurze Pause → nächstes Bild.
// Kein Stillstand — der Zyklus läuft dauerhaft durch.

const STAGES = [
  { block: 32, label: 'RECEIVING SIGNAL...',             pct:   0 },
  { block: 16, label: 'ANALYZING PIXEL DATA...',         pct:  20 },
  { block:  8, label: 'EXTRAPOLATING MISSING INFO...',   pct:  40 },
  { block:  4, label: 'ENHANCING...',                    pct:  60 },
  { block:  2, label: 'APPLYING SHARPNESS MATRIX...',    pct:  80 },
  { block:  1, label: 'ENHANCEMENT COMPLETE',            pct: 100 },
]

// Lokale Dateien (6 Fotos) + loremflickr ausschließlich mit Großstadt-Menschen-Keywords.
// Kein Natur/Wald — nur urbane Settings mit Menschen in der Öffentlichkeit.
const LOCAL = [0, 1, 2, 3, 4, 5].map(i => `/enhance/street-${i}.jpg`)
const FLICKR_TAGS = ['crowd,city', 'subway,people', 'street,people', 'market,city', 'commuters', 'pedestrians,downtown', 'urban,crowd', 'city,people']
const FLICKR = Array.from({ length: 32 }, (_, i) => {
  const tag = FLICKR_TAGS[i % FLICKR_TAGS.length]
  return `https://loremflickr.com/320/213/${tag}?lock=${i + 1}`
})
const PHOTOS = [...LOCAL, ...FLICKR]

function drawPixelated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  blockSize: number,
  w: number,
  h: number,
) {
  if (blockSize <= 1) {
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, w, h)
    return
  }
  const tmp    = document.createElement('canvas')
  tmp.width    = Math.max(1, Math.floor(w / blockSize))
  tmp.height   = Math.max(1, Math.floor(h / blockSize))
  const tc     = tmp.getContext('2d')!
  tc.drawImage(img, 0, 0, tmp.width, tmp.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, w, h)
}

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
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
  ctx.fillText(`${bar}  ${label}`, 5, h - 7)
}

export default function EnhancePhoto() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef    = useRef(true)
  const indexRef     = useRef(Math.floor(Math.random() * PHOTOS.length))

  useEffect(() => {
    activeRef.current = true

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

    // Einen vollständigen Enhance-Zyklus für ein Foto durchlaufen
    function runCycle() {
      if (!activeRef.current) return

      // Nächstes Foto (kein unmittelbares Repeat)
      const prev = indexRef.current
      let   next = prev
      while (next === prev) next = Math.floor(Math.random() * PHOTOS.length)
      indexRef.current = next

      const img         = new Image()
      img.crossOrigin   = 'anonymous'
      img.src           = PHOTOS[next]

      img.onload = () => {
        if (!activeRef.current) return
        resize()
        redraw(img, 0)

        // 6 Enhance-Phasen à 400 ms durchlaufen
        let phase = 0
        function advance() {
          if (!activeRef.current) return
          phase++
          if (phase < STAGES.length) {
            redraw(img, phase)
            setTimeout(advance, 400)
          } else {
            // Fertig: 1.8 s scharfes Bild zeigen, dann nächstes
            setTimeout(runCycle, 1800)
          }
        }
        setTimeout(advance, 400)
      }

      img.onerror = () => {
        // Fehler → gleich nächstes Bild
        if (activeRef.current) setTimeout(runCycle, 200)
      }
    }

    resize()
    runCycle()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      activeRef.current = false
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
