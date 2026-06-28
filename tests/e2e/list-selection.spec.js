import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

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
      .querySelector('#save').click();
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
  const countBefore = await page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0
  );

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
      .querySelector('#save').click();
  });
  await page.waitForFunction(count =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) > count
  , countBefore);
}

function itemCount(page) {
  return page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0
  );
}

// ── Selection mode — entry ────────────────────────────────────────────────────

test.describe('Selection mode — entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Alpha');
    await addItem(page, 'Beta');
  });

  test('long-pressing an item shows the bulk bar', async ({ page }) => {
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-bar').hidden
    );
    expect(hidden).toBe(false);
  });

  test('long-pressing hides the menu button', async ({ page }) => {
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    const menuHidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#menu-btn').hidden
    );
    expect(menuHidden).toBe(true);
  });
});

// ── Selection mode — bulk delete ──────────────────────────────────────────────

test.describe('Selection mode — bulk delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Alpha');
    await addItem(page, 'Beta');
  });

  test('deleting the selected item removes it from the list', async ({ page }) => {
    const before = await itemCount(page);
    expect(before).toBe(2);

    // Long-press first item to select it and enter selection mode
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    // Click the delete button
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-delete-btn').click();
    });

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) < 2
    );

    const after = await itemCount(page);
    expect(after).toBe(1);
  });

  test('selecting a second item and deleting removes both', async ({ page }) => {
    const before = await itemCount(page);
    expect(before).toBe(2);

    // Long-press first item
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    // Tap the second item to add it to selection
    await page.evaluate(() => {
      const items = [...document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list').querySelectorAll('list-item')];
      items[1].onTap();
    });

    // Wait for the count to reflect 2 selected items
    await page.waitForFunction(() => {
      const countEl = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-count');
      return countEl?.textContent?.includes('2');
    });

    // Delete both
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-delete-btn').click();
    });

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) === 0
    );

    const after = await itemCount(page);
    expect(after).toBe(0);
  });

  test('closing the bulk bar via X exits selection mode', async ({ page }) => {
    // Enter selection mode
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    // Click close button
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-close-btn').click();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return bar?.hidden === true;
    });

    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-bar').hidden
    );
    expect(hidden).toBe(true);
  });

  test('bulk delete persists after page reload', async ({ page }) => {
    // Long-press first item and delete it
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      item.onLongPress();
    });

    await page.waitForFunction(() => {
      const bar = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#bulk-bar');
      return !bar?.hidden;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#bulk-delete-btn').click();
    });

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) < 2
    );

    await waitForIDBFlush(page);
    await page.goto(`/${currentYear}`);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list') !== null
    );

    const after = await itemCount(page);
    expect(after).toBe(1);
  });
});
