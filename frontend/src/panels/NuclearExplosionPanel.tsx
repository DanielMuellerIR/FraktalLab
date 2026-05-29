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

  // 4-octave Fractional Brownian Motion (fBm) noise
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.4 + shift;
      a *= 0.48;
    }
    return v;
  }

  // Procedural Mushroom Cloud Density Map
  float mushroomDensity(vec3 p, float progress) {
    // Rise Cap height and expand Cap radius over time
    float capY = mix(-0.35, 0.65, smoothstep(0.0, 0.65, progress));
    float capR = mix(0.04, 0.44, smoothstep(0.0, 0.44, progress));
    
    // Stem cylinder distance (wider at bottom, narrow towards cap)
    float baseStemRadius = mix(0.01, 0.07, smoothstep(0.0, 0.4, progress));
    float stemThickness = baseStemRadius * (1.0 - 0.7 * smoothstep(0.4, 0.9, p.y));
    float dStem = length(p.xz) - stemThickness;
    
    // Clamp stem vertically: bottom floor to cap center
    dStem = max(dStem, p.y - capY);
    dStem = max(dStem, -p.y - 0.55);
    
    // Cap ellipsoid distance (flattened sphere)
    vec3 capP = p - vec3(0.0, capY, 0.0);
    capP.y *= 1.8; // Vertical flattening
    float dCap = length(capP) - capR;
    
    // Combine stem and cap
    float d = min(dStem, dCap);
    
    // Add volumetric displacement noise when ray is close
    if (d < 0.15) {
      float noiseScale = mix(6.0, 3.5, progress);
      float noiseOffset = iTime * 0.18;
      float n = fbm(p * noiseScale + vec3(0.0, -noiseOffset, 0.0));
      
      // Calculate dense noise shell
      float density = -d + n * 0.28;
      density = smoothstep(0.0, 0.35, density);
      
      // Gradual fade out at the end of cycle
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
    
    float t = 0.0;
    float stepSize = 0.045;
    float accumOpacity = 0.0;
    vec3 accumColor = vec3(0.0);
    
    // Jitter coordinates to eliminate ray-stepping banding artifacts
    float jitter = hash(vec3(fragCoord, time)) * 0.035;
    t += jitter;
    
    for (int i = 0; i < 46; i++) {
      vec3 p = ro + rd * t;
      
      // Ground cutoff plane
      if (p.y < -0.55) {
        break;
      }
      
      float d = mushroomDensity(p, progress);
      if (d > 0.01) {
        // Calculate core fire glow (early in the explosion cycle)
        float capY = mix(-0.35, 0.65, smoothstep(0.0, 0.65, progress));
        float coreDist = length(p - vec3(0.0, capY * 0.8, 0.0));
        float fireIntensity = smoothstep(0.6, 0.0, coreDist) * smoothstep(0.50, 0.0, progress);
        
        vec3 smokeCol;
        vec3 fireCol;
        
        if (mode == 0.0) {
          // Oppenheimer Day colors: Brown-grey dust, bright orange-gold flame core
          smokeCol = mix(vec3(0.85, 0.82, 0.78), vec3(0.30, 0.26, 0.24), smoothstep(0.2, 0.7, p.y + d * 0.2));
          fireCol = mix(vec3(1.0, 0.35, 0.0), vec3(1.0, 0.90, 0.40), fireIntensity) * 2.6;
          
          vec3 finalSampleCol = mix(smokeCol, fireCol, fireIntensity * d);
          finalSampleCol *= (0.35 + 0.65 * d); // Apply lighting occlusion
          
          accumColor += finalSampleCol * d * stepSize * (1.0 - accumOpacity);
        } else {
          // Twin Peaks Night colors: High contrast black & white
          float greySmoke = mix(0.72, 0.12, smoothstep(0.2, 0.8, p.y + d * 0.3));
          smokeCol = vec3(greySmoke);
          fireCol = vec3(1.8 * fireIntensity);
          
          vec3 finalSampleCol = mix(smokeCol, fireCol, fireIntensity * d);
          finalSampleCol *= (0.28 + 0.72 * d);
          
          accumColor += finalSampleCol * d * stepSize * (1.0 - accumOpacity);
        }
        
        accumOpacity += d * stepSize * (1.0 - accumOpacity);
        if (accumOpacity >= 0.95) {
          accumOpacity = 1.0;
          break;
        }
      }
      t += stepSize;
    }
    
    // Blend sky background and cloud rendering
    vec3 finalCol = mix(bgCol, accumColor, accumOpacity);
    
    // Ground shockwave ring effect
    float waveDist = progress * 1.5;
    if (progress < 0.45 && waveDist > 0.0) {
      float rCoord = length(uv - vec2(0.0, -0.22));
      float ring = smoothstep(0.06, 0.0, abs(rCoord - waveDist));
      float fade = 1.0 - progress / 0.45;
      
      if (mode == 0.0) {
        finalCol = mix(finalCol, vec3(0.95), ring * fade * 0.42);
      } else {
        finalCol += vec3(ring * fade * 0.48);
      }
    }
    
    // Initial ground burst flash
    if (progress < 0.32) {
      float fireRing = smoothstep(0.22, 0.0, length(uv - vec2(0.0, -0.42))) * (1.0 - progress / 0.32);
      if (mode == 0.0) {
        finalCol = mix(finalCol, vec3(1.0, 0.5, 0.1) * 2.2, fireRing);
      } else {
        finalCol = mix(finalCol, vec3(1.6), fireRing);
      }
    }
    
    // Twin Peaks vintage film grain & flickering scanlines
    if (mode == 1.0) {
      float grain = hash(vec3(fragCoord, time)) * 0.07;
      finalCol += vec3(grain);
      finalCol *= 0.88 + 0.12 * sin(fragCoord.y * 1.4 + time * 5.0);
    }
    
    fragColor = vec4(finalCol, 1.0);
  }
`;

function NuclearExplosionPanel() {
  const [modeLabel, setModeLabel] = useState('SYS: DETONATION VOLUMETRIC MODEL')

  useEffect(() => {
    // Update label dynamically based on time matching the mode cycle in the shader
    const interval = setInterval(() => {
      const time = Date.now() / 1000
      const mode = Math.floor(time / 30) % 2
      if (mode === 0) {
        setModeLabel('SIMULATION: OPPENHEIMER TRINITY (DAY)')
      } else {
        setModeLabel('SIMULATION: TWIN PEAKS NIGHT (B&W MONO)')
      }
    }, 1000)
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
