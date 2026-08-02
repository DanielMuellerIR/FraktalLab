import { existsSync } from 'node:fs'
import { chromium, defineConfig, devices } from '@playwright/test'

// ── Browserwahl: es läuft immer GENAU EIN Projekt ─────────────────────────────
// Früher standen "chromium" und "chrome-headless" gemeinsam in der Liste, das
// zweite als gedachter Fallback. Ohne --project führt Playwright aber ALLE
// Projekte aus: fehlte das gebündelte Chromium, scheiterte dessen Projekt
// weiterhin (der Fallback rettete nichts), und war es vorhanden, lief jede Suite
// zusätzlich ein zweites Mal mit System-Chrome.
//
// Stattdessen wird der Browser jetzt VOR dem Lauf erkannt: Playwrights
// gebündeltes Chromium, wenn es installiert ist, sonst das lokal installierte
// Google Chrome (headless). PW_PROJECT überschreibt die Erkennung:
//   PW_PROJECT=chrome-headless npm run test:panels  → System-Chrome, headless
//   PW_PROJECT=chrome-gpu npm run test:perf         → sichtbares Chrome, damit der
//                                                     Metal-GPU-Pfad statt
//                                                     SwiftShader gemessen wird
const PROJECTS = {
  chromium: {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  'chrome-headless': {
    name: 'chrome-headless',
    use: { ...devices['Desktop Chrome'], channel: 'chrome', headless: true },
  },
  // GPU-Mess-Profil: echtes Google Chrome, sichtbar (headless=false), damit der
  // Metal-GPU-Pfad genutzt wird statt SwiftShader. Nur für perf-measure relevant.
  'chrome-gpu': {
    name: 'chrome-gpu',
    use: { ...devices['Desktop Chrome'], channel: 'chrome', headless: false },
  },
}

// Liegt die zur installierten @playwright/test-Version passende Chromium-Kopie
// wirklich im Cache? executablePath() liefert nur den erwarteten Pfad — nach
// einem Dependency-Update ohne `npx playwright install` zeigt er ins Leere.
function bundledChromiumInstalled(): boolean {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
}

const requested = process.env.PW_PROJECT
if (requested && !(requested in PROJECTS)) {
  throw new Error(
    `PW_PROJECT="${requested}" ist unbekannt. Erlaubt: ${Object.keys(PROJECTS).join(', ')}`,
  )
}
const activeProject = requested ?? (bundledChromiumInstalled() ? 'chromium' : 'chrome-headless')

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
  projects: [PROJECTS[activeProject as keyof typeof PROJECTS]],
})
