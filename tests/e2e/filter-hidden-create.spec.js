import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// Creating a goal while an active filter hides it must signal the user with an
// info toast whose Show action clears the filter and reveals the goal.

async function openFilterPanel(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#header').shadowRoot
      .querySelector('#filter-btn').click();
  });
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#filter-bar')?.hidden
  );
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#filter-expand-btn').click();
  });
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#filter-panel')?.hidden
  );
}

async function createCapstone(page, title) {
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
  await page.evaluate(t => {
    const gd = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog');
    const inp = gd.shadowRoot.querySelector('#input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    gd.shadowRoot.querySelector('#close').click();
  }, title);
}

test.describe('Create while filter hides the result', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('goal created under an excluding filter: info toast, Show reveals it', async ({ page }) => {
    await openFilterPanel(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').click();
    });

    await createCapstone(page, 'Hidden by filter');

    // goal stored but its element hidden
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item?._goal?.title === 'Hidden by filter' && item.hidden === true;
    });

    // info toast with the Show action
    await expect(page.locator('.socle-toast-info')).toContainText('hidden by the current filter');
    await page.locator('.socle-toast-btn').click();

    // filter cleared, goal visible
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item && item.hidden === false;
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').getAttribute('aria-pressed') === 'false'
    );
  });

  test('goal created under a matching filter keeps the saved toast', async ({ page }) => {
    await openFilterPanel(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-not-started').click();
    });

    await createCapstone(page, 'Visible goal');

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item?._goal?.title === 'Visible goal' && item.hidden === false;
    });
    await expect(page.locator('.socle-toast-success')).toContainText('Goal saved');
  });
});
