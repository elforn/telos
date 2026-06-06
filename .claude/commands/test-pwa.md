# /test-pwa

Write or complete Playwright tests for PWA-specific behaviour that cannot be unit tested:
offline operation, service worker lifecycle, caching, update flow, and persistence across reloads.

## Usage
/test-pwa <scenario>

Scenarios: `offline` | `update-flow` | `persistence` | `install` | `all`

## Setup requirements (check before writing tests)

Playwright PWA testing requires specific configuration. Verify `playwright.config.js` has:

```js
use: {
  serviceWorkers: 'allow',   // do not block SW registration
}
```

For offline tests, Playwright controls network via `page.context().setOffline(true)`.
For SW inspection, use `page.evaluate(() => navigator.serviceWorker.ready)`.

---

## Scenario: `offline`

Test that the app is fully functional with no network after first load.

```js
test('app loads and functions offline after first visit', async ({ page, context }) => {
  // First visit — SW installs and caches assets
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Go offline
  await context.setOffline(true);

  // Reload — must load from cache, not show an error
  await page.reload();
  await expect(page.locator('app-router')).toBeVisible();

  // Core interactions must still work
  // (fill in domain-specific actions here)
});

test('data written offline is persisted', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);

  // Perform a write action via the UI
  // Reload and verify the data is still present
});
```

---

## Scenario: `update-flow`

Test the full SW update lifecycle: new version detected → banner shown → user applies update → app reloads on new version.

```js
test('update banner appears when a new SW is waiting', async ({ page }) => {
  await page.goto('/');

  // Simulate a waiting SW by registering a modified SW programmatically
  // This requires a test fixture SW at a known path, e.g. /test-fixtures/sw-v2.js
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    // trigger updatefound manually for test purposes
  });

  await expect(page.locator('update-banner')).toBeVisible();
});

test('applying update reloads the page', async ({ page }) => {
  // Confirm update banner is visible, click the update button
  // Assert page reloads (use page.waitForNavigation or waitForURL)
  // Assert update banner is gone after reload
});
```

Note: Full SW update testing is the hardest PWA scenario to automate reliably.
If the above approach is brittle, test the update banner component in isolation by
directly dispatching the store event it subscribes to, and test the SW postMessage
logic separately. Document what is manually verified.

---

## Scenario: `persistence`

Test that IDB data survives page reload and browser restart simulation.

```js
test('event log persists across reloads', async ({ page }) => {
  await page.goto('/');

  // Write data via UI
  // Reload
  await page.reload();
  // Assert data is still present in the UI
});

test('schema migration runs cleanly on version bump', async ({ page }) => {
  // Seed IDB with previous-version data structure via page.evaluate()
  // Load the app (migration should run)
  // Assert new schema is present and old data is intact
});
```

---

## Scenario: `install`

Note: The PWA install prompt (`beforeinstallprompt`) cannot be reliably triggered in Playwright.
Do not attempt to automate it. Instead, document the manual test checklist:

```
Manual PWA install checklist:
[ ] App served over HTTPS (or localhost)
[ ] manifest.json present and valid (check DevTools > Application > Manifest)
[ ] SW registered and active
[ ] Install prompt appears in browser on second visit (Chrome)
[ ] Installed app opens without browser chrome
[ ] Splash screen displays correctly
[ ] App icon correct on home screen
```

Write this checklist as a comment block in `e2e/install.spec.js` with a single skipped test
as a reminder that this exists.

---

## Scenario: `all`

Run through each scenario above in order. Create separate spec files:
- `e2e/offline.spec.js`
- `e2e/update-flow.spec.js`
- `e2e/persistence.spec.js`
- `e2e/install.spec.js` (manual checklist only)
