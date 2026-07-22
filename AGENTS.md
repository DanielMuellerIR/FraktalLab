# FraktalLab — Arbeitsregeln und Architektur

FraktalLab ist eine React-/TypeScript-Web-App: ein humorvolles Demoscene-Showcase im Stil eines
fiktiven „Neural Intrusion Dashboard“ mit GPU-Fraktalen, Canvas-/Shader-Panels, MOD-Player und
SID-Emulation. Es ist kein klassisches Produkt mit vollständiger Feature-Matrix. Maßstab ist ein
visuell starkes, lauffähiges Ergebnis ohne halbfertige Baustellen.

## Einstieg und Quellen

- `DEV_GUIDE.md`: Build, Tests und kurze Coding-Hinweise.
- `README.md`: öffentlicher Projekteinstieg.
- `ARCHIVE.md`: erledigte Pläne und historische Befunde.
- `PERF_NOTES.md`: Performance-Messung.
- `frontend/src/panels/panel-registry.ts`: aktuelle Panel-Klassifikation und GL-Budget.
- `frontend/src/App.tsx`: Layout, Pools, Rotation und Audio-Fokus.
- `frontend/src/components/FractalGL.tsx` und `frontend/src/utils/fractal-gl-shader.ts`:
  gemeinsame GPU-Fraktal-Implementierung.
- `frontend/src/utils/raf-coordinator.ts` und `webgl-pool.ts`: zentrale Laufzeitbudgets.
- Aktuelle Implementierung schlägt datierte Statusangaben in Dokumenten. Historie gehört nicht in
  diese Datei.

## Arbeitsweise

- Änderungen klein und vollständig halten. Ein Feature, Fix oder Refactor soll innerhalb einer
  Session lauffähig und prüfbar werden; andernfalls in sichere Teilschritte zerlegen.
- Keine neue Architektur oder Dependency ohne konkreten Nutzen. Bestehende React-, Tailwind- und
  Panel-Muster weiterverwenden.
- Identifier Englisch, Kommentare und Projektdokumentation Deutsch. Bestehende hilfreiche Kommentare
  bei Refactors erhalten und anpassen.
- Nur beauftragte Pfade ändern. Fremdes WIP, generierte Ergebnisse und Archive nicht nebenbei
  bereinigen.
- Git nach den Fleet-Regeln: nur konkrete Pfade stagen, nie `git add .`/`-A`; Implementierungs-Todo
  nach projekttypischer Verifikation zum kanonischen privaten Fleet-Remote sichern. GitHub nur auf ausdrücklichen Auftrag.
- Reine AGENTS-/Doku-Reorganisation benötigt keinen Produktversions-Bump.

## Verbindliches Panel-Regelwerk

### Geschwindigkeit

Jedes animierte Panel nutzt den zentral skalierten Takt des `raf-coordinator`. Kein eigener
ungebremster rAF-Loop, wenn ein vorhandenes Muster passt.

- Player-Panels (MOD/SID) bleiben immer bei 1×: Audio und Visuals dürfen durch die Dichte-Stufe
  weder beschleunigt noch verlangsamt werden.
- Textpanels: 25 MHz, Turbo und Overdrive 1×; Proxima 2×.
- GFX-Panels: 25 MHz 0,5×; Turbo/Overdrive 1×; Proxima standardmäßig 2×.
- Proxima-Ausnahmen bleiben erhalten: Mandelbulb 16×; DNA, Plasma, Tixy und IQ-Digital-Storm 8×;
  RetroOutrun, Lovebyte, Menger, Tunnel, Fire, alle Fractal-Szenen und Apollonian 4×.
- Vor Änderungen die aktuelle Tabelle/Funktion `effectiveSpeed` lesen. Code ist die Wahrheit, wenn
  diese Kurzliste später driftet.

### Layout, Rotation und Duplikate

- Initialer Layoutbau und Dichtewechsel erzeugen keine Duplikate.
- Auto-Rotation darf nie ein Panel wählen, das bereits in einem anderen Slot sichtbar ist.
  Gelockte Audio-Panels sind kein Wechselziel, solange sie schon laufen.
- Manueller Klick auf die Titel-Pille wählt ein kompatibles Zufallspanel; ein Duplikat ist nur
  zulässig, wenn kein freies kompatibles Panel existiert.
- Die Pille ist Desktop nur bei Hover und Mobile nach Tap kurz sichtbar. Keine Vor/Zurück-Pfeile
  als Ersatz einführen.
- Kompatibilität umfasst Aspect, Mindestgröße und GL-Kontingent.
- Neue Panels in `POOL_TEXT` oder `POOL_GFX` bzw. die aktuelle Registry eintragen; sonst erscheinen
  sie nie.

### WebGL-Budget

- `MAX_GL_PANELS_PER_LAYOUT` ist derzeit 11; `webgl-pool.ts` verwaltet 12 Kontexte mit einem
  Sicherheitspuffer. Werte nie getrennt ändern.
- Ist das Layoutbudget voll, Nicht-GL-Füller verwenden. Keine unkontrollierte Context-Erzeugung in
  einzelnen Panels.
- Alle Mandelbrot-/Julia-Varianten laufen über `FractalGL` und den gemeinsamen Shader. Kein neues
  Rust-/WASM-Fraktalmodul; das frühere WASM ist entfernt.
- GL-Ressourcen bei Unmount/Wechsel sauber freigeben und Änderungen mit mehreren gleichzeitigen
  Panels prüfen.

## Visuelle und technische Invarianten

### Pixel-Qualität

Default ist glatt und scharf. `imageRendering: pixelated` ist nur für authentische Retro-Panels
(C64, RetroError, bewusstes Enhance-Hochskalieren) oder einen noch nicht migrierten
Voxel-Sonderfall erlaubt.

- Fraktale, Shader, Vektor-, Wireframe- und 3D-Panels möglichst nahe an CSS-/Geräteauflösung
  rendern. Bei Performanceproblemen zuerst GPU-/Algorithmuspfad prüfen, nicht heimlich die
  Auflösung drastisch senken.
- Kategorie-B-Panels sollen auf großen 4K-/Ultrawide-Zellen nicht grobpixelig werden.
- Niedrigere interne Auflösung in glatten Panels bleibt bilinear; kein Pixel-Filter.
- Authentische Retro-Panels behalten ihren absichtlichen Look.
- Äußeres Gerüst und Textpanels bleiben schwarz-grün/monochrom. Grafikpanels dürfen farbig,
  kontrastreich und demoscene-typisch sein.
- Prozedurale oder kompakte Assets bevorzugen. Fremdwerke nur mit verifizierter Lizenz und
  sichtbarer Attribution integrieren; Autoren und Modifikationen dokumentieren.

### Audio und iOS/Safari

- `AudioContext` niemals beim Modulimport oder bloßen Mount erzeugen. Context, Nodes und `resume()`
  erst im direkten Benutzer-Gestenpfad initialisieren.
- `getSharedAudioContext()` in `utils/shared-audio.ts` bleibt die einzige Quelle. Es setzt für iOS
  `navigator.audioSession.type = 'playback'`, damit Audio trotz Silent Switch hörbar ist.
- Nur ein Audio-Fokus-Panel darf gleichzeitig hörbar sein. Auto-Rotation respektiert
  `isAudioPlaying()`.
- Player-Tempo bleibt 1×. Schnelle Dichte-/Layoutwechsel dürfen Track, UI und Audio nicht
  auseinanderlaufen lassen; Generation Guards erhalten.

### Rendering und TypeScript

- Canvas nach Nullprüfung in typisierte lokale Konstanten übernehmen; TypeScript-Narrowing trägt
  nicht zuverlässig in Closures.
- Unsichtbare Canvas-Panels pausieren über IntersectionObserver und den zentralen Coordinator.
- Tailwind v4 läuft über `@tailwindcss/vite` und `frontend/src/index.css`; kein
  `tailwind.config.js` erfinden.
- COOP/COEP bleiben in Vite und `frontend/public/.htaccess` auf dem aktuellen
  `credentialless`-Setup. Das erlaubt Cross-Origin-Medien; nicht aus alter WASM-Doku auf
  `require-corp` zurückstellen.
- Bestehende Kernpfade `FractalGL`, `utils/modplayer/`, `shared-audio.ts`, die
  `DemoScenes.makeScene`-Factory und `PanelSlot` nicht ohne belegten Fehler neu erfinden.

## Architektur in Kürze

`frontend/` ist die aktive App. `App.tsx` baut responsive Zufalls-Layouts, verwaltet Pools,
Dichte, Übergänge und Audio-Fokus. Unter 768 px läuft ein vereinfachtes Single-Column-Mobilelayout;
Desktop kann auf großen Displays viele Zellen erzeugen.

`panels/` enthält einzelne Panels, `ui/PanelSlot.tsx` den Slot-Wechsel, `components/FractalGL.tsx`
den gemeinsamen Fraktalrenderer. `utils/modplayer/` ist der eigene ProTracker-Player;
`public/audio/sid-player-worklet.js` enthält die adaptierte jsSID-/6502-Emulation. Ein separater
Node-/Express-Server wird nicht unterstützt; Deployment nutzt Apache und die `.htaccess` im Frontend.

Neue Panels sollen:
1. flexibel auf Containergröße reagieren,
2. das passende zentrale Zeit-/GL-/Audio-Budget verwenden,
3. registriert und in mehreren Layoutgrößen sichtbar getestet werden,
4. bei Fremdmaterial Lizenz/Attribution mitbringen,
5. auf Mobile und bei Layoutübergängen keine dauernden Hintergrundloops erzeugen.

## Build und Verifikation

Aus `frontend/`:

```bash
npm run build
npm run lint
```

Für visuelle Paneländerungen Dev-Server starten und danach:

```bash
npm run dev
npm run test:panels
```

Performanceänderungen gegen Production-Preview gemäß `PERF_NOTES.md` mit `npm run test:perf`
prüfen. Tests proportional wählen:

- reine Logik/Registry: Build, Lint und gezielter Test;
- Paneloptik: `test:panels` plus Screenshot-Diffs;
- Layout/Dichte/Rotation: mehrere Größen, Duplikat- und GL-Budget prüfen;
- Audio: direkte Benutzergeste, Trackwechsel und iOS/Safari-Pfad;
- Performance: mehrere Panels und Layoutübergang, nicht nur isoliertes Einzelpanel.

Unerwartete Screenshot-Diffs nicht pauschal überschreiben: zuerst Pixel-Kategorie, gewünschtes
Design und Regression klären.

## Aktive Grenzen

- `archive/` und insbesondere `archive/v0.9.4/AGENTS.md` sind historische Snapshots, keine
  aktuellen Anweisungen. Bei Arbeit dort nicht deren veraltete WASM-/Testaussagen auf die heutige
  App übertragen.
- Große Panelinventare, Versionschronik, erledigte Audits und langfristige Demoszene-Ideen gehören
  in Registry/Archive/Backlog, nicht zurück in diese Daueranweisung.
- Aktuelle offene Arbeit aus dem vereinbarten Backlog beziehen; alte Checkbox-Blöcke in historischen
  Dokumenten nicht wiederbeleben.

Die frühere Status- und Regelchronik liegt unverändert unter
[`docs/archive/agent-context-legacy-2026-07-14.md`](docs/archive/agent-context-legacy-2026-07-14.md)
und ist keine aktive Anweisung.

## Verzeichnisstruktur

- [`README.md`](README.md): Projektüberblick.
- [`DEV_GUIDE.md`](DEV_GUIDE.md): Build- und Entwicklungsablauf.
- [`ARCHIVE.md`](ARCHIVE.md): abgeschlossene Phasen.
- [`BACKLOG.md`](BACKLOG.md): verifizierte offene Arbeit.
- [`docs/INDEX.md`](docs/INDEX.md): weitere Dokumentation.
