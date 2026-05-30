import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'
import ShaderPanel from '../ui/ShaderPanel'

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
  // Optionaler FPS-Cap fuer teure CPU-Szenen. Default = ungetaktet (60 Hz
  // via rAF). Beispiel: 30 halbiert die Frame-Last fuer Szenen, die bei
  // 30 fps visuell nicht wahrnehmbar schlechter aussehen (z. B.
  // ThreeBodyScene mit 480 000 RGBA-Bytes pro Frame). Siehe
  // AUDIT_FINDINGS.md H-04.
  fpsCap?: number,
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

      // Start loop initially
      unsubscribe = subscribe(loop)

      // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
      const io = new IntersectionObserver(
        ([entry]) => {
          const visible = entry.isIntersecting
          if (visible) {
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
      // FPS-Cap: minimaler Abstand zwischen zwei Draw-Calls in Millisekunden.
      // 0 = kein Cap (jeder rAF-Tick rendert).
      const minDt = fpsCap && fpsCap > 0 ? 1000 / fpsCap : 0
      let lastDrawT = 0

      function loop(t: number) {
        if (!alive) return

        // Sicherheitscheck: Canvas muss eine Größe haben
        if (canvas.width === 0 || canvas.height === 0) {
          return
        }

        // FPS-Cap respektieren — frueh raus, ohne draw/putImageData/drawImage.
        if (minDt > 0 && (t - lastDrawT) < minDt) return
        lastDrawT = t

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

const FIRE_SHADER = `
  precision highp float;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  
  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  float fbm(in vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float ts = iTime;
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    // Basis-Flammenform (unten heiß, nach oben abnehmend)
    float base = 1.0 - uv.y;
    
    // UV verzerren mit FBM-Rauschen für organischen Flammeneffekt
    vec2 noiseUV = uv * vec2(4.0, 3.0);
    noiseUV.y -= ts * 2.5; // Flammen steigen auf
    noiseUV.x += sin(ts * 1.5 + uv.y * 2.0) * 0.15; // leichtes Lodern
    
    float n = fbm(noiseUV);
    float heat = base * 0.4 + n * 0.7;
    
    // Blaue/cyan "Plasma-Jets" deaktiviert für ein homogenes Flammenbild
    float isJet = 0.0;
    
    // Chemiefeuer-Modus (3 Sekunden alle 30 Sekunden)
    float chemTime = mod(ts, 30.0);
    float isChem = step(27.0, chemTime);
    
    vec3 col = vec3(0.0);
    
    if (heat > 0.1) {
      if (isChem > 0.5) {
        // Grünes/gelbes Chemiefeuer
        col = mix(vec3(0.0), vec3(0.0, 0.5, 0.1), smoothstep(0.1, 0.3, heat));
        col = mix(col, vec3(0.6, 0.9, 0.1), smoothstep(0.3, 0.6, heat));
        col = mix(col, vec3(0.9, 1.0, 0.5), smoothstep(0.6, 0.9, heat));
      } else {
        // Normales Feuer (schwarz -> rot -> orange/gelb -> weiß)
        col = mix(vec3(0.0), vec3(0.8, 0.1, 0.0), smoothstep(0.1, 0.3, heat));
        col = mix(col, vec3(1.0, 0.6, 0.0), smoothstep(0.3, 0.6, heat));
        col = mix(col, vec3(1.0, 1.0, 0.8), smoothstep(0.6, 0.9, heat));
      }
      
      // Cyan/blaue Plasma-Jets einblenden
      if (isJet > 0.5) {
        vec3 jetCol = mix(vec3(0.0), vec3(0.0, 0.3, 0.8), smoothstep(0.1, 0.4, heat));
        jetCol = mix(jetCol, vec3(0.0, 0.8, 0.9), smoothstep(0.4, 0.8, heat));
        col = mix(col, jetCol, 0.65 * (1.0 - uv.y));
      }
    }
    
    // Bloom + Ausfaden oben
    col *= smoothstep(0.05, 0.2, heat) * (1.0 - uv.y * uv.y * 0.9);
    
    fragColor = vec4(col, 1.0);
  }
`

export const FireScene = React.memo(function FireScene() {
  return (
    <ShaderPanel
      fragmentShader={FIRE_SHADER}
      title="CORE MELTDOWN // STATUS: CRITICAL"
    />
  )
})

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
      speed = 0.006 + 0.114 * p * p
      warpFactor = p
    } else if (cycleTime < 20) {
      phase = 'hyperspace'
      speed = 0.12
      warpFactor = 1
    } else {
      phase = 'warpout'
      const p = (cycleTime - 20) / 2
      speed = 0.12 - 0.114 * (1 - (1 - p) * (1 - p))
      warpFactor = 1 - p
    }

    state.phase = phase
    state.speedVal = speed
    state.warpFactor = warpFactor
    state.xCoord += (phase === 'hyperspace' ? 0.35 : 0.01) * (Math.random() * 0.5 + 0.75)
    state.yCoord += (phase === 'hyperspace' ? -0.15 : -0.005) * (Math.random() * 0.5 + 0.75)
    state.zCoord += (phase === 'hyperspace' ? 0.95 : 0.02) * (Math.random() * 0.5 + 0.75)

    buf.fill(0)
    for (let i = 3; i < buf.length; i+=4) buf[i] = 255

    for (let idx = 0; idx < state.stars.length; idx++) {
      const s = state.stars[idx]
      const prevZ = s.z
      s.z -= speed
      if (s.z <= 0.01) {
        s.x = (Math.random()-0.5)*2
        s.y = (Math.random()-0.5)*2
        s.z = 1
        continue
      }

      const sx = Math.round(s.x / s.z * W * 0.45 + W/2)
      const sy = Math.round(s.y / s.z * H * 0.45 + H/2)
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue

      if (phase === 'normal') {
        const br  = Math.round(255 * (1 - s.z))
        const ext = s.z < 0.15 ? 1 : 0
        for (let dy = -ext; dy <= ext; dy++)
          for (let dx = -ext; dx <= ext; dx++) {
            const px = sx + dx, py = sy + dy
            if (px < 0 || px >= W || py < 0 || py >= H) continue
            const pi = (py * W + px) * 4
            buf[pi] = br; buf[pi+1] = br; buf[pi+2] = br; buf[pi+3] = 255
          }
      } else {
        const psx = Math.round(s.x / prevZ * W * 0.45 + W/2)
        const psy = Math.round(s.y / prevZ * H * 0.45 + H/2)

        let r = 255, g = 255, b = 255
        if (phase === 'hyperspace') {
          if (idx % 3 === 0) { r = 0; g = 255; b = 255 }
          else if (idx % 3 === 1) { r = 255; g = 0; b = 255 }
          else { r = 0; g = 255; b = 0 }
        } else {
          let nr = 255, ng = 255, nb = 255
          if (idx % 3 === 0) { nr = 0; ng = 255; nb = 255 }
          else if (idx % 3 === 1) { nr = 255; ng = 0; nb = 255 }
          else { nr = 0; ng = 255; nb = 0 }
          r = Math.round(255 + (nr - 255) * warpFactor)
          g = Math.round(255 + (ng - 255) * warpFactor)
          b = Math.round(255 + (nb - 255) * warpFactor)
        }

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
    const cycleTime = (t / 1000) % 22
    const cx = W / 2
    const cy = H / 2

    // Target locked brackets
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.8)'
    offCtx.lineWidth = 1.5
    
    const targetX = cx + Math.sin(t * 0.001) * (W * 0.15)
    const targetY = cy + Math.cos(t * 0.0012) * (H * 0.15)
    const bracketSize = 25
    
    offCtx.beginPath()
    offCtx.moveTo(targetX - bracketSize, targetY - bracketSize + 8)
    offCtx.lineTo(targetX - bracketSize, targetY - bracketSize)
    offCtx.lineTo(targetX - bracketSize + 8, targetY - bracketSize)
    offCtx.moveTo(targetX + bracketSize, targetY - bracketSize + 8)
    offCtx.lineTo(targetX + bracketSize, targetY - bracketSize)
    offCtx.lineTo(targetX + bracketSize - 8, targetY - bracketSize)
    offCtx.moveTo(targetX - bracketSize, targetY + bracketSize - 8)
    offCtx.lineTo(targetX - bracketSize, targetY + bracketSize)
    offCtx.lineTo(targetX - bracketSize + 8, targetY + bracketSize)
    offCtx.moveTo(targetX + bracketSize, targetY + bracketSize - 8)
    offCtx.lineTo(targetX + bracketSize, targetY + bracketSize)
    offCtx.lineTo(targetX + bracketSize - 8, targetY + bracketSize)
    offCtx.stroke()

    offCtx.fillStyle = 'rgba(74, 222, 128, 0.9)'
    offCtx.font = '9px monospace'
    offCtx.fillText('LOCK // TRAP-1e', targetX - bracketSize, targetY - bracketSize - 4)

    // Render Spacecraft
    const isWarping = state.phase === 'hyperspace' || state.phase === 'warpin'
    const shakeX = isWarping ? (Math.random() - 0.5) * 4 : 0
    const shakeY = isWarping ? (Math.random() - 0.5) * 4 : 0
    
    const shipX = targetX + Math.sin(t * 0.0015) * 12 + shakeX
    const shipY = targetY + 25 + Math.cos(t * 0.001) * 6 + shakeY

    offCtx.strokeStyle = 'rgba(0, 255, 240, 0.85)'
    offCtx.lineWidth = 1.8
    offCtx.beginPath()
    offCtx.moveTo(shipX - 25, shipY + 8)
    offCtx.lineTo(shipX - 10, shipY + 3)
    offCtx.lineTo(shipX - 5, shipY + 5)
    offCtx.lineTo(shipX + 5, shipY + 5)
    offCtx.lineTo(shipX + 10, shipY + 3)
    offCtx.lineTo(shipX + 25, shipY + 8)
    offCtx.lineTo(shipX + 12, shipY + 12)
    offCtx.lineTo(shipX + 4, shipY + 8)
    offCtx.lineTo(shipX - 4, shipY + 8)
    offCtx.lineTo(shipX - 12, shipY + 12)
    offCtx.closePath()
    offCtx.stroke()

    offCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    offCtx.beginPath()
    offCtx.moveTo(shipX - 4, shipY + 2)
    offCtx.lineTo(shipX, shipY - 6)
    offCtx.lineTo(shipX + 4, shipY + 2)
    offCtx.closePath()
    offCtx.stroke()

    const engineSize = isWarping 
      ? 12 + 6 * Math.sin(t * 0.08) 
      : 4 + 1.5 * Math.sin(t * 0.02)
    
    const thrusterColor = isWarping
      ? 'rgba(255, 100, 0, 0.95)'
      : 'rgba(0, 240, 255, 0.85)'
      
    offCtx.fillStyle = thrusterColor
    offCtx.beginPath()
    offCtx.arc(shipX - 6, shipY + 8, engineSize * 0.6, 0, Math.PI * 2)
    offCtx.arc(shipX + 6, shipY + 8, engineSize * 0.6, 0, Math.PI * 2)
    offCtx.fill()
    
    offCtx.fillStyle = '#ffffff'
    offCtx.beginPath()
    offCtx.arc(shipX - 6, shipY + 8, engineSize * 0.25, 0, Math.PI * 2)
    offCtx.arc(shipX + 6, shipY + 8, engineSize * 0.25, 0, Math.PI * 2)
    offCtx.fill()

    let statusText = 'STATUS: NOMINAL'
    let speedText = '0.05c'
    if (state.phase === 'normal') {
      statusText = 'STATUS: NOMINAL'
      speedText = `${(0.05 + state.speedVal * 2).toFixed(3)}c`
      
      const countdown = Math.max(0, 8 - cycleTime)
      offCtx.fillStyle = '#facc15'
      offCtx.font = 'bold 11px monospace'
      offCtx.fillText(`HYPERJUMP COUNTDOWN: ${countdown.toFixed(2)}s`, cx - 90, cy + 50)
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

    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.04)'
    offCtx.lineWidth = 1
    for (let y = 0; y < H; y += 3) {
      offCtx.beginPath()
      offCtx.moveTo(0, y)
      offCtx.lineTo(W, y)
      offCtx.stroke()
    }

    const margin = 12
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.3)'
    offCtx.lineWidth = 1
    offCtx.strokeRect(margin, margin, W - 2 * margin, H - 2 * margin)

    const ladderXLeft = 35
    const ladderXRight = W - 35
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.25)'
    offCtx.beginPath()
    offCtx.moveTo(ladderXLeft, 40)
    offCtx.lineTo(ladderXLeft, H - 40)
    offCtx.moveTo(ladderXRight, 40)
    offCtx.lineTo(ladderXRight, H - 40)
    offCtx.stroke()

    offCtx.beginPath()
    for (let y = 45; y < H - 40; y += 15) {
      offCtx.moveTo(ladderXLeft, y)
      offCtx.lineTo(ladderXLeft + 6, y)
      offCtx.moveTo(ladderXRight, y)
      offCtx.lineTo(ladderXRight - 6, y)
    }
    offCtx.stroke()

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

    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.1)'
    offCtx.beginPath()
    offCtx.arc(cx, cy, Math.min(W, H) * 0.22, 0, Math.PI * 2)
    offCtx.stroke()

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

const TUNNEL_SHADER = `
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float ts = iTime;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv) + 0.001;
    float angle = atan(uv.y, uv.x);

    float u = angle / 3.14159265;
    float v = 0.5 / r;

    float wave = sin(u * 5.0 + ts * 2.0) * cos(v * 0.5 - ts * 3.0);
    u += 0.06 * wave;
    v += 0.15 * wave;

    float p1 = sin(u * 6.0 + ts) * cos(v * 2.0 - ts * 2.0);
    float p2 = sin(u * 12.0 - ts * 1.5) * cos(v * 4.0 + ts * 3.0);
    float plasma = 0.5 + 0.35 * p1 + 0.15 * p2;

    vec3 baseCol = mix(vec3(0.02, 0.04, 0.25), vec3(0.0, 0.85, 0.9), plasma);
    baseCol = mix(baseCol, vec3(0.48, 0.05, 0.85), 0.3 * sin(v * 0.3 + ts));

    float core = exp(-r * 3.5);
    baseCol = mix(baseCol, vec3(0.9, 0.95, 1.0), core * 0.7);

    float streakPattern = sin(u * 14.0 + sin(ts * 0.5) * 2.0) * cos(v * 0.8 - ts * 12.0);
    float streaks = smoothstep(0.72, 0.98, streakPattern);
    
    vec3 streakCol = vec3(0.85, 0.95, 1.0) * streaks * smoothstep(0.02, 0.25, r);
    vec3 col = baseCol + streakCol * 1.4;

    float centerFade = smoothstep(0.008, 0.08, r);
    col *= centerFade;

    col *= 0.95 + 0.05 * sin(fragCoord.y * 2.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const TunnelScene = React.memo(function TunnelScene() {
  return (
    <ShaderPanel
      fragmentShader={TUNNEL_SHADER}
      title="WORMHOLE // TRANSIT ACTIVE"
    />
  )
})

// ── Effekt 4: Rotozoom — rotierende + zoomende Kacheln ───────────────────────
// Performance-Cap: max 200×150.

const ROTOZOOM_SHADER = `
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float ts = iTime;

    // Aspect-preserving virtual coords (siehe TUNNEL_SHADER).
    float originalW = min(iResolution.x, 320.0);
    float originalH = min(iResolution.y, 240.0);
    float scale = min(iResolution.x / originalW, iResolution.y / originalH);
    vec2 p = (fragCoord.xy - iResolution.xy * 0.5) / scale + vec2(originalW, originalH) * 0.5;

    float cx = p.x - originalW / 2.0;
    float cy = p.y - originalH / 2.0;

    float z = 0.04 + 0.03 * sin(ts * 0.5);
    float cVal = cos(ts * 0.6) * z;
    float sVal = sin(ts * 0.6) * z;
    
    // 2x2 grid supersampling on checker function to smooth edges
    float checkerSum = 0.0;
    float offsets[2];
    offsets[0] = -0.25;
    offsets[1] = 0.25;
    
    for (int i = 0; i < 2; i++) {
      float subCy = cy + offsets[i];
      for (int j = 0; j < 2; j++) {
        float subCx = cx + offsets[j];
        float sx = subCx * cVal - subCy * sVal;
        float sy = subCx * sVal + subCy * cVal;
        float checker = mod(floor(sx) + floor(sy), 2.0);
        checkerSum += abs(checker);
      }
    }
    float checkerAvg = checkerSum * 0.25;
    
    float centerSx = cx * cVal - cy * sVal;
    float centerSy = cx * sVal + cy * cVal;
    
    float hue = mod(abs((centerSx + centerSy) * 10.0 + ts * 40.0), 360.0) / 360.0;
    float lightness = 0.05 + 0.50 * checkerAvg;
    
    vec3 col = hsl2rgb(vec3(hue, 1.0, lightness));
    fragColor = vec4(col, 1.0);
  }
`

export const RotozoomScene = React.memo(function RotozoomScene() {
  return (
    <ShaderPanel
      fragmentShader={ROTOZOOM_SHADER}
      title="TESSERACT ROTATION // DECRYPTING"
    />
  )
})

// ── Effekt 5: Metaballs — flüssige Blobs, fein gerastert ─────────────────────
// Verbesserung: Step-Size auf 3px reduziert → kein blockiges Pixel-Raster mehr.
// Anzahl Bälle auf 5 gekappt (war schon 5, explizit bestätigt) um Performance
// beim feineren Raster auszugleichen.
// Performance-Cap: max 200×150.

const METABALLS_SHADER = `
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float ts = iTime * 0.85;
    
    float sum = 0.0;
    vec3 colorSum = vec3(0.0);
    
    for (int i = 0; i < 5; i++) {
        vec2 pos = vec2(0.0);
        float radius = 0.07 + 0.01 * sin(ts + float(i));
        float hue = float(i) * 72.0 + ts * 15.0;
        
        if (i == 0) {
            pos = vec2(0.35 * sin(ts * 1.2), 0.22 * cos(ts * 0.95));
        } else if (i == 1) {
            pos = vec2(-0.3 * cos(ts * 0.85), -0.2 * sin(ts * 1.15));
        } else if (i == 2) {
            float split = sin(ts * 2.5) * 0.5 + 0.5;
            vec2 parent = vec2(0.35 * sin(ts * 1.2), 0.22 * cos(ts * 0.95));
            pos = parent + vec2(0.18 * split * sin(ts * 3.0), 0.18 * split * cos(ts * 3.0));
            radius *= 0.75;
        } else if (i == 3) {
            pos = vec2(0.28 * cos(ts * 0.75), -0.24 * cos(ts * 1.3));
        } else {
            pos = vec2(-0.35 * sin(ts * 1.05), 0.25 * sin(ts * 0.7));
        }
        
        float d = length(uv - pos);
        float w = (radius * radius) / (d * d + 0.0001);
        sum += w;
        
        vec3 ballCol = hsl2rgb(vec3(mod(hue, 360.0) / 360.0, 0.95, 0.55));
        colorSum += ballCol * w;
    }
    
    vec3 col = vec3(0.0);
    float threshold = 1.0;
    float borderThickness = 0.08;
    
    if (sum > threshold) {
        vec3 fluidCol = colorSum / sum;
        float interior = clamp((sum - threshold) * 0.2, 0.0, 1.0);
        col = mix(fluidCol * 0.8, fluidCol, interior);
        
        float innerGlow = smoothstep(threshold + borderThickness, threshold, sum);
        col += vec3(1.0) * innerGlow * 0.35;
    }
    
    float glow = exp(-abs(sum - threshold) * 2.5);
    vec3 outlineCol = mix(vec3(0.0, 0.95, 0.95), vec3(0.9, 0.08, 0.85), sin(ts * 0.5) * 0.5 + 0.5);
    col += outlineCol * glow * 0.8;
    
    col += outlineCol * sum * 0.02;

    col *= 0.93 + 0.07 * sin(fragCoord.y * 2.0);
    col *= 1.0 - length(uv) * 0.3;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const MetaballsScene = React.memo(function MetaballsScene() {
  return (
    <ShaderPanel
      fragmentShader={METABALLS_SHADER}
      title="LIQUID CODE // RENDERING"
    />
  )
})

// ── Effekt 6: Neural Net — Canvas-2D-Version mit scharfen Linien + Labels ────
// Standalone-Komponente (kein makeScene), damit Canvas-2D-API genutzt werden
// kann: pixelscharfe Linien via ctx.strokePath, Text-Labels via ctx.fillText.
interface Node3D {
  x: number
  y: number
  z: number
  colorIdx: number
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

    let unsubscribe: (() => void) | null = null
    let nodes: Node3D[] = []

    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      initNodes()
    })
    ro.observe(canvas)

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!unsubscribe) unsubscribe = subscribe(loop)
      } else {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
      }
    })
    io.observe(canvas)

    function initNodes() {
      nodes = []
      // 300 actual nodes in a 3D spherical shell / nebula
      for (let i = 0; i < 300; i++) {
        const u = Math.random()
        const v = Math.random()
        const theta = u * 2.0 * Math.PI
        const phi = Math.acos(2.0 * v - 1.0)
        const radius = 100 + Math.random() * 60 // thick shell
        
        nodes.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          colorIdx: i % 3
        })
      }
    }

    const loop = (t: number) => {
      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      if (nodes.length === 0) initNodes()

      // Dark futuristic blue/purple space background
      ctx.fillStyle = '#020108'
      ctx.fillRect(0, 0, W, H)

      const time = t * 0.0004
      const cosY = Math.cos(time)
      const sinY = Math.sin(time)
      const cosX = Math.cos(time * 0.4)
      const sinX = Math.sin(time * 0.4)

      const focalLength = 300
      const zoom = 1.0 + 0.35 * Math.sin(t * 0.0003) // Elegant breathing zoom

      interface ProjectedNode {
        sx: number
        sy: number
        sz: number
        node: Node3D
      }
      const projected: ProjectedNode[] = []

      // 1. Rotate and project all 300 nodes
      for (const n of nodes) {
        // Rotate around Y axis
        let x1 = n.x * cosY - n.z * sinY
        let z1 = n.x * sinY + n.z * cosY
        
        // Rotate around X axis
        let y2 = n.y * cosX - z1 * sinX
        let z2 = n.y * sinX + z1 * cosX

        // Perspective projection
        const scale = (focalLength / (focalLength + z2)) * zoom
        const sx = W / 2 + x1 * scale * (W / 640) * 1.6
        const sy = H / 2 + y2 * scale * (H / 480) * 1.6

        projected.push({ sx, sy, sz: z2, node: n })
      }

      // Sort by depth (z) for correct painter's rendering
      projected.sort((a, b) => b.sz - a.sz)

      // 2. Draw connections (only close nodes in 3D to look like a constellation)
      ctx.lineWidth = 0.5
      const connectDistSq = 45 * 45
      for (let i = 0; i < projected.length; i += 3) { // Step to keep it super high perf
        for (let j = i + 1; j < projected.length; j += 4) {
          const pi = projected[i]
          const pj = projected[j]
          
          const dx = pi.node.x - pj.node.x
          const dy = pi.node.y - pj.node.y
          const dz = pi.node.z - pj.node.z
          const dsq = dx*dx + dy*dy + dz*dz
          
          if (dsq < connectDistSq) {
            // Neon gradient alpha based on depth and distance
            const distAlpha = (1.0 - dsq / connectDistSq)
            const depthAlpha = (1.0 - (pi.sz + pj.sz + 320) / 640)
            const alpha = Math.max(0, Math.min(1.0, distAlpha * depthAlpha * 0.42))
            
            ctx.strokeStyle = pi.node.colorIdx === 0 
              ? `rgba(0, 195, 255, ${alpha.toFixed(3)})` 
              : `rgba(255, 0, 180, ${alpha.toFixed(3)})`
              
            ctx.beginPath()
            ctx.moveTo(pi.sx, pi.sy)
            ctx.lineTo(pj.sx, pj.sy)
            ctx.stroke()
          }
        }
      }

      // 3. Draw nodes as glowing points
      for (const p of projected) {
        const baseSize = 2.0
        const size = Math.max(0.5, (1.0 - (p.sz + 160) / 320) * baseSize * zoom)
        
        // Depth-fade
        const alpha = Math.max(0.15, Math.min(1.0, 1.0 - (p.sz + 160) / 320))
        
        ctx.fillStyle = p.node.colorIdx === 0 
          ? `rgba(0, 230, 255, ${alpha.toFixed(3)})` 
          : p.node.colorIdx === 1
          ? `rgba(255, 50, 200, ${alpha.toFixed(3)})`
          : `rgba(240, 230, 255, ${alpha.toFixed(3)})`

        ctx.beginPath()
        ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2)
        ctx.fill()

        // Highlight center core for closer nodes
        if (p.sz < -40) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, size * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 4. Subtle diagnostic overlay
      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(240, 230, 255, 0.4)'
      ctx.fillText(`NEURAL POINT CLOUD // COGNITIVE NEBULA`, 15, 18)
      ctx.fillText(`NODES: 300 // RATING: OPTIMAL // ZOOM: x${zoom.toFixed(2)}`, 15, 28)
    }

    unsubscribe = subscribe(loop)
    return () => {
      if (unsubscribe) unsubscribe()
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="NEURAL CONSTELLATION // COGNITIVE CLOUD">
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
  },
  false, // pixelated default
  30,    // FPS-Cap: ThreeBodyScene rendert CPU-seitig 480 000 RGBA-Bytes
         // pro Frame. 30 fps reichen visuell (langsame Bahn-Drift), halbieren
         // die Frame-Last. AUDIT_FINDINGS.md H-04.
)

// ── Effekt 8: Lissajous — animierte Kurve mit Nachleucht-Spur ────────────────
// Performance-Cap: max 200×150.
export const LissajousScene = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    // Migration auf zentralen raf-coordinator (AUDIT_FINDINGS.md H-05).
    let unsubscribe: (() => void) | null = null
    let alive = true

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!unsubscribe && alive) unsubscribe = subscribe(loop)
      } else {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
      }
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

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) return

      // Phosphor decay trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.fillRect(0, 0, W, H)

      // Circular reticle and fine tick marks instead of center-cross
      ctx.strokeStyle = 'rgba(0, 240, 100, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const maxRadius = Math.min(W, H) * 0.44
      ctx.arc(W / 2, H / 2, maxRadius, 0, Math.PI * 2)
      ctx.arc(W / 2, H / 2, maxRadius * 0.5, 0, Math.PI * 2)
      ctx.stroke()

      // Radial ticks
      ctx.beginPath()
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const x1 = W / 2 + Math.cos(angle) * (maxRadius - 4)
        const y1 = H / 2 + Math.sin(angle) * (maxRadius - 4)
        const x2 = W / 2 + Math.cos(angle) * maxRadius
        const y2 = H / 2 + Math.sin(angle) * maxRadius
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      }
      ctx.stroke()

      const ts = t * 0.001
      // Path variance: aggressive frequency modulation for more varied patterns
      const modX = 0.8 * Math.sin(ts * 0.7)
      const modY = 0.8 * Math.cos(ts * 0.5)
      const freqX = 3 + 1.5 * Math.sin(ts * 0.15) + modX
      const freqY = 4 + 1.5 * Math.cos(ts * 0.22) + modY

      phi1 += 0.018
      phi2 += 0.012

      const maxSegments = 450
      const progress = 0.5 + 0.5 * Math.sin(ts * 0.7)
      const activeSegments = Math.max(2, Math.floor(progress * maxSegments))

      ctx.lineWidth = 2.4
      ctx.shadowBlur = 10
      ctx.lineCap = 'round'

      for (let i = 1; i < activeSegments; i++) {
        const theta1 = ((i - 1) / maxSegments) * Math.PI * 6
        const theta2 = (i / maxSegments) * Math.PI * 6

        const x1 = (0.42 * Math.sin(freqX * theta1 + phi1) + 0.5) * W
        const y1 = (0.42 * Math.cos(freqY * theta1 + phi2) + 0.5) * H
        const x2 = (0.42 * Math.sin(freqX * theta2 + phi1) + 0.5) * W
        const y2 = (0.42 * Math.cos(freqY * theta2 + phi2) + 0.5) * H

        const hue = (ts * 90 + (i / maxSegments) * 360) % 360
        const color = `hsla(${hue}, 100%, 65%, 0.9)`
        ctx.strokeStyle = color
        ctx.shadowColor = color

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      ctx.shadowBlur = 0 // Reset

      // HUD Label
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(74, 222, 128, 0.7)'
      ctx.fillText(`SIGNAL TRACE // LISSAJOUS Ω // X_MOD: ${freqX.toFixed(2)} // Y_MOD: ${freqY.toFixed(2)} // HILBERT: OK`, 12, H - 12)
    }

    unsubscribe = subscribe(loop)
    return () => {
      alive = false
      if (unsubscribe) unsubscribe()
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

