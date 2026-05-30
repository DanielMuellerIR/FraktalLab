import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import Panel from '../ui/Panel'

const MOON_SHADER = `
  precision highp float;
  uniform sampler2D uHeightmap;

  // 3D Value Noise for surface details
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

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Background space color (pitch black with subtle grey-blue vignette)
    vec3 col = vec3(0.001, 0.001, 0.003) * (1.0 - length(uv) * 0.5);
    
    float r = 0.42; // Sphere radius in UV space
    float d = length(uv);
    
    if (d < r) {
      // 3D normal vector on the sphere surface
      float z = sqrt(r * r - uv.x * uv.x - uv.y * uv.y);
      vec3 normal = normalize(vec3(uv.x, uv.y, z));
      
      // Time-based rotation and tilt axis (slow spin)
      float time = iTime * 0.04;
      float angleX = 0.12; // Moon orbital tilt (~6.68 degrees)
      float cx = cos(angleX), sx = sin(angleX);
      float cy = cos(time), sy = sin(time);
      
      // Rotate coordinates: tilt X, spin Y
      vec3 p = normal;
      vec3 p1 = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
      vec3 rotatedP = vec3(p1.x * cy - p1.z * sy, p1.y, p1.x * sy + p1.z * cy);
      
      // Spherical projection to equirectangular map UV coords
      float lon = atan(rotatedP.x, rotatedP.z);
      float lat = asin(rotatedP.y);
      vec2 texUV = vec2((lon / 3.14159265 + 1.0) * 0.5, (lat / 1.57079632 + 1.0) * 0.5);
      
      // Read Moon crater heightmap texture
      vec4 moonTex = texture2D(uHeightmap, texUV);
      float baseHeight = moonTex.r;
      
      // Bump mapping: sample texture at small offsets
      vec2 eps = vec2(0.004, 0.0);
      float h_u = texture2D(uHeightmap, texUV + eps.xy).r;
      float h_v = texture2D(uHeightmap, texUV + eps.yx).r;
      
      // Calculate local gradients
      float bumpStrength = 0.22;
      vec3 bump = vec3((baseHeight - h_u) * bumpStrength, (baseHeight - h_v) * bumpStrength, 1.0);
      
      // Approximate tangents on sphere surface
      vec3 tangent = normalize(vec3(-rotatedP.z, 0.0, rotatedP.x));
      vec3 bitangent = cross(normal, tangent);
      
      // Perturb normal using bump gradients
      vec3 perturbedNormal = normalize(normal + tangent * bump.x + bitangent * bump.y);
      
      // Sun position rotates slowly, generating moon phases (synodic month simulation)
      vec3 sunDir = normalize(vec3(sin(iTime * 0.05 - 0.5), 0.05, cos(iTime * 0.05 - 0.5)));
      
      // Lunar surface coloring (basaltic Maria vs anorthositic Highlands)
      vec3 highlands = vec3(0.72, 0.70, 0.67);
      vec3 maria = vec3(0.24, 0.23, 0.24);
      
      float microNoise = noise(rotatedP * 80.0) * 0.12 - 0.06;
      float albedoBlend = smoothstep(0.22, 0.65, baseHeight + microNoise);
      vec3 moonAlbedo = mix(maria, highlands, albedoBlend);
      
      float rayNoise = smoothstep(0.48, 0.58, noise(rotatedP * 24.0 + vec3(12.0)));
      moonAlbedo += vec3(0.08) * rayNoise * smoothstep(0.3, 1.0, albedoBlend);
      
      // Lommel-Seeliger light reflection law for planetary dust/regolith
      float mu0 = clamp(dot(perturbedNormal, sunDir), 0.0, 1.0);
      float mu = clamp(normal.z, 0.0, 1.0);
      float ls = mu0 / (mu0 + mu + 0.04);
      
      float earthshine = clamp(-dot(perturbedNormal, sunDir), 0.0, 1.0) * 0.02;
      vec3 dayCol = moonAlbedo * (ls * 1.85 + earthshine * 0.15);
      
      if (mu0 > 0.0) {
        vec3 R = reflect(-sunDir, perturbedNormal);
        float rimSpec = pow(clamp(R.z, 0.0, 1.0), 8.0) * 0.05 * (1.0 - albedoBlend);
        dayCol += vec3(rimSpec);
      }
      
      col = dayCol;
      
      float edgeFade = pow(1.0 - normal.z, 1.5);
      col *= (1.0 - edgeFade * 0.25);
    }
    
    col *= 0.96 + 0.04 * sin(fragCoord.y * 2.0);
    fragColor = vec4(col, 1.0);
  }
`;

function MoonPanel() {
  const [moonCanvas, setMoonCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      let seed = 12345
      const rnd = () => {
        const x = Math.sin(seed++) * 10000
        return x - Math.floor(x)
      }

      ctx.fillStyle = '#888888'
      ctx.fillRect(0, 0, 512, 256)

      // Dark basalt maria representing actual lunar geography
      ctx.fillStyle = '#3a3a3a'
      const mariaBasins = [
        { x: 150, y: 128, rx: 70, ry: 90 }, // Oceanus Procellarum
        { x: 220, y: 80, rx: 50, ry: 45 },  // Mare Imbrium
        { x: 290, y: 90, rx: 35, ry: 35 },  // Mare Serenitatis
        { x: 340, y: 120, rx: 40, ry: 30 }, // Mare Tranquillitatis
        { x: 420, y: 110, rx: 25, ry: 22 }, // Mare Crisium
        { x: 360, y: 170, rx: 35, ry: 30 }, // Mare Fecunditatis
        { x: 200, y: 180, rx: 40, ry: 35 }  // Mare Nubium
      ]

      mariaBasins.forEach(mb => {
        ctx.beginPath()
        ctx.ellipse(mb.x, mb.y, mb.rx, mb.ry, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(mb.x + 512, mb.y, mb.rx, mb.ry, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(mb.x - 512, mb.y, mb.rx, mb.ry, 0, 0, Math.PI * 2)
        ctx.fill()
      })

      // Craters (bright rim, dark floor, central peaks)
      for (let i = 0; i < 180; i++) {
        const x = rnd() * 512
        const y = rnd() * 256
        const r = 2 + rnd() * 14

        ctx.fillStyle = '#222222'
        ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + 512, y, r * 1.35, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x - 512, y, r * 1.35, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#dddddd'
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + 512, y, r, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x - 512, y, r, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#4a4a4a'
        ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + 512, y, r * 0.75, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x - 512, y, r * 0.75, 0, Math.PI * 2); ctx.fill()

        if (r > 4.5) {
          ctx.fillStyle = '#dddddd'
          ctx.beginPath(); ctx.arc(x, y, 0.8 + r * 0.08, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(x + 512, y, 0.8 + r * 0.08, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(x - 512, y, 0.8 + r * 0.08, 0, Math.PI * 2); ctx.fill()
        }
      }

      const imgData = ctx.getImageData(0, 0, 512, 256)
      const data = imgData.data
      for (let j = 0; j < data.length; j += 4) {
        const n = (rnd() - 0.5) * 18
        data[j] = Math.max(0, Math.min(255, data[j] + n))
        data[j + 1] = Math.max(0, Math.min(255, data[j + 1] + n))
        data[j + 2] = Math.max(0, Math.min(255, data[j + 2] + n))
      }
      ctx.putImageData(imgData, 0, 0)
    }
    setMoonCanvas(canvas)
  }, [])

  if (!moonCanvas) {
    return (
      <Panel title="LUNAR OBSERVATORY // ORBITAL TELEMETRY">
        <div className="w-full h-full bg-black flex items-center justify-center text-green-400 text-xs font-mono">
          ACQUIRING LUNAR ORBIT TELEMETRY...
        </div>
      </Panel>
    )
  }

  return (
    <ShaderPanel
      fragmentShader={MOON_SHADER}
      title="LUNAR OBSERVATORY // ORBITAL TELEMETRY"
      attribution="Procedural Lunar Surface Map"
      textureData={{ data: moonCanvas, width: 512, height: 256 }}
    />
  )
}

export default memo(MoonPanel)
