import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// App-Version aus package.json → als __APP_VERSION__ ins Bundle. Dient u.a. zum
// Cache-Busting der Worklet-Dateien (liegen in public/, werden NICHT gehasht →
// Browser cachen sie sonst über Deploys hinweg).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    // COOP/COEP bleiben gesetzt: credentialless erlaubt Cross-Origin-Medien
    // (z.B. das archive.org-Video in AllYourBase) ohne require-corp-Härte.
    // (Früher zusätzlich für das WASM-Modul nötig — das ist seit der GPU-
    //  Fraktal-Migration entfallen.)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
