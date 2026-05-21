# DEV_GUIDE.md — Richtlinien für Entwicklungs-Agents

Projektdokumentation, Todos und Roadmap stehen in `AGENTS.md`.
Diese Datei enthält nur Hinweise, die für AI-Coding-Agents relevant sind.

---

## Build-Befehle

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

## Coding-Hinweise für Agents

**TypeScript Closure-Narrowing:** Canvas-Panels müssen nach dem Null-Check `const canvas: HTMLCanvasElement = _canvas` und `const ctx: CanvasRenderingContext2D = _ctx` verwenden. TypeScript Assertions (`!`) tragen in Closures nicht durch.

**IntersectionObserver-Muster:** Neue Canvas-Panels sollen den rAF-Loop pausieren, wenn der Container unsichtbar ist (`if (!isVisible) { rafId = rAF(loop); return }`).

**HTTP-Header:** COOP/COEP sind Pflicht für WASM. Nicht aus `vite.config.ts` oder `.htaccess` entfernen.

**Tailwind v4:** Kein `tailwind.config.js`. Konfiguration ausschließlich via CSS in `frontend/src/index.css`.

**Neue Panels:** Immer in `POOL_TEXT` oder `POOL_GFX` in `App.tsx` eintragen. Sonst erscheinen sie nie im Grid.
