import { memo } from 'react'
import FractalGL from '../components/FractalGL'

// Interessante Mandelbrot-Koordinaten — werden zyklisch durchgezoomt.
// (Übernommen aus dem früheren WASM-FractalCanvas; GPU-Renderer seit Befund B-4.)
const LOCATIONS = [
  { cx: -0.7269,  cy:  0.1889  },  // Seahorse Valley
  { cx: -0.5436,  cy:  0.6317  },  // Triple Spiral
  { cx:  0.3600,  cy:  0.1000  },  // Right Bulb Spirals
  { cx: -0.7453,  cy:  0.1127  },  // Seahorse Satellite
  { cx: -0.1080,  cy:  0.9249  },  // Elephant Valley
  { cx: -0.0630,  cy:  0.6748  },  // Lightning Fork
  { cx: -0.7390,  cy:  0.1660  },  // Inner Seahorse
  { cx: -1.2560,  cy:  0.3818  },  // Satellite Bulb
]

// FractalView füllt den verfügbaren Platz vollständig (flex-1 min-h-0).
// Kein festes Aspect-Ratio — der Canvas passt sich per CSS an den Container an.
export default memo(function FractalView() {
  return (
    <div className="border border-green-900 bg-black flex flex-col overflow-hidden flex-1 min-h-0 h-full">
      <div className="border-b border-green-900 px-2 py-0.5 flex items-center gap-2 shrink-0">
        <span className="text-green-800 text-xs">■</span>
        <span className="font-mono text-xs text-green-600 uppercase tracking-widest">
          NEURAL FRACTAL DIMENSION — TARGET VISUALISER
        </span>
        <span className="ml-auto text-red-900 text-xs animate-pulse">● LIVE</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <FractalGL
          mode="mandelbrot"
          locations={LOCATIONS}
          maxIter={128}
          zoomMax={1.5e6}
          rotateRate={0}
          fadeZoomCeil={1.5e5}
          zoomRate={0.6}
        />
      </div>
    </div>
  )
})
