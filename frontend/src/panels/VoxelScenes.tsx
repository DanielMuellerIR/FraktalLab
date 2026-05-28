import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import ShaderPanel from '../ui/ShaderPanel'

// ── Neon-Grid-Renderer (eigenständige Komponente, kein Voxel-Engine) ───────────
interface Tower {
  gx: number
  gz: number
  height: number
  width: number
  type: number
  windowDensity: number
  windowOffset: number
  antennaHeight: number
}

export function VoxelNeonGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    const resize = () => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let cameraZ = 0
    const GRID_SPACING = 32
    const MAJOR_EVERY  = 5
    const NUM_TOWERS   = 18
    const VIEW_DEPTH   = 600
    const TOWER_SPREAD = 10

    const createTower = (gx: number, gz: number): Tower => ({
      gx,
      gz,
      height: 35 + Math.random() * 105,
      width: 10 + Math.random() * 14,
      type: Math.floor(Math.random() * 3),
      windowDensity: 2 + Math.floor(Math.random() * 3),
      windowOffset: Math.floor(Math.random() * 6),
      antennaHeight: 15 + Math.random() * 25,
    })

    const towers: Tower[] = Array.from({ length: NUM_TOWERS }, () => {
      const gx = Math.round((Math.random() * 2 - 1) * TOWER_SPREAD)
      const gz = Math.floor(Math.random() * (VIEW_DEPTH / GRID_SPACING))
      return createTower(gx, gz)
    })

    function project(wx: number, wz: number, W: number, H: number): { sx: number; sy: number; scale: number } | null {
      const camEye = 40
      const focalLength = H * 0.9
      const relZ = wz - cameraZ
      if (relZ <= 1) return null
      const scale  = focalLength / relZ
      const sx     = W / 2 + wx * scale
      const sy     = H * 0.45 + camEye * scale
      return { sx, sy, scale }
    }

    function loop() {
      if (!running) return
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const W = canvas!.width
      const H = canvas!.height
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }

      cameraZ += 0.25

      const frontZ = Math.floor((cameraZ + VIEW_DEPTH) / GRID_SPACING)
      for (const tower of towers) {
        if (tower.gz < Math.floor(cameraZ / GRID_SPACING) - 1) {
          const nt = createTower(
            Math.round((Math.random() * 2 - 1) * TOWER_SPREAD),
            frontZ + Math.floor(Math.random() * 4)
          )
          Object.assign(tower, nt)
        }
      }

      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, W, H)

      const horizonY = H * 0.45
      const grd = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 30)
      grd.addColorStop(0, 'rgba(0,255,255,0)')
      grd.addColorStop(0.5, 'rgba(0,255,255,0.08)')
      grd.addColorStop(1, 'rgba(0,255,255,0)')
      ctx.fillStyle = grd
      ctx.fillRect(0, horizonY - 30, W, 60)

      const zFirst = Math.ceil(cameraZ / GRID_SPACING) * GRID_SPACING
      const zLast  = zFirst + VIEW_DEPTH
      const xMin = -TOWER_SPREAD * GRID_SPACING * 2
      const xMax =  TOWER_SPREAD * GRID_SPACING * 2

      for (let iz = zFirst; iz <= zLast; iz += GRID_SPACING) {
        const pLeft  = project(xMin, iz, W, H)
        const pRight = project(xMax, iz, W, H)
        if (!pLeft || !pRight) continue

        const isMajor = Math.round(iz / GRID_SPACING) % MAJOR_EVERY === 0
        const fog = Math.max(0, 1 - (iz - cameraZ) / VIEW_DEPTH)
        const alpha = fog * (isMajor ? 0.9 : 0.45)

        ctx.beginPath()
        ctx.moveTo(pLeft.sx, pLeft.sy)
        ctx.lineTo(pRight.sx, pRight.sy)
        ctx.strokeStyle = `rgba(0,255,255,${alpha.toFixed(3)})`
        ctx.lineWidth   = isMajor ? 1.5 : 0.7
        ctx.stroke()
      }

      const xLineCount = Math.round((xMax - xMin) / GRID_SPACING)
      for (let xi = 0; xi <= xLineCount; xi++) {
        const wx = xMin + xi * GRID_SPACING
        const pFront = project(wx, cameraZ + GRID_SPACING, W, H)
        const pBack  = project(wx, zLast, W, H)
        if (!pFront || !pBack) continue

        const isMajor = xi % MAJOR_EVERY === 0
        const lateralFog = Math.max(0, 1 - Math.abs(wx) / (TOWER_SPREAD * GRID_SPACING))
        const alpha = lateralFog * (isMajor ? 0.85 : 0.38)

        ctx.beginPath()
        ctx.moveTo(pFront.sx, pFront.sy)
        ctx.lineTo(pBack.sx, pBack.sy)
        ctx.strokeStyle = `rgba(0,255,255,${alpha.toFixed(3)})`
        ctx.lineWidth   = isMajor ? 1.4 : 0.65
        ctx.stroke()
      }

      const sortedTowers = [...towers].sort((a, b) => b.gz * GRID_SPACING - a.gz * GRID_SPACING)
      for (const tower of sortedTowers) {
        const wx = tower.gx * GRID_SPACING
        const wz = tower.gz * GRID_SPACING

        const base = project(wx, wz, W, H)
        if (!base) continue

        const fog = Math.max(0, 1 - (wz - cameraZ) / VIEW_DEPTH)
        if (fog <= 0) continue
        const alpha = fog * 0.85

        interface TowerBlock {
          w: number
          y0: number
          y1: number
        }
        const blocks: TowerBlock[] = []

        if (tower.type === 1) {
          blocks.push({ w: tower.width, y0: 0, y1: tower.height * 0.4 })
          blocks.push({ w: tower.width * 0.7, y0: tower.height * 0.4, y1: tower.height * 0.75 })
          blocks.push({ w: tower.width * 0.45, y0: tower.height * 0.75, y1: tower.height })
        } else {
          blocks.push({ w: tower.width, y0: 0, y1: tower.height })
        }

        for (const block of blocks) {
          const leftBase = project(wx - block.w / 2, wz, W, H)
          const rightBase = project(wx + block.w / 2, wz, W, H)
          if (!leftBase || !rightBase) continue

          const screenWidth = Math.max(2, rightBase.sx - leftBase.sx)
          const screenHeight = Math.max(2, (block.y1 - block.y0) * base.scale)
          const screenX = leftBase.sx
          const screenY = base.sy - block.y1 * base.scale

          ctx.fillStyle = `rgba(255, 0, 255, ${alpha.toFixed(3)})`
          ctx.fillRect(screenX, screenY, screenWidth, screenHeight)

          ctx.fillStyle = `rgba(255, 128, 255, ${(fog * 0.7).toFixed(3)})`
          ctx.fillRect(screenX, screenY, screenWidth, Math.max(1.5, screenHeight * 0.05))

          const cols = Math.max(1, Math.floor(block.w / (tower.windowDensity * 1.5)))
          const rows = Math.max(1, Math.floor((block.y1 - block.y0) / (tower.windowDensity * 2)))

          const padX = screenWidth * 0.15
          const padY = screenHeight * 0.15
          const useWidth = screenWidth - padX * 2
          const useHeight = screenHeight - padY * 2

          const winColor = (tower.gx + tower.gz) % 2 === 0 ? 'rgba(0, 255, 255, ' : 'rgba(255, 230, 0, '

          for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
              const winSeed = Math.sin((c + tower.windowOffset) * 12.3 + (r + tower.windowOffset) * 37.7 + wz)
              if (winSeed > 0.3) continue

              const winX = screenX + padX + (cols > 1 ? (c / (cols - 1)) * useWidth : useWidth / 2)
              const winY = screenY + padY + (rows > 1 ? (r / (rows - 1)) * useHeight : useHeight / 2)

              const winW = Math.max(1, 1.2 * base.scale)
              const winH = Math.max(1.5, 2.0 * base.scale)

              ctx.fillStyle = `${winColor}${alpha.toFixed(3)})`
              ctx.fillRect(winX - winW / 2, winY - winH / 2, winW, winH)
            }
          }
        }

        const topY = base.sy - tower.height * base.scale
        const centerX = base.sx
        const antennaWorldHeight = tower.antennaHeight
        const antennaTopY = topY - antennaWorldHeight * base.scale

        ctx.beginPath()
        ctx.moveTo(centerX, topY)
        ctx.lineTo(centerX, antennaTopY)
        ctx.strokeStyle = `rgba(255, 128, 255, ${alpha.toFixed(3)})`
        ctx.lineWidth = Math.max(0.5, 0.4 * base.scale)
        ctx.stroke()

        if (tower.type === 2 || tower.height > 90) {
          const blink = Math.floor(Date.now() / 300) % 2 === 0
          if (blink) {
            const beaconRadius = Math.max(2, 2.5 * base.scale)
            ctx.beginPath()
            ctx.arc(centerX, antennaTopY, beaconRadius, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255, 30, 30, ${alpha.toFixed(3)})`
            ctx.fill()

            ctx.beginPath()
            ctx.arc(centerX, antennaTopY, beaconRadius * 2, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255, 30, 30, ${(alpha * 0.4).toFixed(3)})`
            ctx.fill()
          }
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="NEON GRID // SECTOR Ω">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

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
    })

    useEffect(() => {
      let rafId: number
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

        c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
        c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
        c.angle += c.va * dt/16

        const tx = Math.floor(c.x) & (HMAP - 1)
        const ty = Math.floor(c.y) & (HMAP - 1)
        let terrainAtCam = heightmap[ty * HMAP + tx]
        if (waveGlsl) {
          terrainAtCam += Math.sin(tx * 0.15 + t * 0.003) * 6.0
        }
        const camH = Math.max(terrainAtCam + camHFloor, camHBase + camHAmp * Math.sin(t * 0.0004))

        const u = uniformsRef.current
        u.uCamPos[0] = c.x
        u.uCamPos[1] = c.y
        u.uAngle = c.angle
        u.uCamH = camH

        rafId = requestAnimationFrame(loop)
      }

      rafId = requestAnimationFrame(loop)
      return () => {
        running = false
        cancelAnimationFrame(rafId)
      }
    }, [])

    const shaderSource = `
      uniform vec2 uCamPos;
      uniform float uAngle;
      uniform float uCamH;

      ${colorGlsl}

      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        float fov = 1.25;
        float far = 600.0;
        float scale = 110.0;
        float horizon = iResolution.y * 0.44;

        vec3 horizonSkyCol = ${title.includes('LAVA') ? 'vec3(0.55, 0.11, 0.02)' : 'vec3(0.0, 0.35, 0.25)'};
        vec3 spaceCol = ${title.includes('LAVA') ? 'vec3(0.04, 0.005, 0.0)' : 'vec3(0.0, 0.02, 0.05)'};

        float skyY = fragCoord.y - horizon;
        if (skyY >= 0.0) {
            float skyGlow = exp(-skyY * 0.03);
            vec3 skyCol = horizonSkyCol * skyGlow + spaceCol;
            fragColor = vec4(skyCol, 1.0);
            return;
        }

        float rayAngle = uAngle - fov/2.0 + (fragCoord.x / iResolution.x) * fov;
        float rdx = cos(rayAngle);
        float rdy = sin(rayAngle);

        float hitZ = -1.0;
        float hitHeight = 0.0;
        for (float z = 1.0; z < 600.0; z += 1.0 + z * 0.015) {
            vec2 wpos = uCamPos + vec2(rdx * z, rdy * z);
            float wz = uCamH + (fragCoord.y - horizon) * z / scale;
            
            float th = texture2D(uHeightmap, wpos / 512.0).r * 255.0;
            ${waveGlsl ? `th += ${waveGlsl};` : ''}
            
            if (wz < th) {
                hitZ = z;
                hitHeight = th;
                break;
            }
        }

        if (hitZ < 0.0) {
            fragColor = vec4(horizonSkyCol + spaceCol, 1.0);
            return;
        }

        float fog = clamp(hitZ / far, 0.0, 1.0);
        vec3 col = getTerrainColor(hitHeight, fog);
        col = mix(col, horizonSkyCol + spaceCol, fog);

        ${brightBoost ? `
        float lum = max(col.r, max(col.g, col.b));
        if (lum > ${brightThreshold.toFixed(1)} / 255.0) {
            col = min(vec3(1.0), col * ${brightBoost.toFixed(1)});
        }
        ` : ''}

        float wz_above = uCamH + ((fragCoord.y + 1.0) - horizon) * hitZ / scale;
        bool isTop = (wz_above >= hitHeight);
        float fade = 1.0 - fog;
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
    camHBase: 110, camHAmp: 15, camHFloor: 65,
    renderOverlay: VoxelThermalOverlay,
  },
)

// Lava: heightmap with extra high frequencies
const hmLava = buildHeightmap([
  { sx: 0.008, sy: 0.006, amp: 28 },
  { sx: 0.022, sy: 0.017, amp: 52, px: 2.3, py: 1.1 },
  { sx: 0.053, sy: 0.041, amp: 22, px: 0.9, py: 3.2 },
  { sx: 0.11,  sy: 0.083, amp: 18, px: 1.5, py: 0.8 },
  { sx: 0.22,  sy: 0.166, amp: 9,  px: 3.1, py: 2.4 },
])

// ── Variante: NEON GRID ───────────────────────────────────────────────────────
import VectorHudPanel from './VectorHudPanel'
export const VoxelNeon = VectorHudPanel

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

// ── Variante: PHOSPHOR TERRAIN ────────────────────────────────────────────────
import NeuralNetPanel from './NeuralNetPanel'
export const VoxelMatrix = NeuralNetPanel
