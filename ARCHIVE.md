# ARCHIVE.md — FraktalLab: erledigte Action-Plans

> Historischer Nachweis der abgeschlossenen Action-Plans (Stand Audit 2026-05-29/30).
> Ausgelagert aus `AGENTS.md` zur Verschlankung. **Alle hier gelisteten Punkte sind
> umgesetzt.** Aktueller Stand + Performance-Messungen: `AUDIT_FINDINGS.md`, `PERF_NOTES.md`.
> Hinweis: Beschreibungen können den damaligen Plan widerspiegeln (z.B. WASM-Fraktale,
> die inzwischen auf GPU-Shader migriert wurden).

# Action Plan — Quick-Wins (Status: alle erledigt, Audit 2026-05-29)

> **Status:** QW-01 bis QW-09 sind im Code umgesetzt. Details unten zur Nachverfolgung. Neue Performance-Befunde der Folgesession in `AUDIT_FINDINGS.md`.
>
> **QW-Status-Übersicht (2026-05-29):**
> - QW-01 ✅ WASM-Buffer-Sharing (`wasm/src/lib.rs:32,83`, Aufrufer migriert)
> - QW-02 ✅ FractalCanvas: IO, Buffer-Sharing, `findBoundaryNonBlack`-Drosselung
> - QW-03 ✅ ThreeBodyScene 400×300
> - QW-04 ✅ `makeScene` Default `pixelated: false`
> - QW-05 ✅ Fraktal-CSS-Filter `auto`, FractalJulia-Auflösung dynamisch
> - QW-06 ✅ effektiv via GPU-Migration (PlasmaDemo, Tunnel, Metaballs, Rotozoom, Fire auf ShaderPanel)
> - QW-07 ✅ Slide-Container `contain: paint`
> - QW-08 ✅ COEP-Doku
> - QW-09 ✅ Playwright-Tests aktiv

## QW-01 — WASM `render()` auf Buffer-Sharing umstellen

**Datei:** `wasm/src/lib.rs`
**Ziel:** Mandelbrot-Render verwendet das gleiche Pattern wie `render_julia()` (Z. 86–135).

**Änderung:**
1. Signatur von `render()` ändern: statt `fn render(width, height, params) -> Vec<u8>`, neu: `fn render(buf: &mut [u8], width: u32, height: u32, params: &RenderParams)`.
2. `let mut buffer = vec![0u8; ...]` entfernen, direkt in `buf` schreiben.
3. Am Ende kein `return buffer`, kein Rückgabewert.
4. `RenderParams` bleibt unverändert.

**Anschluss-Änderungen (im selben Commit):** alle JS-Aufrufer von `render()` müssen umgestellt werden:
- `frontend/src/components/FractalCanvas.tsx` Z. 149 und Z. 190.
- `frontend/src/panels/FractalScenes.tsx` — alle Fraktal-Mini-Panels, dort wo `render()` aufgerufen wird.

**Pattern (siehe `FractalJulia.tsx` Z. 134–136 als Referenz):**
```typescript
const buf = new Uint8Array(W * H * 4)
const pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength)
const imgData = new ImageData(pixels, W, H)
// pro Frame:
render(buf, W, H, params)
ctx.putImageData(imgData, 0, 0)
```

**Build-Schritt nicht vergessen:** Nach Rust-Änderung `wasm-pack build --release --target web` (siehe `DEV_GUIDE.md`).

## QW-02 — `FractalCanvas.tsx` auf Referenz-Pattern bringen

**Datei:** `frontend/src/components/FractalCanvas.tsx`

**Änderungen (in dieser Reihenfolge):**

1. **IntersectionObserver hinzufügen** (analog `FractalJulia.tsx` Z. 121–126):
   - `let isVisible = true` vor dem `getWasmModule()`-Aufruf deklarieren.
   - IO erzeugen, `canvas` beobachten.
   - In der `frame()`-Funktion vor dem Render-Block: `if (!isVisible) { rafRef.current = requestAnimationFrame(frame); return }`.
   - Cleanup-Funktion: `io.disconnect()`.

2. **Buffer-Sharing umsetzen** (nach QW-01):
   - Beim Setup (außerhalb von `frame`) Buffer + ImageData einmalig anlegen, basierend auf aktueller `canvas.width/height`.
   - Bei Resize (im `ResizeObserver`-Callback) Buffer und ImageData neu anlegen.
   - In `frame()`: kein `new Uint8ClampedArray(...)`, kein `new ImageData(...)`.

3. **Crossfade-Allokation eliminieren** (Z. 103 `new ImageData(W, H)`):
   - Drei persistente Buffer/ImageData-Paare: `prev`, `next`, `blend` (jeweils einmal beim Mount oder Resize).
   - Im Crossfade-Block direkt in `blend.data` schreiben statt `new ImageData`.

4. **`ctx.getImageData()` ersetzen** (Z. 180):
   - Statt GPU-Readback: nach jedem Render einen Snapshot per `prev.data.set(pixels)` (`pixels` ist der Render-Buffer) machen — bleibt im CPU-Memory, kein Roundtrip.

5. **`findBoundaryNonBlack()` drosseln** (Z. 246–282):
   - Statt pro Frame: nur alle N Frames (z. B. 4) aufrufen. Frame-Counter im `stateRef`. Spart 75 % der Boundary-Suche.

**Performance-Erwartung:** Faktor 5–8× weniger CPU-Last für dieses Panel, abhängig von Layout-Größe.

**Wichtig — KEINE Auflösungs-Senkung:** `MAX_PIXELS = 480000` bleibt. Pixel-Quality-Policy Kategorie B verlangt scharfes Fraktal. Wenn nach allen anderen Fixes immer noch zu teuer auf großem Layout, dann perspektivisch GLSL-Migration — *nicht* weniger Pixel.

## QW-03 — `ThreeBodyScene` Auflösung anpassen

**Datei:** `frontend/src/panels/DemoScenes.tsx` Z. 799–800
**Aktuelle Werte:** `640, 480` (= 307k Pixel internal).
**Neue Werte:** `400, 300` (= 120k Pixel) — Pixel-Quality-Policy Kategorie B erlaubt Auflösungs-Anpassung wenn der Effekt nicht punkthaft, sondern „Field-artig" gerendert wird und das Hochskalieren mit Bilinear-Filter (nicht `pixelated`) glatt aussieht.

**Anschluss-Änderung:** sicherstellen, dass das Panel **ohne** `imageRendering: pixelated` rendert (wird durch QW-04 generisch erledigt).

**Performance-Erwartung:** Faktor ~2.5× günstiger.

## QW-04 — `makeScene`-Default auf `pixelated: false` umstellen

**Datei:** `frontend/src/panels/DemoScenes.tsx` Z. 44 und Z. 156
**Aktueller Default:** `pixelated: boolean = true`.
**Neuer Default:** `pixelated: boolean = false`.

**Konsequenz:** Alle Scenes in dieser Datei rendern künftig mit Browser-Default-Filter (bilinear). Authentisch-pixelige Scenes müssen explizit `pixelated: true` als Argument bekommen — aktuell ist keine Scene in `DemoScenes.tsx` Kategorie A, also kein Override nötig.

**Aufrufer prüfen:** Da der Parameter optional ist und alle Aufrufer aktuell den Default nutzen, ändert sich das Verhalten implizit. Visuelle Regression mit Playwright-Test prüfen (`tests/panel-check.spec.ts`).

## QW-05 — `FractalCanvas` / Hero-Panel CSS-Filter umstellen

**Datei:** `frontend/src/components/FractalCanvas.tsx` Z. 216
**Aktuell:** `style={{ ..., imageRendering: 'pixelated' }}`.
**Neu:** `style={{ ..., imageRendering: 'auto' }}` (oder einfach Property weglassen).

**Pixel-Quality-Policy:** Fraktale sind Kategorie B. Bei einer dynamischen Render-Auflösung mit MAX_PIXELS-Cap rendert das Panel oft eh in Native-Nähe — wenn nicht, ist Bilinear-Filter passender als gepixelte Tiles.

Gleiche Anpassung in `frontend/src/panels/FractalJulia.tsx` Z. 291 (steht aktuell auch auf `pixelated`).

**Zusätzlich:** In `FractalJulia.tsx` die interne Auflösung `RENDER_W = 320, RENDER_H = 213` (Z. 101–102) erhöhen — Kategorie-B-Policy verlangt mehr. Vorschlag: dynamisch wie `FractalCanvas`, mit MAX_PIXELS-Cap (z. B. 240000 = ~600×400). Damit ist Julia auch bei großen Panel-Größen scharf.

## QW-06 — `PlasmaDemo` und VoxelScenes CSS-Filter umstellen

**Dateien:**
- `frontend/src/panels/PlasmaDemo.tsx` Z. 214
- `frontend/src/panels/VoxelScenes.tsx` Z. 772 (im `Panel`-Wrapper)

**Aktuell:** `imageRendering: 'pixelated'`.
**Neu:**
- `PlasmaDemo` → `auto` (Kategorie B, Shader-Style). Außerdem die internen `W = Math.min(canvas.width, 200)` und `H = Math.min(canvas.height, 150)` (Z. 110–111) auf höhere Werte setzen — Vorschlag: 480 × 360 (= ~170k Pixel, immer noch günstig für CPU). Mit Bilinear-Filter sieht das Plasma auch auf großen Panels glatt aus.
- `VoxelScenes` → `pixelated` beibehalten **vorerst** (Kategorie C — bis GPU-Migration in GL-04).

**Hinweis:** Wenn ohne GPU-Migration die niedrige Voxel-Auflösung (480×300) auf großen Panels matschig aussieht, ist `pixelated` weiterhin das kleinere Übel. Erst nach GL-04 wird `auto`.

## QW-07 — Layout-Slide: doppeltes Rendering reduzieren

**Datei:** `frontend/src/App.tsx` Z. 1066–1083

**Problem:** Während der 520ms-Slide-Animation rendern beide Layouts vollständig.

**Lösung (pragmatisch):** dem `prevLayout`-Container `style={{ contain: 'paint' }}` mitgeben. `contain: paint` weist den Browser an, den Inhalt des Containers nicht in den Hauptdokument-Paint-Tree zu integrieren — die laufenden Canvases werden trotzdem gerendert, aber Layout-/Composite-Kosten der äußeren App reduzieren sich.

```tsx
{sliding && prevLayout !== null && (
  <div
    key={`out-${prevLayout.id}`}
    className="absolute inset-0 p-1 layout-slide-out"
    aria-hidden="true"
    style={{ contain: 'paint' }}     // ← neu
  >
    <LayoutContent layout={prevLayout} onSkipSlot={() => {}} />
  </div>
)}
```

**Bessere Lösung (separate Session, siehe PERF-10):** zentraler `paused`-Flag im rAF-Coordinator, der während der Slide-Animation gesetzt wird. Verlangt aber, dass PERF-10 vorher umgesetzt ist.

## QW-08 — AGENTS.md COEP-Korrektur

**Status:** **Erledigt** — diese Version dokumentiert `credentialless` korrekt.

## QW-09 — Verifikation per Playwright

Nach allen Quick-Wins:
```bash
cd frontend
npm run test:panels
```

Die Visualtests (`tests/panel-check.spec.ts`, `tests/review-all-panels.spec.ts`) sollen weiter grün sein. Screenshots in `tests/screenshots/panels/` werden ggf. neu generiert — kein Regressions-Problem, sondern erwartete visuelle Veränderung (besonders die Pixelated-Off-Umstellung).

---

# Action Plan — Performance & Architektur (mittelfristig)

> **Status-Übersicht (2026-05-29, Iter. 2):**
> - PERF-10 ✅ Vollständig — alle Canvas-/Shader-Panels nutzen jetzt den zentralen `raf-coordinator`. Letzte 20 Migrationen in Commit `743d12b`. Globaler `setPaused`-Switch greift für die ganze App.
> - PERF-11 ✅ Vollständig — 52/52 Panels mit `React.memo`, inkl. `VoxelDemo` (Commit `c65ec3b`).
> - PERF-12 ✅ Phase-3-Messung gefahren (2026-05-30) — Harness `frontend/tests/perf-measure.spec.ts` (Playwright+CDP, geseedetes `Math.random`), Vergleich HEAD↔`5264baf^` in `PERF_NOTES.md`. Verdikt: H-07 nicht bestätigt; B-3-Heap kein Leak. **B-4 (Headed-GPU-Lauf):** App Main-Thread-bound, nicht GPU-bound — M5-Max-GPU ≈ Software-Rasterizer, 60-FPS-Akzeptanzfall (Review 4-Panel-Fraktal) nur 9 FPS. Maßnahmen Richtung Main-Thread-Entlastung, nicht GPU.
> - Bonus: H-01/H-02 (Map-Pooling + Throttling in Fraktal-Stack, `de74281` + `3961b99`), H-04 (ThreeBodyScene 30-FPS-Cap, `7833455`), H-08 (`data-zoom*`-DOM-Drosselung, `c65ec3b`) sind in dieser Iteration mit umgesetzt.

Diese Punkte gehen über die Quick-Wins hinaus und sind eigenständige Sessions.

## PERF-10 — Zentraler rAF-Coordinator

**Ziel:** Statt 24+ separater `requestAnimationFrame`-Loops ein zentraler Ticker mit Subscription-API.

**Skizze:**
```ts
// utils/raf-coordinator.ts
const callbacks = new Set<(t: number) => void>()
let running = false
let rafId = 0
let paused = false

function tick(t: number) {
  if (!paused) for (const cb of callbacks) cb(t)
  if (callbacks.size > 0) rafId = requestAnimationFrame(tick)
  else running = false
}

export function subscribe(cb: (t: number) => void): () => void {
  callbacks.add(cb)
  if (!running) { running = true; rafId = requestAnimationFrame(tick) }
  return () => callbacks.delete(cb)
}

export function setPaused(p: boolean) { paused = p }
```

Panels rufen statt `requestAnimationFrame(frame)` ein `subscribe(frame)` auf und bekommen einen `unsubscribe()` zurück, der in der Cleanup-Funktion läuft.

**Side-Benefit:** globale Pause (während Layout-Slide), globale 30-fps-Throttle möglich (für Mobile / weak hardware).

**Migrations-Reihenfolge:** zuerst die teuersten Panels umstellen (Voxel, ThreeBody, Plasma), dann alle anderen. Kann inkrementell laufen, alte rAF-Loops koexistieren mit neuen Subscriptions.

## PERF-11 — `React.memo` auf Panel-Komponenten

**Verteidigung gegen versehentliche Parent-Re-Mounts.** Alle Panel-Komponenten mit `React.memo()` umhüllen. Equality-Funktion einfach: Panels akzeptieren keine Props (außer `onComplete`), also `() => true` reicht — Memo verhindert Re-Render solange der Parent es nicht durch `key`-Wechsel erzwingt.

**Pattern pro Panel:**
```ts
export default React.memo(FractalJulia)
```

Bei Komponenten mit `onComplete`-Callback: `React.memo` mit Standard-Equality, aber sicherstellen, dass `onComplete` im Parent stabil ist (`useCallback`).

## PERF-12 — Performance-Audit dokumentieren

Nach QW-01 bis QW-09: Chrome DevTools Performance-Recording während eines Layout-Switches mit 6+ GFX-Panels. Ergebnis in `PERF_NOTES.md` festhalten — Vergleichswerte für künftige Refactorings.

---

# Action Plan — WebGL-Infrastruktur (Voraussetzung für Demoszene-Shader)

> **Status-Übersicht (2026-05-29, Iter. 2):**
> - GL-01 ✅ `ui/ShaderPanel.tsx` vorhanden (~488 LOC)
> - GL-02 ✅ `utils/webgl-pool.ts` (LRU, `MAX_GL_CONTEXTS=16`)
> - GL-03 ⚠ Partial — migriert: PlasmaDemo, Tunnel, Metaballs, Rotozoom, Fire. **ThreeBodyScene** weiter CPU, jetzt aber via `fpsCap=30` in `makeScene` gedeckelt (Commit `7833455`). Volle GPU-Migration steht noch aus.
> - GL-04 ⚠ VoxelScenes (Thermal, Lava) auf ShaderPanel; `VoxelDemo` (Color, BW) ebenfalls über ShaderPanel mit `memo`-Wrapper (Commit `c65ec3b`). `imageRendering: pixelated` ist in beiden ShaderPanels nicht mehr explizit gesetzt (Kategorie-B-Verhalten).
> - GL-05 offen (optional)
> - Bonus 2026-05-29: vier GPU-Shader (Tunnel/Rotozoom/Metaballs/Plasma) hatten anisotropisches Coord-Mapping → Verzerrung bei nicht-4:3-Panels. Aspect-preserving Fix in Commit `c780297` (Audit-Befund **H-11**).

## GL-01 — `ShaderPanel.tsx` Basiskomponente

**Datei:** `frontend/src/ui/ShaderPanel.tsx` (neu)

**Funktion:** wiederverwendbare Wrapper-Komponente für Fragment-Shader-Rendering. API analog Shadertoy-Konvention:

```tsx
<ShaderPanel
  fragmentShader={glslSource}      // String mit GLSL ES 1.00 / WebGL 1.0 Code
  uniforms={{ iResolution, iTime, iMouse? }}
  title="..."                       // an Panel-Wrapper durchreichen
  maxResolution={{ w: 1280, h: 800 }} // optional, Performance-Cap
/>
```

**Implementations-Notizen:**
- WebGL 1.0 reicht für die meisten Demoszene-Shader und ist universell unterstützt.
- Fullscreen-Quad-Vertex-Shader trivial (Standard-Pass-Through).
- Uniforms automatisch aus Props ableiten; `iTime` aus `requestAnimationFrame`-Tick (zentraler Coordinator nach PERF-10).
- `iResolution.xy` aus Canvas-Größe.
- IntersectionObserver einbauen (Standard).
- Adapter für Shadertoy-Konvention: wenn Shader-Source `void mainImage(out vec4 fragColor, in vec2 fragCoord)` definiert, automatisch ein Wrapper-Main einbauen, der das aufruft.
- Native Auflösung (Pixel-Quality-Policy Kategorie B), KEIN `imageRendering: pixelated`.

## GL-02 — WebGL-Kontext-Pool

**Problem:** Browser limitieren WebGL-Kontexte auf 8–16 pro Tab.

**Lösung:** ein `WebGLContextPool` mit fester Größe (z. B. 6 Slots). `ShaderPanel`-Komponenten fordern einen Slot an; wenn keiner frei, fallen sie auf einen statischen Frame oder CSS-Animation zurück (oder pausieren bis ein Slot frei wird).

**Datei:** `frontend/src/utils/webgl-pool.ts`

**Strategie:** LRU — wenn neues Panel einen Kontext braucht und alle belegt sind, wird das am längsten unsichtbare Panel ausgeworfen.

## GL-03 — Migration CPU → GPU für Shader-suitable Panels

In dieser Reihenfolge (jeweils eigene Session):

1. `PlasmaDemo` — direktester Win, klassische 4-Wave-Sinus-Plasma in GLSL trivial
2. `TunnelScene` — polar transform in fragment shader
3. `MetaballsScene` — field calc per pixel, perfekt für fragment shader
4. `RotozoomScene` — Affine-Sampling-Shader
5. `FireScene` — etwas trickier wegen Heat-Propagation-State, aber als FBO-Ping-Pong umsetzbar
6. `ThreeBodyScene` — N-Body-Sim auf CPU (kleines Set), Rendering auf GPU

**Pro Migration:**
- Alte CPU-Variante als Kommentar / `_legacy.tsx`-Datei aufbewahren (Storytelling-Wert für späteres Vergleichs-Demo).
- Native Auflösung (kein `pixelated`), Performance-Cap nur für Mobile.
- Visuell soll die GPU-Variante so nah wie möglich an der CPU-Variante sein, NICHT ein anderes Lookup-Pattern. Wer den Switch im Auto-Layout-Wechsel macht, soll keinen Style-Bruch sehen.

## GL-04 — Voxel-Terrain auf GPU-Raymarching

**Aktuell:** `VoxelDemo.tsx` und `VoxelScenes.tsx` (Thermal, Lava) — CPU-Raycasting bei 480×300.

**Ziel:** Heightmap als WebGL-Textur, Fragment-Shader macht Raymarching durch Heightfield. Native Display-Auflösung.

**Aufwand:** mittel. Heightmap-Generierung bleibt in JS (oder geht nach WASM), Upload als RG-Textur. Shader-Logik: pro Pixel `vec3 rayDir`, Steps entlang Strahl, Heightfield-Sample, Treffer-Schwellwert. Optional: Soft-Shadow, AO durch zusätzliche Schritte.

**Nach Umsetzung:** `imageRendering: pixelated` aus Voxel-Panels entfernen, Pixel-Quality-Kategorie von C nach B befördern.

## GL-05 — `ShaderPanel`-Hot-Reload (optional, nice-to-have)

Shader-Sourcen als `.glsl`-Dateien in `frontend/public/shaders/`, geladen per `fetch()`. Erlaubt Updates ohne Vite-Rebuild. Nur sinnvoll, wenn viele externe Shader gepflegt werden.

---

# Action Plan — Demoszene-Integration (kurz-/mittelfristig)

> **Status-Übersicht (2026-05-29, Iter. 2):**
> - DEMO-01..04 ✅ Panels existieren: `ShadertoyPanel`, `TixyPanel`, `IQTechniquePanel`, `LovebyteShowcasePanel`. Inhaltliche Tiefe noch nicht auditiert (Phase 5).
> - DEMO-05 offen (Lizenz-JSON).
> - DEMO-06 ✅ Teilweise (Audio-Fokus): `utils/audio-focus.ts` mit `requestAudioFocus`/`releaseAudioFocus` ist in Verwendung; `AmiModPanel` und `AllYourBase` respektieren es. Erweiterung auf weitere Audio-Panels offen.
>
> **Zusätzliche ProTracker-Verbesserungen (Iter. 2)** — siehe `audit/2026-05-29`-Branch und Standalone-Projekt `p_modplayer_singlehtml`:
> - **Hybrid-Reintegration aus Standalone-Player** (`034811e`): ScriptProcessorNode-Fallback entfernt, AudioWorklet jetzt Pflicht. Echte Per-Channel-VU-Pegel direkt aus dem Worklet (~47 Posts/sec, `'levels'`-Message). Asymmetrische, zeitbasierte EMA-Glaettung der VU-Bars (`c18cb4d`).
> - **Race-Fix bei Track-Wechsel** (`0d6e2bd`): Generationen-Counter in `ModPlayer.load` + atomare `play(modOverride)`-Übergabe + Effect-Generation-Guard verhindert Mismatch zwischen UI-State und hörbarem Track.
> - **Drag & Drop + File/Folder-Picker** (`553347a`): Drop ueber gesamtes Panel inkl. rekursivem Ordner-Traversal via `webkitGetAsEntry`. "LOAD…"-Button (File-Picker) und "DIR…"-Button (Folder-Picker). Object-URLs werden bei Unmount revoked. Dropdown gruppiert Defaults + User-Uploads via `<optgroup>`.
> - **Positionsregler (Scrubber)** (`614d5b5`, `164a7ca`, `569bd90`): Range-Slider mit Amiga-Bevel-Optik, Klick-zur-Position via `onPointerDown`, robuster Backward-Scrub-Fix (`lastPosRef` + `justScrubbedRef` verhindern False-Auto-Stop).
> - **Default-Tracks erweitert** (`c42659f`, `c931285`): 13 klassische Game-MOD-Tracks (Agony, Lotus 2/3, R-Type, Simon the Sorcerer, Speedball 2, Stardust Memories, Turrican-Reihe) mit Composer-/Publisher-/Year-Attribution. Footer-Disclaimer "TECH SHOWCASE — MUSIC © RESPECTIVE COMPOSERS & PUBLISHERS" statt frueherer Modarchive-Aussage.
> - **MIME für `.mod`** in `frontend/public/.htaccess` ergänzt; `.dat` bleibt aus Historie-Gründen unterstützt.
>
> **GlitchOverlay** (`cefcb23`) ebenfalls in Iter. 2 überarbeitet: VHS-Aesthetik (Tracking-Bands, Chroma-Bleed in Magenta/Cyan, Dropouts, Capstan-Wobble), Performance-Refactor (Scanlines als CSS-Gradient statt 360 fillRect/Frame, rAF nur in aktiven Episoden via `raf-coordinator.subscribe`).
>
> **Standalone-ProTracker-Projekt:** Der Player wurde nach `~/local/Arbeit/Viben/p_modplayer_singlehtml/` extrahiert (Single-HTML-File, ~36 KB minified, eigene `AGENTS.md`). Verbesserungen wandern bei Bedarf zwischen den Projekten hin und zurück.

Diese Punkte ergänzen das bestehende Inventar mit kuratierten Demoszene-Inhalten.

## DEMO-01 — `ShadertoyPanel` mit kuratierten Shadern

**Datei:** baut auf `ShaderPanel` (GL-01) auf.

**Aufgaben:**
1. 6–10 Shadertoy-Werke kuratieren. Auswahlkriterien:
   - In 600×400 unter 2 ms Frame-Cost auf Apple-Silicon-Hardware
   - Optisch beeindruckend, passt zur „Neural Intrusion Dashboard"-Ästhetik (= dunkel, technisch, optional grün-getönt)
   - Keine kontroversen Inhalte, keine sexuellen Themen
   - Lizenz Shadertoy-Standard CC-BY-NC-SA 3.0 (passt zu nicht-kommerzieller Webseite) oder freier (CC0, MIT)
2. **Pflicht-Attribution:** kleines Footer-Overlay pro Shader-Panel mit Autor + Quell-Link.
3. Suchempfehlungen auf shadertoy.com: Tags `procedural`, `2d`, `raymarching`, sortiert nach „Popular All-Time". Bevorzuge Werke von iq (Inigo Quilez), FabriceNeyret2, Shane, Mercury, nimitz.

**Auswahl-Reihenfolge für Recherche:**
- iq, Mountains (Raymarching-Klassiker, mäßig teuer)
- iq, Mandelbox-Varianten (Fraktal — passt thematisch)
- Shane, Tunnel- und Trip-Variationen
- nimitz, SDF-Compositions
- Shadertoy „Plasma"-Tags → mehrere passende, kurze Shader
- Voronoi-Pattern-Werke (z. B. von Patapom)

**Pixel-Quality-Policy:** Kategorie B, native Auflösung. KEIN `pixelated`.

## DEMO-02 — `TixyPanel` (tixy.land-Stil)

**Datei:** `frontend/src/panels/TixyPanel.tsx`

**Konzept:** 16×16 oder 32×32 Pixel-Grid, eine mathematische Funktion pro Panel-Variante. Format wie tixy.land: `f(i, x, y, t) → [-1..1]`. **Eigene Funktionen schreiben** (keine fremden) — keine Lizenz-Frage.

Beispiel-Funktionen für Variationen:
- `sin(t - sqrt((x-7.5)**2 + (y-6)**2))`
- `(x-y) * tan(t)`
- `x**2 - y**2 + sin(t*3)`

**Pixel-Quality-Policy-Sonderfall:** Tixy ist *per Konzept* grobpixelig (16×16!). Aber im Renderer als skaliertes Vektor-Grid mit *abgerundeten Kacheln* darstellen, nicht als `imageRendering: pixelated` Bitmap — die Kacheln werden CSS-/Canvas-gemalte Quadrate/Kreise (mit `roundRect` oder `arc`). Damit bleibt das Panel auf großen Layouts scharf.

## DEMO-03 — `IQTechniquePanel` (Inigo-Quilez-Techniken, eigene Umsetzung)

**Datei:** `frontend/src/panels/IQTechniquePanel.tsx`

**Konzept:** 3–4 Varianten, eigenhändig in GLSL umgesetzt nach den IQ-Articles (https://iquilezles.org/articles/). Da Eigenimplementierung: keine Lizenz-Frage.

Themen:
- SDF + smoothmin (z. B. blobby spheres)
- FBM (Fractional Brownian Motion) Noise-Wolken
- Domain-Repetition (unendliche Säulen)
- Cheap Soft-Shadow
- Distance Field Combinations (union, intersection, smooth-union)

**Pixel-Quality-Policy:** Kategorie B, native Auflösung.

## DEMO-04 — `LovebyteShowcasePanel` (Sizecoding-Geist, eigene Effekte)

**Datei:** `frontend/src/panels/LovebyteShowcasePanel.tsx`

**Konzept:** Im Geist der Lovebyte-256B-Compo. Eigene minimalistische Effekte (Plasma-Varianten, Moiré-Patterns, IFS, „Mire"-artige Interferenzmuster) — in GLSL als ultra-kompakte Shader. Statt einer einzelnen 256-Byte-Demo: ein Panel, das durch 5–8 selbstgeschriebene Mini-Shader rotiert (alle 30 s eine andere Formel). Subtitel im Panel zeigt die GLSL-Quellzeile (passt zur Hacker-Dashboard-Ästhetik).

**Pixel-Quality-Policy:** Kategorie B, native Auflösung.

## DEMO-05 — Lizenz- und Attribution-Infrastruktur

**Datei:** `frontend/src/data/licenses.json`

**Format:**
```json
{
  "shader_snail": {
    "source": "https://www.shadertoy.com/view/ld3Gz2",
    "author": "Inigo Quilez (iq)",
    "license": "CC-BY-NC-SA-3.0",
    "modifications": "Verkleinerter Step-Count für 60fps in 600x400",
    "attribution": "Snail by iq"
  }
}
```

**Build-Schritt:** beim Build prüfen, dass jeder Shader, der nicht selbst geschrieben ist, einen Eintrag hat. Footer-Seite „Credits" rendert die Liste automatisch.

## DEMO-06 — Audio-Fokus-Modell

**Problem:** Wenn DEMO-Panels mit Audio dazukommen (z. B. js-dos für Heaven 7), kollidieren sie mit `AmiModPanel` und `AllYourBase`.

**Lösung:** zentrale `AudioFocus`-State im App-Level. Nur **ein** Audio-Panel gleichzeitig hörbar. UI-Modell:
- Beim Mount sind alle Audio-Panels gemutet.
- Klick auf einen „Focus"-Button (oder das Panel selbst) gibt Audio frei. Vorheriger Focus wird automatisch entzogen.
- Bei Layout-Wechsel automatischer Reset des Focus (außer das Panel bleibt im neuen Layout).

`isAudioPlaying()` in `App.tsx` Z. 434 wird in dieses Modell integriert: Auto-Switch wartet nur, wenn ein Audio-Focus aktiv ist.

---

