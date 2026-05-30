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

  // Simplified Oren-Nayar diffuse lighting (retroreflective surface roughness)
  float orenNayarSimple(vec3 N, vec3 L, vec3 V, float roughness) {
    float ndotl = dot(N, L);
    float ndotv = dot(N, V);
    
    float cl = max(ndotl, 0.0);
    float cv = max(ndotv, 0.0);
    
    float sigma2 = roughness * roughness;
    float A = 1.0 - 0.5 * (sigma2 / (sigma2 + 0.33));
    float B = 0.45 * (sigma2 / (sigma2 + 0.09));
    
    // Project L and V onto the tangent plane and get cosine of difference
    float s = dot(L, V) - ndotl * ndotv;
    float t = mix(1.0, max(ndotl, ndotv), step(0.0, s));
    
    return cl * (A + B * (s / (t + 0.0001)));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Background space color (pitch black with subtle grey-blue vignette)
    vec3 spaceBg = vec3(0.001, 0.001, 0.003) * (1.0 - length(uv) * 0.5);
    vec3 col = spaceBg;
    
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
      
      // Central difference bump mapping: sample texture at small offsets
      vec2 eps = vec2(0.0015, 0.0);
      float h_l = texture2D(uHeightmap, texUV - eps.xy).r;
      float h_r = texture2D(uHeightmap, texUV + eps.xy).r;
      float h_d = texture2D(uHeightmap, texUV - eps.yx).r;
      float h_u = texture2D(uHeightmap, texUV + eps.yx).r;
      float baseHeight = texture2D(uHeightmap, texUV).r;
      
      // Calculate local gradients
      float bumpStrength = 0.65;
      float du = (h_r - h_l) * bumpStrength;
      float dv = (h_u - h_d) * bumpStrength;
      
      // Perturb normal in rotated frame using tangents relative to longitude/latitude
      vec3 rTangent = normalize(vec3(-rotatedP.z, 0.0, rotatedP.x));
      vec3 rBitangent = cross(rotatedP, rTangent);
      vec3 rNormal = normalize(rotatedP - rTangent * du - rBitangent * dv);
      
      // Rotate the perturbed normal back to world frame
      vec3 p1_back = vec3(rNormal.x * cy + rNormal.z * sy, rNormal.y, -rNormal.x * sy + rNormal.z * cy);
      vec3 perturbedNormal = normalize(vec3(p1_back.x, p1_back.y * cx + p1_back.z * sx, -p1_back.y * sx + p1_back.z * cx));
      
      // Sun position rotates slowly, generating moon phases (synodic month simulation)
      vec3 sunDir = normalize(vec3(sin(iTime * 0.05 - 0.5), 0.05, cos(iTime * 0.05 - 0.5)));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      
      // Lommel-Seeliger light reflection law for planetary dust/regolith
      float mu0 = clamp(dot(perturbedNormal, sunDir), 0.0, 1.0);
      float mu = clamp(normal.z, 0.0, 1.0);
      float ls = mu0 / (mu0 + mu + 0.08);
      
      // Oren-Nayar diffuse lighting (roughness = 0.45)
      float on = orenNayarSimple(perturbedNormal, sunDir, viewDir, 0.45);
      
      // Blend diffuse terms for authentic lunar regolith scattering
      float diffuse = mix(on, ls * 1.6, 0.65);
      
      // Lunar surface coloring (basaltic Maria vs anorthositic Highlands)
      vec3 highlands = vec3(0.78, 0.76, 0.72);
      vec3 maria = vec3(0.24, 0.23, 0.24);
      
      // Detailed 3D noise for mineralogical and local albedo variations
      float n1 = noise(rotatedP * 12.0) * 0.3 + 0.5;
      float n2 = noise(rotatedP * 45.0) * 0.1 + 0.5;
      float localMineral = n1 * 0.85 + n2 * 0.15;
      
      highlands = mix(highlands, vec3(0.85, 0.83, 0.78), localMineral * 0.4);
      maria = mix(maria, vec3(0.18, 0.18, 0.20), localMineral * 0.3);
      
      // Blend highlands and maria based on heightmap baseHeight
      float microNoiseVal = noise(rotatedP * 90.0) * 0.10 - 0.05;
      float albedoBlend = smoothstep(0.25, 0.65, baseHeight + microNoiseVal);
      vec3 moonAlbedo = mix(maria, highlands, albedoBlend);
      
      // Brighten crater rims and ejecta blanket slightly using heightmap elevation
      float elevationBoost = smoothstep(0.68, 0.95, baseHeight) * 0.12;
      moonAlbedo += vec3(elevationBoost);
      
      // Faint high-albedo rays from prominent craters (using high-frequency procedural overlays)
      float rayNoise = smoothstep(0.48, 0.58, noise(rotatedP * 24.0 + vec3(12.0)));
      moonAlbedo += vec3(0.06) * rayNoise * smoothstep(0.3, 1.0, albedoBlend);
      
      // Golden Earthshine in the shadow region
      float shadowMask = smoothstep(0.1, -0.4, dot(perturbedNormal, sunDir));
      float earthshineIntensity = clamp(perturbedNormal.z, 0.0, 1.0);
      vec3 earthshineColor = vec3(0.20, 0.15, 0.08); // rich subtle gold
      vec3 earthshine = earthshineColor * earthshineIntensity * shadowMask * 0.35;
      
      // Day lighting color
      vec3 dayCol = moonAlbedo * (diffuse * 1.9) + earthshine;
      
      // Specular highlight on glassy minerals
      if (mu0 > 0.0) {
        vec3 R = reflect(-sunDir, perturbedNormal);
        float spec = pow(clamp(dot(R, viewDir), 0.0, 1.0), 16.0) * 0.04 * (1.0 - albedoBlend);
        dayCol += vec3(spec);
      }
      
      col = dayCol;
      
      // Edge glow and limb-darkening
      float edgeGlow = pow(1.0 - normal.z, 4.0) * 0.18;
      col += vec3(0.85, 0.65, 0.35) * edgeGlow;
      
      float edgeFade = pow(1.0 - normal.z, 2.5);
      col *= (1.0 - edgeFade * 0.28);
      
      // Edge Anti-Aliasing
      float aa = smoothstep(r, r - 0.003, d);
      float glowDist = r - d;
      float outerGlow = exp(glowDist * 90.0) * 0.22;
      vec3 spaceCol = spaceBg + vec3(0.85, 0.65, 0.35) * outerGlow;
      
      col = mix(spaceCol, col, aa);
    } else {
      // Atmospheric outer rim glow
      float glowDist = d - r;
      if (glowDist < 0.04) {
        float glow = exp(-glowDist * 90.0) * 0.22;
        col += vec3(0.85, 0.65, 0.35) * glow;
      }
    }
    
    // Telemetry scanline styling
    col *= 0.97 + 0.03 * sin(fragCoord.y * 2.0);
    fragColor = vec4(col, 1.0);
  }
`

function MoonPanel() {
  const [moonCanvas, setMoonCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const width = 1024
    const height = 512
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      let seed = 4242
      const rnd = () => {
        const x = Math.sin(seed++) * 10000
        return x - Math.floor(x)
      }

      const drawWrapped = (x: number, y: number, drawFn: (cx: number, cy: number) => void) => {
        drawFn(x, y)
        drawFn(x + width, y)
        drawFn(x - width, y)
      }

      // Base height is middle gray (128 / #808080)
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, width, height)

      // 1. Basaltic maria basins representing lunar geography
      const mariaBasins = [
        { x: 300, y: 256, rx: 140, ry: 180 }, // Oceanus Procellarum
        { x: 440, y: 160, rx: 100, ry: 90 },  // Mare Imbrium
        { x: 580, y: 180, rx: 70, ry: 70 },   // Mare Serenitatis
        { x: 680, y: 240, rx: 80, ry: 60 },   // Mare Tranquillitatis
        { x: 840, y: 220, rx: 50, ry: 44 },   // Mare Crisium
        { x: 720, y: 340, rx: 70, ry: 60 },   // Mare Fecunditatis
        { x: 400, y: 360, rx: 80, ry: 70 }    // Mare Nubium
      ]

      ctx.fillStyle = 'rgba(75, 75, 75, 0.9)'
      ctx.filter = 'blur(24px)'
      mariaBasins.forEach(mb => {
        const drawBasin = (cx: number, cy: number) => {
          ctx.beginPath()
          ctx.ellipse(cx, cy, mb.rx, mb.ry, 0, 0, Math.PI * 2)
          ctx.fill()

          // Draw some smaller overlapping auxiliary ellipses for organic edges
          const numSub = 4
          for (let s = 0; s < numSub; s++) {
            const angle = (s / numSub) * Math.PI * 2
            const dist = 0.35 * Math.max(mb.rx, mb.ry)
            const sx = cx + Math.cos(angle) * dist * (0.8 + rnd() * 0.4)
            const sy = cy + Math.sin(angle) * dist * (0.8 + rnd() * 0.4)
            const srx = mb.rx * (0.45 + rnd() * 0.3)
            const sry = mb.ry * (0.45 + rnd() * 0.3)

            ctx.beginPath()
            ctx.ellipse(sx, sy, srx, sry, rnd() * Math.PI, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        drawWrapped(mb.x, mb.y, drawBasin)
      })

      ctx.filter = 'none'

      // Soft rolling topography ridges for the Highlands
      ctx.filter = 'blur(40px)'
      for (let i = 0; i < 40; i++) {
        const cx = rnd() * width
        const cy = rnd() * height
        const rx = 100 + rnd() * 150
        const ry = 80 + rnd() * 120
        const val = Math.round(110 + rnd() * 36) // height values from 110 to 146
        ctx.fillStyle = `rgba(${val}, ${val}, ${val}, 0.35)`
        
        drawWrapped(cx, cy, (x, y) => {
          ctx.beginPath()
          ctx.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2)
          ctx.fill()
        })
      }
      ctx.filter = 'none'

      // 2. Generate detailed organic craters (craters sorted from largest to smallest)
      const craters: { x: number; y: number; r: number }[] = []
      for (let i = 0; i < 400; i++) {
        const x = rnd() * width
        const y = rnd() * height
        // Bias towards smaller craters using power function
        const r = 1.8 + Math.pow(rnd(), 2.8) * 26
        craters.push({ x, y, r })
      }

      // Sort largest to smallest so smaller newer craters naturally overlap larger older ones
      craters.sort((a, b) => b.r - a.r)

      craters.forEach(c => {
        const r = c.r
        const outerR = r * 1.8

        const drawSingleCrater = (cx: number, cy: number) => {
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR)

          if (r > 6) {
            // Larger craters: include central peak, steep inner slope, raised rim crest
            const peakVal = Math.round(185 + rnd() * 35)
            const floorVal = Math.round(45 + rnd() * 15)
            const rimVal = Math.round(200 + rnd() * 30)
            const outerSlopeVal = Math.round(135 + rnd() * 15)

            grad.addColorStop(0.0, `rgba(${peakVal}, ${peakVal}, ${peakVal}, 1.0)`)
            grad.addColorStop(0.08, `rgba(${floorVal}, ${floorVal}, ${floorVal}, 1.0)`)
            grad.addColorStop(0.52, `rgba(${floorVal}, ${floorVal}, ${floorVal}, 1.0)`)
            grad.addColorStop(0.66, `rgba(${rimVal}, ${rimVal}, ${rimVal}, 1.0)`)
            grad.addColorStop(0.74, `rgba(${outerSlopeVal}, ${outerSlopeVal}, ${outerSlopeVal}, 0.6)`)
            grad.addColorStop(1.0, `rgba(128, 128, 128, 0.0)`)
          } else {
            // Smaller craters: simple bowl, no central peak
            const floorVal = Math.round(45 + rnd() * 15)
            const rimVal = Math.round(190 + rnd() * 25)
            const outerSlopeVal = Math.round(135 + rnd() * 10)

            grad.addColorStop(0.0, `rgba(${floorVal}, ${floorVal}, ${floorVal}, 1.0)`)
            grad.addColorStop(0.52, `rgba(${floorVal}, ${floorVal}, ${floorVal}, 1.0)`)
            grad.addColorStop(0.66, `rgba(${rimVal}, ${rimVal}, ${rimVal}, 1.0)`)
            grad.addColorStop(0.74, `rgba(${outerSlopeVal}, ${outerSlopeVal}, ${outerSlopeVal}, 0.5)`)
            grad.addColorStop(1.0, `rgba(128, 128, 128, 0.0)`)
          }

          ctx.fillStyle = grad
          ctx.beginPath()
          const steps = 16
          // Canonical seed for warp consistency across horizontal wrappers
          let warpSeed = Math.floor(c.x * 7919 + c.y * 5227)
          const localRnd = () => {
            const x = Math.sin(warpSeed++) * 10000
            return x - Math.floor(x)
          }

          for (let s = 0; s <= steps; s++) {
            const angle = (s / steps) * Math.PI * 2
            const warp = 1.0 + (localRnd() - 0.5) * 0.08 // slight organic irregular warp
            const rx = cx + Math.cos(angle) * outerR * warp
            const ry = cy + Math.sin(angle) * outerR * warp
            if (s === 0) ctx.moveTo(rx, ry)
            else ctx.lineTo(rx, ry)
          }
          ctx.closePath()
          ctx.fill()
        }

        drawWrapped(c.x, c.y, drawSingleCrater)
      })

      // 3. Add ejecta rays for prominent craters (e.g. Tycho-like, Copernicus-like)
      const prominentCraters = craters.slice(0, 6)
      prominentCraters.forEach(c => {
        const rayCount = Math.round(16 + rnd() * 16)

        const drawRays = (cx: number, cy: number) => {
          for (let rIdx = 0; rIdx < rayCount; rIdx++) {
            const angle = rnd() * Math.PI * 2
            const length = c.r * (3.5 + rnd() * 6)

            const targetX = cx + Math.cos(angle) * length
            const targetY = cy + Math.sin(angle) * length

            const grad = ctx.createLinearGradient(cx, cy, targetX, targetY)
            const rayBrightness = Math.round(180 + rnd() * 50)
            const opacity = 0.06 + rnd() * 0.08

            grad.addColorStop(0, `rgba(${rayBrightness}, ${rayBrightness}, ${rayBrightness}, ${opacity})`)
            grad.addColorStop(0.2, `rgba(${rayBrightness}, ${rayBrightness}, ${rayBrightness}, ${opacity * 0.7})`)
            grad.addColorStop(1, `rgba(128, 128, 128, 0)`)

            ctx.strokeStyle = grad
            ctx.lineWidth = 1 + rnd() * 1.5
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(targetX, targetY)
            ctx.stroke()
          }
        }

        drawWrapped(c.x, c.y, drawRays)
      })

      // 4. Fine micro-noise regolith dust texture is generated procedurally in the WebGL fragment shader (MOON_SHADER) for high performance.
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
      textureData={{ data: moonCanvas, width: 1024, height: 512 }}
    />
  )
}

export default memo(MoonPanel)
