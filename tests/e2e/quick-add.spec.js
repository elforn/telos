import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Goals ─────────────────────────────────────────────────────────────────────

async function openWowDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#add-wow').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function enterGoalTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#input');
    inp.focus(); // a real Enter keydown only targets a focused input, so blur() actually fires
    inp.value = t;
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, title);
}

function goalDialogOpen(page) {
  return page.evaluate(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return !!d?.open;
  });
}

function wowTitles(page) {
  return page.evaluate(() =>
    [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelectorAll('#wow-list goal-item')]
      .map(el => el._goal?.title)
  );
}

test.describe('Quick-add — goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('Enter creates a goal and keeps the dialog open for the next one', async ({ page }) => {
    await openWowDialog(page);
    await enterGoalTitle(page, 'First wow');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelectorAll('#wow-list goal-item').length ?? 0) >= 1
    );
    expect(await goalDialogOpen(page)).toBe(true);

    await enterGoalTitle(page, 'Second wow');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelectorAll('#wow-list goal-item').length ?? 0) >= 2
    );
    expect(await goalDialogOpen(page)).toBe(true);

    expect(await wowTitles(page)).toEqual(['First wow', 'Second wow']);
  });

  test('Close ends the quick-add session', async ({ page }) => {
    await openWowDialog(page);
    await enterGoalTitle(page, 'Only wow');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelectorAll('#wow-list goal-item').length ?? 0) >= 1
    );
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d && !d.open;
    });
    expect(await wowTitles(page)).toEqual(['Only wow']); // Enter-then-blank does not create an extra goal
  });
});

// ── Lists ─────────────────────────────────────────────────────────────────────

async function openAddListDialog(page) {
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
}

async function enterListName(page, name) {
  await page.evaluate(n => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#input');
    inp.focus();
    inp.value = n;
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, name);
}

function listDialogOpen(page) {
  return page.evaluate(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('list-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return !!d?.open;
  });
}

test.describe('Quick-add — lists', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click());
    await waitForListsPage(page);
  });

  test('Enter creates a list and keeps the dialog open for the next one', async ({ page }) => {
    await openAddListDialog(page);
    await enterListName(page, 'List One');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelectorAll('lists-page-item').length ?? 0) >= 1
    );
    expect(await listDialogOpen(page)).toBe(true);

    await enterListName(page, 'List Two');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelectorAll('lists-page-item').length ?? 0) >= 2
    );
    expect(await listDialogOpen(page)).toBe(true);
  });
});

// ── List items ────────────────────────────────────────────────────────────────

async function createListAndEnter(page, name) {
  await openAddListDialog(page);
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
      ?.querySelectorAll('lists-page-item').length ?? 0) >= 1
  );
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('lists-page-item').onTap();
  });
  await waitForListDetailPage(page);
}

async function openAddItemDialog(page) {
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

async function enterItemTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#title-input');
    inp.focus();
    inp.value = t;
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, title);
}

function itemDialogOpen(page) {
  return page.evaluate(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return !!d?.open;
  });
}

test.describe('Quick-add — list items', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click());
    await waitForListsPage(page);
    await createListAndEnter(page, 'Groceries');
  });

  test('Enter creates an item and keeps the dialog open for the next one', async ({ page }) => {
    await openAddItemDialog(page);
    await enterItemTitle(page, 'Milk');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelectorAll('list-item').length ?? 0) >= 1
    );
    expect(await itemDialogOpen(page)).toBe(true);

    await enterItemTitle(page, 'Eggs');
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelectorAll('list-item').length ?? 0) >= 2
    );
    expect(await itemDialogOpen(page)).toBe(true);
  });
});
