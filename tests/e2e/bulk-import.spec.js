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

async function openMenuDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#menu');
    return d?.open;
  });
}

async function openImportDialog(page) {
  await openMenuDialog(page);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#import-menu-btn').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#import-dialog')?.shadowRoot
      ?.querySelector('dialog');
    return d?.open;
  });
}

async function typeInImportTextarea(page, text) {
  await page.evaluate(t => {
    const ta = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#import-textarea');
    ta.value = t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function confirmImport(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#import-cta-btn').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#import-dialog')?.shadowRoot
      ?.querySelector('dialog');
    return !d?.open;
  });
}

function itemCount(page) {
  return page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0
  );
}

// ── Bulk import — dialog ──────────────────────────────────────────────────────

test.describe('Bulk import — dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Import test');
    await navToFirstList(page);
  });

  test('overflow menu has an import option', async ({ page }) => {
    await openMenuDialog(page);
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#import-menu-btn').textContent.trim()
    );
    expect(text.length).toBeGreaterThan(0);
  });

  test('clicking import option opens the import dialog', async ({ page }) => {
    await openImportDialog(page);
    const open = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#import-dialog')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    expect(open).toBe(true);
  });

  test('import CTA is disabled with empty textarea', async ({ page }) => {
    await openImportDialog(page);
    const disabled = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#import-cta-btn').disabled
    );
    expect(disabled).toBe(true);
  });

  test('typing text enables the CTA and shows item count', async ({ page }) => {
    await openImportDialog(page);
    await typeInImportTextarea(page, 'Buy milk\nCall dentist\nGo for a walk');

    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#import-count');
      return !el?.hidden;
    });

    const [countText, ctaDisabled] = await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot;
      return [
        sr.querySelector('#import-count').textContent,
        sr.querySelector('#import-cta-btn').disabled,
      ];
    });
    expect(countText).toContain('3');
    expect(ctaDisabled).toBe(false);
  });

  test('cancel closes the dialog without adding items', async ({ page }) => {
    await openImportDialog(page);
    await typeInImportTextarea(page, 'Item A\nItem B');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#import-cancel-btn').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#import-dialog')?.shadowRoot
        ?.querySelector('dialog');
      return !d?.open;
    });

    expect(await itemCount(page)).toBe(0);
  });
});

// ── Bulk import — items ───────────────────────────────────────────────────────

test.describe('Bulk import — items', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Import test');
    await navToFirstList(page);
    await openImportDialog(page);
  });

  test('confirming import adds one item per non-empty line', async ({ page }) => {
    await typeInImportTextarea(page, 'Alpha\nBeta\nGamma');
    await confirmImport(page);

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 3
    );
    expect(await itemCount(page)).toBe(3);
  });

  test('indented line becomes a note on the preceding item', async ({ page }) => {
    await typeInImportTextarea(page, 'Main task\n  This is the note');
    await confirmImport(page);

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
    );

    expect(await itemCount(page)).toBe(1);

    const item = await page.evaluate(() => {
      const el = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      return { title: el?._item?.title, note: el?._item?.note };
    });
    expect(item.title).toBe('Main task');
    expect(item.note).toBe('This is the note');
  });

  test('bullet-prefixed lines are stripped of their bullet characters', async ({ page }) => {
    await typeInImportTextarea(page, '- First\n- Second');
    await confirmImport(page);

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 2
    );

    const titles = await page.evaluate(() =>
      [...document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list').querySelectorAll('list-item')]
        .map(el => el._item?.title)
    );
    expect(titles).toContain('First');
    expect(titles).toContain('Second');
  });
});
