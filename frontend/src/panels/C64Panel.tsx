import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// C64Panel — originalgetreuer Commodore-64-Look (Farben aus Referenz-Screenshot)
//   Phase 1: Boot-Bildschirm (statisch)
//   Phase 2: LOAD"*",8,1 eintippen
//   Phase 3: SEARCHING + LOADING (statisch, keine Animation)
//   Phase 4: RUN eintippen
//   Phase 5: Demo-Szene (Scroller / Rasterbars / Plasma / Sprites)
//   Phase 6: READY. mit blinkendem Cursor
// ─────────────────────────────────────────────────────────────────────────────

// ── C64-Palette (originalgetreue VICE-Werte) ──────────────────────────────────
const PAL: string[] = [
  '#000000', '#FFFFFF', '#883932', '#67B6BD',
  '#8B3F96', '#55A049', '#40318D', '#BFCE72',
  '#8B5429', '#574200', '#B86962', '#505050',
  '#787878', '#94E089', '#7869C4', '#9F9F9F',
]

// ── Bildschirmfarben (aus Referenz-Screenshot) ────────────────────────────────
const BORDER_CLR = '#a2a2ff'   // TV-Rand — helles Periwinkle
const BG_CLR     = '#3a3aff'   // Content-Hintergrund — royal Blau
const TEXT_CLR   = '#a2a2ff'   // Text — helles Periwinkle
const CURSOR_CLR = '#a2a2ff'   // Cursor-Block — identisch zu Text

// ── C64-Textmodus: 40 Spalten × 25 Zeilen ─────────────────────────────────────
const COLS = 40
const ROWS = 25
// Rand-Anteil: je Seite 10% der Canvas-Dimension (originalgetreue C64-Monitor-Proportion)
const BORDER_FRAC = 0.10

// ── Scroller-Text für die Demo ────────────────────────────────────────────────
const SCROLL_TXT =
  '   ***   FRAKTALLAB PRESENTS   ***   HELLO WORLD FROM SECTOR-7   ***   ' +
  'KEEP IT REAL, KEEP IT 8-BIT   ***   GREETINGS TO ALL CODERS   ***   '

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Gibt [r,g,b] für einen Hex-String zurück */
function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Mischt zwei Hex-Farben (Faktor t ∈ 0..1) */
function mixColors(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a)
  const [br, bg, bb] = hexRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function C64Panel() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const _canvas = canvasRef.current
    const _cont   = containerRef.current
    if (!_canvas || !_cont) return
    const canvas: HTMLCanvasElement      = _canvas
    const cont:   HTMLDivElement         = _cont
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D  = _ctx

    let active = true
    let rafId  = 0

    // ── Resize — 4:3-Seitenverhältnis erzwingen ──────────────────────────────
    function resize() {
      const cW = cont.clientWidth
      const cH = cont.clientHeight
      // Maximale 4:3-Box innerhalb des Containers
      if (cW / cH > 4 / 3) {
        canvas.height = cH
        canvas.width  = Math.round(cH * (4 / 3))
      } else {
        canvas.width  = cW
        canvas.height = Math.round(cW * (3 / 4))
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cont)

    // ── Interne Canvas-Dimensionen berechnen ──────────────────────────────────
    // Gibt {bx, by, cw, ch, cellW, cellH, fs} zurück:
    //   bx/by = obere linke Ecke des Content-Bereichs
    //   cw/ch = Breite/Höhe des Content-Bereichs
    //   cellW/H = Zellgröße in Pixeln
    //   fs = Schriftgröße
    function layout() {
      const W  = canvas.width
      const H  = canvas.height
      const bx = Math.round(W * BORDER_FRAC)
      const by = Math.round(H * BORDER_FRAC)
      const cw = W - bx * 2
      const ch = H - by * 2
      // Zeichenzelle quadratisch (wie am Original-C64)
      const cs = Math.min(cw / COLS, ch / ROWS)
      // Content-Bereich mittig im Border positionieren
      const offX = Math.round((cw - cs * COLS) / 2)
      const offY = Math.round((ch - cs * ROWS) / 2)
      return { W, H, bx, by, cw, ch, cs, offX, offY, fs: Math.max(8, cs * 0.90) }
    }

    // ── Hintergrund + Border zeichnen ─────────────────────────────────────────
    function drawBorder() {
      const { W, H, bx, by, cw, ch } = layout()
      // Ganzer Canvas = Border-Farbe
      ctx.fillStyle = BORDER_CLR
      ctx.fillRect(0, 0, W, H)
      // Content-Rechteck = Hintergrundfarbe
      ctx.fillStyle = BG_CLR
      ctx.fillRect(bx, by, cw, ch)
    }

    // ── CRT-Scanlines ────────────────────────────────────────────────────────
    function drawScanlines() {
      const { W, H } = layout()
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1)
    }

    // ── Text an Raster-Position (col, row) zeichnen ──────────────────────────
    // col und row sind 0-basiert im 40×25-Gitter
    function drawChar(text: string, col: number, row: number, color = TEXT_CLR) {
      const { bx, by, cs, offX, offY } = layout()
      // Press Start 2P has standard square bounds, make it fill 80% of cell to fit perfectly
      const adjustedFs = Math.max(6, cs * 0.80)
      ctx.font         = `${adjustedFs}px "Press Start 2P", monospace`
      ctx.fillStyle    = color
      ctx.textBaseline = 'middle'
      ctx.textAlign    = 'center'
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const x = bx + offX + (col + i) * cs + cs / 2
        const y = by + offY + row * cs + cs / 2
        ctx.fillText(char, x, y)
      }
    }

    // ── Eine vollständige Zeile schreiben ─────────────────────────────────────
    function drawLine(text: string, row: number, color = TEXT_CLR) {
      drawChar(text, 0, row, color)
    }

    // ── Boot-Bildschirm rendern (Zeilen + Cursor-Pos) ─────────────────────────
    function renderScreen(
      lines: string[],
      cursorRow: number,
      cursorCol: number,
      blinkOn: boolean,
    ) {
      drawBorder()
      lines.forEach((ln, r) => { if (ln) drawLine(ln, r) })
      if (blinkOn) {
        const { bx, by, cs, offX, offY } = layout()
        ctx.fillStyle = CURSOR_CLR
        // C64 cursor is a solid block filling the character cell
        ctx.fillRect(bx + offX + cursorCol * cs, by + offY + cursorRow * cs, cs, cs)
      }
      drawScanlines()
    }

    // ────────────────────────────────────────────────────────────────────
    // Phasen-Zustand
    // ────────────────────────────────────────────────────────────────────
    type Phase =
      | 'boot'        // statischer Boot-Screen
      | 'type_load'   // LOAD"*",8,1 eintippen
      | 'searching'   // SEARCHING FOR * + LOADING (statisch)
      | 'type_run'    // RUN eintippen
      | 'demo'        // Demo-Szene
      | 'ready'       // READY. mit Cursor

    let phase:      Phase  = 'boot'
    let phaseStart: number = 0

    // Tipp-State
    const LOAD_CMD = 'LOAD"*",8,1:'
    const RUN_CMD  = 'RUN'
    let typedSoFar = ''

    // Demo-State
    let demoScene = 0
    let scrollX   = 0

    // ── Boot-Zeilen (festes Array 25 Zeilen) ──────────────────────────────────
    // Die C64-Zeilen 0..24 entsprechen dem 40×25-Gitter.
    const bootLines: string[] = Array(ROWS).fill('')
    bootLines[1] = '    **** COMMODORE 64 BASIC V2 ****'
    bootLines[2] = ' 64K RAM SYSTEM  38911 BASIC BYTES FREE'
    bootLines[3] = ''
    bootLines[4] = 'READY.'

    // Kopie die wir während des Tippens modifizieren
    let screenLines: string[] = [...bootLines]

    // ────────────────────────────────────────────────────────────────────
    // Demo-Szene 0: Sinus-Scroller
    // ────────────────────────────────────────────────────────────────────
    function renderScroller(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Breit, damit der Text gut lesbar ist
      const fSize = Math.max(10, Math.min(20, ch * 0.08))
      ctx.font = `${fSize}px "Press Start 2P", monospace`
      ctx.textBaseline = 'middle'

      // Text von rechts nach links bewegen (2 px/Frame bei 60fps ≈ 120 px/s)
      scrollX -= 2.0
      const textW = SCROLL_TXT.length * fSize * 0.6
      if (scrollX < -textW) scrollX = W

      const centerY = by + ch * 0.5
      const amplitude = ch * 0.22

      // Jeden Buchstaben einzeln mit Sinus-Y und Regenbogenfarbe zeichnen
      const charW = fSize * 0.6
      for (let i = 0; i < SCROLL_TXT.length; i++) {
        const cx2 = scrollX + i * charW
        if (cx2 < bx - charW || cx2 > bx + cw + charW) continue
        const phase2 = (cx2 - bx) / (cw * 0.5)
        const cy2 = centerY + Math.sin(phase2 * Math.PI * 2 + now / 600) * amplitude
        const palIdx = (Math.floor(i + now / 80)) % PAL.length
        ctx.fillStyle = PAL[Math.max(1, palIdx)]
        ctx.fillText(SCROLL_TXT[i], cx2, cy2)
      }

      // Statuszeile
      ctx.font = `${Math.max(6, fSize * 0.5)}px "Press Start 2P", monospace`
      ctx.fillStyle = PAL[14]
      ctx.textBaseline = 'top'
      ctx.fillText('SECTOR-7 PRODUCTIONS  2024', bx + 4, by + 4)
    }

    // ────────────────────────────────────────────────────────────────────
    // Demo-Szene 1: Rasterbars
    // ────────────────────────────────────────────────────────────────────
    function renderRasterbars(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const bars = 8
      const barH = Math.round(ch * 0.1)
      const colors = [PAL[2], PAL[4], PAL[5], PAL[3], PAL[7], PAL[8], PAL[14], PAL[13]]

      for (let b = 0; b < bars; b++) {
        const phase2 = b * 0.7 + now / 600
        const y = by + ch * 0.5 + Math.sin(phase2) * ch * 0.38 - barH / 2

        // Weicher Farbverlauf innerhalb des Balkens
        const col = colors[b % colors.length]
        for (let dy = 0; dy < barH; dy++) {
          const t = Math.sin((dy / barH) * Math.PI)
          ctx.fillStyle = mixColors('#000000', col, t * 0.9)
          ctx.fillRect(bx, Math.round(y + dy), cw, 1)
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // Demo-Szene 2: Plasma (C64-Palette)
    // ────────────────────────────────────────────────────────────────────
    function renderPlasma(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      const t = now / 1200

      // Plasma bei halber Auflösung für Performance, dann upscale
      const step = 4
      for (let py = 0; py < ch; py += step) {
        for (let px = 0; px < cw; px += step) {
          const nx = px / cw
          const ny = py / ch
          const v =
            Math.sin(nx * 8 + t) +
            Math.sin(ny * 6 + t * 1.3) +
            Math.sin((nx + ny) * 5 + t * 0.7) +
            Math.sin(Math.sqrt((nx * nx + ny * ny) * 60) + t)
          const idx = Math.abs(Math.round(v * 3.5)) % PAL.length
          ctx.fillStyle = PAL[idx]
          ctx.fillRect(bx + px, by + py, step, step)
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // Demo-Szene 3: Sprites auf Sinus-Bahnen
    // ────────────────────────────────────────────────────────────────────
    const SPRITE_COUNT = 5
    const sprPhases = Array.from({ length: SPRITE_COUNT }, (_, i) => i * 1.25)
    const sprColors = [PAL[2], PAL[5], PAL[3], PAL[7], PAL[14]]

    function renderSprites(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000022'
      ctx.fillRect(0, 0, W, H)

      // Sternenhintergrund (statisch, wird nur beim ersten Frame gezeichnet)
      ctx.fillStyle = '#FFFFFF'
      for (let i = 0; i < 60; i++) {
        const sx = bx + ((i * 173 + 7) % cw)
        const sy = by + ((i * 97 + 13) % ch)
        ctx.fillRect(sx, sy, 1, 1)
      }

      const sz = Math.round(Math.min(cw, ch) * 0.07)
      for (let s = 0; s < SPRITE_COUNT; s++) {
        const p1 = sprPhases[s] + now / 900
        const p2 = sprPhases[s] * 1.6 + now / 650
        const sx = bx + cw * 0.5 + Math.sin(p1) * cw * 0.38
        const sy = by + ch * 0.5 + Math.sin(p2) * ch * 0.32

        // Raute zeichnen
        ctx.fillStyle = sprColors[s]
        ctx.beginPath()
        ctx.moveTo(sx,      sy - sz)
        ctx.lineTo(sx + sz, sy)
        ctx.lineTo(sx,      sy + sz)
        ctx.lineTo(sx - sz, sy)
        ctx.closePath()
        ctx.fill()

        // Heller Kern
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(sx, sy, sz * 0.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Demo-Label
      const fSize = Math.max(6, Math.min(10, ch * 0.045))
      ctx.font = `${fSize}px "Press Start 2P", monospace`
      ctx.fillStyle = PAL[14]
      ctx.textBaseline = 'top'
      ctx.fillText('SPRITE FX  // SECTOR-7', bx + 4, by + 4)
    }

    // ────────────────────────────────────────────────────────────────────
    // RAF-Hauptschleife
    // ────────────────────────────────────────────────────────────────────
    function loop(now: number) {
      if (!active) return

      const { W, H } = layout()
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }
      if (phaseStart === 0) phaseStart = now

      const elapsed = now - phaseStart
      const blinkOn = Math.floor(now / 530) % 2 === 0

      // ── Phasen-Logik ─────────────────────────────────────────────────
      if (phase === 'boot') {
        // Boot-Screen 2s anzeigen, dann Tippen starten
        renderScreen(screenLines, 5, 0, blinkOn)
        if (elapsed > 2000) {
          phase = 'type_load'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_load') {
        // Zeichenweises Eintippen von LOAD"*",8,1 (180 ms / Zeichen)
        const charsToType = Math.floor((now - phaseStart) / 180)
        typedSoFar = LOAD_CMD.slice(0, Math.min(charsToType, LOAD_CMD.length))
        const lines = [...screenLines]
        lines[5] = typedSoFar
        renderScreen(lines, 5, typedSoFar.length, blinkOn)

        if (typedSoFar.length >= LOAD_CMD.length && elapsed > LOAD_CMD.length * 180 + 400) {
          // Enter gedrückt → zu 'searching'
          phase = 'searching'
          phaseStart = now
          screenLines[5] = LOAD_CMD
          screenLines[6] = ''
          screenLines[7] = 'SEARCHING FOR *'
          screenLines[8] = 'LOADING'
        }

      } else if (phase === 'searching') {
        // LOADING statisch anzeigen (2s), kein Animation
        renderScreen(screenLines, 9, 0, false)
        if (elapsed > 2000) {
          phase = 'type_run'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_run') {
        // RUN eintippen (180 ms / Zeichen)
        const charsToType = Math.floor((now - phaseStart) / 180)
        typedSoFar = RUN_CMD.slice(0, Math.min(charsToType, RUN_CMD.length))
        const lines = [...screenLines]
        lines[9] = typedSoFar
        renderScreen(lines, 9, typedSoFar.length, blinkOn)

        if (typedSoFar.length >= RUN_CMD.length && elapsed > RUN_CMD.length * 180 + 400) {
          phase = 'demo'
          phaseStart = now
          demoScene = 0
          scrollX = W
        }

      } else if (phase === 'demo') {
        // Demo: Scroller (Szene 0) läuft 20s, alle anderen Szenen je 7s,
        // dazwischen je 0.5s schwarzer Übergang.
        // Szenen-Dauer-Tabelle: [Scroller, Rasterbars, Plasma, Sprites]
        const sceneDurs  = [20000, 7000, 7000, 7000]
        const transTime  = 500
        const totalDur   = sceneDurs.reduce((s, d) => s + d + transTime, 0)

        // Herausfinden, in welcher Szene wir uns befinden
        let newScene = 0
        let sceneT   = elapsed
        for (let si = 0; si < sceneDurs.length; si++) {
          const slotDur = sceneDurs[si] + transTime
          if (sceneT < slotDur) { newScene = si; break }
          sceneT -= slotDur
          newScene = (si + 1) % 4  // Fallback, falls elapsed > totalDur
        }
        const sceneDur = sceneDurs[newScene]

        if (newScene !== demoScene) { demoScene = newScene; scrollX = W }

        if (sceneT >= sceneDur) {
          // Schwarzer Übergang — kein C64-Rand, nur Schwarz
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, W, H)
          drawScanlines()
        } else {
          // Demo-Szene rendern — kein C64-Rand
          switch (demoScene) {
            case 0: renderScroller(now); break
            case 1: renderRasterbars(now); break
            case 2: renderPlasma(now); break
            case 3: renderSprites(now); break
          }
          drawScanlines()
        }

        if (elapsed > totalDur + 500) {
          phase = 'ready'
          phaseStart = now
          screenLines = [...bootLines]
          screenLines[5] = ''
          screenLines[6] = 'READY.'
        }

      } else if (phase === 'ready') {
        // READY. 2s anzeigen, dann neuer Boot
        renderScreen(screenLines, 7, 0, blinkOn)
        if (elapsed > 2000) {
          phase = 'boot'
          phaseStart = now
          screenLines = [...bootLines]
          typedSoFar = ''
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      active = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="C64 // SYSTEM INTRUDE MODE">
      {/* bg-black: Letterbox-Balken bei Seitenverhältnis-Abweichung */}
      <div ref={containerRef} className="w-full h-full min-h-0 flex items-center justify-center bg-black overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
    </Panel>
  )
}
