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
  ],
})
