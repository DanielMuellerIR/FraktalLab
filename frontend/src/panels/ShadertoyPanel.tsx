import React from 'react'
import ShaderPanel from '../ui/ShaderPanel'

// ── Shader 1: Holographic Hacking Core ────────────────────────────────────────
const HACKING_CORE_SHADER = `
  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.8;
    
    // Rotate coordinate system for dynamic target sweeps
    float a = time * 0.1;
    float c = cos(a), s = sin(a);
    vec2 rotUv = uv * mat2(c, s, -s, c);
    
    vec3 col = vec3(0.0);
    
    // 1. Digital grid background
    float grid = step(0.97, fract(rotUv.x * 12.0)) + step(0.97, fract(rotUv.y * 12.0));
    col += vec3(0.0, 0.22, 0.1) * grid * exp(-length(uv) * 1.5);
    
    // 2. Raymarched Holographic Core
    float d = length(uv);
    float coreRadius = 0.22 + 0.015 * sin(time * 6.0);
    float coreGlow = exp(-abs(d - coreRadius) * 22.0);
    col += vec3(0.0, 1.0, 0.4) * coreGlow;
    
    // Pulsing inner sphere
    if (d < coreRadius) {
        float innerPulse = abs(sin(d * 40.0 - time * 8.0));
        col += vec3(0.0, 0.8, 0.3) * innerPulse * (1.0 - d / coreRadius);
    }
    
    // 3. Rotating Target Rings & Diagnostic Sweeps
    float ring1 = exp(-abs(d - 0.36) * 50.0);
    float ringAngle = atan(rotUv.y, rotUv.x);
    // Dashed ring
    if (sin(ringAngle * 8.0) > 0.0) {
        col += vec3(0.0, 0.85, 0.95) * ring1;
    }
    
    // Outer bracket ring
    float ring2 = exp(-abs(d - 0.42) * 60.0);
    if (cos(ringAngle * 3.0 + time * 1.5) > 0.5) {
        col += vec3(0.0, 0.7, 0.95) * ring2;
    }
    
    // Hacking sweep laser line
    float sweep = smoothstep(0.015, 0.0, abs(rotUv.x));
    col += vec3(0.0, 0.9, 0.3) * sweep * step(0.0, rotUv.y) * exp(-d * 2.0);
    
    // 4. Target lock crosshair brackets
    float cross = smoothstep(0.008, 0.0, abs(uv.x)) * step(abs(uv.y), 0.05) +
                  smoothstep(0.008, 0.0, abs(uv.y)) * step(abs(uv.x), 0.05);
    col += vec3(0.0, 1.0, 0.5) * cross * exp(-d * 4.0);
    
    // Add micro-noise and vignette
    col *= 0.5 + 0.5 * sin(fragCoord.y * 3.1415); // Scanlines
    col *= 1.0 - d * 0.8; // Vignette
    
    fragColor = vec4(col, 1.0);
  }
`

export const ShaderHackingCore = React.memo(function ShaderHackingCore() {
  return (
    <ShaderPanel
      fragmentShader={HACKING_CORE_SHADER}
      title="HOLOGRAPHIC HACKING CORE // SYSTEM FOCUS"
      attribution="Hacking Core by Antigravity (Shader-Upgrade)"
    />
  )
})

const MANDELBOX_SHADER = `
  precision highp float;

  float de(vec3 p) {
    vec3 w = p;
    float dr = 1.0;
    float s = 2.0;
    for (int i = 0; i < 6; i++) {
      w = clamp(w, -1.0, 1.0) * 2.0 - w;
      float r2 = dot(w, w);
      if (r2 < 0.5) {
        w *= 2.0;
        dr *= 2.0;
      } else if (r2 < 1.0) {
        float f = 1.0 / r2;
        w *= f;
        dr *= f;
      }
      w = w * s + p;
      dr = dr * abs(s) + 1.0;
    }
    return length(w) / abs(dr);
  }

  vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
      de(p + e.xyy) - de(p - e.xyy),
      de(p + e.yxy) - de(p - e.yxy),
      de(p + e.yyx) - de(p - e.yyx)
    ));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Smooth flying camera inside the fractal cavern
    float time = iTime * 0.22;
    vec3 ro = vec3(0.55 * sin(time * 0.7), 0.38 * cos(time * 0.5), 0.55 * sin(time * 0.9));
    vec3 target = vec3(0.55 * sin(time * 0.7 + 0.8), 0.38 * cos(time * 0.5 + 0.8), 0.55 * sin(time * 0.9 + 0.8));
    
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.1 * ww);
    
    // Camera roll
    float roll = sin(time * 0.4) * 0.25;
    float cr = cos(roll), sr = sin(roll);
    rd.xy = rd.xy * mat2(cr, -sr, sr, cr);

    float d = 0.0;
    float maxD = 4.5;
    float steps = 0.0;
    float glow = 0.0;
    
    for (int i = 0; i < 75; i++) {
      vec3 p = ro + rd * d;
      float dist = de(p);
      glow += exp(-dist * 18.0) * 0.09;
      if (dist < 0.0006 || d > maxD) break;
      d += dist * 0.75; // Safer step size inside the fractal
      steps += 1.0;
    }
    
    vec3 col = vec3(0.0);
    vec3 lightDir = normalize(vec3(1.0, 2.0, -1.5));
    
    if (d < maxD) {
      vec3 p = ro + rd * d;
      vec3 normal = getNormal(p);
      
      // Rich metallic colors
      vec3 matCol = vec3(1.0, 0.72, 0.22); // Core gold
      matCol = mix(matCol, vec3(0.95, 0.1, 0.55), smoothstep(-0.2, 0.8, sin(p.x * 6.0) * 0.5 + 0.5));
      
      float diffuse = max(0.0, dot(normal, lightDir));
      vec3 halfV = normalize(lightDir - rd);
      float spec = pow(max(0.0, dot(normal, halfV)), 18.0) * 0.95;
      
      // Ambient occlusion based on ray steps
      float ao = clamp(1.0 - steps / 75.0, 0.0, 1.0);
      
      col = matCol * (0.15 + 0.85 * diffuse) * ao + vec3(spec) * ao;
    }
    
    // Rich volumetric atmospheric colorful glows (cyan + purple/magenta)
    vec3 glowCol = mix(vec3(0.75, 0.08, 0.92), vec3(0.0, 0.95, 0.85), sin(time * 0.8 + d) * 0.5 + 0.5);
    col += glowCol * glow;
    
    // Atmospheric fog at distance
    col = mix(col, vec3(0.005, 0.01, 0.04), 1.0 - exp(-0.6 * d * d));
    
    // Scanlines and screen bloom
    col *= 0.94 + 0.06 * sin(fragCoord.y * 1.5);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;


export const ShaderMandelbox = React.memo(function ShaderMandelbox() {
  return (
    <ShaderPanel
      fragmentShader={MANDELBOX_SHADER}
      title="MANDELBOX EXPLORER // MATRIX ENGINE"
      attribution="Mandelbox by iq (mod)"
    />
  )
})

// ── Shader 3: Synthwave Sun ──────────────────────────────────────────────────
const RETRO_WAVE_SHADER = `
  precision highp float;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  float getTerrainHeight(vec2 p) {
    // Create a central valley corridor
    float valley = smoothstep(0.08, 0.85, abs(p.x));
    
    // Mountain peaks and ridges
    float hills1 = sin(p.x * 2.2) * cos(p.y * 1.1) * 0.2;
    float hills2 = noise(p * 4.5) * 0.08;
    float waves = sin(p.y * 3.5) * 0.045;
    float hills = hills1 + hills2 + waves;
    
    return valley * 0.42 + hills * valley;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.8;
    
    // Horizon line
    float horizon = -0.06;
    
    // 1. Sky Background (Purple-Blue Gradient + Twinkling Stars)
    vec3 col = mix(vec3(0.05, 0.01, 0.12), vec3(0.18, 0.02, 0.22), uv.y + 0.5);
    
    // Twinkling stars
    if (uv.y > horizon) {
      vec2 starUV = uv * 32.0;
      float sHash = hash(floor(starUV));
      if (sHash > 0.985) {
        float twinkle = sin(time * 3.5 + sHash * 6.28) * 0.5 + 0.5;
        col += vec3(twinkle * 0.9);
      }
    }
    
    // 2. The Outrun Sun
    vec2 sunPos = vec2(0.0, 0.16);
    float r = 0.26;
    float dist = length(uv - sunPos);
    if (dist < r && uv.y > horizon) {
      // Yellow to neon-pink gradient
      float grad = (uv.y - sunPos.y + r) / (2.0 * r);
      vec3 sunCol = mix(vec3(0.98, 0.22, 0.58), vec3(0.98, 0.92, 0.18), grad);
      
      // Slicing horizontal lines (wider at the bottom)
      float bar = fract(uv.y * 14.0 - time * 0.4);
      float threshold = 0.05 + 0.65 * (1.0 - (uv.y - horizon) / (2.0 * r));
      if (bar > threshold) {
        col = sunCol;
      }
    }
    
    // Sun Glow
    float sunGlow = exp(-dist * 4.2) * 0.38;
    col += vec3(0.98, 0.18, 0.58) * sunGlow;
    
    // 3. Raymarched Ground Terrain
    if (uv.y <= horizon) {
      vec3 ro = vec3(0.0, 0.22, time * 0.72);
      // Ray direction looking slightly down
      vec3 rd = normalize(vec3(uv.x, uv.y - 0.04, 0.65));
      
      float t_dist = 0.0;
      vec3 hitPos = vec3(0.0);
      bool hit = false;
      for (int i = 0; i < 75; i++) {
        vec3 p = ro + rd * t_dist;
        float h = getTerrainHeight(p.xz);
        if (p.y < h) {
          hitPos = p;
          hit = true;
          break;
        }
        t_dist += 0.038 + t_dist * 0.016;
      }
      
      if (hit) {
        // Constant world-space grid thickness to prevent lines from expanding and merging in the distance
        float thick = 0.016;
        float blur = 0.008;
        float gx = 1.0 - smoothstep(thick - blur, thick + blur, min(fract(hitPos.x * 5.0), 1.0 - fract(hitPos.x * 5.0)));
        float gz = 1.0 - smoothstep(thick - blur, thick + blur, min(fract(hitPos.z * 5.0), 1.0 - fract(hitPos.z * 5.0)));
        float grid = max(gx, gz);
        
        // Blue grid over dark purple terrain
        vec3 baseCol = vec3(0.02, 0.0, 0.06);
        vec3 gridCol = vec3(0.0, 0.68, 0.98); // Neon blue grid lines
        
        // Pink mountain reflection glow
        float peakGlow = smoothstep(0.05, 0.38, hitPos.y);
        baseCol += vec3(0.92, 0.1, 0.58) * peakGlow * 0.42;
        
        vec3 terrainCol = mix(baseCol, gridCol, grid);
        
        // Distance fog
        float fog = clamp(t_dist / 6.2, 0.0, 1.0);
        col = mix(terrainCol, vec3(0.18, 0.02, 0.22), fog);
      } else {
        col = vec3(0.18, 0.02, 0.22); // Sky horizon fog
      }
    }
    
    // Horizon Glow Line
    float horizGlow = exp(-abs(uv.y - horizon) * 16.0);
    col += vec3(0.95, 0.18, 0.55) * horizGlow * 0.52;
    
    // Scanlines and screen vignette
    col *= 0.94 + 0.06 * sin(fragCoord.y * 1.5);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const ShaderRetroWave = React.memo(function ShaderRetroWave() {
  return (
    <ShaderPanel
      fragmentShader={RETRO_WAVE_SHADER}
      title="SYNTHWAVE SUN // CORE VIBRATIONS"
      attribution="Outrun Sun by FabriceNeyret2 (mod)"
    />
  )
})
