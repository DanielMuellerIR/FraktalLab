import { useCallback, useEffect, useRef, useState } from 'react'

const STAGES = [
  { block: 32, label: 'RECEIVING SIGNAL...',             pct: 0  },
  { block: 16, label: 'ANALYZING PIXEL DATA...',         pct: 20 },
  { block:  8, label: 'EXTRAPOLATING MISSING INFO...',   pct: 40 },
  { block:  4, label: 'ENHANCING...',                    pct: 60 },
  { block:  2, label: 'APPLYING SHARPNESS MATRIX...',    pct: 80 },
  { block:  1, label: 'ENHANCEMENT COMPLETE',            pct: 100 },
]

// Zeichnet das Bild mit Canvas-Pixelierung (downscale → upscale ohne Smoothing)
function drawPixelated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  blockSize: number,
  w: number, h: number,
) {
  if (blockSize <= 1) {
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, w, h)
    return
  }
  const tmp = document.createElement('canvas')
  tmp.width  = Math.max(1, Math.floor(w / blockSize))
  tmp.height = Math.max(1, Math.floor(h / blockSize))
  const tc = tmp.getContext('2d')!
  tc.drawImage(img, 0, 0, tmp.width, tmp.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, w, h)
}

// Grüne Scanlinien-Überlagerung — klassischer Überwachungskamera-Look
function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,255,0,0.03)'
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1)
  }
  // Vignette
  const grad = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

export default function EnhancePhoto() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef    = useRef<HTMLImageElement | null>(null)
  const [stage, setStage]       = useState(0)
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)

  // Zufälliges Foto von picsum.photos — 20 verschiedene Seeds, eines pro Mount gewählt
  useEffect(() => {
    const seed = Math.floor(Math.random() * 20) + 1
    const src = `https://picsum.photos/seed/${seed}/320/213`

    const img = new Image()
    img.crossOrigin = 'anonymous'   // CORS für canvas-Rendering erforderlich
    img.src = src
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      drawPixelated(ctx, img, STAGES[0].block, canvas.width, canvas.height)
      drawScanlines(ctx, canvas.width, canvas.height)
    }
  }, [])

  // Stage-Wechsel → neu zeichnen
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    drawPixelated(ctx, img, STAGES[stage].block, canvas.width, canvas.height)
    drawScanlines(ctx, canvas.width, canvas.height)
  }, [stage])

  const enhance = useCallback(() => {
    if (running) return
    setRunning(true)
    setDone(false)
    setStage(0)
    let s = 0
    const tick = setInterval(() => {
      s++
      if (s >= STAGES.length - 1) {
        setStage(STAGES.length - 1)
        setDone(true)
        setRunning(false)
        clearInterval(tick)
      } else {
        setStage(s)
      }
    }, 600)
  }, [running])

  // Autostart
  useEffect(() => { const t = setTimeout(enhance, 800); return () => clearTimeout(t) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const s = STAGES[stage]

  return (
    <div className="flex flex-col h-full min-h-0 gap-1">

      {/* Canvas */}
      <div className="relative flex-1 min-h-0 border border-green-900 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={320} height={213}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* Overlay-Label oben links */}
        <div className="absolute top-1 left-1 font-mono text-xs text-green-500 bg-black/70 px-1">
          CAM-07 ● APOLLO SECTOR ● {new Date().toLocaleDateString('en-GB')}
        </div>
        {/* Status unten */}
        <div className="absolute bottom-1 left-1 right-1 font-mono text-xs text-green-400 bg-black/70 px-1">
          {s.label}
          {running && <span className="animate-pulse ml-1">_</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="font-mono text-xs text-green-700 shrink-0">
        {'█'.repeat(Math.round(s.pct / 10))}{'░'.repeat(10 - Math.round(s.pct / 10))}
        {' '}{s.pct}%
      </div>

      {/* Button */}
      <button
        onClick={enhance}
        disabled={running}
        className="shrink-0 border border-green-700 font-mono text-xs text-green-400 py-1
                   hover:bg-green-900 hover:text-green-200 disabled:opacity-30 disabled:cursor-not-allowed
                   transition-colors"
      >
        {running ? '[ ENHANCING... ]' : done ? '[ ENHANCE AGAIN ]' : '[ ENHANCE ]'}
      </button>

      {done && (
        <div className="font-mono text-xs text-yellow-600 shrink-0 animate-pulse">
          ⚠ TARGET IDENTIFIED: PLANET EARTH (entire)
        </div>
      )}
    </div>
  )
}
