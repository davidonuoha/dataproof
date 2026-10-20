import { defineConfig, devices } from '@playwright/test'

/**
 * Browser-level tests.
 *
 * These cover the journeys that only make sense in a real browser: importing a
 * file through the file input, inspecting the records behind a finding,
 * comparing two datasets and downloading a report.
 *
 * Run with:  npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
