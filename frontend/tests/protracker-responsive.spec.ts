import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173'
const ARTIFACTS_DIR = '~/.fraktal-artifacts'

test.describe('AmiModPanel ProTracker Sizing & Responsiveness Verification', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
      fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
    }
  })

  test('Render ProTracker at large, small, and ultra-small sizes to verify play button visibility', async ({ page }) => {
    test.setTimeout(60000)

    console.log('Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'load' })

    // Enable review mode and set active index to AmiModPanel
    await page.evaluate(() => {
      localStorage.setItem('fraktallab_review_mode', 'true')
      // Find AmiModPanel index or guess 13
      localStorage.setItem('fraktallab_review_idx', '13')
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1500)

    // Discover the actual panel
    let panelTitleText = ''
    try {
      panelTitleText = await page.locator('div.border-green-900').first().locator('span.uppercase').first().innerText()
    } catch {
      panelTitleText = await page.locator('span.uppercase').first().innerText()
    }
    
    if (!panelTitleText.includes('MOD PLAYER') && !panelTitleText.includes('AMIGA')) {
      console.log(`Expected ProTracker but found: ${panelTitleText}. Scanning...`)
      // Scan panels
      const nextBtn = page.locator('button:has-text("NEXT")').first()
      for (let attempt = 0; attempt < 30; attempt++) {
        await nextBtn.click()
        await page.waitForTimeout(150)
        try {
          panelTitleText = await page.locator('div.border-green-900').first().locator('span.uppercase').first().innerText()
        } catch {
          panelTitleText = await page.locator('span.uppercase').first().innerText()
        }
        if (panelTitleText.includes('MOD PLAYER') || panelTitleText.includes('AMIGA')) {
          console.log(`Found ProTracker at scan step ${attempt}!`)
          break
        }
      }
    }

    console.log(`Confirmed on target panel: ${panelTitleText}`)

    // Viewport sizes to test:
    // 1. Large: 960x600 (Normal view)
    // 2. Small (Narrow): 480x400 (isNarrow: true, isShort: false)
    // 3. Ultra-Small: 320x240 (isUltraNarrow: true, isShort: true)
    const sizes = [
      { name: 'large', width: 960, height: 600 },
      { name: 'narrow', width: 480, height: 400 },
      { name: 'ultra_small', width: 320, height: 240 }
    ]

    for (const size of sizes) {
      console.log(`Setting viewport size to ${size.width}x${size.height} (${size.name})...`)
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.waitForTimeout(1000) // wait for ResizeObserver to trigger and layout to settle

      // Select target locator (the Panel container itself)
      const target = page.locator('div.border-green-900').first()
      await expect(target).toBeVisible()

      // Take a screenshot of the active panel
      const screenshotPath = path.join(ARTIFACTS_DIR, `protracker_responsive_${size.name}.png`)
      await target.screenshot({ path: screenshotPath })
      console.log(`Saved screenshot to ${screenshotPath}`)

      // Verify the play button is present and visible
      const playBtn = target.locator('button:has-text("PLAY"), button:has-text("PLAY AUDIO"), button:has-text("STOP")')
      await expect(playBtn).toBeVisible()

      // Print button text
      const btnText = await playBtn.innerText()
      console.log(`   -> Button text at ${size.name}: "${btnText}"`)

      // Ensure button is clickable
      await expect(playBtn).toBeEnabled()
    }
  })
})
