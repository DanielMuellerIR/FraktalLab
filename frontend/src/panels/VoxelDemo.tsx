import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Heightmap — einmalig beim Modulload berechnet ────────────────────────────
const HMAP = 512
const heightmap = new Uint8Array(HMAP * HMAP)

for (let y = 0; y < HMAP; y++) {
  for (let x = 0; x < HMAP; x++) {
    heightmap[y * HMAP + x] = Math.floor(
      128
      + 55 * Math.sin(x * 0.018) * Math.cos(y * 0.013)
      + 28 * Math.sin(x * 0.047 + 1.2) * Math.cos(y * 0.038 + 0.8)
      + 14 * Math.sin(x * 0.11  + 2.1) * Math.cos(y * 0.09  + 1.5)
      +  7 * Math.sin(x * 0.23  + 0.5) * Math.cos(y * 0.19  + 2.3)
    )
  }
}

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

// ── Render-Funktion ──────────────────────────────────────────────────────────
// Liest W und H direkt aus canvas.width / canvas.height — kein Hardcoding.
function renderVoxel(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camX: number, camY: number, angle: number, camH: number, t: number,
) {
  // Interne Render-Auflösung: Performance-Cap bei 400 px Breite.
  // Voxel-Terrain soll pixelated aussehen, höhere Auflösung bringt keinen Mehrwert.
  const W = Math.min(canvas.width,  400)
  const H = Math.min(canvas.height, Math.round(400 * canvas.height / Math.max(canvas.width, 1)))

  const img = ctx.createImageData(W, H)
  const buf = img.data

  const horizon = H * 0.42
  const scale   = 120
  const FOV     = 1.2
  const FAR     = 150

  // Himmel: fast schwarz mit leichtem Grau-Gradient
  for (let y = 0; y < H; y++) {
    const sk = Math.max(0, 18 - y * 0.25)
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi] = sk; buf[pi+1] = sk; buf[pi+2] = sk; buf[pi+3] = 255
    }
  }

  for (let x = 0; x < W; x++) {
    const rayAngle = angle - FOV/2 + (x/W) * FOV
    const rdx = Math.cos(rayAngle)
    const rdy = Math.sin(rayAngle)
    let maxY = H

    // Color-Node für diese Spalte: Produkt zweier phasenverschobener Sinuswellen.
    // Überschreitet den Schwellwert nur ~10 % der Zeit → seltene Farbblitze.
    const nodeV = Math.sin(x * 2.3 + t * 0.0009) * Math.sin(x * 0.61 + t * 0.0013)
    const nodeIntensity = Math.max(0, (nodeV - 0.65) / 0.35)
    const nodeHue = (x * 47.3 + Math.floor(t / 5000) * 91) % 360
    const [nr, ng, nb] = nodeIntensity > 0 ? hslToRgb(nodeHue, 1, 0.5) : [0, 0, 0]

    for (let z = 1; z <= FAR; z++) {
      const wx = (camX + rdx * z) & (HMAP - 1)
      const wy = (camY + rdy * z) & (HMAP - 1)
      const th = heightmap[Math.floor(wy) * HMAP + Math.floor(wx)]

      const projY = Math.floor((camH - th) / z * scale + horizon)
      if (projY >= maxY) continue

      const fog = z / FAR
      // Grauwert: Nähe × Höhe → hellere Gipfel, dunklere Täler + Nebelabfall
      const lum = Math.round((1 - fog) * 200 * (0.5 + th / 510))

      const yStart = Math.max(0, projY)
      const yEnd   = Math.min(H, maxY)

      for (let y = yStart; y < yEnd; y++) {
        const pi = (y * W + x) * 4
        // Linearer Übergang Grau ↔ Knallfarbe je nach nodeIntensity
        const ni = nodeIntensity
        buf[pi]   = Math.round(lum * (1-ni) + nr * ni)
        buf[pi+1] = Math.round(lum * (1-ni) + ng * ni)
        buf[pi+2] = Math.round(lum * (1-ni) + nb * ni)
        buf[pi+3] = 255
      }
      maxY = projY
      if (maxY <= 0) break
    }
  }

  // Scanline-Overlay: jede zweite Zeile leicht aufhellen → CRT-Effekt
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi]   = Math.min(255, buf[pi]   + 8)
      buf[pi+1] = Math.min(255, buf[pi+1] + 8)
      buf[pi+2] = Math.min(255, buf[pi+2] + 8)
    }
  }

  // ImageData in internen Puffer zeichnen, dann auf Canvas-Größe strecken.
  // Weil das Canvas CSS-Größe == canvas.width/height ist, muss das Zwischenbild
  // zuerst in ein OffscreenCanvas / putImageData und dann drawImage gestreckt werden.
  // Einfacher: wir erstellen die ImageData mit der gecappten Auflösung (W×H)
  // und strecken sie per drawImage auf die volle Canvas-Größe.
  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width  = W
  tmpCanvas.height = H
  tmpCanvas.getContext('2d')!.putImageData(img, 0, 0)
  ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
}

// ── Komponente ───────────────────────────────────────────────────────────────
export default function VoxelDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Kamerazustand: Geschwindigkeit + Zufalls-Drift → endlose, nie wiederholende Route
  const cam = useRef({
    x: 200, y: 300,
    vx: 1.5, vy: 0.8,       // Anfangsgeschwindigkeit
    angle: 0.8, va: 0.002,  // Blickrichtung + Drehgeschwindigkeit
    lastImpulse: -5000,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    let lastT = 0
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

    function loop(t: number) {
      if (!running) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      // Delta cappen damit ein Tab-Wechsel keine Sprünge erzeugt
      const dt = Math.min(t - lastT, 50)
      lastT = t
      const c = cam.current

      // Sicherheitscheck: falls Canvas noch keine Größe hat, überspringen
      if (canvas!.width === 0 || canvas!.height === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      // Zufälliger Impuls alle 2.5–4.5 Sekunden
      if (t - c.lastImpulse > 2500 + Math.random() * 2000) {
        c.vx += (Math.random() - 0.5) * 3
        c.vy += (Math.random() - 0.5) * 3
        c.va += (Math.random() - 0.5) * 0.005
        c.lastImpulse = t
      }

      // Dämpfung
      c.vx *= 0.992
      c.vy *= 0.992
      c.va *= 0.995

      // Mindestgeschwindigkeit erzwingen
      const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy)
      if (speed < 0.8) { c.vx += (Math.random()-0.5)*1.5; c.vy += (Math.random()-0.5)*1.5 }
      // Maximalgeschwindigkeit begrenzen
      if (speed > 5) { c.vx *= 5/speed; c.vy *= 5/speed }

      // Position aktualisieren — Terrain wrapp nahtlos durch Bit-Maske (HMAP = 2^n)
      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
      c.angle += c.va * dt/16

      // Terrain-Höhe an Kameraposition samplen → Kamera immer mindestens 70 Einheiten darüber.
      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 70, 110 + 30 * Math.sin(t * 0.0004))

      // Canvas-Objekt übergeben, damit renderVoxel die aktuelle Größe lesen kann
      renderVoxel(ctx, canvas!, c.x, c.y, c.angle, camH, t)
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
    <Panel title="VOXEL TERRAIN // SECTOR 7G">
      {/* Canvas füllt den Panel-Body vollständig */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}
