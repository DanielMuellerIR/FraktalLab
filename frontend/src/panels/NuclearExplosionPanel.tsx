import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'

const VOLUMETRIC_EXPLOSION_SHADER = `
  precision highp float;

  // 3D pseudo-random hash
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // 3D Value Noise with quintic interpolation for smoother gradients
  float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*f*(f*(f*6.0-15.0)+10.0); // quintic Hermite
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }

  // 6-octave fBm with lacunarity 2.03 for non-repeating detail cascading
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    mat3 rot = mat3(0.0, 0.8, 0.6,
                   -0.8, 0.36,-0.48,
                   -0.6,-0.48, 0.64); // rotation to break axis-alignment
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot * p * 2.03 + vec3(100.0);
      a *= 0.49;
    }
    return v;
  }

  // 3-octave fBm for shadow rays (sharper than old 2-octave)
  float fbmShadow(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(100.0);
      a *= 0.49;
    }
    return v;
  }

  // Blackbody temperature to RGB — wider dynamic range
  vec3 blackbody(float temp) {
    vec3 col;
    col.r = 1.0 / (1.0 + exp(-(temp - 900.0) / 200.0));
    col.g = 1.0 / (1.0 + exp(-(temp - 1600.0) / 250.0));
    col.b = 1.0 / (1.0 + exp(-(temp - 2500.0) / 320.0));
    float intensity = temp / 1000.0;
    if (temp > 3500.0) {
      intensity *= 1.8 + (temp - 3500.0) * 0.0015;
    }
    return col * intensity;
  }

  // Mushroom Cloud SDF — sharper geometry with billowing cap folds
  float mushroomDist(vec3 p, float progress) {
    float capY = mix(-0.35, 0.70, smoothstep(0.0, 0.60, progress));
    float capR = mix(0.04, 0.48, smoothstep(0.0, 0.42, progress));

    // Sinuous stem with double-frequency bend
    vec3 stemP = p;
    float bendAmt = (p.y + 0.55) * 0.10;
    stemP.x += sin(p.y * 8.0 + progress * 6.28) * bendAmt;
    stemP.z += cos(p.y * 7.0 + progress * 5.0) * bendAmt * 0.7;

    // Stem: flared base, narrow waist, wider just under cap
    float baseStemR = mix(0.015, 0.09, smoothstep(0.0, 0.35, progress));
    float waist = 1.0 - 0.65 * smoothstep(0.3, 0.75, p.y);
    float flare = 1.0 + 0.4 * smoothstep(capY - 0.15, capY, p.y); // widens into cap
    float stemR = baseStemR * waist * flare;
    float dStem = length(stemP.xz) - stemR;
    dStem = max(dStem, p.y - capY);
    dStem = max(dStem, -p.y - 0.55);

    // Cap: toroidal vortex ring with variable cross-section
    vec3 capP = p - vec3(0.0, capY, 0.0);
    capP.y *= 1.6;
    float rXZ = length(capP.xz);
    vec2 torusP = vec2(rXZ - capR, capP.y);
    // Vertically asymmetric cross-section: flatter on top, bulging below
    torusP.y *= (torusP.y > 0.0) ? 1.3 : 0.85;
    float dCap = length(torusP) - capR * 0.48;

    // Secondary pileus dome on top of the cap (cauliflower crest)
    vec3 crownP = p - vec3(0.0, capY + capR * 0.32, 0.0);
    float dCrown = length(crownP) - capR * 0.35;

    // Ground dust skirt
    float skirtR = mix(0.02, 0.58, smoothstep(0.0, 0.65, progress));
    vec3 skirtP = p - vec3(0.0, -0.52, 0.0);
    skirtP.y *= 3.5;
    vec2 skirtTorus = vec2(length(skirtP.xz) - skirtR, skirtP.y);
    float dSkirt = length(skirtTorus) - skirtR * 0.30;

    return min(dStem, min(min(dCap, dCrown), dSkirt));
  }

  // Primary density with dual-pass domain warping for curl-noise-like billows
  float mushroomDensity(vec3 p, float progress) {
    float d = mushroomDist(p, progress);

    if (d < 0.30) {
      float capY = mix(-0.35, 0.70, smoothstep(0.0, 0.60, progress));
      float capR = mix(0.04, 0.48, smoothstep(0.0, 0.42, progress));
      vec3 capP = p - vec3(0.0, capY, 0.0);

      float noiseScale = mix(8.0, 5.0, progress);
      vec3 nc = p * noiseScale;

      // Toroidal vortex flow direction for cap; upward convection for stem
      if (p.y > capY - capR * 0.7) {
        float phi = atan(capP.z, capP.x + 0.0001);
        float theta = atan(capP.y, length(capP.xz) - capR + 0.001);
        // Rolling toroidal flow
        vec3 flowDir = vec3(cos(phi) * cos(theta), sin(theta), sin(phi) * cos(theta));
        nc += flowDir * progress * 4.5;
        // Add angular distortion for cauliflower billows
        nc.xz += vec2(sin(phi * 5.0), cos(phi * 5.0)) * 0.15 * progress;
      } else {
        nc.y -= progress * 5.0;
        // Lateral stem turbulence
        nc.xz += vec2(sin(p.y * 12.0), cos(p.y * 10.0)) * 0.08;
      }

      // === Dual-pass domain warping (curl-noise approximation) ===
      // Pass 1: coarse warp
      vec3 warp1 = vec3(
        noise(nc + vec3(0.0, 0.0, 0.0)),
        noise(nc + vec3(5.2, 1.3, 0.0)),
        noise(nc + vec3(1.3, 5.2, 3.7))
      );
      vec3 nc2 = nc + warp1 * 0.55;
      // Pass 2: fine warp on top of coarse
      vec3 warp2 = vec3(
        noise(nc2 * 1.7 + vec3(7.1, 3.3, 0.0)),
        noise(nc2 * 1.7 + vec3(0.0, 9.1, 2.8)),
        noise(nc2 * 1.7 + vec3(3.5, 0.0, 8.6))
      );
      float n = fbm(nc2 + warp2 * 0.25);

      // Edge fade and density
      float edgeFade = smoothstep(0.30, 0.05, d);
      float density = (-d + n * 0.32) * edgeFade;
      density = smoothstep(0.0, 0.22, density);

      // Fade out end of cycle
      density *= (1.0 - smoothstep(0.72, 1.0, progress));

      return density;
    }
    return 0.0;
  }

  // Shadow density — 3-octave, single warp pass
  float mushroomDensityShadow(vec3 p, float progress) {
    float d = mushroomDist(p, progress);
    if (d < 0.30) {
      float edgeFade = smoothstep(0.30, 0.05, d);
      vec3 nc = p * 6.0 - vec3(0.0, progress * 5.0, 0.0);
      float n = fbmShadow(nc);
      float density = (-d + n * 0.28) * edgeFade;
      density = smoothstep(0.0, 0.22, density);
      density *= (1.0 - smoothstep(0.72, 1.0, progress));
      return density;
    }
    return 0.0;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float time = iTime;
    float cycleTime = mod(time, 30.0);
    float progress = cycleTime / 30.0;

    float mode = step(30.0, mod(time, 60.0));

    // Camera with slight slow pull-back as cloud grows
    float camZ = -1.8 + progress * 0.15;
    vec3 ro = vec3(0.0, 0.12, camZ);
    vec3 rd = normalize(vec3(uv, 1.35));

    // Background
    vec3 bgCol;
    if (mode == 0.0) {
      bgCol = mix(vec3(0.55, 0.72, 0.95), vec3(0.90, 0.93, 0.98), smoothstep(0.4, -0.6, uv.y));
    } else {
      bgCol = vec3(0.012) + vec3(0.015) * sin(uv.y * 3.0 + time * 0.4);
    }

    // Ground intersection
    float tGround = 999.0;
    if (rd.y < 0.0) {
      tGround = (-0.55 - ro.y) / rd.y;
    }
    float tMax = min(2.8, tGround);

    float t = 0.0;
    // Temporal jitter to eliminate banding
    t += hash(vec3(fragCoord, fract(time))) * 0.016;

    // 1. Sphere tracing to skip empty space
    for (int i = 0; i < 35; i++) {
      vec3 p = ro + rd * t;
      float d = mushroomDist(p, progress);
      if (d < 0.28 || t >= tMax) break;
      t += max(0.012, d * 0.75 - 0.12);
    }

    // 2. Volumetric marching — 48 steps, 0.018 step size
    float stepSize = 0.018;
    float accumOpacity = 0.0;
    vec3 accumColor = vec3(0.0);

    for (int i = 0; i < 48; i++) {
      if (t >= tMax || accumOpacity >= 0.98) break;

      vec3 p = ro + rd * t;
      float d = mushroomDensity(p, progress);

      if (d > 0.008) {
        // Sun shadow ray — 5 steps for sharper self-shadowing
        vec3 sunDir = normalize(vec3(1.0, 1.8, -1.0));
        float sunDensity = 0.0;
        for (int j = 1; j <= 5; j++) {
          sunDensity += mushroomDensityShadow(p + sunDir * (float(j) * 0.055), progress);
        }
        float sunT = exp(-sunDensity * 5.5);

        // Core glow ray
        float capY = mix(-0.35, 0.70, smoothstep(0.0, 0.60, progress));
        float capR = mix(0.04, 0.48, smoothstep(0.0, 0.42, progress));
        vec3 corePos = (p.y > capY - 0.2) ? vec3(normalize(p.xz + 0.001) * capR * 0.5, capY) : vec3(0.0, p.y, 0.0);
        vec3 toCore = corePos - p;
        float distToCore = length(toCore);
        vec3 coreDir = toCore / (distToCore + 0.001);
        float coreDensity = 0.0;
        float cStep = max(0.02, distToCore / 4.0);
        for (int j = 1; j <= 3; j++) {
          coreDensity += mushroomDensityShadow(p + coreDir * (float(j) * cStep), progress);
        }
        float coreT = exp(-coreDensity * 6.0);

        // Temperature
        float heat = smoothstep(0.45, 0.0, distToCore);
        float initialBoost = 3.0 * smoothstep(0.15, 0.0, progress);
        float temperature = heat * (2800.0 + initialBoost * 3500.0) * (1.0 - smoothstep(0.0, 0.60, progress));

        vec3 fireEmit = blackbody(temperature) * 2.5;
        float stepOpacity = d * stepSize * 20.0; // Higher absorption for denser, puffier cloud

        if (mode == 0.0) {
          // Day: rich brown-grey smoke with pronounced depth
          vec3 smokeAlbedo = mix(
            vec3(0.72, 0.66, 0.56), // Bright sunlit cream
            vec3(0.14, 0.12, 0.11), // Deep shadow soot
            smoothstep(-0.35, 0.80, p.y + d * 0.3)
          );
          vec3 sunLight = vec3(1.0, 0.96, 0.88) * 1.8 * sunT;
          vec3 ambient = vec3(0.50, 0.68, 0.92) * 0.50 * (0.3 + 0.7 * sunT);
          float fwdScatter = pow(max(0.0, dot(rd, sunDir)), 5.0) * 0.5 * sunT;

          vec3 col = smokeAlbedo * (sunLight + ambient + fwdScatter * vec3(1.0, 0.88, 0.65));
          col += fireEmit * coreT * 1.8;
          col += fireEmit * 1.0; // self-glow

          accumColor += col * stepOpacity * (1.0 - accumOpacity);
        } else {
          // Night B&W
          float grey = mix(0.70, 0.04, smoothstep(-0.35, 0.80, p.y + d * 0.35));
          float fireI = dot(fireEmit, vec3(0.299, 0.587, 0.114));
          float sunL = 0.28 * sunT;
          float ambL = 0.04 * (0.3 + 0.7 * sunT);

          vec3 col = vec3(grey) * (sunL + ambL) + vec3(fireI) * coreT * 2.5 + vec3(fireI) * 1.2;
          accumColor += col * stepOpacity * (1.0 - accumOpacity);
        }
        accumOpacity += stepOpacity * (1.0 - accumOpacity);
      }
      t += stepSize;
    }

    // Ground floor
    if (rd.y < 0.0 && accumOpacity < 1.0) {
      vec3 pG = ro + rd * tGround;
      float groundShadow = 0.0;
      vec3 sDir = normalize(vec3(1.0, 1.8, -1.0));
      for (int j = 0; j < 6; j++) {
        groundShadow += mushroomDensityShadow(pG + sDir * (0.04 + float(j) * 0.07), progress) * 0.22;
      }
      float sf = exp(-groundShadow * 5.0);

      float r = length(pG.xz);
      float waveDist = progress * 1.8;
      float shockGlow = 0.0;
      if (waveDist > 0.0) {
        shockGlow += smoothstep(0.08, 0.0, abs(r - waveDist));
        shockGlow += smoothstep(0.05, 0.0, abs(r - waveDist * 0.75)) * 0.45;
        shockGlow += smoothstep(0.03, 0.0, abs(r - waveDist * 0.5)) * 0.25;
        shockGlow *= (0.3 + 0.7 * fbmShadow(vec3(pG.xz * 15.0, time * 2.5))) * (1.0 - progress);
      }
      float epicFlash = smoothstep(0.35, 0.0, r) * smoothstep(0.3, 0.0, progress) * 2.8;

      vec3 groundCol;
      if (mode == 0.0) {
        vec3 baseCol = mix(vec3(0.38, 0.34, 0.29), vec3(0.18, 0.16, 0.14), smoothstep(0.0, 2.0, r));
        baseCol += (fbmShadow(vec3(pG.xz * 12.0, 0.0)) - 0.5) * 0.04;
        vec3 dustC = mix(vec3(0.85, 0.75, 0.6), vec3(0.35, 0.32, 0.28), smoothstep(0.0, 1.8, r));
        vec3 fireG = vec3(1.0, 0.4, 0.1) * 3.5;
        groundCol = baseCol * (0.2 + 0.8 * sf) + mix(dustC, fireG, smoothstep(0.2, 0.0, progress)) * shockGlow + vec3(1.0, 0.55, 0.15) * epicFlash;
      } else {
        vec3 baseCol = vec3(0.015);
        baseCol += (fbmShadow(vec3(pG.xz * 15.0, 0.0)) - 0.5) * 0.005;
        groundCol = baseCol * (0.15 + 0.85 * sf) + vec3(0.5) * shockGlow + vec3(2.5) * epicFlash;
      }
      accumColor += groundCol * (1.0 - accumOpacity);
      accumOpacity = 1.0;
    }

    vec3 finalCol = mix(bgCol, accumColor, accumOpacity);

    // Blinding flash
    float flash = exp(-progress * 24.0) * 4.0;
    vec3 flashCol = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.65, 0.22), smoothstep(0.0, 0.07, progress));
    if (mode == 0.0) {
      finalCol += flashCol * flash;
    } else {
      finalCol += vec3(flash * 0.9);
    }

    // Twin Peaks film grain
    if (mode == 1.0) {
      finalCol += vec3(hash(vec3(fragCoord, time)) * 0.07);
      finalCol *= 0.86 + 0.14 * sin(fragCoord.y * 1.5 + time * 6.0);
    }

    fragColor = vec4(finalCol, 1.0);
  }
`;

function NuclearExplosionPanel() {
  const [modeLabel, setModeLabel] = useState('SYS: DETONATION VOLUMETRIC MODEL')

  useEffect(() => {
    const startTime = performance.now()
    const interval = setInterval(() => {
      const elapsedSeconds = (performance.now() - startTime) / 1000
      const mode = Math.floor(elapsedSeconds / 30) % 2
      if (mode === 0) {
        setModeLabel('SIMULATION: OPPENHEIMER TRINITY (DAY)')
      } else {
        setModeLabel('SIMULATION: TWIN PEAKS NIGHT (B&W MONO)')
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <ShaderPanel
      fragmentShader={VOLUMETRIC_EXPLOSION_SHADER}
      title={modeLabel}
      attribution="Volumetric Raymarching"
      uniforms={{}} // Progress and Mode are calculated on-the-fly using iTime
    />
  )
}

export default memo(NuclearExplosionPanel)

