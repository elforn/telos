import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Shared helpers ────────────────────────────────────────────────────────────

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

async function navToFirstList(page) {
  await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelector('lists-page-item');
    const row = item.shadowRoot.querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await waitForListDetailPage(page);
}

async function addItem(page, title) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#add-row').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#title-input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#close').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
  );
}

// Dispatches `count` quick taps (pointerdown+pointerup pairs) on the row in a
// single synchronous evaluate() call, so they land well inside the
// MULTI_TAP_WINDOW regardless of how fast the test runner itself is.
function tapRow(page, count) {
  return page.evaluate(n => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    const row = item.shadowRoot.querySelector('.row');
    for (let i = 0; i < n; i++) {
      row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    }
  }, count);
}

function getItemStatus(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return item?._item?.status;
  });
}

function isItemDialogOpen(page) {
  return page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open ?? false
  );
}

// ── Triple-tap to complete ───────────────────────────────────────────────────

test.describe('List item — triple-tap to complete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Tap me');
  });

  test('a single tap opens the edit dialog', async ({ page }) => {
    await tapRow(page, 1);
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    expect(await isItemDialogOpen(page)).toBe(true);
    expect(await getItemStatus(page)).toBe('open');
  });

  test('exactly two taps is a no-op — no dialog, no status change', async ({ page }) => {
    await tapRow(page, 2);
    // Wait past MULTI_TAP_WINDOW (300ms) to let the debounce resolve, then
    // confirm neither outcome fired.
    await page.waitForTimeout(500);
    expect(await isItemDialogOpen(page)).toBe(false);
    expect(await getItemStatus(page)).toBe('open');
  });

  test('a triple tap marks the item done without opening the dialog', async ({ page }) => {
    await tapRow(page, 3);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'done'
    );
    expect(await getItemStatus(page)).toBe('done');
    expect(await isItemDialogOpen(page)).toBe(false);
  });

  test('a second triple tap toggles a done item back to open', async ({ page }) => {
    await tapRow(page, 3);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'done'
    );

    await tapRow(page, 3);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'open'
    );

    expect(await getItemStatus(page)).toBe('open');
  });

  test('triple tap persists across page reload', async ({ page }) => {
    await tapRow(page, 3);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'done'
    );

    await page.goto(`/${currentYear}`);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);

    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item
    );
    expect(await getItemStatus(page)).toBe('done');
  });
});
