import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      // @wasm zeigt auf das wasm-pack build-Verzeichnis außerhalb des frontend-Roots
      '@wasm': path.resolve(__dirname, '../wasm/pkg'),
    },
  },
  server: {
    // Erlaubt Vite, Dateien außerhalb von frontend/ zu servieren
    fs: { allow: ['..'] },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      // credentialless statt require-corp: erlaubt Cross-Origin-Medien (z.B. archive.org)
      // und aktiviert trotzdem SharedArrayBuffer (ab Chrome 96+, Firefox 119+)
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
