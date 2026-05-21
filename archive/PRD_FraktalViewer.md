# Product Requirements Document
## FraktalLab — Interaktiver Fraktal-Viewer mit WebAssembly

**Version:** 0.1 (Draft)
**Status:** In Review
**Erstellt:** 2026-05-19
**Autor:** TBD
**Zielgruppe dieses Dokuments:** Engineering, Design, QA

---

## 1. Überblick & Vision

FraktalLab ist eine Single-Page-Webanwendung, die mathematische Schönheit erlebbar macht. Herzstück ist ein live-animierter Fraktal-Renderer (Einstiegspunkt: Mandelbrot-Menge), der mittels **WebAssembly** mit maximaler Performance direkt im Browser berechnet wird. Die umgebende UI — Navigation, Controls, Info-Panel — wird mit **React** und einem **Node.js**-Backend (Dev-Server + API) realisiert.

Das Produkt dient als technisches Showcase ("Test") für den Einsatz von WebAssembly in einer modernen React-Architektur.

---

## 2. Ziele

| Ziel | Messbar durch |
|---|---|
| Flüssige Fraktal-Animation (≥ 60 fps, Desktop) | Lighthouse / devtools frame rate |
| WebAssembly übernimmt 100 % der Render-Logik | Code-Review: keine Fraktal-Berechnungen in JS |
| Erste sichtbare Interaktion < 2 s | Lighthouse LCP |
| Lauffähig in allen modernen Browsern (Chrome, Firefox, Safari, Edge) | Manueller Browsertest |

---

## 3. Nicht-Ziele (Scope-Out)

- Kein Backend-Persistenz-Layer (keine Nutzerdaten werden gespeichert)
- Kein Login / Authentifizierung
- Kein Export von Fraktal-Bildern (v1)
- Kein Mobile-First-Optimierung (Desktop-zentriert, v1)
- Keine serverseitige Rendering-Pipeline (SSR)

---

## 4. Nutzer & Kontext

**Primäre Zielgruppe:** Entwickler und technisch interessierte Nutzer, die die WebAssembly-Integration begutachten oder einfach einen schönen animierten Fraktal erleben möchten.

**Typisches Szenario:** Nutzer öffnet die Seite im Browser, sieht sofort einen animierten Fraktal, kann Parameter per Slider/Button verändern und die Animation in Echtzeit beobachten.

---

## 5. Funktionale Anforderungen

### 5.1 Fraktal-Renderer (WebAssembly-Modul)

| ID | Anforderung | Priorität |
|---|---|---|
| FR-01 | Das WASM-Modul berechnet die Mandelbrot-Menge für einen gegebenen Viewport (Ausschnitt in der komplexen Ebene) | Must |
| FR-02 | Die Animation läuft kontinuierlich: automatischer Zoom auf einen interessanten Punkt oder Farbzyklus (min. eine Animationsart) | Must |
| FR-03 | Das WASM-Modul exponiert eine klar definierte JS-API (z. B. `render(canvas, params)`) | Must |
| FR-04 | Maximale Iterationstiefe ist konfigurierbar (Default: 256) | Should |
| FR-05 | Mindestens ein weiterer Fraktal-Typ ist auswählbar (z. B. Julia-Menge) | Could |
| FR-06 | Multi-threaded Rendering via SharedArrayBuffer + WASM Threads (v2) | Won't (v1) |

**Technische Umsetzung WASM:**
Das Modul wird in **Rust** oder **C/C++** geschrieben und mit `wasm-pack` (Rust) bzw. `emscripten` (C) in `.wasm` kompiliert. Das Modul rendert direkt in ein `OffscreenCanvas` oder wird per `Uint8ClampedArray` in ein `<canvas>`-Element übertragen.

### 5.2 React-Frontend

| ID | Anforderung | Priorität |
|---|---|---|
| FR-10 | Single Page Application mit React (Vite als Build-Tool) | Must |
| FR-11 | `<FractalCanvas>`-Komponente bettet das WASM-Modul ein und steuert den Animations-Loop via `requestAnimationFrame` | Must |
| FR-12 | Control-Panel: Slider für Zoom-Geschwindigkeit, Farbpalette (min. 3 Presets), Iterations-Tiefe | Must |
| FR-13 | Info-Panel: Zeigt aktuelle Parameter (Mittelpunkt, Zoom-Level, fps) in Echtzeit an | Should |
| FR-14 | Navbar mit Projektname, GitHub-Link-Platzhalter, About-Modal | Should |
| FR-15 | Animations-Pause/Play-Button | Must |
| FR-16 | Responsive Layout: Fraktal-Canvas nimmt den Hauptteil der Viewport-Fläche ein | Must |
| FR-17 | About-Modal erklärt kurz, was Mandelbrot-Mengen sind und wie WASM eingesetzt wird | Could |

### 5.3 Node.js-Layer

| ID | Anforderung | Priorität |
|---|---|---|
| FR-20 | Vite Dev-Server (Node.js-basiert) für lokale Entwicklung | Must |
| FR-21 | Produktions-Build via `vite build`, statische Assets serviert durch `express` oder `serve` | Must |
| FR-22 | Korrekte HTTP-Header für WASM und SharedArrayBuffer: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` | Must |
| FR-23 | (Optional) Kleines Express-Endpunkt `/api/presets` liefert gespeicherte Koordinaten-Presets als JSON | Could |

---

## 6. Nicht-funktionale Anforderungen

| ID | Anforderung | Zielwert |
|---|---|---|
| NFR-01 | Frame Rate (Desktop, Full HD) | ≥ 60 fps bei max. 256 Iterationen |
| NFR-02 | Initial Load (WASM + JS Bundle) | < 500 KB gzip |
| NFR-03 | Time to Interactive | < 3 s auf schnellem Netz |
| NFR-04 | WASM-Modul-Größe | < 100 KB kompiliert |
| NFR-05 | Barrierefreiheit | WCAG 2.1 AA für alle UI-Elemente außer Canvas |
| NFR-06 | Browser-Support | Chrome 90+, Firefox 89+, Safari 15+, Edge 90+ |

---

## 7. Technologie-Stack

```
Frontend:       React 18+, Vite 5+
WASM:           Rust + wasm-pack  ODER  C++ + Emscripten
Styling:        CSS Modules oder Tailwind CSS (TBD)
Node.js:        Node 20 LTS, Express (Prod-Server)
Testing:        Vitest (Unit), Playwright (E2E)
CI/CD:          GitHub Actions (TBD)
Hosting:        TBD (z. B. Vercel, Netlify, oder selbst gehostet)
```

---

## 8. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client)                    │
│                                                      │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │   React App     │    │  WebAssembly Module     │  │
│  │  ┌───────────┐  │    │  ┌──────────────────┐  │  │
│  │  │  Navbar   │  │    │  │  Mandelbrot Algo  │  │  │
│  │  ├───────────┤  │◄──►│  │  (Rust/C++)       │  │  │
│  │  │  Canvas   │  │    │  │  → Pixel Buffer   │  │  │
│  │  │ Component │  │    │  └──────────────────┘  │  │
│  │  ├───────────┤  │    └────────────────────────┘  │
│  │  │ Controls  │  │                                 │
│  │  ├───────────┤  │                                 │
│  │  │ Info Panel│  │                                 │
│  │  └───────────┘  │                                 │
│  └─────────────────┘                                 │
└─────────────────────────────────────────────────────┘
              ▲
              │ HTTP (statische Assets + COOP/COEP Header)
              ▼
┌─────────────────────┐
│  Node.js / Express  │
│  (Prod-Server)      │
└─────────────────────┘
```

---

## 9. UI-Skizze (Wireframe-Beschreibung)

```
┌──────────────────────────────────────────────────────────────┐
│  FraktalLab                              [About]  [GitHub]   │  ← Navbar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│             [ FRAKTAL CANVAS — animiert, Vollbreite ]        │  ← Hauptbereich
│                                                              │
│                                                              │
├─────────────────────────────┬────────────────────────────────┤
│  Controls                   │  Info                          │
│  🎨 Palette: [A] [B] [C]    │  Zoom:   1.23×10⁶             │
│  ⚡ Zoom-Speed: ──●──       │  Center: (−0.7269, 0.1889)    │
│  🔁 Iterations: ──●──       │  FPS:    60                    │
│  ⏸ [Pause]                  │  Typ:    Mandelbrot            │
└─────────────────────────────┴────────────────────────────────┘
```

---

## 10. Animations-Konzept

Die Default-Animation zoomt kontinuierlich auf einen vordefinierten, visuell interessanten Punkt der Mandelbrot-Menge (z. B. die "Seepferdchen-Valley"-Region bei `c ≈ −0.7269 + 0.1889i`). Dabei werden die Farben per Hue-Rotation im Farbpaletten-Shader zyklisch verschoben, sodass die Animation auch bei gleichbleibendem Zoom optisch lebendig wirkt.

Weitere animierbare Parameter (konfigurierbar per Control-Panel):
- **Auto-Zoom:** kontinuierlicher Zoom-In auf fixed Point
- **Orbit Trap:** Farbwechsel basierend auf Orbit-Trap-Algorithmus
- **Julia-Morph:** kontinuierliche Variation des c-Parameters der Julia-Menge (FR-05)

---

## 11. Milesteine & Phasen

| Phase | Inhalt | Dauer (geschätzt) |
|---|---|---|
| **0 — Setup** | Repo-Struktur, Vite + React Boilerplate, Node-Server, CI-Skeleton | 1 Tag |
| **1 — WASM Core** | Rust/C++ Modul kompilieren, Mandelbrot statisch rendern, JS-Bindings | 3 Tage |
| **2 — Animation Loop** | `requestAnimationFrame`-Loop, Zoom-Animation, Farbzyklus | 2 Tage |
| **3 — UI** | React-Komponenten (Navbar, Controls, Info), Styling | 2 Tage |
| **4 — Integration** | WASM ↔ React-State, Control-Panel steuert WASM-Params live | 2 Tage |
| **5 — Polish & QA** | Browser-Tests, Performance-Tuning, Accessibility, Docs | 2 Tage |

**Geschamte Gesamtdauer: ~12 Arbeitstage**

---

## 12. Offene Fragen (OQs)

| # | Frage | Verantwortlich | Fällig |
|---|---|---|---|
| OQ-01 | Welche WASM-Sprache: **Rust** (empfohlen, bessere Toolchain) oder **C++** (Emscripten)? | Tech Lead | Phase 0 |
| OQ-02 | Soll eine zweite Fraktalart (Julia) in v1 enthalten sein oder erst in v2? | Product Owner | Phase 0 |
| OQ-03 | Welches Styling-System: **Tailwind CSS** oder **CSS Modules**? | Design | Phase 0 |
| OQ-04 | Gibt es ein Hosting-Ziel (Vercel, Netlify, eigener Server)? Dies beeinflusst den Header-Setup | Infra | Phase 5 |
| OQ-05 | Soll das Pause/Play durch eine Keyboard-Shortcut (Leertaste) ergänzt werden? | UX | Phase 3 |
| OQ-06 | Ist ein `SharedArrayBuffer` (für zukünftiges Multi-Threading) explizit vorausgesetzt, oder reicht Single-Thread für v1? | Tech Lead | Phase 1 |
| OQ-07 | Gibt es ein Design-System / Brand-Guide, dem sich die UI anpassen soll? | Design | Phase 0 |
| OQ-08 | Welche Lizenz soll das Projekt erhalten (MIT, Apache 2.0, proprietär)? | Legal / Owner | Phase 0 |

---

## 13. Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| WASM COOP/COEP-Header nicht korrekt gesetzt → Safari-Probleme | Mittel | Hoch | Early Browser-Test, Express-Middleware-Check in Phase 1 |
| Frame-Drop bei hoher Iterations-Tiefe auf Low-End-Geräten | Hoch | Mittel | Adaptive Iteration-Cap, Performance-Profiling in Phase 5 |
| Rust/wasm-pack Build-Chain-Setup dauert länger als geplant | Mittel | Mittel | Fallback auf C++/Emscripten, Timeline-Puffer |
| Canvas-Größe vs. DPR (Device Pixel Ratio) führt zu Unschärfe | Niedrig | Niedrig | DPR-Handling in FractalCanvas-Komponente frühzeitig implementieren |

---

## 14. Akzeptanzkriterien (Definition of Done)

- [ ] Die Seite öffnet ohne Konsolenfehler in Chrome, Firefox, Safari und Edge
- [ ] Die Mandelbrot-Animation läuft mindestens 30 Sekunden ohne Framerate-Einbruch unter 30 fps
- [ ] Der Pause-Button stoppt und startet die Animation zuverlässig
- [ ] Mindestens eine Farbpalette ist auswählbar und zeigt visuell unterschiedliches Ergebnis
- [ ] Das WASM-Modul ist eindeutig von der React-Logik getrennt (separates Package/Verzeichnis)
- [ ] HTTP-Response-Header beinhalten `COOP` und `COEP` im Produktions-Build
- [ ] Lighthouse Performance Score ≥ 85

---

*Ende des Dokuments — Version 0.1 Draft*
