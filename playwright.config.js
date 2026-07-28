import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/results',
  // CI runners are slower/contended, so service-worker activation and the
  // multi-step flows occasionally exceed a step timeout. Retry on CI so a
  // flaky run self-heals; a genuine failure still fails all attempts. Locally
  // keep retries off so flakiness stays visible.
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'tests/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    serviceWorkers: 'allow',
    headless: true,
  },
  webServer: {
    command: 'node utils/build.js && npx --yes serve dist -l 4321 --single',
    port: 4321,
    reuseExistingServer: true,
  },
});
