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

function clickStatusBadge(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    item.shadowRoot.querySelector('.badge').click();
  });
}

function getItemStatus(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return item?._item?.status;
  });
}

// ── Item status cycle ─────────────────────────────────────────────────────────

test.describe('Item status cycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Cycle me');
  });

  test('new item starts with status "open"', async ({ page }) => {
    const status = await getItemStatus(page);
    expect(status).toBe('open');
  });

  test('tapping status badge on an open item sets status to "done"', async ({ page }) => {
    await clickStatusBadge(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return item?._item?.status === 'done';
    });

    expect(await getItemStatus(page)).toBe('done');
  });

  test('tapping status badge on a done item sets status to "paused"', async ({ page }) => {
    // First: open → done
    await clickStatusBadge(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return item?._item?.status === 'done';
    });

    // Second: done → paused
    await clickStatusBadge(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return item?._item?.status === 'paused';
    });

    expect(await getItemStatus(page)).toBe('paused');
  });

  test('tapping status badge on a paused item sets status to "closed"', async ({ page }) => {
    // open → done → paused → closed
    await clickStatusBadge(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'done'
    );

    await clickStatusBadge(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'paused'
    );

    await clickStatusBadge(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item')?._item?.status === 'closed'
    );

    expect(await getItemStatus(page)).toBe('closed');
  });

  test('full cycle open → done → paused → closed → open completes in 4 taps', async ({ page }) => {
    for (const expected of ['done', 'paused', 'closed', 'open']) {
      await clickStatusBadge(page);
      await page.waitForFunction(s =>
        document.querySelector('app-router')?.shadowRoot
          ?.querySelector('list-detail-page')?.shadowRoot
          ?.querySelector('#item-list list-item')?._item?.status === s
      , expected);
      expect(await getItemStatus(page)).toBe(expected);
    }
  });
});


// ── Field preservation across the cycle ───────────────────────────────────────
//
// Regression guard. The cycle handler used to re-save the item with only its
// title and new status, so note, url and tags were blanked on every tap. The
// suite above could not see it: it creates a title-only item and asserts only
// status, and an item with no other fields has nothing to lose. These seed a
// fully-populated item instead and check it through the real browser's badge
// click and a cold reload from IDB.

function seedState(page, patch) {
  return page.evaluate(p => new Promise((res, rej) => {
    const r = indexedDB.open('telos', 1);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('state', 'readwrite');
      const os = tx.objectStore('state');
      const g = os.get('root');
      g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}), ...p } });
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    r.onerror = () => rej(r.error);
  }), patch);
}

const FULL_ITEM = {
  id: 'i-full', title: 'Keep my fields', status: 'open',
  note: 'Peonies, not roses', url: 'https://example.com/florist',
  dueDate: '2026-12-01', color: '#E5534B',
  tags: ['gifts'], inGoals: [],
};

function readItem(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return item?._item;
  });
}

async function waitForStatus(page, status) {
  await page.waitForFunction(s =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list list-item')?._item?.status === s
  , status);
}

test.describe('Item status cycle — field preservation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await seedState(page, { lists: [{ id: 'l-full', name: 'Preserve list', items: [FULL_ITEM] }] });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
    );
  });

  test('one badge tap keeps note, url and tags', async ({ page }) => {
    await clickStatusBadge(page);
    await waitForStatus(page, 'done');

    const item = await readItem(page);
    expect(item.note).toBe('Peonies, not roses');
    expect(item.url).toBe('https://example.com/florist');
    expect(item.tags).toEqual(['gifts']);
    expect(item.dueDate).toBe('2026-12-01');
    expect(item.color).toBe('#E5534B');
    expect(item.title).toBe('Keep my fields');
  });

  test('a full four-tap cycle leaves every field intact', async ({ page }) => {
    for (const expected of ['done', 'paused', 'closed', 'open']) {
      await clickStatusBadge(page);
      await waitForStatus(page, expected);
    }
    expect(await readItem(page)).toEqual(FULL_ITEM);
  });

  test('fields survive the cycle through a cold reload from IDB', async ({ page }) => {
    await clickStatusBadge(page);
    await waitForStatus(page, 'done');
    await waitForIDBFlush(page);

    // The reload keeps the list-detail route, so this lands straight back on
    // the item rather than on the year page.
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForListDetailPage(page);
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
    );

    expect(await readItem(page)).toEqual({ ...FULL_ITEM, status: 'done' });
  });
});
