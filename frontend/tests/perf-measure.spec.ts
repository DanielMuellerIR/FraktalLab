/**
 * Performance-Mess-Suite für FraktalLab — Phase 3 des Audits (blueprint_audit.md §240ff).
 *
 * Ziel: Frame-Time-Verteilung, Long-Tasks und Heap-Wachstum unter Last messen,
 * und zwar so, dass dieselbe Spec sowohl auf dem aktuellen Stand (HEAD) als auch
 * auf einem Baseline-Checkout (Worktree für `5264baf^`) läuft → direkter
 * Vorher/Nachher-Vergleich zur Verifikation der Regressions-Hypothese H-07.
 *
 * Mess-Prinzip (version-agnostisch, ohne Zugriff auf App-Interna):
 *   - Wir seeden `Math.random` per `addInitScript` VOR dem Laden der App, damit
 *     `generateLayout()` deterministisch dasselbe Grid erzeugt. So ist das Layout
 *     in beiden Versionen reproduzierbar (Panel-Pool unterscheidet sich versions-
 *     bedingt — das ist eine bewusst dokumentierte Einschränkung, siehe PERF_NOTES).
 *   - Ein in die Seite injizierter `requestAnimationFrame`-Recorder sammelt die
 *     Zeit-Deltas zwischen den Frames. Daraus berechnen wir Median, 95-Perzentil,
 *     Anteil der Frames über 16.6 ms (= unter 60 FPS) und die effektive FPS.
 *   - Ein `PerformanceObserver('longtask')` zählt Long-Tasks > 50 ms (Haupt-Thread-
 *     Blockaden, die als Ruckler sichtbar werden).
 *   - `Performance.metrics()` über CDP liefert `JSHeapUsedSize` für das Memory-Profil.
 *
 * Ausführen (Production-Build vorausgesetzt — Dev-Build verzerrt die Messung):
 *   npm run build && npm run preview -- --port 4173
 *   VITE_URL=http://localhost:4173 PERF_TAG=HEAD \
 *     npx playwright test tests/perf-measure.spec.ts
 *
 * Ergebnisse landen als JSON in tests/perf-results/<PERF_TAG>.json.
 */
import { test, expect, Page, CDPSession } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:4173'
// Tag identifiziert den gemessenen Stand (z.B. "HEAD" oder "5264baf-parent")
const PERF_TAG = process.env.PERF_TAG ?? 'HEAD'
// Mess-Dauer pro Frame-Szenario in Millisekunden
const SAMPLE_MS = Number(process.env.PERF_SAMPLE_MS ?? 10_000)
// Aufwärmzeit, bis WASM geladen und alle rAF-Loops angelaufen sind
const WARMUP_MS = 6_000

// ------------------------------------------------------------------
// Seeded PRNG (Mulberry32) — als String, der per addInitScript in die
// Seite injiziert wird. Überschreibt Math.random VOR dem App-Bundle,
// damit generateLayout() deterministisch wird.
// ------------------------------------------------------------------
const SEED_SCRIPT = `(() => {
  let s = 0x9e3779b9 >>> 0;            // fixer Seed → reproduzierbares Layout
  Math.random = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`

// ------------------------------------------------------------------
// rAF-Frametime-Recorder — wird per addInitScript früh registriert, sodass
// window.__perf bereits existiert, bevor irgendein Panel-Code läuft. Wir
// hängen uns NICHT in fremde rAF-Callbacks ein, sondern führen einen eigenen
// kontinuierlichen rAF-Loop, der reine Frame-Deltas misst (= Anzeige-Takt).
// ------------------------------------------------------------------
const RECORDER_SCRIPT = `(() => {
  const perf = { deltas: [], longTasks: 0, longTaskMax: 0, recording: false, last: 0 };
  window.__perf = perf;
  function loop(ts) {
    if (perf.recording) {
      if (perf.last > 0) perf.deltas.push(ts - perf.last);
      perf.last = ts;
    } else {
      perf.last = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!perf.recording) continue;
        perf.longTasks++;
        if (e.duration > perf.longTaskMax) perf.longTaskMax = e.duration;
      }
    });
    obs.observe({ entryTypes: ['longtask'] });
  } catch (_) { /* longtask nicht überall verfügbar */ }
})();`

// ------------------------------------------------------------------
// Statistik-Helfer (laufen im Node-Kontext über die ausgelesenen Deltas)
// ------------------------------------------------------------------
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

interface FrameStats {
  scenario: string
  frames: number
  median: number
  p95: number
  p99: number
  max: number
  over16: number        // Anteil Frames > 16.6 ms (Prozent)
  fps: number           // effektive FPS = 1000 / mittleres Delta
  longTasks: number
  longTaskMax: number
}

// Startet die Aufzeichnung, wartet SAMPLE_MS, liest die Deltas aus und rechnet.
async function recordFrames(page: Page, scenario: string): Promise<FrameStats> {
  await page.evaluate(() => {
    const p = (window as any).__perf
    p.deltas = []; p.longTasks = 0; p.longTaskMax = 0; p.last = 0
    p.recording = true
  })
  await page.waitForTimeout(SAMPLE_MS)
  const raw = await page.evaluate(() => {
    const p = (window as any).__perf
    p.recording = false
    return { deltas: p.deltas as number[], longTasks: p.longTasks as number, longTaskMax: p.longTaskMax as number }
  })

  const sorted = [...raw.deltas].sort((a, b) => a - b)
  const sum = raw.deltas.reduce((a, b) => a + b, 0)
  const mean = raw.deltas.length ? sum / raw.deltas.length : 0
  const over = raw.deltas.filter(d => d > 16.7).length
  return {
    scenario,
    frames: raw.deltas.length,
    median: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    p99: +percentile(sorted, 99).toFixed(2),
    max: +(sorted[sorted.length - 1] ?? 0).toFixed(2),
    over16: +(raw.deltas.length ? (100 * over) / raw.deltas.length : 0).toFixed(1),
    fps: +(mean ? 1000 / mean : 0).toFixed(1),
    longTasks: raw.longTasks,
    longTaskMax: +raw.longTaskMax.toFixed(1),
  }
}

// Liest JSHeapUsedSize (Bytes) über CDP Performance.metrics()
async function heapUsed(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const m = metrics.find(x => x.name === 'JSHeapUsedSize')
  return m ? m.value : 0
}

// ------------------------------------------------------------------
// Ergebnis-Sammler — alle Szenarien schreiben in dieses Objekt, das am Ende
// der Suite als JSON rausgeschrieben wird.
// ------------------------------------------------------------------
const results: { tag: string; baseURL: string; sampleMs: number; scenarios: FrameStats[]; memory?: any } = {
  tag: PERF_TAG,
  baseURL: BASE_URL,
  sampleMs: SAMPLE_MS,
  scenarios: [],
}

test.describe.configure({ mode: 'serial' })

test.describe(`Perf-Messung [${PERF_TAG}]`, () => {
  test.beforeEach(async ({ page }) => {
    // Seed + Recorder injizieren BEVOR App-Bundle lädt
    await page.addInitScript(SEED_SCRIPT)
    await page.addInitScript(RECORDER_SCRIPT)
    page.on('pageerror', err => console.error('[BROWSER-ERROR]', err.message))
  })

  // --- M-01: Default-Grid @1920×1080 (seeded, enthält Fraktal-Hero) ---
  // Existiert in beiden Versionen → primärer Vergleichswert.
  test('M-01 default-grid @1920', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(WARMUP_MS)
    const stats = await recordFrames(page, 'M-01 default-grid @1920')
    console.log('[M-01]', JSON.stringify(stats))
    results.scenarios.push(stats)
    expect(stats.frames, 'rAF-Loop muss Frames liefern').toBeGreaterThan(30)
  })

  // --- M-03: GFX-dichtes Grid @2560×1440 (mehr Panels, schwerere Last) ---
  // Größerer Viewport → generateLayout wählt 5×4/6×4 → mehr gleichzeitige Panels.
  test('M-03 dense-grid @2560', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 })
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(WARMUP_MS)
    const stats = await recordFrames(page, 'M-03 dense-grid @2560')
    console.log('[M-03]', JSON.stringify(stats))
    results.scenarios.push(stats)
    expect(stats.frames).toBeGreaterThan(30)
  })

  // --- M-06: Memory-Profil — Heap vor/nach 25 s Dauerbetrieb ---
  // Wachsender Heap = Leak oder Pro-Frame-Allokation.
  test('M-06 memory drift @1920', async ({ page }) => {
    // 6 s Warmup + 25 s Drift + Overhead → über dem 30-s-Default. Eigenes Limit.
    test.setTimeout(60_000)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(WARMUP_MS)
    const before = await heapUsed(cdp)
    await page.waitForTimeout(25_000)
    const after = await heapUsed(cdp)
    const mem = {
      heapBeforeMB: +(before / 1048576).toFixed(2),
      heapAfterMB: +(after / 1048576).toFixed(2),
      growthMB: +((after - before) / 1048576).toFixed(2),
    }
    console.log('[M-06]', JSON.stringify(mem))
    results.memory = mem
    expect(after).toBeGreaterThan(0)
  })

  test.afterAll(async () => {
    mkdirSync('tests/perf-results', { recursive: true })
    const path = `tests/perf-results/${PERF_TAG}.json`
    writeFileSync(path, JSON.stringify(results, null, 2))
    console.log(`\n[PERF] Ergebnisse → ${path}`)
    console.table(results.scenarios)
    if (results.memory) console.log('[PERF] Memory:', results.memory)
  })
})
