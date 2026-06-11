import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/results',
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
