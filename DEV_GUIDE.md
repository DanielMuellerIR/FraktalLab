# DEV_GUIDE.md — Richtlinien für Entwicklungs-Agents

Projektdokumentation, Todos und Roadmap stehen in `AGENTS.md`.
Diese Datei enthält nur Hinweise, die für AI-Coding-Agents relevant sind.

---

## Build-Befehle

```bash
# Frontend Dev-Server (COOP/COEP via vite.config.ts)
cd frontend && npm run dev

# Production Build  →  frontend/dist/
cd frontend && npm run build

# Lint
cd frontend && npm run lint

# Visueller Panel-Check (Dev-Server muss laufen)
cd frontend && npm run test:panels

# Performance-Messung (Production-Preview muss laufen, siehe PERF_NOTES.md)
cd frontend && npm run test:perf
```

> **Hinweis:** Es gibt kein WASM-Modul mehr. Die Fraktale wurden auf einen
> GPU-Fragment-Shader migriert (`src/components/FractalGL.tsx` +
> `src/utils/fractal-gl-shader.ts`, Befund B-4). Kein Rust/`wasm-pack`-Build nötig.

---

## Coding-Hinweise für Agents

**TypeScript Closure-Narrowing:** Canvas-Panels müssen nach dem Null-Check `const canvas: HTMLCanvasElement = _canvas` und `const ctx: CanvasRenderingContext2D = _ctx` verwenden. TypeScript Assertions (`!`) tragen in Closures nicht durch.

**IntersectionObserver-Muster:** Neue Canvas-Panels sollen den rAF-Loop pausieren, wenn der Container unsichtbar ist (`if (!isVisible) { rafId = rAF(loop); return }`).

**HTTP-Header:** COOP/COEP bleiben gesetzt (credentialless) — erlauben Cross-Origin-Medien wie das archive.org-Video. Nicht aus `vite.config.ts` oder `.htaccess` entfernen. (WASM-SharedArrayBuffer ist seit der GPU-Fraktal-Migration kein Grund mehr, aber die Header schaden nicht.)

**Fraktale = GPU-Shader:** Mandelbrot/Julia laufen über `FractalGL` (WebGL-Fragment-Shader, double-single-Präzision in `fractal-gl-shader.ts`), nicht mehr über WASM. Neue Fraktal-Varianten via `makeFractalScene`/`FractalGL`-Props, nicht über Rust.

**Tailwind v4:** Kein `tailwind.config.js`. Konfiguration ausschließlich via CSS in `frontend/src/index.css`.

**Neue Panels:** Immer in `POOL_TEXT` oder `POOL_GFX` in `App.tsx` eintragen. Sonst erscheinen sie nie im Grid.
