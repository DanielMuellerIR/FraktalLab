import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

interface Location { cx: number; cy: number }

// Farbkorrektur-Typen — jede Szene bekommt ihren eigenen Look
type ColorTransform = 'mono' | 'cold' | 'hot' | 'neon' | 'invert'

// Schnelle Pixel-Transformation: läuft nach dem WASM-Render auf dem Pixel-Buffer.
// Schwarze Pixel (Fraktal-Inneres) werden übersprungen.
function applyTransform(pixels: Uint8ClampedArray, t: ColorTransform) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2]
    if ((r | g | b) === 0) continue
    switch (t) {
      case 'mono': {
        // Grüner Phosphor (klassisches CRT-Terminal)
        const lum = Math.round(0.299*r + 0.587*g + 0.114*b)
        pixels[i] = 0; pixels[i+1] = lum; pixels[i+2] = 0
        break
      }
      case 'cold': {
        // Kaltes Blau-Türkis — Mindesthelligkeit damit dunkle Regionen nicht rein schwarz werden
        const lum = (r + g + b) / 3
        const boost = Math.max(0, 40 - lum)   // Grundhelligkeit auch bei dunklen Pixeln
        pixels[i]   = Math.min(255, (r * 0.1 | 0) + boost * 0.3)
        pixels[i+1] = Math.min(255, (g * 0.5 | 0) + boost * 0.6)
        pixels[i+2] = Math.min(255, ((b * 1.5 + r * 0.4) | 0) + boost)
        break
      }
      case 'hot': {
        // Magma: Rot-Orange-Glut
        pixels[i]   = Math.min(255, (r * 1.5 + g * 0.25) | 0)
        pixels[i+1] = Math.min(255, g * 0.45 | 0)
        pixels[i+2] = Math.min(255, b * 0.05 | 0)
        break
      }
      case 'neon': {
        // Cyan-Magenta-Neon
        pixels[i]   = Math.min(255, r * 1.3 | 0)
        pixels[i+1] = Math.min(255, g * 0.15 | 0)
        pixels[i+2] = Math.min(255, b * 1.6 | 0)
        break
      }
      case 'invert': {
        pixels[i] = 255 - r; pixels[i+1] = 255 - g; pixels[i+2] = 255 - b
        break
      }
    }
  }
}

// ── Render-Fabrik ─────────────────────────────────────────────────────────────
function makeFractalScene(
  title:           string,
  locs:            Location[],
  maxIter:         number,
  colorTransform?: ColorTransform,
  // Zoom-Inkrement-Bereich pro 16.7ms (normiert).
  // 0.015 = ruhig, 0.20 = sehr schnell
  zoomRange:       [number, number] = [0.015, 0.15],
): () => React.JSX.Element {
  const W = 160, H = 107

  return function FractalScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
      // Zufälliger Einstieg mitten in interessantem Zoom-Bereich (nicht zoom~1 → zeigt schwarzes Inneres)
      zoom:      80 + Math.random() * 2000,
      locIdx:    Math.floor(Math.random() * locs.length),
      fadeAlpha: 0,
      fading:    false,
      increment: zoomRange[0] + Math.random() * (zoomRange[1] - zoomRange[0]),
      lastFrame: 0,
    })

    useEffect(() => {
      const canvas = canvasRef.current!
      const ctx    = canvas.getContext('2d')!
      let raf: number
      let alive = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let wasmMod: any = null

      import('@wasm/fraktallab_wasm.js').then(async (wasm) => {
        await wasm.default()
        if (alive) wasmMod = wasm
      })

      function loop(t: number) {
        if (!alive) return
        raf = requestAnimationFrame(loop)

        const s = stateRef.current
        // Throttle: ~12 fps statt 60 → WASM-Last auf ~20% senken
        if (t - s.lastFrame < 82) return
        const dt = Math.min(50, t - s.lastFrame)
        s.lastFrame = t
        if (!wasmMod) return

        const loc = locs[s.locIdx]
        s.zoom *= Math.pow(1 + s.increment, dt / 16.7)

        if (s.zoom > 3e4 && !s.fading) s.fading = true

        if (s.fading) {
          s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.06)
          if (s.fadeAlpha >= 1) {
            s.locIdx    = (s.locIdx + 1) % locs.length
            s.zoom      = 80 + Math.random() * 2000   // Einstieg mitten in interessantem Bereich
            s.fading    = false
            s.increment = zoomRange[0] + Math.random() * (zoomRange[1] - zoomRange[0])
          }
        } else {
          s.fadeAlpha = Math.max(0, s.fadeAlpha - 0.05)
        }

        try {
          const params = new wasmMod.RenderParams(loc.cx, loc.cy, s.zoom, maxIter)
          const pixels = new Uint8ClampedArray(wasmMod.render(W, H, params))
          if (colorTransform) applyTransform(pixels, colorTransform)
          ctx.putImageData(new ImageData(pixels, W, H), 0, 0)
        } catch { return }

        if (s.fadeAlpha > 0) {
          ctx.fillStyle = `rgba(0,0,0,${s.fadeAlpha})`
          ctx.fillRect(0, 0, W, H)
        }
      }

      raf = requestAnimationFrame(loop)
      return () => { alive = false; cancelAnimationFrame(raf) }
    }, [])

    return (
      <Panel title={title}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{ width:'100%', height:'100%', imageRendering:'pixelated', display:'block' }}
        />
      </Panel>
    )
  }
}

// ── 10 Fraktal-Szenen — verschiedene Koordinaten, Farb-Looks und Tempi ──────

// Volle Farben, mittelschnell
export const FractalSeahorse = makeFractalScene(
  'SEAHORSE VALLEY // DEPTH ∞',
  [{ cx:-0.7269, cy:0.1889 }, { cx:-0.7453, cy:0.1127 }],
  72,
  undefined,
  [0.04, 0.15],
)

// Grüner Phosphor, langsam
export const FractalSpiral = makeFractalScene(
  'TRIPLE SPIRAL // SECTOR 3',
  [{ cx:-0.5436, cy:0.6317 }, { cx:-0.5088, cy:0.6324 }],
  72,
  'mono',
  [0.012, 0.055],
)

// Kaltes Blau-Türkis, schnell
export const FractalLightning = makeFractalScene(
  'LIGHTNING FORK // VECTOR FIELD',
  [{ cx:-0.0630, cy:0.6748 }, { cx:-0.0621, cy:0.7140 }],
  80,
  'cold',
  [0.06, 0.20],
)

// Magma-Rot, sehr langsam
export const FractalElephant = makeFractalScene(
  'ELEPHANT VALLEY // SCANNING',
  [{ cx:-0.1080, cy:0.9249 }, { cx:-0.1011, cy:0.9563 }],
  72,
  'hot',
  [0.006, 0.035],
)

// Volle Farben, mittel
export const FractalMini = makeFractalScene(
  'MINI-MANDELBROT // DEEP FIELD',
  [{ cx:-1.7534, cy:0.0016 }, { cx:-1.6256, cy:0.0019 }],
  80,
  undefined,
  [0.015, 0.07],
)

// Cyan-Magenta-Neon, mittelschnell
export const FractalDendrite = makeFractalScene(
  'DENDRITE // FRACTAL GROWTH',
  [{ cx:-1.4012, cy:0.0001 }, { cx:-1.1544, cy:0.2411 }],
  72,
  'neon',
  [0.05, 0.16],
)

// Grüner Phosphor, sehr schnell
export const FractalAntenna = makeFractalScene(
  'ANTENNA // SIGNAL LOCKED',
  [{ cx:-0.1230, cy:0.7448 }, { cx:-0.1354, cy:0.6491 }],
  80,
  'mono',
  [0.08, 0.22],
)

// Invertiert (psychedelisch), sehr langsam
export const FractalSwirl = makeFractalScene(
  'DEEP SWIRL // PATTERN LOCK',
  [{ cx:-0.6180, cy:0.3890 }, { cx:-0.4531, cy:0.3989 }],
  72,
  'invert',
  [0.006, 0.035],
)

// Kaltes Blau, langsam-mittel
export const FractalSatellite = makeFractalScene(
  'SATELLITE BULB // ORBIT Ω',
  [{ cx:-1.2560, cy:0.3818 }, { cx:-0.7326, cy:0.2312 }],
  80,
  'cold',
  [0.02, 0.08],
)

// Magma-Rot, extrem langsam (hypnotisch)
export const FractalTendril = makeFractalScene(
  'TENDRIL CLUSTER // CRAWLING',
  [{ cx:-0.7490, cy:0.0585 }, { cx:-0.7080, cy:0.2492 }],
  72,
  'hot',
  [0.004, 0.022],
)
