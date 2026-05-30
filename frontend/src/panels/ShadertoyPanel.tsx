import React from 'react'
import ShaderPanel from '../ui/ShaderPanel'

// ── Shader 1: Holographic Hacking Core ────────────────────────────────────────
const HACKING_CORE_SHADER = `
  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.8;
    
    vec3 baseCol = vec3(1.0, 0.55, 0.1);
    vec3 accentCol = vec3(1.0, 0.8, 0.3);
    vec3 warningCol = vec3(0.9, 0.15, 0.05);
    
    vec3 col = vec3(0.0);
    
    vec2 gridUv = uv * 35.0;
    float grid = step(0.95, fract(gridUv.x)) * step(0.95, fract(gridUv.y));
    col += baseCol * grid * 0.08 * exp(-length(uv) * 1.2);
    
    float d = length(uv);
    float angle = atan(uv.y, uv.x);
    
    float coreRadius = 0.18 + 0.008 * sin(time * 5.0);
    float coreGlow = exp(-abs(d - coreRadius) * 28.0);
    col += baseCol * coreGlow * 1.5;
    
    if (d < coreRadius) {
        float pattern = abs(sin(d * 80.0 - time * 6.0));
        float sectors = step(0.15, fract(angle * 4.0 / 3.14159));
        col += accentCol * pattern * sectors * (1.0 - d / coreRadius) * 0.6;
    }
    
    float ring1 = exp(-abs(d - 0.28) * 60.0);
    float select1 = step(0.35, sin(angle * 6.0 + time * 2.2));
    col += baseCol * ring1 * select1 * 0.9;
    
    float ring2 = exp(-abs(d - 0.35) * 80.0);
    float nodeAngle = angle - time * 0.8;
    float nodeSelect = step(0.85, cos(nodeAngle * 8.0));
    col += mix(baseCol * 0.5, accentCol * 2.2, nodeSelect) * ring2;
    
    float ring3 = exp(-abs(d - 0.42) * 50.0);
    float arcSelect = step(-0.2, sin(angle * 3.0 - time * 1.2));
    col += baseCol * ring3 * arcSelect * 0.7;
    
    float targetLine = smoothstep(0.006, 0.0, abs(uv.x)) * step(abs(uv.y), 0.06) +
                       smoothstep(0.006, 0.0, abs(uv.y)) * step(abs(uv.x), 0.06);
    col += accentCol * targetLine * exp(-d * 3.0);
    
    float border = exp(-abs(d - 0.48) * 120.0);
    col += baseCol * border * 0.8;
    
    float sweepAngle = time * 1.5;
    vec2 sweepDir = vec2(cos(sweepAngle), sin(sweepAngle));
    float distToSweep = length(uv - sweepDir * clamp(dot(uv, sweepDir), 0.0, 0.48));
    float sweepGlow = exp(-distToSweep * 45.0) * step(0.0, dot(uv, sweepDir));
    col += accentCol * sweepGlow * 0.45;
    
    float warnNode = step(0.96, cos(angle - 1.2)) * step(0.92, sin(time * 4.0));
    float ring4 = exp(-abs(d - 0.45) * 70.0);
    col += warningCol * ring4 * warnNode * 2.0;
    
    col *= 0.9 + 0.1 * sin(fragCoord.y * 2.2);
    col *= 1.0 - d * 0.65;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const ShaderHackingCore = React.memo(function ShaderHackingCore() {
  return (
    <ShaderPanel
      fragmentShader={HACKING_CORE_SHADER}
      title="HOLOGRAPHIC HACKING CORE // AMBER INTERFACE"
      attribution="Hacking Core by Antigravity (Mass Effect Style)"
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
    
    float time = iTime * 0.22;
    vec3 ro = vec3(0.55 * sin(time * 0.7), 0.38 * cos(time * 0.5), 0.55 * sin(time * 0.9));
    vec3 target = vec3(0.55 * sin(time * 0.7 + 0.8), 0.38 * cos(time * 0.5 + 0.8), 0.55 * sin(time * 0.9 + 0.8));
    
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.1 * ww);
    
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
      d += dist * 0.75;
      steps += 1.0;
    }
    
    vec3 col = vec3(0.0);
    vec3 lightDir = normalize(vec3(1.0, 2.0, -1.5));
    
    if (d < maxD) {
      vec3 p = ro + rd * d;
      vec3 normal = getNormal(p);
      
      vec3 matCol = vec3(1.0, 0.72, 0.22);
      matCol = mix(matCol, vec3(0.95, 0.1, 0.55), smoothstep(-0.2, 0.8, sin(p.x * 6.0) * 0.5 + 0.5));
      
      float diffuse = max(0.0, dot(normal, lightDir));
      vec3 halfV = normalize(lightDir - rd);
      float spec = pow(max(0.0, dot(normal, halfV)), 18.0) * 0.95;
      
      float ao = clamp(1.0 - steps / 75.0, 0.0, 1.0);
      
      col = matCol * (0.15 + 0.85 * diffuse) * ao + vec3(spec) * ao;
    }
    
    vec3 glowCol = mix(vec3(0.75, 0.08, 0.92), vec3(0.0, 0.95, 0.85), sin(time * 0.8 + d) * 0.5 + 0.5);
    col += glowCol * glow;
    
    col = mix(col, vec3(0.005, 0.01, 0.04), 1.0 - exp(-0.6 * d * d));
    
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

  // Complex Voxel Terrain Height function
  float getVoxelHeight(vec2 p) {
    // Voxelized coordinate resolution: 10.0 cells per unit
    vec2 cell = floor(p * 10.0) / 10.0;
    
    // Flat central valley for the synthwave grid highway
    float valley = smoothstep(0.15, 0.75, abs(cell.x));
    
    // Complex mountain ridges on both sides
    float h1 = sin(cell.x * 1.8) * cos(cell.y * 0.9) * 0.38;
    float h2 = noise(cell * 3.8) * 0.15;
    float h3 = noise(cell * 8.0) * 0.06; // high-frequency peaks
    
    return valley * (0.52 + h1 + h2 + h3);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.85;
    float horizon = -0.05;
    
    // 1. Premium Retro Sky: Dark purple space to glowing pink horizon
    vec3 skyCol = mix(vec3(0.02, 0.005, 0.08), vec3(0.82, 0.02, 0.45), uv.y + 0.42);
    vec3 col = skyCol;
    
    // 2. High-Fidelity Sub-Pixel Twinkling Stars (No Chunky Blobs)
    if (uv.y > horizon + 0.015) {
      vec2 starGrid = fract(uv * 28.0) - 0.5;
      vec2 cellId = floor(uv * 28.0);
      float sHash = hash(cellId);
      if (sHash > 0.986) {
        float twinkle = sin(time * 2.8 + sHash * 6.28) * 0.45 + 0.55;
        float starSize = 0.02 * sHash;
        float starVal = smoothstep(starSize, 0.0, length(starGrid));
        col += vec3(0.96, 0.92, 1.0) * starVal * twinkle * 0.95;
      }
    }
    
    // 3. Iconic Retro Synthwave Sun with Smooth Anti-Aliased Cuts
    vec2 sunPos = vec2(0.0, 0.16);
    float r = 0.28;
    float dist = length(uv - sunPos);
    if (dist < r && uv.y > horizon + 0.002) {
      float grad = (uv.y - sunPos.y + r) / (2.0 * r);
      vec3 sunCol = mix(vec3(0.96, 0.02, 0.52), vec3(0.96, 0.88, 0.08), grad);
      
      // Horizontal slices moving downward
      float barWidth = 15.0;
      float barPhase = uv.y * barWidth - time * 0.38;
      float barFract = fract(barPhase);
      
      // Width of horizontal cuts thickens towards bottom
      float cutoff = 0.06 + 0.65 * (1.0 - (uv.y - horizon) / (2.0 * r));
      float sunLine = smoothstep(cutoff - 0.015, cutoff + 0.015, barFract);
      
      // Anti-aliased boundary cut
      float sunMask = 1.0 - smoothstep(r - 0.008, r, dist);
      col = mix(col, sunCol, sunLine * sunMask);
    }
    
    // Sun outer glow
    float sunGlow = exp(-dist * 5.5) * 0.38;
    col += vec3(0.96, 0.02, 0.52) * sunGlow;
    
    // 4. Raymarching Voxel Terrain Ground
    float t_dist = -1.0;
    vec3 hitPos = vec3(0.0);
    bool hit = false;
    
    // Camera moves forward at constant speed
    float speed = 1.6;
    vec3 ro = vec3(0.0, 0.48, time * speed);
    
    // Ray direction (perserving aspect ratio)
    vec3 rd = normalize(vec3(uv.x, uv.y - horizon, 0.72));

    if (uv.y <= horizon) {
      t_dist = 0.0;
      float t_prev = 0.0;
      
      for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t_dist;
        float h = getVoxelHeight(p.xz);
        
        if (p.y < h) {
          // Precise step refinement via binary search
          float t_min = t_prev;
          float t_max = t_dist;
          for (int j = 0; j < 5; j++) {
            float t_mid = (t_min + t_max) * 0.5;
            vec3 midPos = ro + rd * t_mid;
            if (midPos.y < getVoxelHeight(midPos.xz)) {
              t_max = t_mid;
            } else {
              t_min = t_mid;
            }
          }
          hitPos = ro + rd * t_max;
          hit = true;
          break;
        }
        t_prev = t_dist;
        // Step size accelerates to cover deep distance to the horizon
        t_dist += 0.038 + t_dist * 0.012;
      }
      
      if (hit) {
        // 5. Infinite Thin Sharp Grid Lines tapering into horizon
        // Draw grid lines on voxel cell boundaries (spaced 0.1 units apart)
        vec2 gridPos = hitPos.xz * 10.0;
        vec2 distToEdge = abs(fract(gridPos - 0.5) - 0.5);
        
        // Dynamic screen-space line thickness based on distance to prevent aliasing
        float thickness = 0.018 + t_dist * 0.0028;
        float lineX = smoothstep(thickness, thickness - 0.002, distToEdge.x);
        float lineZ = smoothstep(thickness, thickness - 0.002, distToEdge.y);
        float grid = max(lineX, lineZ);
        
        // Premium desaturated/neon color shading
        float heightVal = smoothstep(0.05, 0.48, hitPos.y);
        
        // Deep indigo/magenta ground base
        vec3 baseCol = mix(vec3(0.02, 0.005, 0.06), vec3(0.85, 0.02, 0.48), heightVal * 0.45);
        
        // Bright neon cyan wireframe grid
        vec3 gridCol = vec3(0.0, 0.88, 1.0);
        
        // Merge grid and base
        vec3 terrainCol = mix(baseCol, gridCol, grid * 0.9);
        
        // Horizon Fog: Fades ground completely into glowing purple at horizon
        float fog = clamp(t_dist / 6.5, 0.0, 1.0);
        col = mix(terrainCol, vec3(0.18, 0.01, 0.22), fog);
      } else {
        col = vec3(0.18, 0.01, 0.22);
      }
    }
    
    // 6. Horizon Neon Glow
    float horizGlow = exp(-abs(uv.y - horizon) * 18.0);
    col += vec3(0.92, 0.02, 0.52) * horizGlow * 0.52;
    
    // Scanlines & Vignette overlay for retro CRT/VHS feel
    col *= 0.94 + 0.06 * sin(fragCoord.y * 1.8);
    col *= 1.0 - length(uv) * 0.42;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const ShaderRetroWave = React.memo(function ShaderRetroWave() {
  return (
    <ShaderPanel
      fragmentShader={RETRO_WAVE_SHADER}
      title="RETRO OUTRUN // HORIZON SCAN"
      attribution="Outrun Landscape by Antigravity"
    />
  )
})
