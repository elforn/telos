import { test, expect } from '@playwright/test';

/*
 * Full E2E SW update testing (two deployed builds swapping) cannot be automated
 * reliably in Playwright without a dedicated test fixture server. The tests below
 * cover everything that can be verified in a single build:
 *
 *   - Banner is hidden on load
 *   - Banner appears when the store signals an update (triggered via dynamic import)
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

// Trigger the update banner by writing directly to the store module.
// Dynamic import shares the cached module instance the app is using.
async function triggerUpdateBanner(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  );
  await page.evaluate(async () => {
    const { setState } = await import('./_lib/core/store/store.js');
    setState('updateAvailable', true);
  });
}

test.describe('Update flow — banner behaviour', () => {
  test('update-banner is hidden on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('update-banner')).toHaveAttribute('hidden');
  });

  test('update-banner appears when store signals update available', async ({ page }) => {
    await page.goto('/');
    await triggerUpdateBanner(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');
  });

  test('dismiss button hides the banner without reloading', async ({ page }) => {
    await page.goto('/');
    await triggerUpdateBanner(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');

    let reloaded = false;
    page.on('load', () => { reloaded = true; });

    await page.locator('update-banner #dismiss').click();
    await expect(page.locator('update-banner')).toHaveAttribute('hidden', '');
    expect(reloaded).toBe(false);
  });

  test('reload button triggers a page reload when no waiting SW exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await triggerUpdateBanner(page);
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');

    await page.locator('update-banner #reload').click();
    await page.waitForLoadState('domcontentloaded');

    // After reload the store resets — banner must be hidden again
    await expect(page.locator('update-banner')).toHaveAttribute('hidden');
  });
});
