# FraktalLab — Projektdokumentation

Universelle Referenz für alle Coding-Agents und KI-Modelle.
Agent-spezifische Einstellungen und Build-Befehle stehen in `DEV_GUIDE.md`.

---

## Projektcharakter & Entwicklungsphilosophie

FraktalLab ist ein humorvolles technisches Showcase — kein klassisches Produkt mit Abnahmekriterien.
Das Motto: *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Thematischer Rahmen: Ein fiktives „Neural Intrusion Dashboard", das Hacker-Klischees aus Kinofilmen persifliert und dabei echte beeindruckende Web-Technologien zeigt (WebAssembly, Canvas-Demoscene-Effekte usw.).

**Speed-first-Regel:** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können. Features, die das nicht schaffen, werden auf kleineres Scope reduziert oder verschoben. Keine halbfertigen Implementierungen.

Aktueller Stand: **v1.0.0**. Deployment auf Netcup-Webspace (Apache).

---

## Tech-Stack

```
Frontend:     React 19, Vite 8, TypeScript 6, Tailwind CSS v4
WASM-Modul:   Rust + wasm-pack  (wasm32-unknown-unknown)  →  wasm/pkg/
Prod-Server:  Apache (Netcup) via frontend/public/.htaccess
Dev-Server:   Vite (setzt COOP/COEP-Header via vite.config.ts)
Testing:      Playwright (@playwright/test) — visueller Panel-Check
```

---

## Repo-Struktur

```
wasm/                       Rust-Crate (cdylib). Build-Output: wasm/pkg/
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
  public/
    .htaccess               COOP/COEP-Header + SPA-Routing für Apache
    enhance/                Bilder für Enhance-Panel (street-0…5.jpg)
server/                     Express Prod-Server (wird auf Netcup nicht genutzt)
```

---

## Architektur-Kernpunkte

**WASM ↔ React-Grenze:** `wasm/src/lib.rs` rendert Fraktale in `Vec<u8>`-Pixel-Buffer (RGBA, row-major). Exportiert: `render()` (Mandelbrot) und `render_julia()` (Julia-Menge). JS überträgt den Buffer via `ImageData` auf `<canvas>`.

**HTTP-Header (kritisch):** Vite-Dev-Server und `.htaccess` setzen `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Ohne diese Header verweigern Chrome und Safari den WASM-Load.

**Tailwind v4:** Via `@tailwindcss/vite`-Plugin, kein `tailwind.config.js`. CSS-Einstiegspunkt: `frontend/src/index.css` mit `@import "tailwindcss"`.

**Ästhetik:** Grüne Monospace-Schrift auf Schwarz (`text-green-400 bg-black font-mono`). Kein helles Theme.

**Mobile:** Unter 768px (`md:`-Breakpoint) wird ein vereinfachtes Single-Column-Layout mit 3 gestapelten PanelSlots gezeigt. Desktop-Layout und GlitchOverlay sind auf Mobile ausgeblendet.

**TypeScript Closure-Narrowing:** Canvas-Panels müssen nach dem Null-Check `const canvas: HTMLCanvasElement = _canvas` und `const ctx: CanvasRenderingContext2D = _ctx` verwenden, da TypeScript Assertions (`!`) in Closures nicht durchträgt.

**IntersectionObserver:** Die meisten Canvas-Panels beobachten ihren Container und pausieren den rAF-Loop (`if (!isVisible) { rafId = rAF(loop); return }`), wenn sie unsichtbar sind (z.B. während Layout-Übergängen).

**Web Audio API (iOS / Safari-Kompatibilität):**
- **Keine Eager-Initialisierung:** Der `AudioContext` darf keinesfalls während des Seitenaufbaus (z. B. beim Laden von Modulen oder direkt beim Mounten von Komponenten wie `AmiModPanel` via `useEffect`) instanziiert werden. Ein Erstellen oder Verbinden von Nodes außerhalb eines direkten Benutzer-Gesten-Callstacks (Click, Touch, Keydown) führt auf iOS/WebKit zu einer permanenten Stummschaltung.
- **Hardware-Stummschalter (Silent Switch) umgehen:** Damit Web Audio trotz aktiviertem physischen Lautlos-Schalter am iPhone hörbar ist, muss beim Initialisieren des `AudioContext` die Audio-Session-Kategorie auf `'playback'` gesetzt werden: `(navigator as any).audioSession.type = 'playback'`.
- **Gesten-gebundener Unlock:** Audio-Graphen (GainNode, AudioWorkletNode, etc.) und `.resume()` des shared `AudioContext` müssen verzögert (lazy) erst gestartet werden, wenn eine Benutzerinteraktion (z. B. Klick auf den AUDIO-Toggle oder den Play-Button) stattfindet.

---

## Panel-Inventar

### Fraktal-Panels (WASM-basiert)

| Datei | Inhalt |
|---|---|
| `components/FractalCanvas.tsx` | Mandelbrot, animierter Zoom durch 8 Koordinaten |
| `panels/FractalJulia.tsx` | Julia-Menge, 6 Parameter-Paare, 12s-Zyklus, WASM `render_julia()` |
| `panels/FractalScenes.tsx` | 7 aktive Mini-Panels: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalSatellite`, `FractalTendril` (+ `FractalDendrite`, `FractalSwirl` archiviert) |

### Text-Panels (Hacker-Themen)

`SystemLog`, `DataStream`, `SocialEngineering`, `Vitals`, `TrafficMonitor`, `NuclearTargets`, `PwdCracker`, `PortScanner`, `PseudoCode`, `AgentCodePanel`, `VisitorProfilePanel`, `ICQChatPanel`, `BitcoinMinerPanel`, `DiskCleanupPanel`, `StockTickerPanel`, `SatellitePanel`, `ClassifiedPanel`

### Grafik-Panels (Canvas-Animationen)

| Datei | Inhalt |
|---|---|
| `VoxelDemo.tsx` | Voxel-Terrain-Flug (Software-Renderer) |
| `VoxelScenes.tsx` | 4 Varianten: `VoxelThermal` (IR-Palette, Seitwärts-Drift), `VoxelNeon` (TRON-Grid, Türme), `VoxelLava` (zerklüftete Heightmap, Glühkanal-Boost), `VoxelMatrix` (Phosphor-Bloom, CRT-Scanlines) |
| `PlasmaDemo.tsx` | Plasma-Effekt, 4 dunkle Paletten (Nebula/Infrared/Acidic/Void), 20s-Crossfade |
| `GlobePanel.tsx` | Rotierender Globus mit Kontinent-Umrissen (24 Land-Polygone) + Ziel-Bracket |
| `DNAHelix.tsx` | Animierte DNA-Doppelhelix |
| `OscilloscopePanel.tsx` | 7 Signalmodi: EKG, Seismik, FM, Interferenz, Lissajous/Spiral, Sonar + weiterer |
| `DemoScenes.tsx` | 8 Demoscene-Klassiker: `FireScene` (Plasmatrahlen+chem. Brand), `StarfieldScene` (3× mehr Sterne + Hyperspace), `TunnelScene` (1 Layer, grün/cyan, ruhig), `RotozoomScene`, `MetaballsScene` (1px, fein), `DotCloudScene` (Neural-Net mit Kanten), `BoingScene` (3D-Rotation alle Achsen), `LissajousScene` |
| `ParallaxPanel.tsx` | Multi-Szenen-Parallax: Raumstadt + Neon-Regen + Raumstation + Tunnel |
| `ElitePanel.tsx` | Wireframe-Raumschiff (Cobra Mk III), Radar, HUD — Elite-1984-Stil |
| `CADRobotPanel.tsx` | Wireframe- und Solid-3D-Roboter (wechselnd), 4 Modelle, näher herangezoomt |
| `AmiModPanel.tsx` | Synthetischer ProTracker-Chiptune, 4-Kanal WebAudio |
| `C64Panel.tsx` | C64-Boot + Tipp-Sequenz + 4 Demo-Szenen (4:3, Rand nur im BASIC-Screen) |
| `RetroErrorPanel.tsx` | Slideshow retro OS-Fehlermeldungen (Mac Bomb, BSOD, Amiga Guru etc.) |
| `SolarSystemPanel.tsx` | Sonnensystem-Animation, 8 Planeten + Mond + Saturn-Ring, korrekte Umlaufzeiten |
| `RadarSweepPanel.tsx` | Rotating Radar, Sweep-Linie, Blips mit Fade, bewegliche Ziele, grüner Phosphor |
| `DaggerfallPanel.tsx` | **ARCHIVIERT** — Castle Pixelstein Alpha 0.1, DDA-Raycasting (nicht im Pool) |

### Spezial-Panels

| Datei | Inhalt |
|---|---|
| `AllYourBase.tsx` | Video von archive.org |
| `EnhanceView.tsx` | „ENHANCE PHOTO"-Slideshow, 12 Stufen, 4s, nur urbane Stadtfotos |

### Pool-Zuordnung (`App.tsx`)

```
POOL_TEXT       SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
                NuclearTargets, PwdCracker, PortScanner, PseudoCode,
                AgentCodePanel, VisitorProfilePanel, ICQChatPanel,
                BitcoinMinerPanel, DiskCleanupPanel,
                StockTickerPanel, SatellitePanel, ClassifiedPanel

POOL_GFX        VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,
                FireScene, StarfieldScene, BoingScene, LissajousScene,
                OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
                PlasmaDemo, DNAHelix, EnhanceView, AllYourBase,
                ParallaxPanel, ElitePanel, AmiModPanel,
                CADRobotPanel, C64Panel, RetroErrorPanel,
                SolarSystemPanel, RadarSweepPanel, FractalJulia,
                FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
                FractalElephant, FractalMini, FractalSatellite
```

---

## Layout-System

`App.tsx` definiert 3 fest codierte Layouts (`layoutIdx 0..2`).
Auto-Switch alle 1–3 Minuten mit Slide-Animation (OS-Desktop-Stil, 520ms).
Desktop: `[LAYOUT x/3]`-Button + Leertaste. Mobile: ausgeblendet.

---

## Bekannte Bugs

| ID | Problem | Priorität |
|---|---|---|
| ~~BUG-01~~ | ~~AllYourBase CORS~~ | ~~Hoch~~ — **behoben** |
| ~~BUG-02~~ | ~~Panels pausieren nicht wenn unsichtbar~~ | ~~Mittel~~ — **behoben** (IntersectionObserver) |
| BUG-03 | Mehrere Canvas-Animationen können auf schwächerer Hardware frame-droppen | Mittel |

---

## Roadmap

1. **AmiModPanel** — echte .mod-Dateien abspielen (benötigt MOD-Parser oder libopenmpt-WASM).
   Kuratierte Tracks auf modarchive.org:
   - `modarchive.org/index.php?request=view_player&query=142827`
   - `modarchive.org/index.php?request=view_player&query=58072`
   - `modarchive.org/index.php?request=view_player&query=164194`
   - `modarchive.org/index.php?request=view_player&query=138950`
   - `modarchive.org/index.php?request=view_player&query=87180`
2. **Fraktal-Endloszoom** — statt Fade+Reset nahtlosen Endloszoom implementieren (kein schwarzes Bild je)
3. **Grid-Überarbeitung (GRID-01)** — vollständig zufälliger Grid-Generator statt fixer Layouts
4. **Archivierte Panels** — DaggerfallPanel, FractalDendrite, FractalSwirl bei Gelegenheit überarbeiten

---

## Offene Todos (Eval v0.9.9)

Basis: manueller Durchlauf aller Panels am 2026-05-21. Daumen rauf/runter = erster Eindruck, kein Löschauftrag.
**Löschen nur wenn Kommentar es explizit anordnet.**

### Schnell (kleine Änderungen)

- [x] **AgentCodePanel** — Text anpassen: jemand schreibt genau diese Seite (FraktalLab), nicht irgendein Projekt
- [ ] **ICQChatPanel** — Erste 3 Nachrichten beschleunigen, danach normales Tempo
- [ ] **PlasmaDemo** — Szenen auf 10s; kontinuierlicher Farbwechsel
- [ ] **VisitorProfilePanel** — 10s warten nach Durchlauf, dann Panel-Wechsel
- [ ] **SatellitePanel** — Mehr Bewegung ODER 10s Timeout dann Panel-Wechsel
- [ ] **FractalJulia** — Flimmern reduzieren
- [ ] **EnhanceView** — „Apollo"-Text fixen; anstößige/politische Bilder entfernen → nur neutrale Stadtszenen
- [ ] **Fractal-Panels** — Alle Fraktal-Panels (außer FractalView / "Neural Fractal Dimension" und FractalJulia) sehen scheiße aus; diese wurden vorübergehend in POOL_GFX deaktiviert und müssen grundlegend verbessert werden. FractalView fehlt zudem im Review-Modus (ALL_PANELS) und sollte dort integriert werden.


### Mittel

- [ ] **SolarSystemPanel** — Infotafel größer + mittig; realistische Startpositionen; Umlaufbahnen einzeichnen; Planetenbeschriftung größer + weiß (nicht eingefärbt)
- [ ] **DNAHelix** — Grau-Kugel-Artefakt an der Vorderseite (wo Kreise groß sind) fixen
- [ ] **TunnelScene** — Grobpixeligkeit reduzieren, besonders in der Mitte
- [ ] **RotozoomScene** — Kantenglättung; generell bei pixeligen Panels anwenden
- [ ] **BitcoinMinerPanel** — Hashing-Animation auf Textbasis hinzufügen
- [ ] **FireScene** — Echte Feuersimulation statt blaue vertikale Linien
- [ ] **LissajousScene** — Komplett neu: Spirale zeichnet sich auf und rückwärts, schnell, wechselnde Farben
- [ ] **BoingScene** — Langsamer; variable Geschwindigkeit (zufällig ändernd); +1 Ball alle 10s bis max. 5; Kollision mit korrektem Abstoßen
- [ ] **VoxelThermal** — Weniger grob, weniger Schwarz
- [ ] **VoxelNeon** — Mehr Formvielfalt: Häuser-Silhouetten, verschiedene Breiten und Höhen

### Hoch (komplex)

- [ ] **StarfieldScene** — Hyperspace nach 8s: Sterne → Linien → Hyperspace 10s → Verlangsamung → Sterne; HUD mit Geschwindigkeit + Hyperspace-Modus
- [ ] **GlobePanel** — Korrekte Landmassen-Polygone mit deutlich mehr Punkten; aktuell fehlen Vektorpunkte → falsche Formen
- [ ] **VoxelDemo** — Zwei separate Panels: Farb-Linien-Variante + S/W-Gelände-Variante
- [ ] **VoxelLava** — Weniger erratisch; eher statische Szene mit blubbernder Lava
- [ ] **VoxelMatrix** — Komplett neu entwerfen — eigene Identität, nicht nur „grüne Voxel"
- [ ] **OscilloscopePanel** — Neuer Versuch oder löschen (Nutzer: „Müll")
- [ ] **C64Panel** — Startbildschirm-Proportionen fixen (Referenz: `https://c64os.com/c64os/afterlifeguide/part_ii`); Sprite FX als eigenes Panel auslagern
- [ ] **ParallaxPanel** — Szenen in separate Panels aufteilen; Raumschiff-Szene verbessern; grüne-Balken-Szene rechten Bereich fixen; Metro-Tunnel überarbeiten oder löschen
- [ ] **ElitePanel** — Radar nur echte Objekte zeigen; Cash-Counter entfernen; ODER Cockpit-Ansicht; ODER anderweitig aufwerten ohne offensichtlich falsche Details
- [ ] **CADRobotPanel** — Komplexere 3D-Modelle, kein Wireframe; CAD-Stil mit gefüllten Flächen + HUD
- [ ] **Fraktal-Panels (alle)** — Höhere Auflösung, längere Zooms ohne Reset, mehr Varianz. Priorität: FractalLightning > FractalSatellite > FractalElephant > FractalMini > FractalSpiral > FractalTendril > FractalSeahorse

### Zurückgestellt

- → **AmiModPanel** echte .mod-Dateien: Aufwand hoch (MOD-Parser oder libopenmpt-WASM benötigt) — Tracks siehe Roadmap oben
- → **EnhanceView** Live-Webcams: CORS/CSP-Problem mit externen Streams; unklar ob ohne Backend realisierbar
