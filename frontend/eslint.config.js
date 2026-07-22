import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Bestehende, umfangreiche Legacy-Schulden bleiben sichtbar, blockieren
      // aber den Gate nicht. Korrektheitsregeln (u. a. rules-of-hooks und
      // exhaustive-deps) bleiben aus den Recommended-Sets weiterhin Fehler.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      'no-empty': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
