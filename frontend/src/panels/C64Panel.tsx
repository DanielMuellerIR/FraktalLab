import { memo,  useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

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
const BORDER_FRAC = 0.10

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
  const g = Math.round(ag + (bg - ar) * t) // mix colors correctly
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

    let active = true
    let rafId  = 0

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

    // ── Bitmap Font setup ────────────────────────────────────────────────────
    const fontImg = new Image()
    fontImg.src = '/c64_font.png'
    let fontLoaded = false
    const colorSheets: HTMLCanvasElement[] = []

    fontImg.onload = () => {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = fontImg.width
      tempCanvas.height = fontImg.height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return
      tempCtx.drawImage(fontImg, 0, 0)
      
      const imgData = tempCtx.getImageData(0, 0, fontImg.width, fontImg.height)
      const data = imgData.data
      
      for (let cIdx = 0; cIdx < PAL.length; cIdx++) {
        const hex = PAL[cIdx]
        const [tr, tg, tb] = hexRgb(hex)
        
        const sheetCanvas = document.createElement('canvas')
        sheetCanvas.width = fontImg.width
        sheetCanvas.height = fontImg.height
        const sheetCtx = sheetCanvas.getContext('2d')
        if (!sheetCtx) continue
        
        const sheetData = new ImageData(fontImg.width, fontImg.height)
        const sData = sheetData.data
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i+1]
          const b = data[i+2]
          
          const val = 0.299 * r + 0.587 * g + 0.114 * b
          if (val > 80) {
            sData[i]   = tr
            sData[i+1] = tg
            sData[i+2] = tb
            sData[i+3] = 255
          } else {
            sData[i]   = 0
            sData[i+1] = 0
            sData[i+2] = 0
            sData[i+3] = 0
          }
        }
        sheetCtx.putImageData(sheetData, 0, 0)
        colorSheets[cIdx] = sheetCanvas
      }
      fontLoaded = true
    }

    function getPaletteIndex(colorHex: string): number {
      const hexUpper = colorHex.toUpperCase()
      const idx = PAL.indexOf(hexUpper)
      if (idx !== -1) return idx
      
      let bestIdx = 14
      let bestDist = Infinity
      
      let tr = 160, tg = 162, tb = 255
      if (colorHex.startsWith('#')) {
        const n = parseInt(colorHex.slice(1), 16)
        tr = (n >> 16) & 0xff
        tg = (n >> 8) & 0xff
        tb = n & 0xff
      } else if (colorHex.startsWith('rgb')) {
        const matches = colorHex.match(/\d+/g)
        if (matches && matches.length >= 3) {
          tr = parseInt(matches[0])
          tg = parseInt(matches[1])
          tb = parseInt(matches[2])
        }
      }
      
      for (let i = 0; i < PAL.length; i++) {
        const [pr, pg, pb] = hexRgb(PAL[i])
        const dist = Math.pow(pr - tr, 2) + Math.pow(pg - tg, 2) + Math.pow(pb - tb, 2)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }
      
      return bestIdx
    }

    function drawChar(text: string, col: number, row: number, color = TEXT_CLR) {
      const { bx, by, cs } = layout()
      
      if (fontLoaded) {
        const cIdx = getPaletteIndex(color)
        const sheet = colorSheets[cIdx]
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          const coords = getCharCoords(char)
          if (!coords) continue
          
          const srcX = 6 + coords.col * 26
          const srcY = 6 + coords.row * 26
          
          const destX = bx + col * cs + i * cs
          const destY = by + row * cs
          
          ctx.drawImage(sheet, srcX, srcY, 24, 24, destX, destY, cs, cs)
        }
      } else {
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

    const bootLines: string[] = Array(ROWS).fill('')
    bootLines[1] = '    **** COMMODORE 64 BASIC V2 ****'
    bootLines[2] = ' 64K RAM SYSTEM  38911 BASIC BYTES FREE'
    bootLines[3] = ''
    bootLines[4] = 'READY.'

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
          const cIdx = getPaletteIndex(cColor)
          const sheet = colorSheets[cIdx]
          const char = SCROLL_TXT[i]
          const coords = getCharCoords(char)
          if (coords) {
            const srcX = 6 + coords.col * 26
            const srcY = 6 + coords.row * 26
            ctx.drawImage(sheet, srcX, srcY, 24, 24, cx2, cy2, charW, charW)
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
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(loop); return }
      if (phaseStart === 0) phaseStart = now

      const elapsed = now - phaseStart
      const blinkOn = Math.floor(now / 530) % 2 === 0

      if (phase === 'boot') {
        renderScreen(screenLines, 5, 0, blinkOn)
        if (elapsed > 2000) {
          phase = 'type_load'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_load') {
        const charsToType = Math.floor((now - phaseStart) / 180)
        typedSoFar = LOAD_CMD.slice(0, Math.min(charsToType, LOAD_CMD.length))
        const lines = [...screenLines]
        lines[5] = typedSoFar
        renderScreen(lines, 5, typedSoFar.length, blinkOn)

        if (typedSoFar.length >= LOAD_CMD.length && elapsed > LOAD_CMD.length * 180 + 400) {
          phase = 'searching'
          phaseStart = now
          screenLines[5] = LOAD_CMD
          screenLines[6] = ''
          screenLines[7] = 'SEARCHING FOR *'
          screenLines[8] = 'LOADING'
        }

      } else if (phase === 'searching') {
        renderScreen(screenLines, 9, 0, false)
        if (elapsed > 2000) {
          phase = 'type_run'
          phaseStart = now
          typedSoFar = ''
        }

      } else if (phase === 'type_run') {
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
          screenLines = [...bootLines]
          screenLines[5] = ''
          screenLines[6] = 'READY.'
        }

      } else if (phase === 'ready') {
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
      <div ref={containerRef} className="w-full h-full min-h-0 flex items-center justify-center bg-black overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
    </Panel>
  )
}

export default memo(C64Panel);
