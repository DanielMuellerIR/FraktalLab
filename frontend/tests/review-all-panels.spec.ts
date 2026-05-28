import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'
const MIN_STDDEV = 5

// Helper function to calculate pixel variance (standard deviation) on canvas
async function getCanvasStdDev(page: any): Promise<number> {
  return page.evaluate(() => {
    const activeDiv = document.querySelector('div.ring-2.ring-green-500')
    const canvas = activeDiv?.querySelector('canvas:not([data-testid="glitch-overlay"])') as HTMLCanvasElement | null
    if (!canvas) return -1

    const w = canvas.width
    const h = canvas.height
    if (w < 4 || h < 4) return 0

    let ctx = canvas.getContext('2d')
    let isWebGL = false
    let gl: any = null
    
    if (!ctx) {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return 0
      isWebGL = true
    }

    // Sample 5 regions: corners and center
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
          return 0
        }
        maxStddev = Math.max(maxStddev, stddevOf(data))
      } catch {
        return -2 // Tainted / CORS (treat as ok)
      }
    }
    return maxStddev
  })
}

test.describe('Review Mode - Visual Panel Verification', () => {
  // Ensure the screenshots folder exists
  test.beforeAll(() => {
    const dir = path.join(__dirname, 'screenshots', 'panels')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })

  test('Verify and screenshot all panels in review mode', async ({ page }) => {
    test.setTimeout(150000)
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error') {
        console.error('[BROWSER ERROR]', text)
      } else if (type === 'warning') {
        console.warn('[BROWSER WARN]', text)
      } else {
        // Forward WASM and WebGL logs to see step-by-step progress
        console.log('[BROWSER LOG]', text)
      }
    })

    // Go to homepage and wait to load
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Enter review mode
    const reviewBtn = page.locator('button[title="Panel Review-Modus öffnen"]')
    await expect(reviewBtn).toBeVisible()
    await reviewBtn.click()

    // Wait for review mode layout to stabilize
    await page.waitForTimeout(1000)

    // Dynamically discover total number of panels from counter
    const counterSpan = page.locator('span.min-w-\\[70px\\]').first()
    await expect(counterSpan).toBeVisible()
    const counterText = await counterSpan.innerText()
    const totalPanels = parseInt(counterText.split('/')[1].trim(), 10)
    console.log(`Discovered ${totalPanels} panels to review. Text was: "${counterText}"`)

    const failures: string[] = []

    for (let i = 0; i < totalPanels; i++) {
      // Get the name of the active panel from the title
      const activePanel = page.locator('div.ring-2.ring-green-500')
      await expect(activePanel).toBeVisible()

      // Read panel title/name from Panel component header
      const panelTitleText = await activePanel.locator('span.uppercase').first().innerText()
      // Title format is: "REVIEW // FractalJulia [1/52]" or similar
      const panelName = panelTitleText.replace('REVIEW //', '').split('[')[0].trim()

      console.log(`Reviewing panel [${String(i + 1).padStart(2, '0')}/${totalPanels}]: ${panelName}`)

      // Wait for rendering to settle (especially for WASM compilation / slow startup panels)
      await page.waitForTimeout(1500)

      // Take screenshot of the panel
      const screenshotPath = path.join(__dirname, 'screenshots', 'panels', `${String(i + 1).padStart(2, '0')}_${panelName}.png`)
      await activePanel.screenshot({ path: screenshotPath })

      // Check canvas stddev if a canvas is present
      const canvasCount = await activePanel.locator('canvas:not([data-testid="glitch-overlay"])').count()
      if (canvasCount > 0) {
        const stddev = await getCanvasStdDev(page)
        if (stddev >= 0 && stddev < MIN_STDDEV) {
          console.warn(`  ⚠ Panel ${panelName} appears empty/black! stddev = ${stddev.toFixed(2)}`)
          failures.push(`Panel ${String(i + 1).padStart(2, '0')} (${panelName}) is empty/black (stddev = ${stddev.toFixed(2)})`)
        } else {
          console.log(`  ✓ stddev = ${stddev.toFixed(2)}`)
        }
      } else {
        console.log(`  ✓ Text-only panel`)
      }

      // Navigate to the next panel
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(300)
    }

    if (failures.length > 0) {
      console.error(`Visual review finished with ${failures.length} empty/black panels:`)
      console.error(failures.join('\n'))
    }

    expect(failures.length, `Expected 0 empty/black panels, but found ${failures.length}:\n${failures.join('\n')}`).toBe(0)
  })
})
