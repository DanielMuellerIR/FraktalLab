import { memo, useEffect, useRef, useState } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

// Slideshow klassischer Betriebssystem-Fehlermeldungen — alles prozedural auf Canvas 2D.
// Frame-Loop laeuft ueber den zentralen raf-coordinator (siehe AUDIT_FINDINGS.md H-05),
// damit alle Panels denselben requestAnimationFrame-Tick teilen.

type Screen = {
  duration: number
  render: (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, age: number) => void
  // Klartext-Fassung des im Canvas gezeichneten Fehlertextes.
  // Wird zusaetzlich als unsichtbares DOM-Overlay ueber den Canvas gelegt,
  // damit der Text mit der Maus markiert und kopiert werden kann (Canvas-Pixel
  // sind nicht selektierbar). Inhalt deckt sich Zeile fuer Zeile mit dem,
  // was render() malt — bei Aenderungen am Canvas-Text bitte hier mitpflegen.
  text: string
}

// Hilfsfunktion: Rechteck mit abgerundeten Ecken zeichnen
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Hilfsfunktion: mehrzeiliger Text mit automatischem Umbruch
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxW: number, lineH: number,
): number {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      ctx.fillText(line, x, cy)
      line = word + ' '
      cy += lineH
    } else {
      line = test
    }
  }
  if (line.trim().length > 0) { ctx.fillText(line, x, cy); cy += lineH }
  return cy
}

const SCREENS: Screen[] = [
  // ── 1. Mac System 7 Bomb ──────────────────────────────────────────────────
  {
    duration: 7000,
    text:
      'Sorry, a system error occurred.\n' +
      'Error Type: ID=28  Stack Overflow\n' +
      'The application "HyperCard 2.0"\n' +
      'has unexpectedly quit.\n' +
      '\n' +
      'Resume    Restart',
    render(ctx, W, H, _t, _age) {
      // Weiß-grauer Hintergrund
      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(0, 0, W, H)

      // Dialog-Fenster
      const dw = Math.min(W * 0.7, 340)
      const dh = Math.min(H * 0.55, 160)
      const dx = (W - dw) / 2
      const dy = (H - dh) / 2

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(dx, dy, dw, dh)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.strokeRect(dx, dy, dw, dh)

      // Titelbalken (schwarz, flach wie Mac System 7)
      const tbH = Math.round(dh * 0.15)
      ctx.fillStyle = '#000000'
      ctx.fillRect(dx, dy, dw, tbH)

      // Streifen im Titelbalken
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      const stripes = 6
      for (let i = 0; i < stripes; i++) {
        const ty = dy + 2 + i * Math.floor(tbH / stripes)
        ctx.beginPath()
        ctx.moveTo(dx + 4, ty)
        ctx.lineTo(dx + dw - 4, ty)
        ctx.stroke()
      }

      const fs = Math.max(9, Math.min(13, W * 0.028))
      ctx.font = `bold ${fs}px monospace`
      ctx.fillStyle = '#000000'
      ctx.textBaseline = 'top'

      // Bombe-Icon (links)
      const iconX = dx + 12
      const iconY = dy + tbH + 10
      const iconR = Math.round(dh * 0.14)
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.arc(iconX + iconR, iconY + iconR, iconR, 0, Math.PI * 2)
      ctx.fill()
      // Zündschnur
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(iconX + iconR + iconR * 0.7, iconY)
      ctx.quadraticCurveTo(iconX + iconR + iconR * 1.4, iconY - iconR * 0.8, iconX + iconR + iconR, iconY - iconR * 1.2)
      ctx.stroke()
      // Highlight auf Bombe
      ctx.fillStyle = '#666666'
      ctx.beginPath()
      ctx.arc(iconX + iconR - 3, iconY + iconR - 4, 3, 0, Math.PI * 2)
      ctx.fill()

      // Haupttext
      const tx = dx + iconR * 2 + 20
      const ty2 = dy + tbH + 8
      const fsMed = Math.max(8, Math.min(11, W * 0.024))
      ctx.font = `bold ${fsMed}px monospace`
      ctx.fillStyle = '#000000'
      ctx.fillText('Sorry, a system error occurred.', tx, ty2)
      ctx.font = `${fsMed}px monospace`
      ctx.fillText('Error Type: ID=28  Stack Overflow', tx, ty2 + fsMed + 4)
      ctx.fillText('The application "HyperCard 2.0"', tx, ty2 + (fsMed + 4) * 2)
      ctx.fillText('has unexpectedly quit.', tx, ty2 + (fsMed + 4) * 3)

      // Buttons (Resume / Restart)
      const btnW = Math.round(dw * 0.28)
      const btnH = Math.round(dh * 0.18)
      const btnY = dy + dh - btnH - 10
      const btn1X = dx + dw / 2 - btnW - 10
      const btn2X = dx + dw / 2 + 10

      for (const [bx, label] of [[btn1X, 'Resume'], [btn2X, 'Restart']] as [number, string][]) {
        ctx.fillStyle = '#cccccc'
        ctx.fillRect(bx, btnY, btnW, btnH)
        // 3D-Schatten
        ctx.strokeStyle = '#888888'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(bx + btnW, btnY); ctx.lineTo(bx + btnW, btnY + btnH); ctx.lineTo(bx, btnY + btnH)
        ctx.stroke()
        ctx.strokeStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(bx, btnY + btnH); ctx.lineTo(bx, btnY); ctx.lineTo(bx + btnW, btnY)
        ctx.stroke()
        ctx.strokeStyle = '#000000'
        ctx.strokeRect(bx, btnY, btnW, btnH)
        ctx.fillStyle = '#000000'
        ctx.font = `${fsMed}px monospace`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(label, bx + btnW / 2, btnY + btnH / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
      }
    },
  },

  // ── 2. Windows 95 BSOD ───────────────────────────────────────────────────
  {
    duration: 8000,
    text:
      '  Windows\n' +
      '\n' +
      'A fatal exception 0E has occurred at 0028:C001F34D in\n' +
      'VXD VPICD(01) + 000012A0. The current application will\n' +
      'be terminated.\n' +
      '\n' +
      '*  Press any key to terminate the current application.\n' +
      '*  Press CTRL+ALT+DEL to restart your computer. You\n' +
      '   will lose any unsaved information in all applications.\n' +
      '\n' +
      '\n' +
      '   Press any key to continue _',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#0000aa'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(8, Math.min(12, W * 0.025))
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#aaaaaa'
      ctx.textBaseline = 'top'

      const pad = Math.round(W * 0.06)
      const lineH = fs + 4
      let y = Math.round(H * 0.08)

      const lines = [
        '  Windows',
        '',
        'A fatal exception 0E has occurred at 0028:C001F34D in',
        'VXD VPICD(01) + 000012A0. The current application will',
        'be terminated.',
        '',
        '*  Press any key to terminate the current application.',
        '*  Press CTRL+ALT+DEL to restart your computer. You',
        '   will lose any unsaved information in all applications.',
        '',
        '',
        '   Press any key to continue _',
      ]

      // Trennlinie oben
      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(pad, y - 4, W - pad * 2, 1)
      y += 4

      for (const ln of lines) {
        if (ln === '  Windows') {
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${fs}px monospace`
          ctx.fillText(ln, pad, y)
          ctx.font = `${fs}px monospace`
          ctx.fillStyle = '#aaaaaa'
        } else if (ln.startsWith('*')) {
          ctx.fillStyle = '#ffffff'
          ctx.fillText(ln, pad, y)
          ctx.fillStyle = '#aaaaaa'
        } else if (ln.endsWith('_')) {
          // Blinkender Cursor
          const blink = Math.floor(t / 530) % 2 === 0
          ctx.fillText(blink ? ln : ln.slice(0, -1), pad, y)
        } else {
          ctx.fillText(ln, pad, y)
        }
        y += lineH
      }

      // Trennlinie unten
      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(pad, y + 4, W - pad * 2, 1)
    },
  },

  // ── 3. Amiga Guru Meditation ──────────────────────────────────────────────
  {
    duration: 6000,
    text:
      'Software Failure. Press left mouse button to continue.\n' +
      'Guru Meditation #00000003.00C01F04',
    render(ctx, W, H, t, _age) {
      // Grauer Workbench-Hintergrund
      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(0, 0, W, H)

      // Horizontale Streifen (Workbench-Muster)
      ctx.fillStyle = '#999999'
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2)

      // Guru-Rahmen
      const bw = Math.min(W * 0.85, 360)
      const bh = Math.round(H * 0.22)
      const bx = (W - bw) / 2
      const by = (H - bh) / 2

      const blink = Math.floor(t / 600) % 2 === 0
      ctx.fillStyle = blink ? '#dd0000' : '#aa0000'
      ctx.fillRect(bx, by, bw, bh)

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 8)

      ctx.fillStyle = blink ? '#dd0000' : '#aa0000'
      ctx.fillRect(bx + 8, by + 8, bw - 16, bh - 16)

      const fs = Math.max(8, Math.min(12, W * 0.026))
      ctx.font = `bold ${fs}px monospace`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText('Software Failure. Press left mouse button to continue.', W / 2, by + bh / 2 - fs)
      ctx.font = `${fs}px monospace`
      ctx.fillText('Guru Meditation #00000003.00C01F04', W / 2, by + bh / 2 + fs)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
    },
  },

  // ── 4. Windows XP BSOD ───────────────────────────────────────────────────
  {
    duration: 8000,
    text:
      'A problem has been detected and Windows has been shut\n' +
      'down to prevent damage to your computer.\n' +
      '\n' +
      'IRQL_NOT_LESS_OR_EQUAL\n' +
      '\n' +
      "If this is the first time you've seen this stop error screen, restart your computer. If this screen appears again, follow these steps:\n" +
      '\n' +
      'Check to make sure any new hardware or software is properly\n' +
      'installed. If this is a new installation, ask your hardware\n' +
      'or software manufacturer for any Windows updates you might need.\n' +
      '\n' +
      'Technical information:\n' +
      '*** STOP: 0x0000000A (0x00000014, 0x00000002, 0x00000000,\n' +
      '0x804E7B03)\n' +
      '\n' +
      'Collecting data for crash dump ...\n' +
      'Initializing disk for crash dump ...',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#1A3A6A'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(7, Math.min(11, W * 0.022))
      const lineH = fs + 4
      const pad = Math.round(W * 0.07)
      ctx.textBaseline = 'top'

      let y = Math.round(H * 0.06)

      // Titelblock
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${fs + 2}px monospace`
      ctx.fillText('A problem has been detected and Windows has been shut', pad, y); y += lineH + 2
      ctx.fillText('down to prevent damage to your computer.', pad, y); y += lineH * 2

      ctx.font = `bold ${fs + 1}px monospace`
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText('IRQL_NOT_LESS_OR_EQUAL', pad, y); y += lineH * 2

      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#CCDDFF'
      const body = 'If this is the first time you\'ve seen this stop error screen, restart your computer. If this screen appears again, follow these steps:'
      y = wrapText(ctx, body, pad, y, W - pad * 2, lineH) + lineH

      ctx.fillText('Check to make sure any new hardware or software is properly', pad, y); y += lineH
      ctx.fillText('installed. If this is a new installation, ask your hardware', pad, y); y += lineH
      ctx.fillText('or software manufacturer for any Windows updates you might need.', pad, y); y += lineH * 2

      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${fs}px monospace`
      ctx.fillText('Technical information:', pad, y); y += lineH
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#AACCFF'
      ctx.fillText('*** STOP: 0x0000000A (0x00000014, 0x00000002, 0x00000000,', pad, y); y += lineH
      ctx.fillText('0x804E7B03)', pad + fs * 2, y); y += lineH * 2

      // Fortschrittsanzeige
      const pct = Math.min(100, Math.floor(((t % 8000) / 8000) * 100))
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`Collecting data for crash dump ... ${pct}`, pad, y); y += lineH
      ctx.fillText('Initializing disk for crash dump ...', pad, y)
    },
  },

  // ── 5. MS-DOS "Abort, Retry, Fail?" ──────────────────────────────────────
  {
    duration: 6000,
    text:
      'C:\\>DIR A:\n' +
      'Not ready reading drive A\n' +
      'Abort, Retry, Fail?\n' +
      '\n' +
      'Not ready reading drive A\n' +
      'Abort, Retry, Fail? F\n' +
      '\n' +
      'C:\\>_',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(8, Math.min(13, W * 0.028))
      const lineH = fs + 4
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#aaaaaa'
      ctx.textBaseline = 'top'

      const pad = Math.round(W * 0.05)
      let y = Math.round(H * 0.15)

      ctx.fillText('C:\\>DIR A:', pad, y); y += lineH
      ctx.fillText('Not ready reading drive A', pad, y); y += lineH
      ctx.fillText('Abort, Retry, Fail?', pad, y); y += lineH

      const blink = Math.floor(t / 530) % 2 === 0
      if (blink) {
        ctx.fillStyle = '#aaaaaa'
        ctx.fillText('_', pad + ctx.measureText('Abort, Retry, Fail?').width + 4, y - lineH)
      }

      y += lineH * 2
      ctx.fillText('Not ready reading drive A', pad, y); y += lineH
      ctx.fillText('Abort, Retry, Fail? F', pad, y); y += lineH
      ctx.fillText('', pad, y); y += lineH
      ctx.fillText('C:\\>_', pad, y)
    },
  },

  // ── 6. Mac OS X Kernel Panic ──────────────────────────────────────────────
  {
    duration: 7000,
    text:
      'You need to restart your computer.\n' +
      'Hold down the Power button for several seconds\n' +
      'or press the Restart button.\n' +
      '\n' +
      'Si vous voyez ce message, maintenez le bouton de réinitialisation.\n' +
      'Wenn Sie diese Meldung sehen, halten Sie den Ein/Aus-Schalter.\n' +
      'Als u dit bericht ziet, houdt u de aan/uit-knop ingedrukt.\n' +
      '\n' +
      'panic(cpu 0): Unresolved kernel trap (CPU 0)',
    render(ctx, W, H, _t, _age) {
      ctx.fillStyle = '#888888'
      ctx.fillRect(0, 0, W, H)

      // Schwarzes Overlay (gedimmt)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, W, H)

      // Grauer Dialog-Kasten
      const dw = Math.min(W * 0.75, 320)
      const dh = Math.min(H * 0.65, 200)
      const dx = (W - dw) / 2
      const dy = (H - dh) / 2

      // Abgerundeter Kasten
      roundRect(ctx, dx, dy, dw, dh, 10)
      ctx.fillStyle = 'rgba(80,80,80,0.92)'
      ctx.fill()
      ctx.strokeStyle = '#555555'
      ctx.lineWidth = 1
      ctx.stroke()

      const fs = Math.max(7, Math.min(10, W * 0.022))
      const lineH = fs + 3
      const pad = 14
      ctx.textBaseline = 'top'

      let y = dy + pad
      ctx.font = `bold ${fs + 1}px monospace`
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText('You need to restart your computer.', dx + pad, y); y += lineH + 4
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#DDDDDD'
      ctx.fillText('Hold down the Power button for several seconds', dx + pad, y); y += lineH
      ctx.fillText('or press the Restart button.', dx + pad, y); y += lineH * 2

      // Sprachblock
      const langs = [
        'Si vous voyez ce message, maintenez le bouton de réinitialisation.',
        'Wenn Sie diese Meldung sehen, halten Sie den Ein/Aus-Schalter.',
        'Als u dit bericht ziet, houdt u de aan/uit-knop ingedrukt.',
      ]
      ctx.fillStyle = '#AAAAAA'
      ctx.font = `${fs - 1}px monospace`
      for (const l of langs) {
        ctx.fillText(l, dx + pad, y, dw - pad * 2)
        y += lineH
      }

      // Kernel-Text (technisch)
      y += 4
      ctx.fillStyle = '#888888'
      ctx.font = `${fs - 1}px monospace`
      ctx.fillText('panic(cpu 0): Unresolved kernel trap (CPU 0)', dx + pad, y)
    },
  },

  // ── 7. Windows 3.1 GPF ───────────────────────────────────────────────────
  {
    duration: 7000,
    text:
      'Application Error\n' +
      '\n' +
      'WINWORD caused a General Protection Fault\n' +
      'in module KERNEL.EXE at 0001:4A2F.\n' +
      'Choose Close. You will need to restart one\n' +
      'or more applications.\n' +
      '\n' +
      'Close    Details >>',
    render(ctx, W, H, _t, _age) {
      // Windows 3.1 Hintergrundmuster (Teal-Grün)
      ctx.fillStyle = '#008080'
      ctx.fillRect(0, 0, W, H)

      // Dialog-Fenster (grau, flach)
      const dw = Math.min(W * 0.75, 340)
      const dh = Math.min(H * 0.55, 155)
      const dx = (W - dw) / 2
      const dy = (H - dh) / 2

      ctx.fillStyle = '#c0c0c0'
      ctx.fillRect(dx, dy, dw, dh)

      // 3D-Effekt: hell oben-links, dunkel unten-rechts
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(dx + dw, dy); ctx.lineTo(dx, dy); ctx.lineTo(dx, dy + dh)
      ctx.stroke()
      ctx.strokeStyle = '#808080'
      ctx.beginPath()
      ctx.moveTo(dx, dy + dh); ctx.lineTo(dx + dw, dy + dh); ctx.lineTo(dx + dw, dy)
      ctx.stroke()

      // Titelbalken
      const tbH = 18
      ctx.fillStyle = '#000080'
      ctx.fillRect(dx + 2, dy + 2, dw - 4, tbH)

      const fs = Math.max(8, Math.min(11, W * 0.024))
      ctx.font = `bold ${fs}px monospace`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText('Application Error', dx + 8, dy + 2 + tbH / 2)

      // Schließ-Button
      ctx.fillStyle = '#c0c0c0'
      ctx.fillRect(dx + dw - 18, dy + 2, 16, tbH)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.strokeRect(dx + dw - 18, dy + 2, 16, tbH)
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText('X', dx + dw - 10, dy + 2 + tbH / 2)
      ctx.textAlign = 'left'

      // Inhalt
      const body = dy + tbH + 14
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#000000'
      ctx.textBaseline = 'top'
      ctx.fillText('WINWORD caused a General Protection Fault', dx + 10, body)
      ctx.fillText('in module KERNEL.EXE at 0001:4A2F.', dx + 10, body + fs + 3)
      ctx.fillText('Choose Close. You will need to restart one', dx + 10, body + (fs + 3) * 2)
      ctx.fillText('or more applications.', dx + 10, body + (fs + 3) * 3)

      // Buttons
      const btnW = Math.round(dw * 0.24)
      const btnH = 22
      const btnY = dy + dh - btnH - 10
      const labels = ['Close', 'Details >>']
      for (let i = 0; i < labels.length; i++) {
        const bx = dx + 10 + i * (btnW + 8)
        ctx.fillStyle = '#c0c0c0'
        ctx.fillRect(bx, btnY, btnW, btnH)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(bx + btnW, btnY); ctx.lineTo(bx, btnY); ctx.lineTo(bx, btnY + btnH)
        ctx.stroke()
        ctx.strokeStyle = '#808080'
        ctx.beginPath()
        ctx.moveTo(bx, btnY + btnH); ctx.lineTo(bx + btnW, btnY + btnH); ctx.lineTo(bx + btnW, btnY)
        ctx.stroke()
        ctx.strokeStyle = '#000000'
        ctx.strokeRect(bx, btnY, btnW, btnH)
        ctx.fillStyle = '#000000'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(labels[i], bx + btnW / 2, btnY + btnH / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
      }
    },
  },

  // ── 8. Linux Kernel Panic ─────────────────────────────────────────────────
  {
    duration: 7000,
    text:
      'BUG: unable to handle kernel paging request at ffff88000000000\n' +
      'IP: [<ffffffff811234ab>] kmalloc+0x1b/0x130\n' +
      'PGD 1a0b067 PUD 1a0c067 PMD 0\n' +
      'Oops: 0000 [#1] SMP\n' +
      '\n' +
      'CPU: 0 PID: 1234 Comm: systemd Tainted: G   O 3.10.0-1160\n' +
      'RIP: 0010:[<ffffffff811234ab>] [<ffffffff811234ab>]\n' +
      '\n' +
      'Kernel panic - not syncing: Fatal exception in interrupt\n' +
      '\n' +
      'CPU 0 is now offline\n' +
      '---[ end Kernel panic - not syncing: Fatal exception ]---',
    render(ctx, W, H, _t, _age) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(7, Math.min(10, W * 0.02))
      const lineH = fs + 3
      ctx.font = `${fs}px monospace`
      ctx.textBaseline = 'top'

      const pad = Math.round(W * 0.04)
      let y = Math.round(H * 0.04)

      const lines = [
        { text: 'BUG: unable to handle kernel paging request at ffff88000000000', col: '#ff5555' },
        { text: 'IP: [<ffffffff811234ab>] kmalloc+0x1b/0x130', col: '#ffffff' },
        { text: 'PGD 1a0b067 PUD 1a0c067 PMD 0', col: '#aaaaaa' },
        { text: 'Oops: 0000 [#1] SMP', col: '#ffffff' },
        { text: '', col: '#aaaaaa' },
        { text: 'CPU: 0 PID: 1234 Comm: systemd Tainted: G   O 3.10.0-1160', col: '#aaaaaa' },
        { text: 'RIP: 0010:[<ffffffff811234ab>] [<ffffffff811234ab>]', col: '#aaaaaa' },
        { text: '', col: '#aaaaaa' },
        { text: 'Kernel panic - not syncing: Fatal exception in interrupt', col: '#ff5555' },
        { text: '', col: '#aaaaaa' },
        { text: 'CPU 0 is now offline', col: '#ffaa00' },
        { text: '---[ end Kernel panic - not syncing: Fatal exception ]---', col: '#ff5555' },
      ]

      for (const { text, col } of lines) {
        ctx.fillStyle = col
        ctx.fillText(text, pad, y, W - pad * 2)
        y += lineH
      }
    },
  },

  // ── 9. BeOS Kernel Crash ──────────────────────────────────────────────────
  {
    duration: 6000,
    text:
      'BeOS Kernel Debugger\n' +
      'PANIC: vm_page_fault: vm_soft_fault returned error "Bad address"\n' +
      '       for address 0xef202018, ip 0x00000000\n' +
      '\n' +
      'int frame at 0x80f3e980:\n' +
      ' eip: 001e:00000000  flags: 0x00200246\n' +
      ' eax: 00000000  ecx: 003ec074  edx: 003ec064\n' +
      ' cr2: ef202018  cr3: 01e42000\n' +
      '\n' +
      'Stack (0x80f3ea38):\n' +
      '  8011f5d4 003ec000 003ec000 00000000 8011f5c0\n' +
      '\n' +
      'kdebug> _',
    render(ctx, W, H, _t, _age) {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(7, Math.min(10, W * 0.02))
      const lineH = fs + 3
      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#00ff88'
      ctx.textBaseline = 'top'

      const pad = Math.round(W * 0.04)
      let y = Math.round(H * 0.04)

      ctx.font = `bold ${fs + 2}px monospace`
      ctx.fillStyle = '#00ff88'
      ctx.fillText('BeOS Kernel Debugger', pad, y); y += lineH + 4

      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#88ffcc'
      const lines = [
        'PANIC: vm_page_fault: vm_soft_fault returned error "Bad address"',
        '       for address 0xef202018, ip 0x00000000',
        '',
        'int frame at 0x80f3e980:',
        ' eip: 001e:00000000  flags: 0x00200246',
        ' eax: 00000000  ecx: 003ec074  edx: 003ec064',
        ' cr2: ef202018  cr3: 01e42000',
        '',
        'Stack (0x80f3ea38):',
        '  8011f5d4 003ec000 003ec000 00000000 8011f5c0',
        '',
        'kdebug> _',
      ]
      for (const ln of lines) {
        ctx.fillStyle = ln.startsWith('PANIC') ? '#ff8844' : '#88ffcc'
        ctx.fillText(ln, pad, y, W - pad * 2)
        y += lineH
      }
    },
  },

  // ── 10. Windows 98 BSOD (andere Farbe/Layout als 95) ─────────────────────
  {
    duration: 7000,
    text:
      'Windows\n' +
      '\n' +
      'A fatal exception 0D has occurred at 0028:BFF9B8B0 in VXD\n' +
      'VMM(01) + 00009FA6. The current application will be\n' +
      'terminated.\n' +
      '\n' +
      '*  Press any key to terminate the current application.\n' +
      '\n' +
      '*  Press CTRL+ALT+DEL again to restart your computer.\n' +
      '   You will lose any unsaved information.\n' +
      '\n' +
      'Press any key to continue _',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#000080'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(8, Math.min(12, W * 0.025))
      const lineH = fs + 4
      const pad = Math.round(W * 0.07)
      ctx.textBaseline = 'top'
      ctx.font = `${fs}px monospace`

      let y = Math.round(H * 0.06)

      // Titelleiste
      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(pad, y, W - pad * 2, 2)
      y += 10

      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${fs + 1}px monospace`
      ctx.fillText('Windows', pad, y); y += lineH + 4

      ctx.font = `${fs}px monospace`
      ctx.fillStyle = '#aaaaaa'
      const lines = [
        'A fatal exception 0D has occurred at 0028:BFF9B8B0 in VXD',
        'VMM(01) + 00009FA6. The current application will be',
        'terminated.',
        '',
        '*  Press any key to terminate the current application.',
        '',
        '*  Press CTRL+ALT+DEL again to restart your computer.',
        '   You will lose any unsaved information.',
        '',
      ]
      for (const ln of lines) {
        if (ln.startsWith('*')) {
          ctx.fillStyle = '#ffffff'
          ctx.fillText(ln, pad, y)
          ctx.fillStyle = '#aaaaaa'
        } else {
          ctx.fillText(ln, pad, y)
        }
        y += lineH
      }

      const blink = Math.floor(t / 600) % 2 === 0
      ctx.fillStyle = '#aaaaaa'
      ctx.fillText(blink ? 'Press any key to continue _' : 'Press any key to continue', pad, y)

      ctx.fillStyle = '#aaaaaa'
      ctx.fillRect(pad, H - Math.round(H * 0.08), W - pad * 2, 2)
    },
  },

  // ── 11. Windows 10/11 BSOD ──────────────────────────────────────────────
  {
    duration: 8000,
    text:
      ':(\n' +
      '\n' +
      "Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.\n" +
      '\n' +
      'For more information about this issue and possible fixes, visit\n' +
      'https://www.windows.com/stopcode\n' +
      '\n' +
      'If you call a support person, give them this info:\n' +
      'Stop Code: CRITICAL_PROCESS_DIED',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#0078d7' // Modern Windows Blue
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(7, Math.min(11, W * 0.023))
      const lineH = fs + 4
      const pad = Math.round(W * 0.08)
      ctx.textBaseline = 'top'

      let y = Math.round(H * 0.12)

      // Huge Sad Face :(
      ctx.fillStyle = '#ffffff'
      ctx.font = `${fs * 4}px system-ui, -apple-system, sans-serif`
      ctx.fillText(':(', pad, y)
      y += fs * 4.5

      // Stop Message
      ctx.font = `${fs + 2}px system-ui, -apple-system, sans-serif`
      const text = "Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you."
      
      // Wrap text helper for sans-serif
      function wrapTextProportional(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
        const words = text.split(' ')
        let line = ''
        let cy = y
        for (const word of words) {
          const test = line + word + ' '
          if (ctx.measureText(test).width > maxW && line.length > 0) {
            ctx.fillText(line, x, cy)
            line = word + ' '
            cy += lineH
          } else {
            line = test
          }
        }
        if (line.trim().length > 0) { ctx.fillText(line, x, cy); cy += lineH }
        return cy
      }
      
      y = wrapTextProportional(ctx, text, pad, y, W - pad * 2, lineH * 1.3) + 15

      // Percent
      const pct = Math.min(100, Math.floor(((t % 8000) / 8000) * 100))
      ctx.fillText(`${pct}% complete`, pad, y)
      y += lineH * 2.2

      // QR Code and Stop Info layout
      const qrSize = Math.max(40, Math.min(75, H * 0.22))
      
      // Draw fake QR Code
      const qx = pad
      const qy = y
      
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(qx - 4, qy - 4, qrSize + 8, qrSize + 8)
      ctx.fillStyle = '#000000'
      
      const grid = 21
      const cellSize = qrSize / grid
      
      // Draw noise
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const isFinder = (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7)
          if (!isFinder) {
            // Pseudo-random noise seeded by row/col
            const seed = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453
            if (seed - Math.floor(seed) > 0.45) {
              ctx.fillRect(qx + c * cellSize, qy + r * cellSize, cellSize + 0.5, cellSize + 0.5)
            }
          }
        }
      }
      
      // Draw finders
      const finders = [{ cx: 0, cy: 0 }, { cx: grid - 7, cy: 0 }, { cx: 0, cy: grid - 7 }]
      for (const f of finders) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(qx + f.cx * cellSize, qy + f.cy * cellSize, 7 * cellSize, 7 * cellSize)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(qx + (f.cx + 1) * cellSize, qy + (f.cy + 1) * cellSize, 5 * cellSize, 5 * cellSize)
        ctx.fillStyle = '#000000'
        ctx.fillRect(qx + (f.cx + 2) * cellSize, qy + (f.cy + 2) * cellSize, 3 * cellSize, 3 * cellSize)
      }

      // Stop Info text
      ctx.fillStyle = '#ffffff'
      ctx.font = `${fs - 1}px system-ui, -apple-system, sans-serif`
      let tx = qx + qrSize + 16
      let ty = qy
      
      ctx.fillText('For more information about this issue and possible fixes, visit', tx, ty); ty += lineH
      ctx.fillText('https://www.windows.com/stopcode', tx, ty); ty += lineH * 1.5
      ctx.fillText('If you call a support person, give them this info:', tx, ty); ty += lineH
      ctx.font = `bold ${fs - 1}px system-ui, -apple-system, sans-serif`
      ctx.fillText('Stop Code: CRITICAL_PROCESS_DIED', tx, ty)
    }
  },
  // ── 12. Modern macOS Kernel Panic ─────────────────────────────────────────
  {
    duration: 7000,
    text:
      'Your computer restarted because of a problem. Press a key to continue.\n' +
      'Ihr Computer wurde aufgrund eines Problems neu gestartet. Bitte Taste drücken.\n' +
      'Votre ordinateur a redémarré en raison d’un problème. Appuyez sur une touche.\n' +
      'El ordenador se reinició debido a un problema. Pulse una tecla para continuar.',
    render(ctx, W, H, _t, _age) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Apple Logo in the middle (white)
      ctx.fillStyle = '#ffffff'
      const lx = W / 2
      const ly = H * 0.35
      const size = Math.max(16, Math.min(32, H * 0.09))
      
      // Draw a simplified Apple logo using arc
      ctx.beginPath()
      ctx.arc(lx, ly, size * 0.7, 0, Math.PI * 2)
      ctx.fill()
      // Leaf
      ctx.beginPath()
      ctx.ellipse(lx + size * 0.3, ly - size * 0.8, size * 0.3, size * 0.15, Math.PI / 4, 0, Math.PI * 2)
      ctx.fill()

      // Text in multiple languages
      const fs = Math.max(8, Math.min(10, W * 0.02))
      const lineH = fs + 4
      ctx.font = `${fs}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#dddddd'

      let ty = H * 0.52
      const panics = [
        'Your computer restarted because of a problem. Press a key to continue.',
        'Ihr Computer wurde aufgrund eines Problems neu gestartet. Bitte Taste drücken.',
        'Votre ordinateur a redémarré en raison d’un problème. Appuyez sur une touche.',
        'El ordenador se reinició debido a un problema. Pulse una tecla para continuar.'
      ]
      for (const line of panics) {
        ctx.fillText(line, W / 2, ty, W * 0.85)
        ty += lineH
      }
      ctx.textAlign = 'left'
    }
  },
  // ── 13. Linux systemd Boot Abort ──────────────────────────────────────────
  {
    duration: 8000,
    text:
      '[  OK  ] Started Show Plymouth Boot Screen.\n' +
      '[  OK  ] Reached target Paths.\n' +
      '[FAILED] Failed to start Load Kernel Modules.\n' +
      "See 'systemctl status systemd-modules-load.service' for details.\n" +
      '[FAILED] Failed to mount /sysroot.\n' +
      "See 'systemctl status sysroot.mount' for details.\n" +
      '[DEPEND] Dependency failed for Initrd Default Target.\n' +
      '[  OK  ] Reached target Basic System.\n' +
      'dracut-initqueue: Warning: /dev/disk/by-uuid/a3f4-b2c6 does not exist\n' +
      'Starting Emergency Shell...\n' +
      'Generating "/run/initramfs/rdsosreport.txt"\n' +
      'Entering emergency mode. Exit shell to continue.\n' +
      'sh:grub2-editor$ ',
    render(ctx, W, H, t, _age) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const fs = Math.max(7, Math.min(9.5, W * 0.022))
      const lineH = fs + 3
      ctx.font = `${fs}px monospace`
      ctx.textBaseline = 'top'
      const pad = 12
      let y = 10

      const bootLogs = [
        { text: '[  OK  ] Started Show Plymouth Boot Screen.', success: true },
        { text: '[  OK  ] Reached target Paths.', success: true },
        { text: '[FAILED] Failed to start Load Kernel Modules.', fail: true },
        { text: "See 'systemctl status systemd-modules-load.service' for details.", info: true },
        { text: '[FAILED] Failed to mount /sysroot.', fail: true },
        { text: "See 'systemctl status sysroot.mount' for details.", info: true },
        { text: '[DEPEND] Dependency failed for Initrd Default Target.', warn: true },
        { text: '[  OK  ] Reached target Basic System.', success: true },
        { text: 'dracut-initqueue: Warning: /dev/disk/by-uuid/a3f4-b2c6 does not exist', warn: true },
        { text: 'Starting Emergency Shell...', info: true },
        { text: 'Generating "/run/initramfs/rdsosreport.txt"', info: true },
        { text: 'Entering emergency mode. Exit shell to continue.', info: true },
        { text: 'sh:grub2-editor$ ', prompt: true }
      ]

      for (const log of bootLogs) {
        if (y + lineH > H) break;
        
        if (log.success) {
          ctx.fillStyle = '#4ade80' // Green
          ctx.fillText('[  OK  ]', pad, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(log.text.substring(8), pad + ctx.measureText('[  OK  ] ').width, y)
        } else if (log.fail) {
          ctx.fillStyle = '#f87171' // Red
          ctx.fillText('[FAILED]', pad, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(log.text.substring(8), pad + ctx.measureText('[FAILED] ').width, y)
        } else if (log.warn) {
          ctx.fillStyle = '#fbbf24' // Yellow
          ctx.fillText(log.text, pad, y)
        } else if (log.prompt) {
          ctx.fillStyle = '#ffffff'
          ctx.fillText(log.text, pad, y)
          
          // Blinking cursor
          const blink = Math.floor(t / 500) % 2 === 0
          if (blink) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(pad + ctx.measureText(log.text).width, y, 6, lineH - 2)
          }
        } else {
          ctx.fillStyle = '#aaaaaa'
          ctx.fillText(log.text, pad, y)
        }
        y += lineH
      }
    }
  },
]

function RetroErrorPanel() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Index der aktuell sichtbaren Fehlermeldung — als React-State, damit das
  // unsichtbare Text-Overlay (siehe JSX unten) bei jedem Slide-Wechsel neu
  // gerendert wird und immer den passenden, markierbaren Text zeigt.
  const [visibleIdx, setVisibleIdx] = useState(0)

  useEffect(() => {
    const _canvas = canvasRef.current
    const container = containerRef.current
    if (!_canvas || !container) return

    const canvas: HTMLCanvasElement        = _canvas
    const cont: HTMLDivElement             = container
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx: CanvasRenderingContext2D    = _ctx

    let active   = true
    // Cleanup-Funktion vom raf-coordinator; null solange wir noch nicht subscribed sind
    let unsubscribe: (() => void) | null = null
    let screenIdx = Math.floor(Math.random() * SCREENS.length)
    let screenStart = 0
    let transitioning = false
    let transitionStart = 0
    // Merkt sich, welcher Index zuletzt an React gemeldet wurde, damit wir
    // setVisibleIdx() nur beim tatsaechlichen Slide-Wechsel aufrufen und nicht
    // in jedem einzelnen Animationsframe (das wuerde unnoetig re-rendern).
    let reportedIdx = -1

    function resize() {
      canvas.width  = cont.clientWidth
      canvas.height = cont.clientHeight
    }
    resize()

    function draw(now: number) {
      if (!active) return

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) { return }

      if (screenStart === 0) screenStart = now

      const age = now - screenStart
      const screen = SCREENS[screenIdx]

      if (transitioning) {
        // 300ms schwarzer Übergang
        const ta = (now - transitionStart) / 300
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, W, H)
        if (ta >= 1) {
          transitioning = false
          screenStart   = now
          screenIdx     = (screenIdx + 1) % SCREENS.length
        }
      } else if (age >= screen.duration) {
        transitioning  = true
        transitionStart = now
        ctx.fillStyle  = '#000000'
        ctx.fillRect(0, 0, W, H)
      } else {
        screen.render(ctx, W, H, now, age)
        // Sichtbaren Slide an React melden — nur wenn er sich geaendert hat,
        // damit das Text-Overlay synchron zum Canvas bleibt.
        if (reportedIdx !== screenIdx) {
          reportedIdx = screenIdx
          setVisibleIdx(screenIdx)
        }
      }
    }

    // Beim zentralen raf-coordinator anmelden — der ruft draw() bei jedem Frame.
    unsubscribe = subscribe(draw)

    const ro = new ResizeObserver(resize)
    ro.observe(cont)

    return () => {
      active = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="SYSTEM FAILURE LOG // INCIDENT ARCHIVE">
      {/* relative: dient als Positionierungs-Anker fuer das absolut platzierte
          Text-Overlay, das ueber dem Canvas liegt. */}
      <div ref={containerRef} className="relative w-full h-full min-h-0">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Unsichtbares, aber markier- und kopierbares Text-Overlay.
            Der eigentliche Fehlertext wird weiterhin pixelig auf den Canvas
            gemalt (authentischer Retro-Look). Da Canvas-Pixel nicht mit der
            Maus selektierbar sind, legen wir denselben Text zusaetzlich als
            echtes HTML darueber.

            - color: 'transparent' -> der Text ist unsichtbar und stoert den
              Canvas-Look nicht, bleibt aber auswaehlbar; beim Markieren zeigt
              der Browser die uebliche Selektions-Hervorhebung.
            - System-Monospace (ui-monospace, Menlo, Consolas, monospace) statt
              einer geladenen Custom-Font -> kein MB-grosser Font-Download.
            - whiteSpace: 'pre-wrap' -> Zeilenumbrueche aus dem text-Feld bleiben
              erhalten, lange Zeilen brechen am Rand um.
            - pointerEvents: 'auto' nur hier, damit Markieren funktioniert; der
              uebrige Panel-Bereich bleibt unberuehrt. */}
        <pre
          aria-label="Fehlermeldung als Text"
          style={{
            position: 'absolute',
            inset: 0,
            margin: 0,
            padding: '6%',
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
            fontSize: 'clamp(7px, 2.2vw, 12px)',
            lineHeight: 1.35,
            color: 'transparent',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'hidden',
            userSelect: 'text',
            cursor: 'text',
          }}
        >
          {SCREENS[visibleIdx].text}
        </pre>
      </div>
    </Panel>
  )
}

export default memo(RetroErrorPanel);
