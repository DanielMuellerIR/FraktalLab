# blueprint_audit.md — Audit-Auftrag für FraktalLab

> **Zielgruppe:** Claude Code, gestartet im Wurzelverzeichnis des FraktalLab-Repos.
> **Vorausgesetzt:** `AGENTS.md` und Git-Historie sind vorhanden und vollständig.
> **Zeitlich:** Dieser Audit ist iterativ und kann sich über mehrere Sessions ziehen. Geduld ist Tugend. Kein Big-Bang-Refactor.

---

## Kontext (vom Auftraggeber)

Das Projekt FraktalLab ist ein humorvoller technischer Showcase aus React 19, Vite 8, TypeScript 6, Tailwind v4, Rust + wasm-pack. Es zeigt 4–32 animierte „Panels" gleichzeitig (je nach Bildschirmgröße) in einem zufälligen Grid-Layout. Vollständige Projekt-Dokumentation: **`AGENTS.md`** im Repo-Root. Diese ist als gelesen vorauszusetzen, bevor mit dem Audit begonnen wird.

**Beobachteter Zustand (Nutzer-Feedback):**
- Die App ruckelt — auch auf High-End-Hardware (Apple-Silicon-Hardware, 128 GB RAM). Wenn sie hier nicht butterweich läuft, hat ein M1 keine Chance.
- Besonders die Fraktal-Panels ruckeln.
- Auch im Review-Modus (4 Panels nebeneinander) bereits spürbar.
- Layout-Slide-Übergang ist *nicht* das Hauptproblem.
- Die Performance über die letzten Wochen war ein Auf und Ab: schrittweise Optimierungen wurden umgesetzt, aber ein konstanter, spürbarer Fortschritt blieb aus. Mal besser, mal schlechter. Verdacht: Quick-Wins wurden teils unsauber umgesetzt, oder es gibt einen großen Commit, in dem etwas Falsches passiert ist.
- Vor einigen Tagen lief die App bereits größtenteils flüssig — d. h. die Regression ist nicht fundamental, sondern liegt vermutlich in spezifischen Stellen.

**Was du selbst aus dem Repo herausfinden sollst (NICHT vom Auftraggeber vorgegeben):**
- Welche Quick-Wins / TODOs aus `AGENTS.md` tatsächlich abgehakt wurden
- Wie weit der WASM-Refactor (QW-01) durchgezogen wurde
- Welcher der Commits der „große Commit" war, der möglicherweise Regressions eingeführt hat
- Ob die `pixelated`-Default-Umstellung (QW-04) konsequent und korrekt erfolgte
- Welcher Code-Stand „PERF-10 (zentraler rAF-Coordinator)" hat — implementiert, halb-implementiert, nicht angefasst?

---

## Bewertungsmaßstäbe

### Performance-Ziel
**Butterweich auf Apple-Silicon-Hardware heißt: 60 FPS stabil bei allen Standard-Layouts.** Das schließt Layouts mit 24+ Panels auf großem Display ein, sofern keine Audio-Panels aktiv sind. Im Review-Modus (4 Panels) mit Fraktalen muss es eindeutig 60 FPS sein. Wenn ein einzelnes Panel das nicht erreichen kann, ist es entweder zu reparieren oder als Wegfall-Kandidat zu markieren (Entscheidung beim Auftraggeber).

### Pixel-Quality-Policy (aus AGENTS.md)
Die in `AGENTS.md` definierte Policy ist bindend. Kurzfassung mit Präzisierung des Auftraggebers:

- **Kategorie A** (`C64Panel`, `RetroErrorPanel`, `EnhanceView`): pixelig ist Stil, bleibt so.
- **Kategorie B** (Fraktale, Shader-Style, Vektor): grundsätzlich scharf und in nativer Auflösung.
- **Kategorie C** (Voxel): aktuell pixelig, perspektivisch GPU-Migration.

**Wichtige Präzisierung zur Pixel-Quality-Policy:** Wenn ein Panel intern mit absurd hoher Auflösung rendert (z. B. 640×480 für einen Effekt, der auch bei 400×300 visuell nicht unterscheidbar ist), darf die interne Auflösung *jederzeit* reduziert werden. Die Pixel-Quality-Policy verbietet nicht das Senken sinnlos hoher Auflösungen, sie verbietet nur das Senken, wenn dadurch die *sichtbare* Qualität leidet. Faustregel: erst prüfen, ob Qualität bei reduzierter Auflösung sichtbar leidet — dann entscheiden. Auflösung ist ein legitimer Hebel, nur kein Reflex.

### Was Vorrang hat
1. Erkennbare Bugs / falsch umgesetzte TODOs (höchste Priorität)
2. Performance-Hotspots, die nicht durch architektonische Notwendigkeit erklärbar sind
3. Code-Qualität / Dead Code / Antipatterns
4. Sinnvolle Erweiterung der Testinfrastruktur
5. Demoscene-Panel-Potenzial-Audit (nice to have, eigener Strang)

---

## Vorgehensweise — übergeordnet

Der Audit ist in **vier Phasen** organisiert. Phasen 1–2 sind read-only. Phase 3 darf messen. Phase 4 darf vorschlagen und nach Freigabe Quick-Wins implementieren.

**Regel zur Iteration:** Nicht alle Phasen am Stück durchziehen. Nach jeder Phase einen Zwischenstand mit dem Auftraggeber abstimmen — oder zumindest die Befunde dokumentieren und auf grünes Licht warten, bevor messintensive oder eingreifende Schritte folgen.

**Regel zu Branches und Commits:**
- Sofort einen neuen Branch anlegen: `audit/2026-05-29` (oder das tagesaktuelle Datum).
- Die ersten Commits dürfen NUR Analyse-Artefakte enthalten: Dokumente wie `AUDIT_FINDINGS.md`, `PERF_NOTES.md`, ggf. Test-/Mess-Skripte unter `scripts/audit/`. **Kein flächendeckender Code-Refactor in den ersten Commits.**
- Nach Freigabe durch den Auftraggeber: gezielte Fix-Commits, jeweils mit klarer Verbindung zu einem Befund (Commit-Body referenziert die Befund-ID aus `AUDIT_FINDINGS.md`).

**Regel zu Installationen:**
- **Zuerst Inventur:** prüfe, was im Projekt bereits an Tools, Test-Frameworks und Mess-Infrastruktur vorhanden ist (`package.json`, `devDependencies`, `tests/`, evtl. existierende Scripts in `scripts/`).
- **Erst danach minimal ergänzen.** Keine doppelten Installationen. Wenn z. B. `@playwright/test` schon da ist, keinen separaten Headless-Browser zusätzlich installieren — Playwright kann Performance-Tracing.
- Globale Installationen vermeiden. Alles in `devDependencies` oder als `npx`-Befehl.

**Regel zu Code-Änderungen:**
- Vorschlagen und dokumentieren, nicht ausführen — außer der Auftraggeber gibt explizit „mach den Quick-Win" frei.
- Bei kleinen Quick-Wins (1-Zeilen-Fixes, offensichtliche Bugs): in `AUDIT_FINDINGS.md` markieren als „Quick-Win-Kandidat, warte auf Freigabe".
- Bei größeren Eingriffen: erst Diskussion, dann separate Branch-Strategie.

**Regel zur Auflösungs-Reduktion:**
- Wenn als Performance-Fix eine niedrigere interne Auflösung vorgeschlagen wird, muss der Vorschlag enthalten: (a) was die aktuelle interne Auflösung ist, (b) was die vorgeschlagene wäre, (c) eine Einschätzung, ob die sichtbare Qualität dadurch leidet, idealerweise mit Side-by-Side-Screenshot.

---

## Phase 1 — Inventur und Soll-Ist-Abgleich

**Ziel:** vollständiges Verständnis davon, was im Code wirklich passiert ist im Vergleich zu dem, was `AGENTS.md` behauptet. Reine Lese-Arbeit.

### 1.1 Repository-Orientierung

- `AGENTS.md` vollständig lesen. Besonderes Augenmerk auf die Sektionen „Action Plan — Quick-Wins" und „Code-Audit-Befunde (2026-05-28)".
- `DEV_GUIDE.md` lesen (Build-Befehle, Setup).
- `git log --oneline -50` ausführen. Identifiziere:
  - Den großen Commit, der mehrere Quick-Wins gleichzeitig umsetzt (Heuristik: viele geänderte Dateien, Commit-Message verweist auf QW-* oder „pixel quality" oder ähnlich).
  - Die Reihenfolge der Quick-Win-Implementierungen.
  - Commits zwischen den Quick-Wins, die ggf. Regressions eingeführt haben.
- `git diff <commit-vor-QW>..HEAD -- frontend/src wasm/src` für einen Überblick, was sich seit Audit-Beginn geändert hat. Falls der „Vor-QW"-Commit nicht eindeutig ist: einen plausiblen Bezugspunkt vor den ersten Quick-Win-Versuchen wählen und das im Audit-Dokument benennen.

### 1.2 Soll-Ist-Abgleich pro Quick-Win

Für **QW-01 bis QW-09** aus `AGENTS.md` jeweils prüfen:

- **Behauptung in AGENTS.md:** ist der Punkt als erledigt markiert? (Suchen nach `[x]` oder „Status: erledigt" oder Streichung im Quick-Win-Block — bei Bedarf in der Commit-History sicher gehen.)
- **Ist-Zustand im Code:** prüfe das in der Quick-Win-Definition spezifizierte Verhalten. Beispiele:
  - QW-01: hat `render()` in `wasm/src/lib.rs` jetzt die Signatur `fn render(buf: &mut [u8], width: u32, height: u32, params: &RenderParams)`? Oder noch die alte mit `-> Vec<u8>`?
  - QW-01 / Aufrufer-Migration: wurde `FractalScenes.tsx` mit-refactored? Wie viele Aufrufer von `render()` gibt es? Welche nutzen das neue Pattern, welche das alte? (`grep -rn "render(" frontend/src --include="*.tsx" --include="*.ts"`)
  - QW-02: hat `FractalCanvas.tsx` jetzt einen IntersectionObserver? Werden Buffer/ImageData wiederverwendet? Wird `findBoundaryNonBlack` gedrosselt?
  - QW-03: ist `ThreeBodyScene` jetzt auf 400×300 (oder andere reduzierte Auflösung) statt 640×480?
  - QW-04: hat `makeScene` jetzt `pixelated: false` als Default? Sind alle Aufrufer in `DemoScenes.tsx` konsistent?
  - QW-05: ist `imageRendering: pixelated` aus `FractalCanvas.tsx` und `FractalJulia.tsx` entfernt? Wurde Julia-Auflösung dynamisch gemacht?
  - QW-06: PlasmaDemo auf `auto`-Filter? Interne Auflösung erhöht? VoxelScenes bewusst noch `pixelated`?
  - QW-07: `contain: paint` auf dem prevLayout-Container?

**Ergebnis dieser Sub-Phase:** eine Tabelle in `AUDIT_FINDINGS.md`:

```
| QW-ID | AGENTS.md-Status | Ist-Zustand im Code | Diskrepanz | Schweregrad |
|-------|------------------|---------------------|------------|-------------|
| QW-01 | erledigt         | nur teilweise — FractalScenes nicht migriert | JA — kritisch | hoch |
| QW-02 | erledigt         | IO vorhanden, Buffer-Sharing korrekt, aber findBoundary nicht gedrosselt | partial | mittel |
| ...   |                  |                     |            |             |
```

### 1.3 Soll-Ist-Abgleich für PERF-*, GL-*, DEMO-*

Selbiges Vorgehen, aber mit der Erwartung, dass viele dieser Punkte noch nicht angegangen wurden. Falls doch (z. B. PERF-10 wurde implementiert): dokumentieren und prüfen.

Besonderes Augenmerk:
- **PERF-10 (zentraler rAF-Coordinator):** existiert eine `utils/raf-coordinator.ts` oder ähnlich? Wenn ja: ist sie konsistent in allen Panels eingesetzt, oder gibt es Inkonsistenz zwischen Panels mit altem `requestAnimationFrame` und neuen `subscribe()`?
- **PERF-11 (React.memo):** sind die Panel-Komponenten gemeinsam mit `React.memo` umhüllt? Wenn ja, alle oder selektiv?
- **GL-01 (ShaderPanel):** existiert eine `ui/ShaderPanel.tsx`? Wenn ja: welche Panels nutzen sie?
- **DEMO-01 bis DEMO-04:** gibt es `panels/ShadertoyPanel.tsx`, `TixyPanel.tsx`, `IQTechniquePanel.tsx`, `LovebyteShowcasePanel.tsx`?

### 1.4 Identifikation neuer Panels seit dem letzten Audit

Liste aller Dateien in `frontend/src/panels/` und Abgleich gegen das in `AGENTS.md` dokumentierte Inventar. Welche Panels sind hinzugekommen? Welche entfernt? Welche umbenannt?

### 1.5 Statische Antipattern-Suche

Unabhängig von TODO-Status — auf Patterns scannen, die in der Code-Audit-Sektion von `AGENTS.md` als verifizierte Antipatterns dokumentiert sind oder allgemein als problematisch gelten:

- `new ImageData(` in `useEffect`-Bodies (sollte einmalig vor dem rAF-Loop sein, nicht pro Frame)
- `new Uint8Array(` oder `new Uint8ClampedArray(` innerhalb von rAF-Callbacks
- `ctx.getImageData(` — GPU-Readback, fast nie nötig in Animationen
- `canvas.toDataURL(` — sehr teuer, in Animationen verboten
- Funktionen, die im Render-Path JSON.stringify, JSON.parse, oder document.querySelector aufrufen
- `useEffect` mit fehlendem oder verdächtigem Dependency-Array (z. B. `[]` obwohl externe Werte verwendet werden — Stale-Closure-Gefahr)
- React-State-Updates aus rAF-Loops heraus (Zeichen für falsche Trennung von Animation und State)
- Mehrere `IntersectionObserver` pro Panel (sollte einer reichen)
- `setTimeout`/`setInterval`-Schleifen, die parallel zu rAF laufen
- ResizeObserver-Callbacks, die teure Buffer-Re-Allokationen triggern ohne Debouncing
- Importe aus `react` von Top-Level-Komponenten, die jeden Re-Render mounten würden

**Pro Treffer:** Datei, Zeile, Kurzbewertung in `AUDIT_FINDINGS.md` mit eindeutiger ID (`F-001`, `F-002`, ...).

### 1.6 Architektur-Sanity-Checks

- Wird das WASM-Modul wirklich nur einmal geladen? Prüfe `wasm-loader.ts` und alle Importe von dort.
- Gibt es Stellen, wo das WASM-Modul redundant initialisiert wird?
- Wird der `AudioContext` wirklich nur einmal erzeugt? Prüfe `shared-audio.ts` und alle Importe.
- Werden Canvas-Kontexte (2D oder WebGL) jemals doppelt für denselben Canvas angefordert? (Sollte nie passieren, aber `getContext('2d')` zweimal aufzurufen ist häufiger Bug.)
- Werden ResizeObserver, IntersectionObserver, EventListener in den Cleanup-Funktionen von `useEffect` korrekt entsorgt?
- Gibt es Listener auf `window`, die nicht aufgeräumt werden? (`window.addEventListener` ohne `removeEventListener` in cleanup)

### Phase-1-Output

Eine Datei `AUDIT_FINDINGS.md` im Repo-Root mit:
- QW-Status-Tabelle (1.2)
- PERF/GL/DEMO-Status (1.3)
- Neue/entfernte Panels (1.4)
- Statische Antipatterns mit IDs (1.5)
- Architektur-Sanity-Befunde (1.6)
- **Pro Eintrag:** Schweregrad (hoch / mittel / niedrig) und Quick-Win-Tauglichkeit (ja / nein / unsicher)
- Eine kurze Zusammenfassung am Anfang: „Top 5 Befunde mit höchster vermuteter Performance-Wirkung"

**Stopp-Punkt:** Nach Phase 1 dem Auftraggeber den Stand zeigen, bevor Phase 2 startet. Quick-Win-Kandidaten kann der Auftraggeber freigeben, dann werden sie *vor* Phase 2 umgesetzt — das verändert die Mess-Baseline und ist gewünscht.

---

## Phase 2 — Hypothesenbildung für Performance-Probleme

**Ziel:** aus den Befunden von Phase 1 plus eigener tieferer Code-Lesung eine priorisierte Liste von Hypothesen zum Ruckeln formulieren. Noch keine Messungen.

### 2.1 Tiefenanalyse Fraktal-Panels

Da der Auftraggeber explizit „Fraktale sind besonders ruckelig" sagt: alle Fraktal-relevanten Dateien (`FractalCanvas.tsx`, `FractalJulia.tsx`, `FractalScenes.tsx`, `FractalView.tsx`, `wasm/src/lib.rs`) **vollständig** lesen, nicht überfliegen. Sucher nach:

- Pro-Frame-Allokationen (Vec, Uint8Array, ImageData, neuer Math-Objekte)
- Wiederholte WASM-Boundary-Crossings für dieselben Daten
- Zoom/Drift/Tumble-Berechnungen, die pro Frame teuer sind (z. B. `Math.pow`, `Math.exp` in tight loops)
- `findBoundaryNonBlack` oder `isLowDetail` — wie oft pro Sekunde, wie teuer?
- WASM-Build-Output-Größe (`wasm/pkg/*.wasm`) — falls deutlich gewachsen seit dem letzten dokumentierten Stand, das auch dokumentieren
- Korrektheit des `RenderParams`-Konstruktors: in JS pro Frame ein neues `new RenderParams(...)`-Objekt zu erzeugen kann teuer sein (wasm-bindgen-Brücke). Prüfen ob Pooling möglich/sinnvoll wäre.

**Tip:** Bei Inkonsistenz zwischen Mandelbrot- und Julia-Pfad — wenn QW-01 nur halb durchgeführt wurde — kann es sein, dass Mandelbrot ein `Vec<u8>` zurückgibt, das pro Frame durch die WASM-JS-Boundary kopiert wird. Das ist *exakt* das Antipattern, das QW-01 beseitigen sollte. Wenn es noch existiert, ist es vermutlich der Haupthotspot.

### 2.2 Tiefenanalyse Layout-/Mount-Verhalten

- Was passiert konkret, wenn der Layout-Generator ein neues Layout produziert? Werden Panel-Komponenten neu gemountet (= `useEffect` läuft erneut, IntersectionObserver wird neu angelegt, WASM wird neu „bedient"), oder bleiben sie gemountet und werden nur umgehängt?
- Hat `PanelSlot.tsx` einen stabilen `key` über Layout-Wechsel hinweg, oder wird bei jedem Layout ein neuer Key gesetzt? Letzteres würde komplettes Remount erzwingen — extrem teuer.
- Wird im Review-Modus (`reviewMode === true`) das Panel-Inventar neu durchlaufen? Wie häufig?
- Gibt es Effekte, die bei jedem `setLayout(...)` neue Subscriptions erzeugen, ohne alte zu entsorgen?

### 2.3 Tiefenanalyse rAF-Loops

- Falls PERF-10 *nicht* umgesetzt: wie viele unabhängige rAF-Loops laufen typischerweise simultan (sichtbare Panels)? Browser-Bündelung der Callbacks ist gut, aber bei 24+ Loops sind die V8-Microtask-Overheads sichtbar.
- Falls PERF-10 *umgesetzt*: ist der Coordinator korrekt? Verliert er Callbacks? Wird er bei jedem React-Render neu initialisiert (= alle Subscriptions verloren)?
- Werden in den rAF-Callbacks State-Updates ausgelöst (`setState` etc.), die React-Rerenders triggern? Pro Frame? Pro Sekunde?

### 2.4 Tiefenanalyse Canvas-2D-Operationen

Für die teuersten Panels (`VoxelDemo`, `VoxelScenes`, `ThreeBodyScene`, `PlasmaDemo`, `FractalCanvas`):

- Wird `putImageData` pro Frame aufgerufen — bei welcher Auflösung?
- Werden `ctx.save()`/`ctx.restore()` exzessiv (in tight loops) genutzt?
- Werden `ctx.fillRect` mit `globalAlpha` und `globalCompositeOperation` häufig umgeschaltet? (Teuer wegen GPU-State-Wechsel.)
- Phosphor-Bloom (in VoxelScenes via 4× drawImage mit `globalAlpha` und `globalCompositeOperation = 'lighter'`) — wie teuer ist das messbar? Kann es durch ein einzelnes shadow-Filter ersetzt werden?
- Scanlines werden zeilenweise mit `fillRect(0, sy, cW, 1)` gemalt — bei Panel-Höhe 600 sind das 200 Calls pro Frame. Alternative: einmaliges großes Pattern-Fill oder CSS-Overlay.

### 2.5 Tiefenanalyse React-Verhalten

- Welche Komponenten haben `React.memo`? Welche nicht?
- Welche Callbacks werden in `App.tsx` ohne `useCallback` an Kinder gereicht? Jeder davon erzwingt Re-Renders.
- Wird `generateMobileIndices()` bei jedem Render neu aufgerufen (mit `Math.random()`)?
- Gibt es State, der pro Frame durch ein Setter aktualisiert wird?

### 2.6 Mobile- und Browser-spezifische Verdächtigungen

Auch wenn das primäre Problem auf Desktop sichtbar ist, kann der Code Antipatterns enthalten, die auf älteren Geräten besonders schmerzen:

- DPI-/`devicePixelRatio`-Handling: rendert die App auf Retina-Displays mit 2×/3× der CSS-Pixel-Auflösung? Das sollte für Kategorie B Panels bewusst gemacht sein, nicht aus Versehen.
- `passive: true` bei Event-Listenern, wo möglich (Scroll- und Touch-Events).

### Phase-2-Output

In `AUDIT_FINDINGS.md` einen neuen Abschnitt **„Hypothesen zum Ruckeln"** anhängen:

- 5–10 priorisierte Hypothesen (höchste Wirkungs-Wahrscheinlichkeit oben)
- Pro Hypothese: Welcher Code ist betroffen, was wäre die Verifizierungs-Messung, was wäre der Fix.
- Markierung welche Hypothesen sich überschneiden (z. B. „wenn QW-01 nicht durchgezogen wurde, ist das wahrscheinlich H-01 UND H-03 erklärt").

**Stopp-Punkt:** Nach Phase 2 mit dem Auftraggeber abstimmen, welche Hypothesen er gemessen sehen will. Nicht alle pauschal messen — das ist Zeitverschwendung. Pareto: die 2-3 Hypothesen mit der höchsten erwarteten Wirkung zuerst.

---

## Phase 3 — Messungen

**Ziel:** Hypothesen verifizieren. Keine spekulativen Refactors.

### 3.1 Inventur der vorhandenen Test-/Mess-Infrastruktur

**Zuerst** prüfen, was schon da ist:
- `package.json` `scripts` und `devDependencies` lesen
- `tests/`-Verzeichnis vollständig durchsehen
- Den (laut Auftraggeber neu eingebauten) Screenshot-Analyse-Test finden und verstehen, was er macht
- Existierende Performance-Scripts/Helper unter `scripts/`, falls vorhanden

Liste in `AUDIT_FINDINGS.md` festhalten unter „Vorhandene Mess-Infrastruktur".

### 3.2 Inspektion des Screenshot-Tests

**Der Auftraggeber hat explizit darum gebeten:** den neu eingebauten Test soll geprüft werden auf:
- Funktioniert er fehlerfrei?
- Ist die Logik sinnvoll?
- Welche Probleme erkennt er, welche nicht?

Anschließend Vorschläge erarbeiten:
- **Multiple Screenshots pro Panel über die Zeit:** für animierte Panels einen Screenshot allein sagt nichts. Drei Screenshots im Abstand von z. B. 0.5s zeigen, ob sich überhaupt etwas tut. Mehrere Screenshots im Abstand von einigen Sekunden zeigen, ob das Panel langfristig „lebt".
- **Bewegungs-Erkennung:** Pixelweise Diff zwischen aufeinanderfolgenden Screenshots. Wenn ein animiertes Panel zwei identische Frames hat → Fehler. Standard-deviation der Pixel-Werte als Heuristik.
- **Schwarzraum-Erkennung:** Anteil reinschwarzer Pixel. Bei Fraktal-Panels: hoher Schwarzanteil = vermutlich Bug („Zoom geht in den schwarzen Bereich").
- **Gefrierschutz:** wenn ein Panel ab Sekunde X identisch bleibt = Bug (Loop hängt, IntersectionObserver false-positive, etc.).
- **Farbsättigungs- und Helligkeits-Bandbreite:** das war in einer früheren Iteration schon mal andiskutiert (stddev > 5 etc.). Prüfen, ob das aktuell ausreichend ist.

Vorschläge dokumentieren in `AUDIT_FINDINGS.md` unter „Test-Suite-Verbesserungsvorschläge" und Implementations-Skizzen anfügen. **Erst nach Freigabe implementieren.**

### 3.3 Performance-Mess-Setup

**Reihenfolge der Entscheidungen:**

1. **Production-Build benutzen, nicht Dev-Server.** `npm run build` und `npm run preview` (oder via `vite preview`). React Dev-Build hat erhebliche Mess-Verzerrungen.

2. **Inventur Mess-Tools:**
   - Ist `@playwright/test` installiert? (Ja — laut AGENTS.md). Dann das nutzen, ggf. mit Performance-Tracing-API.
   - Ist Chrome via Playwright steuerbar? Ja, Standard.
   - Gibt es schon `lighthouse`, `puppeteer`, `chrome-devtools-protocol` Packages? Wenn ja, wiederverwenden. Wenn nicht, prüfen ob Playwright reicht.

3. **Was minimal hinzufügen, wenn nötig:**
   - Playwright unterstützt nativ Performance-Tracing über CDP (`page.context().newCDPSession`). Damit ist `Performance.metrics()` und Frame-Timing direkt zugreifbar — ohne zusätzliche Tools.
   - Falls für aggregierte Auswertung gewünscht: ein kleines `tinybench`-Setup für Mikrobenchmarks (Pro-Frame-Cost einzelner Render-Funktionen) ist legitim. Aber nicht aus Reflex — nur wenn nötig.

4. **Was NICHT machen:**
   - Keine Lighthouse-Audits — die messen das falsche Ding (Initial-Load, nicht Animations-Performance).
   - Keine globalen Installationen.
   - Keine Browser-Extensions.

### 3.4 Konkrete Messszenarien

Folgende Szenarien sollten messbar sein (in Reihenfolge der Priorität):

**M-01: Fraktal-Hero-Panel im Review-Modus (4-Panel-Layout, FractalView dabei)**
- Production-Build, leerer Cache
- Viewport: 1920×1080 (= ein realistisches Desktop)
- Playwright-Trace über 10 Sekunden
- Ergebnis: durchschnittliche und 95-Perzentil-Frame-Time, Anzahl Frames > 16.6 ms, GC-Events, Long-Tasks
- Vergleichswert: was wäre „butterweich"? → 95 % der Frames unter 16.6 ms, keine Long-Tasks > 50 ms.

**M-02: Fraktal-Hero-Panel allein auf großem Layout (3×3 oder 4×3 mit Fraktal-Hero und 8-11 anderen GFX-Panels)**
- Selbes Setup, anderes Layout
- Hier zeigt sich, ob das Problem das Hero-Panel allein ist oder die Summe

**M-03: Plasma-Dichte-Test (3+ GFX-Panels davon mindestens 2 schwer)**
- Layout-Generator gezielt steuern oder Komponenten direkt rendern
- Frame-Time-Distribution

**M-04: Layout-Slide-Übergang (laut Auftraggeber nicht primär — also später)**

**M-05: Mikro-Benchmarks einzelner Render-Funktionen**
- z. B. `wasm.render(buf, 800, 600, params)` in einem Loop ohne Canvas-Output messen
- Hilft, WASM-Zeit von Canvas-Zeit zu trennen

**M-06: Memory-Profil**
- Heap-Snapshot vor und nach 30 Sekunden Betrieb
- Wachsender Heap = Leak. Selbst kleine Allokationen pro Frame summieren sich.

### 3.5 Vergleichsmessung gegen Baseline

Wenn aus der Git-Historie ein Commit identifizierbar ist, vor dem die App „größtenteils flüssig" lief (Auftraggeber sagt: „vor einigen Tagen"), dann **gleiche Messungen** auf einem Checkout dieses Commits durchführen. Das liefert direkte „vorher/nachher"-Aussage.

Vorgehensweise:
- Worktree für den alten Commit nutzen: `git worktree add ../p_fraktal_baseline <commit-hash>`
- Dort `npm install`, `wasm-pack build`, `npm run build`, `npm run preview`
- Identische Mess-Szenarien fahren
- Tabelle in `PERF_NOTES.md`: Commit → M-01-FrameTime-Median → M-01-FrameTime-p95 → ...

**Erwartetes Ergebnis:** wenn ein bestimmter Commit als „Regression-Einfall" identifiziert wird, lässt sich der Schuldige präzise eingrenzen. Bei der Suche helfen, ist ein eigener Wert für die Audit-Dokumentation.

### 3.6 Output

`PERF_NOTES.md` im Repo-Root mit:
- Mess-Setup-Beschreibung (reproduzierbar)
- Ergebnistabellen pro Szenario
- Pro Hypothese aus Phase 2: bestätigt / widerlegt / unklar
- Top-3-Hotspots mit konkretem Maßnahmenvorschlag

**Stopp-Punkt:** Auftraggeber sieht die Ergebnisse, entscheidet welche Fixes implementiert werden sollen.

---

## Phase 4 — Vorschläge, iterative Umsetzung

**Ziel:** Befunde in konkrete Fixes überführen. Iterativ, mit Verifizierung.

### 4.1 Vorschlags-Format

Pro vorgeschlagenem Fix in `AUDIT_FINDINGS.md` (oder einer eigenen `FIXES.md`):

```
### FIX-001: [Kurztitel]
Bezug: AUDIT-Befund F-007, Hypothese H-02, Messung M-01
Schweregrad: hoch
Aufwand: 15 Minuten
Erwartete Wirkung: -3 ms pro Frame im Fraktal-Hero-Panel
Pixel-Quality-Impact: keiner (gleiche Auflösung, gleicher Filter)

Beschreibung:
[was geändert wird, mit Code-Snippet vorher/nachher]

Verifizierung:
[wie wir prüfen, dass es wirkt — meist: M-01 nochmal messen]
```

### 4.2 Reihenfolge der Fixes

1. **Bugfixes zuerst** (falsche Implementierung von Quick-Wins, kaputte Cleanup, Stale-Closures).
2. **Quick-Wins zweite** (1-Zeilen-Fixes mit messbarer Wirkung — z. B. fehlender IntersectionObserver).
3. **Strukturelle Refactors zuletzt** (PERF-10-Coordinator, GL-Migration).

### 4.3 Implementierungsregeln

- Pro Fix ein Commit, mit Verweis auf die Befund-ID.
- Nach jedem Fix die relevante Mess-Szene wiederholen.
- Wenn ein Fix die Performance NICHT verbessert → rückgängig machen und Hypothese überdenken.
- Wenn ein Fix visuelle Regressionen einführt → Pixel-Quality-Policy konsultieren, ggf. Auflösungs-Vorschlag nach den oben definierten Regeln.

### 4.4 Auflösungs-Reduktion als legitimes Werkzeug

Wenn eine Hypothese ist „Panel X rendert intern mit absurd hoher Auflösung":
- Aktuelle interne Auflösung dokumentieren.
- Vorschlag mit niedrigerer Auflösung (Faktor 1.5–2.5).
- Screenshot-Vergleich Side-by-Side: alte vs. neue interne Auflösung.
- Bewertung: sichtbarer Qualitätsverlust? Wenn nein → empfehlen, ohne mit der Pixel-Quality-Policy zu argumentieren (denn die Policy verbietet das nicht). Wenn ja → nicht empfehlen, anderen Weg suchen.

### 4.5 Iteration

Nach jeder Fix-Welle:
- Gesamt-Mess-Suite (M-01 bis M-06) erneut fahren
- Vergleich mit der vorherigen Messung
- Wenn das Ziel „60 FPS stabil im Review-Modus" erreicht ist → Phase 5 (Demoscene-Panel-Audit).
- Wenn nicht → nächste Hypothese, nächste Fix-Welle.

---

## Phase 5 — Demoscene-Panel-Potenzial-Audit

**Ziel:** überprüfen, ob bei der Umsetzung der demoscene-inspirierten Panels (über die letzten Sessions) Potenzial verschenkt oder Ideen ignoriert wurden. Dieser Audit-Strang ist eigenständig und kann unabhängig von der Performance-Suche laufen, aber idealerweise erst, wenn die Performance-Basis solide ist.

### 5.1 Datenbasis

- Git-Log auf Commits durchsuchen, die neue Panels einführen (Heuristik: `git log --diff-filter=A --name-only` für Dateien unter `frontend/src/panels/`).
- Commit-Messages und Diffs der entsprechenden Sessions lesen.
- `AGENTS.md`-Sektionen DEMO-01 bis DEMO-04 (kurz-/mittelfristige Demoscene-Integration) lesen.
- `AGENTS.md`-Sektion LR-* (langfristig) als Referenz für mögliche Inspirationsquellen.

### 5.2 Bewertungsdimensionen

Für jedes neu eingeführte (bzw. überarbeitete) Panel mit demoscene-Inspiration prüfen:

- **Treffsicherheit:** wurde der demoscene-Aspekt erkannt und überzeugend umgesetzt, oder bleibt das Panel ein generischer „neon-grüner Effekt"?
- **Tiefe:** wurde nur die Oberfläche kopiert oder echte Technik (z. B. echte SDF + Raymarching, echtes FBM, echte Plasma-Wellenüberlagerung) implementiert?
- **Variation:** gibt es Modi/Szenen/Variationen, oder ist das Panel statisch in einer Erscheinung?
- **Reaktionsfähigkeit:** verändert sich das Panel über die Zeit interessant, oder loopt es trivial?
- **Code-Eleganz:** ist die Implementierung lesbar und kompakt (demoscene-Stil), oder umständlich verschachtelt?

### 5.3 Verschenktes Potenzial

In `AUDIT_FINDINGS.md` einen Abschnitt **„Demoscene-Audit"** mit:

- Pro Panel eine kurze Einschätzung
- Eine Liste von **konkret übersehenen Ideen** aus den Vorschlägen in `AGENTS.md` Action Plan DEMO-*:
  - DEMO-01 (ShadertoyPanel) — wurde überhaupt ein Shader-Panel implementiert, das echte GLSL-Shader rendert?
  - DEMO-02 (TixyPanel) — existiert?
  - DEMO-03 (IQTechniquePanel) — existiert?
  - DEMO-04 (LovebyteShowcasePanel) — existiert?
- Eine Liste von **eigenen zusätzlichen Vorschlägen** für demoscene-Panels, die in `AGENTS.md` noch nicht stehen, aber zu FraktalLab passen würden.

Diese Sektion ist explizit kein Implementierungs-Auftrag — sondern Diskussions-Material. Implementierung erst nach Freigabe.

---

## Querschnitts-Themen

### Q-A: Dokumentations-Pflege

Während des Audits können Lücken in `AGENTS.md` auffallen — Dinge, die im Code stehen, aber nicht dokumentiert sind, oder Behauptungen, die nicht zutreffen. Solche Funde in `AUDIT_FINDINGS.md` unter „Doku-Drift" sammeln und am Ende einen `AGENTS.md`-Update-Vorschlag formulieren. **Nicht** im Audit-Branch die `AGENTS.md` direkt überschreiben — das passiert in einem separaten, fokussierten Commit nach Freigabe.

### Q-B: Was außerhalb des Scopes ist

- **Keine Großarchitektur-Vorschläge ohne Bezug zum Performance-Problem.** Niemand braucht jetzt ein „Refactor zu Next.js"-Vorschlag.
- **Keine Demoscene-Inhalte-Integration in dieser Audit-Phase.** Vorschläge in Phase 5, Umsetzung später separat.
- **Keine Mobile-Optimierung in dieser Phase**, außer es fällt nebenher auf.
- **Kein Production-Deployment-Audit** (Apache, Netcup-spezifisches).

### Q-C: Wann fragen, wann selbst entscheiden

Der Auftraggeber hat klargestellt: lieber fragen als blind weitermachen. Aber er hat auch klargestellt: nicht für jede Kleinigkeit fragen.

**Selbst entscheiden:**
- Welcher Branch-Name, welche Commit-Messages, welche Dateinamen für Audit-Dokumente
- Welche Reihenfolge der Phase-1-Checks (alle müssen durch, Reihenfolge egal)
- Wie tief in welchen Code-Pfad gegraben wird, solange dokumentiert
- Welche Hypothese zuerst gemessen wird (mit Begründung)

**Vorher fragen:**
- Wenn ein Quick-Win mehr als ~20 Zeilen Code-Änderung wäre
- Wenn die Pixel-Quality-Policy-Auslegung unklar ist
- Wenn ein Befund auf eine größere strukturelle Frage hindeutet (z. B. „PERF-10 ist umgesetzt, aber inkonsistent — sollen wir das komplett umstellen oder zurückrollen?")
- Wenn ein Panel ein Wegfall-Kandidat wird (Performance unrettbar)
- Wenn der Test-Suite-Vorschlag in 5+ neue Dateien mündet

**Nachträglich melden:**
- Jeden erstellten Commit
- Jeden zwischendurch erfolgten Quick-Win-Fix (falls vom Auftraggeber explizit freigegeben)

---

## Erwartete Endprodukte

Nach Abschluss des Audits (über mehrere Sessions hinweg) sollten folgende Artefakte im Branch `audit/2026-05-29` existieren:

1. **`AUDIT_FINDINGS.md`** — strukturierte Liste aller Befunde mit IDs, Schweregraden, Kontext.
2. **`PERF_NOTES.md`** — Mess-Setup, Ergebnistabellen, Hypothesen-Verifikationsstatus.
3. **`scripts/audit/`** (falls erstellt) — wiederholbare Mess-Skripte.
4. **Erweiterte Tests** unter `tests/` (falls vom Auftraggeber freigegeben) für bessere visuelle Qualitäts-Kontrolle.
5. **Fix-Commits** (einzeln) mit klarem Bezug zu den Befund-IDs.
6. **Optional:** ein `AGENTS.md`-Update-Vorschlag in einem separaten Commit.

**Nicht erwartet:**
- Eine fertige App nach einer Session. Iteration ist eingeplant.
- Eine erschöpfende Migration auf WebGL. Das ist Phase n+1.

---

## Erste Schritte für die neue Session

Wörtlich auszuführen beim Start der neuen Claude-Code-Session im Projekt-Root:

1. `git status` und `git log --oneline -50` für Orientierung.
2. `cat AGENTS.md | head -200` für eine schnelle Auffrischung des Projekt-Charakters.
3. Neuen Branch anlegen: `git checkout -b audit/YYYY-MM-DD` (heutiges Datum).
4. Eine leere `AUDIT_FINDINGS.md` im Root anlegen.
5. Die in dieser Datei beschriebene **Phase 1** durcharbeiten.
6. Erst dann mit dem Auftraggeber abstimmen.

Frohes Graben. Die Performance-Wahrheit liegt im Code, nicht in den Annahmen.
