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

async function openItemDialog(page) {
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

async function openActionSheet(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() => {
    const sheet = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#action-sheet')?.shadowRoot
      ?.querySelector('dialog');
    return sheet?.open;
  });
}

async function openGoalPromoterView(page) {
  await openActionSheet(page);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#action-promote-btn').click();
  });
  await page.waitForFunction(() => {
    const view = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#view-goal-promoter');
    return !view?.hidden;
  });
}

async function selectSection(page, section) {
  await page.evaluate(s => {
    const radio = [...document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelectorAll('input[name="goal-section"]')]
      .find(r => r.value === s);
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
  }, section);
}

async function confirmPromote(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#add-to-goal-cta').click();
  });
  // Dialog closes
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return !d?.open;
  });
}

function itemDialogSR(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
  );
}

// ── Promote — overflow menu ───────────────────────────────────────────────────

test.describe('Promote — overflow menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Promote me');
    await openItemDialog(page);
  });

  test('"Add to goal" option is present in the overflow action sheet', async ({ page }) => {
    await openActionSheet(page);
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#action-promote-btn').textContent.trim()
    );
    expect(text.length).toBeGreaterThan(0);
  });

  test('tapping "Add to goal" shows the goal promoter view', async ({ page }) => {
    await openGoalPromoterView(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#view-goal-promoter').hidden
    );
    expect(hidden).toBe(false);
  });

  test('"Back" button returns from goal promoter view to main view', async ({ page }) => {
    await openGoalPromoterView(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#promote-back').click();
    });
    await page.waitForFunction(() => {
      const view = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#view-goal-promoter');
      return view?.hidden === true;
    });
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#view-goal-promoter').hidden
    );
    expect(hidden).toBe(true);
  });
});

// ── Promote — confirm flow ────────────────────────────────────────────────────

test.describe('Promote — confirm flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Promote me');
    await openItemDialog(page);
    await openGoalPromoterView(page);
    // Default: current year, capstone section — just confirm
    await confirmPromote(page);
  });

  test('promoted item appears as a goal in the home-page', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await waitForPage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Promote me');
  });

  test('item inGoals is updated after promote', async ({ page }) => {
    // Navigate back to list detail to verify inGoals
    await navToLists(page);
    await navToFirstList(page);

    const inGoals = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#item-list list-item');
      return item?._item?.inGoals ?? [];
    });

    expect(inGoals.length).toBe(1);
    expect(inGoals[0].section).toBe('capstone');
    expect(String(inGoals[0].year)).toBe(String(new Date().getFullYear()));
  });

  test('in-goals pill appears when item dialog is reopened', async ({ page }) => {
    await navToLists(page);
    await navToFirstList(page);
    await openItemDialog(page);
    await openGoalPromoterView(page);

    const sectionHidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#in-goals-section').hidden
    );
    expect(sectionHidden).toBe(false);
  });
});

// ── Promote — guard (duplicate prevention) ────────────────────────────────────

test.describe('Promote — guard', () => {
  test('add-to-goal CTA is disabled for an already-promoted year+section', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Already promoted');

    // First promote
    await openItemDialog(page);
    await openGoalPromoterView(page);
    await confirmPromote(page);

    // Reopen and try to promote to the same year+section again
    await openItemDialog(page);
    await openGoalPromoterView(page);

    const disabled = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#add-to-goal-cta').disabled
    );
    expect(disabled).toBe(true);
  });

  test('add-to-goal CTA is enabled for a different section', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Promote twice');

    // Promote to capstone
    await openItemDialog(page);
    await openGoalPromoterView(page);
    await confirmPromote(page);

    // Reopen, switch to milestones — CTA should be enabled
    await openItemDialog(page);
    await openGoalPromoterView(page);
    await selectSection(page, 'milestones');

    const disabled = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#add-to-goal-cta').disabled
    );
    expect(disabled).toBe(false);
  });
});

// ── Promote — persistence ─────────────────────────────────────────────────────

test.describe('Promote — persistence', () => {
  test('promoted goal survives page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Test list');
    await navToFirstList(page);
    await addItem(page, 'Persist promoted');
    await openItemDialog(page);
    await openGoalPromoterView(page);
    await confirmPromote(page);

    await waitForIDBFlush(page);
    await page.goto(`/${currentYear}`);
    await waitForPage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Persist promoted');
  });
});
