import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Shared helpers ────────────────────────────────────────────────────────────

function listDetailPage(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot.querySelector('list-detail-page').shadowRoot
  );
}

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
  await page.evaluate((n) => {
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

async function enterFirstList(page) {
  await page.evaluate(() => {
    const row = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelector('lists-page-item').shadowRoot
      .querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await waitForListDetailPage(page);
}

async function createItem(page, title) {
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
  await page.evaluate((t) => {
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
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) > 0
  );
}

async function openListDetailMenu(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#menu')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

async function openItemDialog(page) {
  await page.evaluate(() => {
    const row = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('list-item').shadowRoot
      .querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function waitForExportSheet(page) {
  await page.waitForFunction(() => {
    const sheet = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('export-sheet')?.shadowRoot
      ?.querySelector('#sheet')?.shadowRoot
      ?.querySelector('dialog');
    return sheet?.open;
  });
}

async function waitForToast(page) {
  await page.locator('#toast-container').waitFor({ state: 'visible' });
}

// ── Extract Markdown — list menu ──────────────────────────────────────────────

test.describe('Extract Markdown — list menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Extract test list');
    await enterFirstList(page);
  });

  test('Extract Markdown button appears in the list menu', async ({ page }) => {
    await openListDetailMenu(page);
    const btn = await page.evaluate(() =>
      !!document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#export-menu-btn')
    );
    expect(btn).toBe(true);
  });

  test('clicking Extract Markdown in menu opens the extract sheet', async ({ page }) => {
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#export-menu-btn').click();
    });
    await waitForExportSheet(page);
    const open = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('export-sheet')?.shadowRoot
        ?.querySelector('#sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    expect(open).toBe(true);
  });

  test('clicking Extract Markdown in extract sheet shows copied toast', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#export-menu-btn').click();
    });
    await waitForExportSheet(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('export-sheet').shadowRoot
        .querySelector('#copy-btn').click();
    });
    await waitForToast(page);
  });
});

// ── Extract Markdown — item dialog overflow ───────────────────────────────────

test.describe('Extract Markdown — item dialog overflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Item extract list');
    await enterFirstList(page);
    await createItem(page, 'Extractable item');
  });

  test('Extract Markdown button appears in the item overflow sheet', async ({ page }) => {
    await openItemDialog(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#menu-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#action-sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    const btn = await page.evaluate(() =>
      !!document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#action-export-btn')
    );
    expect(btn).toBe(true);
  });

  test('clicking Extract Markdown in item overflow opens the extract sheet', async ({ page }) => {
    await openItemDialog(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#menu-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#action-sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#action-export-btn').click();
    });
    await waitForExportSheet(page);
    const open = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('export-sheet')?.shadowRoot
        ?.querySelector('#sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    expect(open).toBe(true);
  });

  test('item extract copies content including item title to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openItemDialog(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#menu-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#action-sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#action-export-btn').click();
    });
    await waitForExportSheet(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('export-sheet').shadowRoot
        .querySelector('#copy-btn').click();
    });
    await waitForToast(page);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Extractable item');
  });
});
