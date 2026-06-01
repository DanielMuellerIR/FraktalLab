import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
// rAF-Loop laeuft ueber den zentralen raf-coordinator. Siehe AUDIT_FINDINGS.md H-05.
import { subscribe } from '../utils/raf-coordinator'

// ── C64-Palette (VICE values) ──────────────────────────────────
const PAL: string[] = [
  '#000000', '#FFFFFF', '#883932', '#67B6BD',
  '#8B3F96', '#55A049', '#40318D', '#BFCE72',
  '#8B5429', '#574200', '#B86962', '#505050',
  '#787878', '#94E089', '#7869C4', '#9F9F9F',
]

// ── Screen colors matching reference screenshot ────────────────────────────────
const BORDER_CLR = '#a2a2ff'   // TV border - light Periwinkle
const BG_CLR     = '#3a3aff'   // Content background - royal Blue
const TEXT_CLR   = '#a2a2ff'   // Text - light Periwinkle
const CURSOR_CLR = '#a2a2ff'   // Cursor block - matches text

// ── C64 Text Mode: 40 Columns × 25 Rows ─────────────────────────────────────
const COLS = 40
const ROWS = 25
const BORDER_FRAC = 0.05

// ── Scroller text for the demo ────────────────────────────────────────────────
const SCROLL_TXT =
  '   ***   FRAKTALLAB PRESENTS   ***   HELLO WORLD FROM SECTOR-7   ***   ' +
  'KEEP IT REAL, KEEP IT 8-BIT   ***   GREETINGS TO ALL CODERS   ***   '

// ── Helper functions ───────────────────────────────────────────────────────────

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function mixColors(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a)
  const [br, bg, bb] = hexRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  // Bugfix: der Gruen-Kanal muss zwischen ag und bg interpolieren (vorher
  // stand hier faelschlich "bg - ar", was die Rasterbar-Farben verfaelschte).
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

function getCharCoords(char: string): { col: number; row: number } | null {
  const c = char.toUpperCase()
  const row0 = "@ABCDEFGHIJKLMNO"
  const row1 = "PQRSTUVWXYZ[£]↑←"
  const row2 = " !\"#$%&'()*+,-./"
  const row3 = "0123456789:;<=>?"
  
  let idx = row0.indexOf(c)
  if (idx !== -1) return { col: idx, row: 0 }
  
  idx = row1.indexOf(c)
  if (idx !== -1) return { col: idx, row: 1 }
  
  idx = row2.indexOf(c)
  if (idx !== -1) return { col: idx, row: 2 }
  
  idx = row3.indexOf(c)
  if (idx !== -1) return { col: idx, row: 3 }
  
  return { col: 0, row: 2 } // Fallback to space
}

function C64Panel() {
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

    // Pixel-Quality Kategorie A: authentisch grobpixelig. Kein Glaetten beim
    // Skalieren der Bitmap-Glyphen — harte Pixelkanten sind hier gewollt.
    ctx.imageSmoothingEnabled = false

    let active = true
    // unsubscribe-Funktion aus subscribe(); null wenn nicht angemeldet.
    let unsubscribe: (() => void) | null = null

    // ── Resize ───────────────────────────────────────────────────────────────
    function resize() {
      const cW = cont.clientWidth
      const cH = cont.clientHeight
      if (cW / cH > 4 / 3) {
        canvas.height = cH
        canvas.width  = Math.round(cH * (4 / 3))
      } else {
        canvas.width  = cW
        canvas.height = Math.round(cW * (3 / 4))
      }
      // Wichtig: Beim Setzen von canvas.width/height wird der 2D-Kontext
      // zurueckgesetzt — also auch imageSmoothingEnabled. Deshalb hier erneut
      // deaktivieren, damit die Glyphen weiterhin hart-pixelig bleiben.
      ctx.imageSmoothingEnabled = false
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cont)

    function layout() {
      const W  = canvas.width
      const H  = canvas.height
      
      const minBorderX = W * BORDER_FRAC
      const minBorderY = H * BORDER_FRAC
      
      const maxScreenW = W - minBorderX * 2
      const maxScreenH = H - minBorderY * 2
      
      let cs = Math.floor(Math.min(maxScreenW / COLS, maxScreenH / ROWS))
      if (cs < 1) cs = 1
      
      const cw = cs * COLS
      const ch = cs * ROWS
      
      const bx = Math.round((W - cw) / 2)
      const by = Math.round((H - ch) / 2)
      
      return { W, H, bx, by, cw, ch, cs }
    }

    function drawBorder() {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = BORDER_CLR
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = BG_CLR
      ctx.fillRect(bx, by, cw, ch)
    }

    function drawScanlines() {
      const { W, H } = layout()
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1)
    }

    // ── Bitmap-Font Setup ──────────────────────────────────────────────────────
    //
    // FONT-FIX (Regression behoben):
    //
    // Der alte Code baute fuer JEDE der 16 C64-Palettenfarben ein eigenes,
    // eingefaerbtes Font-Sheet und waehlte beim Zeichnen per "naechste
    // Palettenfarbe" (getPaletteIndex) das passende aus. Das hatte zwei Fehler,
    // die zusammen dafuer sorgten, dass der Boot-/BASIC-Text praktisch unsichtbar
    // bzw. falschfarbig war:
    //
    //   1) Die gewuenschte Schriftfarbe TEXT_CLR = '#a2a2ff' (helles Periwinkle)
    //      ist KEINE der 16 C64-Palettenfarben. getPaletteIndex() rastete sie
    //      deshalb auf die naechstliegende Palettenfarbe ein — das war hier das
    //      cyan-/lila-stichige PAL[3] bzw. PAL[14]. Auf dem royalblauen
    //      Hintergrund (#3a3aff) ergab das extrem kontrastarmen, "verschwundenen"
    //      Text in der falschen Farbe.
    //   2) Die Helligkeits-Schwelle (val > 80) zum Trennen von Glyphe und
    //      Hintergrund war fragil: Vorder- und Hintergrund des PNG sind beide
    //      blaeulich, die Werte liegen nah beieinander.
    //
    // Neue Loesung: Wir erzeugen aus dem PNG GENAU EINE Alpha-Maske
    //   (weisse Glyphen auf transparentem Grund). Diese Maske faerben wir beim
    //   Zeichnen on-the-fly in die EXAKT gewuenschte Farbe ein (auch Nicht-
    //   Palettenfarben wie #a2a2ff). Das ist farbtreu, kontraststark und kommt
    //   ohne das verlustbehaftete Palette-Einrasten aus.
    const fontImg = new Image()
    // BASE_URL-relativ laden: online läuft die Seite unter /x/ (nicht /), ein
    // absolutes '/c64_font.png' würde dort 404 liefern → Font weg. Lokal (Base '/')
    // ebenso korrekt.
    fontImg.src = `${import.meta.env.BASE_URL}c64_font.png`
    let fontLoaded = false

    // Die Alpha-Maske: weisse Glyphen (RGB 255,255,255) mit Alpha aus der
    // Glyphen-Helligkeit, Hintergrund vollstaendig transparent.
    let maskSheet: HTMLCanvasElement | null = null
    // Wiederverwendbarer Tint-Puffer: hier faerben wir pro Frame um, statt 16
    // Sheets vorzuhalten. Vermeidet teures Neu-Allozieren.
    let tintCanvas: HTMLCanvasElement | null = null

    // ── Zellen-Geometrie des Font-Sheets ───────────────────────────────────────
    // Das c64_font.png hat einen schmalen Aussenrand und duenne Gitterlinien
    // zwischen den Zellen. Die hier verwendeten Werte (Rand 6 px, Zellabstand
    // 26 px, Glyphe 24 px) entsprechen exakt dem urspruenglich funktionierenden
    // Sampling — sie waren NICHT die Ursache der Font-Regression (das war die
    // Farb-Einrastung, s. o.). Wir behalten sie deshalb bei und ergaenzen nur
    // einen kleinen Inset, der etwaige Gitterlinien-Reste wegschneidet.
    const SHEET_BORDER = 6   // Aussenrand des Sheets bis zur ersten Zelle (px)
    const CELL_PITCH   = 26  // Abstand Zellanfang zu Zellanfang (px)
    const GLYPH_SIZE   = 24  // belegte Glyphen-Flaeche je Zelle (px)
    const glyphInset   = 1   // zusaetzliches Inset gegen Gitterlinien (px)

    fontImg.onload = () => {
      const fw = fontImg.width
      const fh = fontImg.height

      // PNG in einen Off-Screen-Canvas zeichnen, um an die Pixeldaten zu kommen.
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = fw
      tempCanvas.height = fh
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return
      tempCtx.drawImage(fontImg, 0, 0)

      const imgData = tempCtx.getImageData(0, 0, fw, fh)
      const data = imgData.data

      // Alpha-Maske aufbauen: Glyphe -> weiss/opak, Hintergrund -> transparent.
      const mask = document.createElement('canvas')
      mask.width = fw
      mask.height = fh
      const maskCtx = mask.getContext('2d')
      if (!maskCtx) return

      const maskData = new ImageData(fw, fh)
      const m = maskData.data

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // Wahrnehmungs-Helligkeit (Luma). Die hellen Periwinkle-Glyphen liegen
        // klar ueber dem dunkelblauen Hintergrund (~66) und unter den Glyphen
        // (~159). Schwelle 95 trennt zuverlaessig; die mittelhellen Gitterlinien
        // werden zusaetzlich durch den glyphInset (siehe drawGlyphTinted)
        // weggeschnitten, liegen also gar nicht erst im Glyphen-Ausschnitt.
        const val = 0.299 * r + 0.587 * g + 0.114 * b
        if (val > 95) {
          m[i] = 255
          m[i + 1] = 255
          m[i + 2] = 255
          m[i + 3] = 255
        } else {
          m[i] = 0
          m[i + 1] = 0
          m[i + 2] = 0
          m[i + 3] = 0
        }
      }
      maskCtx.putImageData(maskData, 0, 0)
      maskSheet = mask

      // Tint-Puffer fuer EINE Glyphe vorbereiten (wird beim Zeichnen genutzt).
      tintCanvas = document.createElement('canvas')

      fontLoaded = true
    }

    // Eine einzelne Glyphe in beliebiger Farbe zeichnen.
    // Vorgehen: Glyphen-Ausschnitt aus der weissen Maske in einen kleinen
    // Tint-Puffer kopieren, dort per 'source-in'-Komposition mit der Zielfarbe
    // einfaerben und das Ergebnis aufs Haupt-Canvas skalieren.
    function drawGlyphTinted(
      coords: { col: number; row: number },
      destX: number,
      destY: number,
      destSize: number,
      color: string,
    ) {
      if (!maskSheet || !tintCanvas) return
      // Quell-Rechteck im Sheet: Aussenrand + Spalte/Zeile * Zellabstand, plus
      // kleines Inset gegen Gitterlinien. Breite/Hoehe = Glyphe minus Inset.
      const srcX = SHEET_BORDER + coords.col * CELL_PITCH + glyphInset
      const srcY = SHEET_BORDER + coords.row * CELL_PITCH + glyphInset
      const srcW = GLYPH_SIZE - glyphInset * 2
      const srcH = GLYPH_SIZE - glyphInset * 2

      // Tint-Puffer auf Glyphen-Quellgroesse bringen und leeren.
      const tc = tintCanvas
      if (tc.width !== srcW || tc.height !== srcH) {
        tc.width = srcW
        tc.height = srcH
      }
      const tctx = tc.getContext('2d')
      if (!tctx) return
      tctx.clearRect(0, 0, srcW, srcH)
      // 1) Weisse Glyphenmaske in den Puffer kopieren.
      tctx.globalCompositeOperation = 'source-over'
      tctx.drawImage(maskSheet, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH)
      // 2) Mit der Zielfarbe einfaerben: 'source-in' faerbt nur dort, wo die
      //    Maske opak ist — der transparente Hintergrund bleibt transparent.
      tctx.globalCompositeOperation = 'source-in'
      tctx.fillStyle = color
      tctx.fillRect(0, 0, srcW, srcH)
      tctx.globalCompositeOperation = 'source-over'

      // 3) Eingefaerbte Glyphe aufs Haupt-Canvas skalieren (grobpixelig, gewollt).
      ctx.drawImage(tc, 0, 0, srcW, srcH, destX, destY, destSize, destSize)
    }

    function drawChar(text: string, col: number, row: number, color = TEXT_CLR) {
      const { bx, by, cs } = layout()

      if (fontLoaded) {
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          const coords = getCharCoords(char)
          if (!coords) continue

          const destX = bx + col * cs + i * cs
          const destY = by + row * cs
          // Glyphe in der EXAKT gewuenschten Farbe zeichnen (kein Palette-Snap).
          drawGlyphTinted(coords, destX, destY, cs, color)
        }
      } else {
        // Fallback, solange das PNG noch laedt: System-Monospace.
        const adjustedFs = Math.max(6, cs * 0.80)
        ctx.font         = `${adjustedFs}px monospace`
        ctx.fillStyle    = color
        ctx.textBaseline = 'middle'
        ctx.textAlign    = 'center'
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          ctx.fillText(char, bx + (col + i) * cs + cs / 2, by + row * cs + cs / 2)
        }
      }
    }

    function drawLine(text: string, row: number, color = TEXT_CLR) {
      drawChar(text, 0, row, color)
    }

    function renderScreen(
      lines: string[],
      cursorRow: number,
      cursorCol: number,
      blinkOn: boolean,
    ) {
      drawBorder()
      lines.forEach((ln, r) => { if (ln) drawLine(ln, r) })
      if (blinkOn) {
        const { bx, by, cs } = layout()
        ctx.fillStyle = CURSOR_CLR
        ctx.fillRect(bx + cursorCol * cs, by + cursorRow * cs, cs, cs)
      }
      drawScanlines()
    }

    // ── Phase state ───────────────────────────────────────────────────────
    type Phase =
      | 'boot'
      | 'type_load'
      | 'searching'
      | 'type_run'
      | 'demo'
      | 'ready'

    let phase:      Phase  = 'boot'
    let phaseStart: number = 0

    const LOAD_CMD = 'LOAD"*",8,1'
    const RUN_CMD  = 'RUN'
    let typedSoFar = ''

    let demoScene = 0
    let scrollX   = 0

    // ── Authentischer C64-Bootscreen (40×25 Zeichen) ───────────────────────────
    //
    // Originalgetreuer KERNAL-Startbildschirm (PAL/NTSC, wie in VICE und auf echter
    // Hardware). Wichtige Details, recherchiert (siehe Report-Quellen):
    //   - Eine Leerzeile ganz oben (Zeile 0).
    //   - Kopfzeile  '**** COMMODORE 64 BASIC V2 ****'  mit 4 fuehrenden
    //     Leerzeichen, dadurch nahezu mittig im 40-Spalten-Raster.
    //   - Eine Leerzeile.
    //   - RAM-Zeile  ' 64K RAM SYSTEM  38911 BASIC BYTES FREE'  mit EINEM
    //     fuehrenden Leerzeichen und ZWEI Leerzeichen zwischen "SYSTEM" und
    //     "38911" — exakt wie im Original.
    //   - Eine Leerzeile.
    //   - 'READY.' linksbuendig.
    //   - Blinkender Cursor in der Folgezeile.
    // Schrift hell-blau (Periwinkle) auf dunkelblauem Grund mit hellblauem Rand.
    const bootLines: string[] = Array(ROWS).fill('')
    bootLines[0] = ''                                            // Leerzeile oben
    bootLines[1] = '    **** COMMODORE 64 BASIC V2 ****'         // 4 Leerzeichen Einzug
    bootLines[2] = ''                                            // Leerzeile
    bootLines[3] = ' 64K RAM SYSTEM  38911 BASIC BYTES FREE'     // 1 + 2 Leerzeichen
    bootLines[4] = ''                                            // Leerzeile
    bootLines[5] = 'READY.'                                      // linksbuendig

    let screenLines: string[] = [...bootLines]

    function renderScroller(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const charW = Math.max(10, Math.min(20, ch * 0.08))
      scrollX -= 2.0
      const textW = SCROLL_TXT.length * charW
      if (scrollX < -textW) scrollX = W

      const centerY = by + ch * 0.5
      const amplitude = ch * 0.22

      for (let i = 0; i < SCROLL_TXT.length; i++) {
        const cx2 = scrollX + i * charW
        if (cx2 < bx - charW || cx2 > bx + cw) continue
        const cy2 = centerY + Math.sin(i * 0.25 + now / 250) * amplitude - charW / 2
        
        const palIdx = (Math.floor(i + now / 80)) % PAL.length
        const cColor = PAL[Math.max(1, palIdx)]
        
        if (fontLoaded) {
          const char = SCROLL_TXT[i]
          const coords = getCharCoords(char)
          if (coords) {
            // Eingefaerbte Glyphe ueber den gemeinsamen Tint-Pfad zeichnen.
            drawGlyphTinted(coords, cx2, cy2, charW, cColor)
          }
        } else {
          ctx.font = `${charW}px monospace`
          ctx.fillStyle = cColor
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'center'
          ctx.fillText(SCROLL_TXT[i], cx2 + charW / 2, cy2 + charW / 2)
        }
      }

      drawChar('SECTOR-7 PRODUCTIONS  2024', 1, 1, PAL[14])
    }

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

        const col = colors[b % colors.length]
        for (let dy = 0; dy < barH; dy++) {
          const t = Math.sin((dy / barH) * Math.PI)
          ctx.fillStyle = mixColors('#000000', col, t * 0.9)
          ctx.fillRect(bx, Math.round(y + dy), cw, 1)
        }
      }
    }

    function renderPlasma(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      const t = now / 1200

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

    const SPRITE_COUNT = 5
    const sprPhases = Array.from({ length: SPRITE_COUNT }, (_, i) => i * 1.25)
    const sprColors = [PAL[2], PAL[5], PAL[3], PAL[7], PAL[14]]

    function renderSprites(now: number) {
      const { W, H, bx, by, cw, ch } = layout()
      ctx.fillStyle = '#000022'
      ctx.fillRect(0, 0, W, H)

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

        ctx.fillStyle = sprColors[s]
        ctx.beginPath()
        ctx.moveTo(sx,      sy - sz)
        ctx.lineTo(sx + sz, sy)
        ctx.lineTo(sx,      sy + sz)
        ctx.lineTo(sx - sz, sy)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(sx, sy, sz * 0.2, 0, Math.PI * 2)
        ctx.fill()
      }

      drawChar('SPRITE FX  // SECTOR-7', 1, 1, PAL[14])
    }

    function loop(now: number) {
      if (!active) return

      const { W, H } = layout()
      // Bei Null-Groesse einfach diesen Tick ueberspringen; subscribe ruft loop()
      // automatisch beim naechsten Frame erneut auf.
      if (W === 0 || H === 0) return
      if (phaseStart === 0) phaseStart = now

      const elapsed = now - phaseStart
      const blinkOn = Math.floor(now / 530) % 2 === 0

      if (phase === 'boot') {
        // READY. steht in Zeile 5, der Cursor blinkt darunter in Zeile 6.
        renderScreen(screenLines, 6, 0, blinkOn)
        if (elapsed > 2000) {
          phase = 'type_load'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_load') {
        // LOAD-Befehl wird in Zeile 6 (unter READY.) Zeichen fuer Zeichen getippt.
        const charsToType = Math.floor((now - phaseStart) / 180)
        typedSoFar = LOAD_CMD.slice(0, Math.min(charsToType, LOAD_CMD.length))
        const lines = [...screenLines]
        lines[6] = typedSoFar
        renderScreen(lines, 6, typedSoFar.length, blinkOn)

        if (typedSoFar.length >= LOAD_CMD.length && elapsed > LOAD_CMD.length * 180 + 400) {
          phase = 'searching'
          phaseStart = now
          screenLines[6] = LOAD_CMD
          screenLines[7] = ''
          screenLines[8] = 'SEARCHING FOR *'
          screenLines[9] = 'LOADING'
        }

      } else if (phase === 'searching') {
        renderScreen(screenLines, 10, 0, false)
        if (elapsed > 2000) {
          phase = 'type_run'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_run') {
        // RUN-Befehl wird in Zeile 10 getippt.
        const charsToType = Math.floor((now - phaseStart) / 180)
        typedSoFar = RUN_CMD.slice(0, Math.min(charsToType, RUN_CMD.length))
        const lines = [...screenLines]
        lines[10] = typedSoFar
        renderScreen(lines, 10, typedSoFar.length, blinkOn)

        if (typedSoFar.length >= RUN_CMD.length && elapsed > RUN_CMD.length * 180 + 400) {
          phase = 'demo'
          phaseStart = now
          demoScene = 0
          scrollX = W
        }

      } else if (phase === 'demo') {
        const sceneDurs  = [20000, 7000, 7000, 7000]
        const transTime  = 500
        const totalDur   = sceneDurs.reduce((s, d) => s + d + transTime, 0)

        let newScene = 0
        let sceneT   = elapsed
        for (let si = 0; si < sceneDurs.length; si++) {
          const slotDur = sceneDurs[si] + transTime
          if (sceneT < slotDur) { newScene = si; break }
          sceneT -= slotDur
          newScene = (si + 1) % 4
        }
        const sceneDur = sceneDurs[newScene]

        if (newScene !== demoScene) { demoScene = newScene; scrollX = W }

        if (sceneT >= sceneDur) {
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, W, H)
          drawScanlines()
        } else {
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
          // Nach dem Demo-RUN kehrt der C64 mit einem weiteren READY. zurueck.
          // bootLines[5] ist bereits 'READY.'; wir setzen ein zweites READY.
          // in Zeile 7, der Cursor blinkt darunter in Zeile 8.
          screenLines = [...bootLines]
          screenLines[6] = ''
          screenLines[7] = 'READY.'
        }

      } else if (phase === 'ready') {
        renderScreen(screenLines, 8, 0, blinkOn)
        if (elapsed > 2000) {
          phase = 'boot'
          phaseStart = now
          screenLines = [...bootLines]
          typedSoFar = ''
        }
      }

      // Rekursiver rAF-Aufruf entfaellt: subscribe ruft loop() bei jedem Tick.
    }

    unsubscribe = subscribe(loop)

    return () => {
      active = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="C64 // SYSTEM INTRUDE MODE">
      <div ref={containerRef} className="w-full h-full min-h-0 flex items-center justify-center bg-black overflow-hidden">
        {/* imageRendering: pixelated => authentisch grobpixelige Skalierung (Kategorie A) */}
        <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />
      </div>
    </Panel>
  )
}

export default memo(C64Panel);
