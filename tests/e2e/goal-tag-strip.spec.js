import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openMenu(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#menu')?.open
  );
}

async function clickTagsShowBtn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#tags-show-btn').click();
  });
}

async function clickTagsHideBtn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#tags-hide-btn').click();
  });
}

function getTagStripDisplay(page) {
  return page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--tag-strip-display')
  );
}

function getShowBtnActive(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#tags-show-btn').classList.contains('active')
  );
}

function getHideBtnActive(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#tags-hide-btn').classList.contains('active')
  );
}

// ── Goal tag strip — show ─────────────────────────────────────────────────────

test.describe('Goal tag strip — show', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('clicking tags-show-btn sets --tag-strip-display to block', async ({ page }) => {
    await openMenu(page);
    await clickTagsShowBtn(page);
    const val = await getTagStripDisplay(page);
    expect(val).toBe('block');
  });

  test('tags-show-btn gains active class after clicking', async ({ page }) => {
    await openMenu(page);
    await clickTagsShowBtn(page);
    expect(await getShowBtnActive(page)).toBe(true);
  });

  test('tags-hide-btn loses active class after showing', async ({ page }) => {
    await openMenu(page);
    await clickTagsShowBtn(page);
    expect(await getHideBtnActive(page)).toBe(false);
  });
});

// ── Goal tag strip — hide ─────────────────────────────────────────────────────

test.describe('Goal tag strip — hide', () => {
  test('clicking tags-hide-btn sets --tag-strip-display to none', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // First show, then hide
    await openMenu(page);
    await clickTagsShowBtn(page);
    await openMenu(page);
    await clickTagsHideBtn(page);

    const val = await getTagStripDisplay(page);
    expect(val).toBe('none');
  });

  test('tags-hide-btn gains active class after hiding', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openMenu(page);
    await clickTagsShowBtn(page);
    await openMenu(page);
    await clickTagsHideBtn(page);

    expect(await getHideBtnActive(page)).toBe(true);
    expect(await getShowBtnActive(page)).toBe(false);
  });
});

// ── Goal tag strip — menu closes after toggle ─────────────────────────────────

test.describe('Goal tag strip — menu closes', () => {
  test('menu closes automatically after clicking tags-show-btn', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openMenu(page);
    await clickTagsShowBtn(page);

    const menuOpen = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#menu')?.open ?? false
    );
    expect(menuOpen).toBe(false);
  });
});
