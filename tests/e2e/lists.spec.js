import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navToLists(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
  );
  await waitForListsPage(page);
}

async function navToYears(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-years').click()
  );
  await waitForPage(page);
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
      .querySelector('#save').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#list-container')?.querySelectorAll('.list-row').length ?? 0) > 0
  );
}

async function enterFirstList(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('.list-row').click();
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
      .querySelector('#save').click();
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
      ?.querySelector('#menu')?.open
  );
}

async function swipeListItemLeft(page) {
  const box = await page.evaluate(() => {
    const el = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('list-item');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) throw new Error('list-item not found for swipe');
  const midY = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, midY);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, midY, { steps: 15 });
  await page.mouse.up();
}

async function swipeListItemRight(page) {
  const box = await page.evaluate(() => {
    const el = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('list-item');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) throw new Error('list-item not found for swipe');
  const midY = box.y + box.height / 2;
  await page.mouse.move(box.x + 20, midY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 20, midY, { steps: 15 });
  await page.mouse.up();
}

// ── Add buttons ───────────────────────────────────────────────────────────────

test.describe('Lists — add buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('lists-page add row is present with + text', async ({ page }) => {
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#add-row').textContent.trim()
    );
    expect(text).toContain('+');
  });

  test('lists-page add row opens the new-list dialog', async ({ page }) => {
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
  });

  test('list-detail-page add row is present with + text', async ({ page }) => {
    await createList(page, 'Test list');
    await enterFirstList(page);
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#add-row').textContent.trim()
    );
    expect(text).toContain('+');
  });

  test('list-detail-page add row opens the new-item dialog', async ({ page }) => {
    await createList(page, 'Test list');
    await enterFirstList(page);
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
  });
});

// ── Tab navigation memory ─────────────────────────────────────────────────────

test.describe('Lists — tab navigation memory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Ideas');
    await enterFirstList(page);
  });

  test('Lists tab returns to last viewed list detail after switching to Years', async ({ page }) => {
    const listDetailPath = await page.evaluate(() => window.location.pathname);

    await navToYears(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
    );
    await waitForListDetailPage(page);

    const returnedPath = await page.evaluate(() => window.location.pathname);
    expect(returnedPath).toBe(listDetailPath);
  });

  test('Lists pill is a no-op when already on a list detail', async ({ page }) => {
    const pathBefore = await page.evaluate(() => window.location.pathname);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
    );
    await page.waitForTimeout(100);

    const pathAfter = await page.evaluate(() => window.location.pathname);
    expect(pathAfter).toBe(pathBefore);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe('Lists — navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('back button from list detail returns to /lists', async ({ page }) => {
    await createList(page, 'Back button test');
    await enterFirstList(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#back-btn').click();
    });
    await waitForListsPage(page);
    const path = await page.evaluate(() => window.location.pathname);
    expect(path).toMatch(/\/lists$/);
  });

  test('keyboard Enter on a list row navigates to list detail', async ({ page }) => {
    await createList(page, 'Keyboard nav test');
    await page.evaluate(() => {
      const row = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('.list-row');
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    });
    await waitForListDetailPage(page);
  });
});

// ── List management ───────────────────────────────────────────────────────────

test.describe('Lists — list management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('created list persists after page reload', async ({ page }) => {
    await createList(page, 'Persist me');
    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await navToLists(page);
    const name = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('.list-name')?.textContent
    );
    expect(name).toBe('Persist me');
  });

  test('renaming a list updates the row name', async ({ page }) => {
    await createList(page, 'Old name');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('.edit-btn').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('list-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector('#input');
      inp.value = 'New name';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector('#save').click();
    });
    await page.waitForFunction(() => {
      const el = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('.list-name');
      return el?.textContent === 'New name';
    });
  });

  test('deleting a list removes it from the page', async ({ page }) => {
    await createList(page, 'Delete me');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('.edit-btn').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('list-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector('#delete').click();
    });
    await page.waitForFunction(() => {
      const count = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('.list-row').length ?? 0;
      return count === 0;
    });
  });
});

// ── Item management ───────────────────────────────────────────────────────────

test.describe('Lists — item management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Items test');
    await enterFirstList(page);
  });

  test('adding an item shows it in the list', async ({ page }) => {
    await createItem(page, 'First item');
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item')?.shadowRoot?.querySelector('.title')?.textContent
    );
    expect(title).toBe('First item');
  });

  test('added item persists after page reload', async ({ page }) => {
    await createItem(page, 'Persisted item');
    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // After reload, the browser returns to the list-detail URL directly
    await waitForListDetailPage(page);
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) > 0
    );
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item')?.shadowRoot?.querySelector('.title')?.textContent
    );
    expect(title).toBe('Persisted item');
  });

  test('tapping an item opens the edit dialog with its title pre-filled', async ({ page }) => {
    await createItem(page, 'Tap to edit');
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
    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#title-input')?.value
    );
    expect(val).toBe('Tap to edit');
  });

  test('editing an item via dialog updates its title in the list', async ({ page }) => {
    await createItem(page, 'Original title');
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
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#title-input');
      inp.value = 'Edited title';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#save').click();
    });
    await page.waitForFunction(() => {
      const title = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.shadowRoot?.querySelector('.title')?.textContent;
      return title === 'Edited title';
    });
  });

  test('deleting an item via dialog removes it from the list', async ({ page }) => {
    await createItem(page, 'To delete');
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
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#delete').click();
    });
    await page.waitForFunction(() => {
      const count = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0;
      return count === 0;
    });
  });
});

// ── Status toggle ─────────────────────────────────────────────────────────────

test.describe('Lists — status toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Status test');
    await enterFirstList(page);
    await createItem(page, 'Item A');
  });

  test('menu button opens the menu dialog', async ({ page }) => {
    await openListDetailMenu(page);
    const open = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#menu')?.open
    );
    expect(open).toBe(true);
  });

  test('toggle defaults to "Hide status" (status visible by default)', async ({ page }) => {
    const text = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#toggle-status-btn')?.textContent
    );
    expect(text).toBe('Hide status');
  });

  test('clicking toggle changes button text to "Show status" and hides badges', async ({ page }) => {
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#toggle-status-btn').click();
    });
    const [btnText, cssVar] = await page.evaluate(() => {
      const page = document.querySelector('app-router')?.shadowRoot?.querySelector('list-detail-page')?.shadowRoot;
      return [
        page?.querySelector('#toggle-status-btn')?.textContent,
        page?.querySelector('#item-list')?.style.getPropertyValue('--list-badge-display'),
      ];
    });
    expect(btnText).toBe('Show status');
    expect(cssVar).toBe('none');
  });

  test('status toggle preference persists after page reload', async ({ page }) => {
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#toggle-status-btn').click();
    });
    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForListDetailPage(page);
    await page.waitForFunction(() => {
      const btn = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#toggle-status-btn');
      return btn?.textContent === 'Show status';
    });
  });
});

// ── Swipe gestures ────────────────────────────────────────────────────────────

test.describe('Lists — swipe gestures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Swipe test');
    await enterFirstList(page);
    await createItem(page, 'Swipeable item');
  });

  test('swipe left then click delete removes the item', async ({ page }) => {
    await swipeListItemLeft(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('#delete-btn').dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
        );
    });
    await page.waitForFunction(() => {
      const count = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0;
      return count === 0;
    });
  });

  test('swipe right then click done marks the item as done', async ({ page }) => {
    await swipeListItemRight(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('#done-btn').dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
        );
    });
    await page.waitForFunction(() => {
      const badge = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.shadowRoot?.querySelector('.badge');
      return badge?.dataset.status === 'done';
    });
  });

  test('clicking done button on a done item restores it to open', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('#done-btn').dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
        );
    });
    await page.waitForFunction(() => {
      const badge = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.shadowRoot?.querySelector('.badge');
      return badge?.dataset.status === 'done';
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('#done-btn').dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
        );
    });
    await page.waitForFunction(() => {
      const badge = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.shadowRoot?.querySelector('.badge');
      return badge?.dataset.status === 'open';
    });
  });
});
