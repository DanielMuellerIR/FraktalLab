import React, { useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import { getRandomPaletteName, getPaletteUniforms, PALETTES } from '../utils/palettes'

// ── Shader 1: Polynomial Smooth Minimum SDF Metaballs ───────────────────────
const SMOOTH_MIN_SHADER = `
  uniform vec3 uPalA;
  uniform vec3 uPalB;
  uniform vec3 uPalC;
  uniform vec3 uPalD;

  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.283185 * (c * t + d));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 1.4;
    
    vec2 p1 = vec2(sin(time * 0.85) * 0.35, cos(time * 1.1) * 0.22);
    vec2 p2 = vec2(cos(time * 1.25) * 0.45, sin(time * 0.95) * 0.32);
    vec2 p3 = vec2(sin(time * 0.6) * 0.25, sin(time * 1.35) * 0.25);
    
    float d1 = length(uv - p1) - 0.16;
    float d2 = length(uv - p2) - 0.13;
    float d3 = length(uv - p3) - 0.19;
    
    // Polynomial smooth minimum (IQ technique)
    float k = 0.13;
    float h1 = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    float d = mix(d2, d1, h1) - k * h1 * (1.0 - h1);
    
    float h2 = clamp(0.5 + 0.5 * (d3 - d) / k, 0.0, 1.0);
    d = mix(d3, d, h2) - k * h2 * (1.0 - h2);
    
    // Draw neon outline glow
    float glow = 0.016 / (abs(d) + 0.004);
    
    // Palette colored glow shifting slowly over time
    vec3 col = palette(glow * 0.15 + iTime * 0.18, uPalA, uPalB, uPalC, uPalD) * glow * 1.4;
    
    // Draw matrix dots inside the blobs
    if (d < 0.0) {
        float dots = sin(uv.x * 65.0) * sin(uv.y * 65.0);
        float dotIntensity = smoothstep(0.72, 1.0, dots) * 0.38;
        col += palette(dots * 0.2 - iTime * 0.1, uPalA, uPalB, uPalC, uPalD) * dotIntensity;
    }
    
    fragColor = vec4(col, 1.0);
  }
`

export const IQSmoothMin = React.memo(function IQSmoothMin() {
  const [paletteName] = useState(() => getRandomPaletteName())
  const uniforms = getPaletteUniforms(paletteName)
  const currentPalette = PALETTES[paletteName] || PALETTES.vapor

  return (
    <ShaderPanel
      fragmentShader={SMOOTH_MIN_SHADER}
      uniforms={uniforms}
      title={`SDF METABALLS // POLY-SMOOTHMIN [PAL: ${currentPalette.name.toUpperCase()}]`}
      attribution="Smooth Minimum SDF by Inigo Quilez (Palette-Rework)"
    />
  )
})

// ── Shader 2: Fractional Brownian Motion Digital Storm ──────────────────────
const DIGITAL_STORM_SHADER = `
  uniform vec3 uPalA;
  uniform vec3 uPalB;
  uniform vec3 uPalC;
  uniform vec3 uPalD;

  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.283185 * (c * t + d));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    float time = iTime * 0.75;
    
    vec2 q = vec2(
        fbm(uv * 3.5 + vec2(0.0, time * 0.08)),
        fbm(uv * 3.5 + vec2(time * 0.12, 0.0))
    );
    
    vec2 r = vec2(
        fbm(uv * 4.5 + q * 1.8 + vec2(0.0, time * 0.18)),
        fbm(uv * 4.5 + q * 1.4 + vec2(time * 0.08, 0.0))
    );
    
    float f = fbm(uv * 5.5 + r * 2.8);
    
    // Map fractal storm values to selected dynamic palette
    vec3 col = palette(f * 0.45 + length(q) * 0.22 + time * 0.06, uPalA, uPalB, uPalC, uPalD);
    
    // Boost contrast & apply shading
    col *= (f * 1.45);
    col *= 0.93 + 0.07 * sin(fragCoord.y * 1.4);
    
    fragColor = vec4(col, 1.0);
  }
`

export const IQDigitalStorm = React.memo(function IQDigitalStorm() {
  const [paletteName] = useState(() => getRandomPaletteName())
  const uniforms = getPaletteUniforms(paletteName)
  const currentPalette = PALETTES[paletteName] || PALETTES.vapor

  return (
    <ShaderPanel
      fragmentShader={DIGITAL_STORM_SHADER}
      uniforms={uniforms}
      title={`NEURAL FBM DIGITAL STORM [PAL: ${currentPalette.name.toUpperCase()}]`}
      attribution="FBM Digital Storm by Inigo Quilez (Palette-Rework)"
      speedName="IQDigitalStorm"
    />
  )
})

