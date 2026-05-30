import React from 'react'
import ShaderPanel from '../ui/ShaderPanel'

// ── Shader 1: Holographic Hacking Core ────────────────────────────────────────
const HACKING_CORE_SHADER = `
  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.9;
    
    vec3 baseCol = vec3(1.0, 0.50, 0.08);    // Amber
    vec3 accentCol = vec3(1.0, 0.85, 0.2);   // Light Amber
    vec3 warningCol = vec3(1.0, 0.15, 0.05);  // Alert Red
    vec3 passCol = vec3(0.05, 0.95, 0.45);    // Success Green
    
    vec3 col = vec3(0.0);
    
    // Background matrix/hex grid
    vec2 gridUv = uv * 30.0;
    float grid = step(0.96, fract(gridUv.x)) * step(0.96, fract(gridUv.y));
    col += baseCol * grid * 0.05 * exp(-length(uv) * 1.5);
    
    float d = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // 1. Center Core (Hexagonal or Circular interface)
    float coreRadius = 0.14 + 0.005 * sin(time * 6.0);
    float coreGlow = exp(-abs(d - coreRadius) * 35.0);
    col += baseCol * coreGlow * 1.2;
    
    if (d < coreRadius) {
      // Rotating data segments inside core
      float sectors = step(0.12, fract(angle * 6.0 / 6.28318 + time * 0.5));
      float ringInside = step(0.08, d) * (1.0 - step(coreRadius - 0.015, d));
      col += accentCol * sectors * ringInside * 0.6;
      
      // Success lock blinking inside core
      float lockPulse = step(0.5, sin(time * 5.0)) * step(d, 0.06);
      col += passCol * lockPulse * 0.8;
    }
    
    // 2. Concentric Hacking Rings with gaps
    // Ring 1 (Inner: radius 0.22)
    float ring1 = exp(-abs(d - 0.22) * 90.0);
    float seg1 = step(0.35, fract(angle * 4.0 / 6.28318 + time * 0.4));
    col += baseCol * ring1 * seg1 * 1.1;
    
    // Ring 2 (Middle: radius 0.32)
    float ring2 = exp(-abs(d - 0.32) * 90.0);
    float seg2 = step(0.28, fract(angle * 6.0 / 6.28318 - time * 0.6));
    col += baseCol * ring2 * seg2 * 1.1;
    
    // Ring 3 (Outer: radius 0.42)
    float ring3 = exp(-abs(d - 0.42) * 90.0);
    float seg3 = step(0.4, fract(angle * 8.0 / 6.28318 + time * 0.3));
    col += baseCol * ring3 * seg3 * 1.1;

    // 3. Bypass Nodes (Pair-matching nodes on the middle ring)
    // We define 6 nodes at fixed angular steps on Ring 2
    for (int i = 0; i < 6; i++) {
      float nodeAng = float(i) * (6.28318 / 6.0) + sin(time * 0.2) * 0.1;
      vec2 nodePos = vec2(cos(nodeAng), sin(nodeAng)) * 0.32;
      float distToNode = length(uv - nodePos);
      
      // Draw outer circle for node
      float nodeRing = exp(-abs(distToNode - 0.018) * 150.0);
      col += accentCol * nodeRing * 0.8;
      
      // Inner glowing core
      float nodeCore = exp(-distToNode * 160.0);
      // Highlight matching pairs using colors or pulsing
      vec3 nodeCol = (i == 1 || i == 4) ? passCol : ((i == 2 || i == 5) ? warningCol : baseCol);
      float pulse = 0.6 + 0.4 * sin(time * 8.0 + float(i));
      col += nodeCol * nodeCore * pulse * 2.0;
      
      // Draw connecting bypass lines between matched pairs
      if (i < 3) {
        float nextAng = float(i + 3) * (6.28318 / 6.0) + sin(time * 0.2) * 0.1;
        vec2 nextNodePos = vec2(cos(nextAng), sin(nextAng)) * 0.32;
        
        // Distance from pixel uv to the segment line linking nodePos and nextNodePos
        vec2 lineDir = nextNodePos - nodePos;
        float lineLen = length(lineDir);
        vec2 lineNorm = lineDir / lineLen;
        vec2 relUv = uv - nodePos;
        float proj = dot(relUv, lineNorm);
        float distToLine = length(relUv - lineNorm * clamp(proj, 0.0, lineLen));
        
        if (distToLine < 0.003 && proj > 0.0 && proj < lineLen) {
          float flow = step(0.9, fract(proj * 20.0 - time * 8.0));
          col += nodeCol * (0.15 + 0.45 * flow) * exp(-distToLine * 40.0);
        }
      }
    }
    
    // 4. Sweeping bypass scanner line
    float sweepAngle = time * 1.6;
    vec2 sweepDir = vec2(cos(sweepAngle), sin(sweepAngle));
    float distToSweep = length(uv - sweepDir * clamp(dot(uv, sweepDir), 0.0, 0.48));
    float sweepGlow = exp(-distToSweep * 65.0) * step(0.0, dot(uv, sweepDir));
    col += baseCol * sweepGlow * 0.55;
    
    // Sweeper beam head/spark
    vec2 beamHead = sweepDir * 0.44;
    float headSpark = exp(-length(uv - beamHead) * 90.0);
    col += accentCol * headSpark * 1.5;
    
    // 5. Border overlay & Reticle
    float border = exp(-abs(d - 0.48) * 160.0);
    col += baseCol * border * 0.8;
    
    float tick = step(0.985, cos(angle * 48.0)) * step(0.46, d) * (1.0 - step(0.48, d));
    col += accentCol * tick * 0.6;
    
    // CRT Scan lines
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

  // Smooth continuous terrain — NO floor() quantization
  float getTerrainHeight(vec2 p) {
    // Flat central valley for the synthwave highway
    float valley = smoothstep(0.12, 0.80, abs(p.x));

    // Layered smooth noise ridges
    float h1 = sin(p.x * 1.8) * cos(p.y * 0.9) * 0.38;
    float h2 = noise(p * 3.8) * 0.15;
    float h3 = noise(p * 8.0) * 0.06;
    float h4 = noise(p * 16.0) * 0.025; // fine detail

    return valley * (0.50 + h1 + h2 + h3 + h4);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.85;
    float horizon = -0.05;

    // Sky gradient
    vec3 skyCol = mix(vec3(0.02, 0.005, 0.08), vec3(0.82, 0.02, 0.45), uv.y + 0.42);
    vec3 col = skyCol;

    // Stars
    if (uv.y > horizon + 0.015) {
      vec2 starGrid = fract(uv * 28.0) - 0.5;
      vec2 cellId = floor(uv * 28.0);
      float sHash = hash(cellId);
      if (sHash > 0.986) {
        float twinkle = sin(time * 2.8 + sHash * 6.28) * 0.45 + 0.55;
        float starVal = smoothstep(0.02 * sHash, 0.0, length(starGrid));
        col += vec3(0.96, 0.92, 1.0) * starVal * twinkle * 0.95;
      }
    }

    // Synthwave Sun with fwidth-based anti-aliased cuts
    vec2 sunPos = vec2(0.0, 0.16);
    float r = 0.28;
    float dist = length(uv - sunPos);
    if (dist < r && uv.y > horizon + 0.002) {
      float grad = (uv.y - sunPos.y + r) / (2.0 * r);
      vec3 sunCol = mix(vec3(0.96, 0.02, 0.52), vec3(0.96, 0.88, 0.08), grad);

      // Horizontal cuts with fwidth-based AA
      float barWidth = 15.0;
      float barPhase = uv.y * barWidth - time * 0.38;
      float barFract = fract(barPhase);
      float cutoff = 0.06 + 0.65 * (1.0 - (uv.y - horizon) / (2.0 * r));
      float fw = fwidth(barPhase) * 1.5;
      float sunLine = smoothstep(cutoff - fw, cutoff + fw, barFract);

      float sunMask = 1.0 - smoothstep(r - 0.008, r, dist);
      col = mix(col, sunCol, sunLine * sunMask);
    }

    // Sun glow
    float sunGlow = exp(-dist * 5.5) * 0.38;
    col += vec3(0.96, 0.02, 0.52) * sunGlow;

    // Raymarching smooth terrain
    float t_dist = -1.0;
    vec3 hitPos = vec3(0.0);
    bool hit = false;
    float speed = 1.6;
    vec3 ro = vec3(0.0, 0.48, time * speed);
    vec3 rd = normalize(vec3(uv.x, uv.y - horizon, 0.72));

    if (uv.y <= horizon) {
      t_dist = 0.0;
      float t_prev = 0.0;

      for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t_dist;
        float h = getTerrainHeight(p.xz);

        if (p.y < h) {
          float t_min = t_prev;
          float t_max = t_dist;
          for (int j = 0; j < 6; j++) {
            float t_mid = (t_min + t_max) * 0.5;
            vec3 midPos = ro + rd * t_mid;
            if (midPos.y < getTerrainHeight(midPos.xz)) {
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
        t_dist += 0.038 + t_dist * 0.012;
      }

      if (hit) {
        // Grid lines with fwidth() for perfect screen-space AA
        vec2 gridPos = hitPos.xz * 10.0;
        vec2 distToEdge = abs(fract(gridPos - 0.5) - 0.5);
        vec2 fw2 = fwidth(gridPos) * 1.2;
        float lineX = smoothstep(fw2.x, 0.0, distToEdge.x);
        float lineZ = smoothstep(fw2.y, 0.0, distToEdge.y);
        float grid = max(lineX, lineZ);

        float heightVal = smoothstep(0.05, 0.48, hitPos.y);
        vec3 baseCol = mix(vec3(0.02, 0.005, 0.06), vec3(0.85, 0.02, 0.48), heightVal * 0.45);
        vec3 gridCol = vec3(0.0, 0.88, 1.0);
        vec3 terrainCol = mix(baseCol, gridCol, grid * 0.9);

        float fog = clamp(t_dist / 7.0, 0.0, 1.0);
        fog = fog * fog; // quadratic falloff for smoother horizon blend
        col = mix(terrainCol, vec3(0.18, 0.01, 0.22), fog);
      } else {
        col = vec3(0.18, 0.01, 0.22);
      }
    }

    // Horizon glow
    float horizGlow = exp(-abs(uv.y - horizon) * 18.0);
    col += vec3(0.92, 0.02, 0.52) * horizGlow * 0.52;

    // CRT scanlines + vignette
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
