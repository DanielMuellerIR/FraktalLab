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

  // 3D Value Noise
  float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }

  // 6-octave Fractional Brownian Motion (fBm) noise for primary rays
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // 2-octave fast fBm for shadow rays and dust/turbulence
  float fbmShadow(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 2; i++) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Blackbody temperature to RGB color mapping
  vec3 blackbody(float temp) {
    vec3 col = vec3(0.0);
    col.r = 1.0 / (1.0 + exp(-(temp - 1000.0) / 240.0));
    col.g = 1.0 / (1.0 + exp(-(temp - 1700.0) / 280.0));
    col.b = 1.0 / (1.0 + exp(-(temp - 2600.0) / 350.0));
    // Boost intensity for white-hot temperatures
    float intensity = temp / 1100.0;
    if (temp > 3500.0) {
      intensity *= 1.5 + (temp - 3500.0) * 0.001;
    }
    return col * intensity;
  }

  // Procedural Mushroom Cloud Signed Distance Function (No Noise)
  float mushroomDist(vec3 p, float progress) {
    // Rise Cap height and expand Cap radius over time
    float capY = mix(-0.35, 0.65, smoothstep(0.0, 0.65, progress));
    float capR = mix(0.04, 0.46, smoothstep(0.0, 0.44, progress));
    
    // Sinuous stem coordinates
    vec3 stemP = p;
    float bendIntensity = (p.y + 0.55) * 0.12;
    stemP.x += sin(p.y * 7.0 + progress * 6.28) * bendIntensity;
    stemP.z += cos(p.y * 6.0 + progress * 6.28) * bendIntensity;
    
    // Stem cylinder distance (wider at bottom, narrow towards cap)
    float baseStemRadius = mix(0.015, 0.08, smoothstep(0.0, 0.4, progress));
    float stemThickness = baseStemRadius * (1.0 - 0.7 * smoothstep(0.4, 0.9, p.y));
    float dStem = length(stemP.xz) - stemThickness;
    
    // Clamp stem vertically
    dStem = max(dStem, p.y - capY);
    dStem = max(dStem, -p.y - 0.55);
    
    // Cap toroidal vortex ring distance function
    vec3 capP = p - vec3(0.0, capY, 0.0);
    capP.y *= 1.8; // Vertical flattening
    vec2 torusP = vec2(length(capP.xz) - capR, capP.y);
    float dCap = length(torusP) - capR * 0.45;
    
    // Ground dust skirt: expands outward at the base (y ~ -0.55)
    float skirtR = mix(0.02, 0.55, smoothstep(0.0, 0.7, progress));
    vec3 skirtP = p - vec3(0.0, -0.52, 0.0);
    skirtP.y *= 3.0; // Flat profile
    vec2 skirtTorus = vec2(length(skirtP.xz) - skirtR, skirtP.y);
    float dSkirt = length(skirtTorus) - skirtR * 0.35;
    
    // Combine stem, cap, and skirt
    return min(dStem, min(dCap, dSkirt));
  }

  // Procedural Mushroom Cloud Density Map (Primary Ray)
  float mushroomDensity(vec3 p, float progress) {
    float d = mushroomDist(p, progress);
    
    // We evaluate density when the ray is close to the geometry boundary
    if (d < 0.25) {
      float capY = mix(-0.35, 0.65, smoothstep(0.0, 0.65, progress));
      float capR = mix(0.04, 0.46, smoothstep(0.0, 0.44, progress));
      vec3 capP = p - vec3(0.0, capY, 0.0);
      
      float noiseScale = mix(6.5, 4.0, progress);
      vec3 noiseCoord = p * noiseScale;
      
      // Toroidal vortex flow for cap, upward flow for stem
      if (p.y > capY - capR * 0.6) {
        float phi = atan(capP.z, capP.x + 0.0001);
        float theta = atan(capP.y, length(capP.xz) - capR);
        vec3 flowDir = vec3(cos(phi) * cos(theta), sin(theta), sin(phi) * cos(theta));
        noiseCoord += flowDir * progress * 3.8;
      } else {
        noiseCoord.y -= progress * 4.5;
      }
      
      // Coordinate domain warping for extreme micro-turbulence detail
      vec3 warp = vec3(
        noise(noiseCoord + vec3(0.0, 0.0, 0.0)),
        noise(noiseCoord + vec3(5.2, 1.3, 0.0)),
        noise(noiseCoord + vec3(1.3, 5.2, 3.7))
      );
      float n = fbm(noiseCoord + warp * 0.35);
      
      // Calculate dense billowy smoke shell
      // Fade density smoothly near the boundary (0.25) to avoid truncation artifact!
      float edgeFade = smoothstep(0.25, 0.08, d);
      float density = (-d + n * 0.28) * edgeFade;
      
      density = smoothstep(0.0, 0.30, density);
      
      // Gradual fade out at the end of cycle
      density *= (1.0 - smoothstep(0.72, 1.0, progress));
      
      return density;
    }
    return 0.0;
  }

  // Fast Procedural Mushroom Cloud Density Map for secondary shadow rays
  float mushroomDensityShadow(vec3 p, float progress) {
    float d = mushroomDist(p, progress);
    
    if (d < 0.25) {
      float edgeFade = smoothstep(0.25, 0.08, d);
      // Fast single-octave noise mapping for soft shadow turbulence
      float n = noise(p * 5.0 - vec3(0.0, progress * 4.0, 0.0));
      float density = (-d + n * 0.25) * edgeFade;
      
      density = smoothstep(0.0, 0.30, density);
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
    
    // uMode: 0.0 = Oppenheimer Day (Color), 1.0 = Twin Peaks Night (B&W Mono)
    float mode = step(30.0, mod(time, 60.0));
    
    // Raymarching camera
    vec3 ro = vec3(0.0, 0.15, -1.8);
    vec3 rd = normalize(vec3(uv, 1.35));
    
    // Background gradient setup
    vec3 bgCol;
    if (mode == 0.0) {
      // Day Sky (Gradient of light blue/sky color)
      bgCol = mix(vec3(0.55, 0.72, 0.95), vec3(0.90, 0.93, 0.98), smoothstep(0.4, -0.6, uv.y));
    } else {
      // B&W Night Void (Subtle pulsing grey waves)
      bgCol = vec3(0.015) + vec3(0.02) * sin(uv.y * 3.0 + time * 0.4);
    }
    
    // Raymarching bounds and ground cutoff
    float tGround = 999.0;
    if (rd.y < 0.0) {
      tGround = (-0.55 - ro.y) / rd.y;
    }
    float tMax = min(2.5, tGround);
    
    float t = 0.0;
    
    // Jitter starting point to eliminate ray-stepping banding artifacts
    float jitter = hash(vec3(fragCoord, time)) * 0.02;
    t += jitter;
    
    // 1. Sphere Tracing to skip empty space very efficiently!
    for (int i = 0; i < 30; i++) {
      vec3 p = ro + rd * t;
      float d = mushroomDist(p, progress);
      if (d < 0.22 || t >= tMax) {
        break;
      }
      t += max(0.015, d * 0.8 - 0.15); // Step forward safely
    }
    
    float stepSize = 0.022; // High-resolution steps inside the volume
    float accumOpacity = 0.0;
    vec3 accumColor = vec3(0.0);
    
    // 2. Volumetric Raymarching Loop (35 Steps inside volume)
    for (int i = 0; i < 35; i++) {
      if (t >= tMax || accumOpacity >= 0.98) {
        break;
      }
      
      vec3 p = ro + rd * t;
      float d = mushroomDensity(p, progress);
      
      if (d > 0.01) {
        // --- Volumetric Light Marching ---
        
        // 1. Shadow ray towards the sun light
        vec3 sunDir = normalize(vec3(1.0, 1.8, -1.0));
        float sunDensity = 0.0;
        float lStep = 0.06;
        for (int j = 1; j <= 4; j++) {
          vec3 lp = p + sunDir * (float(j) * lStep);
          sunDensity += mushroomDensityShadow(lp, progress);
        }
        float sunTransmittance = exp(-sunDensity * 4.5);
        
        // 2. Light ray towards the internal glowing fire core
        float capY = mix(-0.35, 0.65, smoothstep(0.0, 0.65, progress));
        float capR = mix(0.04, 0.46, smoothstep(0.0, 0.44, progress));
        vec3 corePos = (p.y > capY - 0.2) ? vec3(normalize(p.xz + 0.0001) * capR, capY) : vec3(0.0, p.y, 0.0);
        
        vec3 toCore = corePos - p;
        float distToCore = length(toCore);
        vec3 coreDir = toCore / (distToCore + 0.0001);
        float coreDensity = 0.0;
        float cStep = distToCore / 4.0;
        for (int j = 1; j <= 3; j++) {
          vec3 cp = p + coreDir * (float(j) * cStep);
          coreDensity += mushroomDensityShadow(cp, progress);
        }
        float coreTransmittance = exp(-coreDensity * 5.0);
        
        // --- Heat & Temperature Mapping ---
        float heat = smoothstep(0.4, 0.0, distToCore);
        float initialBoost = 2.5 * smoothstep(0.18, 0.0, progress); // High-temp flash
        float temperature = heat * (2400.0 + initialBoost * 3200.0) * (1.0 - smoothstep(0.0, 0.65, progress));
        
        vec3 smokeAlbedo;
        vec3 fireEmit = blackbody(temperature) * 2.2;
        
        float stepOpacity = d * stepSize * 16.0; // Absorption scale of 16.0 for solid volumetric puffiness!
        if (stepOpacity > 0.0) {
          if (mode == 0.0) {
            // Oppenheimer Day colors: Brown-grey dust, beautiful shadow depth
            smokeAlbedo = mix(vec3(0.68, 0.64, 0.58), vec3(0.18, 0.16, 0.15), smoothstep(-0.35, 0.75, p.y + d * 0.25));
            vec3 sunLight = vec3(1.0, 0.96, 0.90) * 1.6 * sunTransmittance;
            vec3 ambientLight = vec3(0.55, 0.72, 0.95) * 0.55 * (0.35 + 0.65 * sunTransmittance);
            
            // Forward scattering silver-lining glow
            float forwardScattering = pow(max(0.0, dot(rd, sunDir)), 4.0) * 0.4 * sunTransmittance;
            
            vec3 sampleCol = smokeAlbedo * (sunLight + ambientLight + forwardScattering * vec3(1.0, 0.9, 0.7)) + fireEmit * coreTransmittance * 1.5;
            sampleCol += fireEmit * 0.9; // Internal self-glow inside fire core
            
            accumColor += sampleCol * stepOpacity * (1.0 - accumOpacity);
          } else {
            // Twin Peaks Night colors: High contrast black & white
            float greySmoke = mix(0.65, 0.06, smoothstep(-0.35, 0.75, p.y + d * 0.3));
            smokeAlbedo = vec3(greySmoke);
            
            float fireIntensity = dot(fireEmit, vec3(0.299, 0.587, 0.114));
            vec3 fireEmitBW = vec3(fireIntensity);
            
            float sunLight = 0.25 * sunTransmittance;
            float ambientLight = 0.05 * (0.3 + 0.7 * sunTransmittance);
            
            vec3 sampleCol = smokeAlbedo * (sunLight + ambientLight) + fireEmitBW * coreTransmittance * 2.2;
            sampleCol += fireEmitBW * 1.0;
            
            accumColor += sampleCol * stepOpacity * (1.0 - accumOpacity);
          }
          accumOpacity += stepOpacity * (1.0 - accumOpacity);
        }
      }
      t += stepSize;
    }
    
    // --- Physical Ground Floor Shading ---
    if (rd.y < 0.0 && accumOpacity < 1.0) {
      vec3 pGround = ro + rd * tGround;
      
      // Ground soft shadow from cloud
      float groundShadow = 0.0;
      vec3 shadowRo = pGround + vec3(0.0, 0.01, 0.0);
      vec3 shadowRd = normalize(vec3(1.0, 1.8, -1.0));
      float shadowT = 0.04;
      for (int j = 0; j < 5; j++) {
        vec3 sp = shadowRo + shadowRd * shadowT;
        groundShadow += mushroomDensityShadow(sp, progress) * 0.25;
        shadowT += 0.08;
      }
      float shadowFactor = exp(-groundShadow * 4.5);
      
      // Ground shockwaves
      float r = length(pGround.xz);
      float waveDist = progress * 1.8;
      float shockwaveGlow = 0.0;
      if (waveDist > 0.0) {
        float ring1 = smoothstep(0.08, 0.0, abs(r - waveDist));
        float ring2 = smoothstep(0.05, 0.0, abs(r - waveDist * 0.75)) * 0.45;
        float ring3 = smoothstep(0.03, 0.0, abs(r - waveDist * 0.5)) * 0.25;
        
        float dustTurbulence = fbmShadow(vec3(pGround.xz * 15.0, time * 2.5));
        shockwaveGlow = (ring1 + ring2 + ring3) * (0.3 + 0.7 * dustTurbulence) * (1.0 - progress);
      }
      
      // Intense epicentre flash
      float epicentreFlash = smoothstep(0.35, 0.0, r) * smoothstep(0.3, 0.0, progress) * 2.5;
      
      vec3 groundCol = vec3(0.0);
      if (mode == 0.0) {
        vec3 baseCol = mix(vec3(0.38, 0.34, 0.29), vec3(0.18, 0.16, 0.14), smoothstep(0.0, 2.0, r));
        float groundNoise = fbmShadow(vec3(pGround.xz * 12.0, 0.0));
        baseCol += (groundNoise - 0.5) * 0.04;
        
        vec3 dustColor = mix(vec3(0.85, 0.75, 0.6), vec3(0.35, 0.32, 0.28), smoothstep(0.0, 1.8, r));
        vec3 fireGlow = vec3(1.0, 0.4, 0.1) * 3.5;
        vec3 shockwaveColor = mix(dustColor, fireGlow, smoothstep(0.2, 0.0, progress)) * shockwaveGlow;
        
        groundCol = baseCol * (0.2 + 0.8 * shadowFactor) + shockwaveColor + vec3(1.0, 0.55, 0.15) * epicentreFlash;
      } else {
        vec3 baseCol = vec3(0.015, 0.016, 0.018);
        float groundNoise = fbmShadow(vec3(pGround.xz * 15.0, 0.0));
        baseCol += (groundNoise - 0.5) * 0.005;
        
        vec3 dustColor = vec3(0.5);
        vec3 fireGlow = vec3(2.5);
        vec3 shockwaveColor = mix(dustColor, fireGlow, smoothstep(0.2, 0.0, progress)) * shockwaveGlow;
        
        groundCol = baseCol * (0.15 + 0.85 * shadowFactor) + shockwaveColor + vec3(2.5) * epicentreFlash;
      }
      
      accumColor += groundCol * (1.0 - accumOpacity);
      accumOpacity = 1.0;
    }
    
    // Blend sky background and accumulated cloud colors
    vec3 finalCol = mix(bgCol, accumColor, accumOpacity);
    
    // --- Dynamic Blinding Ionization Camera Flash Exposure Bloom ---
    float flash = exp(-progress * 22.0) * 3.5;
    vec3 flashCol = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.65, 0.22), smoothstep(0.0, 0.08, progress));
    if (mode == 0.0) {
      finalCol += flashCol * flash;
    } else {
      finalCol += vec3(flash * 0.9);
    }
    
    // Twin Peaks vintage film grain & flickering scanlines
    if (mode == 1.0) {
      float grain = hash(vec3(fragCoord, time)) * 0.08;
      finalCol += vec3(grain);
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

