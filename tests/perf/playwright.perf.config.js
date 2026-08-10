// Separate Playwright config for the exploratory perf/stress tests in this
// directory, since the main playwright.config.js's testDir (tests/e2e) is the
// CI-gated suite and deliberately doesn't scan here. Reuses the same
// webServer/reporter setup. Run with:
//
//   npx playwright test --config=tests/perf/playwright.perf.config.js

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  outputDir: '../results-perf',
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4321',
    serviceWorkers: 'allow',
    headless: true,
  },
  webServer: {
    command: 'cd ../.. && node utils/build.js && npx --yes serve dist -l 4321 --single',
    port: 4321,
    reuseExistingServer: true,
  },
});
