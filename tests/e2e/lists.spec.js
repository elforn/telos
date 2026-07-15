import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

function listsPage(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot.querySelector('lists-page').shadowRoot
  );
}

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

async function createList(page, name, expectedCount = 1) {
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
  await page.waitForFunction((count) =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) >= count,
    expectedCount
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

async function tapListRow(page, index = 0) {
  await page.evaluate((idx) => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelectorAll('lists-page-item')[idx];
    const row = item.shadowRoot.querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  }, index);
}

async function getListNames(page) {
  return page.evaluate(() =>
    [...document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelectorAll('lists-page-item')]
      .map(item => item.shadowRoot.querySelector('.list-name')?.textContent ?? '')
  );
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

  test('Lists pill navigates back to /lists when on a list detail', async ({ page }) => {
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
    );
    await waitForListsPage(page);
    const pathAfter = await page.evaluate(() => window.location.pathname);
    expect(pathAfter).toMatch(/\/lists$/);
  });

  test('Years pill navigates to current year when on a different year', async ({ page }) => {
    await navToYears(page);
    await page.goto(`/${currentYear - 1}`);
    await waitForPage(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-years').click()
    );
    await waitForPage(page);
    const pathAfter = await page.evaluate(() => window.location.pathname);
    expect(pathAfter).toMatch(new RegExp(`/${currentYear}$`));
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

  test('keyboard Enter on list row navigates to list detail', async ({ page }) => {
    await createList(page, 'Keyboard nav test');
    await page.evaluate(() => {
      const row = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelector('lists-page-item').shadowRoot
        .querySelector('.row');
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    });
    await waitForListDetailPage(page);
    const path = await page.evaluate(() => window.location.pathname);
    expect(path).toMatch(/\/lists\/.+/);
  });
});

// ── List row navigation ───────────────────────────────────────────────────────

test.describe('Lists — list row navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Nav test list');
  });

  test('tapping a list row navigates to list detail page', async ({ page }) => {
    await enterFirstList(page);
    const path = await page.evaluate(() => window.location.pathname);
    expect(path).toMatch(/\/lists\/.+/);
  });

  test('row tap navigates to the correct list', async ({ page }) => {
    await createList(page, 'Second list', 2);
    // Navigate to first list by tapping its row
    await page.evaluate(() => {
      const row = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[0].shadowRoot
        .querySelector('.row');
      row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    });
    await waitForListDetailPage(page);
    const name = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#list-name')?.textContent
    );
    expect(name).toBe('Nav test list');
  });

  test('tapping the row navigates to the list detail page with the correct name', async ({ page }) => {
    await tapListRow(page, 0);
    await waitForListDetailPage(page);
    const path = await page.evaluate(() => window.location.pathname);
    expect(path).toMatch(/\/lists\/.+/);
    const name = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#list-name')?.textContent
    );
    expect(name).toBe('Nav test list');
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
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) > 0
    );
    const name = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelector('lists-page-item').shadowRoot
        .querySelector('.list-name')?.textContent
    );
    expect(name).toBe('Persist me');
  });

  test('renaming a list via detail page updates the row name', async ({ page }) => {
    await createList(page, 'Old name');
    await enterFirstList(page);
    // Open edit dialog from the detail page name button
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
    await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-dialog').shadowRoot;
      const inp = sr.querySelector('#input');
      inp.value = 'New name';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('blur'));
      sr.querySelector('#close').click();
    });
    // Go back and verify
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#back-btn').click();
    });
    await waitForListsPage(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')
        ?.querySelector('lists-page-item');
      return item?.shadowRoot?.querySelector('.list-name')?.textContent === 'New name';
    });
  });

  test('deleting a list via detail page menu removes it from the lists page', async ({ page }) => {
    await createList(page, 'Delete me');
    await enterFirstList(page);
    // Open the detail page menu
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
    // Single click — immediately deletes and navigates back to /lists
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#list-delete-btn').click();
    });
    await waitForListsPage(page);
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) === 0
    );
  });
});

// ── Drag to reorder ───────────────────────────────────────────────────────────

test.describe('Lists — drag to reorder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Alpha', 1);
    await createList(page, 'Beta', 2);
    await createList(page, 'Gamma', 3);
  });

  test('keyboard ArrowDown on drag button moves list down one position', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[0].shadowRoot
        .querySelector('#drag-btn').focus();
    });
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => {
      const items = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item');
      return items[0]?.shadowRoot?.querySelector('.list-name')?.textContent === 'Beta';
    });
    const names = await getListNames(page);
    expect(names).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  test('keyboard ArrowUp on drag button moves list up one position', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[2].shadowRoot
        .querySelector('#drag-btn').focus();
    });
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => {
      const items = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item');
      return items[1]?.shadowRoot?.querySelector('.list-name')?.textContent === 'Gamma';
    });
    const names = await getListNames(page);
    expect(names).toEqual(['Alpha', 'Gamma', 'Beta']);
  });

  test('ArrowDown on the last item is a no-op', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[2].shadowRoot
        .querySelector('#drag-btn').focus();
    });
    await page.keyboard.press('ArrowDown');
    const names = await getListNames(page);
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('ArrowUp on the first item is a no-op', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[0].shadowRoot
        .querySelector('#drag-btn').focus();
    });
    await page.keyboard.press('ArrowUp');
    const names = await getListNames(page);
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('mouse drag moves list to a new position', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const items = [...document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')];
      return items.map(item => {
        const btn  = item.shadowRoot.querySelector('#drag-btn');
        const br   = btn.getBoundingClientRect();
        const ir   = item.getBoundingClientRect();
        return {
          dragX:  br.x + br.width / 2,
          dragY:  br.y + br.height / 2,
          bottom: ir.y + ir.height,
        };
      });
    });

    // Drag Alpha (0) below Gamma (2)
    await page.mouse.move(positions[0].dragX, positions[0].dragY);
    await page.mouse.down();
    await page.mouse.move(positions[2].dragX, positions[2].bottom + 10, { steps: 20 });
    await page.mouse.up();

    await page.waitForFunction(() => {
      const items = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item');
      return items[0]?.shadowRoot?.querySelector('.list-name')?.textContent === 'Beta';
    });
    const names = await getListNames(page);
    expect(names).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  test('reordered list persists after page reload', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item')[0].shadowRoot
        .querySelector('#drag-btn').focus();
    });
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => {
      const items = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelectorAll('lists-page-item');
      return items[0]?.shadowRoot?.querySelector('.list-name')?.textContent === 'Beta';
    });
    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await navToLists(page);
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) >= 3
    );
    const names = await getListNames(page);
    expect(names).toEqual(['Beta', 'Alpha', 'Gamma']);
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
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot;
      const inp = sr.querySelector('#title-input');
      inp.value = 'Edited title';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('blur'));
      sr.querySelector('#close').click();
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
    // First click — enter confirm state
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#delete').click();
    });
    // Second click — confirm deletion
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

// ── Undo ──────────────────────────────────────────────────────────────────────

async function deleteListViaMenu(page) {
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
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#list-delete-btn').click();
  });
  await waitForListsPage(page);
}

test.describe('Lists — undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('undo after list deletion restores the list on the lists page', async ({ page }) => {
    await createList(page, 'Undo me');
    await enterFirstList(page);
    await deleteListViaMenu(page);
    // List is immediately removed
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) === 0
    );
    // Undo toast should be visible with the undo button
    await expect(page.locator('.socle-toast-info')).toContainText('“Undo me” deleted');
    await page.locator('.socle-toast-btn').click();
    // List is restored
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) === 1
    );
    const name = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container')
        .querySelector('lists-page-item').shadowRoot
        .querySelector('.list-name')?.textContent
    );
    expect(name).toBe('Undo me');
  });

  test('undo after item deletion via dialog restores the item', async ({ page }) => {
    await createList(page, 'Undo items');
    await enterFirstList(page);
    await createItem(page, 'Undo item');
    // Open the item
    await page.evaluate(() => {
      const row = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot.querySelector('.row');
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
    // Delete — single click, immediate
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#delete').click();
    });
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) === 0
    );
    // Undo
    await expect(page.locator('.socle-toast-info')).toContainText('Item deleted');
    await page.locator('.socle-toast-btn').click();
    // Item is restored
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) === 1
    );
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item')?.shadowRoot?.querySelector('.title')?.textContent
    );
    expect(title).toBe('Undo item');
  });

  test('undo after item deletion via swipe restores the item', async ({ page }) => {
    await createList(page, 'Undo swipe');
    await enterFirstList(page);
    await createItem(page, 'Swipe undo item');
    await swipeListItemLeft(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('#delete-btn').dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 })
        );
    });
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) === 0
    );
    // Undo
    await expect(page.locator('.socle-toast-info')).toContainText('Item deleted');
    await page.locator('.socle-toast-btn').click();
    // Item is restored
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) === 1
    );
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item')?.shadowRoot?.querySelector('.title')?.textContent
    );
    expect(title).toBe('Swipe undo item');
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

  test('show pill is active by default (status visible)', async ({ page }) => {
    const active = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#status-show-btn')?.classList.contains('active')
    );
    expect(active).toBe(true);
  });

  test('clicking hide pill hides badges and makes hide pill active', async ({ page }) => {
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#status-hide-btn').click();
    });
    const [hideActive, cssVar] = await page.evaluate(() => {
      const sr = document.querySelector('app-router')?.shadowRoot?.querySelector('list-detail-page')?.shadowRoot;
      return [
        sr?.querySelector('#status-hide-btn')?.classList.contains('active'),
        sr?.querySelector('#item-list')?.style.getPropertyValue('--list-badge-display'),
      ];
    });
    expect(hideActive).toBe(true);
    expect(cssVar).toBe('none');
  });

  test('status hidden preference persists after page reload', async ({ page }) => {
    await openListDetailMenu(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#status-hide-btn').click();
    });
    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForListDetailPage(page);
    await page.waitForFunction(() => {
      const btn = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#status-hide-btn');
      return btn?.classList.contains('active') === true;
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
    // Single pointerup — immediately deletes (no confirm flow; shows undo toast instead)
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
