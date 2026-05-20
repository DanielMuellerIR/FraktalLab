import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Konstanten ────────────────────────────────────────────────────────────────
const HMAP = 512   // Muss eine 2er-Potenz sein, damit Bit-Masking funktioniert

// HSL → RGB (h: 0..360, s/l: 0..1)
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

// Erzeugt ein Heightmap-Array aus mehreren Sinus-Oktaven (einmalig beim Modullade)
function buildHeightmap(
  octaves: Array<{ sx: number; sy: number; amp: number; px?: number; py?: number }>
): Uint8Array {
  const hm = new Uint8Array(HMAP * HMAP)
  for (let y = 0; y < HMAP; y++) {
    for (let x = 0; x < HMAP; x++) {
      let v = 128
      for (const o of octaves) {
        v += o.amp * Math.sin(x * o.sx + (o.px ?? 0)) * Math.cos(y * o.sy + (o.py ?? 0))
      }
      hm[y * HMAP + x] = Math.max(0, Math.min(255, Math.round(v)))
    }
  }
  return hm
}

// ── Voxel-Space-Render-Fabrik ─────────────────────────────────────────────────
// Jede Szene hat ihre eigene Auflösung, Heightmap und Farbfunktion.
// colorFn(th, fog): th = Terrain-Höhe 0..255, fog = Tiefe 0..1 → [R, G, B]
function makeVoxelScene(
  title: string,
  W: number, H: number,
  heightmap: Uint8Array,
  colorFn: (th: number, fog: number) => [number, number, number],
  camCfg: {
    vx: number; vy: number; va: number
    speedMin?: number; speedMax?: number; impulseScale?: number
  },
  opts: {
    horizon?: number; scale?: number; fov?: number; far?: number
    camHBase?: number; camHAmp?: number; camHFloor?: number
    scanlines?: boolean
  } = {}
): () => React.JSX.Element {
  const {
    horizon    = H * 0.42,
    scale      = 120,
    fov        = 1.2,
    far        = 150,
    camHBase   = 110,
    camHAmp    = 30,
    camHFloor  = 70,
    scanlines  = true,
  } = opts

  return function VoxelScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cam = useRef({
      x: 150 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      vx: camCfg.vx * (0.8 + Math.random() * 0.4),
      vy: camCfg.vy * (0.8 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      va: camCfg.va,
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
      const speedMin     = camCfg.speedMin     ?? 0.8
      const speedMax     = camCfg.speedMax     ?? 5
      const impulseScale = camCfg.impulseScale ?? 3

      // ImageData einmal allozieren und pro Frame wiederverwenden → weniger GC-Druck
      const img = ctx.createImageData(W, H)
      const buf = img.data

      function loop(t: number) {
        if (!running) return

        const dt = Math.min(t - lastT, 50)
        lastT = t
        const c = cam.current

        // Zufälliger Geschwindigkeits-Impuls alle 2.5–4.5 Sekunden
        if (t - c.lastImpulse > 2500 + Math.random() * 2000) {
          c.vx += (Math.random() - 0.5) * impulseScale
          c.vy += (Math.random() - 0.5) * impulseScale
          c.va += (Math.random() - 0.5) * 0.005
          c.lastImpulse = t
        }

        // Exponentielles Dämpfen (keine abrupten Richtungswechsel)
        c.vx *= 0.992
        c.vy *= 0.992
        c.va *= 0.995

        // Mindest- und Höchstgeschwindigkeit erzwingen
        const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy)
        if (speed < speedMin) { c.vx += (Math.random()-0.5)*1.5; c.vy += (Math.random()-0.5)*1.5 }
        if (speed > speedMax) { c.vx *= speedMax/speed; c.vy *= speedMax/speed }

        // Position aktualisieren — Terrain wrapp nahtlos durch Bit-Maske (HMAP = 2^n)
        c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
        c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
        c.angle += c.va * dt/16

        // Terrain-Höhe unter der Kamera samplen → Kamera mindestens camHFloor Einheiten über Boden
        const tx = Math.floor(c.x) & (HMAP - 1)
        const ty = Math.floor(c.y) & (HMAP - 1)
        const terrainAtCam = heightmap[ty * HMAP + tx]
        const camH = Math.max(terrainAtCam + camHFloor, camHBase + camHAmp * Math.sin(t * 0.0004))

        // Himmel: fast schwarz mit leichtem Gradient nach oben
        for (let y = 0; y < H; y++) {
          const sk = Math.max(0, 18 - y * 0.3)
          for (let x = 0; x < W; x++) {
            const pi = (y * W + x) * 4
            buf[pi] = sk; buf[pi+1] = sk; buf[pi+2] = sk; buf[pi+3] = 255
          }
        }

        // Raycasting: pro Spalte einen Strahl werfen und Terrain-Silhouette projizieren
        for (let x = 0; x < W; x++) {
          const rayAngle = c.angle - fov/2 + (x/W) * fov
          const rdx = Math.cos(rayAngle)
          const rdy = Math.sin(rayAngle)
          let maxY = H

          for (let z = 1; z <= far; z++) {
            const wx = (c.x + rdx * z) & (HMAP - 1)
            const wy = (c.y + rdy * z) & (HMAP - 1)
            const th = heightmap[Math.floor(wy) * HMAP + Math.floor(wx)]

            const projY = Math.floor((camH - th) / z * scale + horizon)
            if (projY >= maxY) continue

            const fog = z / far
            const [cr, cg, cb] = colorFn(th, fog)

            const yStart = Math.max(0, projY)
            const yEnd   = Math.min(H, maxY)
            for (let y = yStart; y < yEnd; y++) {
              const pi = (y * W + x) * 4
              buf[pi] = cr; buf[pi+1] = cg; buf[pi+2] = cb; buf[pi+3] = 255
            }
            maxY = projY
            if (maxY <= 0) break
          }
        }

        // CRT-Scanline-Overlay: jede zweite Zeile leicht aufhellen → Röhren-Ästhetik
        if (scanlines) {
          for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x++) {
              const pi = (y * W + x) * 4
              buf[pi]   = Math.min(255, buf[pi]   + 8)
              buf[pi+1] = Math.min(255, buf[pi+1] + 8)
              buf[pi+2] = Math.min(255, buf[pi+2] + 8)
            }
          }
        }

        ctx.putImageData(img, 0, 0)
        rafId = requestAnimationFrame(loop)
      }

      rafId = requestAnimationFrame(loop)
      return () => { running = false; cancelAnimationFrame(rafId) }
    }, [])

    return (
      <Panel title={title}>
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <canvas
            ref={canvasRef}
            width={W} height={H}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '100%',
              aspectRatio: `${W} / ${H}`,
              imageRendering: 'pixelated',
              display: 'block',
            }}
          />
        </div>
      </Panel>
    )
  }
}

// ── Terrain-Heightmaps (einmalig beim Modullade berechnet) ────────────────────

// Sanfte Hügel für Thermal-Scanner
const hmSmooth = buildHeightmap([
  { sx: 0.012, sy: 0.009, amp: 60 },
  { sx: 0.031, sy: 0.025, amp: 30, px: 1.5, py: 0.7 },
  { sx: 0.071, sy: 0.058, amp: 15, px: 2.8, py: 1.9 },
])

// Zerklüftetes Terrain für Neon-Demoscene (viele, hohe Frequenzen)
const hmJagged = buildHeightmap([
  { sx: 0.028, sy: 0.021, amp: 45, px: 0.7,  py: 1.2 },
  { sx: 0.067, sy: 0.053, amp: 35, px: 3.1,  py: 0.4 },
  { sx: 0.143, sy: 0.118, amp: 25, px: 1.8,  py: 2.7 },
  { sx: 0.287, sy: 0.231, amp: 15, px: 4.2,  py: 1.1 },
])

// ── Variante: THERMAL SCAN ────────────────────────────────────────────────────
// Infrarot-Ästhetik: tiefe Täler dunkelblau → Gipfel gelb-weiß
export const VoxelThermal = makeVoxelScene(
  'THERMAL SCAN // TERRAIN ANALYSIS',
  320, 200,
  hmSmooth,
  (th, fog) => {
    const t = th / 255
    const f = 1 - fog
    let r: number, g: number, b: number
    if (t < 0.25) {
      // Schwarz → Dunkelblau in tiefen Tälern
      r = 0; g = 0; b = Math.round(t / 0.25 * 130)
    } else if (t < 0.5) {
      // Dunkelblau → Rot (Übergang am Hang)
      const p = (t - 0.25) / 0.25
      r = Math.round(p * 220); g = 0; b = Math.round(130 - p * 130)
    } else if (t < 0.75) {
      // Rot → Orange (mittlere Höhen)
      const p = (t - 0.5) / 0.25
      r = 220; g = Math.round(p * 160); b = 0
    } else {
      // Orange → Gelb-Weiß (Gipfel)
      const p = (t - 0.75) / 0.25
      r = 255; g = Math.round(160 + p * 95); b = Math.round(p * 200)
    }
    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  { vx: 1.2, vy: 0.9, va: 0.0015 },
  { camHBase: 100, camHAmp: 25, camHFloor: 60 },
)

// Lava: große flache Flächen mit scharfen Gipfeln (dominante mittlere Frequenz)
const hmLava = buildHeightmap([
  { sx: 0.008, sy: 0.006, amp: 30 },
  { sx: 0.024, sy: 0.018, amp: 58, px: 2.3, py: 1.1 },
  { sx: 0.058, sy: 0.046, amp: 22, px: 0.9, py: 3.2 },
  { sx: 0.14,  sy: 0.11,  amp: 16, px: 1.5, py: 0.8 },
])

// Matrix: mittelgroße Hügel, ausgewogen für grünen Raster-Look
const hmMatrix = buildHeightmap([
  { sx: 0.019, sy: 0.015, amp: 38, px: 1.1, py: 2.4 },
  { sx: 0.041, sy: 0.033, amp: 32, px: 3.7, py: 0.9 },
  { sx: 0.093, sy: 0.076, amp: 28, px: 0.3, py: 1.8 },
  { sx: 0.17,  sy: 0.14,  amp: 18, px: 2.1, py: 3.5 },
])

// ── Variante: NEON GRID (Demoscene-Stil) ─────────────────────────────────────
// Halbe Auflösung → doppelt große Pixel (Retro-Charakter).
// Farbe: Cyan in tiefen Tälern → Magenta auf Gipfeln.
export const VoxelNeon = makeVoxelScene(
  'NEON GRID // SECTOR Ω',
  160, 100,     // absichtlich niedrige Auflösung — mehr "Pixel" im Container
  hmJagged,
  (th, fog) => {
    const t = th / 255
    const f = Math.max(0, 1 - fog * 0.85)
    // Hue-Verlauf: 180° (Cyan) bei niedrigem Terrain → 300° (Magenta) bei hohem
    const hue = 180 + t * 120
    const [r, g, b] = hslToRgb(hue, 1.0, 0.3 + t * 0.35)
    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  { vx: 2.0, vy: 1.4, va: 0.003, speedMin: 1.2, speedMax: 7, impulseScale: 4 },
  { far: 90, camHBase: 80, camHAmp: 20, camHFloor: 45, scanlines: true },
)

// ── Variante: LAVA FIELD ──────────────────────────────────────────────────────
// Glühende Lava-Ästhetik: tiefe Täler fast schwarz, Gipfel weißglühend.
// Terrain mit dominanter mittlerer Frequenz → typische Lavakrater-Landschaft.
export const VoxelLava = makeVoxelScene(
  'LAVA FIELD // SECTOR OMEGA',
  320, 200,
  hmLava,
  (th, fog) => {
    const t = th / 255
    const f = 1 - fog * 0.65   // wenig Nebel → weite Sicht über Lavafeld
    let r: number, g: number, b: number
    if (t < 0.35) {
      // Tiefe Täler: erkaltet, fast schwarz mit minimalem Rotschimmer
      const p = t / 0.35
      r = Math.round(p * 55); g = 0; b = 0
    } else if (t < 0.6) {
      // Hänge: dunkelrot → leuchtend rot
      const p = (t - 0.35) / 0.25
      r = Math.round(55 + p * 200); g = Math.round(p * 18); b = 0
    } else if (t < 0.82) {
      // Gipfel-Schultern: orange
      const p = (t - 0.6) / 0.22
      r = 255; g = Math.round(18 + p * 185); b = Math.round(p * 20)
    } else {
      // Glühende Spitzen: gelb-weiß
      const p = (t - 0.82) / 0.18
      r = 255; g = Math.round(203 + p * 52); b = Math.round(20 + p * 235)
    }
    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  { vx: 1.4, vy: 1.0, va: 0.0018, speedMin: 0.9, speedMax: 4 },
  { camHBase: 95, camHAmp: 18, camHFloor: 52 },
)

// ── Variante: PHOSPHOR TERRAIN ────────────────────────────────────────────────
// Grüner Phosphor-Look: Täler dunkelgrün, Gipfel hellgrün.
// Niedrige Auflösung für groben Demoscene-Pixel-Charakter, hohe Kamerageschwindigkeit.
export const VoxelMatrix = makeVoxelScene(
  'PHOSPHOR TERRAIN // GREEN SECTOR',
  160, 100,
  hmMatrix,
  (th, fog) => {
    const t = th / 255
    const f = Math.max(0, 1 - fog * 0.72)
    // Grüner Phosphor: minimales Rot für Wärme-Hauch
    const green = Math.round((0.18 + t * 0.82) * 255 * f)
    return [Math.round(green * 0.04), green, Math.round(green * 0.12)]
  },
  { vx: 3.0, vy: 2.0, va: 0.004, speedMin: 2.0, speedMax: 9, impulseScale: 5 },
  { far: 120, camHBase: 82, camHAmp: 14, camHFloor: 38, scanlines: true },
)
