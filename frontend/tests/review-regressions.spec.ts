import { expect, test, type Page } from '@playwright/test'

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5174'

async function prepareProximaMobile(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('fraktallab_density', 'proxima')
    localStorage.setItem('fraktallab_reset_version', 'v1.1.0-reset-2')
    localStorage.setItem('fraktallab_reviews_seeded_2026_05_30', 'true')
    localStorage.setItem('fraktallab_reactivate_2026_06_01', 'true')
  })
}

async function preferPanel(page: Page, preferredName: string) {
  await page.evaluate(async name => {
    const registry = await import('/src/panels/panel-registry.ts?mobile-preference')
    const reviews = registry.PANELS.map((panel: { name: string }) => ({
      panel: panel.name,
      rating: panel.name === name ? 'up' : 'down',
      comment: '',
      ts: 1,
    }))
    localStorage.setItem('fraktallab_reviews', JSON.stringify(reviews))
  }, preferredName)
}

async function clickMobilePill(page: Page, key: string) {
  const tile = page.locator(`[data-mobile-slot="${key}"]`)
  await expect(tile).toBeVisible({ timeout: 3000 })
  await tile.click({ position: { x: 4, y: 4 } })
  await expect(tile.locator('[role="button"]')).toBeVisible()
  await tile.locator('[role="button"]').click()
}

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

test('erneuter Drop eines bekannten MODs behaelt die Trackliste identisch', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'load' })
  const result = await page.evaluate(async () => {
    const panel = await import('/src/panels/AmiModPanel.tsx')
    const prev = [{ id: 'user:song.mod:42', name: 'song', url: 'blob:song', isUser: true }]
    // Gleiche Datei erneut gedroppt: gleiche id, aber frisch erzeugte Object-URL.
    const duplicate = panel.mergeUserTracks(prev, [
      { id: 'user:song.mod:42', name: 'song', url: 'blob:song-neu', isUser: true },
    ])
    const added = panel.mergeUserTracks(prev, [
      { id: 'user:other.mod:7', name: 'other', url: 'blob:other', isUser: true },
    ])
    return {
      // Identitaet erhalten → allTracks bleibt stabil → der Lade-Effect laeuft
      // NICHT erneut und stoppt den laufenden Track nicht.
      duplicateKeepsArrayIdentity: duplicate === prev,
      duplicateLength: duplicate.length,
      addedIsNewArray: added !== prev,
      addedLength: added.length,
    }
  })
  expect(result).toEqual({
    duplicateKeepsArrayIdentity: true,
    duplicateLength: 1,
    addedIsNewArray: true,
    addedLength: 2,
  })
})

test.describe('Mobile-Slotauswahl', () => {
  test.use({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })

  test('haelt Audio-, Dedup-, Aspect- und GL-Invarianten auch nach Navigation', async ({ page }) => {
    await prepareProximaMobile(page)
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

  test('Panelwechsel eines Zusatz-Slots laesst Audio- und Nachbarslots stehen', async ({ page }) => {
    await prepareProximaMobile(page)
    await page.goto(BASE_URL, { waitUntil: 'load' })

    const readSlots = () => page.locator('[data-mobile-slot]').evaluateAll(elements =>
      elements.map(element => ({
        key: element.getAttribute('data-mobile-slot') ?? '',
        name: element.getAttribute('data-mobile-panel') ?? '',
        audio: element.getAttribute('data-mobile-audio') === 'true',
      })),
    )

    const before = await readSlots()
    // Zusatz-Slots sind die ohne eigenen Vorzugs-Index; ihr Schluessel beginnt
    // mit gfx-extra- bzw. text-extra-.
    const extra = before.find(slot => /^(gfx|text)-extra-/.test(slot.key))
    expect(extra, 'Proxima-Mobile muss Zusatz-Slots erzeugen').toBeTruthy()

    const tile = page.locator(`[data-mobile-slot="${extra!.key}"]`)
    // Mobile: Pille erscheint erst nach Antippen der Kachel (3 s sichtbar).
    await tile.click({ position: { x: 4, y: 4 } })
    await tile.locator('[role="button"]').click()

    // PanelSlot blendet 300 ms aus, bevor onNav feuert.
    await expect
      .poll(async () => (await readSlots()).find(slot => slot.key === extra!.key)?.name,
            { timeout: 5000 })
      .not.toBe(extra!.name)

    const after = await readSlots()
    const changed = after.filter(slot => {
      const previous = before.find(p => p.key === slot.key)
      return !previous || previous.name !== slot.name
    })
    // Genau der angeklickte Slot hat gewechselt.
    expect(changed.map(slot => slot.key)).toEqual([extra!.key])
    // Der gelockte Audio-Slot bleibt derselbe — frueher wuerfelte dieser Pfad
    // die komplette Mobile-Auswahl neu und riss laufendes Audio mit.
    expect(after.find(slot => slot.audio)?.name).toBe(before.find(slot => slot.audio)?.name)
    expect(after.map(slot => slot.key)).toEqual(before.map(slot => slot.key))
  })

  test('manueller Klick wechselt auch bei vollem GL-Budget den Nicht-GL-Slot', async ({ page }) => {
    await prepareProximaMobile(page)
    await page.addInitScript(() => {
      // Determinismus: DNAHelix im primären Slot gfx2, FractalJulia in gfx3
      localStorage.setItem('fraktallab_initial_mobile_indices', JSON.stringify({
        textIdx: 0,
        gfxIdx1: 12,
        gfxIdx2: 33,
        gfxIdx3: 0,
      }))
    })
    await page.goto(BASE_URL, { waitUntil: 'load' })

    const readSlots = () => page.locator('[data-mobile-slot]').evaluateAll(elements =>
      elements.map(element => ({
        key: element.getAttribute('data-mobile-slot') ?? '',
        name: element.getAttribute('data-mobile-panel') ?? '',
        gl: element.getAttribute('data-mobile-gl') === 'true',
      })),
    )
    await expect(page.locator('[data-mobile-panel="LidarScanPanel"]')).toBeVisible()
    const before = await readSlots()
    expect(before).toHaveLength(15)
    expect(before.filter(slot => slot.gl)).toHaveLength(11)
    expect(before.find(slot => slot.name === 'DNAHelix')?.key).toBe('gfx2')
    const lidar = before.find(slot => slot.name === 'LidarScanPanel')!
    expect(lidar.key).toBe('gfx-extra-37')

    await clickMobilePill(page, lidar.key)
    await expect.poll(
      () => page.locator(`[data-mobile-slot="${lidar.key}"]`).getAttribute('data-mobile-panel'),
      { timeout: 5000 },
    ).toBe('DNAHelix')

    const after = await readSlots()
    expect(after.map(slot => slot.key)).toEqual(before.map(slot => slot.key))
    expect(after.filter(slot => slot.gl)).toHaveLength(11)
    expect(after.filter(slot => slot.name === 'DNAHelix')).toHaveLength(2)
    // gfx-extra-33 darf die Duplikatfreigabe nicht verbraucht haben
    expect(after.find(slot => slot.key === 'gfx-extra-33')).toBeUndefined()
    expect(after.filter((slot, index) => slot.name !== before[index].name).map(slot => slot.key))
      .toEqual([lidar.key])
  })

  test('manueller Klick auf primären GFX-Slot ersetzt nur diesen Eintrag ohne Zusatz-Slots zu verschieben', async ({ page }) => {
    await prepareProximaMobile(page)
    await page.addInitScript(() => {
      localStorage.setItem('fraktallab_initial_mobile_indices', JSON.stringify({
        textIdx: 0,
        gfxIdx1: 12,
        gfxIdx2: 0,
        gfxIdx3: 2,
      }))
    })
    await page.goto(BASE_URL, { waitUntil: 'load' })

    const readSlots = () => page.locator('[data-mobile-slot]').evaluateAll(elements =>
      elements.map(element => ({
        key: element.getAttribute('data-mobile-slot') ?? '',
        name: element.getAttribute('data-mobile-panel') ?? '',
        gl: element.getAttribute('data-mobile-gl') === 'true',
      })),
    )
    await expect(page.locator('[data-mobile-slot="gfx2"]')).toBeVisible()
    const before = await readSlots()
    expect(before).toHaveLength(15)
    expect(before.find(slot => slot.key === 'gfx2')?.name).toBe('FractalJulia')
    const swirlBefore = before.find(slot => slot.name === 'FractalSwirl')
    expect(swirlBefore, 'FractalSwirl in Initialbelegung vorhanden').toBeTruthy()

    await clickMobilePill(page, 'gfx2')
    await expect.poll(
      () => page.locator('[data-mobile-slot="gfx2"]').getAttribute('data-mobile-panel'),
      { timeout: 5000 },
    ).not.toBe('FractalJulia')

    const after = await readSlots()
    // Alle Slot-Schlüssel und ihre Reihenfolge bleiben exakt identisch
    expect(after.map(slot => slot.key)).toEqual(before.map(slot => slot.key))
    // Genau und nur gfx2 hat sein Panel gewechselt
    expect(after.filter((slot, index) => slot.name !== before[index].name).map(slot => slot.key))
      .toEqual(['gfx2'])
    // FractalJulia erscheint nicht fälschlich neu als gfx-extra-0
    expect(after.find(slot => slot.key === 'gfx-extra-0')).toBeUndefined()
    // Der unbeteiligte Slot mit FractalSwirl bleibt stabil vorhanden
    expect(after.find(slot => slot.key === swirlBefore!.key)?.name).toBe('FractalSwirl')
  })

  test('inkompatible Zusatz-Umleitung laesst nach Drehung keinen Slot verschwinden', async ({ page }) => {
    await prepareProximaMobile(page)
    await page.goto(BASE_URL, { waitUntil: 'load' })

    const readSlots = () => page.locator('[data-mobile-slot]').evaluateAll(elements =>
      elements.map(element => ({
        key: element.getAttribute('data-mobile-slot') ?? '',
        name: element.getAttribute('data-mobile-panel') ?? '',
        audio: element.getAttribute('data-mobile-audio') === 'true',
        aspect: element.getAttribute('data-mobile-aspect') ?? '',
      })),
    )
    await expect(page.locator('[data-mobile-slot]').first()).toBeVisible()

    // Falls das einzige TALL-Panel zufällig schon sichtbar ist, zuerst einen
    // freien ANY-GL-Kandidaten bevorzugen und diesen Slot wegschalten.
    let slots = await readSlots()
    const nuclear = slots.find(slot => slot.name === 'NuclearExplosionPanel')
    if (nuclear) {
      const away = await page.evaluate(async visibleNames => {
        const registry = await import('/src/panels/panel-registry.ts?mobile-away')
        return registry.PANELS.find(panel => (
          panel.active && panel.pool === 'gfx' && panel.aspect === 'ANY'
          && panel.gl && !panel.audio && !visibleNames.includes(panel.name)
        ))?.name ?? ''
      }, slots.map(slot => slot.name))
      expect(away, 'freies ANY-GL-Panel zum Vorbereiten des Tests').toBeTruthy()
      await preferPanel(page, away)
      await clickMobilePill(page, nuclear.key)
      await expect.poll(
        () => page.locator(`[data-mobile-slot="${nuclear.key}"]`).getAttribute('data-mobile-panel'),
        { timeout: 5000 },
      ).toBe(away)
    }

    slots = await readSlots()
    const source = slots.find(slot => (
      /^gfx-extra-/.test(slot.key) && !slot.audio && slot.aspect === 'ANY'
    ))
    expect(source, 'frueher ANY-Zusatzslot fuer die Umleitung').toBeTruthy()
    await preferPanel(page, 'NuclearExplosionPanel')
    await clickMobilePill(page, source!.key)
    await expect.poll(
      () => page.locator(`[data-mobile-slot="${source!.key}"]`).getAttribute('data-mobile-panel'),
      { timeout: 5000 },
    ).toBe('NuclearExplosionPanel')

    await page.setViewportSize({ width: 932, height: 430 })
    const rotated = page.locator(`[data-mobile-slot="${source!.key}"]`)
    await expect(rotated).toBeVisible({ timeout: 5000 })
    await expect(rotated).not.toHaveAttribute('data-mobile-panel', 'NuclearExplosionPanel')
    expect(await rotated.getAttribute('data-mobile-aspect')).toMatch(/^(ANY|WIDE)$/)
  })

  test('Zusatz-Slot waehlt bei Folgeklicks nie sein eigenes Panel erneut', async ({ page }) => {
    await prepareProximaMobile(page)
    await page.goto(BASE_URL, { waitUntil: 'load' })

    // Die Panelwahl ist normalerweise gewichteter Zufall. Ein heruntergedaumeltes
    // Panel bekommt Gewicht 0 und damit die feste Punktzahl -1 statt eines
    // Zufallswerts. Sind ALLE Panels heruntergedaumelt, haben alle Kandidaten
    // dieselbe Punktzahl; die stabile Sortierung nimmt dann immer den Kandidaten
    // mit dem kleinsten Pool-Index. Damit ist der Test deterministisch — ohne
    // Math.random anzufassen (das wuerde EnhancePhoto in eine Endlosschleife
    // schicken, weil es bei gleichem Zufallswert ewig weiterwuerfelt).
    // Die drei Migrations-/Reset-Schluessel setzt prepareProximaMobile bereits
    // VOR dem ersten App-Effect. Dadurch kann kein spaeter Reset die Reviews loeschen.
    await page.evaluate(async () => {
      const registry = await import('/src/panels/panel-registry.ts?extra-slot-regression')
      const reviews = registry.PANELS.map((panel: { name: string }) => (
        { panel: panel.name, rating: 'down', comment: '', ts: 1 }
      ))
      localStorage.setItem('fraktallab_reviews', JSON.stringify(reviews))
    })

    const nameOf = (key: string) =>
      page.locator(`[data-mobile-slot="${key}"]`).getAttribute('data-mobile-panel')

    await expect(page.locator('[data-mobile-slot]').first()).toBeVisible()
    const keys = await page.locator('[data-mobile-slot]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-mobile-slot') ?? ''),
    )
    const key = keys.find(candidate => /^(gfx|text)-extra-/.test(candidate))
    expect(key, 'Proxima-Mobile muss Zusatz-Slots erzeugen').toBeTruthy()

    // Regression: handleSkipMobileExtra nimmt den eigenen Namen bewusst aus der
    // Liste der schon sichtbaren Panels heraus, damit der frei werdende Platz
    // wieder zaehlt. Dadurch stand das Panel aber auch selbst wieder zur Wahl.
    // Mit der Determinierung oben faellt die Wahl dann spaetestens beim zweiten
    // Klick erneut auf dasselbe Panel: "naechstes Panel" tut sichtbar nichts.
    const tile = page.locator(`[data-mobile-slot="${key}"]`)
    for (let round = 1; round <= 5; round += 1) {
      await expect(tile, `Zusatz-Slot vor Klick ${round}`).toBeVisible({ timeout: 3000 })
      const before = await nameOf(key!)
      // Mobile: Die Pille erscheint erst nach Antippen der Kachel.
      await tile.click({ position: { x: 4, y: 4 } })
      await expect(tile.locator('[role="button"]')).toBeVisible()
      await tile.locator('[role="button"]').click()
      await expect
        .poll(() => nameOf(key!), { timeout: 3000, message: `Klick ${round} von 5` })
        .not.toBe(before)
    }
  })
})
