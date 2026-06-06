import { test, expect } from '@playwright/test';

const waitForHomePage = page => page.waitForFunction(() =>
  !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
);

/*
 * Persistence tests verify that your app's data survives a page reload.
 *
 * Pattern for testing domain state persistence:
 *   1. Perform an action that writes to the store (via UI or page.evaluate)
 *   2. Confirm the UI reflects the change
 *   3. Reload the page
 *   4. Confirm the UI still reflects the change
 *
 * Shadow DOM traversal — components are nested behind shadow roots:
 *   document.querySelector('app-router').shadowRoot
 *     .querySelector('home-page').shadowRoot
 *     .querySelector('#your-element')
 *
 * For components using the Gestures mixin, use page.mouse with bounding box
 * coordinates — page.locator().click() does not fire the pointer events the
 * mixin listens to:
 *
 *   const box = await page.evaluate(() =>
 *     document.querySelector('app-router').shadowRoot
 *       .querySelector('home-page').shadowRoot
 *       .querySelector('#target').getBoundingClientRect()
 *   );
 *   await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
 */

test.describe('Data persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);
  });

  // Replace this test with a domain-specific assertion.
  // Example: create an item, reload, assert it is still present.
  test('app shell renders after reload', async ({ page }) => {
    await page.reload();
    await waitForHomePage(page);
    await expect(page.locator('app-router')).toBeAttached();
  });

  // Domain persistence test template — fill in with your store actions and selectors:
  //
  // test('item persists across reload', async ({ page }) => {
  //   // 1. Trigger a store write via the UI or page.evaluate
  //   await page.evaluate(() => {
  //     document.querySelector('app-router').shadowRoot
  //       .querySelector('home-page').shadowRoot
  //       .querySelector('#add-btn').click();
  //   });
  //   // 2. Confirm the UI reflects the change
  //   await page.waitForFunction(() => ...);
  //   // 3. Reload
  //   await page.reload();
  //   await waitForHomePage(page);
  //   // 4. Confirm data is still there
  //   const item = await page.evaluate(() => ...);
  //   expect(item).toBeDefined();
  // });
});
