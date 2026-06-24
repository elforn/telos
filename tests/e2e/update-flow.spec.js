import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

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
// Uses context.route() (not page.route()) so the interception also covers fetches
// made by the service worker itself — once the SW is active it calls fetch() in its
// own context, which page.route() cannot see.
async function routeFutureVersion(page) {
  await page.context().route(/\/version\.json/, route =>
    route.fulfill({ json: { version: '999.0.0', buildTime: new Date().toISOString() } })
  );
}

// After page.goto, the SW may activate and call clients.claim(), which fires
// controllerchange. If prevController was non-null, sw-manager calls location.reload().
// This helper waits for the SW controller to exist AND for any resulting reload to
// settle, so subsequent test actions run in a stable state.
async function waitForSWStable(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await waitForApp(page); // re-verify app is rendered after any reload
}

async function waitForApp(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  );
}

test.describe('Update flow — data persistence', () => {
  test('goals survive a reload triggered by the update banner', async ({ page }) => {
    const currentYear = new Date().getFullYear();

    // Route must be set BEFORE goto: once the SW is active it handles version.json
    // sub-fetches internally and Playwright cannot intercept them via page.route().
    await routeFutureVersion(page);

    await page.goto('/');
    await waitForPage(page);
    // Ensure the SW has activated and any controllerchange-triggered reload has settled
    // before we try to seed IDB — avoids "execution context was destroyed" errors.
    await waitForSWStable(page);

    // Banner appears because version.json (intercepted at context level) reports 999.0.0.
    await expect(page.locator('update-banner')).not.toHaveAttribute('hidden');

    // Seed a known goal directly into IDB while the banner is up.
    await page.evaluate(async (year) => {
      const store = window.__store ?? await new Promise(r => {
        const req = indexedDB.open('telos', 1);
        req.onsuccess = e => r(e.target.result);
      });
      await new Promise((resolve, reject) => {
        const tx = store.transaction('state', 'readwrite');
        const existing = tx.objectStore('state').get('root');
        existing.onsuccess = () => {
          const data = existing.result?.data ?? {};
          const yearGoals = data.goals?.[year] ?? { capstone: [], milestones: [], wow: [], focus: [] };
          yearGoals.capstone = [{ id: 'update-test-1', title: 'Survives update', percentage: 0, tags: [] }];
          data.goals = { ...data.goals, [year]: yearGoals };
          tx.objectStore('state').put({ id: 'root', data });
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        };
      });
    }, String(currentYear));

    await waitForIDBFlush(page);

    // Unroute so the real version.json is served after reload (banner must not reappear).
    await page.context().unrouteAll();

    // Reload via update banner (no waiting SW → falls back to location.reload())
    await page.locator('update-banner #reload').click();
    await page.waitForLoadState('domcontentloaded');
    await waitForPage(page);

    // Verify goal survived in IDB
    const title = await page.evaluate(async (year) => {
      const db = await new Promise(r => {
        const req = indexedDB.open('telos', 1);
        req.onsuccess = e => r(e.target.result);
      });
      return await new Promise(r => {
        const req = db.transaction('state', 'readonly').objectStore('state').get('root');
        req.onsuccess = () => r(req.result?.data?.goals?.[year]?.capstone?.[0]?.title);
      });
    }, String(currentYear));

    expect(title).toBe('Survives update');
  });
});

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
    // Wait for SW to stabilise before attaching the load-event listener — otherwise a
    // controllerchange-triggered reload (prevController non-null from a prior context)
    // could fire after the listener is set, giving a false positive.
    await waitForSWStable(page);
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
    await page.context().unrouteAll();
    await page.locator('update-banner #reload').click();
    await page.waitForLoadState('domcontentloaded');

    // After reload with real version.json the store resets — banner must be hidden
    await expect(page.locator('update-banner')).toHaveAttribute('hidden');
  });
});
