const path = require('node:path')
const { defineConfig } = require('@playwright/test')

const baseURL = 'http://127.0.0.1:4173/displayhub/'
const artifactDir = path.join(__dirname, 'artifacts')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Imagens aprovadas permanecem versionadas; CI nunca aceita diferenças automaticamente.
  updateSnapshots: 'none',
  // Playwright fornece {arg} sem a extensão; restaurar .png para o arquivo versionado.
  snapshotPathTemplate: path.join(__dirname, 'baselines', 'images', '{arg}.png'),
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifactDir, 'report'), open: 'never' }],
  ],
  outputDir: path.join(artifactDir, 'test-results'),
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: {
      // Never connect this visual smoke to a customer or production database.
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_visual_ci_dummy',
    },
  },
})
