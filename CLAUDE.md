# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**FraktalLab** — interaktiver Fraktal-Viewer (Mandelbrot/Julia) mit WebAssembly-Kern.  
Referenz: `PRD_FraktalViewer.md`.

## Tech-Stack

```
Frontend:     React 19, Vite 8, TypeScript 6, Tailwind CSS v4
WASM-Modul:   Rust 1.95 + wasm-pack 0.15  (wasm32-unknown-unknown target)
Prod-Server:  Node 20 LTS + Express  (COOP/COEP-Header)
Testing:      Vitest (Unit), Playwright (E2E)  — noch nicht eingerichtet
```

## Repo-Struktur

```
wasm/       Rust-Crate (cdylib). Build-Output: wasm/pkg/
frontend/   Vite + React SPA. Build-Output: frontend/dist/
server/     Express Prod-Server (index.js)
.github/    CI (workflows/ci.yml)
```

## Befehle

```bash
# WASM-Modul kompilieren (erzeugt wasm/pkg/ mit JS-Bindings)
source "$HOME/.cargo/env"
wasm-pack build wasm --target web --out-dir pkg

# Rust-Tests (nativ, ohne Browser)
cargo test --manifest-path wasm/Cargo.toml

# Frontend Dev-Server (mit COOP/COEP-Header)
cd frontend && npm run dev

# Frontend Production Build
cd frontend && npm run build

# Frontend Lint
cd frontend && npm run lint

# Einzelnen Vitest-Test ausführen  (sobald Vitest eingerichtet)
cd frontend && npx vitest run src/path/to/test.spec.ts

# Prod-Server starten (nach npm run build)
cd server && node index.js
```

## Architektur-Kernpunkte

**WASM ↔ React-Grenze:** Das WASM-Modul (`wasm/src/lib.rs`) rendert Fraktale in einen `Vec<u8>`-Pixel-Buffer (RGBA, row-major). Der JS-Caller überträgt diesen via `ImageData` auf ein `<canvas>`-Element. Keine Fraktal-Berechnung im React-Code.

**Animations-Loop:** `<FractalCanvas>` treibt die Animation via `requestAnimationFrame`. Pro Frame: WASM-`render()` aufrufen → `ImageData` bauen → `ctx.putImageData()`. WASM-Modul liefert nur den Buffer, steuert keinen State.

**HTTP-Header (kritisch):** Express-Server und Vite-Dev-Server setzen beide `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Ohne diese Header verweigern Chrome und Safari den WASM-Load.

**Tailwind v4:** Eingebunden via `@tailwindcss/vite`-Plugin (kein `tailwind.config.js` erforderlich). CSS-Einstiegspunkt: `frontend/src/index.css` mit `@import "tailwindcss"`.

**Noch offene Entscheidung:** Julia-Menge in Variante-1 oder erst Variante-2 (OQ-02)?
