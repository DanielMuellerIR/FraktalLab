# FraktalLab

FraktalLab ist ein browserbasiertes Technik-Showcase im Stil eines fiktiven
„Neural Intrusion Dashboard" — eine augenzwinkernde Persiflage auf das
Hacker-Klischee aus Kinofilmen, die als Vehikel für echte Demoszene- und
Grafiktechnik dient. In einem Kachel-Raster laufen Dutzende eigenständige Panels:
GPU-Fraktale, Distance-Estimator-Raymarching, klassische Demoszene-Effekte,
Voxel-Terrain, ein selbst geschriebener ProTracker-MOD-Player und ein
C64-SID-Emulator — überwiegend prozedural, nahezu ohne statische Assets.

Das Bundle ist ohne Audiodateien rund 1 MB groß (Vorbild: Farbrausch *fr-08*).

---

## Tech-Stack

| Bereich | Technik |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`, kein Config-File) |
| Fraktale | GPU-Fragment-Shader (WebGL) mit Double-Single-Arithmetik |
| Grafik | WebGL-Shader (GLSL) + Canvas-2D, je nach Effekt |
| Audio | Eigener ProTracker-MOD-Player + portierter C64-SID-Emulator, beide als AudioWorklet |
| Build | reines Vite/JS (kein WASM mehr, siehe Performance-Historie) |
| Server | Apache (Netcup) über `.htaccess`; Dev-Server: Vite mit COOP/COEP-Headern |
| Test | Playwright (visueller Panel-Check + Performance-Suite über CDP) |

---

## Performance-Historie: von WASM auf GPU

Die Fraktale wurden ursprünglich in Rust gerechnet, nach WebAssembly kompiliert
und das fertige Bild per `putImageData` aufs Canvas geblittet — also auf der CPU,
mit f64-Präzision.

Ein systematisches Performance-Audit (Playwright + Chrome DevTools Protocol,
Messung auf der Zielhardware mit echter GPU statt Software-Rasterizer) deckte den
eigentlichen Engpass auf: **Die App war main-thread-bound, nicht GPU-bound.**
Headless-Software-Rendering und echte Apple-GPU lieferten praktisch identische
Frame-Times. Der explizit geforderte Akzeptanzfall (vier großflächige Panels,
davon zwei Fraktale) erreichte nur **9 FPS** (≈108 ms/Frame) — jeder Frame ein
Long-Task über 50 ms, dominiert von Canvas-2D-Blits und Pro-Frame-JS.

Konsequenz war die schrittweise Migration aller Fraktale auf WebGL-Fragment-Shader:

1. Fraktal-Hero (`FractalView`) auf GPU.
2. Die zehn `FractalScenes` (Färbung 1:1 im Shader repliziert).
3. `FractalJulia` mit Parameter-Crossfade im Shader.
4. Rust/WASM-Renderpfad komplett entfernt (Crate, Loader, Vite-Plugins, DevDeps).

Ergebnis im selben Akzeptanzfall: **120 FPS** (vsync-Limit), 0 Long-Tasks. Der
Fraktal-Renderer ist auf der GPU praktisch kostenlos; der Tief-Zoom reicht statt
~1e6 (CPU-f64-Crossfade) nun bis ~1e13.

**Double-Single-Präzision:** Der Shader rechnet `z² + c` (Escape-Time-Iteration)
nicht in float32, sondern in Double-Single-Arithmetik — zwei float32 (`hi`/`lo`)
emulieren die doppelte Mantissenlänge über fehlerkompensierte Addition und eine
Dekker-Split-Multiplikation (Konstante 4097 = 2¹²+1), Verfahren nach DSFUN90.

**Apple-/Metal-Eigenheit:** Auf Apple-GPUs (Chrome → ANGLE-Metal) kontrahiert der
Shader-Compiler den Dekker-Split weg, sodass die Präzision effektiv auf float32
zurückfällt (Banding ab Zoom ~5e5). Da eine kanonische `ds_mul`-Härtung an der
Kontraktion scheiterte, gilt eine zentrale Obergrenze `SAFE_ZOOM_CEIL = 5e5`;
darüber wird zur nächsten Location gecrossfadet statt sichtbar zu brechen. Tieferer
Zoom auf Metal bräuchte Perturbations-Rendering (Referenz-Orbit) — ein eigener
größerer Schritt. Nicht-Metal-GPUs und Firefox halten die Double-Single-Präzision
weiterhin bis ~1e9.

---

## Die Panels

### GPU-Fraktale (Escape-Time, Double-Single)

Alle 2D-Fraktale rendern über einen gemeinsamen WebGL-Shader (`FractalGL`) mit
zeitbasierter, framerate-unabhängiger Animation, automatischer Zoom-Navigation
(Boundary-Tracking auf Farbdetail, Low-Detail-Erkennung per Farbhistogramm) und
Crossfade zwischen Locations.

- **FractalView** — Mandelbrot-Hero, zyklischer Auto-Zoom durch acht benannte
  Locations (Seahorse Valley, Triple Spiral, Elephant Valley u. a.).
- **FractalJulia** — sechs fest verschaltete Julia-Parameter (Dendrite, Dragon,
  Spiral, Rabbit, Seahorse, Snowflake) mit Crossfade und HUD.
- **FractalScenes** (10 Panels) — kuratierte Mandelbrot- und Julia-Ausschnitte mit
  je eigener Farbtransformation (mono/cold/hot/neon/invert), exakt im Shader
  repliziert: Seahorse Valley, Triple Spiral, Lightning Fork, Elephant Valley,
  Mini-Mandelbrot, Neon Dragon, Satellite Orbit, Dendrite Hypha, Deep Swirl,
  Tendril Cluster.

### 3D-Fraktale (Distance-Estimator-Raymarching)

GLSL-Raymarching mit Distance Estimator, Normalen per Finite-Differenzen,
Phong-artiger Beleuchtung, Ambient Occlusion aus Schrittzahl und volumetrischem
Glühen.

- **MandelbulbScene** — Mandelbulb (Potenz-*p*-Verallgemeinerung z→zᵖ+c) mit
  derivativ getracktem Distance Estimator, animierter Potenz, Orbit-Kamera.
- **MengerSpongeScene** — iterativ gefalteter Menger-Schwamm (`sdBox` + `fract`-
  Faltung über mehrere Oktaven).
- **ApollonianGasketScene** — Apollonian Gasket über iterative Space-Folding und
  Inversion, Tunnel-Kamera, Drei-Farben-Palette nach Tiefe.
- **ShaderMandelbox** — Mandelbox (Box-Fold + Sphere-Fold), Distance Estimator
  nach Inigo Quilez.

### Demoszene-Klassiker

GPU-Fragment-Shader, sofern nicht anders vermerkt:

- **PlasmaDemo** — überlagerte Sinusfelder (klassisch / Tunnel-Spirale /
  Interferenz-Moiré), Paletten-Crossfade.
- **TunnelScene** — Polar-Mapping-Tunnel (`r = 1/length(uv)`, `atan` für den
  Winkel) mit Twist, Ripple und glühendem Kern.
- **RotozoomScene** — rotierende, skalierte Textur-Abtastung mit 2×2-Supersampling
  und Bounce-Physik; Muster und Drehrichtung je Mount zufällig.
- **FireScene** — aufsteigende Glut über FBM-Rauschen und Höhen-Abkühlung.
- **MetaballsScene** — implizite Iso-Oberflächen aus inversen Quadrat-Distanzen,
  Blobs spalten sich bei Kollision.
- **DotCloudScene** *(Canvas-2D)* — 3D-Punktwolke auf einer Kugelschale,
  3-Achsen-Rotation, perspektivische Projektion, Tiefensortierung (Painter).
- **ThreeBodyScene** *(Canvas-2D)* — drei kollidierende Körper (Impulserhaltung),
  jeweils als pixelweise schattierte Kugel mit rotierendem Schachbrettmuster.

### Voxel-Terrain

Voxel-Space-Rendering im Stil von NovaLogic *Comanche* (Heightmap, Säulen-
Raycasting), inzwischen auf GPU-Raymarching migriert. Heightmaps prozedural aus
überlagerten Sinus-/Kosinus-Oktaven.

- **VoxelThermal**, **VoxelLava** (ridged Terrain, Spiral-Orbit-Kamera),
  **VoxelNeon**, **VoxelDemoColor** — GPU-Raymarching mit unterschiedlichen
  Paletten.
- **VoxelDemoBW** — orbitale Höhenlinien-/Kontur-Darstellung (Normal-Shading aus
  Höhentextur statt Raycasting).

### Sizecoding- & Shadertoy-Showcase

- **LovebyteShowcasePanel** — rotierende Mini-Shader im Geist der *Lovebyte*-
  Sizecoding-Wettbewerbe (Moiré-Interferenz, IFS-Funken, Sinus-Plasma).
- **TixyPanel** *(Canvas-2D)* — Formel-Visualisierung `f(t,i,x,y) → [-1,1]` auf
  diskretem Raster, im Geist von *tixy.land* (Martin Kleppe).
- **IQSmoothMin** — Polynomial Smooth Minimum als weiches SDF-Blending (Technik
  von Inigo Quilez).
- **IQDigitalStorm** — rückgekoppeltes FBM-Rauschen (Domain-Warping), Technik nach
  Inigo Quilez.
- **ShaderRetroWave** — Synthwave-Gelände per Terrain-Raymarching, FBM-Höhe,
  `fwidth`-geglättete Gitterlinien.
- **ShaderHackingCore** — konzentrische Ringe mit rotierenden Segmenten und
  Bypass-Knoten in Polarkoordinaten.

### Vektor-, 3D-Wireframe- und Simulations-Panels

- **ElitePanel** *(Canvas-2D)* — Hommage an *Elite* (1984): Cobra-Mk-III-Wireframe,
  First-Person-Sternenfeld, 3D-Rotationsmatrizen, Auto-Targeting, klassischer
  Radarscanner.
- **CADRobotPanel** *(Canvas-2D)* — vier rotierende Wireframe-Modelle auf
  Blueprint-Raster, Euler-Rotation, Face-Normalen mit Backface-Culling und
  Lambert-Shading.
- **DNAHelix** *(Canvas-2D)* — parametrische Doppelhelix mit Basenpaaren,
  Tiefensortierung, container-relativer Skalierung.
- **GlobePanel** *(WebGL-Shader)* — rotierende Erde über äquirektanguläres
  UV-Mapping, FBM-Wolkenschicht, Tag/Nacht-Terminator, Stadtlichter, Fresnel-Limb.
- **SolarSystemPanel** *(Canvas-2D)* — heliozentrisches Planetarium mit
  wurzelkomprimierten realistischen Maßstäben, Zoom-Sequenzen auf einzelne Körper
  samt Info-Overlay.
- **LidarScanPanel** *(Canvas-2D)* — rotierendes 3D-Punkt-Grid mit vier
  Terrain-Funktionen und radialem Sonar-Sweep.
- **MoonPanel** *(WebGL-Shader)* — prozeduraler Mond: Höhenfeld mit Kratern,
  Bump-Mapping über Finite-Differenzen, Oren-Nayar-/Lommel-Seeliger-Beleuchtung,
  Ejecta-Strahlen, Erdschein.
- **NuclearExplosionPanel** *(WebGL-Shader)* — volumetrischer Atompilz per
  Raymarching durch ein Wolken-SDF (gerade Säule + toroide Kappe), 6-Oktaven-FBM,
  Domain-Warping, Self-Shadowing, Schwarzkörper-Temperaturfärbung; Blitz-zu-Pilz-
  Sequenz, je Mount deterministisch variiert.
- **PhysicsSandboxPanel** *(Canvas-2D)* — leuchtende Kugeln mit gedämpfter
  Gravitation (singularitätsfrei) und elastischen Stößen; bei dichtem Gedränge
  Energieaufbau und schlagartige radiale Entladung samt Schockwelle.

### Retro

- **C64Panel** *(Canvas-2D)* — C64-BASIC-Bootscreen auf exaktem 40×25-Raster,
  PAL-Palette, Pixel-perfektes Rendering ohne Interpolation. Die Schriftfarbe wird
  über eine Alpha-Maske aus der Font-PNG und `source-in`-Tint exakt getroffen
  (ohne Snapping auf eine ungewollte Palettenfarbe).
- **RetroErrorPanel** *(Canvas-2D)* — Slideshow klassischer Absturzbildschirme
  (Mac System 7 Bomb, Windows-95-BSOD, Amiga Guru Meditation, Kernel Panic),
  prozedural gezeichnet; ein unsichtbares DOM-Text-Overlay macht den Text
  markierbar und kopierbar.
- **EnhanceView** *(Canvas-2D)* — „Enhance"-Slideshow: ein Bild wird über zwölf
  Stufen von grob gepixelt zu scharf hochgezogen — das Hochskalieren selbst ist das
  Stil-Element.

### Audio

- **AmiModPanel — ProTracker-MOD-Player.** Eigene Implementierung des Amiga-.MOD-
  Formats (kein libopenmpt): Parser für Header, bis zu 31 Samples und 99 Patterns,
  4 Kanäle, Period-/Paula-Frequenztabellen, Sample-Mixing und die gängigen
  Effektbefehle (Arpeggio, Portamento, Vibrato, Volume-Slide, Pattern-Break,
  Set-Speed, Extended-Effekte). Läuft als AudioWorklet; das Panel zeigt VU-Meter,
  Pattern-Scroll und einen Positions-Scrubber, mit Drag-&-Drop für eigene Module.
- **OscilloscopePanel — C64-SID-Player.** Portierung von **jsSID 0.9.1** (Hermit /
  Mihaly Horvath, WTFPL): 6502-CPU-Emulation plus SID-Chip (6581/8580), drei
  Stimmen, Wellenformen Dreieck/Sägezahn/Puls/Rauschen, ADSR, Sync/Ring-Modulation
  und Filter. Läuft als AudioWorklet (als Plain-Class, da ein direktes
  `extends AudioWorkletProcessor` im Konstruktor scheiterte). Das Oszilloskop
  zeichnet die echte Wellenform pro Stimme; ergänzt um Seek per Frame-Stepping.

*Hinweis zur SID-Engine:* Die vereinfachte jsSID-Wiedergabe führt pro Frame den
gesamten CPU-Code am Stück aus und rendert das Audio danach aus dem Endzustand der
Register. Tunes, die auf Sample-/Digi-Wiedergabe (z. B. 4-Bit-PCM über das
Lautstärkeregister mit vielen Schreibvorgängen pro Frame) setzen, lassen sich damit
nicht korrekt abspielen — das bräuchte Sub-Frame-Interleaving von CPU und
Audio-Rendering.

### Text-Panels

Ergänzend laufen mehrere Text-Panels im monochromen Terminal-Stil (Chat-Verlauf,
Satelliten-Tracking, System-Vitals u. a.). Sie tragen die Dashboard-Ästhetik und
skalieren container-relativ mit der Kachelgröße.

---

## Bemerkenswerte Herausforderungen

- **Double-Single auf Metal:** Der Apple-Shader-Compiler optimiert den Dekker-Split
  weg — siehe Performance-Historie. Nur auf echter Metal-GPU sichtbar, nicht im
  Software-Rasterizer; daher erst durch einen Test auf der echten GPU entdeckt.
- **WebGL-Kontextlimit:** Bei vielen gleichzeitigen Shader-Panels müssen Kontexte
  budgetiert und überzählige GL-Kacheln durch Canvas-2D-/Text-Panels ersetzt werden.
- **Main-Thread-Last:** Das Audit zeigte, dass nicht die GPU, sondern Canvas-2D-
  Blits und Pro-Frame-JS der Engpass waren — die richtige Diagnose vor der
  GPU-Migration.
- **Audio unter iOS/WebKit:** strikt gestengebundener `AudioContext`-Unlock und
  Umgehung des physischen Lautlos-Schalters.

---

## KI-Unterstützung

Die Entwicklung erfolgte mit KI-Unterstützung (Pair-Programming mit großen
Sprachmodellen). Frei nach dem Motto: *„Viele Millionen Tokens formten diesen
schönen Körper."*

---

## Lizenzen Dritter

- **jsSID 0.9.1** — Hermit (Mihaly Horvath), 2016, <http://hermit.sidrip.com> —
  Lizenz **WTFPL**. Die SID-/6502-Emulation wurde adaptiert (u. a. korrigierte
  6502-Opcode-Maske, Plain-Class für den Worklet) und um Seek/Spielzeit erweitert.
  Das Credit bleibt im Header von `sid-player-worklet.js`.
- **Audio-Tracks** — die mitgelieferten MOD- und SID-Stücke stammen von
  [Battle of the Bits](https://battleofthebits.com) und stehen unter
  **CC BY-NC-SA**. Jeder Player zeigt pro Stück die vollständige Attribution
  (Titel, Autor, BotB-Entry, Lizenz, „No changes made") samt Links.
