import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:5173'
// Safe fallback to conversation ID artifacts directory
const ARTIFACTS_DIR = '~/.fraktal-artifacts'

test.describe('Capture VHS Glitch Variants', () => {
  test('Capture tracking bar glitch variants for comparison', async ({ page }) => {
    test.setTimeout(60000)

    if (!fs.existsSync(ARTIFACTS_DIR)) {
      fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
    }

    const variants = [1, 2, 3]

    for (const v of variants) {
      console.log(`Capturing Variant ${v}...`)
      // Load the app with special query parameters to force the variant
      await page.goto(`${BASE_URL}/?glitch_type=tracking_bar&glitch_variant=${v}&glitch_loop=true`, { waitUntil: 'load' })
      
      // Wait for the glitch to trigger, drift and show fully
      await page.waitForTimeout(3500)
      
      const screenshotPath = path.join(ARTIFACTS_DIR, `glitch_variant_${v}.png`)
      await page.screenshot({ path: screenshotPath })
      console.log(`Saved screenshot to ${screenshotPath}`)
    }
  })
})
