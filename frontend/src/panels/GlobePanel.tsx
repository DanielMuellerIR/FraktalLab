import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import Panel from '../ui/Panel'
import { EARTH_BASE64 } from '../utils/earth-map-base64'

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
    for (int i = 0; i < 4; i++) {
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
        vec3 forest = vec3(0.06, 0.48, 0.16); // Vibrant emerald forest
        vec3 sand = vec3(0.52, 0.46, 0.28);   // Natural earth/sand tone
        vec3 snow = vec3(0.96, 0.96, 0.98);   // Crisp polar ice cap
        
        float detail = noise(rotatedP * 12.0);
        earthCol = mix(sand, forest, smoothstep(0.3, 0.7, detail));
        
        // Polar snow caps based on latitude
        float absLat = abs(p1.y);
        earthCol = mix(earthCol, snow, smoothstep(0.70, 0.90, absLat + detail * 0.15));
      } else {
        // Ocean depth coloring (shallow shore vs deep waters)
        float detail = noise(rotatedP * 8.0);
        vec3 deepOcean = vec3(0.005, 0.03, 0.16);  // Deep abyssal navy blue
        vec3 coastWater = vec3(0.04, 0.26, 0.46); // Luminous cyan coastal waters
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
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 512, 256)
      
      // Post-process the loaded map:
      // - Ensure land has high Red channel (>115, e.g. 255)
      // - City lights remain in the Green channel
      const imgData = ctx.getImageData(0, 0, 512, 256)
      const data = imgData.data
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        
        if (r > 100) {
          data[i] = 255     // Land mask (Red)
          data[i + 1] = g   // Keep original city lights (Green)
          data[i + 2] = 0   // Blue = 0
        } else if (g > 100) {
          // Tactical city nodes outside high red channel (ensure mapped as land + lights)
          data[i] = 255
          data[i + 1] = 255
          data[i + 2] = 0
        } else {
          // Ocean: R = 0, G = 0, B = 0
          data[i] = 0
          data[i + 1] = 0
          data[i + 2] = 0
        }
      }
      ctx.putImageData(imgData, 0, 0)
      setEarthCanvas(canvas)
    }
    img.src = `data:image/webp;base64,${EARTH_BASE64}`
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
