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

    vec3 horizonSkyCol = vec3(1.0, 0.4, 0.15); // Vibrant orange sunset horizon
    vec3 spaceCol = vec3(0.12, 0.0, 0.28);     // Synthwave deep purple

    // Compute a clean sky gradient based on vertical coordinate
    float skyFactor = clamp((rotScreen.y / (iResolution.y * 0.5)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 skyCol = mix(horizonSkyCol, spaceCol, skyFactor);

    if (slope > 0.0 && uCamH > 255.0) {
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

    if (hitZ < 0.0) {
        fragColor = vec4(skyCol, 1.0);
        return;
    }

    // Smooth atmospheric fog fade (exponential)
    float fog = 1.0 - exp(-pow(hitZ * 0.012, 1.6));
    fog = clamp(fog, 0.0, 1.0);
    
    float hue = mod(hitHeight * 0.8 + iTime * 4.0, 360.0) / 360.0;
    vec3 landCol = hsl2rgb(vec3(hue, 0.85, 0.55));
    
    vec3 col = mix(landCol, skyCol, fog);

    float wz_above = uCamH + (skyY + 1.0) * hitZ / scale;
    bool isTop = (wz_above >= hitHeight);
    float fade = 1.0 - fog;
    if (isTop) {
        // Soft white ridge caps
        col = mix(col, vec3(0.95, 0.95, 1.0) * fade + 0.05, 0.45);
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

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 screen = fragCoord - iResolution.xy * 0.5;
    
    // Rotate coordinates based on camera angle
    float cosA = cos(uAngle * 0.3);
    float sinA = sin(uAngle * 0.3);
    vec2 rotScreen = screen * mat2(cosA, sinA, -sinA, cosA);
    
    float scale = 0.85;
    vec2 wpos = uCamPos + rotScreen * scale;
    
    // Sample height
    float h = texture2D(uHeightmap, wpos / 512.0).r;
    
    // Estimated normal for 3D relief shading
    float h_l = texture2D(uHeightmap, (wpos + vec2(-1.2, 0.0)) / 512.0).r;
    float h_r = texture2D(uHeightmap, (wpos + vec2(1.2, 0.0)) / 512.0).r;
    float h_d = texture2D(uHeightmap, (wpos + vec2(0.0, -1.2)) / 512.0).r;
    float h_u = texture2D(uHeightmap, (wpos + vec2(0.0, 1.2)) / 512.0).r;
    
    vec3 normal = normalize(vec3(h_l - h_r, h_d - h_u, 0.04));
    vec3 lightDir = normalize(vec3(0.5, 0.5, 0.8));
    float shade = dot(normal, lightDir) * 0.5 + 0.5;
    
    // Base colors for monochrome tactical map
    vec3 spaceCol = vec3(0.03, 0.04, 0.05);
    vec3 terrainCol = mix(vec3(0.01, 0.02, 0.03), vec3(0.18, 0.2, 0.23), h * h);
    vec3 color = mix(spaceCol, terrainCol, 0.75) * shade;
    
    // Tactical grid overlay
    vec2 gridPos = mod(fragCoord, 25.0);
    float grid = (smoothstep(0.8, 0.0, gridPos.x) + smoothstep(0.8, 0.0, gridPos.y));
    color += vec3(0.04, 0.05, 0.06) * grid;
    
    // Glowing contour lines (isolines)
    float rawH = h * 255.0;
    float interval = 16.0;
    float dist = mod(rawH, interval);
    float contour = smoothstep(0.8, 0.0, dist) + smoothstep(interval - 0.8, interval, dist);
    
    // Pulse contour lines based on height and time
    float pulse = 0.8 + 0.2 * sin(iTime * 1.5 - rawH * 0.1);
    vec3 contourCol = mix(vec3(0.2, 0.35, 0.5), vec3(0.85, 0.92, 1.0), h);
    color = mix(color, contourCol * pulse, contour * 0.75);
    
    // Radial radar sweep line
    float distToCenter = length(screen);
    float pixelAngle = atan(screen.y, screen.x);
    float sweepAngle = mod(iTime * 1.4, 6.28318) - 3.14159;
    float angleDiff = pixelAngle - sweepAngle;
    if (angleDiff < -3.14159) angleDiff += 6.28318;
    if (angleDiff > 3.14159) angleDiff -= 6.28318;
    
    if (angleDiff < 0.0 && angleDiff > -0.6) {
      float intensity = (1.0 + angleDiff / 0.6) * 0.18 * (1.0 - smoothstep(10.0, 300.0, distToCenter) * 0.5);
      color += vec3(0.5, 0.65, 0.85) * intensity;
    }
    
    // Radar sweep beam edge
    float beam = smoothstep(-0.015, 0.0, angleDiff) * smoothstep(0.015, 0.0, angleDiff);
    color += vec3(0.7, 0.85, 1.0) * beam * 0.35;
    
    // HUD crosshair and rings
    float centerCross = max(smoothstep(0.8, 0.0, abs(screen.x)), smoothstep(0.8, 0.0, abs(screen.y)));
    if (distToCenter > 12.0 && distToCenter < 140.0 && centerCross > 0.0) {
      color += vec3(0.35, 0.4, 0.45) * centerCross * 0.3;
    }
    
    for (float r = 60.0; r <= 240.0; r += 60.0) {
      float ring = smoothstep(1.2, 0.0, abs(distToCenter - r));
      color += vec3(0.25, 0.32, 0.38) * ring * 0.2;
    }
    
    // Intermittent tracking targets (fake blips)
    vec2 target1 = vec2(sin(iTime * 0.3) * 120.0, cos(iTime * 0.4) * 80.0);
    float blip1 = smoothstep(3.0, 0.0, length(screen - target1));
    if (blip1 > 0.0) {
      float pulseBlip = 0.5 + 0.5 * sin(iTime * 10.0);
      color = mix(color, vec3(0.9, 0.3, 0.3), blip1 * pulseBlip);
      
      // Target square bracket
      vec2 relT = abs(screen - target1);
      if (max(relT.x, relT.y) < 8.0 && min(relT.x, relT.y) > 5.0) {
        color = mix(color, vec3(0.9, 0.3, 0.3), pulseBlip);
      }
    }
    
    // CRT scan lines
    if (mod(floor(fragCoord.y), 2.0) == 0.0) {
      color *= 0.88;
    }
    
    fragColor = vec4(color, 1.0);
  }
`

// ── Voxel Demo Color Panel Component ─────────────────────────────────────────
function VoxelDemoColorImpl() {
  const cam = useRef({
    x: 200, y: 300,
    h: 120,
    vx: 1.5, vy: 0.8,
    angle: 0.8,
    lastT: 0,
  })

  const uniformsRef = useRef({
    uCamPos: [200.0, 300.0],
    uAngle: 0.8,
    uCamH: 120.0,
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
      const targetH = Math.max(terrainAtCam + 68, 108 + 25 * Math.sin(t * 0.0003))
      c.h += (targetH - c.h) * 0.08
      const roll = 0.22 * Math.sin(t * 0.0005)

      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = c.h
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

      c.vx = 0.5
      c.vy = 0.3 * Math.sin(t * 0.0002)
      c.angle = t * 0.00015 + 0.25 * Math.cos(t * 0.0002)

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP

      const u = uniformsRef.current
      u.uCamPos[0] = c.x
      u.uCamPos[1] = c.y
      u.uAngle = c.angle
      u.uCamH = 0.0
      u.uRoll = 0.0
    }

    unsubscribe = subscribe(loop)
    return () => {
      running = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <Panel title="TACTICAL TOPOGRAPHY // ORBITAL SURVEY">
      <ShaderPanel
        fragmentShader={VOXEL_BW_SHADER}
        uniforms={uniformsRef.current}
        textureData={{ data: heightmap, width: HMAP, height: HMAP }}
        title=""
        attribution="Orbital Contour Map by Antigravity"
      />
    </Panel>
  )
}

// Memo-Wrapper als benannte Exporte. Komponenten haben keine Props (ausser
// optional onComplete) → Standard-Equality reicht. Verhindert unbeabsichtigtes
// Remount der rAF-Loop und Heightmap-Init bei Parent-Re-Render.
export const VoxelDemoColor = memo(VoxelDemoColorImpl)
export const VoxelDemoBW = memo(VoxelDemoBWImpl)
