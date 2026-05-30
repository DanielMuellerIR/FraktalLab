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
const results: { tag: string; baseURL: string; sampleMs: number; gpu?: any; scenarios: FrameStats[]; memory?: any } = {
  tag: PERF_TAG,
  baseURL: BASE_URL,
  sampleMs: SAMPLE_MS,
  scenarios: [],
}

// Liest den echten GPU-Renderer aus (WEBGL_debug_renderer_info). Zeigt z.B.
// "Apple M5" bei echter GPU bzw. "...SwiftShader" / "ANGLE ... Software" bei
// Software-Rasterizer. Damit ist headless (Software) von headed-GPU klar
// unterscheidbar — Voraussetzung für eine valide 60-FPS-Aussage.
async function gpuRenderer(page: Page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return { renderer: 'no-webgl', vendor: '' }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    }
  })
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
    // GPU-Renderer einmal erfassen (entscheidet, ob die Zahlen GPU- oder
    // Software-rasterisiert sind).
    results.gpu = await gpuRenderer(page)
    console.log('[GPU]', JSON.stringify(results.gpu))
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

  // --- M-07: Review-Modus, 4-Panel-Seite mit Fraktal-Hero ---
  // Der vom Auftraggeber explizit genannte Akzeptanz-Fall (blueprint §33:
  // „Im Review-Modus (4 Panels) mit Fraktalen muss es eindeutig 60 FPS sein").
  // reviewIdx=15 = FractalView → Seite zeigt ALL_PANELS[12..15]
  // (FractalSwirl, AmiModPanel, SolarSystemPanel, FractalView).
  // Existiert NUR auf HEAD (Review-Modus kam mit 5264baf) → kein Baseline-Vergleich.
  test('M-07 review 4-panel fractal @1920', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('fraktallab_review_mode', 'true')
      localStorage.setItem('fraktallab_review_idx', '15')
    })
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(WARMUP_MS)
    const stats = await recordFrames(page, 'M-07 review 4-panel fractal @1920')
    console.log('[M-07]', JSON.stringify(stats))
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

  // --- M-06b: Leak-Diagnose — langer Lauf, Heap nach FORCED GC sampeln ---
  // Vor jedem Sample wird via CDP der GC erzwungen. Steigt der Heap NACH GC
  // monoton weiter = echter Leak (retained, nicht nur transienter Churn).
  // Plateaut er nach den ersten Samples = einmaliger Lazy-Init zusätzlicher
  // Panels, kein Leak. Trennt die beiden Erklärungen für B-3 aus PERF_NOTES.
  test('M-06b leak-diagnose @1920', async ({ page }) => {
    test.setTimeout(150_000)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('HeapProfiler.enable')
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL, { waitUntil: 'load' })
    await page.waitForTimeout(WARMUP_MS)

    const SAMPLES = 10          // Anzahl Messpunkte
    const INTERVAL_MS = 10_000  // Abstand zwischen den Samples
    const series: { t: number; afterGcMB: number }[] = []
    for (let i = 0; i < SAMPLES; i++) {
      await page.waitForTimeout(INTERVAL_MS)
      // GC erzwingen, kurz warten bis Collection durch ist, dann messen
      await cdp.send('HeapProfiler.collectGarbage')
      await page.waitForTimeout(300)
      const used = await heapUsed(cdp)
      series.push({ t: (i + 1) * (INTERVAL_MS / 1000), afterGcMB: +(used / 1048576).toFixed(2) })
    }

    // Lineare Regression über die Nach-GC-Serie → Steigung in MB/s.
    // Steigung nahe 0 = stabil (kein Leak), klar positiv = retained growth.
    const n = series.length
    const sumX = series.reduce((a, s) => a + s.t, 0)
    const sumY = series.reduce((a, s) => a + s.afterGcMB, 0)
    const sumXY = series.reduce((a, s) => a + s.t * s.afterGcMB, 0)
    const sumXX = series.reduce((a, s) => a + s.t * s.t, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const firstHalf = series.slice(0, Math.floor(n / 2))
    const secondHalf = series.slice(Math.floor(n / 2))
    const avg = (arr: typeof series) => arr.reduce((a, s) => a + s.afterGcMB, 0) / arr.length
    const diag = {
      series,
      slopeMBperSec: +slope.toFixed(4),
      firstHalfAvgMB: +avg(firstHalf).toFixed(2),
      secondHalfAvgMB: +avg(secondHalf).toFixed(2),
      verdict: slope > 0.02 ? 'LEAK-VERDACHT (retained growth)' : 'STABIL (Plateau → Einmal-Init)',
    }
    console.log('[M-06b]', JSON.stringify(diag))
    mkdirSync('tests/perf-results', { recursive: true })
    writeFileSync(`tests/perf-results/heap-profile-${PERF_TAG}.json`, JSON.stringify(diag, null, 2))
    expect(series.length).toBe(SAMPLES)
  })

  test.afterAll(async () => {
    // Schutz: bei gefilterten Läufen (z.B. -g "M-06b") sind keine Frame-Szenarien
    // gelaufen → NICHT die Vergleichs-JSON mit leeren Daten überschreiben.
    if (results.scenarios.length === 0 && !results.memory) {
      console.log('[PERF] Keine Frame-/Memory-Szenarien gelaufen — Vergleichs-JSON unangetastet.')
      return
    }
    mkdirSync('tests/perf-results', { recursive: true })
    const path = `tests/perf-results/${PERF_TAG}.json`
    writeFileSync(path, JSON.stringify(results, null, 2))
    console.log(`\n[PERF] Ergebnisse → ${path}`)
    if (results.gpu) console.log('[PERF] GPU:', results.gpu)
    console.table(results.scenarios)
    if (results.memory) console.log('[PERF] Memory:', results.memory)
  })
})
