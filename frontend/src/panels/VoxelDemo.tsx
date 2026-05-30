import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'
// rAF-Loops laufen ueber den zentralen raf-coordinator. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

const HMAP = 512
const heightmap = new Uint8Array(HMAP * HMAP)

for (let y = 0; y < HMAP; y++) {
  for (let x = 0; x < HMAP; x++) {
    heightmap[y * HMAP + x] = Math.floor(
      128
      + 55 * Math.sin(x * 0.018) * Math.cos(y * 0.013)
      + 28 * Math.sin(x * 0.047 + 1.2) * Math.cos(y * 0.038 + 0.8)
      + 14 * Math.sin(x * 0.11  + 2.1) * Math.cos(y * 0.09  + 1.5)
      +  7 * Math.sin(x * 0.23  + 0.5) * Math.cos(y * 0.19  + 2.3)
    )
  }
}

// ── Voxel Raymarching Shader ────────────────────────────────────────────────
const VOXEL_COLOR_SHADER = `
  uniform vec2 uCamPos;
  uniform float uAngle;
  uniform float uCamH;
  uniform float uRoll;

  vec3 hsl2rgb(in vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float fov = 1.2;
    float far = 180.0;
    float scale = 120.0;
    
    vec2 screen = fragCoord - iResolution.xy * 0.5;
    float cr = cos(uRoll);
    float sr = sin(uRoll);
    vec2 rotScreen = screen * mat2(cr, sr, -sr, cr);

    float skyY = rotScreen.y;
    float slope = skyY / scale;

    vec3 horizonSkyCol = vec3(0.9, 0.15, 0.45);
    vec3 spaceCol = vec3(0.05, 0.01, 0.12);

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
    for (int i = 0; i < 200; i++) {
        if (z >= far) break;
        vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
        float wz = uCamH + slope * z;
        
        float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
        
        if (wz < th) {
            float prevZ = z - (1.0 + (z - 1.0) * 0.015);
            float t_refine = 0.5;
            for (int j = 0; j < 3; j++) {
                float currZ = mix(prevZ, z, t_refine);
                vec2 wpos_c = uCamPos + vec2(rdx * currZ, rdy * currZ);
                float wz_c = uCamH + slope * currZ;
                float th_c = texture2D(uHeightmap, wpos_c / 512.0).r * 255.0;
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
        z += 1.0 + z * 0.015;
    }

    vec3 skyCol = mix(spaceCol, horizonSkyCol, exp(-max(0.0, skyY) * 0.02));

    if (hitZ < 0.0) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float fog = clamp(hitZ / far, 0.0, 1.0);
    float hue = mod(hitHeight * 0.8 + iTime * 4.0, 360.0) / 360.0;
    vec3 landCol = hsl2rgb(vec3(hue, 0.85, 0.55));
    
    vec3 col = mix(landCol, skyCol, fog);

    float wz_above = uCamH + (skyY + 1.0) * hitZ / scale;
    bool isTop = (wz_above >= hitHeight);
    float fade = 1.0 - fog;
    if (isTop) {
        col = mix(col, vec3(0.9, 0.9, 1.0) * fade + 0.1, 0.5);
    }

    if (mod(floor(fragCoord.y), 2.0) == 0.0) {
        col = min(vec3(1.0), col + vec3(8.0/255.0));
    }

    fragColor = vec4(col, 1.0);
  }
`

const VOXEL_BW_SHADER = `
  uniform vec2 uCamPos;
  uniform float uAngle;
  uniform float uCamH;
  uniform float uRoll;

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float fov = 1.2;
    float far = 180.0;
    float scale = 120.0;
    
    vec2 screen = fragCoord - iResolution.xy * 0.5;
    float cr = cos(uRoll);
    float sr = sin(uRoll);
    vec2 rotScreen = screen * mat2(cr, sr, -sr, cr);

    float skyY = rotScreen.y;
    float slope = skyY / scale;

    vec3 horizonSkyCol = vec3(0.75, 0.8, 0.85);
    vec3 spaceCol = vec3(0.08, 0.09, 0.12);

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
    for (int i = 0; i < 200; i++) {
        if (z >= far) break;
        vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
        float wz = uCamH + slope * z;
        
        float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
        
        if (wz < th) {
            float prevZ = z - (1.0 + (z - 1.0) * 0.015);
            float t_refine = 0.5;
            for (int j = 0; j < 3; j++) {
                float currZ = mix(prevZ, z, t_refine);
                vec2 wpos_c = uCamPos + vec2(rdx * currZ, rdy * currZ);
                float wz_c = uCamH + slope * currZ;
                float th_c = texture2D(uHeightmap, wpos_c / 512.0).r * 255.0;
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
        z += 1.0 + z * 0.015;
    }

    vec3 skyCol = mix(spaceCol, horizonSkyCol, exp(-max(0.0, skyY) * 0.02));

    if (hitZ < 0.0) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float fog = clamp(hitZ / far, 0.0, 1.0);
    float fade = 1.0 - fog;
    
    float t = hitHeight / 255.0;
    vec3 landCol = mix(vec3(0.1, 0.11, 0.13), vec3(0.85, 0.87, 0.9), smoothstep(0.4, 0.8, t));
    
    vec3 col = mix(landCol, skyCol, fog);

    float wz_above = uCamH + (skyY + 1.0) * hitZ / scale;
    bool isTop = (wz_above >= hitHeight);
    if (isTop) {
        col = mix(col, vec3(0.95, 0.97, 1.0) * fade + vec3(0.05), 0.6);
    }

    if (mod(floor(fragCoord.y), 2.0) == 0.0) {
        col = min(vec3(1.0), col + vec3(6.0/255.0));
    }

    fragColor = vec4(col, 1.0);
  }
`

// ── Voxel Demo Color Panel Component ─────────────────────────────────────────
function VoxelDemoColorImpl() {
  const cam = useRef({
    x: 200, y: 300,
    vx: 1.5, vy: 0.8,
    angle: 0.8,
    lastT: 0,
  })

  const uniformsRef = useRef({
    uCamPos: [200.0, 300.0],
    uAngle: 0.8,
    uCamH: 100.0,
    uRoll: 0.0,
  })

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let running = true

    function loop(t: number) {
      if (!running) return

      const c = cam.current
      if (c.lastT === 0) c.lastT = t
      const dt = Math.min(t - c.lastT, 50)
      c.lastT = t

      c.vx = 2.2
      c.vy = 1.4 * Math.sin(t * 0.0004)
      c.angle = t * 0.0002 + 0.3 * Math.cos(t * 0.0004)

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 68, 108 + 25 * Math.sin(t * 0.0003))
      const roll = 0.22 * Math.sin(t * 0.0005)

      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = camH
      u.uRoll = roll
    }

    unsubscribe = subscribe(loop)
    return () => {
      running = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <Panel title="VOXEL SPECTRAL // CHROMATIC SHIFT">
      <ShaderPanel
        fragmentShader={VOXEL_COLOR_SHADER}
        uniforms={uniformsRef.current}
        textureData={{ data: heightmap, width: HMAP, height: HMAP }}
        title=""
        attribution="Voxel Raymarching by Antigravity (GPU-Migration)"
      />
    </Panel>
  )
}

// ── Voxel Demo B&W Panel Component ───────────────────────────────────────────
function VoxelDemoBWImpl() {
  const cam = useRef({
    x: 350, y: 150,
    vx: 2.8, vy: 0.0,
    angle: 2.1,
    lastT: 0,
  })

  const uniformsRef = useRef({
    uCamPos: [350.0, 150.0],
    uAngle: 2.1,
    uCamH: 100.0,
    uRoll: 0.0,
  })

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let running = true

    function loop(t: number) {
      if (!running) return

      const c = cam.current
      if (c.lastT === 0) c.lastT = t
      const dt = Math.min(t - c.lastT, 50)
      c.lastT = t

      c.vx = 2.8
      c.vy = 2.0 * Math.sin(t * 0.0005)
      c.angle = t * 0.0003 + 0.45 * Math.cos(t * 0.0005)

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 64, 100 + 20 * Math.sin(t * 0.0003))
      const roll = 0.28 * Math.sin(t * 0.0006)

      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = camH
      u.uRoll = roll
    }

    unsubscribe = subscribe(loop)
    return () => {
      running = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <Panel title="VOXEL CANYON // MONOCHROME SURVEY">
      <ShaderPanel
        fragmentShader={VOXEL_BW_SHADER}
        uniforms={uniformsRef.current}
        textureData={{ data: heightmap, width: HMAP, height: HMAP }}
        title=""
        attribution="Voxel Raymarching by Antigravity (GPU-Migration)"
      />
    </Panel>
  )
}

// Memo-Wrapper als benannte Exporte. Komponenten haben keine Props (ausser
// optional onComplete) → Standard-Equality reicht. Verhindert unbeabsichtigtes
// Remount der rAF-Loop und Heightmap-Init bei Parent-Re-Render.
export const VoxelDemoColor = memo(VoxelDemoColorImpl)
export const VoxelDemoBW = memo(VoxelDemoBWImpl)
