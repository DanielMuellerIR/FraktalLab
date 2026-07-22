import { expect, test } from '@playwright/test'

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'

test('startet auch dann, wenn localStorage eine SecurityError wirft', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage blocked for test', 'SecurityError')
      },
    })
  })
  await page.goto(BASE_URL, { waitUntil: 'load' })
  await expect(page.getByText(/FRAKTALLAB/).first()).toBeVisible()
})

test('Audio-Kandidaten-Cleanup ist an die konkrete Registrierung gebunden', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'load' })
  const result = await page.evaluate(async () => {
    const audio = await import('/src/utils/audio-focus.ts?registration-regression')
    let oldStarts = 0
    let newStarts = 0
    const unregisterOld = audio.registerAudioCandidate('same-id', {
      start: () => { oldStarts += 1 },
      setMuted: () => undefined,
    })
    audio.registerAudioCandidate('same-id', {
      start: () => { newStarts += 1 },
      setMuted: () => undefined,
    })
    unregisterOld()
    audio.handleFirstGesture()
    return {
      oldStarts,
      newStarts,
      uniqueInstances: audio.createAudioInstanceId('sid') !== audio.createAudioInstanceId('sid'),
    }
  })
  expect(result).toEqual({ oldStarts: 0, newStarts: 1, uniqueInstances: true })
})

test('Ordner-Drop faellt bei Entry-Fehlern auf direkte Dateien zurueck', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'load' })
  const result = await page.evaluate(async () => {
    const dropped = await import('/src/utils/dropped-files.ts?drop-regression')
    const fallback = new File(['sid'], 'fallback.sid')
    const brokenEntry = {
      isFile: true,
      isDirectory: false,
      file: (_success: (file: File) => void, error: (reason: unknown) => void) => error(new Error('broken')),
    }
    const dataTransfer = {
      files: [fallback],
      items: [{ webkitGetAsEntry: () => brokenEntry }],
    } as unknown as DataTransfer
    const value = await dropped.collectDroppedFiles(dataTransfer)
    return { names: value.files.map(file => file.name), hadError: value.error instanceof Error }
  })
  expect(result).toEqual({ names: ['fallback.sid'], hadError: true })
})

test.describe('Mobile-Slotauswahl', () => {
  test.use({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })

  test('haelt Audio-, Dedup-, Aspect- und GL-Invarianten auch nach Navigation', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fraktallab_density', 'proxima'))
    await page.goto(BASE_URL, { waitUntil: 'load' })

    const readLayout = () => page.locator('[data-mobile-panel]').evaluateAll(elements =>
      elements.map(element => ({
        name: element.getAttribute('data-mobile-panel') ?? '',
        audio: element.getAttribute('data-mobile-audio') === 'true',
        gl: element.getAttribute('data-mobile-gl') === 'true',
        aspect: element.getAttribute('data-mobile-aspect') ?? '',
      })),
    )

    const assertInvariants = async () => {
      const slots = await readLayout()
      expect(slots.length).toBeGreaterThan(4)
      expect(slots.filter(slot => slot.audio)).toHaveLength(1)
      expect(new Set(slots.map(slot => slot.name)).size).toBe(slots.length)
      expect(slots.filter(slot => slot.gl).length).toBeLessThanOrEqual(11)
      // Proxima portrait erzeugt TALL-Zellen; ANY ist kompatibel. Audio bleibt
      // als hoeherrangige Exklusivitaetsgarantie vom Aspect-Test ausgenommen.
      expect(slots.filter(slot => !slot.audio && !['ANY', 'TEXT', 'TALL'].includes(slot.aspect))).toEqual([])
    }

    await assertInvariants()
    const nav = page.locator('[data-mobile-audio="false"] [role="button"]').first()
    await nav.click({ force: true })
    await page.waitForTimeout(500)
    await assertInvariants()
  })
})
