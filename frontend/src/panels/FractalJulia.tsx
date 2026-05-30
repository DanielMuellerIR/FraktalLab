import { memo } from 'react'
import Panel from '../ui/Panel'
import FractalGL from '../components/FractalGL'

// 6 klassische Julia-Parametersätze. FractalGL wechselt sie zyklisch per Crossfade
// durch (mit HUD-Label). Seit Audit-Befund B-4 läuft das Rendering auf der GPU
// statt pixelweise in WASM (vgl. Git-History für die alte Variante).
const JULIA_PARAMS = [
  { cx: -0.7,    cy:  0.27015, label: 'DENDRITE'  },
  { cx:  0.285,  cy:  0.01,    label: 'DRAGON'    },
  { cx: -0.4,    cy:  0.6,     label: 'SPIRAL'    },
  { cx:  0.45,   cy:  0.1428,  label: 'RABBIT'    },
  { cx: -0.8,    cy:  0.156,   label: 'SEAHORSE'  },
  { cx:  0.285,  cy:  0.013,   label: 'SNOWFLAKE' },
]

export default memo(function FractalJulia() {
  return (
    <Panel title="GPU FRACTAL JULIA // RECURSIVE LATENT ENGINE">
      <FractalGL
        mode="julia"
        locations={[{ cx: 0, cy: 0 }]}
        juliaSet={JULIA_PARAMS}
        maxIter={250}
        zoomMax={1.5e10}
        hud
      />
    </Panel>
  )
})
