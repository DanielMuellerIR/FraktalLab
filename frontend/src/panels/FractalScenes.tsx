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

// ── Schwarzraum-Detektor ──────────────────────────────────────────────────────
// Gibt true zurück, wenn >75% der abgetasteten Pixel Mandelbrot-Inneres (schwarz) sind.
// Abtastschritt 32 Byte (8 Pixel) → ~12% Stichprobe, schnell genug für 12-fps-Panels.
function isMostlyBlack(pixels: Uint8ClampedArray): boolean {
  let black = 0, total = 0
  for (let i = 0; i < pixels.length; i += 32) {
    if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) black++
    total++
  }
  return total > 0 && black / total > 0.75
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
  // Zoom-Startbereich: [min, spread] — Einstieg in [min .. min+spread]
  zoomStart:       [number, number] = [80, 2000],
  // Maximaler Zoom bevor Fade+Reset einsetzt
  zoomMax:         number = 3e4,
): () => React.JSX.Element {
  const W = 160, H = 107

  return function FractalScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
      // Zufälliger Einstieg mitten in interessantem Zoom-Bereich (nicht zoom~1 → zeigt schwarzes Inneres)
      zoom:      zoomStart[0] + Math.random() * zoomStart[1],
      locIdx:    Math.floor(Math.random() * locs.length),
      fadeAlpha: 0,
      fading:    false,
      increment: zoomRange[0] + Math.random() * (zoomRange[1] - zoomRange[0]),
      lastFrame: 0,
      // Cross-Fade: Pixel-Snapshots des aktuellen und nächsten Frames
      prevPixels:    null as Uint8ClampedArray | null,
      nextPixels:    null as Uint8ClampedArray | null,
      nextLocIdx:    0,
      nextZoom:      zoomStart[0],
      nextIncrement: zoomRange[0],
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

        // ── Cross-Fade läuft: nur Pixel blenden, kein WASM-Render ───────────
        if (s.fading && s.prevPixels && s.nextPixels) {
          s.fadeAlpha = Math.min(1, s.fadeAlpha + 0.06)

          const prev    = s.prevPixels
          const next    = s.nextPixels
          const blended = new Uint8ClampedArray(W * H * 4)
          const a       = s.fadeAlpha

          // Pixel-genaues Blend: prev*(1-a) + next*a
          for (let i = 0; i < blended.length; i += 4) {
            blended[i]   = (prev[i]   * (1 - a) + next[i]   * a) | 0
            blended[i+1] = (prev[i+1] * (1 - a) + next[i+1] * a) | 0
            blended[i+2] = (prev[i+2] * (1 - a) + next[i+2] * a) | 0
            blended[i+3] = 255
          }
          ctx.putImageData(new ImageData(blended, W, H), 0, 0)

          // Cross-Fade abgeschlossen: zu nächster Location wechseln
          if (s.fadeAlpha >= 1) {
            s.locIdx       = s.nextLocIdx
            s.zoom         = s.nextZoom
            s.increment    = s.nextIncrement
            s.fading       = false
            s.fadeAlpha    = 0
            s.prevPixels   = null
            s.nextPixels   = null
          }
          return
        }

        // ── Normaler Live-Render ──────────────────────────────────────────────
        const loc = locs[s.locIdx]
        s.zoom *= Math.pow(1 + s.increment, dt / 16.7)

        if (s.zoom > zoomMax && !s.fading) s.fading = true

        try {
          const params = new wasmMod.RenderParams(loc.cx, loc.cy, s.zoom, maxIter)
          const pixels = new Uint8ClampedArray(wasmMod.render(W, H, params))

          // Schwarzraum-Früherkennung: zu viel Inneres → Übergang sofort auslösen.
          // Zoom-Guard 150: darunter ist ein großer Innen-Anteil normal.
          if (!s.fading && s.zoom > 150 && isMostlyBlack(pixels)) s.fading = true

          // Farb-Transformation auf aktuellen Frame anwenden
          if (colorTransform) applyTransform(pixels, colorTransform)

          // Aktuellen Frame auf Canvas ausgeben
          ctx.putImageData(new ImageData(pixels, W, H), 0, 0)

          // Übergang starten: Snapshot beider Frames vorbereiten
          if (s.fading && !s.prevPixels) {
            // Snapshot des gerade gerenderten (und ggf. farbkorrigierten) Frames
            s.prevPixels = pixels.slice()

            // Nächste Location, Zoom und Inkrement bestimmen
            s.nextLocIdx    = (s.locIdx + 1) % locs.length
            s.nextZoom      = zoomStart[0] + Math.random() * zoomStart[1]
            s.nextIncrement = zoomRange[0] + Math.random() * (zoomRange[1] - zoomRange[0])

            // Einen WASM-Frame der Ziel-Location rendern
            const nextLoc    = locs[s.nextLocIdx]
            const nextParams = new wasmMod.RenderParams(nextLoc.cx, nextLoc.cy, s.nextZoom, maxIter)
            const nextPixels = new Uint8ClampedArray(wasmMod.render(W, H, nextParams))

            // Gleiche Farb-Transformation auch auf den Ziel-Frame anwenden
            if (colorTransform) applyTransform(nextPixels, colorTransform)

            s.nextPixels = nextPixels
            s.fadeAlpha  = 0
          }
        } catch { return }
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
// Koordinaten leicht herausgezoomt, damit die farbigen Seepferdchen-Strukturen sichtbar sind.
// maxIter erhöht auf 150 → mehr Iterationstiefe → weniger schwarz, feinere Farbbänder.
// Zoom-Einstieg niedrig (20..200) statt (80..2080), Max-Zoom-Schwelle auf 2500 reduziert,
// sodass der bunte Außenbereich der Seahorse Valley gut sichtbar bleibt.
export const FractalSeahorse = makeFractalScene(
  'SEAHORSE VALLEY // DEPTH ∞',
  [
    { cx: -0.7435, cy: 0.1314 },  // Seahorse Valley — Zentrum mit Farb-Wirbeln
    { cx: -0.7269, cy: 0.1889 },  // leicht verschoben, mehr Außenstruktur
    { cx: -0.7269, cy: 0.1314 },  // drittes Fenster — untere Seahorse-Region
  ],
  150,            // war 72 — mehr Iterationen → weniger schwarz, feinere Farbbänder
  undefined,
  [0.018, 0.06],  // langsamer als vorher → länger im bunten Bereich
  [20, 180],      // Zoom-Start: 20..200 statt 80..2080 → startet im bunten Außenbereich
  2500,           // Max-Zoom vor Reset: 2500 statt 30000 → kehrt früher zum Außenbereich zurück
)

// Grüner Phosphor, mittelschnell — tiefer Zoom in einen anderen Spiralarm als Seahorse.
// Koordinaten: real=0.36, imag=0.1 — reich strukturierter Spiralbereich im rechten Bulb-Übergang.
// Zoom-Start hoch (200..8000) → startet bereits tief in der Spiralstruktur.
export const FractalSpiral = makeFractalScene(
  'TRIPLE SPIRAL // SECTOR 3',
  [
    { cx: 0.36,  cy: 0.1  },  // rechter Bulb-Übergang — dicht strukturierte Spiralarme
    { cx: 0.355, cy: 0.108 }, // leicht verschoben für Abwechslung
  ],
  100,            // mehr Iterationen als vorher (war 72) → weniger schwarze Flächen
  'mono',
  [0.015, 0.065], // etwas schneller als vorher
  [200, 7800],    // Zoom-Start: 200..8000 — direkt tief in der Struktur
  40000,          // Max-Zoom vor Reset
)

// Kaltes Blau-Türkis, schnell
export const FractalLightning = makeFractalScene(
  'LIGHTNING FORK // VECTOR FIELD',
  [{ cx:-0.0630, cy:0.6748 }, { cx:-0.0621, cy:0.7140 }],
  80,
  'cold',
  [0.06, 0.20],
)

// Magma-Rot, mittel — Julia-artige Grenz-Spiralen nahe dem kritischen Punkt
// Koordinaten: real=-0.16, imag=1.0405 — hoch bunte Spiralstrukturen auf der Mandelbrot-Grenze
// Zoom-Start niedrig (50..5000) damit die farbigen Außenstrukturen sichtbar sind,
// Max-Zoom höher (50000) für tiefen Einblick in Spiralarme.
export const FractalElephant = makeFractalScene(
  'ELEPHANT VALLEY // SCANNING',
  [
    { cx: -0.16,   cy: 1.0405 },  // Julia-artige Spiralen auf der Mandelbrot-Grenze
    { cx: -0.1701, cy: 1.0365 },  // leicht verschoben — andere Spiralstruktur
  ],
  120,            // mehr Iterationen → feinere Farbbänder in den Spiralarmen
  'hot',
  [0.012, 0.055], // mittleres Tempo — nicht zu schnell durch die Spiralen
  [50, 4950],     // Einstieg: 50..5000 — startet im bunten Außenbereich
  50000,          // tiefer Zoom bis 50 000 bevor Reset
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

// Invertiert (psychedelisch), sehr langsam — das visuell beeindruckendste Fraktal-Panel.
// Koordinaten: real=-0.0986, imag=0.6517 — "Double Spiral" Region mit extrem feinen
// selbstähnlichen Strukturen. Zoom bis 100 000 für maximale Tiefenwirkung.
// maxIter=200 → deutlich feinere Farbbänder und weniger schwarze Fehlstellen.
// Zoom-Start hoch (500..15000) damit man sofort in der interessanten Tiefenstruktur landet.
export const FractalSwirl = makeFractalScene(
  'DEEP SWIRL // PATTERN LOCK',
  [
    { cx: -0.0986, cy: 0.6517 },  // Double-Spiral-Region — maximale Strukturdichte
    { cx: -0.0986, cy: 0.6519 },  // minimal verschoben — anderer Spiraleingang
    { cx:  0.295,  cy: 0.555  },  // zweite Double-Spiral-Region — andere Farbcharakteristik
  ],
  200,            // war 72 — 3× mehr Iterationen → viel feinere, reichere Farbbänder
  'invert',
  [0.008, 0.030], // langsam, damit die feinen Strukturen sichtbar bleiben
  [500, 14500],   // Einstieg: 500..15000 — direkt in der tiefen Spiralstruktur
  100000,         // Max-Zoom 100 000 — der tiefste Zoom aller Panels
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
