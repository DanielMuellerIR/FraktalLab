import React, { useEffect, useMemo, useRef } from 'react'
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
      speedName="FireScene"
    />
  )
})

type Star = { x: number; y: number; z: number; color: string }
type StarfieldState = {
  stars: Star[]
  phase: 'chase' | 'countdown' | 'jump' | 'hyperspace' | 'exit'
  xCoord: number
  yCoord: number
  zCoord: number
}
export const StarfieldScene = makeScene(
  'DEEP SPACE // SCANNING SECTOR 9', 99999, 99999,
  (): StarfieldState => ({
    stars: Array.from({length: 400}, () => ({
      x: (Math.random()-0.5)*2,
      y: (Math.random()-0.5)*2,
      z: Math.random(),
      color: ['#00ffff', '#ff00ff', '#ffffff', '#a855f7'][Math.floor(Math.random() * 4)],
    })),
    phase: 'chase',
    xCoord: 49.32,
    yCoord: -12.44,
    zCoord: 102.05,
  }),
  (buf, _W, _H, t, state: StarfieldState) => {
    const cycleTime = (t / 1000) % 26
    let speed = 0.005
    let phase: 'chase' | 'countdown' | 'jump' | 'hyperspace' | 'exit' = 'chase'

    if (cycleTime < 8) {
      phase = 'chase'
      speed = 0.005
    } else if (cycleTime < 12) {
      phase = 'countdown'
      const p = (cycleTime - 8) / 4
      speed = 0.005 + 0.015 * p * p
    } else if (cycleTime < 14) {
      phase = 'jump'
      const p = (cycleTime - 12) / 2
      speed = 0.02 + 0.12 * p * p
    } else if (cycleTime < 22) {
      phase = 'hyperspace'
      speed = 0.14
    } else {
      phase = 'exit'
      const p = (cycleTime - 22) / 4
      speed = 0.14 * (1 - p)
    }

    state.phase = phase
    state.xCoord += (phase === 'hyperspace' ? 0.35 : 0.01) * (Math.random() * 0.5 + 0.75)
    state.yCoord += (phase === 'hyperspace' ? -0.15 : -0.005) * (Math.random() * 0.5 + 0.75)
    state.zCoord += (phase === 'hyperspace' ? 0.95 : 0.02) * (Math.random() * 0.5 + 0.75)

    // Clear buffer (make it black)
    buf.fill(0)
    for (let i = 3; i < buf.length; i+=4) buf[i] = 255

    // Update stars
    for (let idx = 0; idx < state.stars.length; idx++) {
      const s = state.stars[idx]
      s.z -= speed
      if (s.z <= 0.01) {
        s.x = (Math.random()-0.5)*2
        s.y = (Math.random()-0.5)*2
        s.z = 1
      }
    }
  },
  (offCtx, W, H, t, state: StarfieldState) => {
    const cycleTime = (t / 1000) % 26
    const cx = W / 2
    const cy = H / 2
    const phase = state.phase

    let speed = 0.005
    let warpFactor = 0
    if (cycleTime < 8) {
      speed = 0.005
      warpFactor = 0
    } else if (cycleTime < 12) {
      const p = (cycleTime - 8) / 4
      speed = 0.005 + 0.015 * p * p
      warpFactor = p
    } else if (cycleTime < 14) {
      const p = (cycleTime - 12) / 2
      speed = 0.02 + 0.12 * p * p
      warpFactor = p
    } else if (cycleTime < 22) {
      speed = 0.14
      warpFactor = 1
    } else {
      const p = (cycleTime - 22) / 4
      speed = 0.14 * (1 - p)
      warpFactor = 1 - p
    }

    // Set line cap for clean star trails
    offCtx.lineCap = 'round'

    // Draw stars
    for (let idx = 0; idx < state.stars.length; idx++) {
      const s = state.stars[idx]
      const prevZ = s.z + speed
      const sx = s.x / s.z * W * 0.45 + cx
      const sy = s.y / s.z * H * 0.45 + cy
      const psx = s.x / prevZ * W * 0.45 + cx
      const psy = s.y / prevZ * H * 0.45 + cy

      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue

      const brightness = Math.min(1, 1 - s.z)

      if (phase === 'chase' || phase === 'countdown') {
        offCtx.fillStyle = `rgba(255, 255, 255, ${brightness})`
        const size = s.z < 0.2 ? 2 : 1
        offCtx.fillRect(sx - size/2, sy - size/2, size, size)
      } else {
        const alpha = brightness * (phase === 'jump' ? warpFactor : 1)
        offCtx.strokeStyle = phase === 'hyperspace'
          ? s.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
          : `rgba(255, 255, 255, ${alpha})`

        offCtx.lineWidth = phase === 'hyperspace' ? 2 : 1
        offCtx.beginPath()
        offCtx.moveTo(psx, psy)
        offCtx.lineTo(sx, sy)
        offCtx.stroke()
      }
    }

    // ── Ego-Perspektive (First-Person-Cockpit) ─────────────────────────────
    // Wir SIND das Schiff: das eigene Schiff wird NICHT mehr gezeichnet. Der
    // Betrachter blickt durch die Frontscheibe ins All. Der Feind ("Drohne")
    // treibt vor uns in der Tiefe, leicht um die Bildmitte schwankend.
    const targetX = cx + Math.sin(t * 0.001) * (W * 0.18)
    const targetY = cy + Math.cos(t * 0.0012) * (H * 0.15)
    const droneSize = 14

    // Mündungspunkte unserer beiden Flügelkanonen. Sie liegen im VORDERGRUND
    // (unten links und unten rechts, dicht am Bildrand) — genau da, wo bei
    // einer Cockpit-Sicht die eigenen Waffen sitzen. Von hier aus fliegen die
    // Schüsse nach VORNE in die Tiefe zum Feind.
    const gunLX = cx - W * 0.42
    const gunLY = cy + H * 0.46
    const gunRX = cx + W * 0.42
    const gunRY = cy + H * 0.46

    if (phase === 'chase' || phase === 'countdown') {
      // Draw locking brackets on target
      offCtx.strokeStyle = 'rgba(74, 222, 128, 0.8)'
      offCtx.lineWidth = 1.2
      const bracketSize = 18
      offCtx.beginPath()
      // Top-left
      offCtx.moveTo(targetX - bracketSize, targetY - bracketSize + 6)
      offCtx.lineTo(targetX - bracketSize, targetY - bracketSize)
      offCtx.lineTo(targetX - bracketSize + 6, targetY - bracketSize)
      // Top-right
      offCtx.moveTo(targetX + bracketSize, targetY - bracketSize + 6)
      offCtx.lineTo(targetX + bracketSize, targetY - bracketSize)
      offCtx.lineTo(targetX + bracketSize - 6, targetY - bracketSize)
      // Bottom-left
      offCtx.moveTo(targetX - bracketSize, targetY + bracketSize - 6)
      offCtx.lineTo(targetX - bracketSize, targetY + bracketSize)
      offCtx.lineTo(targetX - bracketSize + 6, targetY + bracketSize)
      // Bottom-right
      offCtx.moveTo(targetX + bracketSize, targetY + bracketSize - 6)
      offCtx.lineTo(targetX + bracketSize, targetY + bracketSize)
      offCtx.lineTo(targetX + bracketSize - 6, targetY + bracketSize)
      offCtx.stroke()

      offCtx.fillStyle = 'rgba(74, 222, 128, 0.9)'
      offCtx.font = '9px monospace'
      offCtx.fillText('LOCK // ESC-01', targetX - bracketSize, targetY - bracketSize - 4)

      // Draw Chased Drone (Target)
      offCtx.strokeStyle = 'rgba(255, 60, 60, 0.9)'
      offCtx.lineWidth = 1.5
      offCtx.beginPath()
      offCtx.moveTo(targetX, targetY - droneSize * 0.5)
      offCtx.lineTo(targetX + droneSize * 0.3, targetY)
      offCtx.lineTo(targetX, targetY + droneSize * 0.4)
      offCtx.lineTo(targetX - droneSize * 0.3, targetY)
      offCtx.closePath()
      offCtx.moveTo(targetX - droneSize * 0.3, targetY)
      offCtx.lineTo(targetX - droneSize * 0.8, targetY - droneSize * 0.2)
      offCtx.lineTo(targetX - droneSize * 0.7, targetY + droneSize * 0.3)
      offCtx.lineTo(targetX - droneSize * 0.2, targetY + droneSize * 0.2)
      offCtx.moveTo(targetX + droneSize * 0.3, targetY)
      offCtx.lineTo(targetX + droneSize * 0.8, targetY - droneSize * 0.2)
      offCtx.lineTo(targetX + droneSize * 0.7, targetY + droneSize * 0.3)
      offCtx.lineTo(targetX + droneSize * 0.2, targetY + droneSize * 0.2)
      offCtx.stroke()

      // Target Thruster
      const droneEngine = 3 + Math.sin(t * 0.05) * 1.5
      offCtx.fillStyle = phase === 'countdown' ? 'rgba(0, 240, 255, 0.9)' : 'rgba(255, 100, 0, 0.8)'
      offCtx.beginPath()
      offCtx.arc(targetX, targetY + droneSize * 0.4, droneEngine, 0, Math.PI * 2)
      offCtx.fill()

      // Hinweis: Hier wurde frueher das eigene cyanfarbene Verfolger-Schiff
      // gezeichnet (Third-Person-Sicht). In der Ego-Perspektive entfaellt das
      // komplett — wir SIND der Verfolger und sehen nur durch die Scheibe.
    }

    if (phase === 'chase') {
      // ── Eigenes Sperrfeuer: VON UNS nach VORNE zum Feind ──────────────────
      // Die Schuesse starten an den Fluegelkanonen im Vordergrund (gunLX/gunRX,
      // unten am Bildrand) und fliegen in die Tiefe zur Drohne (targetX/targetY).
      // Frueher lief der Schuss vom Verfolger-Schiff aus — die Richtung ist jetzt
      // also bewusst umgekehrt: Mündung vorne unten -> Ziel hinten in der Mitte.
      const shootInterval = 1200
      const timeInInterval = t % shootInterval
      if (timeInInterval < 150) {
        const progress = timeInInterval / 150
        offCtx.strokeStyle = 'rgba(0, 255, 255, 0.95)'
        offCtx.lineWidth = 2
        offCtx.lineCap = 'round'

        // Linker Schuss: aktuelle Spitze entlang der Linie Mündung -> Ziel.
        const lTipX = gunLX + (targetX - gunLX) * progress
        const lTipY = gunLY + (targetY - gunLY) * progress
        offCtx.beginPath()
        // Kurzer "Tracer"-Schweif HINTER der Spitze (Richtung Mündung), damit
        // der Schuss als fliegender Strahl statt als statische Linie wirkt.
        offCtx.moveTo(lTipX - (targetX - gunLX) * 0.15, lTipY - (targetY - gunLY) * 0.15)
        offCtx.lineTo(lTipX, lTipY)
        offCtx.stroke()

        // Rechter Schuss: spiegelbildlich von der rechten Kanone aus.
        const rTipX = gunRX + (targetX - gunRX) * progress
        const rTipY = gunRY + (targetY - gunRY) * progress
        offCtx.beginPath()
        offCtx.moveTo(rTipX - (targetX - gunRX) * 0.15, rTipY - (targetY - gunRY) * 0.15)
        offCtx.lineTo(rTipX, rTipY)
        offCtx.stroke()

        // Einschlag-Ring am Feind, sobald die Schuesse fast angekommen sind.
        if (progress > 0.8) {
          offCtx.strokeStyle = 'rgba(255, 80, 80, 0.85)'
          offCtx.lineWidth = 1
          offCtx.beginPath()
          offCtx.arc(targetX, targetY, droneSize * 1.5 * (progress - 0.8) * 5, 0, Math.PI * 2)
          offCtx.stroke()
        }
      }
    }

    if (phase === 'countdown') {
      const countdownVal = Math.max(0, 12 - cycleTime)
      offCtx.fillStyle = '#facc15'
      offCtx.font = 'bold 12px monospace'
      offCtx.fillText(`WARNING: ESCAPE VECTOR INITIATED`, cx - 110, cy + 50)
      offCtx.fillText(`HYPERJUMP DETECTED IN: ${countdownVal.toFixed(2)}s`, cx - 110, cy + 68)

      offCtx.strokeStyle = 'rgba(0, 240, 255, 0.7)'
      offCtx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const angle = t * 0.01 + (i * Math.PI / 2)
        const rad = 25 - (t % 500) / 500 * 20
        offCtx.beginPath()
        offCtx.arc(targetX, targetY, rad, angle, angle + 0.5)
        offCtx.stroke()
      }
    }

    if (phase === 'jump') {
      // Der Feind (die Drohne) flieht in die Bildmitte und reisst dann in den
      // Warp. Unser eigenes Schiff wird in der Ego-Perspektive nicht gezeichnet
      // — wir springen ja "mit" und sehen alles durch unsere Scheibe.
      const p = (cycleTime - 12) / 2

      const targetJumpX = targetX + (cx - targetX) * p
      const targetJumpY = targetY + (cy - targetY) * p

      if (p < 0.6) {
        const droneSizeJ = droneSize * (1 - p / 0.6)
        offCtx.strokeStyle = `rgba(255, 60, 60, ${1 - p / 0.6})`
        offCtx.beginPath()
        offCtx.moveTo(targetJumpX, targetJumpY - droneSizeJ * 0.5)
        offCtx.lineTo(targetJumpX + droneSizeJ * 0.3, targetJumpY)
        offCtx.lineTo(targetJumpX, targetJumpY + droneSizeJ * 0.4)
        offCtx.lineTo(targetJumpX - droneSizeJ * 0.3, targetJumpY)
        offCtx.closePath()
        offCtx.stroke()
      }

      const flashRad = p * Math.max(W, H) * 0.8
      offCtx.strokeStyle = `rgba(255, 255, 255, ${1 - p})`
      offCtx.lineWidth = 4 * (1 - p)
      offCtx.beginPath()
      offCtx.arc(cx, cy, flashRad, 0, Math.PI * 2)
      offCtx.stroke()
    }

    if (phase === 'hyperspace') {
      offCtx.fillStyle = '#ef4444'
      offCtx.font = 'bold 12px monospace'
      offCtx.fillText(`HYPERSPACE DRIVE STABLE`, cx - 75, cy + 50)
      offCtx.font = '9px monospace'
      offCtx.fillStyle = 'rgba(74, 222, 128, 0.8)'
      offCtx.fillText(`WARP VECTOR FLUIDIC COHERENCE: 99.8%`, cx - 100, cy + 68)

      offCtx.lineWidth = 1.5
      const numCircles = 6
      for (let i = 0; i < numCircles; i++) {
        const offset = ((t * 0.001) + (i / numCircles)) % 1
        const rad = offset * Math.max(W, H) * 0.7
        const opacity = (1 - offset) * 0.4
        const hue = (t * 0.05 + i * 60) % 360
        offCtx.strokeStyle = `hsla(${hue}, 80%, 60%, ${opacity})`
        offCtx.beginPath()
        offCtx.arc(cx, cy, rad, 0, Math.PI * 2)
        offCtx.stroke()
      }
    }

    if (phase === 'exit') {
      const p = (cycleTime - 22) / 4
      offCtx.fillStyle = '#facc15'
      offCtx.font = 'bold 12px monospace'
      offCtx.fillText(`WARP DESYNCHRONIZATION IN PROGRESS`, cx - 110, cy + 50)

      // Beim Warp-Austritt taucht der Feind wieder aus der Bildmitte auf und
      // gleitet zurueck auf seine Position. Eigenes Schiff erneut nicht gezeichnet.
      const targetJumpX = cx + (targetX - cx) * p
      const targetJumpY = cy + (targetY - cy) * p

      const droneSizeJ = droneSize * p
      offCtx.strokeStyle = `rgba(255, 60, 60, ${p})`
      offCtx.beginPath()
      offCtx.moveTo(targetJumpX, targetJumpY - droneSizeJ * 0.5)
      offCtx.lineTo(targetJumpX + droneSizeJ * 0.3, targetJumpY)
      offCtx.lineTo(targetJumpX, targetJumpY + droneSizeJ * 0.4)
      offCtx.lineTo(targetJumpX - droneSizeJ * 0.3, targetJumpY)
      offCtx.closePath()
      offCtx.stroke()

      const flashRad = (1 - p) * Math.max(W, H) * 0.5
      offCtx.strokeStyle = `rgba(255, 255, 255, ${1 - p})`
      offCtx.lineWidth = 2 * (1 - p)
      offCtx.beginPath()
      offCtx.arc(cx, cy, flashRad, 0, Math.PI * 2)
      offCtx.stroke()
    }

    // Grid / Scan lines
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

    let statusText = 'STATUS: CHASE / LOCKED'
    let speedText = '0.050c'
    if (phase === 'chase') {
      statusText = 'STATUS: CHASE / LOCKED'
      speedText = `${(0.05 + speed * 2).toFixed(3)}c`
    } else if (phase === 'countdown') {
      statusText = 'STATUS: PRE-WARP ALERT'
      speedText = `${(0.05 + speed * 2).toFixed(3)}c`
    } else if (phase === 'jump') {
      statusText = 'STATUS: WARP TRANSITION'
      speedText = `WARP ${(9.9 * warpFactor).toFixed(1)}`
    } else if (phase === 'hyperspace') {
      statusText = 'STATUS: WARP ACTIVE'
      speedText = 'WARP 9.98'
    } else if (phase === 'exit') {
      statusText = 'STATUS: EXIT ENTRANCE'
      speedText = `WARP ${(9.9 * warpFactor).toFixed(1)}`
    }

    const bottomY = H - 22
    offCtx.fillStyle = '#4ade80'
    offCtx.font = 'bold 10px monospace'
    offCtx.fillText(`SPEED: ${speedText}`, 25, bottomY)

    let statusColor = '#4ade80'
    if (statusText.includes('ALERT') || statusText.includes('TRANSITION')) statusColor = '#facc15'
    else if (statusText.includes('ACTIVE')) statusColor = '#ef4444'
    offCtx.fillStyle = statusColor
    offCtx.fillText(statusText, W / 2 - 60, bottomY)

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

    // ── Cockpit-Kanzel (verstaerkt die Ego-Perspektive) ────────────────────
    // Zwei diagonale Streben laufen von den unteren Ecken zur oberen Bildmitte
    // — wie der Rahmen einer Frontscheibe, durch die wir blicken. Dazu kleine
    // Marker an den Fluegelkanonen unten, aus denen unsere Schuesse kommen.
    offCtx.strokeStyle = 'rgba(74, 222, 128, 0.18)'
    offCtx.lineWidth = 2
    offCtx.beginPath()
    // Linke Kanzelstrebe: untere linke Ecke -> oben Mitte
    offCtx.moveTo(0, H)
    offCtx.lineTo(cx - W * 0.12, H * 0.18)
    // Rechte Kanzelstrebe: untere rechte Ecke -> oben Mitte
    offCtx.moveTo(W, H)
    offCtx.lineTo(cx + W * 0.12, H * 0.18)
    // Oberer Querholm der Kanzel
    offCtx.moveTo(cx - W * 0.12, H * 0.18)
    offCtx.lineTo(cx + W * 0.12, H * 0.18)
    offCtx.stroke()

    // Fluegelkanonen-Marker (kleine Klammern an den Muendungen unten).
    offCtx.strokeStyle = 'rgba(0, 255, 255, 0.45)'
    offCtx.lineWidth = 1.5
    offCtx.beginPath()
    offCtx.moveTo(gunLX - 5, gunLY); offCtx.lineTo(gunLX + 5, gunLY)
    offCtx.moveTo(gunLX, gunLY - 5); offCtx.lineTo(gunLX, gunLY + 5)
    offCtx.moveTo(gunRX - 5, gunRY); offCtx.lineTo(gunRX + 5, gunRY)
    offCtx.moveTo(gunRX, gunRY - 5); offCtx.lineTo(gunRX, gunRY + 5)
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

    // Polar coordinates for cylindrical tunnel mapping
    float u = angle / 3.14159265;
    float v = 1.0 / r; // depth coordinate

    // Warp: geometry twisting and radial ripple wave
    float twist = sin(v * 0.05 + ts * 1.0) * 0.4;
    float ripple = sin(u * 5.0 - ts * 2.0) * 0.1;
    u += twist + ripple;
    v += cos(u * 3.0 + ts * 1.5) * 2.0;

    // Continuous color shifting: cycles between cyan, deep blue, fuchsia, purple
    float baseHue = 0.58 + 0.18 * sin(ts * 0.2 + v * 0.005);
    vec3 tunnelBase = hsl2rgb(vec3(mod(baseHue, 1.0), 0.85, 0.4));

    // Crystalline facet highlights (crystal walls)
    float facet1 = abs(fract(u * 5.0 + v * 0.15 + ts * 0.1) - 0.5);
    float facet2 = abs(fract(u * -5.0 + v * 0.15 - ts * 0.15) - 0.5);
    float crystal = smoothstep(0.12, 0.0, abs(facet1 - facet2));
    
    // Highlight sparkles based on angle/depth
    float sparkles = smoothstep(0.8, 1.0, sin(u * 12.0 + v * 0.8 + ts * 4.0)) 
                   * smoothstep(0.8, 1.0, cos(u * 8.0 - v * 1.2 + ts * 3.0));
    
    vec3 wallCol = mix(tunnelBase, vec3(1.0), crystal * 0.45);
    wallCol += vec3(0.9, 0.95, 1.0) * sparkles * 0.8;

    // Moving energy pulses/rings zipping through the tunnel
    float pulse = exp(-pow(mod(v + ts * 28.0, 60.0) - 30.0, 2.0) * 0.04);
    vec3 pulseCol = vec3(0.5, 0.9, 1.0) * pulse * 1.6;

    // Final color assembly
    vec3 col = wallCol + pulseCol;

    // Glowing core/singularity at the tunnel center
    float core = exp(-r * 4.0);
    col = mix(col, vec3(1.0, 0.96, 0.9), core * 0.95);

    // Fade out at the center and screen edges
    float centerFade = smoothstep(0.005, 0.06, r);
    col *= centerFade;

    // Subtle scanline overlay
    col *= 0.93 + 0.07 * sin(fragCoord.y * 2.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export const TunnelScene = React.memo(function TunnelScene() {
  return (
    <ShaderPanel
      fragmentShader={TUNNEL_SHADER}
      title="WORMHOLE // TRANSIT ACTIVE"
      speedName="TunnelScene"
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

  // Liefert ein "Muster" fuer Texel-Koordinaten (sx, sy). Welches Muster
  // verwendet wird, haengt von iPattern ab (per-Mount-Zufall, 0..3). So
  // sieht jeder Panel-Aufbau anders aus, statt immer dasselbe Schachbrett
  // zu zeigen.
  //   0 = klassisches Schachbrett
  //   1 = diagonale Streifen
  //   2 = konzentrische Ringe (Bullseye)
  //   3 = Karo-/Diamant-Gitter
  float patternValue(float sx, float sy) {
    if (iPattern < 0.5) {
      // Schachbrett: abwechselnd 0/1 pro Gitterzelle
      return abs(mod(floor(sx) + floor(sy), 2.0));
    } else if (iPattern < 1.5) {
      // Diagonale Streifen: Summe der Koordinaten in Baender zerlegt
      return step(0.5, fract((sx + sy) * 0.5));
    } else if (iPattern < 2.5) {
      // Konzentrische Ringe: Abstand zum Ursprung in Baender zerlegt
      return step(0.5, fract(length(vec2(sx, sy)) * 0.5));
    } else {
      // Karo-Gitter: Betraege der Bruchteile, ergibt Diamant-Kacheln
      vec2 f = abs(fract(vec2(sx, sy) * 0.5) - 0.5);
      return step(0.5, f.x + f.y);
    }
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

    // ── Per-Mount-Zufall aus iSeed ableiten ─────────────────────────────────
    // iSeed kommt als Uniform aus React (ein zufaelliger Wert pro Panel-Mount).
    // Daraus berechnen wir mehrere unabhaengige Pseudo-Zufallszahlen 0..1,
    // indem wir den Seed leicht verschoben durch eine fract(sin())-Hash-Funktion
    // schicken. Ergebnis: bei jedem Neuladen andere Geschwindigkeit, Drehrichtung,
    // Zoom-Tiefe und Farbpalette.
    float r0 = fract(sin(iSeed * 12.9898) * 43758.5453);
    float r1 = fract(sin(iSeed * 78.2330 + 1.7) * 43758.5453);
    float r2 = fract(sin(iSeed * 39.4250 + 4.3) * 43758.5453);
    float r3 = fract(sin(iSeed * 93.9890 + 7.1) * 43758.5453);

    // Drehrichtung: 50/50 links- oder rechtsherum.
    float spinDir = r0 < 0.5 ? -1.0 : 1.0;
    // Rotationsgeschwindigkeit: variiert von langsam (0.08) bis zuegig (0.32).
    float spinSpeed = 0.08 + 0.24 * r1;
    // Zoom-Bandbreite: wie stark der Trampolin-Bounce hinein-/herauszoomt.
    float zoomAmp = 0.045 + 0.05 * r2;
    // Farb-Offset: verschiebt die komplette Palette pro Mount.
    float hueShift = r3;

    // Trampolin ease-in-out snap bounce physics
    float period = 5.0;
    float cycle = mod(ts, period);
    float bounce = 0.0;
    if (cycle < 1.5) {
      float x = cycle / 1.5;
      bounce = x * x * x;
    } else if (cycle < 3.5) {
      float x = (cycle - 1.5) / 2.0;
      bounce = 1.0 + sin(x * 18.0) * exp(-x * 2.5) * 0.4;
    } else {
      float x = (cycle - 3.5) / 1.5;
      bounce = mix(1.0, 0.0, smoothstep(0.0, 1.0, x));
    }
    float z = 0.012 + zoomAmp * bounce;
    float angle = ts * spinSpeed * spinDir + bounce * 2.356;
    float cVal = cos(angle) * z;
    float sVal = sin(angle) * z;
    // 2x2 grid supersampling on pattern function to smooth edges
    float patternSum = 0.0;
    float offsets[2];
    offsets[0] = -0.25;
    offsets[1] = 0.25;

    for (int i = 0; i < 2; i++) {
      float subCy = cy + offsets[i];
      for (int j = 0; j < 2; j++) {
        float subCx = cx + offsets[j];
        float sx = subCx * cVal - subCy * sVal;
        float sy = subCx * sVal + subCy * cVal;
        // Statt fest Schachbrett: das per-Mount gewaehlte Muster abfragen.
        patternSum += patternValue(sx, sy);
      }
    }
    float patternAvg = patternSum * 0.25;

    float centerSx = cx * cVal - cy * sVal;
    float centerSy = cx * sVal + cy * cVal;

    // Hue bekommt zusaetzlich den per-Mount-Offset (hueShift) und eine
    // langsame Eigen-Drift ueber die Zeit, damit die Farben nicht statisch wirken.
    float hue = fract(
        abs((centerSx + centerSy) * 10.0 + ts * 40.0) / 360.0
      + hueShift
      + ts * 0.01
    );
    float lightness = 0.05 + 0.50 * patternAvg;

    vec3 col = hsl2rgb(vec3(hue, 1.0, lightness));
    fragColor = vec4(col, 1.0);
  }
`

export const RotozoomScene = React.memo(function RotozoomScene() {
  // Pro Mount einmalig zufaellige Uniforms erzeugen. useMemo mit leerer
  // Dependency-Liste sorgt dafuer, dass diese Werte ueber die gesamte
  // Lebensdauer der Komponente stabil bleiben (kein Flackern bei Re-renders),
  // sich aber bei jedem Neuladen/Neueinbau des Panels unterscheiden.
  //   iSeed    — beliebiger Zufallswert, im Shader zu Geschwindigkeit,
  //              Drehrichtung, Zoom-Tiefe und Farb-Offset verrechnet.
  //   iPattern — waehlt 1 von 4 Textur-Mustern (0..3): Schachbrett,
  //              Diagonal-Streifen, Ringe oder Karo-Gitter.
  const uniforms = useMemo(
    () => ({
      iSeed: Math.random() * 1000,
      iPattern: Math.floor(Math.random() * 4),
    }),
    [],
  )
  return (
    <ShaderPanel
      fragmentShader={ROTOZOOM_SHADER}
      uniforms={uniforms}
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
    
    // Dynamic number of active balls: cycles between 2 and 8
    float activeBalls = 5.0 + 3.0 * sin(ts * 0.25);
    
    float sum = 0.0;
    vec3 colorSum = vec3(0.0);
    
    // Trajectories for collision detection
    vec2 pos0 = vec2(0.32 * sin(ts * 1.1), 0.20 * cos(ts * 0.85));
    vec2 pos1 = vec2(-0.28 * cos(ts * 0.9), -0.18 * sin(ts * 1.05));
    float dist01 = length(pos0 - pos1);
    
    // Collision detection: triggers split when parent balls collide
    float collideVal = smoothstep(0.35, 0.15, dist01);
    float splitAmt0 = mix(0.08, 0.38 + 0.12 * sin(ts * 8.0), collideVal);
    
    vec2 pos3 = vec2(0.25 * cos(ts * 0.7), -0.22 * cos(ts * 1.2));
    vec2 pos4 = vec2(-0.32 * sin(ts * 0.95), 0.22 * sin(ts * 0.65));
    float dist34 = length(pos3 - pos4);
    float collideVal2 = smoothstep(0.40, 0.20, dist34);
    float splitAmt1 = mix(0.06, 0.34 + 0.10 * cos(ts * 9.5), collideVal2);

    for (int i = 0; i < 8; i++) {
        float active = step(float(i), activeBalls - 0.5);
        
        vec2 pos = vec2(0.0);
        float radius = 0.075 + 0.015 * sin(ts + float(i));
        float hue = float(i) * 45.0 + ts * 15.0;
        
        if (i == 0) {
            pos = pos0;
        } else if (i == 1) {
            pos = pos1;
        } else if (i == 2) {
            // Child of Ball 0, splits on collision
            pos = pos0 + vec2(splitAmt0 * sin(ts * 5.0), splitAmt0 * cos(ts * 5.0));
            radius *= 0.7;
        } else if (i == 3) {
            pos = pos3;
        } else if (i == 4) {
            pos = pos4;
        } else if (i == 5) {
            // Child of Ball 1, splits on collision
            pos = pos1 + vec2(-splitAmt0 * cos(ts * 4.5), splitAmt0 * sin(ts * 4.5));
            radius *= 0.65;
        } else if (i == 6) {
            pos = vec2(0.20 * sin(ts * 1.4), 0.18 * cos(ts * 1.6));
        } else if (i == 7) {
            // Child of Ball 3, splits on collision
            pos = pos3 + vec2(splitAmt1 * cos(ts * 6.0), -splitAmt1 * sin(ts * 6.0));
            radius *= 0.6;
        }
        
        float d = length(uv - pos);
        float w = (radius * radius) / (d * d + 0.0001);
        w *= active;
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
    
    // Extra visual burst flash during collisions
    vec3 flashCol = vec3(1.0, 0.9, 0.7) * (collideVal + collideVal2) * 0.4;
    col += (outlineCol + flashCol) * glow * 0.8;
    
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
      // 450 actual nodes in a 3D spherical shell / nebula (300+ nodes)
      for (let i = 0; i < 450; i++) {
        const u = Math.random()
        const v = Math.random()
        const theta = u * 2.0 * Math.PI
        const phi = Math.acos(2.0 * v - 1.0)
        const radius = 100 + Math.random() * 60 // thick shell
        
        nodes.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi),
          colorIdx: i % 4
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

      // Continuous multi-axis camera orbit
      const orbitY = t * 0.00045
      const orbitX = t * 0.00025 + 0.3 * Math.sin(t * 0.0001)
      const orbitZ = t * 0.00015
      
      const cosY = Math.cos(orbitY)
      const sinY = Math.sin(orbitY)
      const cosX = Math.cos(orbitX)
      const sinX = Math.sin(orbitX)
      const cosZ = Math.cos(orbitZ)
      const sinZ = Math.sin(orbitZ)

      const focalLength = 300
      const zoom = 1.0 + 0.35 * Math.sin(t * 0.0003) // Elegant breathing zoom

      interface ProjectedNode {
        sx: number
        sy: number
        sz: number
        node: Node3D
      }
      const projected: ProjectedNode[] = []

      // 1. Rotate and project all nodes
      for (const n of nodes) {
        // Rotate around Y axis
        let x1 = n.x * cosY - n.z * sinY
        let z1 = n.x * sinY + n.z * cosY
        
        // Rotate around X axis
        let y2 = n.y * cosX - z1 * sinX
        let z2 = n.y * sinX + z1 * cosX

        // Rotate around Z axis
        let x3 = x1 * cosZ - y2 * sinZ
        let y3 = x1 * sinZ + y2 * cosZ

        // Perspective projection
        const scale = (focalLength / (focalLength + z2)) * zoom
        const sx = W / 2 + x3 * scale * (W / 640) * 1.6
        const sy = H / 2 + y3 * scale * (H / 480) * 1.6

        projected.push({ sx, sy, sz: z2, node: n })
      }

      // Sort by depth (z) for correct painter's rendering
      projected.sort((a, b) => b.sz - a.sz)

      const colors = [
        { r: 255, g: 46,  b: 126 }, // neon fuchsia
        { r: 0,   g: 240, b: 220 }, // bright teal
        { r: 145, g: 60,  b: 255 }, // deep violet
        { r: 255, g: 170, b: 40  }  // neon amber
      ]

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
            
            const c = colors[pi.node.colorIdx]
            ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`
              
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
        
        const c = colors[p.node.colorIdx]
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`

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
      ctx.fillText(`NODES: 450 // RATING: OPTIMAL // ZOOM: x${zoom.toFixed(2)}`, 15, 28)
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

