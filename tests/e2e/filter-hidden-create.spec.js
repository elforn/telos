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

  test('goal created under an excluding filter: info toast, Show reveals and scrolls to it', async ({ page }) => {
    // small viewport so the capstone section can be scrolled out of view
    await page.setViewportSize({ width: 400, height: 500 });
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

    // scroll the capstone section out of view before tapping Show
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('.socle-toast-btn').click();

    // filter cleared, goal visible AND scrolled into the viewport
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      if (!item || item.hidden !== false) return false;
      const r = item.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
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
