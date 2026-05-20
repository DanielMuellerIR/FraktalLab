import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ─────────────────────────────────────────────────────────────────────────────
// C64Panel: Simuliert einen Commodore-64-Boot-Vorgang, ein Band-Lade-Flackern,
// und klassische Demoscene-Effekte in C64-Palette — endlose Schleife.
// ─────────────────────────────────────────────────────────────────────────────

// ── C64-Systemfarben (16 Einträge, originalgetreue Hex-Werte) ─────────────────
const C64_PALETTE: string[] = [
  '#000000', // 0 Schwarz
  '#FFFFFF', // 1 Weiß
  '#883932', // 2 Rot
  '#67B6BD', // 3 Cyan
  '#8B3F96', // 4 Lila
  '#55A049', // 5 Grün
  '#40318D', // 6 Blau
  '#BFCE72', // 7 Gelb
  '#8B5429', // 8 Orange
  '#574200', // 9 Braun
  '#B86962', // 10 Hellrot
  '#505050', // 11 Dunkelgrau
  '#787878', // 12 Mittelgrau
  '#94E089', // 13 Hellgrün
  '#7869C4', // 14 Hellblau
  '#9F9F9F', // 15 Hellgrau
]

// ── Farben für den C64-BASIC-Bildschirm ──────────────────────────────────────
const C64_BORDER  = '#4040FF'  // Schattierung des typischen C64-Blautons
const C64_BG      = '#4040FF'  // Hintergrund in BASIC-Mode
const C64_TEXT    = '#FFFFFF'  // Weißer Text

// ── Boot-Text-Zeilen ─────────────────────────────────────────────────────────
const BOOT_LINES = [
  '**** COMMODORE 64 BASIC V2 ****',
  '',
  ' 64K RAM SYSTEM  38911 BASIC BYTES FREE',
  '',
  'READY.',
]

// ── Demoscene-Texte ───────────────────────────────────────────────────────────
const SCROLLER_TEXT =
  '*** GREETINGS FROM SECTOR-7 ***   FRAKTALLAB PRESENTS   ***   KEEP IT REAL, KEEP IT 8-BIT   ***   '

// ── Hilfsfunktion: RGB-String für ein Palette-Tupel ──────────────────────────
function palRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

// ─────────────────────────────────────────────────────────────────────────────
export default function C64Panel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const _canvas   = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return
    const _ctx = _canvas.getContext('2d')
    if (!_ctx) return

    // TypeScript-Closure-Fix: lokale Konstanten statt Refs in Closures
    const canvas: HTMLCanvasElement        = _canvas
    const ctx:    CanvasRenderingContext2D = _ctx

    let rafId: number
    let alive  = true

    // ── Canvas-Größe dynamisch anpassen ─────────────────────────────────────
    const resize = () => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Phasen-Zustand ───────────────────────────────────────────────────────
    // phase: 'boot' | 'load' | 'demo' | 'ready'
    type Phase = 'boot' | 'load' | 'demo' | 'ready'
    let phase: Phase = 'boot'
    let phaseStart   = 0          // Timestamp (ms) des Phasen-Starts

    // ── Phase 1: Boot — getippter Text ──────────────────────────────────────
    let bootLinesDone    = false  // Wurden alle BOOT_LINES gezeichnet?
    let typingText       = ''     // Aktuell eingetippter String (LOAD-Befehl)
    let typingTarget     = ''     // Vollständiger Ziel-String
    let typingIdx        = 0      // Wie viele Zeichen bisher getipt
    let typingNextMs     = 0      // Wann kommt das nächste Zeichen?
    let bootSubStage     = 0      // Sub-Zustand innerhalb der Boot-Phase
    //   0: BOOT_LINES anzeigen
    //   1: LOAD-Befehl tippen
    //   2: SEARCHING FOR * anzeigen + Pause
    //   3: LOADING mit Punkten

    let loadingDots       = 0     // 0..3 — Anzahl Punkte hinter LOADING
    let loadingNextMs     = 0     // Wann kommt der nächste Punkt?
    let searchPauseMs     = 0     // Wann endet die Pause nach SEARCHING?
    let loadingLoops      = 0     // Wie oft hat LOADING. schon geloopt?

    // ── Phase 2: Lade-Flackern ───────────────────────────────────────────────
    let flickerColor  = '#000000'  // Aktuelle Hintergrundfarbe beim Flackern
    let flickerNextMs = 0          // Wann kommt der nächste Farbwechsel?

    // ── Phase 3: Demo-Szenen ─────────────────────────────────────────────────
    let demoScene     = 0          // 0..3 — aktueller Effekt
    let sceneStart    = 0          // Timestamp des Szenen-Starts
    let blackoutUntil = 0          // Bis wann bleibt der Screen schwarz (Übergang)?

    // Sinus-Scroller
    let scrollX       = 0          // Aktuelle X-Position des Text-Starts (wandert nach links)
    const scrollSpeed = 90         // Pixel/Sekunde

    // Rasterbars — 6 Balken, jeder mit einer Phase
    const barCount  = 6
    const barPhases = Array.from({ length: barCount }, (_, i) => i * (Math.PI * 2 / barCount))
    const barColors = [4, 6, 5, 8, 3, 14]  // Palette-Indizes

    // Plasma — Offset für Zeitanimation
    let plasmaT   = 0

    // Sprites — 4 Objekte auf Sinus-Bahnen
    const spriteCount = 4
    const spritePhases = Array.from({ length: spriteCount }, (_, i) => i * (Math.PI / 2))
    const spriteColors = [7, 13, 10, 3]  // Gelb, Hellgrün, Hellrot, Cyan

    // ── Phase 4: Ready-Screen ────────────────────────────────────────────────
    let cursorBlink  = false   // Sichtbarer Cursor?
    let cursorNextMs = 0       // Wann toggelt der Cursor?

    // ── Globale Zeit ─────────────────────────────────────────────────────────
    let lastT = 0

    // ─────────────────────────────────────────────────────────────────────────
    // Zeichnet den blauen C64-BASIC-Hintergrund mit Rahmen
    // ─────────────────────────────────────────────────────────────────────────
    function drawC64Bg() {
      const W = canvas.width
      const H = canvas.height

      // Äußerer Rahmen (C64-Blau)
      ctx.fillStyle = C64_BORDER
      ctx.fillRect(0, 0, W, H)

      // Innerer Textbereich (etwas kleinerer Rahmen — Randbreite ~5%)
      const margin = Math.round(Math.min(W, H) * 0.05)
      ctx.fillStyle = C64_BG
      ctx.fillRect(margin, margin, W - margin * 2, H - margin * 2)

      return { margin }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Zeichnet Text im C64-Stil (weiß auf blau, kleine Monospace-Schrift)
    // x, y in Pixel ab oberer linker Ecke des Textbereichs
    // ─────────────────────────────────────────────────────────────────────────
    function drawC64Text(text: string, col: number, row: number, margin: number) {
      const H  = canvas.height
      // Schriftgröße skaliert mit Canvas-Größe, minimal 8px, maximal 14px
      const fSize = Math.max(8, Math.min(14, Math.round(H * 0.032)))
      const lineH = fSize + 2   // Zeilenhöhe mit minimalem Abstand

      ctx.font         = `${fSize}px monospace`
      ctx.fillStyle    = C64_TEXT
      ctx.textBaseline = 'top'

      const x = margin + col * fSize * 0.6 + 2   // Monospace-Zeichenbreite ~60% der Höhe
      const y = margin + row * lineH + 2
      ctx.fillText(text, x, y)

      return { fSize, lineH }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: Boot-Screen
    // ─────────────────────────────────────────────────────────────────────────
    function renderBoot(now: number) {
      const H = canvas.height
      const { margin } = drawC64Bg()

      const fSize = Math.max(8, Math.min(14, Math.round(H * 0.032)))
      const lineH = fSize + 2

      // Sub-Stage 0: Alle BOOT_LINES auf einmal anzeigen (kein Tippen, erscheinen sofort)
      if (bootSubStage === 0) {
        // Alle Zeilen rendern
        for (let i = 0; i < BOOT_LINES.length; i++) {
          drawC64Text(BOOT_LINES[i], 0, i, margin)
        }
        // Jetzt Sub-Stage 1 einleiten: LOAD-Befehl tippen
        bootSubStage  = 1
        typingTarget  = 'LOAD "*",8,1'
        typingIdx     = 0
        typingText    = ''
        typingNextMs  = now + 400  // kurze Pause nach READY. bevor getippt wird
        bootLinesDone = true
      }

      // Zeilen immer zeichnen (bleiben stehen)
      if (bootLinesDone) {
        for (let i = 0; i < BOOT_LINES.length; i++) {
          drawC64Text(BOOT_LINES[i], 0, i, margin)
        }
      }

      const baseRow = BOOT_LINES.length + 1   // Zeile nach READY.

      // Sub-Stage 1: LOAD-Befehl character by character tippen
      if (bootSubStage === 1) {
        if (now >= typingNextMs && typingIdx < typingTarget.length) {
          typingIdx++
          typingText   = typingTarget.slice(0, typingIdx)
          typingNextMs = now + 200   // 200ms pro Zeichen
        }
        drawC64Text(typingText, 0, baseRow, margin)
        // Cursor blinkt am Ende
        const cursorX = margin + typingText.length * fSize * 0.6 + 2
        const cursorY = margin + baseRow * lineH + 2
        if (Math.floor(now / 530) % 2 === 0) {
          ctx.fillStyle = C64_TEXT
          ctx.fillRect(cursorX, cursorY, fSize * 0.6, fSize)
        }

        // Fertig getippt? → kurze Pause, dann Enter (Sub-Stage 2)
        if (typingIdx >= typingTarget.length && now >= typingNextMs) {
          bootSubStage  = 2
          searchPauseMs = now + 600   // 600ms Pause, dann SEARCHING
        }
      }

      // Sub-Stage 2: LOAD-Befehl steht, dann SEARCHING FOR * erscheint
      if (bootSubStage >= 2) {
        drawC64Text(typingTarget, 0, baseRow, margin)

        if (now >= searchPauseMs) {
          drawC64Text('SEARCHING FOR *', 0, baseRow + 1, margin)

          // 800ms nach SEARCHING → Sub-Stage 3 (LOADING mit Punkten)
          if (bootSubStage === 2 && now >= searchPauseMs + 800) {
            bootSubStage  = 3
            loadingDots   = 0
            loadingLoops  = 0
            loadingNextMs = now + 400
          }
        }
      }

      // Sub-Stage 3: LOADING. LOADING.. LOADING...
      if (bootSubStage === 3) {
        drawC64Text('SEARCHING FOR *', 0, baseRow + 1, margin)

        const dots = '.'.repeat(loadingDots)
        drawC64Text(`LOADING${dots}`, 0, baseRow + 2, margin)

        if (now >= loadingNextMs) {
          loadingDots++
          if (loadingDots > 3) {
            loadingDots  = 0
            loadingLoops++
          }
          loadingNextMs = now + 380

          // Nach 3–4 vollständigen Loops → Phase 2 (Flackern)
          if (loadingLoops >= 3) {
            startPhase('load', now)
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: Lade-Flackern (C64-Kassette)
    // ─────────────────────────────────────────────────────────────────────────
    function renderLoad(now: number) {
      const W = canvas.width
      const H = canvas.height

      // Hintergrundfarbe wechseln
      if (now >= flickerNextMs) {
        flickerColor  = C64_PALETTE[Math.floor(Math.random() * C64_PALETTE.length)]
        flickerNextMs = now + 40 + Math.random() * 30  // 40–70ms

        // Gelegentlich: Streifen oder Blöcke überlagern
      }

      ctx.fillStyle = flickerColor
      ctx.fillRect(0, 0, W, H)

      // Zufällige Streifen (60% Wahrscheinlichkeit pro Frame)
      if (Math.random() < 0.6) {
        const stripeH  = Math.floor(H * (0.05 + Math.random() * 0.25))
        const stripeY  = Math.floor(Math.random() * (H - stripeH))
        const stripePal = C64_PALETTE[Math.floor(Math.random() * C64_PALETTE.length)]
        ctx.fillStyle  = stripePal
        ctx.fillRect(0, stripeY, W, stripeH)
      }

      // Zufällige Blöcke (40% Wahrscheinlichkeit)
      if (Math.random() < 0.4) {
        const bW   = Math.floor(W * (0.1 + Math.random() * 0.5))
        const bH   = Math.floor(H * (0.05 + Math.random() * 0.2))
        const bX   = Math.floor(Math.random() * (W - bW))
        const bY   = Math.floor(Math.random() * (H - bH))
        const bPal = C64_PALETTE[Math.floor(Math.random() * C64_PALETTE.length)]
        ctx.fillStyle = bPal
        ctx.fillRect(bX, bY, bW, bH)
      }

      // Nach 3s → Phase 3 (Demo)
      if (now - phaseStart >= 3000) {
        demoScene  = 0
        sceneStart = now
        startPhase('demo', now)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: Demo-Szenen
    // ─────────────────────────────────────────────────────────────────────────
    function renderDemo(now: number, dt: number) {
      const W = canvas.width
      const H = canvas.height

      // Übergang: kurzer schwarzer Screen zwischen Szenen (0.5s)
      if (now < blackoutUntil) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, W, H)
        return
      }

      const sceneAge = (now - sceneStart) / 1000   // Sekunden seit Szenenstart

      // Alle 7s nächste Szene
      if (sceneAge >= 7) {
        demoScene   = (demoScene + 1) % 4
        sceneStart  = now
        blackoutUntil = now + 500
        // Gesamte Demo-Phase: 4 Szenen à 7s + Übergangs-Blacks → ~30s
        // Nach 4 Szenen → Phase 4 (Ready)
        if (demoScene === 0) {
          startPhase('ready', now)
          return
        }
      }

      switch (demoScene) {
        case 0: renderSinusScroller(now, dt, W, H, sceneAge); break
        case 1: renderRasterbars(now, W, H, sceneAge);        break
        case 2: renderPlasma(dt, W, H);                       break
        case 3: renderSprites(now, W, H, sceneAge);           break
      }
    }

    // ── Effekt 0: Sinus-Scroller ──────────────────────────────────────────────
    function renderSinusScroller(now: number, dt: number, W: number, H: number, _age: number) {
      // Hintergrund
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Text scrollt nach links, Y-Position = Sinus-Welle
      scrollX -= scrollSpeed * dt
      if (scrollX < -W * 2) scrollX += W * 3  // Rewind wenn weit links raus

      const fSize = Math.max(12, Math.min(22, Math.round(H * 0.08)))
      ctx.font = `bold ${fSize}px monospace`
      ctx.textBaseline = 'middle'

      // Zeichne den Scroller-Text in C64-Gelb auf schwarzem Grund
      const fullText   = SCROLLER_TEXT + SCROLLER_TEXT  // Doppelt für nahtlosen Loop
      const charWidth  = fSize * 0.62

      // Jedes Zeichen einzeln zeichnen (eigene Sinus-Position pro Zeichen)
      for (let i = 0; i < fullText.length; i++) {
        const cx = scrollX + i * charWidth
        if (cx < -charWidth || cx > W + charWidth) continue  // außerhalb → skip

        // Y-Sinus: Amplitude = 25% der Canvas-Höhe, Frequenz lässt sich über i staffeln
        const sineY = H * 0.5 + Math.sin(now / 600 + i * 0.35) * H * 0.25

        // Farbwechsel über die Zeit: wechselt durch Palette
        const palIdx = (Math.floor(i * 0.3 + now / 200)) % C64_PALETTE.length
        ctx.fillStyle = C64_PALETTE[palIdx]

        ctx.fillText(fullText[i], cx, sineY)
      }

      // Titel oben
      ctx.font      = `${Math.max(8, Math.round(H * 0.04))}px monospace`
      ctx.fillStyle = C64_PALETTE[15]
      ctx.textBaseline = 'top'
      ctx.fillText('SECTOR-7 PRODUCTIONS', 4, 4)
    }

    // ── Effekt 1: Rasterbars ──────────────────────────────────────────────────
    function renderRasterbars(now: number, W: number, H: number, _age: number) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const barH = Math.round(H * 0.08)   // Höhe eines Balkens

      for (let b = 0; b < barCount; b++) {
        // Y-Position des Balkens: sinusförmige Bewegung
        const phase = barPhases[b] + now / 700
        const cy    = H * 0.5 + Math.sin(phase) * H * 0.38

        // Weicher Übergang: helle Mitte, dunkle Ränder
        const palHex = C64_PALETTE[barColors[b]]
        const [r, g, bv] = palRgb(palHex)

        // Gradient über die Balkenhöhe
        const grad = ctx.createLinearGradient(0, cy - barH, 0, cy + barH)
        grad.addColorStop(0,   `rgba(${r},${g},${bv},0)`)
        grad.addColorStop(0.3, `rgba(${r},${g},${bv},0.6)`)
        grad.addColorStop(0.5, `rgba(${r},${g},${bv},1)`)
        grad.addColorStop(0.7, `rgba(${r},${g},${bv},0.6)`)
        grad.addColorStop(1,   `rgba(${r},${g},${bv},0)`)

        ctx.fillStyle = grad
        ctx.fillRect(0, cy - barH, W, barH * 2)
      }

      // Text-Overlay
      ctx.font = `${Math.max(9, Math.round(H * 0.045))}px monospace`
      ctx.fillStyle = C64_PALETTE[1]
      ctx.textBaseline = 'top'
      ctx.fillText('RASTERBARS V2.1', 4, 4)
    }

    // ── Effekt 2: Plasma in C64-Palette ──────────────────────────────────────
    function renderPlasma(dt: number, W: number, H: number) {
      plasmaT += dt * 1.8   // Zeitfortschritt

      // Wir arbeiten mit getImageData für Pixel-Operationen (schnell)
      const imgData = ctx.createImageData(W, H)
      const data    = imgData.data

      // Blockgröße: je nach Canvas-Größe — nicht zu winzig
      const block = Math.max(4, Math.round(Math.min(W, H) / 40))

      for (let y = 0; y < H; y += block) {
        for (let x = 0; x < W; x += block) {
          // Plasma-Formel: Überlagerung mehrerer Sinuswellen
          const nx  = x / W
          const ny  = y / H
          const v   =
            Math.sin(nx * 8 + plasmaT) +
            Math.sin(ny * 6 + plasmaT * 0.7) +
            Math.sin((nx + ny) * 5 + plasmaT * 1.3) +
            Math.sin(Math.sqrt(nx * nx + ny * ny) * 9 + plasmaT)

          // Normalisieren auf 0..1
          const norm     = (v + 4) / 8
          // C64-Palette-Index: 0..15
          const palIdx   = Math.floor(norm * 15.99) & 15
          const hex      = C64_PALETTE[palIdx]
          const [r, g, bv] = palRgb(hex)

          // Block füllen
          for (let by = 0; by < block && y + by < H; by++) {
            for (let bx = 0; bx < block && x + bx < W; bx++) {
              const i = ((y + by) * W + (x + bx)) * 4
              data[i]     = r
              data[i + 1] = g
              data[i + 2] = bv
              data[i + 3] = 255
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0)

      // Titel-Text über das Plasma
      ctx.font = `${Math.max(9, Math.round(H * 0.045))}px monospace`
      ctx.fillStyle = '#000000'
      ctx.textBaseline = 'top'
      ctx.fillText('C64 PLASMA FX', 6, 6)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText('C64 PLASMA FX', 5, 5)
    }

    // ── Effekt 3: Sprites auf Sinus-Bahnen ───────────────────────────────────
    function renderSprites(now: number, W: number, H: number, _age: number) {
      ctx.fillStyle = '#000022'
      ctx.fillRect(0, 0, W, H)

      const spriteSize = Math.max(10, Math.round(Math.min(W, H) * 0.07))

      for (let s = 0; s < spriteCount; s++) {
        const phase  = spritePhases[s] + now / 800
        const phase2 = spritePhases[s] * 1.7 + now / 540

        // X: gleichmäßige Positionierung + horizontale Sinus-Schwingung
        const baseX = W * (0.15 + s * 0.22)
        const cx    = baseX + Math.sin(phase2) * W * 0.08
        // Y: Sinus-Bahn mit verschiedener Frequenz
        const cy    = H * 0.5 + Math.sin(phase) * H * 0.35

        const palHex = C64_PALETTE[spriteColors[s]]
        ctx.fillStyle = palHex

        // Sprite-Form: Raute (Diamond)
        ctx.beginPath()
        ctx.moveTo(cx,               cy - spriteSize)   // Oben
        ctx.lineTo(cx + spriteSize,  cy)                // Rechts
        ctx.lineTo(cx,               cy + spriteSize)   // Unten
        ctx.lineTo(cx - spriteSize,  cy)                // Links
        ctx.closePath()
        ctx.fill()

        // Inneres kleines Quadrat (Sprite-Detail)
        const inner = spriteSize * 0.4
        ctx.fillStyle = C64_PALETTE[1]
        ctx.beginPath()
        ctx.moveTo(cx,          cy - inner)
        ctx.lineTo(cx + inner,  cy)
        ctx.lineTo(cx,          cy + inner)
        ctx.lineTo(cx - inner,  cy)
        ctx.closePath()
        ctx.fill()

        // Nachleucht-Schweif
        const trailLen = 5
        for (let t = 1; t <= trailLen; t++) {
          const alpha  = (1 - t / trailLen) * 0.4
          const trailX = cx - Math.cos(phase2 + 0.1 * t) * t * 4
          const trailY = cy - Math.sin(phase  + 0.1 * t) * t * 4
          const ts     = spriteSize * (1 - t / (trailLen + 1)) * 0.6
          const [r, g, bv] = palRgb(palHex)
          ctx.fillStyle = `rgba(${r},${g},${bv},${alpha})`
          ctx.beginPath()
          ctx.moveTo(trailX,      trailY - ts)
          ctx.lineTo(trailX + ts, trailY)
          ctx.lineTo(trailX,      trailY + ts)
          ctx.lineTo(trailX - ts, trailY)
          ctx.closePath()
          ctx.fill()
        }
      }

      // Sterne im Hintergrund (statisch, basierend auf deterministischen Pseudorandom-Werten)
      ctx.fillStyle = C64_PALETTE[1]
      for (let i = 0; i < 40; i++) {
        // Deterministisch, damit sie nicht flackern: sin/cos als "Pseudorandom"
        const sx = ((Math.sin(i * 137.5) + 1) / 2) * W
        const sy = ((Math.cos(i * 193.3) + 1) / 2) * H
        const sr = 0.8 + ((Math.sin(i * 79.1) + 1) / 2) * 1.5
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.font = `${Math.max(9, Math.round(H * 0.045))}px monospace`
      ctx.fillStyle = C64_PALETTE[7]   // Gelb
      ctx.textBaseline = 'top'
      ctx.fillText('SPRITE MULTIPLEXER', 4, 4)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4: Ready-Screen mit blinkendem Cursor
    // ─────────────────────────────────────────────────────────────────────────
    function renderReady(now: number) {
      const { margin } = drawC64Bg()

      // Cursor toggeln
      if (now >= cursorNextMs) {
        cursorBlink  = !cursorBlink
        cursorNextMs = now + 530   // 530ms Blink-Intervall (klassisches C64-Timing)
      }

      drawC64Text('READY.', 0, 0, margin)

      if (cursorBlink) {
        const H     = canvas.height
        const fSize = Math.max(8, Math.min(14, Math.round(H * 0.032)))
        const lineH = fSize + 2
        const x     = margin + 2
        const y     = margin + lineH + 2   // Zeile 1 (nach READY.)
        ctx.fillStyle = C64_TEXT
        ctx.fillRect(x, y, fSize * 0.6, fSize)
      }

      // Nach 2s → zurück zu Phase 1 (Boot)
      if (now - phaseStart >= 2000) {
        // Reset Boot-Zustand
        bootSubStage  = 0
        bootLinesDone = false
        typingText    = ''
        typingTarget  = ''
        typingIdx     = 0
        startPhase('boot', now)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phasen-Wechsel mit Reset
    // ─────────────────────────────────────────────────────────────────────────
    function startPhase(p: Phase, now: number) {
      phase      = p
      phaseStart = now
      if (p === 'load') {
        flickerNextMs = now
      }
      if (p === 'demo') {
        // Erste Demo-Szene direkt starten, kein Übergang
        blackoutUntil = 0
        sceneStart    = now
        scrollX       = canvas.width   // Scroller startet rechts außerhalb
        plasmaT       = 0
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Haupt-Loop
    // ─────────────────────────────────────────────────────────────────────────
    function loop(t: number) {
      if (!alive) return

      const dt = Math.min((t - lastT) / 1000, 0.05)   // Delta-Zeit in Sekunden
      lastT    = t

      switch (phase) {
        case 'boot':  renderBoot(t);          break
        case 'load':  renderLoad(t);          break
        case 'demo':  renderDemo(t, dt);      break
        case 'ready': renderReady(t);         break
      }

      rafId = requestAnimationFrame(loop)
    }

    // ── Starten ───────────────────────────────────────────────────────────────
    rafId = requestAnimationFrame((t) => {
      lastT      = t
      phaseStart = t
      bootSubStage  = 0
      bootLinesDone = false
      loop(t)
    })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="C64 // SYSTEM INTRUDE MODE">
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Panel>
  )
}
