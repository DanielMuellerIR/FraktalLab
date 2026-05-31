import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173'

test.describe('Nuclear Explosion Panel Visual Capture', () => {
  test('Capture Oppenheimer and Twin Peaks screenshots', async ({ page }) => {
    test.setTimeout(90000)

    // Go to homepage
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Set review mode to NuclearExplosionPanel (index 53)
    await page.evaluate(() => {
      localStorage.setItem('fraktallab_review_mode', 'true')
      localStorage.setItem('fraktallab_review_idx', '53')
    })

    // Reload to apply review mode state
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Find the active panel slot
    const activePanel = page.locator('div.ring-2.ring-green-500')
    await expect(activePanel).toBeVisible()

    // Read the title to verify we are on the correct panel
    const panelTitleText = await activePanel.locator('span.uppercase').first().innerText()
    console.log(`Active Panel Title: "${panelTitleText}"`)

    const screenshotsDir = path.join(__dirname, 'screenshots', 'panels')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    // 1. Capture Oppenheimer Day Mode
    // Let's reload and wait for a realistic explosion state (around 5-10 seconds into the cycle)
    // We want the mushroom cloud to be fully formed but not faded out.
    // In our shader, mod(time, 30) gives progress. If we wait, we can capture a beautiful frame.
    console.log('Waiting for Oppenheimer Day mushroom cloud to form...')
    await page.waitForTimeout(4000)
    const dayPath = path.join(screenshotsDir, '54_SIMULATION_ OPPENHEIMER TRINITY _DAY_.png')
    await activePanel.screenshot({ path: dayPath })
    console.log(`Saved Day screenshot to: ${dayPath}`)

    // 2. Capture Twin Peaks Night Mode
    // Twin Peaks Night is mod(time, 60.0) >= 30.0.
    // Let's wait another 30 seconds to enter the night cycle, then wait for the explosion to form.
    console.log('Waiting for Twin Peaks Night B&W mode cycle to trigger...')
    await page.waitForTimeout(30000)
    console.log('Waiting for Twin Peaks Night mushroom cloud to form...')
    await page.waitForTimeout(4000)
    
    const nightPath = path.join(screenshotsDir, '54_SIMULATION_ TWIN PEAKS NIGHT _B_W MONO_.png')
    await activePanel.screenshot({ path: nightPath })
    console.log(`Saved Night screenshot to: ${nightPath}`)
  })
})
