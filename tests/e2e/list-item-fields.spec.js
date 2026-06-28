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

async function openNewItemDialog(page) {
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
}

async function fillTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#title-input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
}

async function saveItemDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#save').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
  );
}

async function openExistingItemDialog(page) {
  await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    const row = item.shadowRoot.querySelector('.row');
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

function itemField(page, field) {
  return page.evaluate(f => {
    const el = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return el?._item?.[f];
  }, field);
}

// ── List item — note ──────────────────────────────────────────────────────────

test.describe('List item — note', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await openNewItemDialog(page);
    await fillTitle(page, 'Item with note');
    await page.evaluate(() => {
      const ta = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#note-input');
      ta.value = 'A helpful note';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await saveItemDialog(page);
  });

  test('note is saved with the item', async ({ page }) => {
    const note = await itemField(page, 'note');
    expect(note).toBe('A helpful note');
  });

  test('note is pre-populated when reopening the item dialog', async ({ page }) => {
    await openExistingItemDialog(page);
    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#note-input').value
    );
    expect(val).toBe('A helpful note');
  });

  test('note persists across page reload', async ({ page }) => {
    await waitForIDBFlush(page);
    await page.goto(`/${currentYear}`);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);

    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return !!el?._item?.note;
    });

    const note = await itemField(page, 'note');
    expect(note).toBe('A helpful note');
  });
});

// ── List item — URL ───────────────────────────────────────────────────────────

test.describe('List item — URL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await openNewItemDialog(page);
    await fillTitle(page, 'Item with URL');
  });

  test('URL row is hidden by default and shown after toggling', async ({ page }) => {
    const hiddenBefore = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('.url-row').hidden
    );
    expect(hiddenBefore).toBe(true);

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#url-toggle').click();
    });

    await page.waitForFunction(() => {
      const row = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('.url-row');
      return !row?.hidden;
    });

    const hiddenAfter = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('.url-row').hidden
    );
    expect(hiddenAfter).toBe(false);
  });

  test('URL is saved with the item', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#url-toggle').click();
    });
    await page.waitForFunction(() => {
      const row = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('.url-row');
      return !row?.hidden;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#url-input');
      inp.value = 'https://example.com';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await saveItemDialog(page);

    const url = await itemField(page, 'url');
    expect(url).toBe('https://example.com');
  });

  test('URL persists across page reload', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#url-toggle').click();
    });
    await page.waitForFunction(() => {
      const row = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('.url-row');
      return !row?.hidden;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#url-input');
      inp.value = 'https://persist.example.com';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await saveItemDialog(page);

    await waitForIDBFlush(page);
    await page.goto(`/${currentYear}`);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);

    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return !!el?._item?.url;
    });

    const url = await itemField(page, 'url');
    expect(url).toBe('https://persist.example.com');
  });
});

// ── List item — tags ──────────────────────────────────────────────────────────

test.describe('List item — tags', () => {
  async function addTagInDialog(page, tag) {
    await page.evaluate(tagVal => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#tag-input');
      inp.value = tagVal;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    }, tag);
    await page.waitForFunction(tagVal => {
      const wrap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#tag-chips-wrap');
      return [...(wrap?.querySelectorAll('.tag-chip') ?? [])].some(c => c.textContent.includes(tagVal));
    }, tag);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await openNewItemDialog(page);
    await fillTitle(page, 'Tagged item');
    await addTagInDialog(page, 'urgent');
    await saveItemDialog(page);
  });

  test('tag is saved with the item', async ({ page }) => {
    const tags = await itemField(page, 'tags');
    expect(tags).toContain('urgent');
  });

  test('tag is pre-populated in the edit dialog', async ({ page }) => {
    await openExistingItemDialog(page);

    const chips = await page.evaluate(() =>
      [...document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#tag-chips-wrap')
        .querySelectorAll('.tag-chip')]
        .map(c => c.dataset.tag)
    );
    expect(chips).toContain('urgent');
  });

  test('tag persists across page reload', async ({ page }) => {
    await waitForIDBFlush(page);
    await page.goto(`/${currentYear}`);
    await waitForPage(page);
    await navToLists(page);
    await navToFirstList(page);

    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return (el?._item?.tags ?? []).length > 0;
    });

    const tags = await itemField(page, 'tags');
    expect(tags).toContain('urgent');
  });

  test('removing a tag chip in edit dialog removes the tag', async ({ page }) => {
    await openExistingItemDialog(page);

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#tag-chips-wrap .tag-chip')?.click();
    });

    await page.waitForFunction(() => {
      const wrap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#tag-chips-wrap');
      return wrap?.querySelectorAll('.tag-chip').length === 0;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#save').click();
    });

    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list list-item');
      return (el?._item?.tags ?? ['placeholder']).length === 0;
    });

    const tags = await itemField(page, 'tags');
    expect(tags).toHaveLength(0);
  });
});
