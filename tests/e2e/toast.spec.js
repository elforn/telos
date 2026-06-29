import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

async function openAndSaveGoal(page, title) {
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
  await page.evaluate((t) => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#close').click();
  });
}

test.describe('Toast feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('shows success toast after saving a goal', async ({ page }) => {
    await openAndSaveGoal(page, 'Toast test goal');
    await expect(page.locator('#toast-container')).toBeVisible();
    await expect(page.locator('.socle-toast-success')).toContainText('Goal saved');
  });

  test('toast auto-dismisses after 3 seconds', async ({ page }) => {
    await openAndSaveGoal(page, 'Auto-dismiss goal');
    await expect(page.locator('.socle-toast-success')).toBeVisible();
    await page.waitForTimeout(3500);
    await expect(page.locator('.socle-toast-success')).toHaveCount(0);
  });
});
