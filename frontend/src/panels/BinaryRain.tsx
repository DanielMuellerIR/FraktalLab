import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// Zeichenvorrat: lateinisch + japanische Katakana + Matrix-Symbole
const CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  '0123456789ABCDEF<>|/\\{}[]!@#$%^&*'

const W = 80, H = 50
const FONT_SIZE = 6   // px pro Zeichen
const COLS = Math.floor(W / (FONT_SIZE * 0.6))  // ~22 Spalten

type Drop = {
  y:     number   // aktuelle Zeile (float)
  speed: number   // Pixel pro Frame
  len:   number   // Länge der leuchtenden Spur
  chars: string[] // Zeichen der Spur (zufällig)
}

function makeDrops(): Drop[] {
  return Array.from({ length: COLS }, (_, i) => ({
    y:     -Math.random() * H * 2,
    speed: 0.4 + Math.random() * 0.8,
    len:   8 + Math.floor(Math.random() * 20),
    chars: Array.from({ length: 40 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]),
  }))
}

export default function BinaryRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let alive = true
    const drops = makeDrops()

    // Gelegentlich ein Zeichen in einer Spur mutieren (gibt den "lebendigen" Look)
    const mutationTimer = setInterval(() => {
      const d = drops[Math.floor(Math.random() * drops.length)]
      const i = Math.floor(Math.random() * d.chars.length)
      d.chars[i] = CHARS[Math.floor(Math.random() * CHARS.length)]
    }, 80)

    function loop() {
      if (!alive) return

      // Dunkles Nachleuchten statt hartem Löschen → Schweifspur
      ctx!.fillStyle = 'rgba(0,0,0,0.25)'
      ctx!.fillRect(0, 0, W, H)

      ctx!.font = `bold ${FONT_SIZE}px monospace`

      for (let col = 0; col < drops.length; col++) {
        const d = drops[col]
        d.y += d.speed

        const x = col * (W / COLS)

        for (let row = 0; row < d.len; row++) {
          const py = d.y - row * FONT_SIZE
          if (py < 0 || py > H) continue

          const charIdx = Math.floor(py / FONT_SIZE) % d.chars.length
          const ch = d.chars[charIdx]

          // Vorderstes Zeichen: weiß/hellgrün (Leuchtspitze)
          if (row === 0) {
            ctx!.fillStyle = '#ccffcc'
          } else {
            // Spur: von hellgrün nach dunkelgrün
            const fade = 1 - row / d.len
            const g = Math.round(80 + fade * 130)
            ctx!.fillStyle = `rgb(0,${g},0)`
          }
          ctx!.fillText(ch, x, py)
        }

        // Spur zurücksetzen wenn vollständig unten raus
        if (d.y - d.len * FONT_SIZE > H) {
          d.y     = -Math.random() * H * 0.5
          d.speed = 0.4 + Math.random() * 0.8
          d.len   = 8 + Math.floor(Math.random() * 20)
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      clearInterval(mutationTimer)
    }
  }, [])

  return (
    <Panel title="CODE RAIN // NEURAL DECRYPT">
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </Panel>
  )
}
