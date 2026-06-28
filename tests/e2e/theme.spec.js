import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush, openSettings } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clickThemeBtn(page, theme) {
  await page.evaluate(t => {
    document.querySelector('bottom-nav').shadowRoot
      .querySelector(`#theme-group [data-theme="${t}"]`).click();
  }, theme);
}

function getAppliedTheme(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

function getStoredTheme(page) {
  return page.evaluate(() => localStorage.getItem('theme'));
}

// ── Theme — toggle ────────────────────────────────────────────────────────────

test.describe('Theme — toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
  });

  test('clicking Light sets data-theme="light" on the document', async ({ page }) => {
    await clickThemeBtn(page, 'light');
    expect(await getAppliedTheme(page)).toBe('light');
  });

  test('clicking Dark sets data-theme="dark" on the document', async ({ page }) => {
    await clickThemeBtn(page, 'dark');
    expect(await getAppliedTheme(page)).toBe('dark');
  });

  test('clicking Light stores "light" in localStorage', async ({ page }) => {
    await clickThemeBtn(page, 'light');
    expect(await getStoredTheme(page)).toBe('light');
  });

  test('clicking Dark stores "dark" in localStorage', async ({ page }) => {
    await clickThemeBtn(page, 'dark');
    expect(await getStoredTheme(page)).toBe('dark');
  });

  test('clicking System stores "system" in localStorage', async ({ page }) => {
    // First set to light so toggling to system is a real change
    await clickThemeBtn(page, 'light');
    await clickThemeBtn(page, 'system');
    expect(await getStoredTheme(page)).toBe('system');
  });
});

// ── Theme — persistence ───────────────────────────────────────────────────────

test.describe('Theme — persistence', () => {
  test('light theme persists across page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
    await clickThemeBtn(page, 'light');
    await waitForIDBFlush(page);

    await page.reload();
    await waitForPage(page);

    expect(await getAppliedTheme(page)).toBe('light');
    expect(await getStoredTheme(page)).toBe('light');
  });

  test('dark theme persists across page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
    await clickThemeBtn(page, 'dark');
    await waitForIDBFlush(page);

    await page.reload();
    await waitForPage(page);

    expect(await getAppliedTheme(page)).toBe('dark');
    expect(await getStoredTheme(page)).toBe('dark');
  });
});
