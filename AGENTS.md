# FraktalLab — Projektdokumentation

Universelle Referenz für alle Coding-Agents und KI-Modelle.
Agent-spezifische Einstellungen und Build-Befehle stehen in `DEV_GUIDE.md`.

> **Neuer Agent — Branch-Check zuerst:** Audit läuft auf Branch `audit/2026-05-29`. Bist du schon dort? `git status` prüfen. Wenn nein: `git checkout audit/2026-05-29`. **NICHT** einen neuen Branch anlegen (auch wenn `blueprint_audit.md` §"Erste Schritte" das anweist — das galt nur für den ersten Audit-Aufschlag).
>
> **Hinweis für die nächste Session:** Die Datei wurde am 2026-05-28 nach einem ersten Code-Audit und am 2026-05-29 nach einem zweiten Audit (Branch `audit/2026-05-29`) überarbeitet, am 2026-05-30 um die Phase-3-Messungen ergänzt. Phase 1 (Inventur), Phase 2 (Hypothesen + Fixes) und **Phase 3 (Mess-Baseline)** sind abgeschlossen. Sämtliche Quick-Wins, H-01…H-08 und H-11 sind umgesetzt. **Phase-3-Verdikt (zwei getrennte Ergebnisse):** (1) H-07 (Regression durch `5264baf`) **nicht bestätigt** — WASM byte-identisch, kein Frame-Time-Regress, B-3-Heap kein Leak. (2) **B-4 — die App ist Main-Thread-/CPU-bound, NICHT GPU-bound:** Headed-Messung auf echter M5-Max-GPU (`ANGLE Metal Renderer: Apple Apple-Silicon-Hardware`) ≈ Software-Rasterizer; der geforderte 60-FPS-Akzeptanzfall (Review-Modus 4-Panel-Fraktal, M-07) erreicht nur **9 FPS**. Optimierungshebel ist Main-Thread-Entlastung, nicht GPU-Migration. Details + Tabellen in `PERF_NOTES.md`, Harness `frontend/tests/perf-measure.spec.ts` (Profil `chrome-gpu` für GPU-Läufe). **Offen:** Phase 5 = Demoscene-Panel-Inhaltliches-Audit; B-4-Maßnahmen. Status-Tabellen pro Sektion sind ebenfalls aktualisiert.

---

## Projektcharakter & Entwicklungsphilosophie

FraktalLab ist ein humorvolles technisches Showcase — kein klassisches Produkt mit Abnahmekriterien.
Das Motto: *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Thematischer Rahmen: Ein fiktives „Neural Intrusion Dashboard", das Hacker-Klischees aus Kinofilmen persifliert und dabei echte beeindruckende Web-Technologien zeigt (WebAssembly, Canvas-Demoscene-Effekte usw.).

**Speed-first-Regel:** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können. Features, die das nicht schaffen, werden auf kleineres Scope reduziert oder verschoben. Keine halbfertigen Implementierungen.

Aktueller Stand: **v1.6.0** (auf Audit-Branch `audit/2026-05-29`; `main` ist auf v1.2.7). Deployment auf Netcup-Webspace (Apache).

---

## Pixel-Quality-Policy

**Grundsatz:** Grobe Pixel nur dort, wo sie authentisch sind. Sonst möglichst scharf und in nativer Auflösung.

**Styling-Leitlinie:** Der klassische schwarz-grüne monochrome Hacker-Stil ist *ausschließlich* für das äußere Gerüst der Seite (Borders, Headers, Sidebars) und die Text-Panels (SystemLog, DataStream etc.) reserviert. Alle Grafik- und Simulationspanels dürfen und sollen gerne vollfarbig, kontrastreich, hochauflösend und im lebendigen, kreativen Demoszene-Stil gestaltet sein (z.B. detailreiches Shading, volumetrischer Nebel, farbige Blueprint-Radar-Grafiken, Partikeleffekte), außer bei authentischen Retro-Effekten (wie C64 oder Elite 1984) oder wenn es aus Performancegründen unumgänglich ist. Es sollen jedoch immer möglichst kleine Dateigrößen für Assets angestrebt werden (vorzugsweise prozedurale Texturen oder hochkomprimierte/base64-codierte WebP-Bilder direkt im Code, wie das Vorbild Farbrausch fr-08).

Diese Policy ist verbindlich für alle neuen und überarbeiteten Panels. Sie ist Konsequenz aus der Tatsache, dass FraktalLab auf modernen Displays läuft und Layouts mit bis zu 4 Panels pro Bildschirm Panel-Größen von 960×540 und mehr produzieren — bei diesen Größen werden gepixelte Effekte mit niedriger interner Auflösung deutlich unschön hochskaliert.

### Kategorie A — Authentisch grobpixelig (`imageRendering: pixelated`, niedrige interne Auflösung erlaubt)

Diese Panels gehören in die Pixel-Ära und sollen so aussehen:

- `C64Panel` — 4:3, ~320×200, BASIC-Pixel-Charme, Pflicht
- `RetroErrorPanel` — Original-Pixelgrafik der jeweiligen OS-Bombs (Mac, Amiga, BSOD)
- `EnhanceView` — Stil-Element ist das Hochskalieren

### Kategorie B — Glatt und scharf (KEIN `imageRendering: pixelated`, möglichst native Auflösung)

Hier soll am Endgerät nichts „pixelig" sein:

**Fraktale (immer glatt — math. Berechnung erlaubt beliebige Präzision):**
- `FractalCanvas` / `FractalView` (Hero-Panel)
- `FractalJulia`
- Alle Panels aus `FractalScenes.tsx`

**Shader-Style-Effekte (sollen aussehen, als wären sie GPU-Shader):**
- `PlasmaDemo`
- `TunnelScene`
- `RotozoomScene`
- `MetaballsScene`
- `ThreeBodyScene`
- `FireScene` (Feuer ist physikalisch glatt, nicht pixelig)

**Vektor- und 3D-Wireframe-Panels (per Natur scharf — Canvas-Path-Rendering):**
- `DNAHelix`, `GlobePanel`, `OscilloscopePanel`, `RadarSweepPanel`, `SolarSystemPanel`
- `ElitePanel`, `CADRobotPanel`, `ParallaxPanel`
- `StarfieldScene`, `BoingScene`, `LissajousScene`, `DotCloudScene`
- `NeuralNetPanel`, `VectorHudPanel`, `SpectrogramPanel`

### Kategorie C — Voxel-Terrain (Sonderfall, GPU-Migration angestrebt)

Voxel-Terrain à la Comanche ist *historisch* aus Hardware-Gründen pixelig, aber nicht *authentisch* pixelig — moderne Implementierungen können das scharf darstellen. Aktuell CPU-Rendering bei 480×300 mit `imageRendering: pixelated`:

- `VoxelDemoColor`, `VoxelDemoBW` (in `VoxelDemo.tsx`)
- `VoxelThermal`, `VoxelLava` (in `VoxelScenes.tsx`)

**Zielzustand:** Migration auf WebGL-Raymarching durch Heightmap-Textur (siehe GL-04 im Action Plan). Bis dahin: `pixelated` beibehalten, weil die niedrige Auflösung sonst durch Bilinear-Filtering matschig wirkt. Sobald GPU-Variante existiert, wird `pixelated` entfernt und native Auflösung gerendert.

### Operationale Regeln

1. **Default-Wahl bei neuen Panels:** Kategorie B. `imageRendering: pixelated` nur einsetzen, wenn das Panel explizit Kategorie A oder C zuzuordnen ist.
2. **Render-Auflösung in B-Panels:** so nah wie möglich an die CSS-Größe des Canvas, mit einem oberen Cap, der nur greift, wenn das Panel sehr groß wird (z. B. bei einem 4-Panel-Layout auf 4K-Display). Pro Panel-Komponente individuell festzulegen, aber Faustregel: Cap nicht unter 800×600, eher 1280×800 oder höher für die teureren Effekte.
3. **CPU-Performance vs. Auflösung:** Wenn ein B-Panel auf der Ziel-Hardware (Apple-Silicon-Hardware) bei hoher Auflösung > 4 ms/Frame braucht, ist das ein Migrations-Kandidat für GLSL (siehe GL-03). Nicht durch niedrigere Auflösung lösen — Auflösung bleibt, Renderer wechselt zu GPU.
4. **Scaling-Filter:** wenn aus Performance-Gründen doch eine niedrigere interne Auflösung nötig ist, **kein** `imageRendering: pixelated`, sondern Browser-Default (bilinear). Lieber etwas matschig als gepixelt — außer bei Kategorie A.
5. **`makeScene`-Factory in `DemoScenes.tsx`** akzeptiert bereits einen `pixelated`-Parameter (Default `true`). Default umstellen auf `false`, und Kategorie-A-Panels explizit `pixelated: true` setzen.

---

## Tech-Stack

```
Frontend:     React 19, Vite 8, TypeScript 6, Tailwind CSS v4
WASM-Modul:   Rust + wasm-pack  (wasm32-unknown-unknown)  →  wasm/pkg/
              Cargo Release-Profil: opt-level = 3, lto = true
Build-Plugins: vite-plugin-wasm, vite-plugin-top-level-await
Prod-Server:  Apache (Netcup) via frontend/public/.htaccess
Dev-Server:   Vite (setzt COOP/COEP-Header via vite.config.ts)
Testing:      Playwright (@playwright/test) — visueller Panel-Check
Audio:        Eigene ProTracker-MOD-Implementierung in frontend/src/utils/modplayer/
              (AudioWorklet + ScriptProcessor-Fallback, kein libopenmpt nötig)
```

---

## Repo-Struktur

```
wasm/                       Rust-Crate (cdylib). Build-Output: wasm/pkg/
  src/lib.rs                RenderParams, render() (Mandelbrot), render_julia()
frontend/
  src/
    App.tsx                 Grid-Layout-System, Pool-Definitionen, Layout-Wechsel-Logik,
                            Review-Modus (localStorage), Mobile-Layout (md:-Breakpoint)
    components/
      FractalCanvas.tsx     WASM-Mandelbrot, animierter Zoom durch 8 Koordinaten
      EnhancePhoto.tsx      Enhance-Slideshow (12 Stufen, 4s Zyklus, nur urbane Fotos)
    panels/                 Alle Panel-Komponenten (je eine Datei, siehe Inventar unten)
    ui/
      PanelSlot.tsx         Pool-basierter Slot + Duplikat-Tracking (kein Panel zweimal)
      GlitchOverlay.tsx     Vollbild-CRT/VHS-Glitch (zufällige Positionen)
      AmbientSound.tsx      Mechanische Tastatur-Sounds, startet bei erster Interaktion
      Panel.tsx             Rahmen mit grünem Border + Titelzeile
      Clock.tsx, StatBar.tsx, ScrollingLog.tsx
    utils/
      wasm-loader.ts        Singleton-Loader für das WASM-Modul (geteilt zwischen Panels)
      shared-audio.ts       Singleton AudioContext mit iOS-Session-Konfiguration
      modplayer/            Selbstgeschriebener ProTracker-MOD-Player (TypeScript)
        player.ts, fallback-processor.ts, loader.ts, mod.ts
  public/
    .htaccess               COOP/COEP-Header + SPA-Routing für Apache
    enhance/                Bilder für Enhance-Panel (street-0…5.jpg)
    audio/                  .dat-Dateien (umbenannte .mod-Tracker-Module)
server/                     Express Prod-Server (wird auf Netcup nicht genutzt)
```

---

## Architektur-Kernpunkte

**WASM ↔ React-Grenze:** `wasm/src/lib.rs` exportiert `render()` (Mandelbrot) und `render_julia()` (Julia-Menge). Die beiden Funktionen verwenden **derzeit inkonsistente Speicher-Patterns** — siehe Action Plan QW-01. Das WASM-Modul wird via `frontend/src/utils/wasm-loader.ts` als Singleton geladen; alle Fraktal-Panels teilen sich dieselbe Modul-Instanz.

**HTTP-Header (kritisch):** Vite-Dev-Server und `.htaccess` setzen `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`. Ohne diese Header verweigern Chrome und Safari den WASM-Load. `credentialless` (nicht `require-corp`) erlaubt Cross-Origin-Medien wie das archive.org-Video, ohne SharedArrayBuffer aufzugeben.

**Tailwind v4:** Via `@tailwindcss/vite`-Plugin, kein `tailwind.config.js`. CSS-Einstiegspunkt: `frontend/src/index.css` mit `@import "tailwindcss"`.

**Ästhetik:** Grüne Monospace-Schrift auf Schwarz (`text-green-400 bg-black font-mono`). Kein helles Theme.

**Mobile:** Unter 768px (`md:`-Breakpoint) wird ein vereinfachtes Single-Column-Layout mit 3 gestapelten PanelSlots gezeigt. Desktop-Layout und GlitchOverlay sind auf Mobile ausgeblendet.

**Layout-Größen:** Der Layout-Generator (`App.tsx` Z. 176 ff.) erzeugt je nach Bildschirmbreite Grids mit 4 bis 32 Zellen. Auf 4K und Ultra-Wide bis zu 32 Panels. Bei Bildschirmen < 1024px nur 4–6 Panels — d. h. einzelne Panels können bei manchen Layouts **größer als 960×540** werden. Das motiviert die Pixel-Quality-Policy oben.

**TypeScript Closure-Narrowing:** Canvas-Panels müssen nach dem Null-Check `const canvas: HTMLCanvasElement = _canvas` und `const ctx: CanvasRenderingContext2D = _ctx` verwenden, da TypeScript Assertions (`!`) in Closures nicht durchträgt.

**IntersectionObserver:** Die meisten Canvas-Panels beobachten ihren Container und pausieren den rAF-Loop (`if (!isVisible) { rafId = rAF(loop); return }`), wenn sie unsichtbar sind (z. B. während Layout-Übergängen). **Ausnahme:** `FractalCanvas.tsx` hat aktuell KEINEN IntersectionObserver — siehe Action Plan QW-02.

**Web Audio API (iOS / Safari-Kompatibilität):**
- **Keine Eager-Initialisierung:** Der `AudioContext` darf keinesfalls während des Seitenaufbaus (z. B. beim Laden von Modulen oder direkt beim Mounten von Komponenten wie `AmiModPanel` via `useEffect`) instanziiert werden. Ein Erstellen oder Verbinden von Nodes außerhalb eines direkten Benutzer-Gesten-Callstacks (Click, Touch, Keydown) führt auf iOS/WebKit zu einer permanenten Stummschaltung.
- **Hardware-Stummschalter (Silent Switch) umgehen:** Damit Web Audio trotz aktiviertem physischen Lautlos-Schalter am iPhone hörbar ist, muss beim Initialisieren des `AudioContext` die Audio-Session-Kategorie auf `'playback'` gesetzt werden: `(navigator as any).audioSession.type = 'playback'`. Dies erledigt `getSharedAudioContext()` in `utils/shared-audio.ts` automatisch.
- **Gesten-gebundener Unlock:** Audio-Graphen (GainNode, AudioWorkletNode, etc.) und `.resume()` des shared `AudioContext` müssen verzögert (lazy) erst gestartet werden, wenn eine Benutzerinteraktion (z. B. Klick auf den AUDIO-Toggle oder den Play-Button) stattfindet.

**Audio-Exklusivität:** Aktuell nur AmiModPanel (eigener MOD-Player) und AllYourBase (Video) erzeugen Sound. Der Auto-Switch wartet via `isAudioPlaying()` (`App.tsx` Z. 434) bis kein Sound mehr läuft. Wenn weitere Audio-Panels hinzukommen, gilt: nur ein „Audio-Fokus-Panel" gleichzeitig hörbar — siehe DEMO-06.

---

## Code-Audit-Befunde (2026-05-28)

Diese Sektion dokumentiert die Ergebnisse einer vollständigen Inspektion der Hauptdateien. Hypothesen aus früheren Versionen dieser Datei sind hier verifiziert oder verworfen.

> **Status (Iter. 2, 2026-05-29):** Sämtliche unten gelisteten Antipatterns AUDIT-01..10 sind in der Audit-Iteration 2 behoben. Die Tabelle bleibt als historischer Nachweis bestehen — alle Punkte haben jetzt das Häkchen.

### Verifizierte Antipatterns (Status 2026-05-29: alle behoben)

| ID | Datei : Zeile | Problem | Status |
|---|---|---|---|
| AUDIT-01 | `wasm/src/lib.rs` : 32–61 | `render()` (Mandelbrot) allokiert pro Aufruf `vec![0u8; ...]`, gibt Vec zurück. Pro-Frame-Allokation + Memcopy über WASM-Grenze. | ✅ behoben (Buffer-Sharing wie `render_julia`, alle Aufrufer migriert) |
| AUDIT-02 | `wasm/src/lib.rs` : 86–135 | `render_julia()` ist korrekt: nimmt `&mut [u8]`, schreibt in vom Caller bereitgestelltem Buffer. Diese Variante ist Referenz für AUDIT-01. | ✅ Referenz |
| AUDIT-03 | `components/FractalCanvas.tsx` : 149 | `new Uint8ClampedArray(render(...))` pro Frame — Kopie der WASM-Ausgabe. Behebung gekoppelt an AUDIT-01. | ✅ behoben |
| AUDIT-04 | `components/FractalCanvas.tsx` : 103, 173, 191 | `new ImageData(...)` pro Frame mehrfach. Sollte einmalig beim Mount erfolgen, danach Buffer wiederverwenden. | ✅ behoben (Crossfade-Buffer persistent) |
| AUDIT-05 | `components/FractalCanvas.tsx` (gesamt) | **Kein IntersectionObserver.** Panel rendert auch unsichtbar — größter Einzel-Hotspot bei Layout-Übergängen. | ✅ behoben (IO + raf-coordinator) |
| AUDIT-06 | `panels/DemoScenes.tsx` : 799–800 | `ThreeBodyScene` läuft auf 640×480 = 307k Pixel internal — 4× teurer als alle anderen DemoScenes. | ✅ Auflösung auf 400×300 + zusätzlich 30-FPS-Cap (Commit `7833455`) |
| AUDIT-07 | `App.tsx` : 1066–1083 | Während Slide-Animation (520 ms) sind `prevLayout` UND `layout` parallel im DOM. Alle Panels beider Layouts rendern gleichzeitig — doppelte Last für 520 ms pro Switch. | ✅ `contain: paint` plus globaler `raf-coordinator`-Pause-Switch fuer alle Panels (Iter. 2) |
| AUDIT-08 | gesamt | Kein zentraler `rAF`-Coordinator. Jedes Panel registriert eigenen Loop. Bei 24+ Panels = 24+ separate Callbacks. Browser bündelt sie zwar, aber globale Throttling-Steuerung fehlt. | ✅ vollständig migriert (Commit `743d12b`) |
| AUDIT-09 | AGENTS.md (vorher) | Doku-Fehler: COEP wurde als `require-corp` dokumentiert, tatsächlich ist es `credentialless` in `.htaccess` und `vite.config.ts`. **In dieser Version korrigiert.** | ✅ behoben |
| AUDIT-10 | `components/FractalCanvas.tsx` : 52 | `MAX_PIXELS = 480000` (ca. 800×600). Korrekt im Sinne der Pixel-Quality-Policy (Kategorie B = scharf). Nicht senken — stattdessen WASM-Buffer-Sharing fixen, dann sind 480k Pixel günstig. | ✅ Bewertung bestätigt, kein Senken nötig |

### Neue Befunde aus Iter. 2 (2026-05-29)

| ID | Beschreibung | Status |
|---|---|---|
| F-001 / F-002 | `isLowDetail()` allokierte `Map<number,number>` pro Frame in `FractalScenes` + `FractalJulia` — bei 800×600 ~30 000 `Map.set`/Frame, GC-Druck mit mehreren Fraktal-Panels. | ✅ Modul-Konstante + `clear()` (`3961b99`) |
| H-01 | `findBoundaryNonBlack` in `FractalScenes` lief jedes Frame, in `FractalCanvas` war es bereits gedrosselt. | ✅ `% 4` Throttle (`de74281`) |
| H-02 | `isLowDetail` lief jedes Frame, Ergebnis wird nur alle paar Sekunden ausgewertet. | ✅ `% 8` Throttle + Cache (`de74281`) |
| H-03 | `VoxelDemoColor` / `VoxelDemoBW` ohne `React.memo`. | ✅ Memo (`c65ec3b`) |
| H-04 | `ThreeBodyScene` 60-fps CPU-Render (480 000 RGBA-Bytes/Frame). | ✅ 30-FPS-Cap via neuer `makeScene(..., fpsCap)` (`7833455`) |
| H-05 | 18 Panels weiterhin mit eigenem `requestAnimationFrame` statt zentraler raf-coordinator. | ✅ alle migriert (`743d12b`) |
| H-08 | `canvas.setAttribute('data-zoom*')` pro Frame in den drei Fraktal-Pfaden — Playwright-Tests pollen ohnehin. | ✅ alle 8 Frames (`c65ec3b`) |
| H-11 | Tunnel/Rotozoom/Metaballs/Plasma-Shader nutzten anisotropisches Coord-Mapping → Verzerrung bei nicht-4:3-Panels. | ✅ aspect-preserving Mapping (`c780297`) |
| ProTracker | ScriptProcessorNode-Fallback lief auf Main-Thread und konnte die ganze Seite bremsen; VU-Bars zeigten nur Note-Trigger statt echte Pegel. | ✅ Hybrid-Reintegration aus Standalone (`034811e`, `c18cb4d`) |
| Track-Mismatch | Concurrent `ModPlayer.load()`-Calls fuehrten zu Track-/UI-/Audio-Mismatch beim schnellen Wechsel. | ✅ Generation-Guards + atomare `play(modOverride)` (`0d6e2bd`) |

### Bestätigte Stärken (NICHT anrühren)

Folgende Implementierungen sind solide und sollen erhalten bleiben:

- **`panels/FractalJulia.tsx`** — Referenz-Implementierung. Gemeinsamer Buffer (Z. 134–136), IntersectionObserver, Auflösungs-Management, bidirektionaler Zoom mit `isLowDetail()`-Detection. Pattern für andere Fraktal-Panels.
- **`utils/modplayer/`** — Vollständiger ProTracker-MOD-Player in TypeScript. Header-Validierung in `loader.ts`, AudioWorklet jetzt Pflicht (ScriptProcessorNode-Fallback wurde in Iter. 2 entfernt, da Main-Thread-blockierend). Alle Standardeffekte implementiert (Arpeggio, Vibrato, Slides, Portamento). **Macht libopenmpt-WASM überflüssig.** Standalone-Variante in `p_modplayer_singlehtml/` — Verbesserungen werden zwischen den Projekten hybridisiert.
- **`utils/wasm-loader.ts`** — Korrekter Singleton. WASM wird einmal geladen, alle Panels teilen sich das Modul.
- **`utils/shared-audio.ts`** — Singleton AudioContext mit iOS-Audio-Session-Konfiguration. Genau richtig.
- **`Cargo.toml`** — `opt-level = 3` und `lto = true` ergeben ein 23 KB WASM-Binary. Saubere Release-Konfiguration.
- **`panels/DemoScenes.tsx` `makeScene`-Factory** — elegante DRY-Lösung. Gemeinsame Infrastruktur (Resize, IntersectionObserver, OffscreenCanvas, Cached ImageData), Variation nur im `draw`-Callback. **Hat bereits einen `pixelated`-Parameter (Z. 156) — nur Default umstellen, siehe Pixel-Quality-Policy.**
- **`ui/PanelSlot.tsx`** — Kompakt und korrekt. Lokaler `localIdx`, Fade-Übergang via opacity, kein State-Lift zum Parent.
- **`isAudioPlaying()` in `App.tsx`** Z. 434 — pragmatisches Audio-Detection, blockiert Auto-Switch bei laufendem Sound.

### Verworfene Hypothesen aus früheren Versionen

- *„Mehrere Fraktal-Panels könnten sich eine WASM-Instanz teilen, falls sie das aktuell nicht tun"* — geprüft: tun sie. `wasm-loader.ts` ist Singleton.
- *„ImageData wird in allen Canvas-Panels pro Frame neu allokiert"* — nur teilweise wahr. PlasmaDemo, DemoScenes, VoxelScenes cachen korrekt. Nur FractalCanvas tut es falsch.
- *„MAX_PIXELS in FractalCanvas zu hoch"* — falsch eingeschätzt. Bei Pixel-Quality-Policy Kategorie B (= Fraktale) ist hohe Auflösung *gewollt*. Lösung ist WASM-Buffer-Sharing, nicht Auflösungs-Senkung.

---

## Panel-Inventar

### Fraktal-Panels (WASM-basiert) — Kategorie B (glatt)

| Datei | Inhalt |
|---|---|
| `components/FractalCanvas.tsx` | Mandelbrot, animierter Zoom durch 8 Koordinaten — als großes Hero-Panel über `FractalView` |
| `panels/FractalJulia.tsx` | Julia-Menge, 6 Parameter-Paare, 12s-Zyklus, WASM `render_julia()` |
| `panels/FractalScenes.tsx` | Aktive Mini-Panels: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalSatellite`, `FractalTendril`, `FractalDragon`, `FractalDendrite`, `FractalSwirl` |

### Text-Panels (Hacker-Themen)

`SystemLog`, `DataStream`, `SocialEngineering`, `Vitals`, `TrafficMonitor`, `NuclearTargets`, `PwdCracker`, `PortScanner`, `PseudoCode`, `AgentCodePanel`, `VisitorProfilePanel`, `ICQChatPanel`, `BitcoinMinerPanel`, `DiskCleanupPanel`, `StockTickerPanel`, `SatellitePanel`, `ClassifiedPanel`, `MetaAgentPanel`

### Grafik-Panels (Canvas-Animationen)

| Datei | Inhalt | Pixel-Kategorie |
|---|---|---|
| `VoxelDemo.tsx` | Voxel-Terrain-Flug (Software-Renderer): `VoxelDemoColor`, `VoxelDemoBW` | C → GPU-Migration |
| `VoxelScenes.tsx` | `VoxelThermal` (IR-Palette, Seitwärts-Drift), `VoxelLava` (zerklüftete Heightmap, Glühkanal-Boost), `VoxelNeon` (= re-export von `VectorHudPanel`), `VoxelMatrix` (= re-export von `NeuralNetPanel`) | C → GPU-Migration |
| `PlasmaDemo.tsx` | Plasma-Effekt, 4 dunkle Paletten (Nebula/Infrared/Acidic/Void), 20s-Crossfade | B (glatt) |
| `GlobePanel.tsx` | Rotierender Globus mit Kontinent-Umrissen + Ziel-Bracket | B (Vektor) |
| `DNAHelix.tsx` | Animierte DNA-Doppelhelix | B (Vektor) |
| `OscilloscopePanel.tsx` | **SpectrogramPanel** (Datei behält Name) — neon bars, peak decay, circular wave, waterfall | B (Vektor) |
| `DemoScenes.tsx` | `FireScene`, `StarfieldScene`, `TunnelScene`, `RotozoomScene`, `MetaballsScene`, `DotCloudScene`, `BoingScene`, `LissajousScene`, `ThreeBodyScene` | B (alle glatt) |
| `ParallaxPanel.tsx` | Multi-Szenen-Parallax: Raumstadt + Neon-Regen + Raumstation + Tunnel | B |
| `ElitePanel.tsx` | Wireframe-Raumschiff (Cobra Mk III), Radar, HUD — Elite-1984-Stil | B (Vektor) |
| `CADRobotPanel.tsx` | Wireframe- und Solid-3D-Roboter, 4 Modelle | B (Vektor) |
| `AmiModPanel.tsx` | Echter ProTracker-MOD-Player, 4-Kanal AudioWorklet | n/a |
| `C64Panel.tsx` | C64-Boot + Tipp-Sequenz + 4 Demo-Szenen (4:3, Rand nur im BASIC-Screen) | **A** (authentisch) |
| `RetroErrorPanel.tsx` | Slideshow retro OS-Fehlermeldungen (Mac Bomb, BSOD, Amiga Guru) | **A** (authentisch) |
| `SolarSystemPanel.tsx` | Sonnensystem-Animation, 8 Planeten + Mond + Saturn-Ring, korrekte Umlaufzeiten | B (Vektor) |
| `RadarSweepPanel.tsx` | Rotating Radar, Sweep-Linie, Blips mit Fade, bewegliche Ziele | B (Vektor) |
| `NeuralNetPanel.tsx` | Floating node graph, packets, address labels (in POOL_GFX als `VoxelMatrix`) | B (Vektor) |
| `VectorHudPanel.tsx` | 3D-Hypercube / Targeting-Wireframe (in POOL_GFX als `VoxelNeon`) | B (Vektor) |
| `DaggerfallPanel.tsx` | **ARCHIVIERT** — Castle Pixelstein Alpha 0.1, DDA-Raycasting (nicht im Pool) | (archiviert) |

### Spezial-Panels

| Datei | Inhalt |
|---|---|
| `AllYourBase.tsx` | Video von archive.org |
| `EnhanceView.tsx` | „ENHANCE PHOTO"-Slideshow, 12 Stufen, 4s, nur urbane Stadtfotos |
| `FractalView.tsx` | Wrapper für `FractalCanvas` (Hero-Panel im Layout) |

### Pool-Zuordnung (`App.tsx`)

```
POOL_TEXT       SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
                NuclearTargets, PwdCracker, PortScanner, PseudoCode,
                AgentCodePanel, VisitorProfilePanel, ICQChatPanel,
                BitcoinMinerPanel, DiskCleanupPanel,
                StockTickerPanel, SatellitePanel, ClassifiedPanel, MetaAgentPanel

POOL_GFX        VoxelDemoColor, VoxelDemoBW, VoxelThermal, VoxelLava, VoxelNeon,
                FireScene, StarfieldScene, ThreeBodyScene,
                TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
                PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
                ParallaxPanel, ElitePanel, AmiModPanel, CADRobotPanel, C64Panel,
                RetroErrorPanel, SolarSystemPanel, RadarSweepPanel,
                FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
                FractalElephant, FractalMini, FractalSatellite, FractalDragon,
                FractalDendrite, FractalSwirl, FractalJulia
```

Aktueller Stand siehe `App.tsx` Z. 68–79. (Hinweis: `GlobePanel`, `VoxelMatrix` via `NeuralNetPanel`-Re-Export, `LissajousScene` in `DemoScenes.tsx` und `OscilloscopePanel` als `SpectrogramPanel` sind aktiv — frühere „temporär entfernt"-Notiz hier war veraltet.)

---

## Layout-System

`App.tsx` enthält einen vollständig zufälligen Layout-Generator (`generateLayout`, Z. 176 ff.). Layout-Größe in cols×rows hängt von `window.innerWidth` ab:
- < 1024px → 2×2 oder 3×2 (4–6 Zellen)
- ≥ 1024px → 3×2 oder 3×3
- ≥ 1440px → 3×3 oder 4×3
- ≥ 1920px → 4×3, 4×4 oder 5×3
- ≥ 2560px → 5×4, 6×3, 6×4
- ≥ 3440px → 6×4, 7×4, 8×4 (bis zu 32 Zellen)

Auto-Switch alle 1–3 Minuten mit Slide-Animation (OS-Desktop-Stil, 520ms). Desktop: `[LAYOUT x/3]`-Button + Leertaste. Mobile: ausgeblendet.

**Implikation für Panel-Auflösung:** Bei 4–6-Zellen-Layouts auf hochauflösenden Displays werden einzelne Panels sehr groß (bis zu ca. 1280×720 oder mehr). Panels in Kategorie B sollen diese Auflösung möglichst nativ rendern — siehe Pixel-Quality-Policy.

---

## Bekannte Bugs

| ID | Problem | Priorität |
|---|---|---|
| ~~BUG-01~~ | ~~AllYourBase CORS~~ | ~~Hoch~~ — **behoben** |
| ~~BUG-02~~ | ~~Panels pausieren nicht wenn unsichtbar~~ | ~~Mittel~~ — **behoben** (IntersectionObserver in allen Canvas-Panels inkl. `FractalCanvas`) |
| BUG-03 | Mehrere Canvas-Animationen können auf schwächerer Hardware frame-droppen | Mittel — wird durch Action Plan adressiert |

---

## Roadmap (historischer Stand)

1. ~~**AmiModPanel** — echte .mod-Dateien abspielen~~ — **erledigt**: eigener ProTracker-Player in `utils/modplayer/` mit AudioWorklet + Fallback. Tracks `audio/track_*.dat` (umbenannte .mod-Dateien für Apache-Compat).
2. ~~**Fraktal-Endloszoom**~~ — **erledigt**: nahtloser Endloszoom ohne schwarze Frames, Boundary-Tracking, bidirektionaler Zoom.
3. ~~**Grid-Überarbeitung (GRID-01)**~~ — **erledigt**: `generateLayout()` in `App.tsx` erzeugt vollständig zufällige Grids.
4. **Archivierte Panels** — DaggerfallPanel bei Gelegenheit überarbeiten (FractalDendrite, FractalSwirl sind bereits wieder im Pool).

---

## Offene Todos (Eval v0.9.9)

Historischer Block — manueller Durchlauf am 2026-05-21. Alle Punkte erledigt.

### Schnell

- [x] **AgentCodePanel** — Text anpassen: jemand schreibt genau diese Seite (FraktalLab), nicht irgendein Projekt
- [x] **ICQChatPanel** — Erste 3 Nachrichten beschleunigen, danach normales Tempo
- [x] **PlasmaDemo** — Szenen auf 10s; kontinuierlicher Farbwechsel
- [x] **VisitorProfilePanel** — 10s warten nach Durchlauf, dann Panel-Wechsel
- [x] **SatellitePanel** — Mehr Bewegung ODER 10s Timeout dann Panel-Wechsel
- [x] **FractalJulia** — Flimmern reduzieren
- [x] **EnhanceView** — „Apollo"-Text fixen; anstößige/politische Bilder entfernen → nur neutrale Stadtszenen
- [x] **Fractal-Panels** — Mini-Fraktal-Varianten grundlegend verbessert, FractalView in Review integriert

### Mittel

- [x] **SolarSystemPanel** — Infotafel größer + mittig; realistische Startpositionen; Umlaufbahnen einzeichnen; Planetenbeschriftung größer + weiß
- [x] **DNAHelix** — Grau-Kugel-Artefakt fixen
- [x] **TunnelScene** — Grobpixeligkeit reduzieren
- [x] **RotozoomScene** — Kantenglättung
- [x] **BitcoinMinerPanel** — Hashing-Animation auf Textbasis
- [x] **FireScene** — Echte Feuersimulation statt blauer vertikaler Linien
- [x] **LissajousScene** — High-res smooth vectors, neon oscilloscope glow trails
- [x] **PlasmaDemo** — Mehr Kontrast, fließende Übergänge
- [x] **VoxelDemo** — Farb- vs. S/W-Differenzierung
- [x] **VoxelThermal** — Smooth target velocity lerp
- [x] **VoxelNeon** → ersetzt durch VectorHudPanel
- [x] **VoxelLava** — Auflösung 480×300, feinerer Step size
- [x] **VoxelMatrix** → ersetzt durch NeuralNetPanel
- [x] **OscilloscopePanel** → ersetzt durch SpectrogramPanel (Datei behält Name)
- [x] **GlobePanel** — Korrekte Landmassen-Polygone
- [x] **Fraktal-Panels (alle)** — Endloser zoombarer/rotierender Flug in WASM

---

## Offene Todos (Eval 2026-05-28)

Historischer Block aus Review-Modus-JSON.

### Erledigt / Bestätigt (Daumen hoch)

`FractalSeahorse`, `FractalDragon`, `ThreeBodyScene`, `FireScene`, `LissajousScene`, `TunnelScene`, `RotozoomScene`, `PlasmaDemo`, `EnhanceView`, `VoxelThermal`, `VoxelMatrix`, `StarfieldScene`, `OscilloscopePanel`, `MetaballsScene`, `AllYourBase`, `ElitePanel`, `CADRobotPanel`, `RetroErrorPanel`, `RadarSweepPanel`, `DNAHelix`, `ICQChatPanel`, `VisitorProfilePanel`, `SatellitePanel`, `BitcoinMinerPanel`, `PwdCracker`, `DiskCleanupPanel`, `StockTickerPanel`, `ClassifiedPanel`

### Erledigt nach Feedback (Daumen runter)

- [x] **FractalDendrite** — grobpixelig fix
- [x] **FractalSwirl** — grobpixelig fix
- [x] **FractalView** — Schwarzraum-Erkennung
- [x] **TrafficMonitor** — Übertriebene Zukunfts-Stats
- [x] **MetaAgentPanel** (Neu) — Grafischer Coding Agent mit Endlosschleife

---

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

# Action Plan — Demoszene-Integration (langfristig)

Hochwertige Demoszene-Inhalte, jeweils zu groß für eine Einzelsession. Werden bei Gelegenheit angegangen, ohne Reihenfolgezwang.

## LR-01 — js-dos-Panel: 64K-DOS-Intros

**Was:** Einbettung des js-dos-Players (https://js-dos.com/), basierend auf DOSBox-WASM.

**Top-Kandidaten:**
- *Heaven 7* (Exceed, 2000) — quintessentielles 64K-Intro mit Raymarching + Mod-Soundtrack. Visuell heute noch beeindruckend.
- *Stash* (Black Maiden, 2001) — atmosphärisches 64K.
- *fr-08: .the .product* (Farbrausch, 2000) — eher als „großes" Special-Panel.

**Aufwand:** Einbettung selbst überschaubar (js-dos liefert vorgefertigte JS-API). Komplexität:
- Bundle-Größe (~2 MB für js-dos-Kern)
- Audio-Routing via DEMO-06
- Lizenz pro Demo prüfen

**Pixel-Quality-Hinweis:** DOS-Demos sind authentisch 320×200 / 640×480. `imageRendering: pixelated` ist hier passend (Kategorie A wegen historischer Authentizität — auch wenn die Demo selbst „glatte" Effekte zeigt, ist das ursprüngliche Rendering pixelgenau).

**Panel-Konzept:** „RETRO BIOS — LOADING…" als faux-Boot-Sequenz, dann Fade-in der laufenden Demo.

## LR-02 — vAmiga-Panel: Amiga-Demoszene-Klassiker

**Was:** vAmiga.js (https://github.com/dirkwhoffmann/vAmigaWeb) für Amiga-OCS/ECS/AGA-Emulation.

**Top-Kandidaten:**
- *State of the Art* (Spaceballs, 1992) — Rotoscope-Tanzanimation
- *9 Fingers* (Spaceballs, 1993)
- *Desert Dream* (Kefrens, 1993)
- *Hardwired* (Crionics & Silents, 1991)
- 40K/64K-Intros von TBL, Loonies, Conspiracy

**Aufwand:** höher als js-dos. Kickstart-ROM-Lizenz (Cloanto / Amiga Forever) muss geklärt werden.

**Pixel-Quality:** wie LR-01 — Kategorie A, Amiga-Pixel sind authentisch.

## LR-03 — VICE.js / C64-Demoszene (Upgrade `C64Panel`)

**Was:** das bestehende `C64Panel` (aktuell fake-C64-Sequenz) auf echten Emulator umstellen — VICE.js oder virtualc64web (https://vc64web.github.io/).

**Top-Kandidaten:**
- *Edge of Disgrace* (Booze Design, 2008) — C64-Demo-Benchmark
- *Comaland* (Censor Design, 2014)
- *Lunatico* (Booze Design, 2018)
- 64K-Intros von Fairlight, Booze Design, Censor Design

**Aufwand:** mittel. `.prg`- oder `.d64`-Dateien hosten, Kernal-ROM-Frage praktisch unproblematisch.

**Pixel-Quality:** Kategorie A — bleibt pixelated.

## LR-04 — ~~libopenmpt-WASM für AmiModPanel~~

**Status: erledigt.** Eigener ProTracker-Player in `frontend/src/utils/modplayer/` ist vollständig implementiert. Keine externe Library nötig.

**Eventuelle Erweiterungen** (bei Bedarf): XM/S3M/IT-Support nachrüsten (aktuell nur .mod). Falls jemals nötig, ist *jetzt* libopenmpt-WASM eine Option — aber nur als Add-on, nicht als Ersatz.

## LR-05 — PICO-8 / TIC-80 Demoszene-Embedding

**Was:** Fantasy-Konsolen-Demos. PICO-8 (lexaloffle.com) und TIC-80 (tic80.com).

**Aufwand:** sehr niedrig. PICO-8 exportiert HTML5+JS, TIC-80 ist Open-Source.

**Top-Quellen:**
- BBS-Demos auf lexaloffle.com (PICO-8)
- TIC-80-Demoscene-Compos

**Pixel-Quality:** PICO-8 = 128×128, TIC-80 = 240×136. Authentisch grobpixelig (Kategorie A), aber kann mit dezenter Bezel-Grafik („Konsolen-Bildröhre") gerahmt werden, damit die Pixel im Kontext stehen.

## LR-06 — Emscripten-Port eines Open-Source-4K-Intros

**Was:** Statt Emulator: ein einzelnes Demo direkt nach WASM portieren. Storytelling-Wert hoch („dies ist ein 4096-Byte-Demo von 2008, hier ist das Build-Skript").

**Kandidaten:** Werke von Inigo Quilez mit GitHub-Source, Mercury, nodepond, PoroCYon, 4mat — meist MIT/CC0.

**Aufwand:** mittel bis hoch. C/C++ + OpenGL-ES → Emscripten ist etabliert. Windows-D3D-Demos sind out-of-scope. Linux/SDL2/OpenGL-Demos sind beste Kandidaten.

**Pixel-Quality:** wenn der Original-Code mit GL-ES auf native Auflösung rendert: Kategorie B. Wenn fixed-resolution: Kategorie A.

## LR-07 — JS1k / JS13k Showcase-Panels

**Was:** JS1k (1024 Byte JS-Demos, Archiv js1k.com) und JS13k (jährlicher Compo, js13kgames.com).

**Aufwand:** minimal. Iframe-Embed oder direkter Code-Copy.

**Top-Autoren:**
- p01 (Mathieu Henri) — legendäre JS1k-Demos
- Frank Force — viele preisgekrönte Mini-Spiele und Demos

**Lizenz:** JS1k-Submissions sind typischerweise sehr frei.

**Panel-Konzept:** Einbettung mit „1024 BYTES"/„13K"-Label, optional minifizierter Source als Hintergrund-Watermark.

## LR-08 — ZX Spectrum / Atari ST

**Was:** weitere Retro-Plattformen.

**Emulatoren:**
- ZX Spectrum: JSSpeccy3 (https://github.com/gasman/jsspeccy3) — ZX hat eine extrem aktive Sizecoding-Szene
- Atari ST: Hatari hat experimentelle Web-Builds (weniger ausgereift)

**Pixel-Quality:** beide Kategorie A.

## LR-09 — WebGPU-Experimentalpanel

**Was:** mindestens ein Panel auf WebGPU statt WebGL — Compute-Shader-Anwendung als Tech-Statement.

**Konkrete Anwendung:** Cellular Automata mit großem Grid, Boid-Schwärme 10k+, GPU-Partikel-Sim, Reaction-Diffusion (Gray-Scott). Für FraktalLab-Thema: „Neural Net Visualizer" mit echtem Compute-Pfad oder Reaction-Diffusion in 4K-Auflösung.

**Aufwand:** mittel. WebGPU in Chrome/Edge stabil, Safari 18.1+, Firefox hinterher. Feature-Detection mit WebGL-Fallback nötig.

**Pixel-Quality:** Kategorie B, native Auflösung.

## LR-10 — Demoszene-Storytelling-Layer

**Was:** Optionaler „Curator-Modus", Hover/Click auf ein Demoszene-Panel öffnet Info-Card: Titel, Gruppe, Jahr, Plattform, Original-Größe, Pouet-Link.

**Aufwand:** niedrig, sobald Demos integriert sind. Eine JSON-Datei pro Eintrag, Hover-getriggertes Overlay.

## LR-11 — Mobile-Strategie für schwere Demos

**Was:** Mobile-Panels (aktuell 3 PanelSlots) müssen schwere Demoszene-Inhalte ausschließen oder durch vorgerenderte MP4-Loops ersetzen. Emulatoren auf iOS-Safari halten 60 fps oft nicht.

**Aufwand:** niedrig. Pool-Filter pro Plattform/Device-Capability. Service-Worker-Caching für MP4-Fallbacks.

## LR-12 — Lizenz- und Attribution-Infrastruktur (Erweiterung von DEMO-05)

Falls FraktalLab je außerhalb des privaten Showcases gezeigt wird:
- `licenses.json` als Single Source of Truth
- Build-Step verifiziert Vollständigkeit
- Auto-generierte Credits-Seite
- Pro Demoszene-Panel kleines Attribution-Overlay (siehe LR-10)

## LR-13 — Hero-Demo-Modus

**Was:** Vollbildmodus, in dem eine einzelne Demoszene-Produktion (z. B. Heaven 7 oder eine Amiga-Demo) das ganze Dashboard übernimmt, während andere Panels als kleine PiP-Bilder am Rand laufen. Präsentationsmodus.

**Aufwand:** mittel. Voraussetzung: LR-01 oder LR-02 existiert. Layout-Engine um vierten Modus erweitern.

## LR-14 — Three.js / Babylon.js Hi-Res-3D-Showcase

**Was:** falls eines Tages „echtes" 3D mit Texturen/PBR gewünscht ist (statt Wireframe), eine Three.js- oder Babylon.js-Komponente als zusätzliches Panel-Format. Kandidaten:
- Procedural Planet (Höhenfeld + Atmosphäre, Shader)
- Voronoi-3D-Stadt
- Wave-Function-Collapse generierte Strukturen
- Procedural Spaceship/Asteroid (rotierende komplexe Geometrie)

**Aufwand:** mittel-hoch. Three.js bringt ~150 KB extra, Babylon.js mehr. Lohnt sich nur wenn mehrere 3D-Panels davon profitieren.

**Pixel-Quality:** Kategorie B, native Auflösung.

---

## Notizen für Coding-Agents

- Diese Datei ergänzt nicht den Build-/Setup-Teil aus `DEV_GUIDE.md`. Sie ist ein Implementierungs-Backlog plus Architektur-Referenz.
- **Reihenfolge der Action-Plan-Sektionen ist priorisiert:** Quick-Wins zuerst (Code-Audit-basiert, verifiziert), dann Performance/Architektur, dann WebGL-Infrastruktur, dann Demoszene-Content.
- **Pixel-Quality-Policy ist verbindlich** — vor jedem Panel-Touch konsultieren. Default ist Kategorie B (glatt, native Auflösung).
- **Vor jeder Demoszene-Übernahme externer Werke:** Lizenz prüfen, Eintrag in `licenses.json` (sobald DEMO-05 existiert), Attribution sichtbar im Panel.
- **Speed-first-Regel weiterhin gültig:** jeder Eintrag > eine Session wird in Teilschritte zerlegt. Halbfertiges wird nicht committed.
- **Demoszene-Etiquette:** Autoren werden namentlich genannt, Originalquellen verlinkt, Modifikationen dokumentiert. Die Szene ist klein und vernetzt — gute Attribution zahlt sich aus.
- **Visualtests laufen lassen:** nach jedem Refactoring `npm run test:panels` und ggf. Review-Modus durchklicken. `tests/screenshots/panels/*.png` als Diff-Quelle.
- **WASM-Builds nicht vergessen:** Änderungen in `wasm/src/lib.rs` brauchen `wasm-pack build` (siehe `DEV_GUIDE.md`).
- **Bei Unsicherheit zwischen „CPU-Optimierung" und „GPU-Migration":** wenn das Panel Kategorie B ist und auf großen Layouts > 1 Vollbild-Renderpass macht, ist GPU-Migration der richtige Weg. CPU-Mikro-Optimierungen lohnen sich nur bei Panels, die ohnehin CPU bleiben (Vektor, Text, retro-authentic).
- **Wenn ein Quick-Win unerwartete Visual-Regressions erzeugt** (anders aussehende Panels im Playwright-Diff): Pixel-Quality-Policy konsultieren, prüfen ob das Panel in Kategorie A oder B fällt, danach entscheiden ob die neue Darstellung gewünscht ist oder ob ein `pixelated: true` Override für dieses Panel die Lösung ist.
