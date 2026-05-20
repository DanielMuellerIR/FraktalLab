import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Konvertiert HSL → RGB (s und l als 0..1)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)]
}

export default function PlasmaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true

    // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────────
    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Wiederverwendbares OffscreenCanvas für die interne Niedrig-Auflösung
    const offscreen = document.createElement('canvas')

    function loop(t: number) {
      if (!running) return

      // Sicherheitscheck: falls Canvas noch keine Größe hat, überspringen
      if (canvas!.width === 0 || canvas!.height === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      const ts = t * 0.001  // Sekunden

      // Interne Auflösung: Performance-Cap bei max 200×150.
      // Demoscene-Plasma sieht bei grober Auflösung besser aus (grobe Pixel-Ästhetik).
      const W = Math.min(canvas!.width,  200)
      const H = Math.min(canvas!.height, 150)

      // OffscreenCanvas auf interne Auflösung setzen (nur wenn sich Größe ändert)
      if (offscreen.width !== W || offscreen.height !== H) {
        offscreen.width  = W
        offscreen.height = H
      }
      const offCtx = offscreen.getContext('2d')!
      const img = offCtx.createImageData(W, H)
      const d = img.data

      // Alle 8 Sekunden wechselt das Plasma-Motiv (3 Modi)
      const mode = Math.floor(ts / 8) % 3

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cx = x - W / 2
          const cy = y - H / 2
          const r  = Math.sqrt(cx*cx + cy*cy)
          let v: number

          if (mode === 0) {
            // Klassisches Plasma: vier überlagerte Sinuswellen
            v = Math.sin(x * 0.25 + ts * 1.3)
              + Math.sin(y * 0.25 + ts * 0.9)
              + Math.sin((x + y) * 0.18 + ts * 1.1)
              + Math.sin(r * 0.35 + ts * 1.5)

          } else if (mode === 1) {
            // Tunnel-Spirale (Amiga-Klassiker)
            const a = Math.atan2(cy, cx)
            v = Math.sin(r * 0.4 - ts * 2.2)
              + Math.sin(a * 3   + ts * 1.2)
              + Math.sin(r * 0.15 + a * 2 - ts * 0.8)
              + Math.cos(r * 0.6  + ts * 0.7)

          } else {
            // Interference Grid — Moiré-Muster + rotierende Wellen
            v = Math.sin(x * 0.3 + ts) * Math.cos(y * 0.3 + ts * 1.4)
              + Math.sin((x - y) * 0.25 + ts * 0.8)
              + Math.cos(r * 0.3  - ts * 1.2)
              + Math.sin(x * 0.1  + y * 0.1 + ts * 2)
          }

          // Hue aus Plasma-Wert + zeitlich rotierender Basisfarbe
          const hue = ((v + 4) / 8 * 360 + ts * 40) % 360
          const [ri, gi, bi] = hslToRgb(hue, 1, 0.5)

          const pi = (y * W + x) * 4
          d[pi] = ri; d[pi+1] = gi; d[pi+2] = bi; d[pi+3] = 255
        }
      }

      // Interne Pixel in OffscreenCanvas schreiben ...
      offCtx.putImageData(img, 0, 0)
      // ... dann auf die volle Canvas-Größe hochskalieren (pixelated via CSS)
      ctx.drawImage(offscreen, 0, 0, canvas!.width, canvas!.height)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="PLASMA CORE // RENDERING Ω">
      {/* Canvas füllt den Panel-Body vollständig */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}
