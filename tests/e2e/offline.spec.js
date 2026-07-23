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

  test('goals written online are readable after going offline and reloading', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    // Create a goal while online
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#add-capstone').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot.querySelector('input');
      inp.value = 'Offline goal';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot.querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    // Go offline and reload — goal must survive
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Offline goal');
  });

  test('self-hosted Onest font loads offline (no fallback to system font)', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    const onestAvailable = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px Onest');
    });
    expect(onestAvailable).toBe(true);
  });
});
