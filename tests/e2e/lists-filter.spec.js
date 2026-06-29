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

async function addItemToFirstList(page, itemTitle) {
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
  // Add item via dialog
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
  }, itemTitle);
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
  // Navigate back to lists page
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#back-btn').click();
  });
  await waitForListsPage(page);
}

function listsPageSR(page) {
  return page.evaluate((sel) =>
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector(sel),
    null
  );
}

async function openFilterBar(page) {
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
}

async function typeInFilter(page, text) {
  await page.evaluate((q) => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#filter-search');
    inp.value = q;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function clickExpandBtn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#filter-expand-btn').click();
  });
}

async function openFilterPanel(page) {
  await clickExpandBtn(page);
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#filter-panel')?.hidden
  );
}

async function clickEmptyPill(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#empty-btn').click();
  });
}

async function clickNotEmptyPill(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#not-empty-btn').click();
  });
}

async function getListVisibility(page) {
  return page.evaluate(() =>
    [...document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelectorAll('lists-page-item')]
      .map(el => ({
        name: el.shadowRoot.querySelector('.list-name')?.textContent ?? '',
        hidden: el.hidden,
      }))
  );
}

// ── Filter bar toggle ─────────────────────────────────────────────────────────

test.describe('Lists — filter bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('filter bar is hidden on initial load', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(true);
  });

  test('filter button opens the filter bar', async ({ page }) => {
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(false);
  });

  test('filter button closes the filter bar when clicked again', async ({ page }) => {
    await openFilterBar(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(true);
  });

  test('filter-expand-btn has aria-controls pointing to filter-panel', async ({ page }) => {
    const ariaControls = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-expand-btn').getAttribute('aria-controls')
    );
    expect(ariaControls).toBe('filter-panel');
  });
});

// ── Filter panel (chevron) ────────────────────────────────────────────────────

test.describe('Lists — filter panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await openFilterBar(page);
  });

  test('filter panel is hidden when filter bar first opens', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });

  test('expand button opens the filter panel', async ({ page }) => {
    await openFilterPanel(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(false);
  });

  test('expand button closes the filter panel when clicked again', async ({ page }) => {
    await openFilterPanel(page);
    await clickExpandBtn(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#filter-panel')?.hidden === true
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });

  test('closing the filter bar collapses the filter panel', async ({ page }) => {
    await openFilterPanel(page);
    // Close bar
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    // Reopen bar
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });
});

// ── Text search ───────────────────────────────────────────────────────────────

test.describe('Lists — filter text search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Apple', 1);
    await createList(page, 'Banana', 2);
    await openFilterBar(page);
  });

  test('text search hides non-matching lists', async ({ page }) => {
    await typeInFilter(page, 'apple');
    const items = await getListVisibility(page);
    expect(items.find(v => v.name === 'Apple')?.hidden).toBe(false);
    expect(items.find(v => v.name === 'Banana')?.hidden).toBe(true);
  });

  test('no-match message appears when no lists match', async ({ page }) => {
    await typeInFilter(page, 'zzznomatch');
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-empty').hidden
    );
    expect(hidden).toBe(false);
  });

  test('live region announces match count when filter is active', async ({ page }) => {
    await typeInFilter(page, 'apple');
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-live').textContent
    );
    expect(text).toContain('1');
  });

  test('live region is empty when no filter is active', async ({ page }) => {
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-live').textContent
    );
    expect(text).toBe('');
  });

  test('clear button resets the text filter', async ({ page }) => {
    await typeInFilter(page, 'apple');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-clear-btn').click();
    });
    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-search').value
    );
    expect(val).toBe('');
  });
});

// ── Empty / Not empty pills ───────────────────────────────────────────────────

test.describe('Lists — Empty and Not empty filter pills', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    // "Full List" first (will receive an item), then "Empty List"
    await createList(page, 'Full List', 1);
    await addItemToFirstList(page, 'Task one');
    await createList(page, 'Empty List', 2);
    await openFilterBar(page);
    await openFilterPanel(page);
  });

  test('Empty pill shows only lists with no items', async ({ page }) => {
    await clickEmptyPill(page);
    const items = await getListVisibility(page);
    expect(items.find(v => v.name === 'Full List')?.hidden).toBe(true);
    expect(items.find(v => v.name === 'Empty List')?.hidden).toBe(false);
  });

  test('Not empty pill shows only lists that have items', async ({ page }) => {
    await clickNotEmptyPill(page);
    const items = await getListVisibility(page);
    expect(items.find(v => v.name === 'Full List')?.hidden).toBe(false);
    expect(items.find(v => v.name === 'Empty List')?.hidden).toBe(true);
  });

  test('Empty pill has aria-pressed="true" when active', async ({ page }) => {
    await clickEmptyPill(page);
    const pressed = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#empty-btn').getAttribute('aria-pressed')
    );
    expect(pressed).toBe('true');
  });

  test('selecting Empty deactivates Not empty', async ({ page }) => {
    await clickNotEmptyPill(page);
    await clickEmptyPill(page);
    const [emptyPressed, notEmptyPressed] = await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot;
      return [
        sr.querySelector('#empty-btn').getAttribute('aria-pressed'),
        sr.querySelector('#not-empty-btn').getAttribute('aria-pressed'),
      ];
    });
    expect(emptyPressed).toBe('true');
    expect(notEmptyPressed).toBe('false');
  });

  test('clicking active Empty pill again deactivates it', async ({ page }) => {
    await clickEmptyPill(page);
    await clickEmptyPill(page);
    const pressed = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#empty-btn').getAttribute('aria-pressed')
    );
    expect(pressed).toBe('false');
  });

  test('filter panel stays open on bar reopen when Empty pill is active', async ({ page }) => {
    await clickEmptyPill(page);
    // Close bar
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-btn').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    // Reopen bar
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(false);
  });

  test('clear button deactivates active pill without closing panel', async ({ page }) => {
    await clickEmptyPill(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#filter-clear-btn').click();
    });
    const [emptyPressed, panelHidden] = await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot;
      return [
        sr.querySelector('#empty-btn').getAttribute('aria-pressed'),
        sr.querySelector('#filter-panel').hidden,
      ];
    });
    expect(emptyPressed).toBe('false');
    // Panel stays open because _panelExpanded is still true from the expand click
    expect(panelHidden).toBe(false);
  });
});
