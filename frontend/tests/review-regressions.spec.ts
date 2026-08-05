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

  test('Panelwechsel eines Zusatz-Slots laesst Audio- und Nachbarslots stehen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fraktallab_density', 'proxima'))
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

  test('Zusatz-Slot waehlt bei Folgeklicks nie sein eigenes Panel erneut', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fraktallab_density', 'proxima'))
    await page.goto(BASE_URL, { waitUntil: 'load' })

    // Die Panelwahl ist normalerweise gewichteter Zufall. Ein heruntergedaumeltes
    // Panel bekommt Gewicht 0 und damit die feste Punktzahl -1 statt eines
    // Zufallswerts. Sind ALLE Panels heruntergedaumelt, haben alle Kandidaten
    // dieselbe Punktzahl; die stabile Sortierung nimmt dann immer den Kandidaten
    // mit dem kleinsten Pool-Index. Damit ist der Test deterministisch — ohne
    // Math.random anzufassen (das wuerde EnhancePhoto in eine Endlosschleife
    // schicken, weil es bei gleichem Zufallswert ewig weiterwuerfelt).
    // Die beiden Migrations-Schluessel werden mitgesetzt, damit die Einmal-
    // Migrationen in App.tsx die gesetzten Reviews nicht wieder ueberschreiben.
    await page.evaluate(async () => {
      const registry = await import('/src/panels/panel-registry.ts?extra-slot-regression')
      const reviews = registry.PANELS.map((panel: { name: string }) => (
        { panel: panel.name, rating: 'down', comment: '', ts: 1 }
      ))
      localStorage.setItem('fraktallab_reviews', JSON.stringify(reviews))
      localStorage.setItem('fraktallab_reviews_seeded_2026_05_30', 'true')
      localStorage.setItem('fraktallab_reactivate_2026_06_01', 'true')
    })

    const nameOf = (key: string) =>
      page.locator(`[data-mobile-slot="${key}"]`).getAttribute('data-mobile-panel')

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
      const before = await nameOf(key!)
      // Mobile: Die Pille erscheint erst nach Antippen der Kachel.
      await tile.click({ position: { x: 4, y: 4 } })
      await tile.locator('[role="button"]').click()
      await expect
        .poll(() => nameOf(key!), { timeout: 3000, message: `Klick ${round} von 5` })
        .not.toBe(before)
    }
  })
})
