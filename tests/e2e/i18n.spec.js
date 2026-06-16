import { test, expect } from '@playwright/test';
import { waitForPage, openSettings } from './helpers.js';

const currentYear = new Date().getFullYear();

async function switchLocale(page, locale) {
  await openSettings(page);
  await page.evaluate((loc) => {
    document.querySelector('bottom-nav').shadowRoot
      .querySelector(`[data-locale="${loc}"]`).click();
  }, locale);
  await page.waitForLoadState('domcontentloaded');
  await waitForPage(page);
}

async function editBtnText(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-edit-btn')?.textContent?.trim()
  );
}

test.describe('Language picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('settings modal lists EN, FR and CA options', async ({ page }) => {
    await openSettings(page);
    const locales = await page.evaluate(() =>
      Array.from(
        document.querySelector('bottom-nav').shadowRoot.querySelectorAll('[data-locale]')
      ).map(b => b.dataset.locale)
    );
    expect(locales).toEqual(expect.arrayContaining(['en', 'fr', 'ca']));
  });

  test('switching to French renders French strings', async ({ page }) => {
    await switchLocale(page, 'fr');
    expect(await editBtnText(page)).toBe('Modifier');
  });

  test('switching to Catalan renders Catalan strings', async ({ page }) => {
    await switchLocale(page, 'ca');
    expect(await editBtnText(page)).toBe('Edita');
  });

  test('selected locale persists across reload', async ({ page }) => {
    await switchLocale(page, 'fr');
    await page.reload();
    await waitForPage(page);
    expect(await editBtnText(page)).toBe('Modifier');
  });

  test('switching back to English restores English strings', async ({ page }) => {
    await switchLocale(page, 'fr');
    await switchLocale(page, 'en');
    expect(await editBtnText(page)).toBe('Edit');
  });
});
