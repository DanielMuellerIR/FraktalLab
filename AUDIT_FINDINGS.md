# AUDIT_FINDINGS.md — FraktalLab

> **Status 2026-05-30:** Phasen 1 + 2 abgeschlossen (F-001..F-008, H-01..H-08, H-11 in Commits umgesetzt). **Phase 3 (Mess-Baseline) erledigt** — Harness `frontend/tests/perf-measure.spec.ts`, Ergebnisse + Verdikt in `PERF_NOTES.md`: **H-07 nicht bestätigt** (WASM byte-identisch zur Baseline, kein eindeutiger Frame-Time-Regress; einziges Negativ-Signal Heap-Wachstum B-3). App-Version `1.6.0`+ auf Branch `audit/2026-05-29`. **Offen:** Phase 5 (Demoscene-Panel-Tiefen-Audit) + Phase-3-Follow-ups (Headed-GPU-Messung, Panel-Pool fixieren, B-3 Heap nachgehen).

> Audit-Branch: `audit/2026-05-29`. Quelle: Inspektion gegen `AGENTS.md` (v1.2.7) und `blueprint_audit.md`. Methode: Read-only, drei parallele Investigator-Agents + Spot-Checks.

---

## Top-5-Befunde (höchste vermutete Performance-Wirkung)

1. **F-001 / F-002 — `isLowDetail()` allokiert `Map` pro Frame** in `FractalScenes.tsx` und `FractalJulia.tsx`. Bei einem 800×600-Panel ~30 000 `Map.set`-Calls pro Frame. Mehrere Fraktal-Panels gleichzeitig im Layout → starker GC-Druck. **Heißester Kandidat für das Ruckeln.**
2. **F-003 — PERF-10 nur halb durchgezogen.** 11 Panels nutzen `raf-coordinator`, 18 Panels nutzen weiterhin direkt `requestAnimationFrame`. Inkonsistente Pause-Steuerung. Globales Pause-Signal während Layout-Slide greift nur teilweise.
3. **F-004 — `VoxelDemo.tsx` ohne `React.memo`.** Einzelner Ausreißer bei der PERF-11-Migration. Bei jedem Parent-Re-Render werden Voxel-Panels potenziell mit-remounted (= rAF-Loop neu, Heightmap-Init neu).
4. **F-005 — QW-06 (`ShaderPanel`) hat kein explizites `imageRendering`-Styling.** Funktioniert via Browser-Default ('auto'), aber nicht dokumentiert. Bei Panels, die bewusst pixelig sein sollen (Voxel C-Migration noch ausstehend), fehlt die Differenzierung.
5. **F-006 — `5264baf` (v1.2.6, 28 Dateien) ist der größte Commit der letzten Wochen.** Massiv-Refactor von CADRobotPanel, GlobePanel, DaggerfallPanel, plus 7 neue Panels + WebGL-Migrationen. Plausibler Einfallspunkt für die vom Auftraggeber beobachtete Regression („vor einigen Tagen lief es flüssig").

---

## 1.2 Quick-Win-Soll-Ist (QW-01 … QW-09)

| QW-ID | Behauptung AGENTS.md | Ist-Zustand im Code | Diskrepanz | Schweregrad |
|-------|----------------------|---------------------|------------|-------------|
| QW-01 | offen | **erledigt** — `wasm/src/lib.rs:32` `render(buf:&mut[u8],…)`; `:83` `render_julia` analog; alle JS-Aufrufer in `FractalCanvas.tsx:202,233`, `FractalScenes.tsx:263,265` nutzen Shared-Buffer | keine | – |
| QW-02 | offen | **partial** — IO vorhanden (`FractalCanvas.tsx:54`), Buffer einmalig (`:91–104`), `findBoundaryNonBlack` gedrosselt (`:188`, `% 4`). `imageRendering: 'auto'` (`:263`). Crossfade-Allokation: prüfen offen | siehe F-007 | mittel |
| QW-03 | offen | **erledigt** — `DemoScenes.tsx:874` `ThreeBodyScene(400, 300)` | keine | – |
| QW-04 | offen | **erledigt** — `DemoScenes.tsx:31` `pixelated:boolean=false`, `:153` Filter-Switch | keine | – |
| QW-05 | offen | **erledigt** — `FractalJulia.tsx:322` `imageRendering:'auto'`, `:140–141` Auflösung dynamisch per ResizeObserver | keine | – |
| QW-06 | offen | **erledigt (anders als geplant)** — PlasmaDemo/Tunnel/Metaballs/Rotozoom/Fire wurden direkt auf GPU-Shader migriert (siehe Git-Log: `db5513e`, `96bcd92`). `ShaderPanel.tsx:441` Canvas hat keinen `imageRendering`-Style → Browser-Default `auto`. VoxelScenes nutzt jetzt auch ShaderPanel. | F-005 (Doku-Drift, nicht explizit gesetzt) | niedrig |
| QW-07 | offen | **erledigt** — `App.tsx:1146` `prevLayout`-Container hat `style={{ contain:'paint' }}` während Slide | keine | – |
| QW-08 | erledigt | erledigt | keine | – |
| QW-09 | offen | Playwright-Setup vorhanden, `tests/panel-check.spec.ts` + `review-all-panels.spec.ts` + `fractal-checks.spec.ts` | keine | – |

**Zusammenfassung Quick-Wins:** Alle QWs 1–9 sind im Wesentlichen umgesetzt. AGENTS.md ist hier veraltet — die „Action Plan — Quick-Wins"-Sektion sollte als erledigt markiert werden (Doku-Drift, siehe Querschnitts-Abschnitt unten).

---

## 1.3 PERF / GL / DEMO

| ID | Status | Befund |
|----|--------|--------|
| PERF-10 (raf-coordinator) | **partial** | `frontend/src/utils/raf-coordinator.ts` existiert (44 LOC). 11 Dateien importieren ihn (App, ShaderPanel, AmiModPanel, FractalScenes, LidarScanPanel, DemoScenes, TixyPanel, FractalJulia, NeuralLinkDecoderPanel, DaggerfallPanel, FractalCanvas). **18 weitere Dateien rufen weiterhin direkt `requestAnimationFrame` auf:** C64Panel, CADRobotPanel, DNAHelix, DemoScenes (?), ElitePanel, NeuralNetPanel, OscilloscopePanel, ParallaxPanel, PhysicsSandboxPanel, RadarSweepPanel, RetroErrorPanel, SolarSystemPanel, StockTickerPanel, SupervolcanoPanel, ThermonuclearWarPanel, TrafficMonitor, VectorHudPanel, VoxelDemo. → **F-003** |
| PERF-11 (React.memo) | **fast vollständig** | 51 von 52 Panels gewrappt. Einziger Ausreißer: `VoxelDemo.tsx`. → **F-004** |
| GL-01 (ShaderPanel) | **erledigt** | `frontend/src/ui/ShaderPanel.tsx` (488 LOC) |
| GL-02 (WebGL-Pool) | **erledigt** | `frontend/src/utils/webgl-pool.ts` (82 LOC). LRU-Eviction. Aus Git-Log: `MAX_GL_CONTEXTS=16` (Commit `11856fc`). |
| GL-03 (CPU→GPU) | **teilweise** | Migriert: PlasmaDemo, Tunnel, Metaballs, Rotozoom, Fire (Commits `db5513e`, `96bcd92`). **Nicht migriert: ThreeBodyScene** (`DemoScenes.tsx:874` — weiterhin CPU, jetzt bei 400×300). |
| GL-04 (Voxel-Raymarching) | **vermutlich erledigt** | VoxelScenes (Thermal/Lava) nutzen laut Investigator ShaderPanel-Pfad. VoxelDemo (Color/BW) prüfen — könnte noch CPU sein. → Folgeprüfung |
| DEMO-01 (ShadertoyPanel) | **erledigt** | Datei existiert |
| DEMO-02 (TixyPanel) | **erledigt** | Datei existiert |
| DEMO-03 (IQTechniquePanel) | **erledigt** | Datei existiert |
| DEMO-04 (LovebyteShowcasePanel) | **erledigt** | Datei existiert |

---

## 1.4 Panel-Inventur (Soll/Ist)

- **52 Dateien** in `frontend/src/panels/`.
- Keine in AGENTS.md gelistete Datei fehlt im Dateisystem.
- Keine Datei im Dateisystem fehlt in AGENTS.md.
- **Doku-Drift:** AGENTS.md Z. 262 nennt `GlobePanel`, `VoxelMatrix`, `LissajousScene`, `OscilloscopePanel` als „auskommentiert/temporär entfernt". Im Code sind sie **aktiv** (GlobePanel.tsx, NeuralNetPanel als Re-Export für VoxelMatrix, LissajousScene in DemoScenes, OscilloscopePanel als SpectrogramPanel). → **F-008 (Doku)**
- Neue Panels seit dem in AGENTS.md dokumentierten Stand (alle gelistet, aber spät hinzugekommen): `LidarScanPanel`, `NeuralLinkDecoderPanel`, `NuclearExplosionPanel`, `PhysicsSandboxPanel`, `SupervolcanoPanel`, `ThermonuclearWarPanel`, `MoonPanel`, `IQTechniquePanel`, `LovebyteShowcasePanel`, `ShadertoyPanel`, `TixyPanel`. (Stammen aus Commit `5264baf` v1.2.6 und Folge-Commits.)

---

## 1.5 Statische Antipatterns

| ID | Datei : Zeile | Befund | Schweregrad | Quick-Win |
|----|---------------|--------|-------------|-----------|
| **F-001** | `frontend/src/panels/FractalScenes.tsx:51, 295` | `isLowDetail()` allokiert `new Map<number,number>()` pro Aufruf. Wird im rAF-Loop nach jedem Render-Tick aufgerufen. Bei ~30 000 `Map.set`-Calls pro Frame in einem 800×600-Panel + mehreren parallel laufenden Fraktal-Mini-Panels: hohe GC-Last. | **hoch** | ja |
| **F-002** | `frontend/src/panels/FractalJulia.tsx:18, 258` | Selbes Pattern wie F-001. `isLowDetail()` mit `Map`-Alloc pro Frame. | **hoch** | ja |
| F-003 | siehe PERF-10 oben | 18 Panels noch außerhalb des raf-coordinators. Globaler Pause-Switch greift nur partiell. | mittel | nein (Refactor) |
| F-004 | `frontend/src/panels/VoxelDemo.tsx` | Kein `React.memo`-Wrapper. Einziger Ausreißer. | niedrig–mittel | ja (1 Zeile) |
| F-005 | `frontend/src/ui/ShaderPanel.tsx:441` | `<canvas style={{ width:'100%', height:'100%', display:'block' }}/>` — `imageRendering` nicht explizit. Defaults `auto`, das passt für Kategorie B. Für VoxelScenes (Kategorie C, soll pixelated sein) gäbe es keinen Override-Pfad. | niedrig | unsicher |
| F-007 | `frontend/src/components/FractalCanvas.tsx` (Crossfade) | QW-02 Schritt 3+4 (drei persistente Crossfade-Buffer, `getImageData` durch `prev.data.set(...)` ersetzen) ist Status laut Spot-Check zu prüfen. Investigator hat es als „OK" markiert, aber die explizite Drei-Buffer-Trennung war Spec. | mittel | unsicher (Folgeprüfung) |
| – | – | **Keine** Treffer für: `toDataURL` in rAF, `JSON.stringify` in rAF, `getImageData` in rAF (nur in Setup/Event), `setInterval`/`setTimeout` parallel zu rAF in Hotpaths. | – | – |
| – | – | **Allokationen auf Resize, nicht pro Frame** — korrekt: `FractalCanvas.tsx:95–104`, `FractalJulia.tsx:142–144`, `FractalScenes.tsx:203–204`. | – | – |

---

## 1.6 Architektur-Sanity

| Punkt | Status |
|-------|--------|
| WASM-Singleton | ✅ `utils/wasm-loader.ts` cachiert das geladene Modul. Korrekt. |
| AudioContext-Singleton | ✅ `utils/shared-audio.ts` Singleton-Guard. iOS-Audio-Session-Config korrekt. |
| WebGL-Pool | ✅ `utils/webgl-pool.ts` mit LRU-Eviction (`MAX_GL_CONTEXTS=16`). |
| ResizeObserver/IO-Cleanup | ✅ Alle gefundenen Observer rufen `.disconnect()` in `useEffect`-Cleanup. |
| `window.addEventListener`-Cleanup | ✅ Stichprobenartig in `App.tsx:557–558` (resize), `:804–825` (keydown ×2), `AmbientSound.tsx:241–274`, `PhysicsSandboxPanel.tsx:171–521`. |
| Doppelte `getContext('2d')` auf demselben Canvas | – Kein Befund. `SupervolcanoPanel.tsx:13,29` nutzt Canvas + OffscreenCanvas (intendiert). |

---

## 1.7 Doku-Drift (Q-A) — Zusammenfassung

| Stelle in AGENTS.md | Problem |
|---------------------|---------|
| „Action Plan — Quick-Wins (sofort, Code-Audit-basiert)" | Alle 9 QWs umgesetzt — sollten als erledigt markiert oder ins Archiv verschoben werden. |
| „Action Plan — Performance & Architektur" PERF-10 | Implementiert, aber Migration unvollständig (11 von 29 Panels) — sollte als „partial" gekennzeichnet werden, mit Migrationsliste. |
| „Action Plan — Performance & Architektur" PERF-11 | 98 % umgesetzt, fehlt: VoxelDemo. |
| „Action Plan — WebGL-Infrastruktur" GL-01..04 | Umgesetzt bis auf ThreeBodyScene + ggf. VoxelDemo. |
| „Action Plan — Demoszene-Integration (kurz/mittel)" DEMO-01..04 | Alle vier Panels existieren — Tiefe nicht bewertet (Phase 5). |
| Z. 262 „auskommentierte/temporär entfernte Einträge" | Veraltet — alle vier Panels (GlobePanel etc.) sind aktiv. |
| Z. 19 „Aktueller Stand: v1.2.7" | OK — passt zu `package.json`. |
| `BUG-02` | Korrekt als behoben markiert, aber Anmerkung „außer FractalCanvas — siehe QW-02" ist veraltet (FractalCanvas hat jetzt IO). |

---

## 1.8 Regression-Kandidat (Phase-2-Vorausblick)

Auftraggeber: „vor einigen Tagen lief App flüssig". Letzte ~10 Commits Größe:

| Commit | Dateien | Beschreibung |
|--------|---------|--------------|
| 79cbf94 | 1 | `.gitignore` (test-results) |
| 72f8ca5 | klein | WebGL-Panel-ID Fix |
| 861fbbd | klein | Test-Logging |
| d6a0306 | 1 | WASM-Importer Error-Catching |
| 9e17aa0 | klein | WebGL Canvas-Remount |
| 183629a | 1 | Voxel-Thermal-Kamera |
| fac49d8 | 1 | Fraktal-Koordinaten |
| 960340a | 1 | Synthwave-Kamera |
| 11856fc | 1 | `MAX_GL_CONTEXTS=16` |
| 0bdc89e | 1 | Geothermal-Textur |
| 89a3220 | 1 | Globe-Textur |
| b82b2ac | 1 | Lunar-Textur |
| **5264baf** | **28** | **v1.2.6 — Demoszene-Upgrades, 3D-WebGL-Panels, Review-Mode-Layout** |

→ Hypothese H-01: Regression wurde mit `5264baf` (v1.2.6) eingeführt. Größenordnung passt zum vom Auftraggeber geschilderten Auf-und-Ab. Verifizieren in Phase 3 per Baseline-Messung gegen Vor-Commit.

---

## Phase-1-Stopp

Empfehlung an den Auftraggeber:

1. **Quick-Win-Kandidaten zum sofortigen Freigeben** (kleine, mechanische Fixes mit erwartet großer Wirkung):
   - **F-001 + F-002**: `colorCounts`-Map einmal als Modul-Konstante anlegen und am Eingang von `isLowDetail()` mit `colorCounts.clear()` zurücksetzen. Alternativ: `Map` ganz durch ein typisiertes Counting (z. B. `Map<number, number>` weglassen und nur „dominant color count" mit Streichholz-Algorithmus ermitteln). 5–10 Zeilen pro Datei.
   - **F-004**: `VoxelDemo`-Default-Export mit `React.memo()` wrappen.
2. **Folgeprüfung F-007** (FractalCanvas Crossfade): konkret nachschauen, ob die drei Buffer/ImageData persistent sind oder noch pro Slide-Cycle erzeugt werden.
3. **Phase 2 (Hypothesenbildung)** als nächster Schritt — speziell vertiefte Lesung von `FractalCanvas`, `FractalScenes`, `FractalJulia` und der nicht-migrierten 18 rAF-Panels.
4. **Phase 3 Baseline-Messung** gegen Pre-`5264baf`-Commit empfohlen, sobald die Mess-Infrastruktur (Phase 3.1) inventarisiert ist.

Bitte freigeben: welche der Quick-Win-Kandidaten **vor** Phase 2 umgesetzt werden sollen (das verändert die spätere Mess-Baseline — laut blueprint_audit.md gewollt).

---

## Q-A — Vorschlag zur AGENTS.md-Auslagerung

Die `AGENTS.md` ist auf ~880 Zeilen gewachsen. Sinnvolle Auslagerungen, ohne den „Einstiegspunkt für künftige Agent-Sessions" zu schwächen:

- **`docs/ACTION_PLAN_HISTORY.md`** — komplette Action-Plan-Sektionen (Quick-Wins QW-01..QW-09, PERF-10..12, GL-01..05, DEMO-01..06) inkl. ausführlicher Begründungen und Code-Schnipsel. In `AGENTS.md` bleibt nur die kompakte Status-Übersicht plus ein Verweis. → spart ~350 Zeilen.
- **`docs/PANEL_INVENTORY.md`** — die langen Panel-Tabellen inkl. Pixel-Kategorie und Pool-Zuordnung. In `AGENTS.md` reicht eine Top-Level-Zusammenfassung („52 Panels, Inventar siehe…"). → spart ~70 Zeilen.
- **`docs/LONGTERM_DEMOSCENE.md`** — gesamter LR-01..LR-14-Block (rein zukünftige Wunschliste). → spart ~120 Zeilen.

Was definitiv in `AGENTS.md` bleibt (agent-agnostischer Einstiegspunkt):
- Projektcharakter, Pixel-Quality-Policy, Tech-Stack, Repo-Struktur, Architektur-Kernpunkte, Code-Audit-Befunde-Tabelle (kurz), Bekannte Bugs, Roadmap, Notizen für Coding-Agents.

Vorschlag nicht ohne Freigabe umsetzen — Auslagerung ist mechanisch, aber Routenwahl ist Auftraggeber-Entscheidung.

---

# Phase 2 — Hypothesen zum Ruckeln

> Tiefenlesung der Fraktal-Stack-Dateien, App-Layout-Pfad, raf-coordinator, VoxelDemo, DemoScenes/ThreeBodyScene. F-001/F-002 sind bereits gefixt (`3961b99`), zählen hier nicht mehr.

## Priorisierte Hypothesen

| ID | Verdacht | Datei : Zeile | Belegt durch | Erwartete Wirkung | Fix-Aufwand |
|----|----------|---------------|--------------|-------------------|-------------|
| **H-01** | `findBoundaryNonBlack` in `FractalScenes` läuft **ohne Throttling** pro Frame, sobald `zoomDirection === 1 && zoom > 8`. In `FractalCanvas.tsx:188` wird derselbe Aufruf nur jeden 4. Frame gemacht. O(maxRadius)-Scan + zusätzliche Nachbar-Checks. 10 Mini-Fraktal-Komponenten potenziell parallel im Layout. | `FractalScenes.tsx:287` | Direkte Inspektion. Kein `frameCount % N`-Gate vor dem Call sichtbar. | hoch | 3 Zeilen (Throttle-Counter analog `FractalCanvas`) |
| **H-02** | `isLowDetail()` läuft **jedes Frame** in `FractalScenes` und `FractalJulia`. Auch mit Map-Pooling (F-001/F-002 gefixt) bleiben ~30 000 pro-Frame Sample-Iterationen + Map-Hash-Ops. Throttling auf 1/8 oder 1/16 reicht für Bidirektional-Zoom-Logik problemlos. | `FractalScenes.tsx:306`, `FractalJulia.tsx:268` | Direkte Inspektion. Branch wird nach jedem Render-Tick durchlaufen. | mittel–hoch | 3 Zeilen pro Datei |
| **H-03** | `VoxelDemo.tsx` Komponenten **ohne `React.memo`** (einzige Ausreißer) **und** mit eigenem `requestAnimationFrame` statt `raf-coordinator`. Bei Parent-Re-Render: Re-Mount → rAF-Stop → Heightmap-Init neu → rAF-Start. Treffer-Wahrscheinlichkeit bei Layout-Slides. | `VoxelDemo.tsx:154,225` (Exports), `:169–208` (eigene rAF-Loop) | Direkte Inspektion. F-004 bereits gemeldet. | mittel | 2 Zeilen Memo-Wrapper + Migration auf `subscribe()` |
| **H-04** | `ThreeBodyScene` ist nach QW-03 zwar auf 400×300, aber **weiterhin CPU** und ohne FPS-Cap. Renderfüllung 480 000 RGBA-Bytes pro Frame. Wenn 2+ DemoScenes im Layout, summiert sich das. | `DemoScenes.tsx:873–906` | Direkte Inspektion. GL-03-Migration steht für ThreeBodyScene noch aus. | mittel | (a) 30-FPS-Throttle im `draw`-Pfad: einfach. (b) GPU-Migration: separate Session. |
| **H-05** | **18 Panels nutzen weiterhin direkt `requestAnimationFrame`** statt `raf-coordinator`. Globaler Pause-Switch (App.tsx setzt während Slide `setPaused(true)`) greift nur bei 11 von 29 Panels. Während des 520 ms-Slide laufen Voxel/Elite/CADRobot/DNA/Solarsystem/Radar/usw. weiter. | `VoxelDemo.tsx`, `CADRobotPanel`, `DNAHelix`, `ElitePanel`, `NeuralNetPanel`, `OscilloscopePanel`, `ParallaxPanel`, `PhysicsSandboxPanel`, `RadarSweepPanel`, `RetroErrorPanel`, `SolarSystemPanel`, `StockTickerPanel`, `SupervolcanoPanel`, `ThermonuclearWarPanel`, `TrafficMonitor`, `VectorHudPanel`, `C64Panel`, `DemoScenes` (Mischfall) | Phase-1-Investigator-Auswertung. | hoch im Slide-Übergang, mittel sonst | mittel (~20 Mini-Migrationen, jeweils `requestAnimationFrame` durch `subscribe()` ersetzen) |
| **H-06** | `handleSkipSlot` (und `handleSkipMobileSlot`) **ohne `useCallback`** in App.tsx. Closure pro App-Render neu, an `PanelSlot` weitergereicht. Memo-Equality scheitert, PanelSlot rendert neu mit. | `App.tsx:561` ff. | Direkte Inspektion. Memo-Wert flach, Callback ist die einzige instabile Prop. | niedrig–mittel (nur während Layout-Slide) | 2 × `useCallback(…, [])` |
| **H-07** | **Regressions-Verdacht:** Commit `5264baf` (v1.2.6, 28 Dateien — CADRobot/Globe/Daggerfall-Rewrites + 7 neue Panels + WebGL-Migrationen + Review-Mode-Umbau) korrespondiert mit dem vom Auftraggeber geschilderten „vor einigen Tagen lief es flüssig". | `git show 5264baf` | Git-Log + Statistik aus Phase 1. | unbekannt (Phase 3) | Baseline-Messung gegen Pre-Commit nötig |
| **H-08** | `canvas.setAttribute('data-zoom', …)` und `data-zoom-direction` **pro Frame** in `FractalCanvas` und `FractalScenes`. DOM-Mutation pro Frame, ohne dass jemand polled. | `FractalCanvas.tsx:217–218`, `FractalScenes.tsx:298–299` | Direkte Inspektion. | niedrig | entweder löschen oder nur jeden N-ten Frame schreiben |
| **H-09** | **DPI/devicePixelRatio:** kein expliziter `* devicePixelRatio`-Hook in Canvas-Size-Logik gesehen. Auf Retina rendert die App vermutlich in CSS-Pixeln und der Browser skaliert hoch — kann visuell unscharf wirken, ist aber **performance-freundlich**. Nur zu erwähnen, falls Schärfe-Feedback kommt. | (gesamt) | Negativ-Befund — keine `devicePixelRatio`-Multiplikation gefunden | gering (Performance) / kontextabhängig (Optik) | (keiner empfohlen) |

## Hypothesen-Cluster und Pareto

**Drei Stellschrauben mit höchstem Hebel:**

1. **H-01 (Boundary unthrottled) + H-02 (isLowDetail unthrottled)** — gemeinsam vermutlich der größte CPU-Block der Fraktal-Panels nach dem Map-Fix. Beide trivial fixbar. Erwartung: spürbar weniger CPU-Last in Layouts mit 2+ Fraktal-Mini-Panels.

2. **H-05 (raf-coordinator nur partial)** — strukturell wichtig, **aber Aufwand mittel** (~20 Dateien). Während Layout-Slide doppeltes Rendering trotz `contain: paint`. Diskutieren: gezielt nur die teuersten (VoxelDemo, CADRobot, NeuralNet, ParallaxPanel, RadarSweep, SolarSystem) migrieren — der Rest ist CPU-arm.

3. **H-03 (VoxelDemo Memo + Coord-Migration) + H-04 (ThreeBody CPU/FPS-Cap)** — Einzel-Panels, jeweils niedrig hängende Frucht.

**Phase-3-Mess-Prioritäten:**

- **M-01-Variante:** Layout mit 3 Fraktal-Mini-Panels + Fraktal-Hero (Review-Modus). Erwartung H-01/H-02 schlagen durch.
- **M-02-Variante:** Layout mit VoxelDemo + ThreeBodyScene + 2 weiteren GFX. Erwartung H-04/H-05 schlagen durch.
- **M-Baseline:** Pre-`5264baf`-Commit identische Messungen. H-07 prüfen.

## Nicht-Befunde (zur Beruhigung)

- WASM-`render()`/`render_julia()` allokieren rust-seitig nichts pro Frame.
- WASM-Modul-Größe ~23 KB (Cargo Release-Profil korrekt).
- Crossfade-Buffer in `FractalCanvas` werden persistent gehalten (F-007 entkräftet — drei `ImageData`-Triple in `syncSize()`, reuse pro Frame; **keine** `new ImageData` im rAF-Body).
- `raf-coordinator.ts` selbst hat keinen Re-Init-Bug (Modul-Scope, persistent).
- PanelSlot-Keys (`${layout.id}-text-${i}`, `${layout.id}-gfx-${i}`) sind stabil über Layout-Wechsel, solange `layout.id` stabil bleibt → kein versehentliches Remount.
- POOL_TEXT / POOL_GFX werden memoed angelegt.

---

## Phase-2-Stopp

Empfehlung zur Freigabe für die nächste Iteration (Quick-Wins vor Mess-Phase, da geringe Eingriffstiefe und große Wahrscheinlichkeit, dass Phase-3-Messungen sonst durch dieselben Hotspots verzerrt sind):

- **H-01 fixen** — `findBoundaryNonBlack`-Throttle in `FractalScenes.tsx:287` (3 Zeilen).
- **H-02 fixen** — `isLowDetail`-Throttle in `FractalScenes.tsx:306` und `FractalJulia.tsx:268` (je 3 Zeilen).
- **H-03 fixen** — `React.memo`-Wrap auf `VoxelDemo`-Exports (2 Zeilen).
- **H-06 fixen** — `useCallback` auf `handleSkipSlot` / `handleSkipMobileSlot` in App.tsx (2 Zeilen).

Optional in dieser Runde:
- **H-08 fixen** — DOM-Attribute pro Frame entfernen (Cosmetic-Cleanup, niedrige Wirkung).
- **H-04 (Throttle-Variante)** — 30-FPS-Cap auf `ThreeBodyScene`.

Größere Stücke für eigene Sessions:
- **H-05** — Massen-Migration der 18 verbliebenen Panels auf `raf-coordinator`. Eigene Session sinnvoll.
- **H-07-Verifikation** — Phase-3-Baseline-Messung gegen `5264baf^`.

---

## Iter.-2-Abschluss (Session-Ende 2026-05-29)

Alle in Phase 1 + Phase 2 identifizierten Befunde wurden in derselben Session umgesetzt. Commit-Übersicht (Branch `audit/2026-05-29`, 24 Commits, App-Version `1.6.0`):

| Befund | Commit | Beschreibung |
|---|---|---|
| F-001 / F-002 | `3961b99` | `isLowDetail` Map-Hoist (Modul-Konstante + `clear()`) |
| H-01 / H-02 | `de74281` | `findBoundaryNonBlack` `% 4` + `isLowDetail` `% 8` + Cache |
| H-03 / H-08 | `c65ec3b` | `VoxelDemo` `React.memo` + `data-zoom*` setAttribute alle 8 Frames |
| H-04 | `7833455` | `ThreeBodyScene` 30-FPS-Cap via `makeScene(..., fpsCap)` |
| H-05 | `743d12b` | 20 Panels auf zentralen `raf-coordinator` migriert |
| H-06 | erledigt vor Audit | `handleSkipSlot`/`handleSkipMobileSlot` schon mit `useCallback` |
| H-07 | ✅ widerlegt | Phase 3 gemessen (`PERF_NOTES.md`): WASM byte-identisch zur Baseline, kein eindeutiger Frame-Time-Regress. H-07 **nicht bestätigt**. B-3 (Heap +9 MB) per Forced-GC-Diagnose M-06b als GC-Sägezahn entlarvt — kein Leak. Kein nachweisbarer Regress übrig. |
| H-11 (neu) | `c780297` | Aspect-preserving Coord-Mapping in Tunnel/Rotozoom/Metaballs/Plasma |
| ProTracker-Reintegration | `034811e`, `c18cb4d`, `0d6e2bd` | Standalone-Hybrid: kein ScriptProcessor-Fallback, echte VU-Pegel, EMA, Race-Fix |
| ProTracker-Features | `553347a`, `614d5b5`, `164a7ca`, `569bd90`, `c42659f`, `c931285` | Drop/Picker, Scrubber, 13-Track-Set + Attribution |
| GlitchOverlay | `cefcb23` | VHS-Aesthetik + Performance-Refactor (Scanlines als CSS, rAF nur in Episoden) |
| Review-Marker | `ddd2327`, `240db85`, `8ffe494` | Panel-Marker in Title-Bar, größer, CamelCase, inactive-dim weg |
| Doku | `07f6e0b`, `9e95e38`, `0a7013d`, `40d7d77` | AUDIT_FINDINGS + AGENTS.md-Sync |

### Offen für die nächste Session

1. ~~**Phase 3 — Mess-Baseline** (H-07)~~ ✅ erledigt 2026-05-30. Harness `frontend/tests/perf-measure.spec.ts`, Ergebnisse + Verdikt in `PERF_NOTES.md`. **H-07 nicht bestätigt.** B-3-Heap per M-06b (Forced GC) entwarnt — kein Leak. Verbleibende Follow-ups: (a) Headed-GPU-Messung auf Apple-Silicon-Hardware für valide 60-FPS-Aussage; (b) Panel-Pool für saubere Frame-Time-Vergleiche fixieren.
2. **Phase 5 — Demoscene-Tiefenaudit**: Treffsicherheit, Tiefe, Variation der DEMO-01..04-Panels und der neuen demoscene-inspirierten Panels prüfen. Wegfall-Kandidaten markieren.
3. **AGENTS.md-Auslagerungs-Vorschlag** (siehe Sektion Q-A oben): mechanische Umsetzung erst nach Freigabe.
4. **Optional H-09** (DPI/`devicePixelRatio`-Handling): kontextabhängig, nur falls Schärfe-Feedback kommt.

### Test-Status

User hat zwischen Iter.-1- und Iter.-2-Fixes manuell getestet und Verbesserungen bestätigt (Fraktal-Cluster, ProTracker, GlitchOverlay, Aspect-Fix). Ein erneuter Komplett-Test der gesamten App nach H-05 (rAF-Migration aller verbliebenen 20 Panels) steht für die nächste Session aus.


