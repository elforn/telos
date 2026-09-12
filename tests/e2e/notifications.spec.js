import { test, expect } from '@playwright/test';
import { waitForPage, openSettings } from './helpers.js';

// Headless Chromium hard-locks `Notification.permission` to 'denied'
// regardless of context.grantPermissions(['notifications']) (confirmed by
// direct probe — a known headless-mode limitation, not an app bug), so the
// granted-permission enable flow can't be exercised end-to-end here. That
// path (requestPermission granted → localStorage write → registerPeriodicSync
// call → pill state) is covered instead by tests/unit/bottom-nav.test.js's
// "notifications: pill group" suite, which mocks the Notification API
// directly. periodicSync itself is Chrome-only best-effort and entirely
// browser-timed — see app/sw-extensions.js and app/utils/periodic-sync.js —
// so it isn't something Playwright can drive regardless of permission state.
//
// This spec covers only what's deterministic in a real browser: the
// default-off pill state, and the always-denied-here toast path (which
// doubles as coverage for the genuine "permission already denied" case any
// real user who has blocked notifications for the site would hit).

const currentYear = new Date().getFullYear();

async function clickNotifBtn(page, value) {
  await page.evaluate(v => {
    document.querySelector('bottom-nav').shadowRoot
      .querySelector(`#notifications-group [data-notifications="${v}"]`).click();
  }, value);
}

function isPillActive(page, value) {
  return page.evaluate(v =>
    document.querySelector('bottom-nav').shadowRoot
      .querySelector(`#notifications-group [data-notifications="${v}"]`).classList.contains('active'),
  value);
}

function getStoredPref(page) {
  return page.evaluate(() => localStorage.getItem('telos:notificationsEnabled'));
}

test.describe('Notifications — settings toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
  });

  test('Off pill is active by default — opt-in, unlike the export reminder', async ({ page }) => {
    expect(await isPillActive(page, 'off')).toBe(true);
    expect(await isPillActive(page, 'on')).toBe(false);
  });

  test('clicking On with permission denied toasts and leaves it off', async ({ page }) => {
    await clickNotifBtn(page, 'on');
    await page.waitForSelector('#toast-container .socle-toast-info');
    expect(await getStoredPref(page)).not.toBe('true');
    expect(await isPillActive(page, 'off')).toBe(true);
  });

  // The "notify after" hour row is meaningful only once notifications are
  // actually on, which (see the module note above) can't be reached in
  // headless E2E at all — so this can't be a real interaction test. What it
  // *can* verify for real, and what a happy-dom unit test structurally
  // cannot (see CLAUDE.md's own note on [hidden] vs. author `display` CSS),
  // is that the row's [hidden] attribute actually renders as
  // `display: none` here, not just that the DOM property is set — the
  // `.hour-picker` rule sets `display: flex` unconditionally, which is
  // exactly the class of bug that silently un-hides an element despite
  // `hidden` being true.
  test('the notify-after-hour row is really display:none while notifications are off, not just [hidden] in the DOM', async ({ page }) => {
    const display = await page.evaluate(() =>
      getComputedStyle(
        document.querySelector('bottom-nav').shadowRoot.querySelector('#notify-hour-row')
      ).display
    );
    expect(display).toBe('none');
  });

  // The row itself only ever renders visible when notifications are actually
  // granted, which headless Chromium can't reach here (see the module note
  // above) — but the select's stored *value* is still updated on every
  // settings-open regardless of the row's own hidden state, so a real reload
  // still genuinely exercises "does the preference survive a page reload,"
  // just via the hidden control rather than a visibly-open one.
  test('a stored "notify after" hour survives a real reload', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('telos:notifyAfterHour', '9'));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
    const value = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#notify-hour-select').value
    );
    expect(value).toBe('9');
  });
});
