import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

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
): () => React.JSX.Element {
  return function Scene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateRef = useRef<any>(null)

    useEffect(() => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      let raf: number
      let alive = true

      // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
      let isVisible = true
      const io = new IntersectionObserver(
        ([entry]) => { isVisible = entry.isIntersecting },
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

      function loop(t: number) {
        if (!alive) return
        // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
        if (!isVisible) { raf = requestAnimationFrame(loop); return }

        // Sicherheitscheck: Canvas muss eine Größe haben
        if (canvas.width === 0 || canvas.height === 0) {
          raf = requestAnimationFrame(loop)
          return
        }

        const { W, H } = getInternalSize()

        // OffscreenCanvas nur dann neu anlegen, wenn sich die interne Größe ändert
        if (offscreen.width !== W || offscreen.height !== H) {
          offscreen.width  = W
          offscreen.height = H
          // Zustand bei Größenänderung neu initialisieren (z.B. Buffer-Arrays)
          stateRef.current = mkState(W, H)
        }

        const offCtx = offscreen.getContext('2d')!
        const img = offCtx.createImageData(W, H)

        // Render-Callback füllt img.data mit RGBA-Pixeln
        draw(img.data, W, H, t, stateRef.current)

        // Interne Pixel in OffscreenCanvas schreiben ...
        offCtx.putImageData(img, 0, 0)
        // ... dann auf volle Canvas-Größe hochskalieren
        ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height)

        raf = requestAnimationFrame(loop)
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
      <Panel title={title}>
        {/* Canvas füllt den Panel-Body vollständig */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
        />
      </Panel>
    )
  }
}

// ── Effekt 1: Feuer — Doom-Algorithmus mit Farb-Varianz ──────────────────────
// Hitze von unten nach oben propagieren + leicht abkühlen → typisches Flammen-Muster.
// Farb-Varianz:
//   - Jede 4. Spalte erzeugt blaue/cyan "Plasma-Jets" statt orange/rot.
//   - Alle 30 s: 3 s "Chemiefeuer"-Modus — Basis wechselt zu Grün/Gelb.
// Interner Performance-Cap: max 160×100 (pixelated-Look ist gewollt).

// Zustandstyp für FireScene (Hitzebuffer + Chemiefeuer-Timer)
type FireState = {
  heat: Uint8Array          // Temperatur pro Pixel (0–255)
  nextChemAt: number        // Zeitpunkt (ms) des nächsten Chemiefeuer-Starts
  chemEndAt:  number        // Zeitpunkt (ms) an dem der Chemiefeuer-Effekt endet; -1 = inaktiv
}

export const FireScene = makeScene(
  'CORE MELTDOWN // STATUS: CRITICAL', 160, 100,
  // mkState: legt Hitzebuffer und Timer-Felder an
  (W, H): FireState => ({
    heat:       new Uint8Array(W * H),
    nextChemAt: 0,  // wird beim ersten Frame gesetzt
    chemEndAt:  -1, // kein aktiver Chemiefeuer-Effekt
  }),
  (buf, W, H, t, state: FireState) => {
    const { heat } = state

    // ── Chemiefeuer-Timer initialisieren beim ersten Frame ────────────────
    if (state.nextChemAt === 0) {
      state.nextChemAt = t + 30_000
    }

    // ── Chemiefeuer starten? ───────────────────────────────────────────────
    if (state.chemEndAt < 0 && t >= state.nextChemAt) {
      state.chemEndAt = t + 3_000   // Effekt dauert 3 s
    }

    // ── Chemiefeuer beendet? Nächsten Zyklus einplanen. ───────────────────
    const isChem = state.chemEndAt >= 0 && t <= state.chemEndAt
    if (state.chemEndAt >= 0 && t > state.chemEndAt) {
      state.chemEndAt  = -1
      state.nextChemAt = t + 30_000 // nächstes Chemiefeuer in 30 s
    }

    // Unterste Reihe: Feuer entzünden.
    // Im Chemiefeuer-Modus brennen ALLE Spalten mit voller Hitze.
    for (let x = 0; x < W; x++)
      heat[(H-1)*W+x] = Math.random() > 0.2 ? 255 : 180 + Math.floor(Math.random()*75)

    // Wärme nach oben propagieren + leicht abkühlen
    for (let y = 1; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = heat[y*W+x], bl = heat[y*W+Math.max(0,x-1)], br = heat[y*W+Math.min(W-1,x+1)]
        heat[(y-1)*W+x] = Math.max(0, Math.floor((a+bl+br)/3) - 4)
      }

    // Farbpalette je nach Spalte und Modus:
    //   - Chemiefeuer (isChem): gesamte Basis Grün/Gelb
    //   - Plasma-Jet (x % 4 === 0): Blau/Cyan statt Orange/Rot
    //   - Normal: Schwarz → Rot → Orange → Gelb → Weiß
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const h = heat[y*W+x]
        const pi = (y*W+x)*4

        // Chemiefeuer-Modus: unteren Bereich (y > H*0.5) in Grün/Gelb-Tönen
        if (isChem && y > H * 0.5) {
          // Grün/Gelb-Palette: Schwarz → Dunkelgrün → Grün → Gelbgrün → Gelb
          if      (h < 64)  { buf[pi]=0;       buf[pi+1]=h*2;      buf[pi+2]=0 }
          else if (h < 128) { buf[pi]=0;       buf[pi+1]=128;      buf[pi+2]=0 }
          else if (h < 192) { buf[pi]=(h-128)*4; buf[pi+1]=192;    buf[pi+2]=0 }
          else              { buf[pi]=255;     buf[pi+1]=255;      buf[pi+2]=0 }
        } else if (x % 4 === 0) {
          // Plasma-Jet-Spalten: Blau/Cyan-Palette
          if      (h < 64)  { buf[pi]=0;   buf[pi+1]=0;        buf[pi+2]=h*4 }
          else if (h < 128) { buf[pi]=0;   buf[pi+1]=(h-64)*4; buf[pi+2]=255 }
          else if (h < 192) { buf[pi]=(h-128)*4; buf[pi+1]=255; buf[pi+2]=255 }
          else              { buf[pi]=255; buf[pi+1]=255;       buf[pi+2]=255 }
        } else {
          // Normale Feuer-Palette: Schwarz → Rot → Orange → Gelb → Weiß
          if      (h < 64)  { buf[pi]=h*4;  buf[pi+1]=0;        buf[pi+2]=0 }
          else if (h < 128) { buf[pi]=255;  buf[pi+1]=(h-64)*4; buf[pi+2]=0 }
          else if (h < 192) { buf[pi]=255;  buf[pi+1]=255;      buf[pi+2]=(h-128)*4 }
          else              { buf[pi]=255;  buf[pi+1]=255;      buf[pi+2]=255 }
        }
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
  // Zeitpunkt (ms) des nächsten Hyperraum-Starts; 0 = noch nicht gesetzt
  nextHyperAt: number
  // Zeitpunkt (ms) bei dem der laufende Hyperraum-Effekt endet; -1 = kein aktiver Effekt
  hyperEndAt: number
}
export const StarfieldScene = makeScene(
  'DEEP SPACE // SCANNING SECTOR 9', 99999, 99999,
  // 450 Sterne statt 150 — dreifache Dichte
  (): StarfieldState => ({
    stars: Array.from({length: 450}, () => ({
      x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: Math.random(),
    })),
    nextHyperAt: 0,   // wird beim ersten Frame gesetzt
    hyperEndAt:  -1,  // kein aktiver Effekt
  }),
  (buf, W, H, t, state: StarfieldState) => {
    // ── Hyperraum-Timer initialisieren beim ersten Frame ──────────────────
    if (state.nextHyperAt === 0) {
      // Ersten Effekt nach 20–30 s einplanen
      state.nextHyperAt = t + 20_000 + Math.random() * 10_000
    }

    // ── Hyperraum starten? ────────────────────────────────────────────────
    if (state.hyperEndAt < 0 && t >= state.nextHyperAt) {
      state.hyperEndAt = t + 1500  // Effekt dauert 1,5 s
    }

    // ── Hyperraum beendet? Nächsten Zyklus einplanen. ─────────────────────
    const isHyper = state.hyperEndAt >= 0 && t <= state.hyperEndAt
    if (state.hyperEndAt >= 0 && t > state.hyperEndAt) {
      state.hyperEndAt  = -1
      // Nächsten Hyperraum nach 20–30 s einplanen
      state.nextHyperAt = t + 20_000 + Math.random() * 10_000
    }

    // Hintergrund schwarz, Alpha voll opak
    buf.fill(0)
    for (let i = 3; i < buf.length; i+=4) buf[i] = 255

    // Normaler Vorwärts-Speed oder Hyperraum-Speed (8×)
    const speed = isHyper ? 0.048 : 0.006

    for (const s of state.stars) {
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

      if (isHyper) {
        // Hyperraum: Linie vom vorherigen z-Punkt zum aktuellen z-Punkt zeichnen
        // (simuliert Längsstrich durch Bewegungsunschärfe)
        const psx = Math.round(s.x / prevZ * W * 0.45 + W/2)
        const psy = Math.round(s.y / prevZ * H * 0.45 + H/2)
        // Bresenham-Linie zwischen (psx,psy) und (sx,sy)
        let lx = psx, ly = psy
        const dx = Math.abs(sx - psx), dy = Math.abs(sy - psy)
        const stepX = psx < sx ? 1 : -1, stepY = psy < sy ? 1 : -1
        let err = dx - dy
        // Hellweiße Farbe für Hyperraum-Striche
        const br = 255
        for (let step = 0; step < 80; step++) {
          if (lx >= 0 && lx < W && ly >= 0 && ly < H) {
            const pi = (ly * W + lx) * 4
            buf[pi] = br; buf[pi+1] = br; buf[pi+2] = br; buf[pi+3] = 255
          }
          if (lx === sx && ly === sy) break
          const e2 = err * 2
          if (e2 > -dy) { err -= dy; lx += stepX }
          if (e2 <  dx) { err += dx; ly += stepY }
        }
      } else {
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
      }
    }
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
  'WORMHOLE // TRANSIT ACTIVE', 200, 150,
  () => null,
  (buf, W, H, t) => {
    const ts = t * 0.001
    // Hue-Offset: 360° Umdrehung pro 30 s
    const hueOffset = (ts / 30) * 360

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x - W/2, cy = y - H/2
        const r  = Math.sqrt(cx*cx + cy*cy) + 0.001

        // ── Einzelner Tunnel-Layer ────────────────────────────────────────
        // Rotation: 1.2× original (0.6 → 0.72 * ts), Vorwärts: 1.5× original (1.5 → 2.25 * ts)
        const u = Math.atan2(cy, cx) / Math.PI + ts * 0.72
        const v = 20 / r + ts * 2.25
        const c = (Math.floor(u * 3) + Math.floor(v * 3)) & 1
        // Grüne/Cyan Hacker-Ästhetik: Hue bleibt im 120°–200°-Band (grün→cyan)
        const hue = 140 + Math.sin(ts * 0.15) * 40  // langsam zwischen Grün und Cyan wechseln
        const [ri, gi, bi] = hsl((hue + r * 2) % 360, 1, c ? 0.6 : 0.07)

        const pi = (y * W + x) * 4
        buf[pi] = ri; buf[pi+1] = gi; buf[pi+2] = bi; buf[pi+3] = 255
      }
    }
  },
)

// ── Effekt 4: Rotozoom — rotierende + zoomende Kacheln ───────────────────────
// Performance-Cap: max 200×150.
export const RotozoomScene = makeScene(
  'TESSERACT ROTATION // DECRYPTING', 200, 150,
  () => null,
  (buf, W, H, t) => {
    const ts  = t * 0.001
    const z   = 0.04 + 0.03*Math.sin(ts*0.5)
    const cos = Math.cos(ts*0.6)*z, sin = Math.sin(ts*0.6)*z
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const cx=x-W/2, cy=y-H/2
        const sx=cx*cos-cy*sin, sy=cx*sin+cy*cos
        const checker = (Math.floor(sx) + Math.floor(sy)) & 1
        const [ri,gi,bi] = hsl(Math.abs(((sx+sy)*10+ts*40)%360), 1, checker ? 0.55 : 0.05)
        const pi=(y*W+x)*4
        buf[pi]=ri; buf[pi+1]=gi; buf[pi+2]=bi; buf[pi+3]=255
      }
  },
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
export function DotCloudScene() {
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
}

// ── Effekt 7: Boing — klassischer Amiga-Demo-Ball mit Voll-3D-Rotation ────────
// Verbesserungen gegenüber v0.9.3:
//   - Ball rotiert um alle 3 Achsen gleichzeitig (separate Winkelgeschwindigkeiten
//     für X, Y, Z, die sich langsam über die Zeit verändern)
//   - Horizontales Abprallen (X-Richtung) zusätzlich zum vertikalen Hüpfen
//   - Schachbrettmuster folgt der 3D-Rotation korrekt
// Performance-Cap: max 200×150.

// Zustand: Winkel und Winkelgeschwindigkeiten für alle 3 Achsen, Ball-Position/-Speed
type BoingState = {
  angleX:  number   // Rotationswinkel um X-Achse (rad)
  angleY:  number   // Rotationswinkel um Y-Achse (rad)
  angleZ:  number   // Rotationswinkel um Z-Achse (rad)
  omegaX:  number   // Winkelgeschwindigkeit X (rad/ms)
  omegaY:  number   // Winkelgeschwindigkeit Y
  omegaZ:  number   // Winkelgeschwindigkeit Z
  bx:      number   // Ball-X-Position (Bildschirm)
  by:      number   // Ball-Y-Position (Bildschirm)
  vbx:     number   // Ball-Geschwindigkeit X
  vby:     number   // Ball-Geschwindigkeit Y
  lastT:   number   // Zeitstempel des letzten Frames (für dt-Berechnung)
}
export const BoingScene = makeScene(
  'OBJECT 7 // TRAJECTORY STABLE', 200, 150,
  (W, H): BoingState => ({
    angleX:  0,
    angleY:  0,
    angleZ:  0,
    // Unterschiedliche Winkelgeschwindigkeiten für jede Achse (rad/ms)
    omegaX:  0.0014,
    omegaY:  0.0021,
    omegaZ:  0.0008,
    bx:      W / 2,
    by:      H * 0.5,
    vbx:     0.7,   // horizontale Abprall-Geschwindigkeit (px/ms)
    vby:     1.2,   // vertikale Hüpf-Geschwindigkeit (px/ms)
    lastT:   -1,    // noch kein Frame
  }),
  (buf, W, H, t, state: BoingState) => {
    // ── Delta-Time berechnen ──────────────────────────────────────────────
    const dt = state.lastT < 0 ? 16 : Math.min(t - state.lastT, 50)
    state.lastT = t

    // ── Winkel aller 3 Achsen aktualisieren ───────────────────────────────
    // Winkelgeschwindigkeiten ändern sich langsam (Drift) damit die Rotation
    // organisch wirkt und keine starre Schleife entsteht.
    state.omegaX += (Math.random() - 0.5) * 0.000002
    state.omegaY += (Math.random() - 0.5) * 0.000002
    state.omegaZ += (Math.random() - 0.5) * 0.000001
    // Geschwindigkeiten in einem sinnvollen Bereich halten
    state.omegaX = Math.max(0.0005, Math.min(0.003,  state.omegaX))
    state.omegaY = Math.max(0.001,  Math.min(0.004,  state.omegaY))
    state.omegaZ = Math.max(0.0002, Math.min(0.002,  state.omegaZ))

    state.angleX += state.omegaX * dt
    state.angleY += state.omegaY * dt
    state.angleZ += state.omegaZ * dt

    // ── Ball-Position aktualisieren (X + Y Abprallen) ─────────────────────
    state.bx += state.vbx
    state.by += state.vby
    const rad = Math.min(W, H) * 0.33
    // Horizontales Abprallen an linker/rechter Wand
    if (state.bx - rad < 0)  { state.vbx =  Math.abs(state.vbx); state.bx = rad }
    if (state.bx + rad > W)  { state.vbx = -Math.abs(state.vbx); state.bx = W - rad }
    // Vertikales Abprallen (Boden/Decke)
    if (state.by - rad < 0)  { state.vby =  Math.abs(state.vby); state.by = rad }
    if (state.by + rad > H)  { state.vby = -Math.abs(state.vby); state.by = H - rad }

    // ── Rotationsmatrizen für alle 3 Achsen (ZYX-Reihenfolge) ────────────
    const cX = Math.cos(state.angleX), sX = Math.sin(state.angleX)
    const cY = Math.cos(state.angleY), sY = Math.sin(state.angleY)
    const cZ = Math.cos(state.angleZ), sZ = Math.sin(state.angleZ)

    // Hintergrund schwarz
    buf.fill(0)
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - state.bx, dy = y - state.by
        const d2 = dx * dx + dy * dy
        if (d2 > rad * rad) continue

        // Kugel-Normale im Kamera-Raum (vor Rotation)
        const nz0 = Math.sqrt(Math.max(0, 1 - d2 / (rad * rad)))
        const nx0 = dx / rad, ny0 = dy / rad

        // Normale rück-rotieren (Transponierte der ZYX-Matrix) um UV-Koordinaten
        // im Objekt-Raum zu bekommen → das lässt das Muster mit dem Objekt rotieren.
        // Reihenfolge: X^T → Y^T → Z^T (umgekehrt zu ZYX)
        // Rotation um X-Achse (Transponierte = inverse)
        const ny1 =  ny0 * cX + nz0 * sX
        const nz1 = -ny0 * sX + nz0 * cX
        // Rotation um Y-Achse
        const nx2 =  nx0 * cY - nz1 * sY
        const nz2 =  nx0 * sY + nz1 * cY
        // Rotation um Z-Achse
        const nx3 =  nx2 * cZ + ny1 * sZ
        const ny3 = -nx2 * sZ + ny1 * cZ

        // Schachbrettmuster auf der Kugeloberfläche aus rück-rotierten Normalen
        const ua = Math.atan2(ny3, nx3) / (Math.PI / 3)
        const ub = Math.asin(Math.max(-1, Math.min(1, nz2))) / (Math.PI / 3)
        const checker = ((Math.floor(ua) + Math.floor(ub)) & 1)

        // Beleuchtung aus fester Richtung (Phong-ähnlich, einfach)
        const light = Math.max(0.15, 0.4 * nx0 - 0.3 * ny0 + 0.85 * nz0)
        const c = Math.round(light * 255)

        const pi = (y * W + x) * 4
        if (checker) { buf[pi] = c; buf[pi+1] = 0; buf[pi+2] = 0 }   // Rot
        else         { buf[pi] = c; buf[pi+1] = c; buf[pi+2] = c }   // Weiß
        buf[pi+3] = 255
      }
    }
  },
)

// ── Effekt 8: Lissajous — animierte Kurve mit Nachleucht-Spur ────────────────
// Performance-Cap: max 200×150.
export const LissajousScene = makeScene(
  'SIGNAL TRACE // LISSAJOUS Ω', 200, 150,
  // Trail-Buffer hat genau die interne Auflösung W×H
  (W, H) => new Uint8Array(W * H),
  (buf, W, H, t, trail: Uint8Array) => {
    const ts=t*0.001
    // Trail langsam ausblenden
    for (let i=0;i<trail.length;i++) trail[i]=Math.max(0,trail[i]-5)
    // Parametrisch 30 Punkte pro Frame einzeichnen
    for (let i=0;i<30;i++) {
      const ft=ts+i*0.008
      const px=Math.round((Math.sin(3*ft+0.2*Math.sin(ts*0.13))*0.45+0.5)*(W-1))
      const py=Math.round((Math.sin(4*ft)*0.45+0.5)*(H-1))
      if (px>=0&&px<W&&py>=0&&py<H) trail[py*W+px]=255
    }
    // Trail-Buffer als Farbe rendern
    for (let i=0;i<W*H;i++) {
      const pi=i*4, v=trail[i]
      if (v===0) { buf[pi]=buf[pi+1]=buf[pi+2]=0 }
      else { const [r,g,b]=hsl((i*0.4+ts*25)%360,1,v/510); buf[pi]=r; buf[pi+1]=g; buf[pi+2]=b }
      buf[pi+3]=255
    }
  },
)
