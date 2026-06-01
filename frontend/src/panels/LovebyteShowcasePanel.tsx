import React, { useEffect, useState } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'
import { getRandomPaletteName, getPaletteUniforms, PALETTES } from '../utils/palettes'

const FORMULAS = [
  {
    name: 'MOIRE CIRCLES // 256B',
    expr: 'sin(d*150.-t*10.)*sin(a*20.+t*2.)',
    shader: `
      uniform vec3 uPalA;
      uniform vec3 uPalB;
      uniform vec3 uPalC;
      uniform vec3 uPalD;

      vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
        return a + b * cos(6.283185 * (c * t + d));
      }

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
        float d = length(uv);
        float a = atan(uv.y, uv.x);
        float c = sin(d * 150.0 - iTime * 10.0) * sin(a * 20.0 + iTime * 2.0);
        vec3 col = palette(c * 0.5 + 0.5 + iTime * 0.15, uPalA, uPalB, uPalC, uPalD);
        fragColor = vec4(col, 1.0);
      }
    `
  },
  {
    name: 'IFS FRACTAL SPARKS // 256B',
    expr: 'uv = abs(uv)/(dot(uv,uv)+0.0001) - c',
    shader: `
      uniform vec3 uPalA;
      uniform vec3 uPalB;
      uniform vec3 uPalC;
      uniform vec3 uPalD;

      vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
        return a + b * cos(6.283185 * (c * t + d));
      }

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
        float time = iTime * 0.4;
        float col = 0.0;
        for(int i = 0; i < 4; i++) {
            // Added 0.0001 epsilon to prevent division by zero in the center of the screen
            uv = abs(uv) / (dot(uv, uv) + 0.0001) - vec2(0.62 + 0.08 * sin(time), 0.32 + 0.08 * cos(time));
            col += exp(-length(uv) * 4.2);
        }
        vec3 finalCol = palette(col * 0.15 + iTime * 0.1, uPalA, uPalB, uPalC, uPalD);
        fragColor = vec4(finalCol, 1.0);
      }
    `
  },
  {
    name: 'SINE PLASMA WAVE // 256B',
    expr: 'c = sin(x*10.+t) + sin(y*10.+t)',
    shader: `
      uniform vec3 uPalA;
      uniform vec3 uPalB;
      uniform vec3 uPalC;
      uniform vec3 uPalD;

      vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
        return a + b * cos(6.283185 * (c * t + d));
      }

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = fragCoord.xy / iResolution.xy;
        float c = sin(uv.x * 10.0 + iTime) + sin(uv.y * 10.0 + iTime) + sin((uv.x + uv.y) * 10.0 + sin(iTime));
        c = sin(c * 2.2);
        vec3 col = palette(c * 0.5 + 0.5 + iTime * 0.1, uPalA, uPalB, uPalC, uPalD);
        fragColor = vec4(col, 1.0);
      }
    `
  }
]

export const LovebyteShowcasePanel = React.memo(function LovebyteShowcasePanel() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [paletteName, setPaletteName] = useState(() => getRandomPaletteName())

  // Rotate formulas and palettes every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((curr) => (curr + 1) % FORMULAS.length)
      setPaletteName(getRandomPaletteName())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const active = FORMULAS[activeIdx]
  const uniforms = getPaletteUniforms(paletteName)
  const currentPalette = PALETTES[paletteName] || PALETTES.vapor

  return (
    <Panel
      // Hinweis: rightLabel (Formel) bewusst NICHT mehr setzen — die Formel
      // erscheint jetzt in der unteren Pille (siehe weiter unten), nicht in der
      // oberen Titel-Pille. So gibt es keine Doppelung.
      title={`LOVEBYTE COMP // ${active.name} [PAL: ${currentPalette.name.toUpperCase()}]`}
    >
      <div className="w-full h-full relative bg-black">
        {/* Use key={activeIdx} to force a clean context/shader recreation
            attribution NICHT mehr an ShaderPanel geben — der Credit steht jetzt
            in der unteren Pille (zweite Zeile), damit es nicht doppelt erscheint. */}
        <ShaderPanel
          key={activeIdx}
          fragmentShader={active.shader}
          uniforms={uniforms}
          title="" // Hide title since Panel title handles it
          noPanel={true}
          speedName="LovebyteShowcasePanel"
        />

        {/* Hacker styling overlay */}
        <div className="absolute top-2 left-2 text-[8px] font-mono text-green-700/50 uppercase select-none pointer-events-none">
          SIZE: &lt;256 BYTES // PLATFORM: GLSL ES 1.0 // MODE: COMPACT
        </div>

        {/* Untere Pille: Shader-Formel + Copyright/Credit, analog zur oberen
            Titel-Pille, aber am UNTEREN Rand zentriert. Zweizeilig:
              Zeile 1 = Formel (Monospace, weil es Code ist)
              Zeile 2 = Copyright/Credit
            Stil wie die Titel-Pille (dunkel, abgerundet, dünner grüner Rand).
            Schrift skaliert container-relativ (cqmin) — der container-type liegt
            am PanelSlot-Wrapper. Lange Formeln werden je Zeile auf eine Zeile
            geklemmt (line-clamp-1 + break-all), damit die Pille kompakt bleibt. */}
        <div
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2 z-20 max-w-[92%]
                     rounded bg-black/70 backdrop-blur-sm border border-green-800/50
                     text-green-300 select-none pointer-events-none text-center"
          style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 'clamp(7px, 3.6cqmin, 11px)',
            padding: '1px 6px',
          }}
        >
          {/* Zeile 1: die Formel selbst — Monospace, einzeilig geklemmt */}
          <div className="font-mono text-green-200 leading-tight break-all line-clamp-1">
            {active.expr}
          </div>
          {/* Zeile 2: Copyright/Credit — etwas gedämpfter, einzeilig geklemmt */}
          <div className="text-green-500/80 leading-tight break-all line-clamp-1">
            256B Sizecoding Showcase (Palette-Rework)
          </div>
        </div>
      </div>
    </Panel>
  )
})

