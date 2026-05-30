# Panel-Rework-Plan — Review 2026-05-30

**Status: ENTWURF zur Freigabe.** Noch keine Code-Änderung. Quelle der Kritik:
`review2026-05-30.md` (JSON aus Review-Modus). Dieser Plan setzt **jeden** Kommentar
um — „Daumen runter" heißt „hier soll etwas passieren", die Schwere steht im Kommentar.

Leitlinien (verbindlich):
- **Effizienz wie fr-08:** kleine Dateien, prozedurale Generierung bevorzugt, Assets
  hochkomprimiert (1-bit-Masken, WebP, base64 inline) oder gar nicht geladen. Ladebalken
  am Panel-Start ist erlaubt, wenn Vorberechnung nötig ist.
- **Präzision wo der Nutzer detailliert beschreibt, Kreativität wo „neu erfinden" steht.**
- **Weg vom Hacker-Grün** in allen Grafik-/Simulationspanels (Querschnittsthema, siehe A).
- **Pixel-Quality-Policy Kategorie B** (glatt, native Auflösung) bleibt Default.
- **Selbstverifikation per Screenshot** für alle „fotorealistisch"-Aufträge (siehe F).

Effort-Skala: **S** (Teil einer Session) · **M** (eine Session) · **L** (eine volle Session,
fokussiert) · **XL** (muss in Teilschritte zerlegt werden, Speed-first-Regel).

---

## 0. Übersicht — was die Kritik gruppiert

Aus 52 bewerteten Panels: **11 Daumen hoch** (nicht anfassen, teils als Referenz nutzen),
**41 Daumen runter** in folgenden Clustern:

| Cluster | Panels | Charakter |
|---|---|---|
| 1. Fraktale (Präzision) | FractalSpiral, Elephant, Mini, Satellite, Dragon, Swirl, FractalView | kleine, exakte Tweaks |
| 2. DE-Fraktal-Familie (★) | ShaderMandelbox-Varianten; Reinvent von VoxelMatrix, NeuralLinkDecoder, DotCloud | Kreativ, hohe Wirkung |
| 3. Voxel | VoxelDemoColor, VoxelThermal, VoxelLava, VoxelDemoBW, VoxelNeon | Engine-Fix + Kreativ |
| 4. Demoszenen | Lissajous, Tunnel, Rotozoom, Metaballs, Starfield | Präzision + Kreativ |
| 5. Prozedural-GLSL (Farbe) | IQSmoothMin, IQDigitalStorm, Tixy, Lovebyte, ShaderHackingCore, ShaderRetroWave | Palette + Reinvent |
| 6. Fotorealismus | GlobePanel, MoonPanel, NuclearExplosion, ThermonuclearWar, Supervolcano | Schwer, Web-Refs, Verifikation |
| 7. Vektor/Retro | ElitePanel, CADRobotPanel, RetroErrorPanel, RadarSweepPanel, LidarScanPanel | Re-Design |
| 8. Daten/Audio | DNAHelix, SolarSystemPanel, OscilloscopePanel | Web-Daten + SID-Player |
| 9. Single-Theme-Reinvent | ParallaxPanel, DaggerfallPanel | komplett neu |

**Daumen hoch (Referenz / unangetastet):** FractalJulia, FractalSeahorse, FractalLightning,
FractalTendril, FractalDendrite, AmiModPanel, ThreeBodyScene, FireScene, AllYourBase,
ICQChatPanel, **ShaderMandelbox** (★ „bestes Panel — mehr davon").

---

## A. Querschnitt: Palette-System („weg vom Grün")

**Problem:** Der Nutzer fordert bei *mindestens 10* Panels explizit den Wegfall des
Hacker-Grüns und/oder wechselnde Farben (IQSmoothMin, IQDigitalStorm, Tixy, Lovebyte,
DotCloud, NeuralLink, Oscilloscope, DNAHelix-Akzente, Parallax, teils Elite/Radar). Heute
ist die Farbe in jedem Shader-String bzw. Canvas-Aufruf **hart codiert**. `ShaderPanel.tsx`
bietet keinerlei Farb-/Palette-Uniform (nur `iResolution`, `iTime`, `iMouse`).

**Lösung — gemeinsames Palette-Modul (`utils/palettes.ts`, < 2 KB):**
- Satz kuratierter Neon-Paletten (je 3–5 Stützfarben), z.B. *Sunset*, *Ice*, *Acid*,
  *Magma*, *Vapor*, *Toxic*, *Mono-Amber* — **kein** reines Hacker-Grün als Default.
- Procedural-Palette nach Inigo Quilez: `a + b*cos(2π*(c*t+d))` — eine `vec3 palette(float t)`
  GLSL-Funktion, die per Uniform-Koeffizienten gesteuert wird. So lässt sich pro Panel und
  über die Zeit **kontinuierlich** die Farbe verschieben (genau was Spiral, IQDigitalStorm,
  Lovebyte, Tixy fordern).
- Helfer für Canvas2D: `paletteHex(palette, t)` für die Vektor-Panels.

**ShaderPanel-Erweiterung:** neue optionale Uniforms `uPalA/uPalB/uPalC/uPalD` (vec3) +
`uPaletteShift` (float, zeitgetrieben). Panels, die heute grün hart codieren, rufen statt
`vec3(0.0, g, 0.0)` künftig `palette(value + uPaletteShift)` auf.

**Auswahl-Logik:** Pro Panel wird beim Mount **zufällig** eine Palette aus einer panel-
spezifischen Whitelist gezogen (Varianz über Sessions), und/oder über die Zeit gefadet.
Damit erfüllt ein Mechanismus „andere Farben" + „zufällig wechseln" + „nicht immer grün"
für die gesamte Cluster-5-Gruppe.

**Effort:** M (Modul + ShaderPanel-Uniforms). Danach ist jede Einzel-Panel-Umstellung S.
**Wirkung:** löst ~10 Kommentare mit einer Infrastruktur.

---

## B. Querschnitt: FractalGL-Parameter-Erweiterung (Cluster 1)

`components/FractalGL.tsx` steuert alle Fraktal-Panels. Drei Kritikpunkte sind hier zentral
und werden über **neue Props** gelöst (statt pro Panel zu hacken):

1. **„Tumbling raus"** (Elephant, Satellite, FractalView). Das „Tumbling" ist die
   Dauerrotation `s.angle += 0.12 * dt` (FractalGL.tsx:310). → neue Prop `rotateRate`
   (Default **0** = kein Tumbling). Spiral bekommt einen **negativen** Wert
   (Gegen-Uhrzeigersinn, ausdrücklich gewünscht).

2. **„Letzte ~2–3 s große Pixel"** (FractalView, Swirl, Dragon). Ursache: `SAFE_ZOOM_CEIL =
   5e5` (FractalGL.tsx:56) ist auf der Ziel-GPU schon zu tief — die Präzision bricht sichtbar,
   bevor gefadet wird. → (a) effektive Fade-Schwelle **pro Szene** absenkbar machen
   (`fadeZoomCeil`-Prop, Default z.B. 2e5), (b) Zoomgeschwindigkeit leicht senkbar machen
   (`zoomRate`-Prop, Default < 0.82), (c) Fade **früher** einleiten (Crossfade startet, bevor
   die Pixel groß werden). Effekt: der sichtbare Bildausschnitt erreicht den Degradationspunkt
   nie.

3. **Kontinuierliche Farbverschiebung** (Spiral): neues Uniform `uHueShift`, zeitgetrieben in
   `frame()`, im Shader auf die Hue-Färbung addiert. Optional auch zur Differenzierung von
   Elephant nutzbar.

Zusätzlich: **schnellere Uniform-Flächen-Erkennung** für Dragon (Julia bleibt ~2 s vollrot,
weil die Low-Detail-Prüfung erst nach `elapsed > 5000` greift, FractalGL.tsx:264). → Mindest-
Standzeit pro Szene konfigurierbar bzw. Start-Zoom für Julia höher, damit nie eine uniforme
Vollfläche am Anfang steht.

**Effort:** M (eine saubere Prop-Erweiterung deckt Cluster 1 fast komplett ab).

---

## C. Querschnitt: Volumetrischer Raymarch-Baustein (Cluster 6 teilweise)

Web-Recherche bestätigt: **Atompilz und Vulkan-Eruptionssäule teilen denselben Renderer** —
fBm-Dichte + Beer–Lambert-Transmission + Sonnen-Lightmarch (Self-Shadow) + Henyey-Greenstein-
Forward-Scatter + Emissions-Term (Feuerball bzw. Caldera-Glühen). → ein gemeinsames GLSL-Modul
`utils/volumetric-glsl.ts`, parametrisiert über Quell-/Geschwindigkeits-/Emissionsfeld.
Bedient NuclearExplosion (Feuerball→Pilz) und Supervolcano (Eruptionssäule→Schirmwolke).
Optional später für echte Wolken nutzbar.

**Effort:** L (das Modul), danach je Panel M.

---

## D. Querschnitt: Voxel-Engine-Fix + Orientierungen (Cluster 3)

Alle Voxel-Panels rendern bereits per **GPU-Heightmap-Raymarch** über `ShaderPanel` (kein CPU
mehr). Gemeinsame Mängel:
- **Schwarze obere Hälfte + harte Horizont-Grenze** (VoxelDemoColor:37–45, VoxelThermal:438):
  Himmel wird ab `iResolution.y * 0.42/0.44` mit fast-schwarzem Verlauf gefüllt; das Terrain
  „clippt" an dieser Linie. → echter Himmel-Verlauf (Dunst/Atmosphäre statt Schwarz) + Terrain
  ohne harten Cut; Strahl-Marsch bis zum echten Horizont, Fernabblendung per Dunst.
- **„Messer"/Pixeltreppen** (VoxelThermal): unterabgetastete Heightmap + zu großer
  Exponential-Step (VoxelScenes.tsx:471). → kleinere Schrittweite nahe der Oberfläche +
  Interpolation der Heightmap; Normalen analytisch für sauberes Shading.
- **Eintöniger Flug** (Lava zu ähnlich zu Thermal): der Nutzer wünscht **Kreativität** — Flug
  über Kopf / Terrain oben / rotierender Flug. → Kamera-Orientierung als Engine-Parameter
  (Roll/Pitch, invertierte Gravitation), pro Voxel-Panel ein anderer „Flugmodus".

**Effort:** L (Engine-Generalisierung), danach je Panel S–M.

---

## E. Querschnitt: DE-Fraktal-Panel-Familie (★, Cluster 2)

Der Nutzer nennt ShaderMandelbox **„bestes Panel — bitte hiervon Varianten machen, mehr davon
in anderen Panels". Das ist der wichtigste kreative Auftrag.** ShaderMandelbox ist ein
Raymarch-Distance-Estimator (Gold/Magenta). Web-Recherche liefert fertige DE-Snippets für
Geschwister:
- **Mandelbulb** (Power 8, animierbarer Power-Morph)
- **Apollonian Gasket** (IQ Fold + Sphere-Inversion — gepackte Kugeln, ideal Cyan/Teal)
- **Kaleidoscopic IFS / Sierpinski** (Rotation zwischen Folds = endlose Varianz)
- **Menger-Schwamm** (Stahl-Blau/Metallic kontrastiert das Gold)
- **Mandelbox-Variante** (nur `SCALE`-Vorzeichen + Fold-Radien ändern → völlig andere Topologie)

Jedes erbt den vorhandenen Raymarch-Rig (gleiche Kamera, gleiche Performance-Tricks: 64–96
Steps, Understep 0.8, Tetrahedron-Normalen, AO statt echter Schatten — alles in der Recherche
dokumentiert). Färbung über das **Palette-System (A)**, damit die Familie zusammengehört, aber
jede Variante eine eigene Identität hat.

**Diese Familie ist zugleich die Reinvent-Lösung für drei „langweilig/neu erfinden"-Panels:**
- **VoxelMatrix** (heute langweiliger Node-Graph) → wird ein DE-Fraktal-Panel.
- **NeuralLinkDecoder** (matschig, grün) → wird ein DE-Fraktal-Panel mit scharfem Hard-Sci-Fi-
  Text-Overlay (siehe Cluster 8-Stil), in Neon-Palette, hochauflösend.
- **DotCloud** (zu ähnlich zu anderem Panel, sinnloser Zoom) → wird ebenfalls eine
  raymarch-basierte oder moderne 3D-Punktwolken-Variante (kein Hacker-Grün).

**Effort:** Pro Variante M (DE-Snippet liegt vor, Rig existiert). Familie gesamt L–XL → in
Teilschritte pro Variante. Höchste Priorität wegen Nutzer-Begeisterung.

---

## F. Querschnitt: Visuelle Selbstverifikation (Pflicht für Cluster 6 + Teile 7)

Der Nutzer fordert ausdrücklich, dass ich **selbst per Screenshot gegen echte Fotos prüfe**
und erst „fertig" melde, wenn hohe Ähnlichkeit erreicht ist (Globe, Moon, Nuclear). Plan:
- Playwright-Skript rendert das Panel isoliert, macht Screenshot.
- Vergleich gegen heruntergeladene **Referenzfotos** (NASA/USGS/Wikimedia, public domain —
  URLs in Abschnitt „Web-Asset-Plan"). Referenzbilder werden **nicht ausgeliefert**, nur für
  den Soll-Ist-Abgleich im Repo unter `tests/reference/` (gitignored oder klein gehalten).
- Iteration, bis die Silhouette/Geografie/Komposition stimmt; visuelle Bewertung durch mich
  (kein reiner Pixel-Diff, sondern struktureller Abgleich Maria-Positionen, Kontinent-Umrisse,
  Pilz-Anatomie). Ergebnis dokumentieren.
- Gleiches Verfahren für **RetroErrorPanel** (Nähe ans Original der Absturzmeldungen) — vom
  Nutzer explizit gewünscht.

**Effort:** M (Harness), danach pro Panel laufende Iteration eingerechnet.

---

## G. Web-Asset-Plan (Bilder & Daten besorgen)

Konsolidiert; alle Quellen recherchiert, Lizenz/Größe geprüft. **Faustregel: Referenzbilder
nur zur Verifikation, nicht ausliefern. Ausgeliefert wird nur, was winzig + frei ist.**

| Zweck | Quelle | Lizenz | Größe / Form | Verwendung |
|---|---|---|---|---|
| Erd-Kontinente (Globe + Thermonuclear) | Natural Earth 1:110m `ne_110m_land` (martynafford-GeoJSON / nvkelso) → TopoJSON, **oder** 1-bit-Equirect-Maske selbst rastern | **CC0 / Public Domain** | TopoJSON ~10–15 KB gz; 1-bit-PNG 512×256 ~4–10 KB base64 | **ausliefern** (inline), Rest prozedural |
| Erd-Tag-Farben (Verifikation) | NASA Blue Marble (visibleearth.nasa.gov 57723/73580) | PD | groß | nur Soll-Abgleich |
| Erd-Nachtlichter (Verifikation + Verteilung) | NASA Black Marble (earthobservatory 79803) | PD | groß | nur Soll-Abgleich; Lichter **prozedural** an Küsten/Megacity-Cluster |
| Mond (Verifikation + Maria-Positionen) | LROC WAC Mosaic (USGS astrogeology), SVS 5001 | PD | groß | nur Soll-Abgleich; Krater/Maria **prozedural** |
| Atompilz (Verifikation) | Wikimedia: Trinity color, Crossroads Baker (Wilson-Cloud), Castle Bravo | PD (US-Gov) | groß | nur Soll-Abgleich; Wolke volumetrisch prozedural |
| Vulkan-Eruption (Verifikation) | USGS: St. Helens 1980 Plinian column, Pinatubo 1991 | PD | groß | nur Soll-Abgleich |
| DRADIS-Optik | Referenzbild (gian-cursio Dradis_Showcase) + Battlestar-Wiki | Referenz | — | Icons/Farben **nachbauen** |
| Elite-1984-Optik | bbcelite.com (Scanner-Deep-Dive, Box-Screenshot) | Referenz | — | weiße Wireframe + HUD **nachbauen** |
| DNA-Artstats (6 Spezies) | NCBI/Ensembl/NHGRI/IUCN (Tabelle liegt vor) | Fakten | Text | **inline als Daten** |
| Solarsystem-Daten + Monde | NASA/IAU (Tabelle liegt vor) | Fakten | Text | **inline als Daten** |
| SID-Player | jsSID (~14 KB, pure JS) **oder** Wothke WebSID (WASM, akkurater) | jsSID frei / WebSID LGPL | klein | Player-Code |
| SID-Tunes | HVSC (.sid, je ~2–26 KB) | **copyrighted** ⚠ | winzig | **Lizenzfrage offen, siehe §J** |
| 3D-Mech-Modelle (optional) | Quaternius/Kenney (CC0, GLB ~20–120 KB) | CC0 | klein | Fallback; primär prozedural |

DNA- und Solarsystem-Tabellen liegen aus der Recherche vollständig vor und werden beim
Abarbeiten direkt eingebaut (keine zweite Web-Runde nötig).

---

## Cluster 1 — Fraktale (Präzision, über B gelöst)

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **FractalSpiral** | down | Zu ähnlich zu Seahorse („grüner Bruder"); Gegen-Uhrzeigersinn-Rotation + kontinuierliche Farbverschiebung | `rotateRate` negativ + `uHueShift`; Palette weg vom Mono-Grün → eigene Identität. Andere Location/Iteration als Seahorse. |
| **FractalElephant** | down | Zu ähnlich zu Tendril; Tumbling raus; Außenfarben (grün/orange) kollidieren mit Tendril | **Kernbefund: beide nutzen `'hot'`.** Elephant auf distinkte Palette (z.B. Ice/Vapor) + `rotateRate=0`. |
| **FractalMini** | down | Zoom zu kurz, fast identische Durchläufe; mehr Varianz, länger/langsamer | mehr Locations, `zoomRate` runter, längere Standzeit, Start-Zoom randomisieren. |
| **FractalSatellite** | down | Tumbling raus, sonst gut | `rotateRate=0`. |
| **FractalDragon** | down | Bleibt ~2 s vollrot | höherer Julia-Start-Zoom / schnellere Uniform-Erkennung, damit nie Vollfläche am Start. |
| **FractalSwirl** | down | Zoom ~3 s zu lang, Pixel werden groß; Tiefe + Tempo runter | `fadeZoomCeil` senken + `zoomRate` leicht runter. |
| **FractalView** | down | Letzte ~2 s große Pixel; Tumbling raus | `fadeZoomCeil` senken, früher faden + `rotateRate=0`. |

**Effort gesamt Cluster 1:** M (alles über die B-Props). Geringes Risiko, hohe Trefferquote.

---

## Cluster 2 — DE-Fraktal-Familie (★, über E)

Siehe E. Reihenfolge nach Wirkung: zuerst 2–3 neue Mandelbox-Geschwister
(Mandelbulb, Apollonian, Menger/KIFS), dann Reinvent von VoxelMatrix, NeuralLinkDecoder,
DotCloud als DE- bzw. moderne 3D-Panels. **Höchste kreative Priorität.**

---

## Cluster 3 — Voxel (über D)

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **VoxelThermal** | down | Bestes Voxel, Stil behalten; „Messer"/Treppen + oben harte Clip-Grenze weg | Engine-Fix D: feinerer Step + Heightmap-Interpolation + echter Himmel statt Cut. Palette/Stil bleiben. |
| **VoxelDemoColor** | down | Springt unruhig; obere Hälfte schwarz; harte Mittel-Grenze; echter, eleganter 3D-Flug | Engine-Fix D + ruhigere Kamera (Höhen-Damping glätten, sanfter Spline-Flug). |
| **VoxelLava** | down | Zu ähnlich zu Thermal; kreativer: Terrain oben / Über-Kopf / rotierender Flug | neuer Flugmodus (D: invertierte/rollende Kamera), eigene Heightmap-Charakteristik. |
| **VoxelNeon** (=VectorHud) | down | 2 s gut, dann langweilig; andere Formen, Verzerrung bei Rotation, rein-/rauszoomen, elegant | Wireframe-Würfel → wechselnde Polyeder + Morph/Verzerrung + Atem-Zoom; Palette weg vom Grün. |
| **VoxelDemoBW** | down | Langweilig — **neu erfinden** | Kreativ: z.B. monochromer Über-Kopf-Canyon-Flug mit Tiefen-Nebel **oder** als zweites DE-Panel. Entscheidung beim Abarbeiten, eine Idee sauber. |

---

## Cluster 4 — Demoszenen

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **LissajousScene** | down | Farben ok, **Kreuz im Hintergrund weg**, mehr Bahn-Varianz, wirkt billig | Center-Crosshair (DemoScenes:1179–1181) entfernen; Frequenz-/Phasenraum stärker variieren; höhere interne Auflösung (Glätte). |
| **RotozoomScene** | down | Mehr Dynamik: Fallen kinetischer wie Trampolin — oben langsam, runter beschleunigen, unten hart abprallen | sinusförmigen Zoom (DemoScenes:620) durch **Gravitations-Bounce-Easing** ersetzen (quadratische Beschleunigung + harter Rebound). |
| **MetaballsScene** | down | Langweilig; Kugelanzahl dynamisch, bei Kollision Neuaufteilung (mal mehr/weniger Objekte) | Festkugel-5 (DemoScenes:687) → variable Population mit Split/Merge-Logik. **Migration auf echten GPU-Shader** (heute CPU 320×240 + pixelated → Kategorie-B-Verstoß) für native Glätte. |
| **TunnelScene** | down | Nach 3 s langweilig; Richtung Stargate-Reise; coolere Effekte als Regenbogen+Schachbrett; Zufalls-Aspekt für Langzeit-Varianz | **Reinvent als Stargate-Wurmloch** (GPU-Shader): verdrillte Plasma-/Blitz-Wände, vorwärts streifende Lichter, gelegentlicher Weißblitz; Farb-/Form-Seed zufällig pro Lauf. |
| **StarfieldScene** | down | „Lock"-Rechteck sinnlos; echte Raumschiff-Verfolgung: sichtbares Schiff verfolgen → verschwindet im Hyperraum → 3-s-Countdown → Hyperraumflug → raus → Schiff finden → wieder verfolgen | Vorhandene Warp-Phasen (normal/warpin/hyperspace/warpout existieren bereits!) ausbauen: **gerendertes verfolgtes Schiff** (kleines Wireframe/Sprite) + Lock auf dieses statt leeres Rechteck; Phasen-Statemachine wie beschrieben. M–L. |

DotCloud → siehe Cluster 2 (Reinvent).

---

## Cluster 5 — Prozedural-GLSL (Farbe, über A)

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **TixyPanel** | down | Panel **voll füllen** (jedes Seitenverhältnis); Farben ab und zu wechseln (nicht immer grün/pink); Muster super | Canvas auf Container-Größe statt forciert quadratisch (TixyPanel:63); Grid-Zellen an Aspect anpassen; Palette-System A für Farbwechsel. |
| **IQSmoothMin** | down | Sehr gut, aber andere Farben; Glow super; Neon bevorzugen | Grün-Lines (IQTechnique:28,33) → Palette A (Neon, randomisiert). Glow behalten. S. |
| **IQDigitalStorm** | down | Palette öde, weg vom Grün, zufällig wechseln, mehr Kontrast | Grün (IQTechnique:93) → Palette A mit Zeit-Shift + Kontrast-Boost. S. |
| **LovebyteShowcase** | down | Muster gut; Farben wechseln, kein Grün; **läuft eine Weile, dann schwarz und bleibt schwarz — fixen** | Palette A; **Black-Screen-Bug untersuchen**: jede der rotierenden Formeln (alle 30 s) auf Dauer-Schwarz-Ausgabe prüfen; Panel darf nie permanent schwarz werden. S–M. |
| **ShaderHackingCore** | down | Mittiger Strahl sinnlos; wenn wie **Mass-Effect-Hacking-Spiel** mit Hackversuchen → interessant | **Reinvent als ME-Hacking-Minispiel-Optik** (Bernstein/Amber + Holo-Blau, KEIN Grün): wahlweise ME1-Decryption-Ringe, ME2-Bypass-Circuit oder ME2-„Frogger"-Code-Match — als endlos „spielende" Fake-Sequenz. M–L. |
| **ShaderRetroWave** | down | Screenshot-Vorgabe verfehlt; Sonne ok, aber **echtes komplexes Voxel-Terrain am Boden** + dünne scharfe zum Horizont verjüngende Linien; schwebende Pixel + dicke Segmente + blöde Boden-Animation raus | **Reinvent als sauberes Synthwave/Outrun:** Sonne mit Scanline-Gaps behalten/verbessern; schwebende Sky-Pixel (Shadertoy:224–230) + Boden-Scanline-Anim (243–246) entfernen; echtes Terrain-Raymarch am Boden + scharfes 1px-Perspektivgitter mit korrektem Fluchtpunkt; Palette Magenta→Cyan-Verlauf. **Screenshot-Vorgabe re-anfordern (siehe §J).** L. |

---

## Cluster 6 — Fotorealismus (über C + F)

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **GlobePanel** | down | Völlig falsch; Kontinente falsch, Nachtlichter ein Matschfleck; geografisch/wissenschaftlich korrekte, fotorealistische Erde; selbst testen | **Echte Geometrie:** winzige `ne_110m`-Landmaske (G) statt Kreis-Arcs (GlobePanel:180–230); Tag-/Nachtschattierung mit Terminator; Nachtlichter prozedural an Küsten/Megacity-Cluster (Verteilung aus Recherche) statt Blur-Blob; Atmosphären-Rim. **Verifikation F gegen Blue/Black Marble.** L. |
| **MoonPanel** | down | Nur Kugel mit komischen Kreisen; fotorealistisch **prozedural** (keine großen Texturen); intensiv gegen echte Mondfotos testen, erst bei hoher Ähnlichkeit „fertig" | Krater-Modell überarbeiten: Rim/Bowl/Zentralberg/Ejekta-Rays statt 3-Kreis-Halos (MoonPanel:158–199); benannte Maria an korrekten Positionen (Recherche); Tycho/Copernicus/Kepler-Rays; **Oren-Nayar/Lommel-Seeliger-Shading** + Terminator + Limb-Darkening. Zero Textur. **Verifikation F gegen LROC.** L. |
| **NuclearExplosion** | down | Realistischer Atompilz; prozedural aber fotorealistisch; Web-Fotos zum Vergleich; sonst aufgeben & melden | **Volumetrischer Raymarch (C):** Feuerball→Stem→toroidaler Cap, Wilson-Cloud, Staubkranz, Temperatur→Blackbody-Emission. Verifikation F gegen Trinity/Baker. Falls 60 fps/Qualität nicht erreichbar → ehrlich melden statt halbgar (Speed-first). L. |
| **ThermonuclearWar** | down | Müll; gedacht war **flache Weltkarte + realistische Atomkriegsimulation**, keine Hacker-Optik | **Reinvent:** flache Equirect-Weltkarte (G, sauber, entsättigt — kein Neon), Great-Circle-Raketenbögen, Detonations-Blooms, Ziel-Reticles (WarGames/DEFCON-Ästhetik). Heute 727 Zeilen N-Amerika-Crop → deutlich verschlanken. L. |
| **Supervolcano** | down | Bleibt schwarz; früher auch Mist — **neu erfinden** | **Black-Screen-Ursache prüfen** (evtl. WebGL-Context-Limit `MAX_GL_CONTEXTS=8`/Eviction oder Render-Pfad). Reinvent als Eruptionssäule über Volumetrik-Baustein C (Säule→Schirmwolke→Ascheregen→Caldera-Glühen). L. |

---

## Cluster 7 — Vektor/Retro

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **ElitePanel** | down | Sinnhaftigkeit hinterfragen; soll wie **Elite 1984** (oder upscaled) aussehen, nicht endlos rotierendes Schiff + durchclippendes rotes Objekt + Fake-Zahlen; **weiße** Wireframe statt grün; keine Hacker-Optik; nicht wie Starfield-Kopie | **Authentisch nachbauen** (Recherche bbcelite): Split-Screen (weiße HiRes-Wireframe-Raumansicht oben, 4-Farben-Dashboard unten); **weiße** Wireframe mit Hidden-Line-Removal; echter **3D-Ellipsen-Scanner mit Höhen-Stalks**; HUD-Balken (FS/AS/FU/Laser-Temp/Speed/Energy-Banks), Missile-Pips, Dot-Kompass. Schiffe nicht ziellos rotieren lassen — kohärente Mini-Dogfight-Logik. L. |
| **CADRobotPanel** | down | Roboter wirken kindisch; komplett neue 3D-Modelle besorgen oder neu erfinden | **Prozedurale Mech-Generierung** (Kitbash aus Primitiven + Greebles, parametrische Gliedmaßen, gespiegelte Symmetrie) als Wireframe/EdgesGeometry — kleinster Footprint, Hard-Sci-Fi-CAD-Look. Fallback: 1–2 CC0-GLBs (Quaternius/Kenney ~50 KB). Heute 999 Zeilen handgemachte Modelle. L. |
| **RetroErrorPanel** | down | Mehr ikonische Absturzmeldungen; bildgrößen-optimiert oder **prozedural** nachgebaut; **fehlen: macOS Kernel Panics, Linux Boot-Abbrüche**; automatischer Test der Nähe am Original | Bereits **vollständig prozedural** (10 Screens, keine Bilder — gut!). Ergänzen: macOS „You need to restart" Grey-Curtain-Panic, moderner Linux Kernel-Panic-Trace, **systemd/Boot-Abbruch**, ggf. Win11-BSOD (schwarz/QR). **Playwright-Nähe-Test (F)** gegen Referenzbilder. M. |
| **RadarSweepPanel** | down | Mehr wie **Battlestar-Galactica-DRADIS**; Referenz-Icons verlinkt | **Umbau auf DRADIS-Optik** (Recherche): KEIN rotierender Sweep — statische klassifizierte Glyphen (Friendly grün-organisch, Hostile rot-Crosshair-Ring, Unknown), Phosphor-Grün/Rot auf Blau-Schwarz, Range-Rings, CRT-Scanlines, condensed-Caps-Labels. Hier ist Grün/Phosphor **authentisch korrekt** (Ausnahme von „weg vom Grün"). M–L. |
| **LidarScanPanel** | down | Eigentlich gut; Kamera auch **über** dem Netz; Szene gelegentlich neu anordnen | Kamera-Y (LidarScan:70) variabel machen, Orbit auch von oben; periodisches Re-Arrangieren der Mesh-/Sweep-Anordnung für Varianz. S–M. |

---

## Cluster 8 — Daten/Audio

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **DNAHelix** | down | Helix nach links, rechts einblenden welche Spezies; reale DNA von Mensch/Hund/Schwein/Insekt/Wal/Mikrobe zufällig durchgehen; Web-Daten; Info-Bereich rechts mit Statistiken (Gene, Chromosomen, Anzahl Individuen…) | Layout: Helix links, **Info-Panel rechts** (Hard-Sci-Fi, kein Grün-Default). Spezies-Zyklus mit **realen Stats** (Tabelle liegt vor: Genomgröße, Chromosomen 2n, Gene, Population, Sci-Fi-Fakt). Reale kurze Basensequenz-Motive optional aus NCBI. M–L. |
| **SolarSystemPanel** | down | Info-Tafeln schöner: **Hard-Sci-Fi futuristisch elegant, hochinformativ; kein ALLCAPS, kein Monospace, Schrift nicht viel kleiner**; **alle Monde** + auf diese zoomen; spannendste weitere Objekte | Info-Tafel-Redesign (proportionale Sci-Fi-Schrift, kein Grün-Hacker, mehr Fakten — Tabelle liegt vor: Durchmesser/Masse/Gravitation/Tag/Temp/Atmosphäre). **Monde rendern + anzoomen** (Featured-Monde mit Fakten: Io/Europa/Ganymed/Titan/Enceladus/Triton/Phobos…). Plus Zwergplaneten + Asteroiden-/Kuiper-Gürtel + Voyager. „Alle Monde" (Saturn 146+) wäre zu viel zum Einzeln-Zoomen → **kuratierte Auswahl** der spannendsten (siehe §J). L. |
| **OscilloscopePanel** | down | Langweilig ohne Musik (sieht aus wie Visualizer); **Umbau zum C64-Chiptune-Player** mit Visualizer; SID-Player bauen; viel Arbeit, trotzdem | **Größter Audio-Task.** SID-Emulator (jsSID ~14 KB pure JS, in AudioWorklet portiert → Float32-PCM) + Visualizer aus diesem Panel (AnalyserNode + optional 3-Stimmen-Register für authentische C64-Bars). Audio-Exklusivität über vorhandenes `audio-focus.ts`/`isAudioPlaying()` integrieren. **Tune-Lizenz offen (§J).** XL → Teilschritte: (1) jsSID-Worklet + Eigenkomposition/Test-Tune, (2) Visualizer-Anbindung, (3) UI/Track-Wechsel/Audio-Fokus. |

---

## Cluster 9 — Single-Theme-Reinvent

| Panel | Rating | Auftrag (verkürzt) | Plan |
|---|---|---|---|
| **ParallaxPanel** | down | Grün/Hacker weg; die 4 Szenen (City/Rain/Station/Tunnel) sind disjunkt & halbgar; **ein Thema pro Panel**, eine sehr gut ausgearbeitete Idee statt Sammelsurium | **Auf eine Szene reduzieren** und exzellent ausarbeiten (Kandidaten: Neon-Regen-Stadt **oder** Raumstation-Orbit), keine Hacker-Optik, Palette A. Die 846 Zeilen drastisch verschlanken. L. |
| **DaggerfallPanel** | down | Nicht so nah an Wände bei Abbiegungen; Hacker-Optik hier ausnahmsweise ok, aber schöner/cooler machen | (Aktuell archiviert/nicht im Pool laut AGENTS, aber im Review bewertet.) DDA-Raycaster: Kollisions-/Abbiege-Abstand erhöhen; Wand-Shading/Texturierung aufwerten. **Priorität niedrig** (archiviert) — am Ende, falls Zeit. M. |

---

## H. Phasen / Reihenfolge

Speed-first: jede Phase liefert lauffähige, in sich geschlossene Ergebnisse.

**Phase 1 — Infrastruktur (schaltet viele Panels frei):**
1. A: Palette-System + ShaderPanel-Uniforms (M)
2. B: FractalGL-Props (M) → **Cluster 1 komplett erledigt** (M)
3. F: Verifikations-Harness (M)

**Phase 2 — Hohe Wirkung / Nutzer-Begeisterung:**
4. E: DE-Fraktal-Familie, 2–3 Geschwister (★) + Reinvent VoxelMatrix/NeuralLink/DotCloud (L–XL, in Teilschritten)
5. Cluster 5 Farb-Umstellungen (IQSmoothMin/IQDigitalStorm/Tixy/Lovebyte) — schnelle Erfolge dank A (S je)

**Phase 3 — Engines:**
6. D: Voxel-Engine-Fix → Thermal/DemoColor/Lava/Neon/BW (L + S–M je)
7. C: Volumetrik-Baustein → Nuclear/Supervolcano (L + M je)

**Phase 4 — Reinvents & Daten:**
8. Tunnel (Stargate), Metaballs (GPU+Split), Rotozoom (Trampolin), Lissajous, Starfield (Schiff-Chase)
9. Globe, Moon (Fotorealismus + F)
10. ThermonuclearWar, ParallaxPanel (Reinvent)
11. Elite, CADRobot, RetroError, Radar (DRADIS), Lidar
12. DNAHelix, SolarSystem
13. ShaderHackingCore (ME), ShaderRetroWave (Synthwave)

**Phase 5 — Groß/Audio:**
14. OscilloscopePanel SID-Player (XL, Teilschritte)
15. DaggerfallPanel (falls Zeit)

Abarbeitung „mit weniger Thinking" wie gewünscht — der Plan trägt die Denkarbeit, die
Umsetzung folgt den hier festgelegten Entscheidungen.

---

## J. Offene Entscheidungen (brauche dein Go / deine Wahl)

1. **SID-Tunes (Oscilloscope):** HVSC-Tunes sind **copyrighted**, nicht frei ausgelieferbar.
   Optionen: (a) **eigene** SID-Tune komponieren/erzeugen (sauber, frei), (b) Nutzer lädt
   `.sid` zur Laufzeit selbst, (c) Komponisten-Erlaubnis einholen. **Empfehlung: (a)** für die
   ausgelieferte Demo. → deine Wahl.
2. **ShaderRetroWave-Screenshot:** Du erwähnst einen hochgeladenen Soll-Screenshot — der liegt
   mir in dieser Session nicht vor. Bitte erneut teilen, sonst baue ich nach kanonischer
   Synthwave/Outrun-Referenz (Recherche liegt vor).
3. **SolarSystem „alle Monde":** Saturn hat 146+ (2024) bzw. 285 (2026) Monde — einzeln
   anzoomen ist unrealistisch viel. **Empfehlung: kuratierte ~12 spannendste Monde** mit
   Fakten + Gesamtzahl-Anzeige je Planet. → ok so?
4. **SID-Emulator-Wahl:** jsSID (~14 KB, klein, aber keine Digi-/Komplex-Tunes) vs. Wothke
   WebSID (WASM, akkurater, LGPL, größer). **Empfehlung: jsSID** wegen fr-08-Größenphilosophie.
   → ok?
5. **VoxelDemoBW-Reinvent-Richtung:** monochromer eleganter Über-Kopf-Flug vs. zweites
   DE-Fraktal. **Empfehlung: Über-Kopf-Flug** (hält Voxel-Vielfalt). → deine Präferenz?
6. **Mond/Atompilz „aufgeben"-Schwelle:** Falls Fotorealismus prozedural in einer Session
   nicht überzeugend + 60 fps erreichbar ist, melde ich das ehrlich statt halbgar
   auszuliefern (Speed-first). → einverstanden?

---

## K. Nicht anfassen / als Referenz

- **ShaderMandelbox** ist die Stil-Referenz für Cluster 2.
- **FractalSeahorse/Tendril/Lightning/Dendrite, FractalJulia** dienen als Farb-/Timing-Referenz
  für die down-bewerteten Fraktale.
- **DemoScenes-Warp-Phasen** (Starfield) und **makeScene-Factory** bleiben als Infrastruktur.
- AmiModPanel, ThreeBodyScene, FireScene, AllYourBase, ICQChatPanel: unberührt.
