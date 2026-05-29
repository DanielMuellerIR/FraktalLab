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

  vec3 hsl2rgb(in vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float fov = 1.2;
    float far = 150.0;
    float scale = 120.0;
    float horizon = iResolution.y * 0.42;

    // Sky gradient
    float sk = max(0.0, 15.0 - fragCoord.y * 0.25) / 255.0;
    vec3 skyCol = vec3(0.0, sk, sk * 1.3);

    if (fragCoord.y >= horizon) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float rayAngle = uAngle - fov/2.0 + (fragCoord.x / iResolution.x) * fov;
    float rdx = cos(rayAngle);
    float rdy = sin(rayAngle);

    float hitZ = -1.0;
    float hitHeight = 0.0;
    for (int i = 1; i < 150; i++) {
        float z = float(i);
        vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
        float wz = uCamH + (fragCoord.y - horizon) * z / scale;
        
        float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
        
        if (wz < th) {
            hitZ = z;
            hitHeight = th;
            break;
        }
    }

    if (hitZ < 0.0) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float fog = hitZ / far;
    float fade = 1.0 - fog;
    float hue = mod(hitHeight * 1.5 + iTime * 5.0, 360.0) / 360.0;
    vec3 landCol = hsl2rgb(vec3(hue, 0.95, 0.6));

    float wz_above = uCamH + ((fragCoord.y + 1.0) - horizon) * hitZ / scale;
    bool isTop = (wz_above >= hitHeight);
    
    vec3 col;
    if (isTop) {
        col = vec3(200.0/255.0 * fade + 55.0/255.0, fade, fade);
    } else {
        col = landCol * fade;
    }

    // Scanline overlay
    if (mod(floor(fragCoord.y), 2.0) == 0.0) {
        col = min(vec3(1.0), col + vec3(6.0/255.0));
    }

    fragColor = vec4(col, 1.0);
  }
`

const VOXEL_BW_SHADER = `
  uniform vec2 uCamPos;
  uniform float uAngle;
  uniform float uCamH;

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float fov = 1.2;
    float far = 150.0;
    float scale = 120.0;
    float horizon = iResolution.y * 0.42;

    // Sky gradient
    float sk = max(0.0, 12.0 - fragCoord.y * 0.2) / 255.0;
    vec3 skyCol = vec3(sk);

    if (fragCoord.y >= horizon) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float rayAngle = uAngle - fov/2.0 + (fragCoord.x / iResolution.x) * fov;
    float rdx = cos(rayAngle);
    float rdy = sin(rayAngle);

    float hitZ = -1.0;
    float hitHeight = 0.0;
    for (int i = 1; i < 150; i++) {
        float z = float(i);
        vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
        float wz = uCamH + (fragCoord.y - horizon) * z / scale;
        
        float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
        
        if (wz < th) {
            hitZ = z;
            hitHeight = th;
            break;
        }
    }

    if (hitZ < 0.0) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    float fog = hitZ / far;
    float lum = (1.0 - fog) * (220.0 / 255.0) * (0.45 + hitHeight / 510.0);
    vec3 col = vec3(lum);

    // Scanline overlay
    if (mod(floor(fragCoord.y), 2.0) == 0.0) {
        col = min(vec3(1.0), col + vec3(5.0/255.0));
    }

    fragColor = vec4(col, 1.0);
  }
`

// ── Voxel Demo Color Panel Component ─────────────────────────────────────────
// memo: AGENTS.md "alle Standalone-Panels in React.memo wrappen" (PERF-11).
// VoxelDemoColor + VoxelDemoBW waren vor diesem Audit die einzigen Ausreisser,
// siehe AUDIT_FINDINGS.md F-004 / H-03.
function VoxelDemoColorImpl() {
  const cam = useRef({
    x: 200, y: 300,
    vx: 1.5, vy: 0.8,
    angle: 0.8,
    lastT: 0,
  })

  // Stable uniforms reference for zero-rerender WebGL updates
  const uniformsRef = useRef({
    uCamPos: [200.0, 300.0],
    uAngle: 0.8,
    uCamH: 100.0,
  })

  useEffect(() => {
    // unsubscribe-Funktion aus subscribe(); null wenn nicht angemeldet.
    let unsubscribe: (() => void) | null = null
    let running = true

    function loop(t: number) {
      if (!running) return

      const c = cam.current
      if (c.lastT === 0) c.lastT = t
      const dt = Math.min(t - c.lastT, 50)
      c.lastT = t

      // Smooth serpentine canyon flight
      c.vx = 2.2
      c.vy = 1.4 * Math.sin(t * 0.0004)
      c.angle = t * 0.0002 + 0.3 * Math.cos(t * 0.0004)

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 68, 108 + 25 * Math.sin(t * 0.0003))

      // Direct in-place update of uniforms
      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = camH

      // Rekursiver rAF-Aufruf entfaellt: subscribe ruft loop() bei jedem Tick.
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
    angle: 2.1,
    lastT: 0,
  })

  // Stable uniforms reference for zero-rerender WebGL updates
  const uniformsRef = useRef({
    uCamPos: [350.0, 150.0],
    uAngle: 2.1,
    uCamH: 100.0,
  })

  useEffect(() => {
    // unsubscribe-Funktion aus subscribe(); null wenn nicht angemeldet.
    let unsubscribe: (() => void) | null = null
    let running = true

    function loop(t: number) {
      if (!running) return

      const c = cam.current
      if (c.lastT === 0) c.lastT = t
      c.lastT = t

      // Smooth circular orbit path around map center (256, 256)
      const orbitRadius = 160
      const orbitSpeed = t * 0.00015
      c.x = 256 + Math.cos(orbitSpeed) * orbitRadius
      c.y = 256 + Math.sin(orbitSpeed) * orbitRadius
      c.angle = orbitSpeed + Math.PI / 2 + 0.2 * Math.sin(t * 0.0005)

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 72, 115 + 20 * Math.cos(t * 0.0002))

      // Direct in-place update of uniforms
      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = camH

      // Rekursiver rAF-Aufruf entfaellt: subscribe ruft loop() bei jedem Tick.
    }

    unsubscribe = subscribe(loop)
    return () => {
      running = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <Panel title="VOXEL SURVEY // ORTHOGONAL MONOCHROME">
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
