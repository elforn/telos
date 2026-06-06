import { test, expect } from '@playwright/test';

async function waitForHomePage(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  );
}

test.describe('Router — forward navigation', () => {
  test('renders home-page at /', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-router')).toBeAttached();
    await waitForHomePage(page);
  });

  test('renders not-found-page for an unknown route', async ({ page }) => {
    // Use a two-segment path — a single segment matches /:year and falls through to home-page
    await page.goto('/foo/bar');
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('not-found-page')
    );
  });
});

test.describe('Router — back navigation', () => {
  test('returns to home-page after browser back', async ({ page }) => {
    await page.goto('/');
    await waitForHomePage(page);

    await page.goto('/foo/bar');
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('not-found-page')
    );

    await page.goBack();
    await waitForHomePage(page);
  });
});

test.describe('Router — SW navigation intercept', () => {
  test('serves app shell on hard refresh at a non-root URL', async ({ page }) => {
    // First visit installs the SW
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    // Hard navigate to multi-segment unknown route — SW intercepts and serves index.html
    await page.goto('/foo/bar');
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('not-found-page')
    );
  });
});
