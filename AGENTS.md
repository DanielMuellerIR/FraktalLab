# FraktalLab — Projektdokumentation

Universelle Referenz für alle Coding-Agents und KI-Modelle.
Agent-spezifische Einstellungen und Build-Befehle stehen in `DEV_GUIDE.md`.

> **Status (Stand 2026-05-31): Panel-Rework abgeschlossen + SID-Player-Session abgeschlossen (App-Version **v1.9.0**). Branch `feat/panel-rework-2026-05-30` wird nach `main` gemergt.** Panel-Rework (RW-01..29) komplett durch, 32 Panels überarbeitet, alle Grafik-Panels auf farbige Paletten migriert, 120 FPS auf Apple GPU nachgewiesen.
>
> **SID-Player-Session (2026-05-31) — `OscilloscopePanel`:** Der C64-SID-Player war stumm (kein Ton, keine Visualizer-Animation). Ursachen gefunden + behoben:
> - 6502-CPU-Emulation: implied-Opcode-Switch nutzte `IR & 0xC0` statt `IR & 0xF0` → INX/TAY/PHP/PLP kaputt → Song-Position fror ein (Drone/Stille).
> - `SidPlayerProcessor extends AudioWorkletProcessor` + manuelles `new` → Browser wirft im Konstruktor → Prozessor tot → totale Stille. Engine ist jetzt Plain-Class.
> - Noise-Waveform-Term + ENV3-Readback an jsSID-Referenz angeglichen.
> - Neue Features: Drag&drop (Datei + Ordner, rekursiv), Ordner-Button (`webkitdirectory`), Position-Scrubber (frame-stepping Seek, ~28 ms statt ~1 s), Null-Linie bei Pause, echte Waveform-Darstellung pro Stimme (TRI/SAW/PUL/NOI).
> - Lizenz jsSID = WTFPL (Attribution im Worklet-Header + unten dokumentiert). Emulation ist treu zu jsSID; verbleibende Mini-Klangunterschiede (6581-Filter, Combined Waveforms) sind jsSID-inhärent, kein Bug — gegen 2016-Sidplay verifiziert.
> - Automatisierter Audio-Test: `frontend/test-sid-audio.mjs` (rendert echtes PCM, prüft Oszillation + Song-Fortschritt, Strukturguard gegen den Plain-Class-Bug).
>
## Relaunch-Session (2026-05-31) — laufend auf `feat/relaunch-2026-05-31`

**Getroffene Entscheidungen (User):**
- **Präsentation:** Weg vom dichten Auto-Switch-Dashboard → **kuratierte Galerie** (weniger Panels gleichzeitig, mehr Weißraum, kein automatischer Komplett-Layout-Wechsel mehr, Nutzer erkundet selbst). Senkt auch Last (schwächere Hardware ruckelte).
- **Name:** FraktalLab passt nicht mehr. Neuer Name wird festgelegt, **wenn das neue Layout steht** (Kandidaten: Wunderkammer / Phosphor / Cathode).
- **Audio:** Auto-Play beim ersten Klick irgendwo → genau EINES von {AllYourBase, SID, Protracker}. Tippgeräusche (`AmbientSound.tsx`) raus + archivieren. AUDIO-Button → Mute/Play-Toggle. Player wechseln nie mittendrin (`LOCKED_PANELS`), AllYourBase nur nach Videoende.
- **Inventar:** `frontend/src/panels/registry.ts` als Status-Quelle (ARCHIVED_PANELS, LOCKED_PANELS). Vollständige Code-Registry (Pools, Kategorien, Asset-Größen) wandert beim Layout-Redesign dorthin.

**Erledigt in dieser Session:**
- [x] **Fake-Text-Panels deaktiviert + archiviert** (Code bleibt, via `registry.ts`/Git wiederholbar): `NeuralLinkDecoderPanel`, `BitcoinMinerPanel`, `SocialEngineering`, `TrafficMonitor`, `NuclearTargets`, `PwdCracker`. Aus Pools + `ALL_PANELS` entfernt.

**Offene Todos (aus User-Brief 2026-05-31):**
- [ ] Audio-Konzept umsetzen (Auto-Play 1. Klick, Tippgeräusche raus+archiv, AUDIO-Button = Mute, Player locked, AllYourBase→Sid/Protracker nach Video, immer nur 1 von 3, random song)
- [ ] Doppel-Panel-Bug (Menger 2×): Dedup in `generateLayout` + Fallback in `handleSkipSlot` (Z. ~943 picks random ohne Dedup)
- [ ] Galerie-Layout entwerfen + umsetzen, Auto-Komplett-Wechsel raus, Panels größer/weniger, Perf
- [ ] Dateigröße-Anzeige pro Panel im Reviewmodus (+ Gesamtgröße inkl. Songs bei Playern)
- [ ] Oppenheimer (`NuclearExplosionPanel`): Sequenz Terrain→Blitz(3-5s)→Pilz; Nacht erhellen; Nacht entschärft verschwommen, Pilz kontrastreicher; krumme Säule + Kontaktverlust zum Schirm fixen; zufällige Varianz; Wolke bleibt stehen bis Variant-Wechsel; Name/Variant-Mismatch (Oppenheimer Day zeigt Nacht) fixen; Terrain+Himmel komplexer (Tag+Nacht)
- [ ] `ThermonuclearWarPanel`: niemand überlebt, mehr Standorte (Pakistan/Indien/Nordkorea?), "Siberia" statt "Siberia Military Base", lesbarere Schrift, kein ALLCAPS
- [ ] `SolarSystemPanel`: maßstabsgetreu (Min-Pixelgröße 1-2px), korrekte Abstände, Umlaufbahnen nur für Planeten (nicht Monde)
- [ ] `StarfieldScene`: cyan-Raumschiff weg, Ego-Perspektive, Schüsse von uns zum Feind
- [ ] `RotozoomScene`: mehr Random
- [ ] `DNAHelix`: zufällige Start-Spezies statt immer Mensch
- [ ] `MandelbulbScene` / `MengerSpongeScene`: zufällige Start-Farbe; `ApollonianGasketScene` Feintuning (Kontrast/Tempo)
- [ ] Quantum Gravity (`PhysicsSandboxPanel`?): Energie aufbauen wenn Kugeln eng, nach Sekunden entladen (wegschleudern)
- [ ] `C64Panel`: Font-Regression (c64_font.png wird geladen, erscheint aber nicht) + BASIC-Screen realistisch (exakte Zeilen/Spalten 40×25, korrekte Boot-Textposition — im Web recherchieren)
- [ ] `RetroErrorPanel`: optional DOM-Text-Overlay für markier-/kopierbaren Text (System-Monospace, keine MB-Fonts)
- [ ] `GlobePanel`: im Reviewmodus nicht rot umrandet + nie im Hauptbereich gesehen → prüfen/fixen
- [ ] Nach Deaktivierung: Panelanzahl/Layout anpassen, Panels vergrößern (hängt am Galerie-Redesign)

**Fakten/Notizen:**
- AllYourBase-Video: extern gestreamt (`archive.org/download/youtube-dIQ53t0gv_4/dIQ53t0gv_4.mp4`), 0 Byte lokal → Seite ohne Assets ~1 MB.
- `c64_font.png` (`public/`) wird in `C64Panel.tsx:140` aktiv geladen (nicht obsolet).
- `RetroErrorPanel` ist bereits voll prozedural (Canvas2D), keine statischen Bilder.

### GitHub-Vorbereitung (Todo, eigene Session)

- [ ] **Repo:** https://github.com/DanielMuellerIR/FraktalLab.git
- [ ] **Erst privat** veröffentlichen — wegen mitgelieferter MOD- und SID-Dateien (urheberrechtlich geschützt, nicht für öffentliches Repo). Vor späterem Public-Schalten klären: Assets entfernen / extern laden / Lizenzlage.
- [ ] **Deutsches README** erzeugen: alle **aktiven** Panels auflisten + technische Vorzüge (z.B. eigene GPU-Fraktal-Engine mit double-single-Präzision, eigener ProTracker-MOD-Player + C64-SID-Player als AudioWorklet, prozedurale Panels, kleine Bundle-Größe ~1 MB ohne Assets). **Nüchtern/technisch, nichts erfinden**, so formuliert als wäre es public (Umstellung auf public evtl. bald).
- [ ] **Claude NICHT als Contributor/Autor angeben.** README-Autor = Daniel. Künftige Commits ohne `Co-Authored-By: Claude`-Trailer. Bestehende History enthält den Trailer noch — vor Public ggf. entscheiden, ob umgeschrieben wird (History-Rewrite ist riskant, nicht ungefragt machen).

> **Nächste Schritte — Panel-Rework Phase 2 (priorisiert nach Kritik-Intensität, ABGESCHLOSSEN):**
>
> ### Tier 1 — Kritische Ausfälle
> - [x] **RW-01 `NuclearExplosionPanel`** — Shader noch matschig: fBm auf 6 Oktaven, schärfere Turbulenz, Curl-Noise für rollende Kanten, Toroid-Billows, Self-Shadowing
> - [x] **RW-02 `MoonPanel`** — Krater sind flache schwarze Ellipsen statt 3D. Center-Hole-Artefakt fixen. Bump-Normal-Stärke hochdrehen. Farbvariation (warme Highlands vs dunkle Maria). Limb-Darkening + Earthshine
> - [x] **RW-03 `ShaderRetroWave`** — floor()-Quantisierung raus → smooth Noise-Terrain. fwidth() für Grid-AA. Sun-Cuts glätten
>
> ### Tier 2 — Strukturelle Neuentwürfe
> - [x] **RW-04 `StarfieldScene`** — Raumschiff-Verfolgungsszene: Chase → Hyperraumsprung → Countdown → Star-Stretch-Tunnel → Exit
> - [x] **RW-05 `VoxelDemoBW`** — Komplett neu: z.B. Overhead-Contourmap oder Spiral-Descent
> - [x] **RW-06 `NeuralNetPanel` (VoxelMatrix)** — Mehr Nodes, Topologie-Wechsel, farbcodierte Subnetze, Attack/Defense-Pakete
> - [x] **RW-07 `CADRobotPanel`** — Kindische Roboter ersetzen durch Hard-Sci-Fi: Industriearm, Mech-Walker, Satellit, Drone
> - [x] **RW-08 `OscilloscopePanel`** — Chiptune-Player mit SID-Emulation + Visualizer
> - [x] **RW-09 `ShaderHackingCore`** — Mass-Effect-Hacking-Spiel: konzentrische Ringe, rotierende Segmente, Bypass-Nodes
> - [x] **RW-10 `NeuralLinkDecoderPanel`** — Mehr Nodes, schärfer, kein Grün, Hard-Sci-Fi-Palette
>
> ### Tier 3 — Signifikante Verbesserungen
> - [x] **RW-11 `TunnelScene`** — Stargate-Stil: Kristallwände, Energiepulse, warpende Geometrie, Farbwechsel
> - [x] **RW-12 `ElitePanel`** — Wireframe weiß statt grün, kohärenter Dogfight-Ablauf
> - [x] **RW-13 `DNAHelix`** — Split-Layout: Helix links, Spezies-Info rechts (6 Spezies)
> - [x] **RW-14 `RetroErrorPanel`** — macOS Kernel Panic + Linux Oops/Panic ergänzen
> - [x] **RW-15 `VoxelDemoColor`** — Smooth-Camera-Interpolation, Sky-Gradient statt Schwarz, Soft-Fade
> - [x] **RW-16 `VoxelThermal`** — Rendering-Artefakte fixen, Soft-Vertical-Fade oben
> - [x] **RW-17 `VoxelLava`** — Anderer Flugpfad (Overhead/Spiral), eigenständiger Terrain-Charakter
> - [x] **RW-18 `VectorHudPanel` (VoxelNeon)** — Shape-Morphing zwischen Hypercube-Varianten, Zoom-Pulsing
> - [x] **RW-19 `MetaballsScene`** — Split bei Kollision, dynamische Blob-Anzahl 2–8
> - [x] **RW-20 `DotCloudScene`** — 300+ Nodes, kontinuierlicher Kamera-Orbit, modern Color
> - [x] **RW-21 `RotozoomScene`** — Trampolin-Effekt: ease-in-out Bounce-Physik
> - [x] **RW-22 `LissajousScene`** — Hintergrund-Kreuz weg, aggressivere Parameter-Variation
>
> ### Tier 4 — Fraktal-Parameter-Tweaks
> - [x] **RW-23 `FractalSpiral`** — Gegen Uhrzeigersinn, kontinuierlicher Hue-Shift
> - [x] **RW-24 `FractalElephant`** — Tumbling raus, andere Farben (weg von grün/orange)
> - [x] **RW-25 `FractalMini`** — Mehr Koordinaten-Varianz, langsamerer Zoom, längerer Zyklus
> - [x] **RW-26 `FractalSatellite`** — Tumbling raus
> - [x] **RW-27 `FractalDragon`** — Kürzere Full-Red-Verweilzeit (schnellerer Crossfade)
> - [x] **RW-28 `FractalSwirl`** — Zoom-Tiefe reduzieren (verhindert Pixel-Blowup)
> - [x] **RW-29 `FractalView`** — Tumbling raus, Max-Zoom-Tiefe reduzieren

---

## Projektcharakter & Entwicklungsphilosophie

FraktalLab ist ein humorvolles technisches Showcase — kein klassisches Produkt mit Abnahmekriterien.
Das Motto: *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Thematischer Rahmen: Ein fiktives „Neural Intrusion Dashboard", das Hacker-Klischees aus Kinofilmen persifliert und dabei echte beeindruckende Web-Technologien zeigt (WebAssembly, Canvas-Demoscene-Effekte usw.).

**Speed-first-Regel:** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können. Features, die das nicht schaffen, werden auf kleineres Scope reduziert oder verschoben. Keine halbfertigen Implementierungen.

Aktueller Stand: **v1.7.8** auf Feature-Branch `feat/panel-rework-2026-05-30` (Rework in progress). Deployment auf Netcup-Webspace (Apache).

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

**Fraktale (immer glatt — GPU-Shader via `FractalGL`):**
- `FractalView` (Hero-Panel)
- `FractalJulia`
- Alle Panels aus `FractalScenes.tsx`
- Hinweis: Tief-Zoom auf Apple/Metal ist bei ~5e5 gedeckelt (Präzision, siehe `PERF_NOTES.md`).

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

### Kategorie C — Voxel-Terrain (Sonderfall)

> **Update:** `VoxelThermal`/`VoxelLava` (`VoxelScenes.tsx`) sind bereits auf GPU-
> Raymarching migriert (GL-04 erledigt, scharf). `VoxelDemoColor`/`VoxelDemoBW`
> (`VoxelDemo.tsx`) ggf. noch CPU — bei Bedarf prüfen.


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
Fraktale:     GPU-Fragment-Shader (WebGL) mit double-single-Präzision
              → frontend/src/components/FractalGL.tsx + utils/fractal-gl-shader.ts
              (KEIN WASM/Rust mehr — seit der B-4-GPU-Migration entfernt)
Prod-Server:  Apache (Netcup) via frontend/public/.htaccess
Dev-Server:   Vite (setzt COOP/COEP-Header via vite.config.ts)
Testing:      Playwright (@playwright/test) — visueller Panel-Check + Perf-Suite
Audio:        Eigene ProTracker-MOD-Implementierung in frontend/src/utils/modplayer/
              (AudioWorklet, kein libopenmpt nötig)
              SID-Player (OscilloscopePanel): SID+6502-Emulation portiert aus
              jsSID 0.9.1 von Hermit (Mihaly Horvath) → frontend/public/audio/
              sid-player-worklet.js
```

### Externe Werke & Lizenzen (bereits integriert)

> Bis `licenses.json` (LR-12) existiert, hier festgehalten:

- **jsSID 0.9.1** — Hermit (Mihaly Horvath), 2016, http://hermit.sidrip.com.
  Lizenz: **WTFPL** ("do what the fuck you want"). Keine Pflichten; der Autor
  bittet lediglich, das Credit zu behalten. Attribution steht im Header von
  `frontend/public/audio/sid-player-worklet.js`. SID-Emulation + 6502-CPU-Core
  wurden adaptiert (Bugfixes: 6502-Opcode-Maske, Engine als Plain-Class für den
  Worklet, Noise-Waveform-Term, ENV3-Readback) und um Seek/Playtime erweitert.

---

## Repo-Struktur

```
frontend/
  src/
    App.tsx                 Grid-Layout-System, Pool-Definitionen, Layout-Wechsel-Logik,
                            Review-Modus (localStorage), Mobile-Layout (md:-Breakpoint)
    components/
      FractalGL.tsx         GPU-Fraktal-Renderer (Mandelbrot/Julia, WebGL-Shader,
                            double-single-Präzision, Auto-Zoom-Navigation, Crossfade)
      EnhancePhoto.tsx      Enhance-Slideshow (12 Stufen, 4s Zyklus, nur urbane Fotos)
    panels/                 Alle Panel-Komponenten (je eine Datei, siehe Inventar unten)
    ui/
      PanelSlot.tsx         Pool-basierter Slot + Duplikat-Tracking (kein Panel zweimal)
      GlitchOverlay.tsx     Vollbild-CRT/VHS-Glitch (zufällige Positionen)
      AmbientSound.tsx      Mechanische Tastatur-Sounds, startet bei erster Interaktion
      Panel.tsx             Rahmen mit grünem Border + Titelzeile
      Clock.tsx, StatBar.tsx, ScrollingLog.tsx
    utils/
      fractal-gl-shader.ts  GLSL für FractalGL (Mandelbrot/Julia, double-single, Färbung)
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

**Fraktal-Rendering (GPU):** Alle Mandelbrot-/Julia-Panels rendern über `FractalGL` (`frontend/src/components/FractalGL.tsx`) mit einem WebGL-Fragment-Shader (`utils/fractal-gl-shader.ts`). Der Shader nutzt **double-single-Arithmetik** (vec2 hi/lo) für Tief-Zoom bis ~1e13. Auto-Zoom-Navigation (Detail statt Schwarzraum) läuft über ein kleines Offscreen-Readback; Crossfade zwischen Locations/Julia-Parametern im selben Shader-Pass. WebGL-Contexts werden über `utils/webgl-pool.ts` budgetiert (`MAX_GL_CONTEXTS=8`, LRU-Eviction). **Kein WASM/Rust mehr** (seit Befund B-4 entfernt; alte Variante in der Git-History).

**HTTP-Header:** Vite-Dev-Server und `.htaccess` setzen `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`. `credentialless` erlaubt Cross-Origin-Medien wie das archive.org-Video. (Früher zusätzlich für WASM-SharedArrayBuffer nötig — das ist entfallen, die Header bleiben aber gesetzt und schaden nicht.)

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

- **`components/FractalGL.tsx`** — GPU-Fraktal-Renderer für ALLE Fraktal-Panels. WebGL-Shader (double-single), webgl-pool-Slot, zeitbasierte Animation, Offscreen-Nav-Readback, Crossfade. `FractalView`, `FractalJulia` und die `FractalScenes`-Familie sind dünne Wrapper darum.
- **`utils/modplayer/`** — Vollständiger ProTracker-MOD-Player in TypeScript. Header-Validierung in `loader.ts`, AudioWorklet jetzt Pflicht (ScriptProcessorNode-Fallback wurde in Iter. 2 entfernt, da Main-Thread-blockierend). Alle Standardeffekte implementiert (Arpeggio, Vibrato, Slides, Portamento). **Macht libopenmpt-WASM überflüssig.** Standalone-Variante in `p_modplayer_singlehtml/` — Verbesserungen werden zwischen den Projekten hybridisiert.
- **`utils/shared-audio.ts`** — Singleton AudioContext mit iOS-Audio-Session-Konfiguration. Genau richtig.
- **`panels/DemoScenes.tsx` `makeScene`-Factory** — elegante DRY-Lösung. Gemeinsame Infrastruktur (Resize, IntersectionObserver, OffscreenCanvas, Cached ImageData), Variation nur im `draw`-Callback. **Hat bereits einen `pixelated`-Parameter (Z. 156) — nur Default umstellen, siehe Pixel-Quality-Policy.**
- **`ui/PanelSlot.tsx`** — Kompakt und korrekt. Lokaler `localIdx`, Fade-Übergang via opacity, kein State-Lift zum Parent.
- **`isAudioPlaying()` in `App.tsx`** Z. 434 — pragmatisches Audio-Detection, blockiert Auto-Switch bei laufendem Sound.

### Verworfene Hypothesen aus früheren Versionen

- *„Mehrere Fraktal-Panels könnten sich eine WASM-Instanz teilen, falls sie das aktuell nicht tun"* — geprüft: tun sie. `wasm-loader.ts` ist Singleton.
- *„ImageData wird in allen Canvas-Panels pro Frame neu allokiert"* — nur teilweise wahr. PlasmaDemo, DemoScenes, VoxelScenes cachen korrekt. Nur FractalCanvas tut es falsch.
- *„MAX_PIXELS in FractalCanvas zu hoch"* — falsch eingeschätzt. Bei Pixel-Quality-Policy Kategorie B (= Fraktale) ist hohe Auflösung *gewollt*. Lösung ist WASM-Buffer-Sharing, nicht Auflösungs-Senkung.

---

## Panel-Inventar

### Fraktal-Panels (GPU-Shader via FractalGL) — Kategorie B (glatt)

| Datei | Inhalt |
|---|---|
| `components/FractalGL.tsx` | Gemeinsamer GPU-Renderer (Mandelbrot/Julia, double-single, Crossfade, HUD) |
| `panels/FractalView.tsx` | Hero-Panel: Mandelbrot, animierter Zoom durch 8 Koordinaten |
| `panels/FractalJulia.tsx` | Julia-Menge, 6 Parameter-Paare (Crossfade-Cycling, HUD) |
| `panels/FractalScenes.tsx` | Mini-Panels: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalSatellite`, `FractalTendril`, `FractalDragon`, `FractalDendrite`, `FractalSwirl` |

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

Aktueller Stand siehe `App.tsx` (`POOL_GFX`/`POOL_TEXT`) — die obige Liste ist nicht vollständig (viele neuere Panels wie `Shader*`, `Lidar`, `Tixy`, `IQ*`, `Lovebyte`, `Moon`, `Physics`, `Nuclear*`, `Supervolcano`, `Mandelbulb`, `Apollonian`, `Menger` fehlen hier). `OscilloscopePanel` (C64-SID-Player) ist seit der SID-Session wieder in `POOL_GFX` aktiv (war zuvor auskommentiert, weil stumm). `GlobePanel`, `VoxelMatrix` (via `NeuralNetPanel`-Re-Export) und `LissajousScene` sind ebenfalls aktiv.

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

# Erledigte Action-Plans → ARCHIVE.md

Die abgeschlossenen Action-Plans (Quick-Wins QW-01..09, Performance PERF-10..12,
WebGL-Infrastruktur GL-01..05, Demoszene-Integration kurz-/mittelfristig DEMO-01..06)
wurden nach `ARCHIVE.md` ausgelagert, um diese Datei schlank zu halten. Der aktuelle
Umsetzungsstand steht in `AUDIT_FINDINGS.md` und `PERF_NOTES.md`. Die langfristige
Roadmap (LR-*) folgt unten.

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
- **Kein WASM mehr:** Fraktale laufen auf GPU-Shadern (`FractalGL`/`fractal-gl-shader.ts`). Kein Rust/`wasm-pack`-Build. Frühere Audit-Tabellen (AUDIT-01/QW-01 etc.) und Action-Plan-Einträge, die `wasm/src/lib.rs` erwähnen, sind historisch.
- **Bei Unsicherheit zwischen „CPU-Optimierung" und „GPU-Migration":** wenn das Panel Kategorie B ist und auf großen Layouts > 1 Vollbild-Renderpass macht, ist GPU-Migration der richtige Weg. CPU-Mikro-Optimierungen lohnen sich nur bei Panels, die ohnehin CPU bleiben (Vektor, Text, retro-authentic).
- **Wenn ein Quick-Win unerwartete Visual-Regressions erzeugt** (anders aussehende Panels im Playwright-Diff): Pixel-Quality-Policy konsultieren, prüfen ob das Panel in Kategorie A oder B fällt, danach entscheiden ob die neue Darstellung gewünscht ist oder ob ein `pixelated: true` Override für dieses Panel die Lösung ist.
