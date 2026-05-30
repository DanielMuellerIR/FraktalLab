import { useEffect, useRef, memo } from 'react'
import { subscribe } from '../utils/raf-coordinator'
import { acquireWebGLSlot, releaseWebGLSlot, updateWebGLSlotActivity } from '../utils/webgl-pool'
import { FRACTAL_VERTEX_SHADER, FRACTAL_FRAGMENT_SHADER } from '../utils/fractal-gl-shader'

/**
 * GPU-Fraktal-Renderer (ersetzt den WASM/Canvas-2D-Pfad — Audit-Befund B-4).
 *
 * Rendert Mandelbrot oder Julia im Fragment-Shader (double-single-Präzision für
 * Tief-Zoom, siehe utils/fractal-gl-shader.ts). Die Auto-Zoom-Navigation
 * (ins Detail zoomen statt in schwarze Innenflächen) bleibt erhalten: dafür wird
 * jeder paar Frames ein kleines Navigations-Bild in ein Offscreen-Framebuffer
 * gerendert und ausgelesen (billiger readPixels statt Vollbild).
 */

export interface FractalGLConfig {
  /** Mandelbrot (z₀=0, c=Pixel) oder Julia (z₀=Pixel, c=fest) */
  mode: 'mandelbrot' | 'julia'
  /** Interessante Zentren — werden zyklisch angezoomt (Mandelbrot) bzw. als
   *  Viewport-Mittelpunkt genutzt (Julia). */
  locations: { cx: number; cy: number }[]
  /** Fester Julia-Parameter c (nur bei mode==='julia', wenn kein juliaSet) */
  juliaC?: { cx: number; cy: number }
  /** Mehrere Julia-Parameter c, die zyklisch durchgewechselt werden (mit Crossfade).
   *  Optional mit Label für die HUD-Anzeige. */
  juliaSet?: { cx: number; cy: number; label?: string }[]
  /** Farb-Transform: 0 base, 1 mono, 2 cold, 3 hot, 4 neon, 5 invert */
  colorMode?: number
  /** Iterationstiefe (max. 256, vom Shader gedeckelt) */
  maxIter?: number
  /** Zoom-Schwelle, ab der (nach Mindest-Standzeit) zur nächsten Location gefadet wird */
  zoomMax?: number
  /** Zeigt ein kleines Zoom-/Label-HUD unten rechts an (wie der alte FractalJulia). */
  hud?: boolean
}

/** Zerlegt eine JS-Zahl (f64) in zwei float32 (hi + lo) für die double-single-Uniforms. */
function splitDouble(x: number): [number, number] {
  const hi = Math.fround(x)   // nächster float32
  const lo = x - hi           // Restbetrag, ebenfalls als float32 übergeben
  return [hi, lo]
}

// Größe des Navigations-Framebuffers (klein → billiger Readback für Boundary-/
// Schwarzraum-Erkennung; Anzeige läuft separat in voller Canvas-Auflösung).
const NAV_W = 128
const NAV_H = 96

// Maximaler Zoom, bei dem die double-single-Präzision auf ALLEN GPUs noch scharf
// bleibt. Hintergrund: Der ANGLE/Metal-Shader-Compiler (Apple-GPUs in Chrome)
// kontrahiert den Dekker-Split der ds-Multiplikation weg → effektiv nur float32-
// Präzision: ab ~5e5 feines Banding, ab ~5e6 grobe Blöcke (empirisch Apple Apple-Silicon-Hardware,
// Chrome/Metal). Auf Software-Rasterizer/anderen GPUs hält ds bis ~1e9, aber wir
// deckeln einheitlich auf den GPU-sicheren Wert. Darüber wird zur nächsten Location
// gecrossfadet (kein sichtbarer Präzisionsbruch mehr).
const SAFE_ZOOM_CEIL = 5e5

function FractalGL({ mode, locations, juliaC, juliaSet, colorMode = 0, maxIter = 128, zoomMax = 1.5e6, hud = false }: FractalGLConfig) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)

  // Eindeutige ID für den WebGL-Context-Pool
  const panelIdRef = useRef<string | null>(null)
  if (!panelIdRef.current) {
    panelIdRef.current = `fractal-gl-${Math.random().toString(36).slice(2, 11)}`
  }
  const panelId = panelIdRef.current

  // Animations-State im Ref (kein React-Re-Render pro Frame).
  // eslint-disable-next-line react-hooks/purity
  const stateRef = useRef({
    zoom:    mode === 'julia' ? 120 : 80 + Math.random() * 800,
    locIdx:  Math.floor(Math.random() * Math.max(1, locations.length)),
    centerX: 0,
    centerY: 0,
    angle:   0,
    driftAngle: Math.random() * Math.PI * 2,   // für Julia-Center-Drift
    initialized: false,
    locTime: 0,
    fading:  false,
    fade:    0,
    // Ziel-Location für den Crossfade
    nextLocIdx: 0,
    nextZoom:   80,
    nextCenterX: 0,
    nextCenterY: 0,
    // Julia-Parameter-Cycling (nur bei juliaSet)
    juliaIdx:     0,
    nextJuliaIdx: 0,
    // Auto-Zoom-Ziel (aus Boundary-Tracking)
    targetX: undefined as number | undefined,
    targetY: undefined as number | undefined,
    navFrame: 0,
  })

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let alive = true
    let isVisible = true
    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let unsubscribeRaf: (() => void) | null = null

    // Offscreen-Framebuffer + Textur für die Navigations-Readbacks
    let navFbo: WebGLFramebuffer | null = null
    let navTex: WebGLTexture | null = null
    const navPixels = new Uint8Array(NAV_W * NAV_H * 4)
    // Farb-Histogramm (5 Bit/Kanal = 32768 Buckets) für die Low-Detail-Erkennung.
    const navHist = new Uint16Array(32768)

    // Uniform-Locations (nach dem Linken einmalig geholt)
    const u: Record<string, WebGLUniformLocation | null> = {}

    // Zeitstempel des letzten Frames — für frame-raten-unabhängige Animation.
    // (Ohne dies würde die Animation auf einem 120-Hz-Display doppelt so schnell
    //  laufen wie auf 60 Hz und beim Zoom über die Präzisionsgrenze hinausschießen.)
    let lastT = 0

    function compile(src: string, type: number): WebGLShader | null {
      if (!gl) return null
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[FractalGL] Shader-Compile-Fehler:', gl.getShaderInfoLog(sh))
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    function initGL(): boolean {
      // preserveDrawingBuffer: true, damit der Canvas-Inhalt nach dem Frame
      // auslesbar bleibt (Visual-Test panel-check.spec.ts liest per readPixels;
      // ohne dies sieht der Test ein schwarzes Bild). Vgl. ShaderPanel.
      gl = (canvas!.getContext('webgl', { preserveDrawingBuffer: true }) ||
            canvas!.getContext('experimental-webgl')) as WebGLRenderingContext | null
      if (!gl) { console.error('[FractalGL] Kein WebGL-Context'); return false }

      const vs = compile(FRACTAL_VERTEX_SHADER, gl.VERTEX_SHADER)
      const fs = compile(FRACTAL_FRAGMENT_SHADER, gl.FRAGMENT_SHADER)
      if (!vs || !fs) return false

      program = gl.createProgram()
      if (!program) return false
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[FractalGL] Link-Fehler:', gl.getProgramInfoLog(program))
        return false
      }
      gl.useProgram(program)

      // Bildschirmfüllendes Rechteck (zwei Dreiecke)
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]), gl.STATIC_DRAW)
      const posLoc = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      // Uniform-Locations cachen
      for (const name of [
        'uResolution', 'uCenterHi', 'uCenterLo', 'uPixelScale', 'uAngle',
        'uMaxIter', 'uMode', 'uJuliaC', 'uJuliaC2', 'uColorMode', 'uFade',
        'uCenter2Hi', 'uCenter2Lo', 'uPixelScale2', 'uAngle2',
      ]) {
        u[name] = gl.getUniformLocation(program, name)
      }

      // Konstante Uniforms einmal setzen
      gl.uniform1i(u.uMode, mode === 'julia' ? 1 : 0)
      gl.uniform1i(u.uColorMode, colorMode)
      gl.uniform1i(u.uMaxIter, Math.min(256, maxIter))
      // Startwert für c: erstes juliaSet-Element bzw. fester juliaC
      const c0 = juliaSet?.[0] ?? juliaC ?? { cx: 0, cy: 0 }
      gl.uniform2f(u.uJuliaC, c0.cx, c0.cy)
      gl.uniform2f(u.uJuliaC2, c0.cx, c0.cy)

      // Navigations-Framebuffer aufsetzen
      navTex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, navTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NAV_W, NAV_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      navFbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, navFbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, navTex, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      return true
    }

    // Komplexe Einheiten pro Pixel — repliziert die Koordinaten-Mappings des
    // alten WASM-Renderers (Mandelbrot: 4/(zoom·größe); Julia: 1/zoom).
    function pixelScale(zoom: number, w: number, h: number): [number, number] {
      // Julia: auflösungsunabhängig + quadratische Pixel. Vertikale Spanne =
      // ~340/zoom (≈ alte Framing-Wirkung), x folgt per Seitenverhältnis.
      if (mode === 'julia') {
        const sc = 340 / (zoom * h)
        return [sc, sc]
      }
      // Mandelbrot wie alter WASM-Renderer (gestreckt auf ±2/zoom je Achse).
      return [4 / (zoom * w), 4 / (zoom * h)]
    }

    // Setzt die Viewport-Uniforms (Center/Scale/Angle) für das primäre Fraktal.
    function setViewportUniforms(w: number, h: number) {
      const s = stateRef.current
      const [hx, lx] = splitDouble(s.centerX)
      const [hy, ly] = splitDouble(s.centerY)
      gl!.uniform2f(u.uCenterHi, hx, hy)
      gl!.uniform2f(u.uCenterLo, lx, ly)
      const [sx, sy] = pixelScale(s.zoom, w, h)
      gl!.uniform2f(u.uPixelScale, sx, sy)
      gl!.uniform1f(u.uAngle, s.angle)
    }

    // Liest das kleine Nav-Bild aus und steuert Auto-Zoom + Schwarzraum-Fade.
    function navigate() {
      if (!gl || !navFbo) return
      const s = stateRef.current

      gl.bindFramebuffer(gl.FRAMEBUFFER, navFbo)
      gl.viewport(0, 0, NAV_W, NAV_H)
      // Nav-Bild nutzt dieselben Viewport-Uniforms, aber ohne Crossfade.
      gl.uniform2f(u.uResolution, NAV_W, NAV_H)
      gl.uniform1f(u.uFade, 0)
      setViewportUniforms(NAV_W, NAV_H)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      gl.readPixels(0, 0, NAV_W, NAV_H, gl.RGBA, gl.UNSIGNED_BYTE, navPixels)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      if (s.fading) return

      // Boundary-Tracking nur für Mandelbrot: ins farbige Detail nahe Zentrum
      // zoomen statt in die schwarze Innenfläche. (Julia exploriert per Drift,
      // siehe frame().)
      if (mode === 'mandelbrot' && s.zoom > 200) {
        const b = findBoundaryNonBlack(navPixels, NAV_W, NAV_H)
        if (b) {
          const t = pixelToComplex(b.px, b.py, NAV_W, NAV_H, s.centerX, s.centerY, s.zoom, s.angle)
          s.targetX = t.x
          s.targetY = t.y
        }
      }

      // Low-Detail-Erkennung → Fade auslösen (beide Modi). Deckt zwei Fälle ab:
      //  (a) zu viel schwarzes Mengen-Inneres,
      //  (b) uniforme farbige Fläche (z.B. eine Julia-„Lake", in die man sonst
      //      endlos ohne Detailgewinn hineinzoomen würde).
      const elapsed = performance.now() - s.locTime
      if (elapsed > 5000) {
        let black = 0
        let maxBucket = 0
        const total = NAV_W * NAV_H
        // Histogramm über grob quantisierte Farben (5 Bit pro Kanal).
        for (let k = 0; k < navHist.length; k++) navHist[k] = 0
        for (let i = 0; i < navPixels.length; i += 4) {
          const r = navPixels[i], g = navPixels[i + 1], b = navPixels[i + 2]
          if (r === 0 && g === 0 && b === 0) black++
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
          const c = ++navHist[key]
          if (c > maxBucket) maxBucket = c
        }
        if (black / total > 0.75 || maxBucket / total > 0.9) s.fading = true
      }
    }

    function frame(t: number) {
      if (!alive || !gl || !program) return
      const s = stateRef.current

      // Verstrichene Zeit seit letztem Frame in Sekunden (geclamped gegen Sprünge
      // nach Tab-Wechsel/Pausen). Alle Animationen rechnen mit dt → fps-unabhängig.
      const dt = lastT > 0 ? Math.min(0.1, (t - lastT) / 1000) : 0.016
      lastT = t

      // Canvas-Größe an Container anpassen
      const cw = container!.clientWidth || 300
      const ch = container!.clientHeight || 200
      if (canvas!.width !== cw || canvas!.height !== ch) {
        canvas!.width = cw
        canvas!.height = ch
      }

      if (!s.initialized) {
        const loc = locations[s.locIdx] || { cx: 0, cy: 0 }
        s.centerX = loc.cx
        s.centerY = loc.cy
        s.initialized = true
        s.locTime = performance.now()
      }

      if (!s.fading) {
        // Live-Zoom + langsame Rotation, zeitbasiert (fps-unabhängig).
        // ~0.82/s → von Zoom 80 bis ~1.5e6 in rund 12 s, danach Fade.
        s.zoom *= Math.exp(0.82 * dt)
        s.angle += 0.12 * dt

        // Julia: Center langsam driften lassen, damit das Detail durchs Bild
        // wandert statt in einer uniformen Fläche zu verharren (Amplitude ∝ 1/zoom,
        // ersetzt das frühere Tumbling/Drift des WASM-FractalJulia).
        if (mode === 'julia') {
          s.driftAngle += 0.35 * dt
          const d = 0.4 / s.zoom
          s.centerX += Math.cos(s.driftAngle) * d
          s.centerY += Math.sin(s.driftAngle) * d
        }

        // Auto-Zoom-Ziel sanft verfolgen (zeitbasiert, ~0.035/Frame bei 60 Hz)
        if (s.targetX !== undefined && s.zoom > 200) {
          const k = 1 - Math.exp(-2.1 * dt)
          s.centerX += (s.targetX - s.centerX) * k
          s.centerY += (s.targetY! - s.centerY) * k
        }

        // Navigation alle 4 Frames (Boundary + Schwarzraum)
        if ((s.navFrame++ & 3) === 0) navigate()

        // Fade auslösen, bevor die Präzision ausgeht
        const elapsed = performance.now() - s.locTime
        // zoomMax auf die GPU-sichere Präzisionsgrenze deckeln (siehe SAFE_ZOOM_CEIL)
        if (s.zoom > Math.min(zoomMax, SAFE_ZOOM_CEIL) && elapsed > 6000) s.fading = true

        // Beim Fade-Start die Ziel-Location festlegen
        if (s.fading) {
          s.nextLocIdx  = (s.locIdx + 1) % Math.max(1, locations.length)
          const nl = locations[s.nextLocIdx] || { cx: 0, cy: 0 }
          s.nextZoom    = 80 + Math.random() * 800
          s.nextCenterX = nl.cx
          s.nextCenterY = nl.cy
          s.fade = 0
          // Julia: zugleich auf den nächsten c-Parameter überblenden
          if (juliaSet && juliaSet.length > 1) {
            s.nextJuliaIdx = (s.juliaIdx + 1) % juliaSet.length
            const nc = juliaSet[s.nextJuliaIdx]
            gl.uniform2f(u.uJuliaC2, nc.cx, nc.cy)
          }
        }
      } else {
        // Crossfade läuft: aktuelles Fraktal eingefroren, zweites einblenden.
        // Zeitbasiert (~1.5/s → Übergang in ~0.66 s).
        s.fade = Math.min(1, s.fade + 1.5 * dt)
        if (s.fade >= 1) {
          // Übergang abgeschlossen → zur nächsten Location wechseln
          s.locIdx  = s.nextLocIdx
          s.zoom    = s.nextZoom
          s.centerX = s.nextCenterX
          s.centerY = s.nextCenterY
          s.angle   = 0
          s.fading  = false
          s.fade    = 0
          s.targetX = undefined
          s.locTime = performance.now()
          // Julia: neuen c-Parameter als primären übernehmen
          if (juliaSet && juliaSet.length > 1) {
            s.juliaIdx = s.nextJuliaIdx
            const cc = juliaSet[s.juliaIdx]
            gl.uniform2f(u.uJuliaC, cc.cx, cc.cy)
          }
        }
      }

      // ── Anzeige rendern ───────────────────────────────────────────────────
      gl.viewport(0, 0, canvas!.width, canvas!.height)
      gl.uniform2f(u.uResolution, canvas!.width, canvas!.height)
      setViewportUniforms(canvas!.width, canvas!.height)

      if (s.fading) {
        // Zweites Fraktal (Ziel-Location) als Crossfade-Partner setzen
        const [hx2, lx2] = splitDouble(s.nextCenterX)
        const [hy2, ly2] = splitDouble(s.nextCenterY)
        gl.uniform2f(u.uCenter2Hi, hx2, hy2)
        gl.uniform2f(u.uCenter2Lo, lx2, ly2)
        const [sx2, sy2] = pixelScale(s.nextZoom, canvas!.width, canvas!.height)
        gl.uniform2f(u.uPixelScale2, sx2, sy2)
        gl.uniform1f(u.uAngle2, 0)
        gl.uniform1f(u.uFade, s.fade)
      } else {
        gl.uniform1f(u.uFade, 0)
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Zoom-Wert fürs DOM (Tests pollen data-zoom), gedrosselt
      if ((s.navFrame & 7) === 0) {
        canvas!.setAttribute('data-zoom', s.zoom.toFixed(0))
        canvas!.setAttribute('data-zoom-direction', s.fading ? '0' : '1')
        // HUD-Text (Label + Zoom-Größenordnung), imperativ ohne React-Re-Render
        if (hud && hudRef.current) {
          const lbl = juliaSet?.[s.juliaIdx]?.label
          const z = Math.max(0, Math.log10(s.zoom)).toFixed(1)
          hudRef.current.textContent = (lbl ? `${lbl} // ` : '') + `ZOOM 10^${z}`
        }
      }
    }

    function onEvicted() {
      if (unsubscribeRaf) { unsubscribeRaf(); unsubscribeRaf = null }
      try {
        const ext = gl?.getExtension('WEBGL_lose_context')
        ext?.loseContext()
      } catch { /* egal */ }
      gl = null
      program = null
    }

    function acquireAndStart() {
      if (!alive) return
      acquireWebGLSlot(panelId, onEvicted, isVisible)
      // Kurz warten, damit ein evtl. evakuierter Context wirklich frei ist.
      setTimeout(() => {
        if (alive && !gl && initGL()) {
          if (!unsubscribeRaf && isVisible) unsubscribeRaf = subscribe(frame)
        }
      }, 30)
    }

    const io = new IntersectionObserver(([e]) => {
      isVisible = e.isIntersecting
      updateWebGLSlotActivity(panelId, isVisible)
      if (isVisible) {
        if (gl) {
          if (!unsubscribeRaf) unsubscribeRaf = subscribe(frame)
        } else {
          acquireAndStart()
        }
      } else if (unsubscribeRaf) {
        unsubscribeRaf(); unsubscribeRaf = null
      }
    })
    io.observe(container)

    acquireAndStart()

    return () => {
      alive = false
      if (unsubscribeRaf) unsubscribeRaf()
      io.disconnect()
      releaseWebGLSlot(panelId)
      try {
        if (gl) {
          if (navFbo) gl.deleteFramebuffer(navFbo)
          if (navTex) gl.deleteTexture(navTex)
          gl.getExtension('WEBGL_lose_context')?.loseContext()
        }
      } catch { /* egal */ }
    }
    // Konfiguration ist über die Lebensdauer stabil; bewusst nur einmal initialisieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        data-testid="fractal-canvas"
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'auto' }}
      />
      {hud && (
        <div
          ref={hudRef}
          className="absolute bottom-1 right-2 font-mono text-[11px] text-green-400/90 pointer-events-none select-none"
        />
      )}
    </div>
  )
}

// ── Navigations-Helfer (arbeiten auf dem kleinen Nav-Bild) ────────────────────

/** Pixel (Nav-Bild) → komplexe Koordinate. Spiegelt das Shader-Mapping. */
function pixelToComplex(
  px: number, py: number, W: number, H: number,
  centerX: number, centerY: number, zoom: number, angle: number,
): { x: number; y: number } {
  // gleiche Skalierung wie der Shader (hier Mandelbrot-Variante; für die
  // Navigation ausreichend, da nur die Detail-Richtung relevant ist)
  const sx = 4 / (zoom * W)
  const sy = 4 / (zoom * H)
  const dx = (px - W / 2) * sx
  const dy = (py - H / 2) * sy
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  return {
    x: centerX + (dx * ca - dy * sa),
    y: centerY + (dx * sa + dy * ca),
  }
}

/** Sucht ringförmig vom Zentrum nach außen ein Detail-Pixel an der Schwarz-Grenze. */
function findBoundaryNonBlack(pixels: Uint8Array, W: number, H: number): { px: number; py: number } | null {
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)
  const isBlack = (x: number, y: number) => {
    const idx = (y * W + x) * 4
    return pixels[idx] === 0 && pixels[idx + 1] === 0 && pixels[idx + 2] === 0
  }
  const maxRadius = Math.min(cx, cy) - 2
  for (let r = 1; r < maxRadius; r += 2) {
    const n = Math.min(64, 4 * r)
    for (let si = 0; si < n; si++) {
      const a = (si * 2 * Math.PI) / n
      const px = Math.round(cx + r * Math.cos(a))
      const py = Math.round(cy + r * Math.sin(a))
      if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue
      const center = isBlack(px, py)
      const neigh = [isBlack(px - 1, py), isBlack(px + 1, py), isBlack(px, py - 1), isBlack(px, py + 1)]
      if (neigh.some(v => v !== center)) {
        if (!center) return { px, py }
        if (!neigh[0]) return { px: px - 1, py }
        if (!neigh[1]) return { px: px + 1, py }
        if (!neigh[2]) return { px, py: py - 1 }
        return { px, py: py + 1 }
      }
    }
  }
  return null
}

export default memo(FractalGL)
