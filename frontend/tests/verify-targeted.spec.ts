import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'

test.describe('Targeted Visual & Time-Series Verification', () => {
  test.beforeAll(() => {
    const dir = path.join(__dirname, 'screenshots', 'targeted')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })

  test('Verify target panels and capture animation time-series', async ({ page }) => {
    test.setTimeout(120000) // 2 minute timeout is plenty for targeted skip
    
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error') {
        console.error('[BROWSER ERROR]', text)
      } else if (type === 'warning') {
        console.warn('[BROWSER WARN]', text)
      } else {
        console.log('[BROWSER LOG]', text)
      }
    })

    // Go to homepage and wait to load
    await page.goto(BASE_URL, { waitUntil: 'load' })

    // Clear review storage states to start fresh on panel 0
    await page.evaluate(() => {
      localStorage.removeItem('fraktallab_review_mode')
      localStorage.removeItem('fraktallab_review_idx')
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1000)

    // Enter review mode
    const reviewBtn = page.locator('button[title="Panel Review-Modus öffnen"]')
    await expect(reviewBtn).toBeVisible()
    await reviewBtn.click()
    await page.waitForTimeout(1000)

    // Discover total number of panels
    const counterSpan = page.locator('span.min-w-\\[70px\\]').first()
    await expect(counterSpan).toBeVisible()
    const counterText = await counterSpan.innerText()
    const totalPanels = parseInt(counterText.split('/')[1].trim(), 10)
    console.log(`Targeted scan starting. Total panels in app: ${totalPanels}`)

    for (let i = 0; i < totalPanels; i++) {
      const activePanel = page.locator('div.ring-2.ring-green-500')
      await expect(activePanel).toBeVisible()

      // Read panel title/name from Panel component header
      const panelTitleText = await activePanel.locator('span.uppercase').first().innerText()
      const panelName = panelTitleText.replace('REVIEW //', '').split('[')[0].trim()

      const isLunar = panelName.toUpperCase().includes('LUNAR') || panelName.toUpperCase().includes('MOON')
      const isOppenheimer = panelName.toUpperCase().includes('OPPENHEIMER') || panelName.toUpperCase().includes('NUCLEAR')
      const isSolar = panelName.toUpperCase().includes('SOLAR SYSTEM') || panelName.toUpperCase().includes('HELIOCENTRIC')
      const isRetroWave = panelName.toUpperCase().includes('RETRO OUTRUN') || panelName.toUpperCase().includes('RETROWAVE') || panelName.toUpperCase().includes('HORIZON SCAN')

      const isTarget = isLunar || isOppenheimer || isSolar || isRetroWave

      if (isTarget) {
        console.log(`🎯 TARGET FOUND [${String(i + 1).padStart(2, '0')}/${totalPanels}]: ${panelName}`)
        
        if (isLunar) {
          // Lunar Observatory - Time-Series Capture of the phase animation
          console.log(`   -> Capturing Moon phase lighting time-series...`)
          await page.waitForTimeout(1000) // initial warm-up
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'moon_phase_01.png') })
          
          await page.waitForTimeout(2000) // let phase rotate
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'moon_phase_02.png') })
          
          await page.waitForTimeout(2000) // let phase rotate further
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'moon_phase_03.png') })
        } 
        else if (isOppenheimer) {
          // Oppenheimer Explosion - Time-Series Capture from initial flash to cooling smoke
          console.log(`   -> Capturing Oppenheimer explosion evolution time-series...`)
          await page.waitForTimeout(800) // initial blast flash
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'oppenheimer_01_flash.png') })
          
          await page.waitForTimeout(2000) // expanding fire ball
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'oppenheimer_02_expansion.png') })
          
          await page.waitForTimeout(2500) // cooling smoke & soot
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'oppenheimer_03_soot.png') })
        }
        else if (isSolar) {
          // Solar System Panel
          console.log(`   -> Capturing Solar System live telemetry...`)
          await page.waitForTimeout(3000) // wait for auto-zoom cycle warm up
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'solar_system.png') })
        }
        else if (isRetroWave) {
          // Retro Outrun landscape
          console.log(`   -> Capturing Retro Outrun Horizon...`)
          await page.waitForTimeout(3000) // warm up the shader
          await activePanel.screenshot({ path: path.join(__dirname, 'screenshots', 'targeted', 'retro_outrun.png') })
        }
      } else {
        // Skip non-target panels immediately to be ultra-efficient!
        // console.log(`Skipping panel: ${panelName}`)
      }

      // Navigate to the next panel
      const nextBtn = page.locator('button:has-text("NEXT")').first()
      await expect(nextBtn).toBeVisible()
      await nextBtn.click()
      await page.waitForTimeout(80) // ultra-short transition delay for skipping

      // Reload every 10 panels to keep memory low but fast
      if ((i + 1) % 10 === 0 && (i + 1) < totalPanels) {
        await page.reload({ waitUntil: 'load' })
        await page.waitForTimeout(1000)
      }
    }

    console.log('✅ Targeted scan complete! All target screenshots captured inside tests/screenshots/targeted/')
  })
})
