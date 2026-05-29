import React, { useEffect, useState } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'

const FORMULAS = [
  {
    name: 'MOIRE CIRCLES // 256B',
    expr: 'sin(d*150.-t*10.)*sin(a*20.+t*2.)',
    shader: `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
        float d = length(uv);
        float a = atan(uv.y, uv.x);
        float c = sin(d * 150.0 - iTime * 10.0) * sin(a * 20.0 + iTime * 2.0);
        fragColor = vec4(0.0, c > 0.0 ? 0.95 : 0.05, 0.0, 1.0);
      }
    `
  },
  {
    name: 'IFS FRACTAL SPARKS // 256B',
    expr: 'uv = abs(uv)/dot(uv,uv) - c',
    shader: `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
        float time = iTime * 0.4;
        float col = 0.0;
        for(int i = 0; i < 4; i++) {
            uv = abs(uv) / dot(uv, uv) - vec2(0.62 + 0.08 * sin(time), 0.32 + 0.08 * cos(time));
            col += exp(-length(uv) * 4.2);
        }
        fragColor = vec4(0.0, col * 0.28, col * 0.16, 1.0);
      }
    `
  },
  {
    name: 'SINE PLASMA WAVE // 256B',
    expr: 'c = sin(x*10.+t) + sin(y*10.+t)',
    shader: `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = fragCoord.xy / iResolution.xy;
        float c = sin(uv.x * 10.0 + iTime) + sin(uv.y * 10.0 + iTime) + sin((uv.x + uv.y) * 10.0 + sin(iTime));
        c = sin(c * 2.2);
        fragColor = vec4(0.0, abs(c) * 0.9, abs(c) * 0.45, 1.0);
      }
    `
  }
]

export const LovebyteShowcasePanel = React.memo(function LovebyteShowcasePanel() {
  const [activeIdx, setActiveIdx] = useState(0)

  // Rotate formulas every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((curr) => (curr + 1) % FORMULAS.length)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const active = FORMULAS[activeIdx]

  return (
    <Panel
      title={`LOVEBYTE COMP // ${active.name}`}
      rightLabel={active.expr}
    >
      <div className="w-full h-full relative bg-black">
        <ShaderPanel
          fragmentShader={active.shader}
          title="" // Hide title since Panel title handles it
          attribution="256B Sizecoding Showcase (eigene Effekte)"
          noPanel={true}
        />
        
        {/* Hacker styling overlay */}
        <div className="absolute top-2 left-2 text-[8px] font-mono text-green-700/50 uppercase select-none pointer-events-none">
          SIZE: &lt;256 BYTES // PLATFORM: GLSL ES 1.0 // MODE: COMPACT
        </div>
      </div>
    </Panel>
  )
})
