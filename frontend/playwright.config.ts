import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    // Dev-Server muss bereits laufen (npm run dev)
    baseURL: process.env.VITE_URL ?? 'http://localhost:5174',
    headless: true,
    viewport: { width: 1280, height: 900 },
    bypassCSP: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // GPU-Mess-Profil: echtes Google Chrome, sichtbar (headless=false), damit der
    // Metal-GPU-Pfad genutzt wird statt SwiftShader. Nur für perf-measure relevant.
    //   npx playwright test tests/perf-measure.spec.ts --project=chrome-gpu
    {
      name: 'chrome-gpu',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', headless: false },
    },
  ],
})
