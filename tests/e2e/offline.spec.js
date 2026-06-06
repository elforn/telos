import { test, expect } from '@playwright/test';

test.describe('Offline behaviour', () => {
  test('app loads from cache when offline after first visit', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // Wait for full app init — ensures all module files are fetched and cached by the SW
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await context.setOffline(true);
    await page.reload();

    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );
    await expect(page.locator('app-router')).toBeAttached();
  });

  // Domain offline test template — replace with a real interaction from your app.
  // The test below shows the pattern: go offline, perform an action, assert it worked.
  //
  // test('app remains functional offline — can perform domain action', async ({ page, context }) => {
  //   await page.goto('/');
  //   await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  //   await page.waitForFunction(() =>
  //     !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  //   );
  //
  //   await context.setOffline(true);
  //
  //   // Perform a domain action via the UI or page.evaluate
  //   await page.evaluate(() => {
  //     document.querySelector('app-router').shadowRoot
  //       .querySelector('home-page').shadowRoot
  //       .querySelector('#your-action-button').click();
  //   });
  //
  //   // Assert the result
  //   await page.waitForFunction(() => ...);
  //   expect(await page.evaluate(() => ...)).toBe(...);
  // });
});
