import { memo } from 'react'
import ShaderPanel from '../ui/ShaderPanel'

const PLASMA_SHADER = `
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  vec3 getPaletteColor(int idx, float v, float ts) {
    if (idx == 0) {
      float h = mod(240.0 + sin(v) * 35.0 + ts * 35.0, 360.0) / 360.0;
      float s = 0.90;
      float l = 0.01 + abs(sin(v * 2.2)) * 0.48;
      return hsl2rgb(vec3(h, s, l));
    } else if (idx == 1) {
      float h = mod(abs(v) * 22.0 + ts * 35.0, 360.0) / 360.0;
      float s = 0.95;
      float l = 0.01 + abs(sin(v * 1.5)) * 0.52;
      return hsl2rgb(vec3(h, s, l));
    } else if (idx == 2) {
      float h = mod(120.0 + sin(v * 2.8) * 45.0 + ts * 35.0, 360.0) / 360.0;
      float s = 0.95;
      float l = 0.01 + abs(sin(v * 2.0)) * 0.48;
      return hsl2rgb(vec3(h, s, l));
    } else {
      float h = mod(180.0 + ts * 35.0, 360.0) / 360.0;
      float s = 0.85;
      float l = 0.01 + abs(sin(v * 3.2)) * 0.45;
      return hsl2rgb(vec3(h, s, l));
    }
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float ts = iTime;

    // Aspect-preserving virtual coords (siehe TUNNEL_SHADER in DemoScenes.tsx):
    // einheitlicher Skalenfaktor in beiden Achsen verhindert Verzerrung von
    // radialen Plasma-Mustern bei nicht-4:3-Panels.
    float originalW = min(iResolution.x, 480.0);
    float originalH = min(iResolution.y, 360.0);
    float scale = min(iResolution.x / originalW, iResolution.y / originalH);
    vec2 p = (fragCoord.xy - iResolution.xy * 0.5) / scale + vec2(originalW, originalH) * 0.5;

    float x = p.x;
    float y = p.y;

    float cx = x - originalW / 2.0;
    float cy = y - originalH / 2.0;
    float r = length(vec2(cx, cy));
    
    // Modi wechseln alle 10 Sekunden
    int mode = int(mod(ts / 10.0, 3.0));
    float v = 0.0;
    
    if (mode == 0) {
      // Klassisches Plasma: vier überlagerte Sinuswellen
      v = sin(x * 0.25 + ts * 1.3)
        + sin(y * 0.25 + ts * 0.9)
        + sin((x + y) * 0.18 + ts * 1.1)
        + sin(r * 0.35 + ts * 1.5);
    } else if (mode == 1) {
      // Tunnel-Spirale (Amiga-Klassiker)
      float a = atan(cy, cx);
      v = sin(r * 0.4 - ts * 2.2)
        + sin(a * 3.0 + ts * 1.2)
        + sin(r * 0.15 + a * 2.0 - ts * 0.8)
        + cos(r * 0.6 + ts * 0.7);
    } else {
      // Interference Grid — Moiré-Muster + rotierende Wellen
      v = sin(x * 0.3 + ts) * cos(y * 0.3 + ts * 1.4)
        + sin((x - y) * 0.25 + ts * 0.8)
        + cos(r * 0.3 - ts * 1.2)
        + sin(x * 0.1 + y * 0.1 + ts * 2.0);
    }
    
    // Paletten-Wechsel (alle 10 Sekunden) mit fließendem Crossfade
    float paletteCycle = ts / 10.0;
    int paletteIdx = int(mod(paletteCycle, 4.0));
    int nextIdx = int(mod(paletteCycle + 1.0, 4.0));
    float alpha = mod(paletteCycle, 1.0);
    
    vec3 colA = getPaletteColor(paletteIdx, v, ts);
    vec3 colB = getPaletteColor(nextIdx, v, ts);
    vec3 finalCol = mix(colA, colB, alpha);
    
    fragColor = vec4(finalCol, 1.0);
  }
`

function PlasmaDemo() {
  return (
    <ShaderPanel
      fragmentShader={PLASMA_SHADER}
      title="PLASMA CORE // RENDERING Ω"
      speedName="PlasmaDemo"
    />
  )
}

export default memo(PlasmaDemo)

