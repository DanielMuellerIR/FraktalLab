import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// ── HSL→RGB Helfer ───────────────────────────────────────────────────────────
function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs((h/60) % 2 - 1))
  const m = l - c/2
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r=c; g=x }
  else if (h < 120) { r=x; g=c }
  else if (h < 180) { g=c; b=x }
  else if (h < 240) { g=x; b=c }
  else if (h < 300) { r=x; b=c }
  else              { r=c; b=x }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)]
}

// ── Factory: erstellt Panel-Komponente aus Render-Callback ───────────────────
// Zustand wird per Ref gehalten → kein Re-render bei Frame-Updates.
//
// Parameter:
//   title        — Panel-Titelzeile
//   maxW / maxH  — Performance-Cap für interne Render-Auflösung
//   mkState      — Funktion, die den initialen Szenen-Zustand erzeugt.
//                  Erhält (W, H) der ersten tatsächlichen Render-Auflösung.
//   draw         — Render-Callback: füllt buf (Uint8ClampedArray) mit RGBA-Pixeln.
//                  Erhält (buf, W, H, t, state).
//
// Die interne Auflösung wird durch ResizeObserver aktuell gehalten und liegt
// maximal bei maxW × maxH (Performance-Cap). Das Bild wird per drawImage auf
// die volle Canvas-Größe hochskaliert (CSS imageRendering: pixelated).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeScene(
  title: string,
  maxW: number,
  maxH: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mkState: (W: number, H: number) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw: (buf: Uint8ClampedArray, W: number, H: number, t: number, s: any) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postDraw?: (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, s: any) => void,
  pixelated: boolean = false,
): React.NamedExoticComponent<any> {
  return React.memo(function Scene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateRef = useRef<any>(null)

    useEffect(() => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      let alive = true
      let unsubscribe: (() => void) | null = null

      // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
      let isVisible = true
      const io = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting
          if (isVisible) {
            if (!unsubscribe && alive) {
              unsubscribe = subscribe(loop)
            }
          } else {
            if (unsubscribe) {
              unsubscribe()
              unsubscribe = null
            }
          }
        },
        { threshold: 0.1 },
      )
      io.observe(canvas)

      // Internes OffscreenCanvas für die gecappte Niedrig-Auflösung
      const offscreen = document.createElement('canvas')

      // Berechnet die interne Auflösung basierend auf der aktuellen Canvas-CSS-Größe
      // und dem Performance-Cap (maxW × maxH).
      const getInternalSize = () => {
        const cw = canvas.clientWidth  || maxW
        const ch = canvas.clientHeight || maxH
        // Proportional skalieren, sodass weder Breite noch Höhe den Cap überschreitet
        const scaleW = Math.min(1, maxW / cw)
        const scaleH = Math.min(1, maxH / ch)
        const scale  = Math.min(scaleW, scaleH)
        return {
          W: Math.max(1, Math.round(cw * scale)),
          H: Math.max(1, Math.round(ch * scale)),
        }
      }

      // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────
      const resize = () => {
        canvas.width  = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(canvas)

      // Zustand erst initialisieren, nachdem wir die erste interne Größe kennen
      const { W: initW, H: initH } = getInternalSize()
      stateRef.current = mkState(initW, initH)

      let img: ImageData | null = null

      function loop(t: number) {
        if (!alive) return

        // Sicherheitscheck: Canvas muss eine Größe haben
        if (canvas.width === 0 || canvas.height === 0) {
          return
        }

        const { W, H } = getInternalSize()

        // OffscreenCanvas nur dann neu anlegen, wenn sich die interne Größe ändert
        if (offscreen.width !== W || offscreen.height !== H) {
          offscreen.width  = W
          offscreen.height = H
          // Zustand bei Größenänderung neu initialisieren (z.B. Buffer-Arrays)
          stateRef.current = mkState(W, H)
          img = null
        }

        const offCtx = offscreen.getContext('2d')!
        if (!img) {
          img = offCtx.createImageData(W, H)
        }

        // Render-Callback füllt img.data mit RGBA-Pixeln
        draw(img.data, W, H, t, stateRef.current)

        // Interne Pixel in OffscreenCanvas schreiben ...
        offCtx.putImageData(img, 0, 0)

        // postDraw callback ausführen
        if (postDraw) {
          postDraw(offCtx, W, H, t, stateRef.current)
        }

        // ... dann auf volle Canvas-Größe hochskalieren
        ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height)
      }

      return () => {
        alive = false
        if (unsubscribe) {
          unsubscribe()
        }
        ro.disconnect()
        io.disconnect()
      }
    }, [])

    return (
      <Panel title={title}>
        {/* Canvas füllt den Panel-Body vollständig */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', imageRendering: pixelated ? 'pixelated' : 'auto', display: 'block' }}
        />
      </Panel>
    )
  })
}

// ── Effekt 1: Feuer — Doom-Algorithmus mit Farb-Varianz ──────────────────────
// Hitze von unten nach oben propagieren + leicht abkühlen → typisches Flammen-Muster.
// Farb-Varianz:
//   - Jede 4. Spalte erzeugt blaue/cyan "Plasma-Jets" statt orange/rot.
//   - Alle 30 s: 3 s "Chemiefeuer"-Modus — Basis wechselt zu Grün/Gelb.
// Interner Performance-Cap: max 160×100 (pixelated-Look ist gewollt).

// Zustandstyp für FireScene (Hitzebuffer + Chemiefeuer-Timer)
type FireState = {
  firePixels: Uint8Array
}

const firePalette: [number, number, number][] = []
for (let i = 0; i < 36; i++) {
  if (i <= 8) {
    firePalette.push([Math.round(i / 8 * 255), 0, 0])
  } else if (i <= 17) {
    firePalette.push([255, Math.round((i - 8) / 9 * 120), 0])
  } else if (i <= 26) {
    firePalette.push([255, 120 + Math.round((i - 17) / 9 * 110), 0])
  } else {
    firePalette.push([255, 230 + Math.round((i - 26) / 9 * 25), Math.round((i - 26) / 9 * 255)])
  }
}

export const FireScene = makeScene(
  'CORE MELTDOWN // STATUS: CRITICAL', 160, 100,
  (W, H): FireState => ({
    firePixels: new Uint8Array(W * H),
  }),
  (buf, W, H, _t, state: FireState) => {
    const { firePixels } = state

    // Seed bottom row with maximum heat value (35)
    const bottomRowStart = (H - 1) * W
    for (let x = 0; x < W; x++) {
      firePixels[bottomRowStart + x] = Math.random() > 0.15 ? 35 : Math.floor(20 + Math.random() * 15)
    }

    // Heat propagation from row 0 to H - 2
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const randOffset = Math.floor(Math.random() * 3) - 1
        let srcX = x + randOffset
        if (srcX < 0) srcX = 0
        if (srcX >= W) srcX = W - 1

        const parentHeat = firePixels[(y + 1) * W + srcX]
        const decay = Math.floor(Math.random() * 2.2)
        firePixels[y * W + x] = Math.max(0, parentHeat - decay)
      }
    }

    // Map heat values to color buffer
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const heat = firePixels[y * W + x]
        const [r, g, b] = firePalette[heat]
        const pi = (y * W + x) * 4
        buf[pi] = r
        buf[pi+1] = g
        buf[pi+2] = b
        buf[pi+3] = 255
      }
    }
  },
)

// ── Effekt 2: Starfield — 3D-Sterne fliegen auf die Kamera zu ────────────────
// Volle Auflösung OK (nur Punkte, kein Pixel-Buffer-Overhead).
// Alle 20–30 s: 1,5s Hyperraum-Effekt — Sterne strecken sich zu Linien.
type Star = { x: number; y: number; z: number }
// Gemeinsamer Hyperraum-Zustand — alle Felder: Startzeitpunkt und Dauer des Effekts.
type StarfieldState = {
  stars: Star[]
  nextHyperAt: number
  hyperEndAt: number
  phase: 'normal' | 'warpin' | 'hyperspace' | 'warpout'
  speedVal: number
  warpFactor: number
  xCoord: number
  yCoord: number
  zCoord: number
}
export const StarfieldScene = makeScene(
  'DEEP SPACE // SCANNING SECTOR 9', 99999, 99999,
  // 450 Sterne statt 150 — dreifache Dichte
  (): StarfieldState => ({
    stars: Array.from({length: 450}, () => ({
      x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: Math.random(),
    })),
    nextHyperAt: 0,
    hyperEndAt:  -1,
    phase: 'normal',
    speedVal: 0.006,
    warpFactor: 0,
    xCoord: 49.32,
    yCoord: -12.44,
    zCoord: 102.05,
  }),
  (buf, W, H, t, state: StarfieldState) => {
    const cycleTime = (t / 1000) % 22
    let speed = 0.006
    let phase: 'normal' | 'warpin' | 'hyperspace' | 'warpout' = 'normal'
    let warpFactor = 0

    if (cycleTime < 8) {
      phase = 'normal'
      speed = 0.006
      warpFactor = 0
    } else if (cycleTime < 10) {
      phase = 'warpin'
      const p = (cycleTime - 8) / 2
      speed = 0.006 + 0.114 * p * p // ramps up to 0.12
      warpFactor = p
    } else if (cycleTime < 20) {
      phase = 'hyperspace'
      speed = 0.12 // very fast
      warpFactor = 1
    } else {
      phase = 'warpout'
      const p = (cycleTime - 20) / 2
      speed = 0.12 - 0.114 * (1 - (1 - p) * (1 - p)) // ramps down back to 0.006
      warpFactor = 1 - p
    }

    state.phase = phase
    state.speedVal = speed
    state.warpFactor = warpFactor
    state.xCoord += (phase === 'hyperspace' ? 0.35 : 0.01) * (Math.random() * 0.5 + 0.75)
    state.yCoord += (phase === 'hyperspace' ? -0.15 : -0.005) * (Math.random() * 0.5 + 0.75)
    state.zCoord += (phase === 'hyperspace' ? 0.95 : 0.02) * (Math.random() * 0.5 + 0.75)

    // Hintergrund schwarz, Alpha voll opak
    buf.fill(0)
    for (let i = 3; i < buf.length; i+=4) buf[i] = 255

    for (let idx = 0; idx < state.stars.length; idx++) {
      const s = state.stars[idx]
      const prevZ = s.z          // z vor dem Update → für Linien-Endpunkt
      s.z -= speed
      if (s.z <= 0.01) {
        s.x = (Math.random()-0.5)*2
        s.y = (Math.random()-0.5)*2
        s.z = 1
        continue
      }

      // Bildschirm-Koordinate am aktuellen z
      const sx = Math.round(s.x / s.z * W * 0.45 + W/2)
      const sy = Math.round(s.y / s.z * H * 0.45 + H/2)
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue

      if (phase === 'normal') {
        // Normaler Modus: einzelner Punkt, Helligkeit steigt mit Nähe zur Kamera
        const br  = Math.round(255 * (1 - s.z))
        const ext = s.z < 0.15 ? 1 : 0  // helle Sterne nahe der Kamera etwas größer
        for (let dy = -ext; dy <= ext; dy++)
          for (let dx = -ext; dx <= ext; dx++) {
            const px = sx + dx, py = sy + dy
            if (px < 0 || px >= W || py < 0 || py >= H) continue
            const pi = (py * W + px) * 4
            buf[pi] = br; buf[pi+1] = br; buf[pi+2] = br; buf[pi+3] = 255
          }
      } else {
        // Hyperraum: Linie vom vorherigen z-Punkt zum aktuellen z-Punkt zeichnen
        const psx = Math.round(s.x / prevZ * W * 0.45 + W/2)
        const psy = Math.round(s.y / prevZ * H * 0.45 + H/2)

        // Farbbestimmung
        let r = 255, g = 255, b = 255
        if (phase === 'hyperspace') {
          if (idx % 3 === 0) { r = 0; g = 255; b = 255 } // Neon Cyan
          else if (idx % 3 === 1) { r = 255; g = 0; b = 255 } // Neon Magenta
          else { r = 0; g = 255; b = 0 } // Neon Green
        } else if (phase === 'warpout') {
          let nr = 255, ng = 255, nb = 255
          if (idx % 3 === 0) { nr = 0; ng = 255; nb = 255 }
          else if (idx % 3 === 1) { nr = 255; ng = 0; nb = 255 }
          else { nr = 0; ng = 255; nb = 0 }
          r = Math.round(255 + (nr - 255) * warpFactor)
          g = Math.round(255 + (ng - 255) * warpFactor)
          b = Math.round(255 + (nb - 255) * warpFactor)
        } else if (phase === 'warpin') {
          let nr = 255, ng = 255, nb = 255
          if (idx % 3 === 0) { nr = 0; ng = 255; nb = 255 }
          else if (idx % 3 === 1) { nr = 255; ng = 0; nb = 255 }
          else { nr = 0; ng = 255; nb = 0 }
          r = Math.round(255 + (nr - 255) * warpFactor)
          g = Math.round(255 + (ng - 255) * warpFactor)
          b = Math.round(255 + (nb - 255) * warpFactor)
        }

        // Bresenham-Linie zwischen (psx,psy) und (sx,sy)
        let lx = psx, ly = psy
        const dx = Math.abs(sx - psx), dy = Math.abs(sy - psy)
        const stepX = psx < sx ? 1 : -1, stepY = psy < sy ? 1 : -1
        let err = dx - dy
        const maxSteps = 100
        for (let step = 0; step < maxSteps; step++) {
          if (lx >= 0 && lx < W && ly >= 0 && ly < H) {
            const pi = (ly * W + lx) * 4
            buf[pi] = r; buf[pi+1] = g; buf[pi+2] = b; buf[pi+3] = 255
          }
          if (lx === sx && ly === sy) break
          const e2 = err * 2
          if (e2 > -dy) { err -= dy; lx += stepX }
          if (e2 <  dx) { err += dx; ly += stepY }
        }
      }
    }
  },
  (offCtx, W, H, t, state: StarfieldState) => {
    const cx = W / 2
    const cy = H / 2

    // Brackets um Zielzone
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.8)' // Neon grün
    offCtx.lineWidth = 1.5
    
    const targetX = cx + Math.sin(t * 0.001) * (W * 0.15)
    const targetY = cy + Math.cos(t * 0.0012) * (H * 0.15)
    const bracketSize = 25
    
    offCtx.beginPath()
    // Top-left
    offCtx.moveTo(targetX - bracketSize, targetY - bracketSize + 8)
    offCtx.lineTo(targetX - bracketSize, targetY - bracketSize)
    offCtx.lineTo(targetX - bracketSize + 8, targetY - bracketSize)
    // Top-right
    offCtx.moveTo(targetX + bracketSize, targetY - bracketSize + 8)
    offCtx.lineTo(targetX + bracketSize, targetY - bracketSize)
    offCtx.lineTo(targetX + bracketSize - 8, targetY - bracketSize)
    // Bottom-left
    offCtx.moveTo(targetX - bracketSize, targetY + bracketSize - 8)
    offCtx.lineTo(targetX - bracketSize, targetY + bracketSize)
    offCtx.lineTo(targetX - bracketSize + 8, targetY + bracketSize)
    // Bottom-right
    offCtx.moveTo(targetX + bracketSize, targetY + bracketSize - 8)
    offCtx.lineTo(targetX + bracketSize, targetY + bracketSize)
    offCtx.lineTo(targetX + bracketSize - 8, targetY + bracketSize)
    offCtx.stroke()

    // Zielzonen-Label
    offCtx.fillStyle = 'rgba(74, 222, 128, 0.9)'
    offCtx.font = '9px monospace'
    offCtx.fillText('LOCK // TRAP-1e', targetX - bracketSize, targetY - bracketSize - 4)

    // Telemetrie Status & Speed Bestimmung
    let statusText = 'STATUS: NOMINAL'
    let speedText = '0.05c'
    if (state.phase === 'normal') {
      statusText = 'STATUS: NOMINAL'
      speedText = `${(0.05 + state.speedVal * 2).toFixed(3)}c`
    } else if (state.phase === 'warpin') {
      statusText = 'STATUS: WARP ACTIVE'
      speedText = `WARP ${(9.9 * state.warpFactor).toFixed(1)}`
    } else if (state.phase === 'hyperspace') {
      statusText = (t % 1000 < 500) ? 'STATUS: CRITICAL' : 'STATUS: WARP ACTIVE'
      speedText = 'WARP 9.9'
    } else if (state.phase === 'warpout') {
      statusText = 'STATUS: DECELLERATING'
      speedText = `WARP ${(9.9 * state.warpFactor).toFixed(1)}`
    }

    // Scanlines
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.04)'
    offCtx.lineWidth = 1
    for (let y = 0; y < H; y += 3) {
      offCtx.beginPath()
      offCtx.moveTo(0, y)
      offCtx.lineTo(W, y)
      offCtx.stroke()
    }

    // HUD Rahmen
    const margin = 12
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.3)'
    offCtx.lineWidth = 1
    offCtx.strokeRect(margin, margin, W - 2 * margin, H - 2 * margin)

    // Telemetrie Ticks an den Rändern
    const ladderXLeft = 35
    const ladderXRight = W - 35
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.25)'
    offCtx.beginPath()
    // Vertikale Linien
    offCtx.moveTo(ladderXLeft, 40)
    offCtx.lineTo(ladderXLeft, H - 40)
    offCtx.moveTo(ladderXRight, 40)
    offCtx.lineTo(ladderXRight, H - 40)
    offCtx.stroke()

    // Ticks
    offCtx.beginPath()
    for (let y = 45; y < H - 40; y += 15) {
      offCtx.moveTo(ladderXLeft, y)
      offCtx.lineTo(ladderXLeft + 6, y)
      offCtx.moveTo(ladderXRight, y)
      offCtx.lineTo(ladderXRight - 6, y)
    }
    offCtx.stroke()

    // HUD Text und Status
    const bottomY = H - 22
    offCtx.fillStyle = '#4ade80'
    offCtx.font = 'bold 10px monospace'
    offCtx.fillText(`SPEED: ${speedText}`, 25, bottomY)
    
    let statusColor = '#4ade80'
    if (statusText === 'STATUS: CRITICAL') statusColor = '#ef4444'
    else if (statusText === 'STATUS: DECELLERATING') statusColor = '#facc15'
    offCtx.fillStyle = statusColor
    offCtx.fillText(statusText, W / 2 - 50, bottomY)

    offCtx.fillStyle = '#4ade80'
    const coordsText = `X: ${state.xCoord.toFixed(2)} Y: ${state.yCoord.toFixed(2)} Z: ${state.zCoord.toFixed(2)}`
    offCtx.fillText(coordsText, W - 200, bottomY)

    // Künstlicher Horizont Kreis
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.1)'
    offCtx.beginPath()
    offCtx.arc(cx, cy, Math.min(W, H) * 0.22, 0, Math.PI * 2)
    offCtx.stroke()

    // Fadenkreuz Center
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.3)'
    offCtx.beginPath()
    offCtx.moveTo(cx - 8, cy); offCtx.lineTo(cx + 8, cy)
    offCtx.moveTo(cx, cy - 8); offCtx.lineTo(cx, cy + 8)
    offCtx.stroke()
  },
)

// ── Effekt 3: Tunnel — doppelter Schachbrett-Tunnel mit Farb-Cycling ─────────
// Verbesserungen gegenüber v0.9.3:
//   - Rotationsgeschwindigkeit 2× erhöht
//   - Vorwärtsbewegung 2,5× erhöht
//   - Zweiter Tunnel-Layer (kleinerer Radius, entgegengesetzte Rotation, 50% Opacity)
//     wird über den ersten geblendet → komplexer Überlagerungs-Effekt
//   - Hue-Cycling: Farbe dreht 360° in 30 s
// Performance-Cap: max 200×150.
export const TunnelScene = makeScene(
  'WORMHOLE // TRANSIT ACTIVE', 320, 240,
  () => null,
  (buf, W, H, t) => {
    const ts = t * 0.001

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x - W/2, cy = y - H/2
        const r  = Math.sqrt(cx*cx + cy*cy) + 0.001

        const u = Math.atan2(cy, cx) / Math.PI + ts * 0.72
        const v = 20 / r + ts * 2.25
        const c = (Math.floor(u * 3) + Math.floor(v * 3)) & 1
        const hue = 140 + Math.sin(ts * 0.15) * 40
        const [ri, gi, bi] = hsl((hue + r * 2) % 360, 1, c ? 0.6 : 0.07)

        // Smoothly fade RGB values towards black near the center of the tunnel to prevent aliasing
        const fade = Math.min(1.0, Math.pow(r / 32.0, 1.5))
        const rf = Math.round(ri * fade)
        const gf = Math.round(gi * fade)
        const bf = Math.round(bi * fade)

        const pi = (y * W + x) * 4
        buf[pi] = rf; buf[pi+1] = gf; buf[pi+2] = bf; buf[pi+3] = 255
      }
    }
  },
  undefined,
  false
)

// ── Effekt 4: Rotozoom — rotierende + zoomende Kacheln ───────────────────────
// Performance-Cap: max 200×150.
export const RotozoomScene = makeScene(
  'TESSERACT ROTATION // DECRYPTING', 320, 240,
  () => null,
  (buf, W, H, t) => {
    const ts  = t * 0.001
    const z   = 0.04 + 0.03*Math.sin(ts*0.5)
    const cos = Math.cos(ts*0.6)*z, sin = Math.sin(ts*0.6)*z
    const offsets = [-0.25, 0.25]

    for (let y = 0; y < H; y++) {
      const cy = y - H/2
      for (let x = 0; x < W; x++) {
        const cx = x - W/2

        // 2x2 grid supersampling on checker function to smooth edges
        let checkerSum = 0
        for (let i = 0; i < 2; i++) {
          const subCy = cy + offsets[i]
          for (let j = 0; j < 2; j++) {
            const subCx = cx + offsets[j]
            const sx = subCx * cos - subCy * sin
            const sy = subCx * sin + subCy * cos
            const checker = (Math.floor(sx) + Math.floor(sy)) & 1
            checkerSum += checker
          }
        }
        const checkerAvg = checkerSum * 0.25

        const centerSx = cx * cos - cy * sin
        const centerSy = cx * sin + cy * cos
        const hue = Math.abs(((centerSx + centerSy) * 10 + ts * 40) % 360)
        const lightness = 0.05 + 0.50 * checkerAvg

        const [ri, gi, bi] = hsl(hue, 1, lightness)
        const pi = (y * W + x) * 4
        buf[pi] = ri; buf[pi+1] = gi; buf[pi+2] = bi; buf[pi+3] = 255
      }
    }
  },
  undefined,
  false
)

// ── Effekt 5: Metaballs — flüssige Blobs, fein gerastert ─────────────────────
// Verbesserung: Step-Size auf 3px reduziert → kein blockiges Pixel-Raster mehr.
// Anzahl Bälle auf 5 gekappt (war schon 5, explizit bestätigt) um Performance
// beim feineren Raster auszugleichen.
// Performance-Cap: max 200×150.
type Ball = { x:number; y:number; vx:number; vy:number; r:number; hue:number }
export const MetaballsScene = makeScene(
  'LIQUID CODE // RENDERING', 200, 150,
  // Startpositionen relativ zur tatsächlichen internen Auflösung
  (W, H): Ball[] => Array.from({length: 5}, (_,i) => ({
    x: 5 + Math.random() * (W - 10),
    y: 5 + Math.random() * (H - 10),
    vx: (Math.random() - 0.5) * 0.9,
    vy: (Math.random() - 0.5) * 0.9,
    r:  7 + Math.random() * 10,
    hue: (i * 72 + Math.floor(Math.random() * 30)) % 360,
  })),
  (buf, W, H, _t, balls: Ball[]) => {
    // Bälle bewegen und an Wänden abprallen
    for (const b of balls) {
      b.x += b.vx; b.y += b.vy
      if (b.x < 0 || b.x > W) b.vx *= -1
      if (b.y < 0 || b.y > H) b.vy *= -1
    }

    // Hintergrund schwarz setzen
    buf.fill(0)
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255

    // Step-Size 1px: jedes Pixel einzeln berechnet — glatter, echter Liquid-Look.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, rW = 0, gW = 0, bW = 0
        for (const b of balls) {
          // Potential-Funktion: r²/d² — je näher, desto größer der Beitrag
          const w = b.r * b.r / ((x - b.x) ** 2 + (y - b.y) ** 2 + 1)
          sum += w
          const [br, bg, bb] = hsl(b.hue, 1, 0.5)
          rW += br * w; gW += bg * w; bW += bb * w
        }

        if (sum > 1) {
          // Isosurface überschritten → Blob-Farbe (gewichtetes Mittel)
          const pi = (y * W + x) * 4
          buf[pi]   = Math.min(255, rW / sum)
          buf[pi+1] = Math.min(255, gW / sum)
          buf[pi+2] = Math.min(255, bW / sum)
          buf[pi+3] = 255
        }
        // Sonst bleibt der schwarze Hintergrund stehen
      }
    }
  },
)

// ── Effekt 6: Neural Net — Canvas-2D-Version mit scharfen Linien + Labels ────
// Standalone-Komponente (kein makeScene), damit Canvas-2D-API genutzt werden
// kann: pixelscharfe Linien via ctx.strokePath, Text-Labels via ctx.fillText.
type NeuralNode2D = {
  x: number; y: number    // aktuelle Position
  bx: number; by: number  // Drift-Basis
  vx: number; vy: number  // Drift-Geschwindigkeit
  label: string           // z.B. "N-01"
}
export const DotCloudScene = React.memo(function DotCloudScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    if (!_canvas) return
    const canvas: HTMLCanvasElement = _canvas
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D = _ctx

    let rafId = 0
    let isVisible = true
    let nodes: NeuralNode2D[] = []   // lazy-init beim ersten Frame
    let nextPulseAt = 0
    let pulseEndAt  = -1

    // ResizeObserver: Canvas-Auflösung an Panel-Größe anpassen
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      nodes = []   // Knoten neu verteilen nach Resize
    })
    ro.observe(canvas)

    // IntersectionObserver: rAF-Loop pausieren wenn unsichtbar
    const io = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting })
    io.observe(canvas)

    const loop = (t: number) => {
      rafId = requestAnimationFrame(loop)
      if (!isVisible) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Knoten beim ersten Frame (oder nach Resize) initialisieren
      if (nodes.length === 0) {
        nodes = Array.from({ length: 40 }, (_, i) => {
          const x = Math.random() * W
          const y = Math.random() * H
          return {
            x, y, bx: x, by: y,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            label: `N-${String(i + 1).padStart(2, '0')}`,
          }
        })
        nextPulseAt = t + 8_000
        pulseEndAt  = -1
      }

      // Puls-Logik
      if (pulseEndAt < 0 && t >= nextPulseAt) pulseEndAt = t + 800
      const isPulse = pulseEndAt >= 0 && t <= pulseEndAt
      if (pulseEndAt >= 0 && t > pulseEndAt) {
        pulseEndAt  = -1
        nextPulseAt = t + 8_000
      }
      const pulseDuration = 800
      const pulsePhase = isPulse
        ? Math.sin(Math.PI * (t - (pulseEndAt - pulseDuration)) / pulseDuration)
        : 0
      const cx = W / 2, cy = H / 2

      // Knoten bewegen
      for (const n of nodes) {
        n.bx += n.vx; n.by += n.vy
        if (n.bx < 0 || n.bx > W) { n.vx *= -1; n.bx = Math.max(0, Math.min(W, n.bx)) }
        if (n.by < 0 || n.by > H) { n.vy *= -1; n.by = Math.max(0, Math.min(H, n.by)) }
        n.x = n.bx + (cx - n.bx) * pulsePhase * 0.4
        n.y = n.by + (cy - n.by) * pulsePhase * 0.4
      }

      // Hintergrund
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // Verbindungslinien: Canvas-2D → pixelscharf
      const maxDist = Math.min(W, H) * 0.35
      ctx.lineWidth = 1
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const na = nodes[a], nb = nodes[b]
          const dx = na.x - nb.x, dy = na.y - nb.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist >= maxDist) continue
          const alpha = (1 - dist / maxDist).toFixed(2)
          ctx.strokeStyle = `rgba(20,83,45,${alpha})`
          ctx.beginPath()
          ctx.moveTo(na.x, na.y)
          ctx.lineTo(nb.x, nb.y)
          ctx.stroke()
        }
      }

      // Knoten-Kreise + Labels
      const nodeR = Math.max(3, Math.min(W, H) * 0.012)
      const fontSize = Math.max(7, Math.round(nodeR * 1.1))
      ctx.font = `${fontSize}px monospace`
      ctx.textBaseline = 'middle'
      for (const n of nodes) {
        // Kreis
        ctx.fillStyle = '#4ade80'
        ctx.beginPath()
        ctx.arc(n.x, n.y, nodeR, 0, Math.PI * 2)
        ctx.fill()
        // Label rechts neben Knoten, nur wenn es ins Canvas passt
        const labelX = n.x + nodeR + 2
        if (labelX + fontSize * 4 < W && n.y > fontSize / 2 && n.y < H - fontSize / 2) {
          ctx.fillStyle = 'rgba(74,222,128,0.65)'
          ctx.fillText(n.label, labelX, n.y)
        }
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="NEURAL NET // 300 NODES ACTIVE">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </Panel>
  )
})

// ── Effekt 7: Three Body Problem — klassische 3D-Kugeln mit Orbit-Vektoren ────
type ThreeBodyBall = {
  bx:      number
  by:      number
  vbx:     number
  vby:     number
  angleX:  number
  angleY:  number
  angleZ:  number
  omegaX:  number
  omegaY:  number
  omegaZ:  number
}

type ThreeBodyState = {
  balls: ThreeBodyBall[]
  lastT: number
  W: number
  H: number
}

export const ThreeBodyScene = makeScene(
  'THREE BODY PROBLEM // CHAOTIC RESONANCE', 400, 300,
  (W, H): ThreeBodyState => {
    const balls: ThreeBodyBall[] = []
    for (let i = 0; i < 3; i++) {
      const angleX = Math.random() * Math.PI * 2
      const angleY = Math.random() * Math.PI * 2
      const angleZ = Math.random() * Math.PI * 2
      const omegaX = 0.0005 + Math.random() * 0.001
      const omegaY = 0.0005 + Math.random() * 0.001
      const omegaZ = 0.0005 + Math.random() * 0.001
      const angle = Math.random() * Math.PI * 2
      // Speed scales proportionally with the grid size to keep visual velocity consistent
      const speed = (0.04 + Math.random() * 0.06) * (Math.min(W, H) / 150)
      balls.push({
        bx: W * 0.2 + Math.random() * W * 0.6,
        by: H * 0.2 + Math.random() * H * 0.6,
        vbx: Math.cos(angle) * speed,
        vby: Math.sin(angle) * speed,
        angleX,
        angleY,
        angleZ,
        omegaX,
        omegaY,
        omegaZ,
      })
    }
    return {
      balls,
      lastT: -1,
      W,
      H,
    }
  },
  (buf, W, H, t, state: ThreeBodyState) => {
    const dt = state.lastT < 0 ? 16 : Math.min(t - state.lastT, 50)
    state.lastT = t

    const rad = Math.min(W, H) * 0.12

    // 1. Move and bounce balls off boundaries
    for (const ball of state.balls) {
      ball.bx += ball.vbx * dt
      ball.by += ball.vby * dt

      if (ball.bx - rad < 0) {
        ball.vbx = Math.abs(ball.vbx)
        ball.bx = rad
      }
      if (ball.bx + rad > W) {
        ball.vbx = -Math.abs(ball.vbx)
        ball.bx = W - rad
      }
      if (ball.by - rad < 0) {
        ball.vby = Math.abs(ball.vby)
        ball.by = rad
      }
      if (ball.by + rad > H) {
        ball.vby = -Math.abs(ball.vby)
        ball.by = H - rad
      }

      // Update 3D rotation with drift
      ball.omegaX += (Math.random() - 0.5) * 0.000002
      ball.omegaY += (Math.random() - 0.5) * 0.000002
      ball.omegaZ += (Math.random() - 0.5) * 0.000001
      ball.omegaX = Math.max(0.0005, Math.min(0.002, ball.omegaX))
      ball.omegaY = Math.max(0.0005, Math.min(0.002, ball.omegaY))
      ball.omegaZ = Math.max(0.0005, Math.min(0.002, ball.omegaZ))

      ball.angleX += ball.omegaX * dt
      ball.angleY += ball.omegaY * dt
      ball.angleZ += ball.omegaZ * dt
    }

    // 2. Elastic 2D circle-to-circle collision with overlap resolution
    for (let i = 0; i < state.balls.length; i++) {
      for (let j = i + 1; j < state.balls.length; j++) {
        const b1 = state.balls[i]
        const b2 = state.balls[j]
        const dx = b2.bx - b1.bx
        const dy = b2.by - b1.by
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = rad * 2
        if (dist < minDist) {
          const overlap = minDist - dist
          const nx = dist > 0 ? dx / dist : 1
          const ny = dist > 0 ? dy / dist : 0

          // Push them apart equally to resolve overlap
          b1.bx -= nx * overlap * 0.5
          b1.by -= ny * overlap * 0.5
          b2.bx += nx * overlap * 0.5
          b2.by += ny * overlap * 0.5

          // Swap velocities along contact normal
          const kx = b1.vbx - b2.vbx
          const ky = b1.vby - b2.vby
          const p = nx * kx + ny * ky
          if (p > 0) {
            b1.vbx -= p * nx
            b1.vby -= p * ny
            b2.vbx += p * nx
            b2.vby += p * ny
          }
        }
      }
    }

    // 3. Render all balls
    buf.fill(0)
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255

    const rad2 = rad * rad
    const invRad = 1 / rad

    for (const ball of state.balls) {
      const cX = Math.cos(ball.angleX), sX = Math.sin(ball.angleX)
      const cY = Math.cos(ball.angleY), sY = Math.sin(ball.angleY)
      const cZ = Math.cos(ball.angleZ), sZ = Math.sin(ball.angleZ)

      // 3x3 rotation matrix coefficients
      const m00 = cY * cZ
      const m01 = sX * sY * cZ + cX * sZ
      const m02 = -cX * sY * cZ + sX * sZ

      const m10 = -cY * sZ
      const m11 = -sX * sY * sZ + cX * cZ
      const m12 = cX * sY * sZ + sX * cZ

      const m20 = sY
      const m21 = -sX * cY
      const m22 = cX * cY

      const xMin = Math.max(0, Math.floor(ball.bx - rad))
      const xMax = Math.min(W - 1, Math.ceil(ball.bx + rad))
      const yMin = Math.max(0, Math.floor(ball.by - rad))
      const yMax = Math.min(H - 1, Math.ceil(ball.by + rad))

      for (let y = yMin; y <= yMax; y++) {
        const dy = y - ball.by
        const dy2 = dy * dy
        const dy_m01 = dy * m01
        const dy_m11 = dy * m11
        const dy_m21 = dy * m21
        const dy_03 = 0.3 * dy

        for (let x = xMin; x <= xMax; x++) {
          const dx = x - ball.bx
          const d2 = dx * dx + dy2
          if (d2 > rad2) continue

          const nz_sqrt = Math.sqrt(rad2 - d2)

          const nx3 = dx * m00 + dy_m01 + nz_sqrt * m02
          const ny3 = dx * m10 + dy_m11 + nz_sqrt * m12
          const nz2 = (dx * m20 + dy_m21 + nz_sqrt * m22) * invRad

          // Checkerboard pattern: Math.asin and Math.atan2 replacements
          let floorUb = 0
          if (nz2 < 0) {
            floorUb = nz2 < -0.8660254 ? -2 : -1
          } else {
            floorUb = nz2 >= 0.8660254 ? 1 : 0
          }

          let floorUa = 0
          const s1 = ny3 > 0
          const s2 = ny3 > 1.7320508 * nx3
          const s3 = ny3 > -1.7320508 * nx3

          if (s1) {
            if (!s2) floorUa = 0
            else if (s3) floorUa = 1
            else floorUa = 2
          } else {
            if (s2) floorUa = -3
            else if (!s3) floorUa = -2
            else floorUa = -1
          }

          const checker = (floorUa + floorUb) & 1

          // Light intensity
          const light = Math.max(0.15, (0.4 * dx - dy_03 + 0.85 * nz_sqrt) * invRad)
          const c = Math.round(light * 255)

          const pi = (y * W + x) * 4
          if (checker) {
            buf[pi] = c
            buf[pi+1] = 0
            buf[pi+2] = 0
          } else {
            buf[pi] = c
            buf[pi+1] = c
            buf[pi+2] = c
          }
          buf[pi+3] = 255
        }
      }
    }
  },
  (offCtx, _W, _H, _t, state: ThreeBodyState) => {
    const { balls } = state
    if (balls.length < 3) return

    // Draw gravity connection vectors
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.45)'
    offCtx.lineWidth = Math.max(1, Math.round(Math.min(_W, _H) * 0.008))
    offCtx.beginPath()
    offCtx.moveTo(balls[0].bx, balls[0].by)
    offCtx.lineTo(balls[1].bx, balls[1].by)
    offCtx.lineTo(balls[2].bx, balls[2].by)
    offCtx.closePath()
    offCtx.stroke()

    // Draw dynamic labels showing center gravity index
    offCtx.fillStyle = 'rgba(74, 222, 128, 0.85)'
    const fontSize = Math.max(8, Math.round(Math.min(_W, _H) * 0.045))
    offCtx.font = `bold ${fontSize}px monospace`
    for (let i = 0; i < 3; i++) {
      const b = balls[i]
      offCtx.fillText(`M-${i+1}`, b.bx + fontSize * 1.2, b.by - fontSize * 1.2)
    }
  }
)

// ── Effekt 8: Lissajous — animierte Kurve mit Nachleucht-Spur ────────────────
// Performance-Cap: max 200×150.
export const LissajousScene = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number
    let alive = true

    let isVisible = true
    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
    })
    io.observe(canvas)

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let phi1 = 0
    let phi2 = Math.PI / 4

    function loop(t: number) {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      if (!isVisible) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Phosphor decay trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, W, H)

      // Oscilloscope background grid
      ctx.strokeStyle = 'rgba(0, 60, 20, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H)
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
      ctx.stroke()

      const ts = t * 0.001
      const freqX = 3 + 0.5 * Math.sin(ts * 0.25)
      const freqY = 4 + 0.5 * Math.cos(ts * 0.35)

      phi1 += 0.012
      phi2 += 0.008

      const maxSegments = 400
      const progress = 0.5 + 0.5 * Math.sin(ts * 0.8)
      const activeSegments = Math.max(2, Math.floor(progress * maxSegments))

      ctx.lineWidth = 2.2
      ctx.shadowBlur = 8
      ctx.lineCap = 'round'

      for (let i = 1; i < activeSegments; i++) {
        const theta1 = ((i - 1) / maxSegments) * Math.PI * 6
        const theta2 = (i / maxSegments) * Math.PI * 6

        const x1 = (0.43 * Math.sin(freqX * theta1 + phi1) + 0.5) * W
        const y1 = (0.43 * Math.cos(freqY * theta1 + phi2) + 0.5) * H
        const x2 = (0.43 * Math.sin(freqX * theta2 + phi1) + 0.5) * W
        const y2 = (0.43 * Math.cos(freqY * theta2 + phi2) + 0.5) * H

        const hue = (ts * 80 + (i / maxSegments) * 360) % 360
        const color = `hsla(${hue}, 100%, 60%, 0.85)`
        ctx.strokeStyle = color
        ctx.shadowColor = color

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      ctx.shadowBlur = 0 // Reset

      // HUD Label
      ctx.font = '10px monospace'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.7)'
      ctx.fillText(`SIGNAL TRACE // LISSAJOUS Ω // FREQ_X: ${freqX.toFixed(2)} // FREQ_Y: ${freqY.toFixed(2)}`, 10, H - 10)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="SIGNAL TRACE // LISSAJOUS Ω">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

