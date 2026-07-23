import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();
const DEFAULT_ACCENT = '#5BADE0';
// One of the PALETTE entries in year-header.js
const BLUE   = '#3B82F6';
const INDIGO = '#6366F1';

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearHeaderSR(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
  );
}

async function clickInYH(page, selector) {
  await page.evaluate(sel => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

async function openColorSheet(page) {
  await clickInYH(page, '#menu-btn');
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#menu')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
  await clickInYH(page, '#year-color-btn');
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#color-sheet')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

async function pickColor(page, hex) {
  await page.evaluate(h => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector(`#color-sheet .swatch[data-color="${h}"]`).click();
  }, hex);
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#color-sheet')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

function getAppliedAccent(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').style.getPropertyValue('--color-accent')
  );
}

// ── Year accent color — picking ───────────────────────────────────────────────

test.describe('Year accent color — picking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('picking a swatch applies that color as --color-accent on home-page', async ({ page }) => {
    await openColorSheet(page);
    await pickColor(page, BLUE);

    const accent = await getAppliedAccent(page);
    expect(accent).toBe(BLUE);
  });

  test('picking a different swatch changes the accent color', async ({ page }) => {
    await openColorSheet(page);
    await pickColor(page, BLUE);
    await openColorSheet(page);
    await pickColor(page, INDIGO);

    const accent = await getAppliedAccent(page);
    expect(accent).toBe(INDIGO);
  });

  test('the selected swatch has aria-pressed="true" when color sheet reopens', async ({ page }) => {
    await openColorSheet(page);
    await pickColor(page, BLUE);
    await openColorSheet(page);

    const pressed = await page.evaluate(h => {
      const swatch = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector(`#color-sheet .swatch[data-color="${h}"]`);
      return swatch?.getAttribute('aria-pressed');
    }, BLUE);
    expect(pressed).toBe('true');
  });
});

// ── Year accent color — reset ─────────────────────────────────────────────────

test.describe('Year accent color — reset', () => {
  test('reset button restores the default accent color', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openColorSheet(page);
    await pickColor(page, BLUE);

    // Now reset
    await openColorSheet(page);
    await clickInYH(page, '#color-reset-btn');
    await page.waitForFunction(() =>
      !document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#color-sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );

    const accent = await getAppliedAccent(page);
    expect(accent).toBe(DEFAULT_ACCENT);
  });
});

// ── Year accent color — persistence ──────────────────────────────────────────

test.describe('Year accent color — persistence', () => {
  test('selected accent color survives page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openColorSheet(page);
    await pickColor(page, BLUE);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    const accent = await getAppliedAccent(page);
    expect(accent).toBe(BLUE);
  });

  test('accent color is scoped to the year — other years use the default', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openColorSheet(page);
    await pickColor(page, BLUE);

    // Navigate to the next year
    await clickInYH(page, '#next');
    await page.waitForFunction(year => {
      const h1 = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot?.querySelector('h1');
      return h1?.textContent?.includes(String(year + 1));
    }, currentYear);

    const accentNextYear = await getAppliedAccent(page);
    expect(accentNextYear).toBe(DEFAULT_ACCENT);
  });
});
