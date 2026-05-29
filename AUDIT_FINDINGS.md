# AUDIT_FINDINGS.md — FraktalLab

> Audit-Branch: `audit/2026-05-29`. Phase 1 abgeschlossen. Stand: 2026-05-29.
> Quelle: Inspektion gegen `AGENTS.md` (v1.2.7) und `blueprint_audit.md`.
> Methode: Read-only, drei parallele Investigator-Agents + Spot-Checks.

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

