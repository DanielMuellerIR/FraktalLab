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

  float getTerrainHeight(vec2 p) {
    float valley = smoothstep(0.08, 0.85, abs(p.x));
    
    float hills1 = sin(p.x * 2.2) * cos(p.y * 1.1) * 0.2;
    float hills2 = noise(p * 4.5) * 0.08;
    float waves = sin(p.y * 3.5) * 0.045;
    float hills = hills1 + hills2 + waves;
    
    return valley * 0.42 + hills * valley;
  }

  float drawPalm2D(vec2 p, float time) {
    float trunk = 0.0;
    float trunkCurve = 0.15 * sin(p.y * 1.8 + 1.2);
    float dx = p.x - trunkCurve;
    if (p.y > -2.2 && p.y < 0.0) {
        float width = 0.045 * (1.0 - 0.55 * (p.y + 2.2) / 2.2);
        width += 0.005 * sin(p.y * 25.0);
        trunk = smoothstep(width, width - 0.015, abs(dx));
    }

    float leaves = 0.0;
    vec2 crown = vec2(0.15 * sin(1.2), 0.0);
    vec2 lp = p - crown;
    float r = length(lp);
    float a = atan(lp.y, lp.x);

    for (int i = 0; i < 6; i++) {
        float angle = float(i) * 3.14159 / 3.0 + 0.15 * sin(time + float(i)*1.5);
        float fa = a - angle;
        fa = atan(sin(fa), cos(fa));
        
        float bend = 0.45 * r * r;
        float maxR = 0.65 + 0.15 * cos(float(i) * 3.7);
        if (r < maxR && r > 0.04) {
            float stemVal = abs(fa);
            float blade = abs(sin(r * 45.0 + float(i)*2.0));
            float bladeLimit = 0.18 * blade * (1.0 - r/maxR);
            if (stemVal < bladeLimit) {
                leaves = max(leaves, 1.0 - r/maxR);
            }
        }
    }
    return max(trunk, leaves);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.8;
    float horizon = -0.06;
    
    vec3 skyCol = mix(vec3(0.04, 0.01, 0.10), vec3(0.85, 0.04, 0.42), uv.y + 0.5);
    vec3 col = skyCol;
    
    if (uv.y > horizon) {
      vec2 starUV = uv * 32.0;
      float sHash = hash(floor(starUV));
      if (sHash > 0.988) {
        float twinkle = sin(time * 3.5 + sHash * 6.28) * 0.5 + 0.5;
        col += vec3(twinkle * 0.85);
      }
    }
    
    vec2 sunPos = vec2(0.0, 0.14);
    float r = 0.28;
    float dist = length(uv - sunPos);
    if (dist < r && uv.y > horizon) {
      float grad = (uv.y - sunPos.y + r) / (2.0 * r);
      vec3 sunCol = mix(vec3(0.98, 0.18, 0.52), vec3(0.98, 0.92, 0.12), grad);
      
      float bar = fract(uv.y * 14.0 - time * 0.35);
      float threshold = 0.05 + 0.65 * (1.0 - (uv.y - horizon) / (2.0 * r));
      if (bar > threshold) {
        col = sunCol;
      }
    }
    
    float sunGlow = exp(-dist * 4.5) * 0.35;
    col += vec3(0.98, 0.18, 0.52) * sunGlow;
    
    float t_dist = -1.0;
    vec3 hitPos = vec3(0.0);
    bool hit = false;
    vec3 ro = vec3(0.0, 0.38, time * 0.72);
    vec3 rd = normalize(vec3(uv.x, uv.y - 0.04, 0.65));

    if (uv.y <= horizon) {
      t_dist = 0.0;
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
        float thick = 0.016;
        float blur = 0.008;
        float gx = 1.0 - smoothstep(thick - blur, thick + blur, min(fract(hitPos.x * 5.0), 1.0 - fract(hitPos.x * 5.0)));
        float gz = 1.0 - smoothstep(thick - blur, thick + blur, min(fract(hitPos.z * 5.0), 1.0 - fract(hitPos.z * 5.0)));
        float grid = max(gx, gz);
        
        vec3 baseCol = vec3(0.02, 0.0, 0.05);
        vec3 gridCol = vec3(0.0, 0.68, 0.98);
        
        float peakGlow = smoothstep(0.05, 0.38, hitPos.y);
        baseCol += vec3(0.92, 0.1, 0.58) * peakGlow * 0.42;
        
        vec3 terrainCol = mix(baseCol, gridCol, grid);
        float fog = clamp(t_dist / 6.2, 0.0, 1.0);
        col = mix(terrainCol, vec3(0.18, 0.02, 0.22), fog);
      } else {
        col = vec3(0.18, 0.02, 0.22);
      }
    }
    
    float palmCoverage = 0.0;
    float palmAberration = 0.0;
    
    float spacing = 2.4;
    float startZ = floor(ro.z / spacing) * spacing;
    
    for (int k = 0; k < 6; k++) {
        float z_pos = startZ + float(k) * spacing;
        for (float side = -1.0; side <= 1.0; side += 2.0) {
            float x_pos = side * 1.35;
            float y_pos = -0.05;
            
            vec3 p_crown = vec3(x_pos, y_pos + 1.25, z_pos);
            vec3 camCrown = p_crown - ro;
            
            if (camCrown.z > 0.1) {
                if (hit && camCrown.z > (hitPos.z - ro.z)) {
                    continue;
                }
                
                float sz = 1.0 / camCrown.z;
                vec2 projCrown = vec2(camCrown.x / camCrown.z * 0.65, (camCrown.y / camCrown.z * 0.65) + 0.04);
                
                vec2 localUV = (uv - projCrown) / sz;
                float palmShape = drawPalm2D(localUV, time * 1.5 + z_pos);
                palmCoverage = max(palmCoverage, palmShape);
                
                vec2 abUV = (uv + vec2(0.006 * sz * side, 0.0) - projCrown) / sz;
                float abShape = drawPalm2D(abUV, time * 1.5 + z_pos);
                palmAberration = max(palmAberration, abShape);
            }
        }
    }
    
    vec3 palmCol = vec3(0.01, 0.005, 0.02);
    col = mix(col, palmCol, palmCoverage);
    if (palmAberration > 0.0 && palmCoverage < 0.95) {
        col = mix(col, vec3(0.98, 0.18, 0.42), 0.35 * palmAberration);
    }
    
    float horizGlow = exp(-abs(uv.y - horizon) * 16.0);
    col += vec3(0.95, 0.18, 0.55) * horizGlow * 0.45;
    
    col *= 0.93 + 0.07 * sin(fragCoord.y * 1.8);
    col *= 1.0 - length(uv) * 0.45;
    
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
