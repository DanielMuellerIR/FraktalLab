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
  /** Fester Julia-Parameter c (nur bei mode==='julia') */
  juliaC?: { cx: number; cy: number }
  /** Farb-Transform: 0 base, 1 mono, 2 cold, 3 hot, 4 neon, 5 invert */
  colorMode?: number
  /** Iterationstiefe (max. 256, vom Shader gedeckelt) */
  maxIter?: number
  /** Zoom-Schwelle, ab der (nach Mindest-Standzeit) zur nächsten Location gefadet wird */
  zoomMax?: number
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

function FractalGL({ mode, locations, juliaC, colorMode = 0, maxIter = 128, zoomMax = 1.5e6 }: FractalGLConfig) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    initialized: false,
    locTime: 0,
    fading:  false,
    fade:    0,
    // Ziel-Location für den Crossfade
    nextLocIdx: 0,
    nextZoom:   80,
    nextCenterX: 0,
    nextCenterY: 0,
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
      gl = (canvas!.getContext('webgl', { preserveDrawingBuffer: false }) ||
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
        'uMaxIter', 'uMode', 'uJuliaC', 'uColorMode', 'uFade',
        'uCenter2Hi', 'uCenter2Lo', 'uPixelScale2', 'uAngle2',
      ]) {
        u[name] = gl.getUniformLocation(program, name)
      }

      // Konstante Uniforms einmal setzen
      gl.uniform1i(u.uMode, mode === 'julia' ? 1 : 0)
      gl.uniform1i(u.uColorMode, colorMode)
      gl.uniform1i(u.uMaxIter, Math.min(256, maxIter))
      gl.uniform2f(u.uJuliaC, juliaC?.cx ?? 0, juliaC?.cy ?? 0)

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
      if (mode === 'julia') return [1 / zoom, 1 / zoom]
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

      // Boundary-Tracking: Detail-Pixel (nicht-schwarz) nahe Zentrum anpeilen.
      if (!s.fading && s.zoom > 200) {
        const b = findBoundaryNonBlack(navPixels, NAV_W, NAV_H)
        if (b) {
          const t = pixelToComplex(b.px, b.py, NAV_W, NAV_H, s.centerX, s.centerY, s.zoom, s.angle)
          s.targetX = t.x
          s.targetY = t.y
        }
        // Schwarzraum-Früherkennung: zu viel Mandelbrot-Inneres → Fade auslösen.
        const elapsed = performance.now() - s.locTime
        if (elapsed > 6000) {
          let black = 0
          for (let i = 0; i < navPixels.length; i += 4) {
            if (navPixels[i] === 0 && navPixels[i + 1] === 0 && navPixels[i + 2] === 0) black++
          }
          if (black / (NAV_W * NAV_H) > 0.75) s.fading = true
        }
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
        if (s.zoom > zoomMax && elapsed > 6000) s.fading = true

        // Beim Fade-Start die Ziel-Location festlegen
        if (s.fading) {
          s.nextLocIdx  = (s.locIdx + 1) % Math.max(1, locations.length)
          const nl = locations[s.nextLocIdx] || { cx: 0, cy: 0 }
          s.nextZoom    = 80 + Math.random() * 800
          s.nextCenterX = nl.cx
          s.nextCenterY = nl.cy
          s.fade = 0
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
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        data-testid="fractal-canvas"
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'auto' }}
      />
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
