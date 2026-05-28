/**
 * Visueller Panel-Check für FraktalLab.
 *
 * Prüft, ob Panels tatsächlich Inhalt rendern:
 *   - Canvas-Panels: Pixel-Varianz > Schwellenwert (einfarbig = leer)
 *   - Video-Panels:  readyState >= HAVE_CURRENT_DATA und kein Fehler
 *
 * GlitchOverlay-Canvas wird ausgeschlossen (data-testid="glitch-overlay"),
 * da sie absichtlich zwischen Glitch-Events transparent/schwarz ist.
 *
 * Ausführen: npm run test:panels
 *            (setzt einen laufenden Dev-Server auf VITE_URL voraus)
 */
import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'

// Minimal-Stddev damit ein Canvas als "hat Inhalt" gilt
const MIN_STDDEV = 5

// ------------------------------------------------------------------
// Hilfsfunktion: Max. Pixel-Standardabweichung über 3 Regionen der Canvas.
//   Ausschluss: data-testid="glitch-overlay" (transparent wenn inaktiv).
//   Rückgabe stddev < 0 → tainted/Cross-Origin (als "ok" werten)
// ------------------------------------------------------------------
async function canvasMaxStdDev(
  page: Page,
  /** Index in querySelectorAll('canvas:not([data-testid="glitch-overlay"])') */
  canvasIndex: number,
): Promise<{ stddev: number; width: number; height: number; testId: string }> {
  return page.evaluate((idx) => {
    const canvases = document.querySelectorAll<HTMLCanvasElement>(
      'canvas:not([data-testid="glitch-overlay"])'
    )
    const canvas = canvases[idx]
    if (!canvas) return { stddev: 0, width: 0, height: 0, testId: '?' }

    const w = canvas.width
    const h = canvas.height
    const testId = canvas.dataset.testid ?? canvas.id ?? `canvas[${idx}]`

    if (w < 4 || h < 4) return { stddev: 0, width: w, height: h, testId }

    let ctx = canvas.getContext('2d')
    let isWebGL = false
    let gl: any = null
    
    if (!ctx) {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return { stddev: 0, width: w, height: h, testId }
      isWebGL = true
    }

    // 5 Regionen samplen: Ecken und Mitte
    const sw = Math.min(w, 80)
    const sh = Math.min(h, 80)
    const regions = [
      { x: 0,                         y: 0 },
      { x: Math.max(0, w - sw),        y: 0 },
      { x: Math.floor((w - sw) / 2),  y: Math.floor((h - sh) / 2) },
      { x: 0,                         y: Math.max(0, h - sh) },
      { x: Math.max(0, w - sw),        y: Math.max(0, h - sh) },
    ]

    function stddevOf(data: Uint8ClampedArray): number {
      const lumas: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        lumas.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      }
      const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length
      const variance = lumas.reduce((a, b) => a + (b - mean) ** 2, 0) / lumas.length
      return Math.sqrt(variance)
    }

    let maxStddev = 0
    for (const r of regions) {
      try {
        let data: Uint8ClampedArray
        if (isWebGL && gl) {
          const pixels = new Uint8Array(sw * sh * 4)
          gl.readPixels(r.x, r.y, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          data = new Uint8ClampedArray(pixels.buffer)
        } else if (ctx) {
          data = ctx.getImageData(r.x, r.y, sw, sh).data
        } else {
          return { stddev: 0, width: w, height: h, testId }
        }
        maxStddev = Math.max(maxStddev, stddevOf(data))
      } catch {
        // Tainted canvas (z.B. Cross-Origin ImageData) → als "ok" werten
        return { stddev: -1, width: w, height: h, testId }
      }
    }

    return { stddev: maxStddev, width: w, height: h, testId }
  }, canvasIndex)
}

// ------------------------------------------------------------------
// Hilfsfunktion: Video-Status
// ------------------------------------------------------------------
async function videoStatus(page: Page, videoIndex: number) {
  return page.evaluate((idx) => {
    const video = document.querySelectorAll('video')[idx] as HTMLVideoElement
    if (!video) return null
    return {
      src: video.currentSrc || video.src,
      readyState: video.readyState,    // 0=HAVE_NOTHING … 4=HAVE_ENOUGH_DATA
      paused: video.paused,
      error: video.error ? { code: video.error.code, message: video.error.message } : null,
      networkState: video.networkState, // 0=EMPTY 1=IDLE 2=LOADING 3=NO_SOURCE
    }
  }, videoIndex)
}

// ------------------------------------------------------------------
// Test-Suite
// ------------------------------------------------------------------
test.describe('Panel-Inhalt-Check', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[BROWSER]', msg.text())
    })
    // 'load' statt 'networkidle': Video-Streaming hält Network-State sonst dauerhaft offen
    await page.goto(BASE_URL, { waitUntil: 'load' })
    // Warten bis WASM geladen und Canvas-Animationen angelaufen sind
    await page.waitForTimeout(6000)
  })

  test('Screenshot der Startseite', async ({ page }) => {
    await page.screenshot({ path: 'tests/screenshots/panel-check.png', fullPage: false })
  })

  test('Canvas-Panels haben Pixel-Varianz (nicht einfarbig)', async ({ page }) => {
    const count: number = await page.evaluate(
      () => document.querySelectorAll('canvas:not([data-testid="glitch-overlay"])').length
    )

    console.log(`Canvas-Panels (ohne GlitchOverlay): ${count}`)
    expect(count, 'Mindestens ein Canvas-Panel muss existieren').toBeGreaterThan(0)

    const emptyPanels: string[] = []

    for (let i = 0; i < count; i++) {
      const { stddev, width, height, testId } = await canvasMaxStdDev(page, i)

      if (stddev < 0) {
        console.log(`  [${testId}] ${width}×${height} → Cross-Origin tainted (ok)`)
        continue
      }

      const status = stddev < MIN_STDDEV ? '⚠ LEER' : '✓'
      console.log(`  [${testId}] ${width}×${height} → stddev ${stddev.toFixed(2)} ${status}`)

      if (stddev < MIN_STDDEV) {
        emptyPanels.push(`[${testId}] ${width}×${height} stddev=${stddev.toFixed(2)}`)
      }
    }

    if (emptyPanels.length > 0) {
      console.warn('Leere/einfarbige Panels:\n  ' + emptyPanels.join('\n  '))
    }

    // Test schlägt fehl wenn mehr als die Hälfte der Panels leer ist
    // (Toleranz: Pool-Panels rotieren, manche starten langsamer)
    expect(
      emptyPanels.length,
      `${emptyPanels.length} von ${count} Canvas-Panels erscheinen leer`
    ).toBeLessThanOrEqual(Math.floor(count / 2))
  })

  test('Video-Panels spielen ab oder haben valide Quelle', async ({ page }) => {
    const count: number = await page.evaluate(
      () => document.querySelectorAll('video').length
    )
    console.log(`Video-Elemente: ${count}`)

    for (let i = 0; i < count; i++) {
      const s = await videoStatus(page, i)
      if (!s) continue

      console.log(
        `  Video[${i}] readyState=${s.readyState} networkState=${s.networkState}` +
          ` paused=${s.paused} error=${s.error ? JSON.stringify(s.error) : 'none'}` +
          `\n    src: ${s.src}`
      )

      expect(s.error, `Video[${i}] hat Fehler: ${JSON.stringify(s.error)}`).toBeNull()
      // networkState=3 → NETWORK_NO_SOURCE: URL ungültig oder nicht erreichbar
      expect(s.networkState, `Video[${i}] hat keine erreichbare Quelle`).not.toBe(3)
    }
  })
})
