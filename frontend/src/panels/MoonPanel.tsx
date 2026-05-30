import { memo, useEffect, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'
import Panel from '../ui/Panel'

const MOON_SHADER = `
  precision highp float;
  uniform sampler2D uHeightmap;

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

    vec3 spaceBg = vec3(0.001, 0.001, 0.003) * (1.0 - length(uv) * 0.5);
    vec3 col = spaceBg;

    float r = 0.42;
    float d = length(uv);

    if (d < r) {
      float z = sqrt(r * r - uv.x * uv.x - uv.y * uv.y);
      vec3 normal = normalize(vec3(uv.x, uv.y, z));

      // Slow rotation
      float time = iTime * 0.04;
      float angleX = 0.12;
      float cx = cos(angleX), sx = sin(angleX);
      float cy = cos(time), sy = sin(time);

      vec3 p = normal;
      vec3 p1 = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
      vec3 rotatedP = vec3(p1.x * cy - p1.z * sy, p1.y, p1.x * sy + p1.z * cy);

      // Equirectangular map UV
      float lon = atan(rotatedP.x, rotatedP.z);
      float lat = asin(clamp(rotatedP.y, -1.0, 1.0));
      vec2 texUV = vec2((lon / 3.14159265 + 1.0) * 0.5, (lat / 1.57079632 + 1.0) * 0.5);

      // === Bump mapping with larger epsilon and much stronger perturbation ===
      vec2 eps = vec2(0.004, 0.0);
      float h_c = texture2D(uHeightmap, texUV).r;
      float h_l = texture2D(uHeightmap, texUV - eps.xy).r;
      float h_r = texture2D(uHeightmap, texUV + eps.xy).r;
      float h_d = texture2D(uHeightmap, texUV - eps.yx).r;
      float h_u = texture2D(uHeightmap, texUV + eps.yx).r;

      float bumpStrength = 2.5;
      float du = (h_r - h_l) * bumpStrength;
      float dv = (h_u - h_d) * bumpStrength;

      // Build tangent frame on the sphere — avoid pole singularity
      // Use rotatedP as the surface normal direction
      vec3 up = abs(rotatedP.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 rTangent = normalize(cross(up, rotatedP));
      vec3 rBitangent = cross(rotatedP, rTangent);
      vec3 rNormal = normalize(rotatedP - rTangent * du - rBitangent * dv);

      // Rotate perturbed normal back to camera frame
      vec3 p1_back = vec3(rNormal.x * cy + rNormal.z * sy, rNormal.y, -rNormal.x * sy + rNormal.z * cy);
      vec3 perturbedNormal = normalize(vec3(p1_back.x, p1_back.y * cx + p1_back.z * sx, -p1_back.y * sx + p1_back.z * cx));

      // Sun position generates moon phases
      vec3 sunDir = normalize(vec3(sin(iTime * 0.05 - 0.5), 0.05, cos(iTime * 0.05 - 0.5)));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);

      // Lommel-Seeliger + Oren-Nayar blend
      float mu0 = clamp(dot(perturbedNormal, sunDir), 0.0, 1.0);
      float mu = clamp(perturbedNormal.z, 0.0, 1.0);
      float ls = mu0 / (mu0 + mu + 0.08);

      // Simplified Oren-Nayar
      float ndotl = dot(perturbedNormal, sunDir);
      float ndotv = perturbedNormal.z;
      float cl = max(ndotl, 0.0);
      float sigma2 = 0.45 * 0.45;
      float A = 1.0 - 0.5 * (sigma2 / (sigma2 + 0.33));
      float B = 0.45 * (sigma2 / (sigma2 + 0.09));
      float s = dot(sunDir, viewDir) - ndotl * ndotv;
      float t2 = mix(1.0, max(ndotl, ndotv), step(0.0, s));
      float on = cl * (A + B * (s / (t2 + 0.001)));

      float diffuse = mix(on, ls * 1.6, 0.60);

      // Surface color: warm highlands vs cool dark maria
      vec3 highlands = vec3(0.80, 0.77, 0.72);
      vec3 maria = vec3(0.22, 0.21, 0.22);

      float n1 = noise(rotatedP * 12.0) * 0.3 + 0.5;
      float n2 = noise(rotatedP * 45.0) * 0.1 + 0.5;
      float localMineral = n1 * 0.85 + n2 * 0.15;

      highlands = mix(highlands, vec3(0.86, 0.82, 0.76), localMineral * 0.4);
      maria = mix(maria, vec3(0.16, 0.16, 0.19), localMineral * 0.3);

      float microNoise = noise(rotatedP * 90.0) * 0.10 - 0.05;
      float albedoBlend = smoothstep(0.25, 0.65, h_c + microNoise);
      vec3 moonAlbedo = mix(maria, highlands, albedoBlend);

      // Crater rim brightening
      float rimBright = smoothstep(0.68, 0.95, h_c) * 0.14;
      moonAlbedo += vec3(rimBright);

      // Ejecta rays
      float rayNoise = smoothstep(0.48, 0.58, noise(rotatedP * 24.0 + vec3(12.0)));
      moonAlbedo += vec3(0.07) * rayNoise * smoothstep(0.3, 1.0, albedoBlend);

      // Earthshine in the shadow
      float shadowMask = smoothstep(0.08, -0.35, dot(perturbedNormal, sunDir));
      float earthshineIntensity = clamp(perturbedNormal.z, 0.0, 1.0);
      vec3 earthshine = vec3(0.22, 0.17, 0.10) * earthshineIntensity * shadowMask * 0.45;

      col = moonAlbedo * (diffuse * 2.0) + earthshine;

      // Specular
      if (mu0 > 0.0) {
        vec3 R = reflect(-sunDir, perturbedNormal);
        float spec = pow(clamp(dot(R, viewDir), 0.0, 1.0), 20.0) * 0.05 * (1.0 - albedoBlend);
        col += vec3(spec);
      }

      // Limb darkening — stronger
      float limbFactor = 1.0 - normal.z;
      col *= 1.0 - pow(limbFactor, 2.0) * 0.35;

      // Edge glow
      float edgeGlow = pow(limbFactor, 5.0) * 0.15;
      col += vec3(0.85, 0.65, 0.35) * edgeGlow;

      // Anti-aliasing
      float aa = smoothstep(r, r - 0.003, d);
      float glowDist = r - d;
      float outerGlow = exp(glowDist * 90.0) * 0.22;
      vec3 spaceCol = spaceBg + vec3(0.85, 0.65, 0.35) * outerGlow;
      col = mix(spaceCol, col, aa);
    } else {
      float glowDist = d - r;
      if (glowDist < 0.04) {
        float glow = exp(-glowDist * 90.0) * 0.22;
        col += vec3(0.85, 0.65, 0.35) * glow;
      }
    }

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
