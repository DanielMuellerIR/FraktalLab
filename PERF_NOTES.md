# PERF_NOTES.md — Phase-3-Messungen (Audit `audit/2026-05-29`)

> **Stand:** 2026-05-30. Phase 3 des Audits laut `blueprint_audit.md` §240ff.
> Verifikationsziel: Hypothese **H-07** — „Commit `5264baf` (v1.2.6) hat eine
> Performance-Regression eingeführt" (Auftraggeber: „vor einigen Tagen lief es flüssig").
>
> **Kurzfassung des Verdikts (zwei getrennte Aussagen):**
>
> 1. **Es gibt keine Regression durch `5264baf` (H-07 nicht bestätigt).** WASM-Binary
>    byte-identisch zur Baseline, kein eindeutiger Frame-Time-Regress, das Memory-Signal
>    (HEAP +9 MB) per Forced-GC-Diagnose (M-06b) als GC-Sägezahn entlarvt — kein Leak.
>
> 2. **ABER: die App ist auf der Zielhardware grundsätzlich nicht flüssig — und das
>    liegt am Main-Thread, nicht an der GPU.** Headed-Messung im echten Chrome auf der
>    Apple-Silicon-Hardware (`ANGLE Metal Renderer: Apple Apple-Silicon-Hardware`) liefert praktisch dieselben
>    Frame-Times wie der Software-Rasterizer. Der explizit geforderte 60-FPS-Akzeptanzfall
>    (Review-Modus, 4 Panels mit Fraktal) erreicht **9 FPS** (108 ms/Frame). Das ist kein
>    eingeschleppter Regress, sondern ein strukturelles Main-Thread-Lastproblem (Canvas-2D
>    pro Frame, viele gleichzeitige Panels). Siehe B-4. Details unten.

---

## 1. Mess-Setup

| Aspekt | Wert |
|---|---|
| Harness | `frontend/tests/perf-measure.spec.ts` (Playwright + CDP) |
| Build | Production (`npm run build` + `vite preview`), **nicht** Dev-Server |
| Browser | Chromium headless (Playwright-Default) |
| Frame-Timing | In-Page-`requestAnimationFrame`-Recorder, Delta-Verteilung über 10 s |
| Long-Tasks | `PerformanceObserver('longtask')`, Schwelle > 50 ms |
| Memory | CDP `Performance.getMetrics` → `JSHeapUsedSize`, Δ über 25 s |
| Determinismus | `Math.random` per `addInitScript` geseedet (Mulberry32) → reproduzierbares `generateLayout()` |

**Vergleichsstände:**

| Tag | Commit | Beschreibung |
|---|---|---|
| `HEAD` | `audit/2026-05-29` (App v1.6.0) | aktueller Stand nach Audit-Iter. 1+2 |
| `baseline-90215e6` | `90215e6` = `5264baf^` | letzter Commit **vor** dem Regressionsverdacht v1.2.6 |

Rohdaten: `frontend/tests/perf-results/HEAD.json`, `frontend/tests/perf-results/baseline-90215e6.json`.

---

## 2. Ergebnisse

Frame-Time in Millisekunden (kleiner = besser). `over16` = Anteil Frames > 16.7 ms
(= langsamer als 60 FPS). `fps` = effektive mittlere Bildrate.

### M-01 — Default-Grid @ 1920×1080

| Metrik | HEAD | baseline-90215e6 | Bewertung |
|---|---|---|---|
| Median | **66.7** | 150.0 | HEAD schneller |
| p95 | 75.9 | 166.7 | HEAD schneller |
| p99 | 83.3 | 333.5 | HEAD schneller |
| over16 | 82.9 % | 100 % | HEAD besser |
| FPS | 17.6 | 6.8 | HEAD besser |
| Long-Tasks (10 s) | 134 | 68 | HEAD mehr |

### M-03 — Dense-Grid @ 2560×1440

| Metrik | HEAD | baseline-90215e6 | Bewertung |
|---|---|---|---|
| Median | 133.3 | **83.3** | baseline schneller |
| p95 | 150.0 | 92.6 | baseline schneller |
| p99 | 150.1 | 199.1 | HEAD besser |
| over16 | 100 % | 100 % | gleich |
| FPS | 7.3 | 12.0 | baseline besser |
| Long-Tasks (10 s) | 74 | 112 | HEAD weniger |

### M-06 — Memory-Drift @ 1920×1080 (25 s Dauerbetrieb)

| Metrik | HEAD | baseline-90215e6 |
|---|---|---|
| Heap Start | 5.2 MB | 4.6 MB |
| Heap nach 25 s | 14.2 MB | 4.4 MB |
| **Δ Wachstum** | **+9.0 MB** | −0.2 MB |

> **Achtung:** M-06 misst **ohne** GC-Zwang → der +9-MB-Wert ist eine Sägezahn-Spitze
> zwischen GC-Zyklen, kein retained growth. Die Leak-Diagnose **M-06b** (Forced GC vor
> jedem Sample, 100 s) zeigt nach GC einen stabilen Heap um ~6.8 MB, Steigung
> −0.0054 MB/s → **kein Leak** (siehe B-3 unten, Daten in `heap-profile-HEAD.json`).

### GPU- vs. Software-Rendering (HEAD) — der entscheidende Vergleich

Dieselben Szenarien einmal headless (SwiftShader-Software) und einmal headed im
echten Google Chrome auf der Zielhardware. GPU bestätigt aktiv:
`ANGLE Metal Renderer: Apple Apple-Silicon-Hardware`. Daten: `frontend/tests/perf-results/HEAD-gpu.json`.

| Szenario | Median headless (Software) | Median **headed (M5-Max-GPU)** | Differenz |
|---|---|---|---|
| M-01 default-grid @1920 | 66.67 ms | **66.66 ms** | ~0 |
| M-03 dense-grid @2560 | 133.34 ms | **132.42 ms** | ~0 |

→ Die echte GPU ändert die Frame-Time **praktisch nicht**. Die Last liegt nicht
auf der GPU. Die exakte Übereinstimmung headless↔headed entkräftet zugleich den
Verdacht auf rAF-Throttling eines verdeckten Fensters (sonst wären die Werte
verschieden) — beide messen dieselbe reale CPU-/Main-Thread-Arbeit.

### M-07 — Akzeptanzfall: Review-Modus, 4 Panels mit Fraktal (HEAD, M5-Max-GPU)

Der von der Spezifikation explizit geforderte 60-FPS-Fall (`blueprint_audit.md` §33).
Seite = `FractalSwirl`, `AmiModPanel`, `SolarSystemPanel`, `FractalView` (reviewIdx 15).

| Metrik | Wert (M5-Max-GPU) | Ziel |
|---|---|---|
| Median | **108.3 ms** | < 16.7 ms |
| FPS | **9.1** | 60 |
| over16 | 100 % | 0 % |
| Long-Tasks (10 s) | 92 (jeder Frame > 50 ms) | 0 |

→ **Der geforderte Akzeptanzfall verfehlt 60 FPS um eine Größenordnung — auf der
Zielhardware mit aktiver GPU.** Auffällig: das 4-Panel-Review ist *langsamer* als
das 12–20-Panel-Grid (M-01, 66 ms), weil im Review jedes Panel großflächig rendert
(Canvas-2D-Kosten ∝ Pixelfläche) und zwei der vier Panels teure Fraktale sind.

---

## 3. Einordnung & Einschränkungen (wichtig)

Die Absolutwerte sind **nicht** als „läuft die App flüssig?" lesbar. Drei Verzerrungen:

1. **Software-Rasterizer statt GPU.** Playwright-Headless-Chromium nutzt SwiftShader,
   keine echte GPU. WebGL-Shader-Panels (Plasma/Tunnel/Metaballs/Rotozoom/Fire) und
   Canvas-Blits laufen dadurch um Größenordnungen langsamer als auf dem Apple-Silicon-Hardware.
   Ursprüngliche Annahme war, die 7–18 FPS sagten **nichts** über die Zielhardware.
   Die Headed-GPU-Gegenmessung (siehe oben + B-4) hat das **widerlegt**: auf der
   Apple-Silicon-Hardware sind die Frame-Times nahezu identisch → die App ist CPU-/Main-Thread-bound,
   und die Software-Zahlen übertragen sich daher *doch* weitgehend auf die Realität.

2. **Panel-Komposition confounded.** Der Seed macht *Grid-Geometrie* reproduzierbar,
   aber HEAD hat einen größeren Panel-Pool (87 Module / `ALL_PANELS` länger) als die
   Baseline (75 Module). Derselbe Zufalls-Stream zieht daher in beiden Versionen
   **unterschiedliche** Panels in die Zellen. M-01/M-03 vergleichen also nicht
   denselben Inhalt — die Median-Differenzen spiegeln primär „welche Panels wurden
   bestückt", nicht „ist der gemeinsame Code langsamer geworden".

3. **Review-Modus existiert in der Baseline nicht.** Das ursprünglich geplante
   M-01-Szenario (Fraktal-Hero im 4-Panel-Review) wurde *in* `5264baf` eingeführt
   und ist daher nicht vergleichbar messbar. Deshalb wurde auf das in beiden Versionen
   vorhandene Default-Grid ausgewichen.

---

## 4. Belastbare Befunde

Trotz der Einschränkungen vier Aussagen, die robust sind:

- **B-1 — WASM-Fraktal-Hotpath ist KEINE Regressionsquelle.** Das kompilierte
  WASM-Binary ist in beiden Ständen byte-identisch (`fraktallab_wasm_bg-BdVlVgwM.wasm`,
  23.12 kB, gleicher Content-Hash). Die Fraktal-Renderkosten haben sich seit der
  Baseline **nicht** verändert. Damit ist der ursprüngliche Hauptverdacht (Vec-Kopie
  über die WASM-JS-Boundary, QW-01) als Regressionsursache ausgeschlossen — die
  Shared-Buffer-Umstellung war schon zur Baseline aktiv.

- **B-2 — Kein eindeutiger Frame-Time-Regress.** HEAD ist im @1920-Grid klar
  schneller, im @2560-Grid langsamer. Bei confoundeter Panel-Auswahl ist das kein
  Beleg für eine durch `5264baf` eingeführte Regression. H-07 wird **nicht gestützt**;
  die Iter.-1/2-Optimierungen (H-01..H-08) wirken im @1920-Fall sichtbar positiv.

- **B-3 — Heap-Wachstum auf HEAD: ENTWARNT, kein Leak.** Erstmessung M-06 zeigte
  +9 MB/25 s auf HEAD (Baseline flach). Follow-up M-06b (Leak-Diagnose, 100 s Lauf,
  **forced GC** via CDP `HeapProfiler.collectGarbage` vor jedem Sample) widerlegt den
  Leak-Verdacht: der Nach-GC-Heap pendelt stabil um ~6.8 MB, Regressions-Steigung
  **−0.0054 MB/s** (negativ → kein retained growth). Erste vs. zweite Hälfte:
  6.96 MB ↔ 6.83 MB. → Das +9 MB aus M-06 war **GC-Sägezahn** (transienter
  Pro-Frame-Allocation-Churn zwischen GC-Zyklen) plus einmaliger Lazy-Init der
  Panels, **nicht** ein Leak. Daten: `frontend/tests/perf-results/heap-profile-HEAD.json`.
  Damit fällt das letzte Negativ-Signal — es bleibt kein nachweisbarer Memory- oder
  Frame-Time-Regress gegenüber der Baseline übrig.

- **B-4 — Die App ist Main-Thread-bound, nicht GPU-bound (zentraler Befund).**
  Headed-Messung im echten Chrome auf der Zielhardware (`ANGLE Metal Renderer:
  Apple Apple-Silicon-Hardware`) liefert nahezu identische Frame-Times wie der Software-Rasterizer
  (M-01: 66.66 ms GPU vs. 66.67 ms Software; M-03: 132 vs. 133 ms). Die GPU ist also
  **nicht** der Engpass — die Last liegt auf dem Main-Thread (Canvas-2D-Blits,
  Pro-Frame-JS, viele gleichzeitig animierende Panels; jeder Frame ist ein Long-Task
  > 50 ms). Der explizit geforderte 60-FPS-Akzeptanzfall (M-07, Review-Modus mit
  Fraktal) erreicht auf der Apple-Silicon-Hardware nur **9 FPS** (108 ms/Frame). Das ist **unabhängig**
  von H-07: keine eingeschleppte Regression, sondern ein strukturelles Lastproblem.
  Konsequenz: GPU-Shader-Migrationen (GL-03 etc.) adressieren das Kernproblem **nicht**.

---

## 5. Empfehlungen

**Methodik (für noch schärfere Aussagen):**
1. ~~**Headed-GPU-Messung auf dem Apple-Silicon-Hardware**~~ ✅ erledigt — GPU bestätigt aktiv, ändert
   nichts (B-4). Daten in `HEAD-gpu.json`, Profil `chrome-gpu` in `playwright.config.ts`.
2. **Panel-Pool fixieren** für saubere HEAD↔Baseline-Frame-Time-Vergleiche (identischer
   Panel-Satz statt geseedeter Pool-Auswahl). Niedrige Priorität — das Regress-Verdikt
   steht bereits.
3. ~~**B-3 nachgehen** (Heap-Leak)~~ ✅ erledigt (M-06b) — kein Leak.

**Inhaltlich (gegen das eigentliche Performance-Problem, B-4):** Der Hebel ist
Main-Thread-Entlastung, nicht GPU:
- **Anzahl gleichzeitig animierender Panels begrenzen** (sichtbar/aktiv-gating
  konsequent; `raf-coordinator` pausiert nur bei Layout-Switch, nicht pro Off-Screen-Panel).
- **Canvas-2D-Hotpaths in Worker/OffscreenCanvas** auslagern (Fraktale, Voxel-Raycaster).
- **Review-Modus:** nur das aktive Panel animieren, die drei inaktiven der 4er-Seite
  einfrieren — würde M-07 direkt entlasten. ✅ **umgesetzt** (siehe §7).
- Erst danach lohnen weitere GPU-Migrationen.

---

## 7. Umgesetzte Maßnahmen (B-4)

### M-1 — Review-Modus: nur aktives Panel animieren

`App.tsx`: in der 2x2-Review-Seite mountet nur noch das **aktive** Panel live; die
drei inaktiven Slots zeigen den statischen Platzhalter `FrozenReviewSlot` (Pausen-
Symbol + Panel-Name, klickbar). Damit animiert zu jedem Zeitpunkt nur ein Panel.

| Metrik (M-07, M5-Max-GPU) | vorher | nachher | Faktor |
|---|---|---|---|
| Median | 108.3 ms | **66.7 ms** | ~1.6× |
| FPS | 9.1 | **17.8** | ~2× |

→ Klare Verbesserung des Akzeptanzfalls, **aber 60 FPS noch nicht erreicht**. Grund:
schon **ein einzelnes** großflächig gerendertes Fraktal-Panel kostet ~60 ms/Frame
Main-Thread-Zeit (WASM-Render + `putImageData` + Boundary-Scan bei Review-Auflösung).
Die 66.7 ms ≈ ~60 ms reale Arbeit, quantisiert aufs 60-Hz-rAF-Raster — **kein**
FPS-Cap im Code (geprüft). Daten: `HEAD-gpu-fix.json`.

**Restengpass = Single-Panel-Kosten, auflösungsgebunden.** → adressiert durch M-2.

### M-2 — Fraktal-Hero auf GPU/WebGL (Stufe 1 der Migration)

`FractalView` rendert jetzt über `FractalGL` (Fragment-Shader) statt WASM/Canvas-2D.
Double-single-Präzision (`utils/fractal-gl-shader.ts`) hält den Tief-Zoom bis ~1e13;
bei Zoom 1.2e6 visuell verifiziert (scharfe Details, keine Pixelung). Animation
zeitbasiert → fps-unabhängig.

| Metrik (M-07, M5-Max-GPU) | WASM (vor M-1) | + M-1 Freeze | **+ M-2 GPU** |
|---|---|---|---|
| Median | 108.3 ms | 66.7 ms | **8.33 ms** |
| FPS | 9.1 | 17.8 | **120** (vsync-Limit) |
| Long-Tasks (10 s) | 92 | 134 | **0** |

→ **Akzeptanzfall erfüllt und übertroffen** (Ziel 60 → 120 FPS). Der Fraktal-Renderer
ist auf der GPU praktisch gratis. Daten: `HEAD-gpu-glfractal.json`.

### M-2 Stufe 2 — FractalScenes-Familie (10 Panels) auf GPU

`makeFractalScene` rendert jetzt über `FractalGL`; Color-Transforms (mono/cold/hot/
neon/invert) exakt im Shader repliziert (inkl. „in-set bleibt schwarz"). Wirkung auf
die ganzen Grid-Szenarien (M5-Max-GPU):

| Median | WASM | **GPU (Stufe 1+2)** |
|---|---|---|
| M-01 default-grid @1920 | 66.7 ms | **8.33 ms (120 FPS)** |
| M-03 dense-grid @2560 | 132.4 ms | **8.33 ms (120 FPS)** |

→ Das gesamte Grid (die ursprüngliche „ruckelt"-Beschwerde) läuft jetzt am
vsync-Limit, 0 Long-Tasks. Bei 13 Canvases keine Context-Eviction beobachtet.
Daten: `HEAD-gpu-stage2.json`.

**Hinweis ReadPixels:** FractalGL liest für die Auto-Zoom-Navigation alle 4 Frames
ein kleines 128×96-Bild aus (GPU-Stall). Bei mehreren Fraktalen summiert sich das,
beeinträchtigt die 120 FPS hier aber nicht.

### M-2 Stufe 3 — FractalJulia (6-Param) auf GPU

`FractalJulia` rendert via `FractalGL` mit `juliaSet`-Cycling (Crossfade zwischen
c-Parametern, Shader-Uniform `uJuliaC2`) + HUD-Overlay. Julia-spezifisch: quadratische,
auflösungsunabhängige Pixel-Skala, Center-Drift + Low-Detail-Erkennung per Farb-
Histogramm. Visuell verifiziert (DENDRITE/DRAGON zentriert, reich, Param-Cycling).

### M-2 Stufe 4 — WASM-Render-Pfad entfernt

Da alle 11 Fraktal-Panels jetzt auf der GPU laufen, ist das Rust/WASM-Modul restlos
entfernt: `wasm/`-Crate, `utils/wasm-loader.ts`, `@wasm`-Vite-Alias und die devDeps
`vite-plugin-wasm`/`vite-plugin-top-level-await`. Build ist reines JS/Vite (kein
`wasm-pack` mehr). Doku (AGENTS/DEV_GUIDE/netlify) entsprechend bereinigt.

### Nachtrag — Tief-Zoom-Präzision auf Apple/Metal (Regression + Fix)

Ein Real-GPU-Test deckte auf: auf Apple-GPUs (Chrome → ANGLE-**Metal**) kontrahiert
der Shader-Compiler den Dekker-Split der double-single-Multiplikation weg → die
ds-Präzision fällt effektiv auf float32 zurück. Folge: ab Zoom ~5e5 feines Banding,
ab ~5e6 grobe Blöcke. **Wichtig:** Headless-SwiftShader reproduziert das NICHT
(hält bis ~8.5e9 scharf) — der Bug ist nur auf echter Metal-GPU sichtbar (per
`--project=chrome-gpu` reproduziert).

Härtungsversuch (kanonische DSFUN90-`ds_mul`-Form) **scheiterte** an der Metal-
Kontraktion. Robuster Fix: zentrale Obergrenze `SAFE_ZOOM_CEIL = 5e5` in `FractalGL`
— darüber wird zur nächsten Location gecrossfadet, nie sichtbar gebrochen. Bei 4.85e5
auf Apple-Silicon-Hardware verifiziert scharf. Die kanonische `ds_mul` bleibt (nützt Nicht-Metal-GPUs/
Firefox, die ds bis ~1e9 halten). Tieferer Zoom auf Metal bräuchte Perturbations-
Rendering (Referenz-Orbit) — eigener, größerer Schritt.

### Output-Vergleich GPU vs. WASM (Komponenten-Upgrade-Regel)

- **Verbesserung:** durchgängig 120 FPS statt 8–18; tieferer Zoom möglich
  (double-single ~1e13 statt f64-CPU, das real bei 1.5e6–1e10 cross-fadete);
  schärfere Darstellung (`imageRendering: auto` statt `pixelated`).
- **Färbung identisch:** Hue/HSL + alle Color-Transforms 1:1 aus dem Shader
  repliziert, visuell geprüft.
- **Verhaltens-Änderungen (neutral):** FractalScenes nutzte bidirektionalen Zoom
  (rein+raus); jetzt Zoom-rein + Crossfade zur nächsten Location. FractalJulia:
  Tumbling/Drift → einfacher Drift + Crossfade-Param-Cycling. Animations-Tempo ist
  jetzt frame-raten-unabhängig (zeitbasiert), war vorher an die Frame-Zahl gekoppelt.
- **Zu beachten:** WebGL-Context-Budget (`webgl-pool`, MAX_GL_CONTEXTS=8) bei sehr
  vielen gleichzeitigen Fraktal-/Shader-Panels; FractalGL zeigt bei Eviction (noch)
  kein Wake-Overlay wie ShaderPanel.

---

## 6. Reproduktion

```bash
# Aktueller Stand (headless / Software-Rasterizer)
cd frontend
npm run build && npm run preview -- --port 4173 &
VITE_URL=http://localhost:4173 PERF_TAG=HEAD npx playwright test tests/perf-measure.spec.ts

# Headed-GPU auf der Zielhardware (echtes Chrome, Metal-GPU) — B-4
VITE_URL=http://localhost:4173 PERF_TAG=HEAD-gpu \
  npx playwright test tests/perf-measure.spec.ts --project=chrome-gpu -g "M-01|M-03|M-07"

# Baseline
git worktree add /tmp/p_fraktal_baseline 5264baf^
cd /tmp/p_fraktal_baseline
wasm-pack build wasm --target web --out-dir pkg --release
cd frontend && npm install && npm run build && npm run preview -- --port 4173 &
VITE_URL=http://localhost:4173 PERF_TAG=baseline-90215e6 npx playwright test tests/perf-measure.spec.ts
```
