import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'
// rAF-Loops laufen ueber den zentralen raf-coordinator. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

// ── Konstanten ────────────────────────────────────────────────────────────────
const HMAP = 512

function buildHeightmap(
  octaves: Array<{ sx: number; sy: number; amp: number; px?: number; py?: number }>
): Uint8Array {
  const hm = new Uint8Array(HMAP * HMAP)
  for (let y = 0; y < HMAP; y++) {
    for (let x = 0; x < HMAP; x++) {
      let v = 128
      for (const o of octaves) {
        v += o.amp * Math.sin(x * o.sx + (o.px ?? 0)) * Math.cos(y * o.sy + (o.py ?? 0))
      }
      hm[y * HMAP + x] = Math.max(0, Math.min(255, Math.round(v)))
    }
  }
  return hm
}

// ── Voxel-Space-Render-Fabrik (GPU-Raymarching) ───────────────────────────────
function makeVoxelScene(
  title: string,
  _maxW: number, _maxH: number,
  heightmap: Uint8Array,
  colorGlsl: string,
  camCfg: {
    vx: number; vy: number; va: number
    speedMin?: number; speedMax?: number; impulseScale?: number
    lateralDrift?: boolean
  },
  opts: {
    camHBase?: number; camHAmp?: number; camHFloor?: number
    brightBoost?: number
    brightThreshold?: number
    waveGlsl?: string
    renderOverlay?: () => React.ReactNode
  } = {}
): React.NamedExoticComponent<any> {
  const {
    camHBase        = 110,
    camHAmp         = 30,
    camHFloor       = 70,
    brightBoost,
    brightThreshold = 178,
    waveGlsl,
    renderOverlay,
  } = opts

  return React.memo(function VoxelScene() {
    const cam = useRef({
      x: 150 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      vx: camCfg.vx * (0.8 + Math.random() * 0.4),
      vy: camCfg.vy * (0.8 + Math.random() * 0.4),
      targetVx: camCfg.vx * (0.8 + Math.random() * 0.4),
      targetVy: camCfg.vy * (0.8 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      va: camCfg.va,
      targetVa: camCfg.va,
      lastImpulse: -5000,
      lastT: 0,
    })

    const uniformsRef = useRef({
      uCamPos: [0.0, 0.0],
      uAngle: 0.0,
      uCamH: 100.0,
      uRoll: 0.0,
    })

    useEffect(() => {
      // unsubscribe-Funktion aus subscribe(); null wenn nicht angemeldet.
      let unsubscribe: (() => void) | null = null
      let running = true
      const speedMin     = camCfg.speedMin     ?? 0.8
      const speedMax     = camCfg.speedMax     ?? 5
      const impulseScale = camCfg.impulseScale ?? 3

      function loop(t: number) {
        if (!running) return

        const c = cam.current
        if (c.lastT === 0) c.lastT = t
        const dt = Math.min(t - c.lastT, 50)
        c.lastT = t

        if (t - c.lastImpulse > 3000 + Math.random() * 3000) {
          if (camCfg.lateralDrift) {
            const perpAngle = c.angle + Math.PI / 2
            const impMag = speedMin + Math.random() * (speedMax - speedMin) * 0.5
            c.targetVx = Math.cos(perpAngle) * impMag
            c.targetVy = Math.sin(perpAngle) * impMag
          } else {
            c.targetVx += (Math.random() - 0.5) * impulseScale
            c.targetVy += (Math.random() - 0.5) * impulseScale
          }
          c.targetVa += (Math.random() - 0.5) * 0.003
          c.lastImpulse = t
        }

        const lerpVal = 1 - Math.pow(0.94, dt / 16.7)
        c.vx = c.vx + (c.targetVx - c.vx) * lerpVal
        c.vy = c.vy + (c.targetVy - c.vy) * lerpVal
        c.va = c.va + (c.targetVa - c.va) * lerpVal

        c.vx *= 0.992
        c.vy *= 0.992
        c.va *= 0.995

        const targetSpeed = Math.sqrt(c.targetVx*c.targetVx + c.targetVy*c.targetVy)
        if (targetSpeed < speedMin) { c.targetVx += (Math.random()-0.5)*1.0; c.targetVy += (Math.random()-0.5)*1.0 }
        if (targetSpeed > speedMax) { c.targetVx *= speedMax/targetSpeed; c.targetVy *= speedMax/targetSpeed }
        let camH = 100
        let roll = 0.0

        if (title.includes('LAVA')) {
          // Volcanic spiral orbit trajectory around map center (256, 256)
          const centerX = 256.0
          const centerY = 256.0
          const orbitRadius = 150.0 + 85.0 * Math.sin(t * 0.00015)
          const orbitAngle = t * 0.00022
          
          c.x = centerX + Math.cos(orbitAngle) * orbitRadius
          c.y = centerY + Math.sin(orbitAngle) * orbitRadius
          // Dynamic camera orientation looking inward with lead angle
          c.angle = orbitAngle + Math.PI + 0.38 * Math.cos(t * 0.00025)
          
          const tx = Math.floor(c.x) & (HMAP - 1)
          const ty = Math.floor(c.y) & (HMAP - 1)
          let terrainAtCam = heightmap[ty * HMAP + tx]
          if (waveGlsl) {
            terrainAtCam += Math.sin(tx * 0.15 + t * 0.003) * 6.0
          }
          // Steep 3D dive/rise cycle
          const heightCycle = Math.sin(t * 0.00035) * 0.5 + 0.5 // 0..1
          camH = Math.max(terrainAtCam + camHFloor, camHBase + camHAmp * (heightCycle * 3.8 - 1.2))
          roll = 0.55 * Math.sin(t * 0.0003) // Dynamic banking roll
        } else {
          c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
          c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
          c.angle += c.va * dt/16

          const tx = Math.floor(c.x) & (HMAP - 1)
          const ty = Math.floor(c.y) & (HMAP - 1)
          let terrainAtCam = heightmap[ty * HMAP + tx]
          if (waveGlsl) {
            terrainAtCam += Math.sin(tx * 0.15 + t * 0.003) * 6.0
          }
          camH = Math.max(terrainAtCam + camHFloor, camHBase + camHAmp * Math.sin(t * 0.0004))
          roll = 0.0
        }

        const u = uniformsRef.current
        u.uCamPos[0] = c.x
        u.uCamPos[1] = c.y
        u.uAngle = c.angle
        u.uCamH = camH
        u.uRoll = roll
        // Rekursiver rAF-Aufruf entfaellt: subscribe ruft loop() jeden Tick.
      }

      unsubscribe = subscribe(loop)
      return () => {
        running = false
        if (unsubscribe) unsubscribe()
      }
    }, [])

    const shaderSource = `
      uniform vec2 uCamPos;
      uniform float uAngle;
      uniform float uCamH;
      uniform float uRoll;

      ${colorGlsl}

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        float fov = 1.25;
        float far = 600.0;
        float scale = 110.0;
        float horizon = iResolution.y * 0.44;

        vec3 horizonSkyCol = ${title.includes('LAVA') ? 'vec3(0.55, 0.11, 0.02)' : 'vec3(0.0, 0.35, 0.25)'};
        vec3 spaceCol = ${title.includes('LAVA') ? 'vec3(0.04, 0.005, 0.0)' : 'vec3(0.0, 0.02, 0.05)'};

        // Rotate screen coordinates by uRoll to support rolling flight
        vec2 screen = fragCoord - iResolution.xy * 0.5;
        float cr = cos(uRoll);
        float sr = sin(uRoll);
        vec2 rotScreen = screen * mat2(cr, sr, -sr, cr);

        float skyY = rotScreen.y;
        float slope = skyY / scale;

        // If the ray points upwards (slope > 0) and we start above the terrain, we might miss the terrain
        if (slope > 0.0 && uCamH > 255.0) {
            float skyGlow = exp(-skyY * 0.025);
            vec3 skyCol = mix(spaceCol, horizonSkyCol, skyGlow);
            fragColor = vec4(skyCol, 1.0);
            return;
        }

        float rayAngle = uAngle - fov/2.0 + ((rotScreen.x + iResolution.x * 0.5) / iResolution.x) * fov;
        float rdx = cos(rayAngle);
        float rdy = sin(rayAngle);

        float hitZ = -1.0;
        float hitHeight = 0.0;
        float z = 1.0;
        float prevZ = 1.0;
        for (int i = 0; i < 300; i++) {
            if (z >= 600.0) break;
            vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
            float wz = uCamH + slope * z;
            
            float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
            ${waveGlsl ? `th += ${waveGlsl};` : ''}
            
            if (wz < th) {
                // Refine intersection point via binary search
                float t_refine = 0.5;
                for (int j = 0; j < 4; j++) {
                    float currZ = mix(prevZ, z, t_refine);
                    vec2 wpos_c = uCamPos + vec2(rdx * currZ, rdy * currZ);
                    float wz_c = uCamH + slope * currZ;
                    float th_c = texture2D(uHeightmap, wpos_c / 512.0).r * 255.0;
                    ${waveGlsl ? `th_c += ${waveGlsl.replace(/wpos\./g, 'wpos_c.')};` : ''}
                    if (wz_c < th_c) {
                        z = currZ;
                        t_refine *= 0.5;
                    } else {
                        prevZ = currZ;
                        t_refine = (t_refine + 1.0) * 0.5;
                    }
                }
                hitZ = z;
                hitHeight = th;
                break;
            }
            prevZ = z;
            z += 1.0 + z * 0.012;
        }

        vec3 skyCol = mix(spaceCol, horizonSkyCol, exp(-max(0.0, skyY) * 0.025));

        // Soft vertical fade near the horizon/sky to prevent hard clipping border
        float verticalFade = smoothstep(-35.0, -2.0, skyY);

        if (hitZ < 0.0) {
            fragColor = vec4(skyCol, 1.0);
            return;
        }

        float fog = clamp(hitZ / far, 0.0, 1.0);
        float totalFog = max(fog, verticalFade);
        vec3 col = getTerrainColor(hitHeight, totalFog);
        col = mix(col, skyCol, totalFog);

        ${brightBoost ? `
        float lum = max(col.r, max(col.g, col.b));
        if (lum > ${brightThreshold.toFixed(1)} / 255.0) {
            col = min(vec3(1.0), col * ${brightBoost.toFixed(1)});
        }
        ` : ''}

        float wz_above = uCamH + (skyY + 1.0) * hitZ / scale;
        bool isTop = (wz_above >= hitHeight);
        float fade = 1.0 - totalFog;
        if (isTop) {
            col = mix(col, vec3(200.0/255.0 * fade + 55.0/255.0, fade, fade), 0.7);
        }

        if (mod(floor(fragCoord.y), 2.0) == 0.0) {
            col = min(vec3(1.0), col + vec3(8.0/255.0));
        }

        fragColor = vec4(col, 1.0);
      }
    `

    return (
      <Panel title={title}>
        <div className="w-full h-full relative">
          <ShaderPanel
            fragmentShader={shaderSource}
            uniforms={uniformsRef.current}
            textureData={{ data: heightmap, width: HMAP, height: HMAP }}
            title=""
            attribution="Voxel Raymarching by Antigravity (GPU-Migration)"
          />
          {renderOverlay && renderOverlay()}
        </div>
      </Panel>
    )
  })
}

// ── Terrain-Heightmaps ────────────────────────────────────────────────────────

// Sanfte Hügel für Thermal-Scanner
const hmSmooth = buildHeightmap([
  { sx: 0.012, sy: 0.009, amp: 60 },
  { sx: 0.031, sy: 0.025, amp: 30, px: 1.5, py: 0.7 },
  { sx: 0.071, sy: 0.058, amp: 15, px: 2.8, py: 1.9 },
])

// ── Variante: THERMAL SCAN ────────────────────────────────────────────────────
const THERMAL_GLSL_COLOR = `
  vec3 getTerrainColor(float th, float fog) {
    float t = th / 255.0;
    float f = 1.0 - fog * 0.55;
    vec3 col;
    if (t < 0.125) {
      float p = t / 0.125;
      col = vec3(25.0 + p * 35.0, 0.0, 50.0 + p * 30.0) / 255.0;
    } else if (t < 0.25) {
      float p = (t - 0.125) / 0.125;
      col = vec3(60.0 - p * 60.0, 0.0, 80.0 + p * 175.0) / 255.0;
    } else if (t < 0.375) {
      float p = (t - 0.25) / 0.125;
      col = vec3(0.0, p * 255.0, 255.0) / 255.0;
    } else if (t < 0.5) {
      float p = (t - 0.375) / 0.125;
      col = vec3(0.0, 255.0, 255.0 - p * 255.0) / 255.0;
    } else if (t < 0.625) {
      float p = (t - 0.5) / 0.125;
      col = vec3(p * 255.0, 255.0, 0.0) / 255.0;
    } else if (t < 0.75) {
      float p = (t - 0.625) / 0.125;
      col = vec3(255.0, 255.0 - p * 128.0, 0.0) / 255.0;
    } else if (t < 0.875) {
      float p = (t - 0.75) / 0.125;
      col = vec3(255.0, 127.0 - p * 127.0, 0.0) / 255.0;
    } else {
      float p = (t - 0.875) / 0.125;
      col = vec3(255.0, p * 255.0, p * 255.0) / 255.0;
    }
    return col * f;
  }
`

const VoxelThermalOverlay = () => {
  return (
    <>
      {/* Blinking REC beacon top left */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 select-none pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
        <span className="font-mono text-[9px] text-red-600 font-bold uppercase tracking-wider">REC</span>
      </div>

      {/* HUD info box top right */}
      <div className="absolute top-2 right-2 px-3 py-2 bg-black/60 border border-green-950/30 text-[9px] font-mono text-green-500 rounded select-none pointer-events-none uppercase tracking-wider leading-relaxed z-10">
        <div>IR: 8-14μm BAND</div>
        <div>TEMP: -20..+60°C</div>
        <div>RES: NATIVE GPU</div>
      </div>
    </>
  )
}

export const VoxelThermal = makeVoxelScene(
  'THERMAL SCAN // IR SPECTRUM',
  480, 300,
  hmSmooth,
  THERMAL_GLSL_COLOR,
  { vx: 1.0, vy: 0.4, va: 0.0008, speedMin: 0.6, speedMax: 3.0, lateralDrift: true },
  {
    camHBase: 80, camHAmp: 12, camHFloor: 38,
    renderOverlay: VoxelThermalOverlay,
  },
)

// Lava: heightmap with extra high frequencies and ridged features
const hmLava = (() => {
  const hm = new Uint8Array(HMAP * HMAP)
  for (let y = 0; y < HMAP; y++) {
    for (let x = 0; x < HMAP; x++) {
      let n1 = Math.sin(x * 0.008) * Math.cos(y * 0.006)
      let n2 = Math.sin(x * 0.022 + 2.3) * Math.cos(y * 0.017 + 1.1)
      let n3 = Math.sin(x * 0.053 + 0.9) * Math.cos(y * 0.041 + 3.2)
      let n4 = Math.sin(x * 0.11 + 1.5) * Math.cos(y * 0.083 + 0.8)
      
      let r1 = 1.0 - Math.abs(n1)
      let r2 = 1.0 - Math.abs(n2)
      let r3 = 1.0 - Math.abs(n3)
      let r4 = 1.0 - Math.abs(n4)
      
      let v = 45 + 115 * r1 + 65 * (r2 * r2) + 25 * r3 + 12 * r4
      hm[y * HMAP + x] = Math.max(0, Math.min(255, Math.round(v)))
    }
  }
  return hm
})()

// ── Variante: NEON GRID ───────────────────────────────────────────────────────
const NEON_GLSL_COLOR = `
  vec3 getTerrainColor(float th, float fog) {
    float t = th / 255.0;
    float f = 1.0 - fog * 0.65;
    vec3 col = mix(vec3(0.95, 0.02, 0.65), vec3(0.0, 0.9, 0.95), sin(t * 10.0 + iTime * 1.5) * 0.5 + 0.5);
    return col * f;
  }
`

const hmNeon = buildHeightmap([
  { sx: 0.012, sy: 0.012, amp: 40 },
  { sx: 0.035, sy: 0.035, amp: 22, px: 0.8, py: 1.2 },
])

export const VoxelNeon = makeVoxelScene(
  'VOXEL NEON // RETRO SYNTH',
  480, 300,
  hmNeon,
  NEON_GLSL_COLOR,
  { vx: 1.2, vy: 0.6, va: 0.0006, speedMin: 0.8, speedMax: 2.5 },
  {
    camHBase: 85, camHAmp: 20, camHFloor: 42,
    brightBoost: 1.3,
    brightThreshold: 160,
    waveGlsl: 'sin(wpos.x * 0.09 + iTime * 2.2) * 10.0 + cos(wpos.y * 0.09 - iTime * 1.8) * 10.0',
  }
)

// ── Variante: LAVA FLOW ───────────────────────────────────────────────────────
const LAVA_GLSL_COLOR = `
  vec3 getTerrainColor(float th, float fog) {
    float t = th / 255.0;
    float f = 1.0 - fog * 0.58;
    vec3 col;
    if (t < 0.18) {
      float p = t / 0.18;
      col = vec3(10.0 + p * 16.0, 0.0, 0.0) / 255.0;
    } else if (t < 0.38) {
      float p = (t - 0.18) / 0.20;
      col = vec3(26.0 + p * 76.0, 0.0, 0.0) / 255.0;
    } else if (t < 0.58) {
      float p = (t - 0.38) / 0.20;
      col = vec3(102.0 + p * 102.0, p * 34.0, 0.0) / 255.0;
    } else if (t < 0.78) {
      float p = (t - 0.58) / 0.20;
      col = vec3(204.0 + p * 51.0, 34.0 + p * 68.0, 0.0) / 255.0;
    } else {
      float p = (t - 0.78) / 0.22;
      col = vec3(255.0, 102.0 + p * 153.0, p * 180.0) / 255.0;
    }
    return col * f;
  }
`

export const VoxelLava = makeVoxelScene(
  'LAVA FLOW // VOLCANIC HAZARD',
  480, 300,
  hmLava,
  LAVA_GLSL_COLOR,
  { vx: 0.1, vy: 0.08, va: 0.0001, speedMin: 0.05, speedMax: 0.25 },
  {
    camHBase: 95, camHAmp: 18, camHFloor: 52,
    brightBoost:     1.4,
    brightThreshold: 178,
    waveGlsl: 'sin(wpos.x * 0.15 + iTime * 3.0) * 6.0',
  },
)
