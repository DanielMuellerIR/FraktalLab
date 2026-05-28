import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'

// 5 Regionen detail checks (stddev & complexity)
async function canvasQualityMetrics(page: Page): Promise<{ stddev: number; activeBins: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas:not([data-testid="glitch-overlay"])')
    if (!canvas) return { stddev: 0, activeBins: 0 }
    const w = canvas.width
    const h = canvas.height
    if (w < 4 || h < 4) return { stddev: 0, activeBins: 0 }
    const ctx = canvas.getContext('2d')
    if (!ctx) return { stddev: 0, activeBins: 0 }

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

    function activeBinsOf(data: Uint8ClampedArray): number {
      const bins = new Array(16).fill(0)
      const numPixels = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const binIdx = Math.min(15, Math.floor(lum / 16))
        bins[binIdx]++
      }
      const threshold = numPixels * 0.005 // at least 0.5% of pixels
      return bins.filter(count => count >= threshold).length
    }

    let maxStddev = 0
    let maxActiveBins = 0
    for (const r of regions) {
      try {
        const data = ctx.getImageData(r.x, r.y, sw, sh).data
        maxStddev = Math.max(maxStddev, stddevOf(data))
        maxActiveBins = Math.max(maxActiveBins, activeBinsOf(data))
      } catch {
        return { stddev: -1, activeBins: -1 } // tainted
      }
    }
    return { stddev: maxStddev, activeBins: maxActiveBins }
  })
}

async function getCanvasZoomInfo(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas:not([data-testid="glitch-overlay"])')
    if (!canvas) return null
    return {
      zoom: parseFloat(canvas.getAttribute('data-zoom') ?? '0'),
      direction: canvas.getAttribute('data-zoom-direction') ?? '0'
    }
  })
}

test.describe('Automatisches Testsystem - Fraktal Zoom & Detail Check', () => {
  // Mobile viewport to ensure only the active panel is rendered
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  test('Check all Fractal panels zoom and details', async ({ page }) => {
    test.setTimeout(180000)
    // 1. Go to page and enter Review mode
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Click on "?" button to enter review mode
    const reviewBtn = page.locator('button:has-text("?")')
    await reviewBtn.click()
    await page.waitForTimeout(500)

    // We cycle through panels. Since we are on mobile, only 1 panel is shown
    // We check the panel title to know if it is a fractal panel.
    const maxPanels = 45 // safe limit
    let checkedCount = 0

    for (let i = 0; i < maxPanels; i++) {
      // Get the panel title using robust class-based selector
      const panelTitle = await page.evaluate(() => {
        const titleSpan = document.querySelector('main .font-mono.tracking-widest')
        return titleSpan ? (titleSpan.textContent ?? '') : ''
      })

      console.log(`Checking panel index ${i+1}: "${panelTitle}"`)

      const upperTitle = panelTitle.toUpperCase()
      if (upperTitle.includes('FRACTAL') || upperTitle.includes('SEAHORSE') || upperTitle.includes('SPIRAL') || upperTitle.includes('LIGHTNING') || upperTitle.includes('ELEPHANT') || upperTitle.includes('MANDELBROT') || upperTitle.includes('DRAGON') || upperTitle.includes('DENDRITE') || upperTitle.includes('SWIRL') || upperTitle.includes('TENDRIL') || upperTitle.includes('JULIA')) {
        console.log(`  => Detected Fractal Panel! Starting 10s checks...`)
        checkedCount++

        // Let's check initial zoom details
        let info = await getCanvasZoomInfo(page)
        const initialDir = info?.direction ?? '0'
        console.log(`    Initial Dir: ${initialDir}, Initial Zoom: ${info?.zoom}`)

        // Verify stddev and color complexity are high at start
        let metrics = await canvasQualityMetrics(page)
        console.log(`    Initial Metrics -> StdDev: ${metrics.stddev.toFixed(2)}, ActiveBins: ${metrics.activeBins}`)
        expect(metrics.stddev, `Fractal panel ${panelTitle} has no detail at start`).toBeGreaterThan(5)
        expect(metrics.activeBins, `Fractal panel ${panelTitle} has low complexity / lacks gradients at start`).toBeGreaterThanOrEqual(2)

        // Verify zoom and direction over 10 seconds
        let lastZoom = info?.zoom ?? 0
        for (let sec = 1; sec <= 10; sec++) {
          await page.waitForTimeout(1000)
          
          info = await getCanvasZoomInfo(page)
          metrics = await canvasQualityMetrics(page)

          console.log(`      Second ${sec}: Zoom: ${info?.zoom?.toFixed(2)}, Dir: ${info?.direction}, StdDev: ${metrics.stddev.toFixed(2)}, ActiveBins: ${metrics.activeBins}`)

          // Verify stddev stays high (no black or empty space)
          expect(metrics.stddev, `Fractal panel ${panelTitle} faded to black/solid color at second ${sec}`).toBeGreaterThan(5)
          
          // Verify color complexity stays high (no boring bicolor/gradient-free zones)
          expect(metrics.activeBins, `Fractal panel ${panelTitle} has low color complexity / lacks gradients at second ${sec}`).toBeGreaterThanOrEqual(2)
          
          // Verify zoom direction has not flipped
          expect(info?.direction, `Fractal panel ${panelTitle} flipped zoom direction before 10 seconds!`).toBe(initialDir)

          // Verify zoom is active/moving
          expect(info?.zoom, `Fractal panel ${panelTitle} zoom is frozen`).not.toBe(lastZoom)
          lastZoom = info?.zoom ?? 0
        }
        console.log(`    => PASS: Panel ${panelTitle} zoomed for 10s consistently with good details!`)
      }

      // Press ArrowRight to go to next panel
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(300)

      // Break if we loop back to the first panel
      if (upperTitle.includes('JULIA') && i > 1) {
        console.log('\nWrapped around to the start panel (FractalJulia). Test suite completed.')
        break
      }
    }

    console.log(`\nCompleted testing. Total fractal panels verified: ${checkedCount}`)
    expect(checkedCount).toBeGreaterThanOrEqual(10) // make sure we checked all 10+ fractal panels
  })
})
