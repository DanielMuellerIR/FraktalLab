# CLAUDE.md

This file is the primary reference for Claude Code when working in this repository.
It replaces the former `PRD_FraktalViewer.md` and the separate `AGENTS.md`.

---

## Projektcharakter & Entwicklungsphilosophie

FraktalLab ist ein humorvolles technisches Showcase — kein klassisches Produkt mit Abnahmekriterien.
Das Motto: *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Thematischer Rahmen: Ein fiktives „Neural Intrusion Dashboard", das Hacker-Klischees aus Kinofilmen persifliert und dabei echte beeindruckende Web-Technologien zeigt (WebAssembly, Canvas-Demoscene-Effekte usw.).

**Speed-first-Regel:** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können. Features, die das nicht schaffen, werden auf kleineres Scope reduziert oder verschoben. Keine halbfertigen Implementierungen.

Aktueller Stand: **v0.9.9**. Deployment auf Netcup-Webspace (Apache).

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

## Befehle

```bash
# WASM bauen (nach Änderungen an wasm/src/lib.rs)
source "$HOME/.cargo/env"
cd /Users/dm0/local/Arbeit/Viben/p_fraktal
wasm-pack build wasm --target web --out-dir pkg

# Frontend Dev-Server (COOP/COEP via vite.config.ts)
cd frontend && npm run dev

# Production Build  →  frontend/dist/
cd frontend && npm run build

# Lint
cd frontend && npm run lint

# Visueller Panel-Check (Dev-Server muss laufen)
cd frontend && npm run test:panels
```

---

## Architektur-Kernpunkte

**WASM ↔ React-Grenze:** `wasm/src/lib.rs` rendert Fraktale in `Vec<u8>`-Pixel-Buffer (RGBA, row-major). Exportiert: `render()` (Mandelbrot) und `render_julia()` (Julia-Menge). JS überträgt den Buffer via `ImageData` auf `<canvas>`.

**HTTP-Header (kritisch):** Vite-Dev-Server und `.htaccess` setzen `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Ohne diese Header verweigern Chrome und Safari den WASM-Load.

**Tailwind v4:** Via `@tailwindcss/vite`-Plugin, kein `tailwind.config.js`. CSS-Einstiegspunkt: `frontend/src/index.css` mit `@import "tailwindcss"`.

**Ästhetik:** Grüne Monospace-Schrift auf Schwarz (`text-green-400 bg-black font-mono`). Kein helles Theme.

**Mobile:** Unter 768px (`md:`-Breakpoint) wird ein vereinfachtes Single-Column-Layout mit 3 gestapelten PanelSlots gezeigt. Desktop-Layout und GlitchOverlay sind auf Mobile ausgeblendet.

**TypeScript Closure-Narrowing:** Canvas-Panels müssen nach dem Null-Check `const canvas: HTMLCanvasElement = _canvas` und `const ctx: CanvasRenderingContext2D = _ctx` verwenden, da TypeScript Assertions (`!`) in Closures nicht durchträgt.

**IntersectionObserver (BUG-02):** Die meisten Canvas-Panels beobachten ihren Container und pausieren den rAF-Loop (`if (!isVisible) { rafId = rAF(loop); return }`), wenn sie unsichtbar sind (z.B. während Layout-Übergängen).

---

## Panel-Inventar

### Fraktal-Panels (WASM-basiert)

| Datei | Inhalt |
|---|---|
| `components/FractalCanvas.tsx` | Mandelbrot, animierter Zoom durch 8 Koordinaten |
| `panels/FractalJulia.tsx` | Julia-Menge, 6 Parameter-Paare, 12s-Zyklus, WASM `render_julia()` |
| `panels/FractalScenes.tsx` | 7 aktive Mini-Panels: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalSatellite`, `FractalTendril` (+ `FractalDendrite`, `FractalSwirl` archiviert) |

### Text-Panels (Hacker-Themen)

`SystemLog`, `DataStream`, `SocialEngineering`, `Vitals`, `TrafficMonitor`, `NuclearTargets`, `PwdCracker`, `PortScanner`, `PseudoCode`, `ClaudeCodePanel`, `VisitorProfilePanel`, `ICQChatPanel`, `BitcoinMinerPanel`, `DiskCleanupPanel`, `StockTickerPanel`, `SatellitePanel`, `ClassifiedPanel`

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
| `AllYourBase.tsx` | Video von archive.org (BUG-01 behoben) |
| `EnhanceView.tsx` | „ENHANCE PHOTO"-Slideshow, 12 Stufen, 4s, nur urbane Stadtfotos |

### Pool-Zuordnung (`App.tsx`)

```
POOL_TEXT       SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
                NuclearTargets, PwdCracker, PortScanner, PseudoCode,
                ClaudeCodePanel, VisitorProfilePanel, ICQChatPanel,
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

## Roadmap (offen)

1. **AmiModPanel** — echte .mod-Dateien von modarchive.org abspielen (benötigt MOD-Parser oder libopenmpt-WASM)
2. **Fraktal-Endloszoom** — statt Fade+Reset nahtlosen Endloszoom implementieren (kein schwarzes Bild je)
3. **Grid-Überarbeitung (GRID-01)** — vollständig zufälliger Grid-Generator statt fixer Layouts
4. **Archivierte Panels** — DaggerfallPanel, FractalDendrite, FractalSwirl bei Gelegenheit überarbeiten
