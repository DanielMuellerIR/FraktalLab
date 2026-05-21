import React, { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Neon-Grid-Renderer (eigenständige Komponente, kein Voxel-Engine) ───────────
// Zeichnet ein flaches TRON-artiges Perspektiv-Gitter, das sich vorwärts bewegt.
// Kamera fliegt in Z-Richtung, Grid-Linien werden per Perspektiv-Projektion gemalt.
// Magenta-Türme erscheinen zufällig entlang der Grid-Linien.

// Struktur eines Turms (Welt-Koordinaten)
interface Tower {
  gx: number   // Grid-Spalte (ganzzahlig)
  gz: number   // Grid-Reihe (ganzzahlig)
  height: number // Höhe in Welt-Einheiten
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
    // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    // Canvas-Größe dem Container anpassen
    const resize = () => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Kamera-Z wächst über die Zeit (Vorwärtsflug)
    let cameraZ = 0

    // Türme: pro Frame werden Türme, die hinter der Kamera liegen, ersetzt
    const GRID_SPACING = 32     // Welt-Einheiten zwischen Grid-Linien
    const MAJOR_EVERY  = 5      // Jede 5. Linie ist eine Haupt-Linie
    const NUM_TOWERS   = 18     // Maximale Anzahl gleichzeitiger Türme
    const VIEW_DEPTH   = 600    // Welt-Tiefe, die gerendert wird
    const TOWER_SPREAD = 10     // Türme verteilen sich über ±TOWER_SPREAD Grid-Spalten

    // Alle Türme zufällig initialisieren (verteilt über die Tiefe)
    const towers: Tower[] = Array.from({ length: NUM_TOWERS }, () => ({
      gx:     Math.round((Math.random() * 2 - 1) * TOWER_SPREAD),
      gz:     Math.floor(Math.random() * (VIEW_DEPTH / GRID_SPACING)),
      height: 20 + Math.random() * 120,
    }))

    // Perspektiv-Hilfsfunktion: Welt-Koordinate → Screen-X
    // Kamera ist bei X=0, Y=camEye (über dem Grid), fährt in Z-Richtung.
    function project(wx: number, wz: number, W: number, H: number): { sx: number; sy: number; scale: number } | null {
      const camEye = 40           // Augenhöhe über dem Grid (Y-Achse)
      const focalLength = H * 0.9 // Perspektiv-Stärke

      const relZ = wz - cameraZ
      if (relZ <= 1) return null  // Hinter oder genau bei der Kamera

      // Perspektiv-Division: weiter weg = kleiner
      const scale  = focalLength / relZ
      const sx     = W / 2 + wx * scale
      // Horizont liegt bei sy = H * 0.45 (leicht über Mitte)
      // Grid-Boden bei camEye über Grid (wY=0), also Offset = camEye * scale
      const sy     = H * 0.45 + camEye * scale
      return { sx, sy, scale }
    }

    function loop(_t: number) {
      if (!running) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      const W = canvas!.width
      const H = canvas!.height
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }

      // Kamera bewegt sich vorwärts
      cameraZ += 0.25

      // Türme, die mehr als VIEW_DEPTH hinter der Kamera liegen, neu platzieren
      const frontZ = Math.floor((cameraZ + VIEW_DEPTH) / GRID_SPACING)
      for (const tower of towers) {
        if (tower.gz < Math.floor(cameraZ / GRID_SPACING) - 1) {
          tower.gz     = frontZ + Math.floor(Math.random() * 4)
          tower.gx     = Math.round((Math.random() * 2 - 1) * TOWER_SPREAD)
          tower.height = 20 + Math.random() * 120
        }
      }

      // ── Hintergrund: fast schwarz mit leichtem blauen Schimmer ──────────
      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, W, H)

      // ── Horizont-Glow ───────────────────────────────────────────────────
      const horizonY = H * 0.45
      const grd = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 30)
      grd.addColorStop(0, 'rgba(0,255,255,0)')
      grd.addColorStop(0.5, 'rgba(0,255,255,0.08)')
      grd.addColorStop(1, 'rgba(0,255,255,0)')
      ctx.fillStyle = grd
      ctx.fillRect(0, horizonY - 30, W, 60)

      // ── Grid-Linien zeichnen ─────────────────────────────────────────────
      // Z-Linien (laufen horizontal im Bild = von links nach rechts im Welt-Raum)
      // Wir zeichnen Z-Ebenen (Tiefe) und X-Linien (quer) getrennt.

      // Tiefe der vordersten und hintersten sichtbaren Gitterzeile
      const zFirst = Math.ceil(cameraZ / GRID_SPACING) * GRID_SPACING
      const zLast  = zFirst + VIEW_DEPTH

      // Laterale Ausdehnung des Grids: so weit, dass die Ränder immer außerhalb liegen
      const xMin = -TOWER_SPREAD * GRID_SPACING * 2
      const xMax =  TOWER_SPREAD * GRID_SPACING * 2

      // ── Z-Ebenen (horizontale Linien im Bild, laufen von links nach rechts) ──
      for (let iz = zFirst; iz <= zLast; iz += GRID_SPACING) {
        const pLeft  = project(xMin, iz, W, H)
        const pRight = project(xMax, iz, W, H)
        if (!pLeft || !pRight) continue

        const isMajor = Math.round(iz / GRID_SPACING) % MAJOR_EVERY === 0
        // Fog: Linien in der Ferne werden blasser
        const fog = Math.max(0, 1 - (iz - cameraZ) / VIEW_DEPTH)
        const alpha = fog * (isMajor ? 0.9 : 0.45)

        ctx.beginPath()
        ctx.moveTo(pLeft.sx, pLeft.sy)
        ctx.lineTo(pRight.sx, pRight.sy)
        ctx.strokeStyle = `rgba(0,255,255,${alpha.toFixed(3)})`
        ctx.lineWidth   = isMajor ? 1.5 : 0.7
        ctx.stroke()
      }

      // ── X-Linien (vertikale Linien im Bild, laufen von vorne nach hinten) ──
      // Wir projizieren den vorderen und hinteren Endpunkt jeder X-Linie
      const xLineCount = Math.round((xMax - xMin) / GRID_SPACING)
      for (let xi = 0; xi <= xLineCount; xi++) {
        const wx = xMin + xi * GRID_SPACING
        const pFront = project(wx, cameraZ + GRID_SPACING, W, H)
        const pBack  = project(wx, zLast, W, H)
        if (!pFront || !pBack) continue

        const isMajor = xi % MAJOR_EVERY === 0
        // Fade basierend auf seitlicher Entfernung (X-Linien am Rand blasser)
        const lateralFog = Math.max(0, 1 - Math.abs(wx) / (TOWER_SPREAD * GRID_SPACING))
        const alpha = lateralFog * (isMajor ? 0.85 : 0.38)

        ctx.beginPath()
        ctx.moveTo(pFront.sx, pFront.sy)
        ctx.lineTo(pBack.sx, pBack.sy)
        ctx.strokeStyle = `rgba(0,255,255,${alpha.toFixed(3)})`
        ctx.lineWidth   = isMajor ? 1.4 : 0.65
        ctx.stroke()
      }

      // ── Türme zeichnen ───────────────────────────────────────────────────
      // Türme sind einfache Rechtecke, von der Basis (Grid) nach oben.
      // Türme weiter hinten werden zuerst gezeichnet (Maler-Algorithmus).
      const sortedTowers = [...towers].sort((a, b) => b.gz * GRID_SPACING - a.gz * GRID_SPACING)
      for (const tower of sortedTowers) {
        const wx = tower.gx * GRID_SPACING
        const wz = tower.gz * GRID_SPACING

        // Basis-Punkt des Turms
        const base = project(wx, wz, W, H)
        if (!base) continue

        // Wir simulieren Turm-Breite und -Höhe im Perspektiv-Raum
        const towerWorldWidth = GRID_SPACING * 0.4
        const leftBase  = project(wx - towerWorldWidth / 2, wz, W, H)
        const rightBase = project(wx + towerWorldWidth / 2, wz, W, H)
        if (!leftBase || !rightBase) continue

        const screenWidth  = Math.max(2, rightBase.sx - leftBase.sx)
        const screenHeight = Math.max(2, tower.height * base.scale)
        const screenX      = leftBase.sx
        const screenY      = base.sy - screenHeight

        // Fog-Transparenz für den Turm
        const fog = Math.max(0, 1 - (wz - cameraZ) / VIEW_DEPTH)
        if (fog <= 0) continue

        // Magenta-Farbe mit Fog
        const alpha = fog * 0.85
        ctx.fillStyle = `rgba(255,0,255,${alpha.toFixed(3)})`
        ctx.fillRect(screenX, screenY, screenWidth, screenHeight)

        // Leuchtende Kante oben (hellerer Streifen)
        ctx.fillStyle = `rgba(255,128,255,${(fog * 0.7).toFixed(3)})`
        ctx.fillRect(screenX, screenY, screenWidth, Math.max(1, screenHeight * 0.06))
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
const HMAP = 512   // Muss eine 2er-Potenz sein, damit Bit-Masking funktioniert

// Erzeugt ein Heightmap-Array aus mehreren Sinus-Oktaven (einmalig beim Modullade)
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

// ── Voxel-Space-Render-Fabrik ─────────────────────────────────────────────────
// Jede Szene hat ihre eigene Heightmap und Farbfunktion.
// Die interne Render-Auflösung wird durch ResizeObserver dynamisch ermittelt
// und per Performance-Cap (maxW × maxH) begrenzt.
// Das Bild wird per drawImage auf die volle Canvas-Größe gestreckt.
//
// colorFn(th, fog): th = Terrain-Höhe 0..255, fog = Tiefe 0..1 → [R, G, B]
// postFn(ctx, cW, cH): optionale Overlay-Funktion, die nach dem Blit auf den
//   Haupt-Canvas aufgerufen wird (z.B. für HUD-Labels).
// lateralDrift: wenn true, bewegt sich die Kamera seitwärts statt vorwärts.
//   Die Kamera dreht sich kontinuierlich um 90° versetzt zur Fahrtrichtung,
//   sodass das Terrain seitlich durchs Bild zieht — typisch für Luftüberwachung.
function makeVoxelScene(
  title: string,
  maxW: number, maxH: number,   // Performance-Cap für interne Auflösung
  heightmap: Uint8Array,
  colorFn: (th: number, fog: number) => [number, number, number],
  camCfg: {
    vx: number; vy: number; va: number
    speedMin?: number; speedMax?: number; impulseScale?: number
    // lateralDrift: Kamera driftet seitwärts (90° zur Blickrichtung)
    lateralDrift?: boolean
  },
  opts: {
    horizon?: number; scale?: number; fov?: number; far?: number
    camHBase?: number; camHAmp?: number; camHFloor?: number
    // scanlines: true → alter Modus (jede 2. Zeile aufhellen)
    // 'phosphor' → CRT-Scanlines alle 3px schwarz bei 12% Opazität + Phosphor-Bloom
    scanlines?: boolean | 'phosphor'
    // postFn: optionaler Canvas-2D-Overlay nach dem Hochskalierungs-Blit
    postFn?: (ctx: CanvasRenderingContext2D, cW: number, cH: number) => void
    // brightBoost: Faktor > 1 — Pixel oberhalb eines Schwellwerts werden aufgehellt
    // (simuliert glühende Lava-Kanäle). brightThreshold: 0..255, Default 178 (≈70%).
    brightBoost?: number
    brightThreshold?: number
  } = {}
): () => React.JSX.Element {
  const {
    scale           = 120,
    fov             = 1.2,
    far             = 150,
    camHBase        = 110,
    camHAmp         = 30,
    camHFloor       = 70,
    scanlines       = true,
    postFn,
    brightBoost,
    brightThreshold = 178,
  } = opts

  return function VoxelScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cam = useRef({
      x: 150 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      vx: camCfg.vx * (0.8 + Math.random() * 0.4),
      vy: camCfg.vy * (0.8 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      va: camCfg.va,
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
      const speedMin     = camCfg.speedMin     ?? 0.8
      const speedMax     = camCfg.speedMax     ?? 5
      const impulseScale = camCfg.impulseScale ?? 3

      // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
      let isVisible = true
      const io = new IntersectionObserver(
        ([entry]) => { isVisible = entry.isIntersecting },
        { threshold: 0.1 },
      )
      io.observe(canvas)

      // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────
      const resize = () => {
        canvas.width  = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(canvas)

      // Wiederverwendbares OffscreenCanvas für die interne Niedrig-Auflösung
      const offscreen = document.createElement('canvas')

      function loop(t: number) {
        if (!running) return
        // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
        if (!isVisible) { rafId = requestAnimationFrame(loop); return }

        // Sicherheitscheck: Canvas muss eine Größe haben
        if (canvas!.width === 0 || canvas!.height === 0) {
          rafId = requestAnimationFrame(loop)
          return
        }

        const dt = Math.min(t - lastT, 50)
        lastT = t
        const c = cam.current

        // Interne Auflösung: proportional zur Canvas-Größe, aber max maxW × maxH
        const scaleW = Math.min(1, maxW / Math.max(canvas!.width,  1))
        const scaleH = Math.min(1, maxH / Math.max(canvas!.height, 1))
        const internalScale = Math.min(scaleW, scaleH)
        const W = Math.max(1, Math.round(canvas!.width  * internalScale))
        const H = Math.max(1, Math.round(canvas!.height * internalScale))

        // OffscreenCanvas auf interne Auflösung setzen (nur wenn nötig)
        if (offscreen.width !== W || offscreen.height !== H) {
          offscreen.width  = W
          offscreen.height = H
        }
        const offCtx = offscreen.getContext('2d')!

        // ImageData pro Frame neu anlegen (Größe kann sich geändert haben)
        const img = offCtx.createImageData(W, H)
        const buf = img.data

        // Horizon dynamisch aus H berechnen (opts.horizon ignoriert für dynamischen H)
        const horizon = H * 0.42

        // Zufälliger Geschwindigkeits-Impuls alle 2.5–4.5 Sekunden
        if (t - c.lastImpulse > 2500 + Math.random() * 2000) {
          if (camCfg.lateralDrift) {
            // Lateraler Drift: Impuls nur senkrecht zur aktuellen Blickrichtung,
            // damit die Kamera das Terrain seitlich abtastet statt vorwärts zu fliegen.
            // Seitwärtsrichtung = Blickwinkel + 90°
            const perpAngle = c.angle + Math.PI / 2
            const impMag = speedMin + Math.random() * (speedMax - speedMin) * 0.6
            c.vx = Math.cos(perpAngle) * impMag
            c.vy = Math.sin(perpAngle) * impMag
          } else {
            c.vx += (Math.random() - 0.5) * impulseScale
            c.vy += (Math.random() - 0.5) * impulseScale
          }
          c.va += (Math.random() - 0.5) * 0.005
          c.lastImpulse = t
        }

        // Exponentielles Dämpfen
        c.vx *= 0.992
        c.vy *= 0.992
        c.va *= 0.995

        // Mindest- und Höchstgeschwindigkeit erzwingen
        const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy)
        if (speed < speedMin) { c.vx += (Math.random()-0.5)*1.5; c.vy += (Math.random()-0.5)*1.5 }
        if (speed > speedMax) { c.vx *= speedMax/speed; c.vy *= speedMax/speed }

        // Position aktualisieren — Terrain wrapp nahtlos durch Bit-Maske
        c.x = ((c.x + c.vx * dt/16) % HMAP + HMAP) % HMAP
        c.y = ((c.y + c.vy * dt/16) % HMAP + HMAP) % HMAP
        c.angle += c.va * dt/16

        // Terrain-Höhe unter der Kamera samplen → Kamera mindestens camHFloor Einheiten über Boden
        const tx = Math.floor(c.x) & (HMAP - 1)
        const ty = Math.floor(c.y) & (HMAP - 1)
        const terrainAtCam = heightmap[ty * HMAP + tx]
        const camH = Math.max(terrainAtCam + camHFloor, camHBase + camHAmp * Math.sin(t * 0.0004))

        // Himmel: fast schwarz mit leichtem Gradient nach oben
        for (let y = 0; y < H; y++) {
          const sk = Math.max(0, 18 - y * 0.3)
          for (let x = 0; x < W; x++) {
            const pi = (y * W + x) * 4
            buf[pi] = sk; buf[pi+1] = sk; buf[pi+2] = sk; buf[pi+3] = 255
          }
        }

        // Raycasting: pro Spalte einen Strahl werfen und Terrain-Silhouette projizieren
        for (let x = 0; x < W; x++) {
          const rayAngle = c.angle - fov/2 + (x/W) * fov
          const rdx = Math.cos(rayAngle)
          const rdy = Math.sin(rayAngle)
          let maxY = H

          for (let z = 1; z <= far; z++) {
            const wx = (c.x + rdx * z) & (HMAP - 1)
            const wy = (c.y + rdy * z) & (HMAP - 1)
            const th = heightmap[Math.floor(wy) * HMAP + Math.floor(wx)]

            const projY = Math.floor((camH - th) / z * scale + horizon)
            if (projY >= maxY) continue

            const fog = z / far
            const [cr, cg, cb] = colorFn(th, fog)

            const yStart = Math.max(0, projY)
            const yEnd   = Math.min(H, maxY)
            for (let y = yStart; y < yEnd; y++) {
              const pi = (y * W + x) * 4
              buf[pi] = cr; buf[pi+1] = cg; buf[pi+2] = cb; buf[pi+3] = 255
            }
            maxY = projY
            if (maxY <= 0) break
          }
        }

        // Optionaler Helligkeit-Boost für helle Pixel (z.B. glühende Lava-Kanäle).
        // Pixel deren Luminanz oberhalb des Schwellwerts liegt, werden um den
        // Faktor brightBoost aufgehellt (Clamp auf 255).
        if (brightBoost !== undefined) {
          for (let i = 0; i < buf.length; i += 4) {
            // Einfache Luminanz-Näherung: maximaler Kanalwert
            const lum = Math.max(buf[i], buf[i+1], buf[i+2])
            if (lum > brightThreshold) {
              buf[i]   = Math.min(255, Math.round(buf[i]   * brightBoost))
              buf[i+1] = Math.min(255, Math.round(buf[i+1] * brightBoost))
              buf[i+2] = Math.min(255, Math.round(buf[i+2] * brightBoost))
            }
          }
        }

        // CRT-Scanline-Overlay (alter Modus): jede zweite Zeile leicht aufhellen
        if (scanlines === true) {
          for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x++) {
              const pi = (y * W + x) * 4
              buf[pi]   = Math.min(255, buf[pi]   + 8)
              buf[pi+1] = Math.min(255, buf[pi+1] + 8)
              buf[pi+2] = Math.min(255, buf[pi+2] + 8)
            }
          }
        }

        // Interne Pixel in OffscreenCanvas schreiben, dann auf volle Größe hochskalieren
        offCtx.putImageData(img, 0, 0)
        ctx.drawImage(offscreen, 0, 0, canvas!.width, canvas!.height)

        // ── Phosphor-Bloom + CRT-Scanlines (Post-Processing auf Haupt-Canvas) ──
        // Wird nach dem Hochskalierungs-Blit auf ctx angewendet, damit der Effekt
        // auf voller Display-Auflösung sichtbar ist (nicht auf der Niedrig-Auflösung).
        if (scanlines === 'phosphor') {
          const cW = canvas!.width
          const cH = canvas!.height

          // Bloom: dasselbe Bild nochmal mit 8% Opazität um ±1px versetzt einzeichnen.
          // Vier diagonale Versätze simulieren das Ausleuchten eines Phosphor-Dots.
          ctx.globalAlpha = 0.08
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(offscreen, -1, -1, cW, cH)
          ctx.drawImage(offscreen,  1, -1, cW, cH)
          ctx.drawImage(offscreen, -1,  1, cW, cH)
          ctx.drawImage(offscreen,  1,  1, cW, cH)
          // Zurück zu Normalzustand
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'

          // CRT-Scanlines: schwarze horizontale Linie alle 3 Pixel, 12% Opazität.
          // fillRect pro Zeile ist auf modernen Browsern optimiert genug.
          ctx.fillStyle = 'rgba(0,0,0,0.12)'
          for (let sy = 0; sy < cH; sy += 3) {
            ctx.fillRect(0, sy, cW, 1)
          }
        }

        // Optionaler Canvas-Overlay (z.B. HUD-Labels, Gitternetz)
        if (postFn) {
          postFn(ctx, canvas!.width, canvas!.height)
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

// ── Terrain-Heightmaps (einmalig beim Modullade berechnet) ────────────────────

// Sanfte Hügel für Thermal-Scanner
const hmSmooth = buildHeightmap([
  { sx: 0.012, sy: 0.009, amp: 60 },
  { sx: 0.031, sy: 0.025, amp: 30, px: 1.5, py: 0.7 },
  { sx: 0.071, sy: 0.058, amp: 15, px: 2.8, py: 1.9 },
])


// ── Variante: THERMAL SCAN ────────────────────────────────────────────────────
// Klassische Infrarot/Wärmebildkamera-Palette (8–14 μm Band):
//   schwarz → lila → blau → cyan → grün → gelb → orange → rot → weiß
// Kamera driftet lateral (seitwärts) wie bei einer Luftaufklärungsdrohne.
// Performance-Cap: max 320×200.
export const VoxelThermal = makeVoxelScene(
  'THERMAL SCAN // IR SPECTRUM',
  320, 200,
  hmSmooth,
  (th, fog) => {
    // 8-stufige Rampe: bildet th (0..255) auf die klassische Wärmebild-Palette ab.
    // Jede Stufe deckt 1/8 des Wertebereichs ab (≈32 Einheiten).
    const t = th / 255          // normiert 0..1
    const f = 1 - fog * 0.55   // Tiefennebel (weniger aggressiv als bei Lava)
    let r: number, g: number, b: number

    if (t < 0.125) {
      // Stufe 0: schwarz → dunkel-lila
      const p = t / 0.125
      r = Math.round(p * 60); g = 0; b = Math.round(p * 80)
    } else if (t < 0.25) {
      // Stufe 1: dunkel-lila → blau
      const p = (t - 0.125) / 0.125
      r = Math.round(60 - p * 60); g = 0; b = Math.round(80 + p * 175)
    } else if (t < 0.375) {
      // Stufe 2: blau → cyan
      const p = (t - 0.25) / 0.125
      r = 0; g = Math.round(p * 255); b = 255
    } else if (t < 0.5) {
      // Stufe 3: cyan → grün
      const p = (t - 0.375) / 0.125
      r = 0; g = 255; b = Math.round(255 - p * 255)
    } else if (t < 0.625) {
      // Stufe 4: grün → gelb
      const p = (t - 0.5) / 0.125
      r = Math.round(p * 255); g = 255; b = 0
    } else if (t < 0.75) {
      // Stufe 5: gelb → orange
      const p = (t - 0.625) / 0.125
      r = 255; g = Math.round(255 - p * 128); b = 0
    } else if (t < 0.875) {
      // Stufe 6: orange → rot
      const p = (t - 0.75) / 0.125
      r = 255; g = Math.round(127 - p * 127); b = 0
    } else {
      // Stufe 7: rot → weiß (Hotspots)
      const p = (t - 0.875) / 0.125
      r = 255; g = Math.round(p * 255); b = Math.round(p * 255)
    }

    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  // Lateraler Drift: Kamera schaut geradeaus, bewegt sich aber seitwärts
  { vx: 1.0, vy: 0.4, va: 0.0008, speedMin: 0.6, speedMax: 3.0, lateralDrift: true },
  {
    camHBase: 110, camHAmp: 15, camHFloor: 65,
    // HUD-Label in der rechten oberen Ecke: Bandbezeichnung + Fake-Temperaturbereich
    postFn: (ctx, cW, _cH) => {
      // Kleines HUD-Panel oben rechts
      const pad = 6
      const lineH = 13
      const lines = ['IR: 8-14μm BAND', 'TEMP: -20..+60°C', 'RES: 320×200 px']
      ctx.font = `bold ${lineH - 1}px monospace`
      // Hintergrund-Box
      const boxW = 148
      const boxH = lines.length * lineH + pad * 2
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(cW - boxW - pad, pad, boxW, boxH)
      // Text
      ctx.fillStyle = '#00ff00'
      lines.forEach((line, i) => {
        ctx.fillText(line, cW - boxW - pad + 5, pad + lineH * (i + 1))
      })
      // Blinkender roter "REC"-Punkt oben links
      const now = Date.now()
      if (Math.floor(now / 700) % 2 === 0) {
        ctx.beginPath()
        ctx.arc(pad + 8, pad + 8, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ff2200'
        ctx.fill()
        ctx.font = 'bold 10px monospace'
        ctx.fillStyle = '#ff2200'
        ctx.fillText('REC', pad + 17, pad + 12)
      }
    },
  },
)

// Lava: chaotisch-vulkanisches Terrain mit erhöhter Hochfrequenz-Oktave.
// Zwei Oktaven auf 2× Frequenz mit 0.5× Amplitude erzeugen scharfe Grate,
// die den Charakter echter Lavafelsen haben.
const hmLava = buildHeightmap([
  { sx: 0.008, sy: 0.006, amp: 28 },                    // Basis-Wellen (lang)
  { sx: 0.022, sy: 0.017, amp: 52, px: 2.3, py: 1.1 }, // Mittlere Hügel
  { sx: 0.053, sy: 0.041, amp: 22, px: 0.9, py: 3.2 }, // Kleinere Kuppen
  { sx: 0.11,  sy: 0.083, amp: 18, px: 1.5, py: 0.8 }, // Hochfrequenz-Oktave 1 (2× der orig.)
  { sx: 0.22,  sy: 0.166, amp: 9,  px: 3.1, py: 2.4 }, // Hochfrequenz-Oktave 2 (4×, 0.5× amp)
])

// Matrix: mittelgroße Hügel, ausgewogen für grünen Raster-Look
const hmMatrix = buildHeightmap([
  { sx: 0.019, sy: 0.015, amp: 38, px: 1.1, py: 2.4 },
  { sx: 0.041, sy: 0.033, amp: 32, px: 3.7, py: 0.9 },
  { sx: 0.093, sy: 0.076, amp: 28, px: 0.3, py: 1.8 },
  { sx: 0.17,  sy: 0.14,  amp: 18, px: 2.1, py: 3.5 },
])

// ── Variante: NEON GRID ───────────────────────────────────────────────────────
// Re-Export: VoxelNeon zeigt auf den neuen eigenständigen Flat-Grid-Renderer.
// (VoxelNeonGrid ist am Anfang dieser Datei definiert.)
export const VoxelNeon = VoxelNeonGrid

// ── Variante: LAVA FLOW ───────────────────────────────────────────────────────
// Vulkanische Lava-Ästhetik: sehr dunkle Basis (#0a0000, #1a0000) → tiefes Rot →
// Orange-Rot → helles Orange → Gelb-Weiß für Gipfel.
// Pixels oberhalb 70% Luminanz werden um Faktor 1.4 aufgehellt (Lava-Kanal-Glühen).
// Performance-Cap: max 320×200.
export const VoxelLava = makeVoxelScene(
  'LAVA FLOW // VOLCANIC HAZARD',
  320, 200,
  hmLava,
  (th, fog) => {
    // Palette: fast schwarz → dunkelrot → orange-rot → leuchtendes orange → gelb-weiß
    const t = th / 255
    const f = 1 - fog * 0.58   // Lava-Nebel: weniger Fog als normal, bleibt wärmer
    let r: number, g: number, b: number

    if (t < 0.18) {
      // Zone 0: fast schwarz (#0a0000 → #1a0000)
      const p = t / 0.18
      r = Math.round(10 + p * 16); g = 0; b = 0
    } else if (t < 0.38) {
      // Zone 1: sehr dunkles Rot (#1a0000 → #660000)
      const p = (t - 0.18) / 0.20
      r = Math.round(26 + p * 76); g = 0; b = 0
    } else if (t < 0.58) {
      // Zone 2: tiefes Rot → orange-rot (#660000 → #cc2200)
      const p = (t - 0.38) / 0.20
      r = Math.round(102 + p * 102); g = Math.round(p * 34); b = 0
    } else if (t < 0.78) {
      // Zone 3: orange-rot → leuchtendes orange (#cc2200 → #ff6600)
      const p = (t - 0.58) / 0.20
      r = Math.round(204 + p * 51); g = Math.round(34 + p * 68); b = 0
    } else {
      // Zone 4: leuchtendes orange → gelb-weiß (#ff6600 → #ffdd00 → weiß)
      const p = (t - 0.78) / 0.22
      r = 255
      g = Math.round(102 + p * 153)   // 102 → 255 (0x66 → 0xff)
      b = Math.round(p * 180)          // 0 → 180 (leicht weißlich für Peaks)
    }

    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  { vx: 1.4, vy: 1.0, va: 0.0018, speedMin: 0.9, speedMax: 4 },
  {
    camHBase: 95, camHAmp: 18, camHFloor: 52,
    // Lava-Kanal-Glühen: Pixel oberhalb 70% Luminanz werden um 40% aufgehellt.
    // Das simuliert den leuchtenden Kern aktiver Lava-Kanäle.
    brightBoost:     1.4,
    brightThreshold: 178,   // ≈ 70% von 255
  },
)

// ── Variante: PHOSPHOR TERRAIN ────────────────────────────────────────────────
// Echter Phosphor-Monitor-Look: nur Grün, vier Helligkeitsstufen.
// Palette: #005511 (dunkel) → #009922 → #00cc33 → #00ff41 (Gipfel).
// Post-Processing: Phosphor-Bloom (vier Kopien bei ±1px, 8% Opazität, lighter-Modus)
//                 + CRT-Scanlines alle 3px bei 12% Opazität schwarz.
// Performance-Cap: max 200×120.
export const VoxelMatrix = makeVoxelScene(
  'PHOSPHOR TERRAIN // GREEN SECTOR',
  200, 120,
  hmMatrix,
  (th, fog) => {
    // Vier Phosphor-Grün-Stufen (entsprechen #005511, #009922, #00cc33, #00ff41)
    // aufsteigend nach Terrain-Höhe, dann mit Fog abdimmen.
    const t = th / 255
    const f = Math.max(0, 1 - fog * 0.68)
    let r: number, g: number, b: number
    if (t < 0.25) {
      // #005511 — sehr dunkles Grün (tiefste Täler)
      r = 0x00; g = 0x55; b = 0x11
    } else if (t < 0.5) {
      // #009922 — mitteldunkles Grün
      r = 0x00; g = 0x99; b = 0x22
    } else if (t < 0.75) {
      // #00cc33 — mittelhelles Grün
      r = 0x00; g = 0xcc; b = 0x33
    } else {
      // #00ff41 — volles Phosphor-Grün (Gipfel)
      r = 0x00; g = 0xff; b = 0x41
    }
    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)]
  },
  { vx: 3.0, vy: 2.0, va: 0.004, speedMin: 2.0, speedMax: 9, impulseScale: 5 },
  { far: 120, camHBase: 82, camHAmp: 14, camHFloor: 38, scanlines: 'phosphor' },
)
