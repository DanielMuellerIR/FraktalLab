import { memo } from 'react'
import Panel from '../ui/Panel'
import FractalGL from '../components/FractalGL'

// Die 10 Fraktal-Szenen-Panels. Seit Audit-Befund B-4 (PERF_NOTES.md) rendern sie
// über den GPU-Fragment-Shader (FractalGL) statt pixelweise in WASM auf dem
// Haupt-Thread. Die frühere CPU-Logik (eigener rAF-Loop, applyTransform,
// isLowDetail, findBoundaryNonBlack, bidirektionaler Zoom) ist entfallen —
// Färbung, Color-Transforms und Auto-Zoom-Navigation stecken jetzt im Shader bzw.
// in FractalGL. Vgl. Git-History für die alte WASM-Variante.

interface Location { cx: number; cy: number }

type ColorTransform = 'mono' | 'cold' | 'hot' | 'neon' | 'invert'

// Mappt den Color-Transform-Namen auf den uColorMode-Wert des Shaders
// (siehe utils/fractal-gl-shader.ts → applyColorMode).
const COLOR_MODE: Record<ColorTransform, number> = {
  mono: 1, cold: 2, hot: 3, neon: 4, invert: 5,
}

/**
 * Baut ein Fraktal-Szenen-Panel. Dünner Wrapper um FractalGL — die Konfiguration
 * (Typ, Locations, Julia-Parameter, Iterationstiefe, Farbe, Zoom-Limit) wird als
 * Props an den GPU-Renderer durchgereicht.
 */
function makeFractalScene(
  title:           string,
  type:            'mandelbrot' | 'julia',
  locs:            Location[],
  juliaC:          { cx: number; cy: number } | null,
  maxIter:         number,
  colorTransform?: ColorTransform,
  zoomMax:         number = 1e9,
  extraOptions?: {
    rotateRate?: number
    zoomRate?: number
    fadeZoomCeil?: number
    hueShiftSpeed?: number
    startZoom?: number
  }
) {
  const colorMode = colorTransform ? COLOR_MODE[colorTransform] : 0
  // FractalGL braucht mindestens einen Viewport-Mittelpunkt. Julia-Panels haben
  // keine Locations (sie variieren um den Ursprung) → Default (0,0).
  const locations = locs.length > 0 ? locs : [{ cx: 0, cy: 0 }]

  return memo(function FractalScene() {
    return (
      <Panel title={title}>
        <FractalGL
          mode={type}
          locations={locations}
          juliaC={juliaC ?? undefined}
          colorMode={colorMode}
          maxIter={maxIter}
          zoomMax={zoomMax}
          {...extraOptions}
        />
      </Panel>
    )
  })
}

// ── 10 Overhauled Fractal Scenes ──

export const FractalSeahorse = makeFractalScene(
  'SEAHORSE VALLEY // DEPTH ∞',
  'mandelbrot',
  [
    { cx: -0.7435, cy: 0.1314 },
    { cx: -0.7269, cy: 0.1889 },
    { cx: -0.7269, cy: 0.1314 },
  ],
  null,
  180,
  undefined,
  1e9
)

export const FractalSpiral = makeFractalScene(
  'TRIPLE SPIRAL // SECTOR 3',
  'mandelbrot',
  [
    { cx: -0.761574, cy: -0.0847596 },
    { cx: -0.743643, cy: 0.1318259  },
  ],
  null,
  200,
  undefined, // Weicheres Regenbogen-Cycling statt Hacker-Grün-Mono
  1e9,
  { rotateRate: -0.12, hueShiftSpeed: 25.0 }
)

export const FractalLightning = makeFractalScene(
  'LIGHTNING FORK // VECTOR FIELD',
  'mandelbrot',
  [
    { cx: -1.25066, cy: 0.02012 },
    { cx: -1.25045, cy: 0.02019 },
  ],
  null,
  200,
  'cold',
  1e9
)

export const FractalElephant = makeFractalScene(
  'ELEPHANT VALLEY // SCANNING',
  'mandelbrot',
  [
    { cx: 0.272050335, cy: 0.006118039 },
    { cx: 0.2894,      cy: 0.01258 },
  ],
  null,
  140,
  'neon', // Neon magenta/purple to distinguish from Tendril's hot colors
  1e9,
  { rotateRate: 0 } // Disable tumbling
)

export const FractalMini = makeFractalScene(
  'MINI-MANDELBROT // DEEP FIELD',
  'mandelbrot',
  [
    { cx: -1.7534,  cy: 0.0016 },
    { cx: -1.6256,  cy: 0.0019 },
    { cx: -1.75,    cy: 0.0 },
    { cx: -1.7682,  cy: 0.00178 }, // extra variety
    { cx: -1.6310,  cy: -0.0012 },
  ],
  null,
  120,
  undefined,
  8e4, // Lower cap to prevent pixel blowup
  { zoomRate: 0.3, rotateRate: 0.02, startZoom: 80 } // Slower zoom, longer cycle
)

export const FractalDragon = makeFractalScene(
  'NEON DRAGON // JULIA SECTOR',
  'julia',
  [],
  { cx: 0.285, cy: 0.01 },
  200,
  'neon',
  1e10,
  { startZoom: 220, rotateRate: 0.08, zoomRate: 0.6, hueShiftSpeed: 35.0 } // Faster hue shift = shorter red dwell
)

export const FractalSatellite = makeFractalScene(
  'SATELLITE ORBIT // DATASTREAM',
  'mandelbrot',
  [
    { cx: -1.2560, cy: 0.3818 },  // satellite bulb
    { cx: -0.7326, cy: 0.2312 },  // seahorse-adjacent
  ],
  null,
  200,
  'cold',
  1e9,
  { rotateRate: 0 } // Disable tumbling
)

export const FractalDendrite = makeFractalScene(
  'DENDRITE HYPHA // GROWTH',
  'julia',
  [],
  { cx: -0.7, cy: 0.27015 },
  220,
  'invert',
  1e10
)

export const FractalSwirl = makeFractalScene(
  'DEEP SWIRL // NEURAL SYNC',
  'mandelbrot',
  [
    { cx: -0.743643, cy: 0.1318259 },
    { cx: -0.7453,   cy: 0.113 },
  ],
  null,
  220,
  'invert',
  5e4, // Much lower cap — prevents pixel-blowup at extreme zoom
  { fadeZoomCeil: 8e4, zoomRate: 0.5 } // Slower zoom + earlier fade
)

export const FractalTendril = makeFractalScene(
  'TENDRIL CLUSTER // CRAWLING',
  'mandelbrot',
  [
    { cx: -0.7483, cy: 0.1127 },
    { cx: -0.743643, cy: 0.1318259 },
  ],
  null,
  200,
  'hot',
  1e9
)
