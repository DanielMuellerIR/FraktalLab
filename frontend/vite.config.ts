import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
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
