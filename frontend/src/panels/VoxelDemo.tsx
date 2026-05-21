import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Shared Heightmap ─────────────────────────────────────────────────────────
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

// HSL -> RGB Converter
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)]
}

// ── Voxel Color Renderer ─────────────────────────────────────────────────────
function renderVoxelColor(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camX: number, camY: number, angle: number, camH: number, t: number,
) {
  const W = Math.min(canvas.width,  400)
  const H = Math.min(canvas.height, Math.round(400 * canvas.height / Math.max(canvas.width, 1)))

  const img = ctx.createImageData(W, H)
  const buf = img.data

  const horizon = H * 0.42
  const scale   = 120
  const FOV     = 1.2
  const FAR     = 150

  // Sky gradient (dark teal/black)
  for (let y = 0; y < H; y++) {
    const sk = Math.max(0, 15 - y * 0.25)
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi] = 0; buf[pi+1] = sk; buf[pi+2] = sk * 1.3; buf[pi+3] = 255
    }
  }

  for (let x = 0; x < W; x++) {
    const rayAngle = angle - FOV/2 + (x/W) * FOV
    const rdx = Math.cos(rayAngle)
    const rdy = Math.sin(rayAngle)
    let maxY = H

    for (let z = 1; z <= FAR; z++) {
      const wx = (camX + rdx * z) & (HMAP - 1)
      const wy = (camY + rdy * z) & (HMAP - 1)
      const th = heightmap[Math.floor(wy) * HMAP + Math.floor(wx)]

      const projY = Math.floor((camH - th) / z * scale + horizon)
      if (projY >= maxY) continue

      const fog = z / FAR
      // Dynamic height-dependent coloring
      const hue = (th * 1.5 + t * 0.005) % 360
      const [r, g, b] = hslToRgb(hue, 0.9, 0.4)

      const yStart = Math.max(0, projY)
      const yEnd   = Math.min(H, maxY)

      for (let y = yStart; y < yEnd; y++) {
        const pi = (y * W + x) * 4
        const isTop = (y === yStart)
        const fade = (1 - fog)

        if (isTop) {
          // Bright white-cyan edge line
          buf[pi]   = Math.round(200 * fade + 55)
          buf[pi+1] = Math.round(255 * fade)
          buf[pi+2] = Math.round(255 * fade)
        } else {
          buf[pi]   = Math.round(r * fade)
          buf[pi+1] = Math.round(g * fade)
          buf[pi+2] = Math.round(b * fade)
        }
        buf[pi+3] = 255
      }
      maxY = projY
      if (maxY <= 0) break
    }
  }

  // Scanline overlay
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi]   = Math.min(255, buf[pi]   + 6)
      buf[pi+1] = Math.min(255, buf[pi+1] + 6)
      buf[pi+2] = Math.min(255, buf[pi+2] + 6)
    }
  }

  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width  = W
  tmpCanvas.height = H
  tmpCanvas.getContext('2d')!.putImageData(img, 0, 0)
  ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
}

// ── Voxel B&W Renderer ───────────────────────────────────────────────────────
function renderVoxelBW(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camX: number, camY: number, angle: number, camH: number,
) {
  const W = Math.min(canvas.width,  400)
  const H = Math.min(canvas.height, Math.round(400 * canvas.height / Math.max(canvas.width, 1)))

  const img = ctx.createImageData(W, H)
  const buf = img.data

  const horizon = H * 0.42
  const scale   = 120
  const FOV     = 1.2
  const FAR     = 150

  // Pure black/dark gray sky
  for (let y = 0; y < H; y++) {
    const sk = Math.max(0, 12 - y * 0.2)
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi] = sk; buf[pi+1] = sk; buf[pi+2] = sk; buf[pi+3] = 255
    }
  }

  for (let x = 0; x < W; x++) {
    const rayAngle = angle - FOV/2 + (x/W) * FOV
    const rdx = Math.cos(rayAngle)
    const rdy = Math.sin(rayAngle)
    let maxY = H

    for (let z = 1; z <= FAR; z++) {
      const wx = (camX + rdx * z) & (HMAP - 1)
      const wy = (camY + rdy * z) & (HMAP - 1)
      const th = heightmap[Math.floor(wy) * HMAP + Math.floor(wx)]

      const projY = Math.floor((camH - th) / z * scale + horizon)
      if (projY >= maxY) continue

      const fog = z / FAR
      const lum = Math.round((1 - fog) * 220 * (0.45 + th / 510))

      const yStart = Math.max(0, projY)
      const yEnd   = Math.min(H, maxY)

      for (let y = yStart; y < yEnd; y++) {
        const pi = (y * W + x) * 4
        buf[pi]   = lum
        buf[pi+1] = lum
        buf[pi+2] = lum
        buf[pi+3] = 255
      }
      maxY = projY
      if (maxY <= 0) break
    }
  }

  // Scanline overlay
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const pi = (y * W + x) * 4
      buf[pi]   = Math.min(255, buf[pi]   + 5)
      buf[pi+1] = Math.min(255, buf[pi+1] + 5)
      buf[pi+2] = Math.min(255, buf[pi+2] + 5)
    }
  }

  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width  = W
  tmpCanvas.height = H
  tmpCanvas.getContext('2d')!.putImageData(img, 0, 0)
  ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
}

// ── Voxel Demo Color Panel Component ─────────────────────────────────────────
export function VoxelDemoColor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cam = useRef({
    x: 200, y: 300,
    vx: 1.5, vy: 0.8,
    angle: 0.8, va: 0.002,
    lastImpulse: -5000,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    let lastT = 0
    let isVisible = true

    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function loop(t: number) {
      if (!running) return
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const dt = Math.min(t - lastT, 50)
      lastT = t
      const c = cam.current

      if (canvas!.width === 0 || canvas!.height === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      if (t - c.lastImpulse > 2500 + Math.random() * 2000) {
        c.vx += (Math.random() - 0.5) * 3
        c.vy += (Math.random() - 0.5) * 3
        c.va += (Math.random() - 0.5) * 0.005
        c.lastImpulse = t
      }

      c.vx *= 0.992
      c.vy *= 0.992
      c.va *= 0.995

      const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy)
      if (speed < 0.8) { c.vx += (Math.random()-0.5)*1.5; c.vy += (Math.random()-0.5)*1.5 }
      if (speed > 5) { c.vx *= 5/speed; c.vy *= 5/speed }

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
      c.angle += c.va * dt/16

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 70, 110 + 30 * Math.sin(t * 0.0004))

      renderVoxelColor(ctx, canvas!, c.x, c.y, c.angle, camH, t)
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
    <Panel title="VOXEL SPECTRAL // CHROMATIC SHIFT">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}

// ── Voxel Demo B&W Panel Component ───────────────────────────────────────────
export function VoxelDemoBW() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cam = useRef({
    x: 350, y: 150,
    vx: -1.2, vy: 1.0,
    angle: 2.1, va: -0.001,
    lastImpulse: -5000,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    let lastT = 0
    let isVisible = true

    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function loop(t: number) {
      if (!running) return
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const dt = Math.min(t - lastT, 50)
      lastT = t
      const c = cam.current

      if (canvas!.width === 0 || canvas!.height === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      if (t - c.lastImpulse > 2500 + Math.random() * 2000) {
        c.vx += (Math.random() - 0.5) * 3
        c.vy += (Math.random() - 0.5) * 3
        c.va += (Math.random() - 0.5) * 0.005
        c.lastImpulse = t
      }

      c.vx *= 0.992
      c.vy *= 0.992
      c.va *= 0.995

      const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy)
      if (speed < 0.8) { c.vx += (Math.random()-0.5)*1.5; c.vy += (Math.random()-0.5)*1.5 }
      if (speed > 5) { c.vx *= 5/speed; c.vy *= 5/speed }

      c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
      c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
      c.angle += c.va * dt/16

      const tx = Math.floor(c.x) & (HMAP - 1)
      const ty = Math.floor(c.y) & (HMAP - 1)
      const terrainAtCam = heightmap[ty * HMAP + tx]
      const camH = Math.max(terrainAtCam + 75, 115 + 25 * Math.cos(t * 0.0003))

      renderVoxelBW(ctx, canvas!, c.x, c.y, c.angle, camH)
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
    <Panel title="VOXEL SURVEY // ORTHOGONAL MONOCHROME">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}
