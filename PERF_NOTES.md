# PERF_NOTES.md — Phase-3-Messungen (Audit `audit/2026-05-29`)

> **Stand:** 2026-05-30. Phase 3 des Audits laut `blueprint_audit.md` §240ff.
> Verifikationsziel: Hypothese **H-07** — „Commit `5264baf` (v1.2.6) hat eine
> Performance-Regression eingeführt" (Auftraggeber: „vor einigen Tagen lief es flüssig").
>
> **Kurzfassung des Verdikts:** H-07 ist in dieser Form **nicht bestätigt**. Der
> WASM-Fraktal-Hotpath ist seit der Baseline byte-identisch; die gemessenen
> Frame-Time-Unterschiede sind durch Panel-Komposition und Software-Rendering
> verfälscht und zeigen keine eindeutige Regression. Ein klares, isolierbares
> Signal liefert nur das Memory-Profil (HEAD wächst, Baseline nicht). Details unten.

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

---

## 3. Einordnung & Einschränkungen (wichtig)

Die Absolutwerte sind **nicht** als „läuft die App flüssig?" lesbar. Drei Verzerrungen:

1. **Software-Rasterizer statt GPU.** Playwright-Headless-Chromium nutzt SwiftShader,
   keine echte GPU. WebGL-Shader-Panels (Plasma/Tunnel/Metaballs/Rotozoom/Fire) und
   Canvas-Blits laufen dadurch um Größenordnungen langsamer als auf dem Apple-Silicon-Hardware.
   Die 7–18 FPS hier sagen **nichts** über die 60-FPS-Realität auf der Zielhardware.
   Nur der **relative** Vergleich HEAD↔Baseline unter identischen Bedingungen ist gültig.

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

Trotz der Einschränkungen drei Aussagen, die robust sind:

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

- **B-3 — Heap-Wachstum auf HEAD, nicht auf Baseline.** Gleiche Messmethode, gleicher
  Viewport: HEAD wächst in 25 s um ~9 MB, Baseline bleibt flach. Das ist ein
  vergleichbares Signal und der einzige klare Negativ-Trend zugunsten der Baseline.
  Kandidaten: Pro-Frame-Allokationen oder akkumulierende Buffer in einem der nach
  `5264baf` hinzugekommenen Panels. **Follow-up wert** (siehe unten). Hinweis: Ein
  Teil kann einmaliger Lazy-Init zusätzlicher Panels sein — ein längerer Lauf
  (60–120 s) würde Leak von Einmal-Init trennen.

---

## 5. Empfehlungen für eine definitive Aussage

1. **Headed-GPU-Messung auf dem Apple-Silicon-Hardware** (beantwortet die eigentliche Geschäftsfrage):
   Playwright mit `headless:false`, `channel:'chrome'`, echter GPU. Erst dann ist die
   60-FPS-Aussage für „butterweich" valide.
2. **Panel-Pool fixieren** für saubere Frame-Time-Vergleiche: identischen Panel-Satz
   in beiden Ständen erzwingen (z. B. URL-Param oder Test-Hook), statt geseedeter
   Pool-Auswahl. Dann ist M-01/M-03 apples-to-apples.
3. **B-3 nachgehen:** M-06 mit 60–120 s Laufzeit + Heap-Snapshot-Diff, um die
   wachstumstreibenden Panels zu identifizieren.

---

## 6. Reproduktion

```bash
# Aktueller Stand
cd frontend
npm run build && npm run preview -- --port 4173 &
VITE_URL=http://localhost:4173 PERF_TAG=HEAD npx playwright test tests/perf-measure.spec.ts

# Baseline
git worktree add /tmp/p_fraktal_baseline 5264baf^
cd /tmp/p_fraktal_baseline
wasm-pack build wasm --target web --out-dir pkg --release
cd frontend && npm install && npm run build && npm run preview -- --port 4173 &
VITE_URL=http://localhost:4173 PERF_TAG=baseline-90215e6 npx playwright test tests/perf-measure.spec.ts
```
