import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import Panel from '../ui/Panel'

const REAL_EARTH_SHADER = `
  precision highp float;
  uniform sampler2D uHeightmap;

  // 3D Value Noise for cloud generation
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }

  // 4-octave fBm for clouds
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Background space color (very dark blue)
    vec3 col = vec3(0.002, 0.002, 0.006);
    
    float r = 0.42; // Sphere radius in UV space
    float d = length(uv);
    
    if (d < r) {
      // 3D normal vector on the sphere surface
      float z = sqrt(r * r - uv.x * uv.x - uv.y * uv.y);
      vec3 normal = normalize(vec3(uv.x, uv.y, z));
      
      // Time-based rotation and tilt axis
      float time = iTime * 0.12;
      float angleX = 0.35; // Tilt axis (~20 degrees)
      float cx = cos(angleX), sx = sin(angleX);
      float cy = cos(time), sy = sin(time);
      
      // Rotate coordinates: first X (tilt), then Y (spin)
      vec3 p = normal;
      vec3 p1 = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
      vec3 rotatedP = vec3(p1.x * cy - p1.z * sy, p1.y, p1.x * sy + p1.z * cy);
      
      // Spherical projection to equirectangular map UV coords
      float lon = atan(rotatedP.x, rotatedP.z);
      float lat = asin(rotatedP.y);
      vec2 texUV = vec2((lon / 3.14159265 + 1.0) * 0.5, (lat / 1.57079632 + 1.0) * 0.5);
      
      // Read Earth texture (R = Landmask, G = City lights)
      vec4 earthTex = texture2D(uHeightmap, texUV);
      bool isLand = earthTex.r > 0.45;
      float cityLights = earthTex.g;
      
      // Sun position rotates slowly, generating a day/night cycle
      vec3 sunDir = normalize(vec3(sin(iTime * 0.06 + 1.2), 0.22, cos(iTime * 0.06 + 1.2)));
      float diff = dot(normal, sunDir);
      
      vec3 earthCol;
      if (isLand) {
        // Natural Land colors (green/brown)
        vec3 forest = vec3(0.08, 0.35, 0.12);
        vec3 sand = vec3(0.42, 0.48, 0.25);
        vec3 snow = vec3(0.95, 0.95, 0.98);
        
        float detail = noise(rotatedP * 12.0);
        earthCol = mix(sand, forest, smoothstep(0.3, 0.7, detail));
        
        // Polar snow caps based on latitude
        float absLat = abs(p1.y);
        earthCol = mix(earthCol, snow, smoothstep(0.70, 0.90, absLat + detail * 0.15));
      } else {
        // Ocean depth coloring (shallow shore vs deep waters)
        float detail = noise(rotatedP * 8.0);
        vec3 deepOcean = vec3(0.02, 0.08, 0.26);
        vec3 coastWater = vec3(0.08, 0.34, 0.54);
        earthCol = mix(deepOcean, coastWater, smoothstep(0.2, 0.8, detail));
      }
      
      // 2. Compute cloud layer
      vec3 cloudP = rotatedP + vec3(iTime * 0.022, 0.0, iTime * 0.006);
      float cloudVal = fbm(cloudP * 4.2);
      float clouds = smoothstep(0.50, 0.76, cloudVal);
      
      // Cloud shadow cast direction
      vec3 shadowP = rotatedP - sunDir * 0.022 + vec3(iTime * 0.022, 0.0, iTime * 0.006);
      float shadowVal = fbm(shadowP * 4.2);
      float cloudShadow = smoothstep(0.50, 0.76, shadowVal);
      
      // Apply shadow darkening on surface
      earthCol *= mix(1.0, isLand ? 0.65 : 0.50, cloudShadow);
      
      // Day diffuse lighting
      float diffuse = clamp(diff, 0.0, 1.0);
      vec3 dayCol = earthCol * (0.05 + 0.95 * diffuse);
      
      // Add clouds lit by the sun
      dayCol = mix(dayCol, vec3(0.92, 0.92, 0.95) * (0.15 + 0.85 * diffuse), clouds);
      
      // Add specular sun reflection on oceans
      if (!isLand && diffuse > 0.0) {
        vec3 R = reflect(-sunDir, normal);
        float spec = pow(clamp(R.z, 0.0, 1.0), 12.0) * 0.28 * (1.0 - clouds);
        dayCol += vec3(spec);
      }
      
      // 3. Night lights on the dark side of landmasses
      float nightVal = smoothstep(0.08, -0.18, diff);
      vec3 nightCol = vec3(0.0);
      if (nightVal > 0.0) {
        float lightsNoise = noise(rotatedP * 120.0) * 0.15 + 0.85;
        vec3 goldenLights = vec3(0.98, 0.68, 0.15) * cityLights * lightsNoise * 2.8;
        nightCol += goldenLights * nightVal;
      }
      
      col = mix(dayCol, nightCol, nightVal);
      
      // 4. Atmospheric Fresnel limb glow
      float edgeGlow = pow(1.0 - normal.z, 3.5) * 0.6;
      col += vec3(0.35, 0.72, 0.96) * edgeGlow * clamp(diff + 0.38, 0.0, 1.0);
    } else {
      // Atmospheric scattering ring fade outside the sphere border
      float distToEdge = d - r;
      if (distToEdge < 0.06) {
        float outerGlow = pow(1.0 - distToEdge / 0.06, 3.5) * 0.28;
        vec2 sunUV = normalize(vec2(sin(iTime * 0.06 + 1.2), 0.22));
        float sunAlignment = max(0.1, dot(normalize(uv), sunUV));
        col += vec3(0.30, 0.68, 0.96) * outerGlow * sunAlignment;
      }
    }
    
    // Add subtle CRT scanlines
    col *= 0.94 + 0.06 * sin(fragCoord.y * 2.0);
    fragColor = vec4(col, 1.0);
  }
`;

function GlobePanel() {
  const [earthCanvas, setEarthCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Fill ocean (Red = 0, Green = 0)
      ctx.fillStyle = 'rgb(0,0,0)'
      ctx.fillRect(0, 0, 512, 256)

      let seed = 98765
      const rnd = () => {
        const x = Math.sin(seed++) * 10000
        return x - Math.floor(x)
      }

      // Draw seed-deterministic continent blobs (Red channel > 115 representing Land)
      ctx.fillStyle = 'rgb(255, 0, 0)'
      
      // Eurasia & Africa masses
      ctx.beginPath()
      ctx.arc(320, 90, 70, 0, Math.PI * 2) // Asia/Europe
      ctx.arc(280, 140, 55, 0, Math.PI * 2) // Africa
      ctx.arc(380, 110, 45, 0, Math.PI * 2) // East Asia
      ctx.fill()

      // Americas masses
      ctx.beginPath()
      ctx.arc(120, 80, 45, 0, Math.PI * 2) // North America
      ctx.arc(150, 170, 48, 0, Math.PI * 2) // South America
      ctx.fill()
      
      // Central America bridge
      ctx.lineWidth = 15
      ctx.strokeStyle = 'rgb(255, 0, 0)'
      ctx.beginPath()
      ctx.moveTo(120, 100)
      ctx.lineTo(140, 140)
      ctx.stroke()

      // Australia
      ctx.beginPath()
      ctx.arc(420, 180, 25, 0, Math.PI * 2)
      ctx.fill()

      // Antarctica
      ctx.fillRect(0, 230, 512, 26)

      // Add fractal land details on boundaries
      ctx.fillStyle = 'rgb(255, 0, 0)'
      for (let i = 0; i < 260; i++) {
        let cx = 0, cy = 0
        const group = rnd()
        if (group < 0.35) {
          cx = 260 + rnd() * 150
          cy = 60 + rnd() * 120
        } else if (group < 0.7) {
          cx = 90 + rnd() * 80
          cy = 50 + rnd() * 140
        } else if (group < 0.85) {
          cx = 390 + rnd() * 50
          cy = 160 + rnd() * 40
        } else {
          cx = rnd() * 512
          cy = rnd() * 256
        }
        const r = 4 + rnd() * 20
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Generate City lights strictly on land (Green channel)
      const imgData = ctx.getImageData(0, 0, 512, 256)
      const data = imgData.data
      
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x++) {
          const idx = (y * 512 + x) * 4
          const isLandPixel = data[idx] > 115
          
          if (isLandPixel) {
            const latFactor = Math.cos((y - 128) / 128 * Math.PI) // lower city density near polar/extreme latitudes
            const cityProb = rnd()
            
            // Antarctica cutoff (no cities below lat 0.8)
            if (y > 210) continue;

            if (cityProb > 0.985 * (1.5 - latFactor)) {
              const radius = Math.floor(1 + rnd() * 3)
              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  const ny = y + dy
                  const nx = (x + dx + 512) % 512
                  if (ny >= 0 && ny < 256) {
                    const nidx = (ny * 512 + nx) * 4
                    if (data[nidx] > 115) { // Confirm city light is on land
                      const dist = Math.sqrt(dx * dx + dy * dy)
                      const intens = Math.max(0, 255 * (1.0 - dist / radius))
                      data[nidx + 1] = Math.max(data[nidx + 1], Math.floor(intens))
                    }
                  }
                }
              }
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }
    setEarthCanvas(canvas)
  }, [])

  if (!earthCanvas) {
    return (
      <Panel title="GLOBAL SURVEILLANCE // PLANET WATCH">
        <div className="w-full h-full bg-black flex items-center justify-center text-green-500 text-xs font-mono">
          DECODING REAL WORLD DATA...
        </div>
      </Panel>
    )
  }

  return (
    <ShaderPanel
      fragmentShader={REAL_EARTH_SHADER}
      title="GLOBAL SURVEILLANCE // PLANET WATCH"
      attribution="Procedural Real-World Globe Mapping"
      textureData={{ data: earthCanvas, width: 512, height: 256 }}
    />
  )
}

export default memo(GlobePanel)
