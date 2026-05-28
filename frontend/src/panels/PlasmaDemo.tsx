import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Konvertiert HSL → RGB (h in 0..360, s und l als 0..1)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // HSL-Werte auf gültige Bereiche klemmen
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))

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
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

// Palette 0 — Dark Nebula: tiefes Blau/Lila, an Peaks strahlend hell
function paletteNebula(v: number, ts: number): [number, number, number] {
  const h = (240 + Math.sin(v) * 35 + ts * 35) % 360
  const s = 0.90
  const l = 0.01 + Math.abs(Math.sin(v * 2.2)) * 0.48
  return hslToRgb(h, s, l)
}

// Palette 1 — Infrared: Dunkelrot/Orange/Gelb wie glühende Kohle
function paletteInfrared(v: number, ts: number): [number, number, number] {
  const h = (Math.abs(v) * 22 + ts * 35) % 360
  const s = 0.95
  const l = 0.01 + Math.abs(Math.sin(v * 1.5)) * 0.52
  return hslToRgb(h, s, l)
}

// Palette 2 — Acidic Dark: Dunkelgrün mit grellen Lime-Spitzen
function paletteAcidic(v: number, ts: number): [number, number, number] {
  const h = (120 + Math.sin(v * 2.8) * 45 + ts * 35) % 360
  const s = 0.95
  const l = 0.01 + Math.abs(Math.sin(v * 2.0)) * 0.48
  return hslToRgb(h, s, l)
}

// Palette 3 — Void: fast monochromes Dunkelcyan, helle weisse Entladungen
function paletteVoid(v: number, ts: number): [number, number, number] {
  const h = (180 + ts * 35) % 360
  const s = 0.85
  const l = 0.01 + Math.abs(Math.sin(v * 3.2)) * 0.45
  return hslToRgb(h, s, l)
}

// Array aller Paletten zur Indizierung
const PALETTES = [paletteNebula, paletteInfrared, paletteAcidic, paletteVoid]
const PALETTE_DURATION = 10   // Sekunden pro Palette (10s Szenenwechsel)
const CROSSFADE_DURATION = 10  // Kontinuierlicher Farbwechsel (ganze Dauer)


export default function PlasmaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

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
    let cachedImg: ImageData | null = null

    function loop(t: number) {
      if (!running) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      // Sicherheitscheck: falls Canvas noch keine Größe hat, überspringen
      if (canvas!.width === 0 || canvas!.height === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      const ts = t * 0.001  // Sekunden

      // Interne Auflösung: Performance-Cap bei max 480×360.
      const W = Math.min(canvas!.width,  480)
      const H = Math.min(canvas!.height, 360)

      // OffscreenCanvas auf interne Auflösung setzen (nur wenn sich Größe ändert)
      if (offscreen.width !== W || offscreen.height !== H) {
        offscreen.width  = W
        offscreen.height = H
        cachedImg = null
      }
      const offCtx = offscreen.getContext('2d')!
      if (!cachedImg) {
        cachedImg = offCtx.createImageData(W, H)
      }
      const img = cachedImg
      const d = img.data

      // Alle 10 Sekunden wechselt die Plasma-Wellenform (3 Modi)
      const mode = Math.floor(ts / 10) % 3

      // Alle 20 Sekunden wechselt die Farbpalette (4 dunkle Paletten), mit 2s Crossfade
      const paletteCycle = ts / PALETTE_DURATION
      const paletteIdx   = Math.floor(paletteCycle) % PALETTES.length
      const nextIdx      = (paletteIdx + 1) % PALETTES.length
      // Fortschritt innerhalb des aktuellen Palette-Slots (0..1)
      const progress     = paletteCycle % 1
      // Crossfade-Anteil: 0 → 1 nur im letzten CROSSFADE_DURATION-Bereich des Slots
      const fadeFraction = CROSSFADE_DURATION / PALETTE_DURATION
      const alpha = progress > (1 - fadeFraction)
        ? (progress - (1 - fadeFraction)) / fadeFraction   // 0..1 während Überblendung
        : 0                                                 // kein Überblenden

      const palA = PALETTES[paletteIdx]
      const palB = PALETTES[nextIdx]

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cx = x - W / 2
          const cy = y - H / 2
          const r  = Math.sqrt(cx * cx + cy * cy)
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

          // Farbe aus aktueller Palette, ggf. mit Crossfade zur nächsten
          const [raA, gaA, baA] = palA(v, ts)
          let ri: number, gi: number, bi: number
          if (alpha > 0) {
            // Lineare Überblendung zwischen zwei Paletten (Crossfade)
            const [raB, gaB, baB] = palB(v, ts)
            ri = Math.round(raA + (raB - raA) * alpha)
            gi = Math.round(gaA + (gaB - gaA) * alpha)
            bi = Math.round(baA + (baB - baA) * alpha)
          } else {
            ri = raA; gi = gaA; bi = baA
          }

          const pi = (y * W + x) * 4
          d[pi] = ri; d[pi + 1] = gi; d[pi + 2] = bi; d[pi + 3] = 255
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
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="PLASMA CORE // RENDERING Ω">
      {/* Canvas füllt den Panel-Body vollständig */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'auto', display: 'block' }}
      />
    </Panel>
  )
}
