import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// Minimal 1×1 transparent PNG — no fixture file needed
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function clickInYearHeader(page, selector) {
  await page.evaluate((sel) => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

async function injectPhoto(page) {
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file  = new File([bytes], 'test.png', { type: 'image/png' });
    const dt    = new DataTransfer();
    dt.items.add(file);
    const yh    = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header');
    const input = yh.shadowRoot.querySelector('#photo-input');
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, TINY_PNG_B64);
}

async function hasImage(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').hasAttribute('data-has-image')
  );
}

async function waitForImage(page) {
  await page.waitForFunction(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').hasAttribute('data-has-image')
  );
}

async function removePhoto(page) {
  await clickInYearHeader(page, '#menu-btn');
  await clickInYearHeader(page, '#year-photo-btn');
  await clickInYearHeader(page, '#photo-remove');
}

test.describe('Year photo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test.afterEach(async ({ page }) => {
    if (await hasImage(page)) await removePhoto(page);
  });

  test('uploading a photo sets data-has-image on year-header', async ({ page }) => {
    await injectPhoto(page);
    await waitForImage(page);
    expect(await hasImage(page)).toBe(true);
  });

  test('photo menu shows Change and Remove after upload, hides Add', async ({ page }) => {
    await injectPhoto(page);
    await waitForImage(page);

    await clickInYearHeader(page, '#menu-btn');
    await clickInYearHeader(page, '#year-photo-btn');

    const state = await page.evaluate(() => {
      const sheet = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#photo-sheet');
      return {
        addHidden:    sheet.querySelector('#photo-add').hidden,
        changeHidden: sheet.querySelector('#photo-change').hidden,
        removeHidden: sheet.querySelector('#photo-remove').hidden,
      };
    });
    expect(state.addHidden).toBe(true);
    expect(state.changeHidden).toBe(false);
    expect(state.removeHidden).toBe(false);
  });

  test('photo persists across page reload', async ({ page }) => {
    await injectPhoto(page);
    await waitForImage(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    await waitForImage(page);

    expect(await hasImage(page)).toBe(true);
  });

  test('removing photo clears data-has-image', async ({ page }) => {
    await injectPhoto(page);
    await waitForImage(page);

    await removePhoto(page);

    await page.waitForFunction(() =>
      !document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').hasAttribute('data-has-image')
    );
    expect(await hasImage(page)).toBe(false);
  });

  test('photo is scoped to the year — other years show no image', async ({ page }) => {
    await injectPhoto(page);
    await waitForImage(page);

    await clickInYearHeader(page, '#next');
    await page.waitForFunction((y) =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header')?._year === y + 1,
      currentYear
    );

    expect(await hasImage(page)).toBe(false);
  });
});
