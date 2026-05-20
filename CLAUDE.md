# CLAUDE.md

This file is the primary reference for Claude Code when working in this repository.
It replaces the former `PRD_FraktalViewer.md` and the separate `AGENTS.md`.

---

## Projektcharakter & Entwicklungsphilosophie

FraktalLab ist ein humorvolles technisches Showcase — kein klassisches Produkt mit Abnahmekriterien.
Das Motto: *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Thematischer Rahmen: Ein fiktives „Neural Intrusion Dashboard", das Hacker-Klischees aus Kinofilmen persifliert und dabei echte beeindruckende Web-Technologien zeigt (WebAssembly, Canvas-Demoscene-Effekte usw.).

**Speed-first-Regel:** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können. Features, die das nicht schaffen, werden auf kleineres Scope reduziert oder verschoben. Keine halbfertigen Implementierungen.

Aktueller Stand: **v0.9.6**. Deployment auf Netcup-Webspace (Apache).

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
    App.tsx                 Grid-Layout-System, Pool-Definitionen, Layout-Wechsel-Logik
    components/
      FractalCanvas.tsx     WASM-Loader + rAF-Loop (Mandelbrot, 8 Koordinaten, Fade)
      EnhancePhoto.tsx      Enhance-Slideshow
    panels/                 Alle Panel-Komponenten (je eine Datei, siehe Inventar unten)
    ui/
      PanelSlot.tsx         Pool-basierter Slot: zufällige Rotation (45s–8min) + ⟳-Button
      GlitchOverlay.tsx     Vollbild-CRT/VHS-Glitch (alle 20–60 s)
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
# WASM bauen
source "$HOME/.cargo/env"
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

**WASM ↔ React-Grenze:** `wasm/src/lib.rs` rendert Fraktale in einen `Vec<u8>`-Pixel-Buffer (RGBA, row-major). JS überträgt ihn via `ImageData` auf `<canvas>`. Keine Fraktal-Berechnung im React-Code.

**HTTP-Header (kritisch):** Vite-Dev-Server und `.htaccess` setzen `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Ohne diese Header verweigern Chrome und Safari den WASM-Load.

**Tailwind v4:** Via `@tailwindcss/vite`-Plugin, kein `tailwind.config.js`. CSS-Einstiegspunkt: `frontend/src/index.css` mit `@import "tailwindcss"`.

**Ästhetik:** Grüne Monospace-Schrift auf Schwarz (`text-green-400 bg-black font-mono`). Kein helles Theme, kein responsives Redesign angestrebt.

---

## Panel-Inventar

### Fraktal (fest eingebunden über `FractalView`)

| Datei | Inhalt |
|---|---|
| `components/FractalCanvas.tsx` | WASM-Mandelbrot, animierter Zoom durch 8 Koordinaten |
| `panels/FractalScenes.tsx` | 9 Mini-Panels: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalDendrite`, `FractalSwirl`, `FractalSatellite`, `FractalTendril` |

### Text-Panels (Hacker-Themen)

`SystemLog`, `DataStream`, `SocialEngineering`, `Vitals`, `TrafficMonitor`, `NuclearTargets`, `PwdCracker`, `PortScanner`, `PseudoCode`

**Neue Text-Panels (v0.9.6):**
`ClaudeCodePanel` (Claude Code CLI-Simulation), `VisitorProfilePanel` (Browser-Fingerprint-Terminal), `ICQChatPanel` (AI-Agenten-Chat über Weltherrschaft), `BitcoinMinerPanel` (Fake-Hashrate-Dashboard), `DiskCleanupPanel` (Fake-Disk-Cleanup-Terminal)

### Grafik-Panels (Canvas-Animationen)

| Datei | Inhalt |
|---|---|
| `VoxelDemo.tsx` | Voxel-3D (Software-Renderer) |
| `VoxelScenes.tsx` | 4 Varianten: `VoxelThermal`, `VoxelNeon`, `VoxelLava`, `VoxelMatrix` |
| `PlasmaDemo.tsx` | Plasma-Effekt (sin/cos-Farbfelder) |
| `GlobePanel.tsx` | Rotierender Wireframe-Globus |
| `DNAHelix.tsx` | Animierte DNA-Doppelhelix |
| `OscilloscopePanel.tsx` | 6 Signalmodi: EKG, Seismik, FM, Interferenz, Rauschen, Sonar |
| `DemoScenes.tsx` | 8 Demoscene-Klassiker: `FireScene`, `StarfieldScene`, `TunnelScene`, `RotozoomScene`, `MetaballsScene`, `DotCloudScene`, `BoingScene`, `LissajousScene` |
| `ParallaxPanel.tsx` | 5-Layer-Parallax-Scrolling einer futuristischen Raumstadt |
| `DaggerfallPanel.tsx` | Raycasting-Dungeon-Engine (DDA-Algorithmus), KI-Spieler, DOS-HUD |
| `ElitePanel.tsx` | Wireframe-Raumschiff (Cobra Mk III), Radar, HUD — Elite-1984-Stil |

### Spezial-Panels

| Datei | Inhalt |
|---|---|
| `AllYourBase.tsx` | Video von archive.org — **aktuell defekt (BUG-01, CORS)** |
| `EnhanceView.tsx` | „ENHANCE PHOTO"-Slideshow mit Straßenfotos |

### Layout-Änderungen (v0.9.6)

- **3 statt 5 Layouts** — ~50% weniger Slots pro Layout, deutlich größere Panels
- **POOL_TEXT**: alle Text-Panels in einem gemeinsamen Pool (inkl. 5 neue)
- **POOL_GFX**: alle Grafik-Panels in einem gemeinsamen Pool (inkl. 3 neue)
- **AllYourBase**: immer in 16:9-Container (`aspect-ratio: 16/9` per CSS)
- **GlitchOverlay**: deutlich intensiver (Intervall 5–15s statt 20–60s, mehr Effekte)
- **Ambient Sound**: `AmbientSound.tsx` mit Tipp-Clicks, Pings, CRT-Hum; Toggle in der Kopfzeile

### Pool-Zuordnung (`App.tsx`)

```
POOL_TEXT       SystemLog, DataStream, SocialEngineering, Vitals, TrafficMonitor,
                NuclearTargets, PwdCracker, PortScanner, PseudoCode,
                ClaudeCodePanel, VisitorProfilePanel, ICQChatPanel,
                BitcoinMinerPanel, DiskCleanupPanel

POOL_GFX        VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, VoxelNeon, VoxelMatrix,
                FireScene, StarfieldScene, BoingScene, LissajousScene,
                OscilloscopePanel, TunnelScene, MetaballsScene, RotozoomScene, DotCloudScene,
                PlasmaDemo, DNAHelix, ParallaxPanel, DaggerfallPanel, ElitePanel,
                FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning,
                FractalElephant, FractalMini, FractalDendrite, FractalSwirl, FractalSatellite

POOL_ALLYOURBASE  AllYourBase (dediziert, immer in 16:9-Container)
POOL_ENHANCE      EnhanceView (dediziert)
```

---

## Layout-System

`App.tsx` definiert 5 fest codierte Layouts (`layoutIdx 0..4`).
Der **[LAYOUT x/5]-Button** und die Leertaste schalten mit Fade-Übergang (300 ms) durch.

**Geplante Überarbeitung (GRID-01):** Vollständig zufälliger Grid-Generator statt fixer Layouts.
Anforderungen: kein Leerraum, keine sehr schmalen Slots, Mindestgröße für `AllYourBase`/`EnhanceView`/`GlobePanel`, `FractalView` muss nicht mehr das größte Panel sein.

---

## Bekannte Bugs

| ID | Problem | Priorität |
|---|---|---|
| ~~BUG-01~~ | ~~AllYourBase-Video nicht sichtbar — CORS-Fehler mit archive.org~~ | ~~Hoch~~ — **behoben** (falsche Datei-URL, fehlende COEP-credentialless-Konfiguration) |
| BUG-02 | Einzelne Panels zeigen in sehr kleinen Containern einfarbige Flächen | Mittel |
| BUG-03 | Mehrere gleichzeitige Canvas-Animationen können auf schwächerer Hardware frame-droppen | Mittel |

---

## Roadmap

1. **Bugs & Qualität** — BUG-01, BUG-02, BUG-03 (IntersectionObserver zum Pausieren unsichtbarer Panels)
2. **Grid-Überarbeitung** — GRID-01 (siehe Layout-System oben)
3. **Neue Text-Panels** — Börsenkurse/Ticker, Satelliten-Tracking, Wetterradar, Classified-Dokumente
4. **Neue Grafik-Panels** — Waveform-Visualizer, Radar-Sweep, Thermalkamera, Particle-System
5. **Julia-Menge** — zweiter Fraktal-Typ im WASM-Modul (`wasm/src/lib.rs`)
6. **Audio/Ambient** — WebAudio API, Standard stumm, An/Aus in der Kopfzeile
7. **Mobile** — vereinfachtes Single-Column-Layout für schmale Viewports (nice-to-have)
