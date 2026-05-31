import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import Panel from '../ui/Panel'
import { VECTOR_EARTH } from '../utils/vector-earth'

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

const MEGACITIES = [
  // North America
  { lon: -74.00, lat: 40.71, r: 4.2 },   // New York
  { lon: -118.24, lat: 34.05, r: 3.8 },  // Los Angeles
  { lon: -87.62, lat: 41.87, r: 3.2 },   // Chicago
  { lon: -99.13, lat: 19.43, r: 3.2 },   // Mexico City
  { lon: -122.41, lat: 37.77, r: 2.8 },  // San Francisco
  { lon: -73.56, lat: 45.50, r: 2.2 },   // Montreal
  { lon: -95.36, lat: 29.76, r: 2.8 },   // Houston
  { lon: -80.19, lat: 25.76, r: 2.2 },   // Miami
  // South America
  { lon: -46.63, lat: -23.55, r: 3.8 },  // Sao Paulo
  { lon: -43.17, lat: -22.90, r: 2.8 },  // Rio de Janeiro
  { lon: -58.38, lat: -34.60, r: 3.2 },  // Buenos Aires
  { lon: -70.64, lat: -33.44, r: 2.2 },  // Santiago
  { lon: -74.07, lat: 4.71, r: 2.2 },    // Bogota
  // Europe
  { lon: -0.12, lat: 51.50, r: 3.8 },    // London
  { lon: 2.35, lat: 48.85, r: 3.2 },     // Paris
  { lon: 37.61, lat: 55.75, r: 3.2 },    // Moscow
  { lon: 12.49, lat: 41.90, r: 2.2 },    // Rome
  { lon: 13.40, lat: 52.52, r: 2.2 },    // Berlin
  { lon: -3.70, lat: 40.41, r: 2.2 },    // Madrid
  { lon: 4.90, lat: 52.37, r: 2.2 },     // Amsterdam
  { lon: 21.01, lat: 52.23, r: 1.8 },    // Warsaw
  { lon: 29.00, lat: 41.00, r: 2.8 },    // Istanbul
  // Africa
  { lon: 31.23, lat: 30.04, r: 3.2 },    // Cairo
  { lon: 28.04, lat: -26.20, r: 2.2 },   // Johannesburg
  { lon: 3.37, lat: 6.52, r: 2.8 },      // Lagos
  // Asia
  { lon: 139.69, lat: 35.67, r: 4.8 },   // Tokyo
  { lon: 121.47, lat: 31.23, r: 4.2 },   // Shanghai
  { lon: 116.40, lat: 39.90, r: 3.8 },   // Beijing
  { lon: 126.97, lat: 37.56, r: 3.8 },   // Seoul
  { lon: 103.85, lat: 1.35, r: 3.2 },    // Singapore
  { lon: 77.20, lat: 28.61, r: 3.8 },    // New Delhi
  { lon: 72.87, lat: 19.07, r: 3.8 },    // Mumbai
  { lon: 106.84, lat: -6.20, r: 3.2 },   // Jakarta
  { lon: 120.98, lat: 14.59, r: 2.8 },   // Manila
  { lon: 100.50, lat: 13.75, r: 2.8 },   // Bangkok
  // Australia
  { lon: 151.20, lat: -33.86, r: 2.8 },  // Sydney
  { lon: 144.96, lat: -37.81, r: 2.2 },  // Melbourne
]

function GlobePanel() {
  const [earthCanvas, setEarthCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // Generate high-resolution 1024x512 texture canvas (absolute sharpness)
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Fill ocean with solid black (R = 0, G = 0, B = 0)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 1024, 512)

    // 2. Draw landmasses in solid red (R = 255, G = 0, B = 0)
    ctx.fillStyle = '#ff0000'
    VECTOR_EARTH.forEach(poly => {
      if (poly.length < 2) return
      ctx.beginPath()
      poly.forEach((pt, idx) => {
        const px = (pt.lon + 180) * (1024 / 360)
        const py = (90 - pt.lat) * (512 / 180)
        if (idx === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()
      ctx.fill()
    })

    // 3. Draw sharp golden megacity lights in Yellow (R = 255, G = 255, B = 0)
    // Red = 255 keeps it classified as land, Green = 255 maps the light in the shader
    MEGACITIES.forEach(c => {
      const px = (c.lon + 180) * (1024 / 360)
      const py = (90 - c.lat) * (512 / 180)
      
      const grad = ctx.createRadialGradient(px, py, 0, px, py, c.r * 1.8)
      grad.addColorStop(0, 'rgba(255, 255, 0, 1.0)')      // core light
      grad.addColorStop(0.3, 'rgba(255, 255, 0, 0.75)')    // metropolitan sprawl
      grad.addColorStop(1, 'rgba(255, 255, 0, 0.0)')      // soft edge glow
      
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, c.r * 1.8, 0, Math.PI * 2)
      ctx.fill()
    })

    // 4. Add subtle coastal light noise clusters for other populated regions
    // (Eastern US, Europe, East Asia, Southeastern Brazil)
    let seed = 98765
    const rnd = () => {
      const x = Math.sin(seed++) * 10000
      return x - Math.floor(x)
    }

    const drawLightSpeckle = (lon: number, lat: number, density: number, radius: number) => {
      for (let i = 0; i < density; i++) {
        const offsetLon = (rnd() - 0.5) * radius
        const offsetLat = (rnd() - 0.5) * radius
        const px = (lon + offsetLon + 180) * (1024 / 360)
        const py = (90 - (lat + offsetLat)) * (512 / 180)

        // Draw tiny light speckle
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 1.2 + rnd() * 1.5)
        grad.addColorStop(0, 'rgba(255, 255, 0, 0.7)')
        grad.addColorStop(1, 'rgba(255, 255, 0, 0.0)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, 1.2 + rnd() * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Speckle high density areas
    drawLightSpeckle(-95.0, 38.0, 50, 12.0)  // Eastern/Central USA
    drawLightSpeckle(10.0, 50.0, 60, 10.0)   // Western & Central Europe
    drawLightSpeckle(115.0, 30.0, 60, 10.0)  // Eastern China
    drawLightSpeckle(135.0, 35.0, 25, 4.0)   // Japan islands
    drawLightSpeckle(-48.0, -22.0, 20, 5.0)  // Southeastern Brazil (Rio/Sao Paulo region)

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
      textureData={{ data: earthCanvas, width: 1024, height: 512 }}
    />
  )
}

export default memo(GlobePanel)
