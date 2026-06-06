import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:3002',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'node utils/build.js && npx --yes serve dist -l 3002 --single',
    port: 3002,
    reuseExistingServer: false,
  },
});
