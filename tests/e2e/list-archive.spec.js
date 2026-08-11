import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navToLists(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
  );
  await waitForListsPage(page);
}

async function createList(page, name) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#add-row').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('list-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
  await page.evaluate(n => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#input');
    inp.value = n;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#close').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) >= 1
  );
}

async function openFirstList(page) {
  await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container lists-page-item');
    const row = item.shadowRoot.querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await waitForListDetailPage(page);
}

async function openRenameDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#name-edit-btn').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('list-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function clickArchiveInDetailDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#archive').click();
  });
}

function archiveButtonText(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#archive').textContent
  );
}

async function closeDetailDialogAndGoBack(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#close').click();
  });
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#back-btn').click();
  });
  await waitForListsPage(page);
}

async function openFilterBarAndPanel(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#filter-btn').click();
  });
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#filter-bar')?.hidden
  );
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#filter-expand-btn').click();
  });
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#filter-panel')?.hidden
  );
}

async function clickArchivedPill(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#archived-btn').click();
  });
}

function listVisibility(page, name) {
  return page.evaluate(n => {
    const item = [...document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelectorAll('lists-page-item')]
      .find(el => el.shadowRoot.querySelector('.list-name')?.textContent === n);
    return item ? !item.hidden : null;
  }, name);
}

// ── Archive a list ────────────────────────────────────────────────────────────

test.describe('List archive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Archive me');
  });

  test('archiving a list from the rename dialog hides it from the overview by default', async ({ page }) => {
    await openFirstList(page);
    await openRenameDialog(page);
    await clickArchiveInDetailDialog(page);
    expect(await archiveButtonText(page)).toBe('Unarchive');
    await closeDetailDialogAndGoBack(page);

    expect(await listVisibility(page, 'Archive me')).toBe(false);
  });

  test('the Archived filter pill reveals an archived list', async ({ page }) => {
    await openFirstList(page);
    await openRenameDialog(page);
    await clickArchiveInDetailDialog(page);
    await closeDetailDialogAndGoBack(page);

    await openFilterBarAndPanel(page);
    await clickArchivedPill(page);
    expect(await listVisibility(page, 'Archive me')).toBe(true);
  });

  test('unarchiving restores default visibility', async ({ page }) => {
    await openFirstList(page);
    await openRenameDialog(page);
    await clickArchiveInDetailDialog(page); // archive
    await clickArchiveInDetailDialog(page); // unarchive
    expect(await archiveButtonText(page)).toBe('Archive');
    await closeDetailDialogAndGoBack(page);

    expect(await listVisibility(page, 'Archive me')).toBe(true);
  });
});
