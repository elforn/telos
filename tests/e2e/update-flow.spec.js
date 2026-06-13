import { test, expect } from '@playwright/test';

/*
 * Full E2E SW update testing (two deployed builds swapping) cannot be automated
 * reliably in Playwright without a dedicated test fixture server. The tests below
 * cover everything that can be verified in a single build:
 *
 *   - Banner is hidden on load when version matches
 *   - Banner appears when version.json reports a newer version (Layer 2 detection)
 *   - Dismiss hides the banner without reloading
 *   - Reload button calls location.reload() when no waiting SW exists
 *
 * Manual checklist for full update cycle (run before every release):
 *   [ ] Deploy build N. Open app. SW activates. Note version in console.
 *   [ ] Deploy build N+1 (bump version in package.json).
 *   [ ] Reopen the app (do not clear SW). Update banner appears immediately (Layer 2).
 *   [ ] Tap Reload. Page reloads on new version. Banner is gone.
 *   [ ] Dismiss the banner instead. Confirm app continues to work on old version.
 *   [ ] Reopen app — update banner re-appears (SW still waiting).
 */

// Intercept version.json to report a future version, triggering Layer 2 detection.
// Must be called BEFORE page.goto() — the fetch fires before the SW is active on
// first load, so Playwright can intercept it directly. After goto the SW is active
// and handles fetches itself, bypassing page.route().
async function routeFutureVersion(page) {
  await page.route('/version.json', route =>
    route.fulfill({ json: { version: '999.0.0', buildTime: new Date().toISOString() } })
  );
}

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  );
}

test.describe('Update flow — banner behaviour', () => {
  test('update-banner is hidden on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('update-banner')).toHaveAttribute('hidden');
  });

  test('update-banner appears when version.json reports a newer version', async ({ page }) => {
    await routeFutureVersion(page);
    await page.goto('/');
    await waitForApp(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');
  });

  test('dismiss button hides the banner without reloading', async ({ page }) => {
    await routeFutureVersion(page);
    await page.goto('/');
    await waitForApp(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');

    let reloaded = false;
    page.on('load', () => { reloaded = true; });

    await page.locator('update-banner #dismiss').click();
    await expect(page.locator('update-banner')).toHaveAttribute('hidden', '');
    expect(reloaded).toBe(false);
  });

  test('reload button triggers a page reload when no waiting SW exists', async ({ page }) => {
    await routeFutureVersion(page);
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForApp(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');

    // Unroute before reload — without this the route persists, sw-manager detects
    // the mismatch again on the reloaded page and the banner immediately reappears.
    await page.unrouteAll();
    await page.locator('update-banner #reload').click();
    await page.waitForLoadState('domcontentloaded');

    // After reload with real version.json the store resets — banner must be hidden
    await expect(page.locator('update-banner')).toHaveAttribute('hidden');
  });
});
