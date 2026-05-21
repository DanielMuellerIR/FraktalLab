# AGENTS.md — FraktalLab: Neural Intrusion Dashboard

Dieses Dokument ersetzt das ursprüngliche `PRD_FraktalViewer.md` als primäre Entwicklungsreferenz.  
Es beschreibt den aktuellen Zustand des Projekts, die Architektur, alle vorhandenen Panels und die geplante Roadmap.

---

## 1. Projektcharakter & Vision

FraktalLab ist **kein klassisches Produkt** mit Feature-Spec und Abnahmekriterien.
Es ist ein humorvolles technisches Showcase mit dem Motto:

> *„Wie viele beeindruckende Dinge kann ich einbauen und trotzdem ein schnelles Vibe-Coding-Ergebnis erzielen?"*

Die Webseite spielt auf übertriebene Hacker-Darstellungen in Kinofilmen an — auf der einen Seite absichtlich klischeehaft und humorvoll, auf der anderen Seite mit echten, beeindruckenden Web-Technologien (WebAssembly, Canvas-Demoscene-Effekte, GLSL-ähnliche Software-Renderer etc.).

**Thematischer Rahmen:** „NEURAL INTRUSION DASHBOARD" — eine fiktive Hacker-Zentrale, die gleichzeitig Fraktal-Animationen, Voxel-Grafiken, Oszilloskop-Daten, Passwort-Cracker und das legendäre „All Your Base"-Video anzeigt.

### Entwicklungsphilosophie (wichtig!)

- **Speed first.** Jedes Feature muss in einer einzigen Session vollständig lauffähig implementiert werden können.
- Features, die das nicht schaffen, müssen entweder auf ein kleineres Scope reduziert oder auf später verschoben werden. Keine halbfertigen Implementierungen ins Repo.
- Kein Gold-Plating. Lieber ein Panel, das wirklich cool aussieht, als drei, die nur mittelmäßig sind.
- Dieser Grundsatz gilt auch für Refactorings: nur wenn sie in einer Session abgeschlossen werden können.

---

## 2. Aktueller Zustand (v0.9.4)

### Was funktioniert

- **Hacker-Dashboard-Layout** mit grüner Monospace-Schrift auf schwarzem Hintergrund (Matrix/Terminal-Ästhetik)
- **5 fest definierte Layouts** (werden per Knopf oder Leertaste zyklisch durchgeschaltet, mit Fade-Übergang)
- **WASM-Fraktal-Renderer**: Mandelbrot-Menge, animierter Zoom durch 8 vordefinierte interessante Koordinaten, Fade-Übergang beim Location-Wechsel
- **PanelSlot-System**: Jeder Slot rotiert zufällig durch eine Menge von Panels (45 s – 8 min), manuelle Skip-Schaltfläche (⟳) oben rechts
- **GlitchOverlay**: Vollbild-Canvas-Overlay mit CRT/VHS-Glitch-Effekten (alle 20–60 Sekunden)
- **Deployment auf Netcup** (Apache): `.htaccess` mit COOP/COEP-Headern, `vite.config.ts` mit `base: './'`

### Bekannte Bugs / offene Probleme

| # | Problem | Priorität |
|---|---|---|
| BUG-01 | **AllYourBase-Video wird nicht angezeigt** — archive.org-URL liefert wahrscheinlich CORS-Fehler; Panel zeigt nur den Rahmen | Hoch |
| BUG-02 | Einzelne Panels können in kleinen Panel-Größen Bereiche zeigen, die einfarbig gefüllt sind (kein Inhalt sichtbar) | Mittel |
| BUG-03 | Performance: Mehrere gleichzeitig laufende Canvas-Animationen können auf schwächerer Hardware zu Frame-Drops führen | Mittel |

---

## 3. Tech-Stack

```
Frontend:     React 19, Vite 8, TypeScript 6, Tailwind CSS v4
WASM-Modul:   Rust + wasm-pack  (wasm32-unknown-unknown target)  →  wasm/pkg/
Prod-Server:  Apache (Netcup-Webspace) via .htaccess
Dev-Server:   Vite (setzt COOP/COEP-Header via vite.config.ts)
Testing:      noch nicht eingerichtet
```

**Wichtige Build-Befehle:**

```bash
# WASM bauen
source "$HOME/.cargo/env"
wasm-pack build wasm --target web --out-dir pkg

# Frontend Dev-Server
cd frontend && npm run dev

# Production Build
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

**COOP/COEP-Header sind kritisch** — ohne sie verweigern Chrome und Safari den WASM-Load mit SharedArrayBuffer.

---

## 4. Repo-Struktur

```
wasm/                     Rust-Crate (cdylib). Build-Output: wasm/pkg/
frontend/
  src/
    App.tsx               Grid-Layout-System, Pool-Definitionen, Layout-Wechsel-Logik
    components/
      FractalCanvas.tsx   WASM-Loader + rAF-Loop für Mandelbrot-Animation
      EnhancePhoto.tsx    „ENHANCE"-Slideshow-Komponente
    panels/               Alle Panel-Komponenten (je eine Datei)
    ui/
      PanelSlot.tsx       Pool-basierter Slot mit zufälliger Rotation + Skip-Button
      GlitchOverlay.tsx   Vollbild-CRT/VHS-Glitch-Effekt
      Panel.tsx           Rahmen-Komponente (grüner Border, Titel-Header)
      Clock.tsx           Digitale Uhr
      ScrollingLog.tsx    Scrollender Text (Basis-Komponente für Log-Panels)
      StatBar.tsx         Statusanzeigen-Leiste
  public/
    .htaccess             COOP/COEP + SPA-Routing für Apache
    enhance/              Bilder für das Enhance-Panel (street-0.jpg … street-5.jpg)
    target.jpg
server/                   Express Prod-Server (wird auf Netcup nicht verwendet, war für Vercels)
scripts/                  Hilfsskripte (fetch-images.mjs für Enhance-Bilder)
```

---

## 5. Panel-Inventar

### 5.1 Fraktal (fest, immer sichtbar)

| Datei | Beschreibung |
|---|---|
| `panels/FractalView.tsx` | Wrapper um `FractalCanvas` mit Panel-Rahmen |
| `components/FractalCanvas.tsx` | WASM-Mandelbrot: animierter Zoom durch 8 Koordinaten, Fade-Übergang |
| `panels/FractalScenes.tsx` | 9 Mini-Fraktal-Panels mit festen Ziel-Koordinaten: `FractalSeahorse`, `FractalSpiral`, `FractalLightning`, `FractalElephant`, `FractalMini`, `FractalDendrite`, `FractalSwirl`, `FractalSatellite`, `FractalTendril` |

### 5.2 Text-Panels (Hacker-Themen, scrollend)

| Datei | Inhalt |
|---|---|
| `panels/SystemLog.tsx` | Fake System-Log-Einträge |
| `panels/DataStream.tsx` | Scrollender Datenstrom |
| `panels/SocialEngineering.tsx` | Fake Social-Engineering-Dialoge |
| `panels/Vitals.tsx` | Fake Vitalwerte / Biometrie |
| `panels/TrafficMonitor.tsx` | Fake Netzwerk-Traffic-Anzeige |
| `panels/NuclearTargets.tsx` | Humorvolle „Nuclear Target"-Liste |
| `panels/PwdCracker.tsx` | Animierter Fake-Passwort-Cracker |
| `panels/PortScanner.tsx` | Fake Port-Scanner |
| `panels/PseudoCode.tsx` | Scrollender Pseudo-Code |

### 5.3 Grafik-Panels (Canvas-Animationen)

| Datei | Technik / Inhalt |
|---|---|
| `panels/VoxelDemo.tsx` | Voxel-3D-Szene (Software-Renderer) |
| `panels/VoxelScenes.tsx` | 4 Voxel-Varianten: `VoxelThermal`, `VoxelNeon`, `VoxelLava`, `VoxelMatrix` |
| `panels/PlasmaDemo.tsx` | Plasma-Effekt (sin/cos-Farbfelder) |
| `panels/GlobePanel.tsx` | Rotierender Wireframe-Globus |
| `panels/DNAHelix.tsx` | Animierte DNA-Doppelhelix |
| `panels/OscilloscopePanel.tsx` | 6 Signalmodi: EKG, Seismik, FM, Interferenz, Rauschen, Sonar |
| `panels/DemoScenes.tsx` | 8 Demoscene-Klassiker: `FireScene`, `StarfieldScene`, `TunnelScene`, `RotozoomScene`, `MetaballsScene`, `DotCloudScene`, `BoingScene`, `LissajousScene` |

### 5.4 Spezial-Panels (dediziert, immer vorhanden)

| Datei | Inhalt |
|---|---|
| `panels/AllYourBase.tsx` | Video „All Your Base Are Belong To Us" von archive.org — **aktuell defekt (BUG-01)** |
| `panels/EnhanceView.tsx` | „ENHANCE PHOTO"-Animation mit Straßenfotos, simuliert Bild-Zoom |

### 5.5 Pool-Zuordnung in App.tsx

| Pool | Enthält |
|---|---|
| `POOL_A` | SystemLog, DataStream, SocialEngineering |
| `POOL_B` | Vitals, TrafficMonitor |
| `POOL_D` | NuclearTargets |
| `POOL_E` | PwdCracker |
| `POOL_F` | PortScanner |
| `POOL_G` | PseudoCode |
| `POOL_V1` | VoxelDemo, GlobePanel, VoxelThermal, VoxelLava, FireScene, StarfieldScene, BoingScene, LissajousScene, OscilloscopePanel, FractalSeahorse, FractalSpiral, FractalTendril, FractalLightning, TunnelScene, MetaballsScene |
| `POOL_V2` | VoxelNeon, VoxelMatrix, DNAHelix, PlasmaDemo, RotozoomScene, DotCloudScene, FractalElephant, FractalMini, FractalDendrite, FractalSwirl, FractalSatellite |
| `POOL_ALLYOURBASE` | AllYourBase (dediziert) |
| `POOL_ENHANCE` | EnhanceView (dediziert) |

---

## 6. Layout-System (aktuell / geplant)

### Aktuell

`App.tsx` definiert 5 fest codierte Layouts (JSX-Blöcke, `layoutIdx === 0..4`).  
Der **[LAYOUT x/5]-Button** in der Kopfzeile (und die Leertaste) schalten zyklisch durch diese 5 Layouts mit Fade-Übergang (300 ms).

### Geplant: Vollständig zufälliges Grid (GRID-01)

Das aktuelle System soll durch einen **echten Zufalls-Grid-Generator** ersetzt werden.  
Der Button soll nicht mehr durch fixe Layouts schalten, sondern das gesamte Grid neu und zufällig aufbauen:

**Anforderungen:**
- Kein Panel-Slot soll leer bleiben (kein toter Leerraum im Grid)
- Sehr schmale Panels vermeiden (Mindestbreite sinnvoll setzen)
- Panels sollen sich an ihre Containergröße anpassen können
- Größenempfindliche Panels bekommen eine Mindestgröße: **AllYourBase**, **EnhanceView** und **GlobePanel** sollen nicht in sehr kleinen Slots landen
- `FractalView` (WASM-Haupt-Fraktal) muss nicht mehr zwingend das größte Panel sein

---

## 7. Roadmap

### Priorität 1 — Bugs & Qualität

| ID | Aufgabe |
|---|---|
| BUG-01 | AllYourBase-Video reparieren (CORS-Problem mit archive.org; Fallback oder lokale Kopie) |
| BUG-02 | Alle Panels auf kleine Container-Größen testen; sicherstellen, dass kein Panel eine einfarbige Fläche zeigt |
| BUG-03 | Performance-Check: Canvas-Animationen pausieren, wenn Panel nicht sichtbar ist (IntersectionObserver) |

### Priorität 2 — Grid-System-Überarbeitung (GRID-01)

Beschreibung: siehe Abschnitt 6 oben.  
**Bedingung für Umsetzung:** muss vollständig in einer Session lauffähig sein.

### Priorität 3 — Neue Panels

Neue Panels sollen dem gleichen Schema folgen:
- Eigene Datei in `panels/`
- Nutzt die `Panel`-Wrapper-Komponente aus `ui/Panel.tsx`
- Passt sich flexibel an die Container-Größe an (kein fest codiertes px-Layout)
- Läuft endlos ohne Nutzer-Interaktion

**Gewünschte neue Text-Panels:**
- Fake-Börsenkurse / Ticker (Hacker-Ästhetik: Krypto, fiktive Assets)
- Satelliten-Tracking (Fake-Koordinaten, Umlaufbahn-Daten)
- Wetterradar-Statusmeldungen
- „Classified"-Dokumente (zensierte Texte mit schwarzen Balken)

**Gewünschte neue Grafik-Panels:**
- Waveform-/Audio-Visualizer (ohne echten Audio-Input, simuliert)
- Radar-Sweep (rotierender Scan, Fake-Kontakte)
- Thermalkamera-Effekt (Falschfarben-Heatmap eines Stadtplans o.ä.)
- Particle-System (Partikelströmung, z.B. Energie-Flow)

### Priorität 4 — Julia-Menge im WASM-Modul

- Zweiter Fraktal-Typ in `wasm/src/lib.rs`
- Neue Mini-Panel-Varianten in `FractalScenes.tsx`
- Optional: interaktive Julia-Parameter (c-Wert über Mausposition)

### Priorität 5 — Audio / Hacker-Ambient

- Hintergrund-Soundscape: Tastatur-Klackern, Modem-Töne, Beeps
- Standardmäßig stumm, An/Aus-Schalter in der Kopfzeile
- **Bedingung:** nur wenn browserkompatible Implementierung ohne externe Abhängigkeiten möglich (WebAudio API + generierter Ton)

### Priorität 6 — Mobile / Touch

- Aktuell rein Desktop-optimiert (und das ist in Ordnung)
- Mobile-Unterstützung als nice-to-have: mindestens lesbar auf Tablet
- Kein vollständiges Responsive-Redesign nötig — ein vereinfachtes Single-Column-Layout für schmale Viewports wäre ausreichend

---

## 8. Deployment

- **Zielplattform:** Netcup-Webspace (Apache)
- Build: `cd frontend && npm run build` → Output in `frontend/dist/`
- Upload: `frontend/dist/` in den Webspace-Ordner kopieren
- `.htaccess` in `frontend/public/` setzt COOP/COEP-Header und SPA-Routing
- `vite.config.ts` nutzt `base: './'` für relative Asset-Pfade

---

## 9. Was das ursprüngliche PRD nicht mehr abbildet

`PRD_FraktalViewer.md` war ein klassisches Produkt-Spec-Dokument mit Akzeptanzkriterien, Milestones und Risiko-Tabellen. Es beschreibt den Ursprungszustand (reiner Fraktal-Viewer).

Das Projekt hat sich zu einem **humoresken Hacker-Showcase** entwickelt. Die folgenden PRD-Punkte sind überholt:

- Control-Panel mit Slider (nie gebaut, nicht mehr geplant)
- Info-Panel mit Zoom/FPS-Anzeige (ditto)
- Navbar mit About-Modal (wurde durch den Hacker-Dashboard-Header ersetzt)
- Barrierefreiheit WCAG 2.1 AA (kein Ziel mehr)
- Lighthouse Performance Score ≥ 85 (kein formales Ziel mehr)
- Julia-Menge als offene Frage OQ-02 (jetzt als explizites Roadmap-Item geplant)

---

*Zuletzt aktualisiert: 2026-05-20*
