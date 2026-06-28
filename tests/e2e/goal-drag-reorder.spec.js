import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function addGoal(page, addId, listId, title) {
  const countBefore = await page.evaluate(id =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0
  , listId);

  await page.evaluate(id => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id).click();
  }, addId);

  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });

  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#save').click();
  });

  await page.waitForFunction(([id, count]) =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0) >= count
  , [listId, countBefore + 1]);
}

function getGoalTitles(page, listId) {
  return page.evaluate(id =>
    [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id)
      .querySelectorAll('goal-item')]
      .map(el => el._goal?.title)
  , listId);
}

async function pressArrowOnDragBtn(page, listId, index, key) {
  await page.evaluate(([id, idx, k]) => {
    const items = [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id)
      .querySelectorAll('goal-item')];
    const dragBtn = items[idx].shadowRoot.querySelector('#drag-btn');
    dragBtn.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
  }, [listId, index, key]);
}

// ── Goal drag-reorder — keyboard ──────────────────────────────────────────────

test.describe('Goal drag-reorder — keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await addGoal(page, '#add-milestone', '#milestone-list', 'Alpha');
    await addGoal(page, '#add-milestone', '#milestone-list', 'Beta');
  });

  test('ArrowDown moves the first goal down one position', async ({ page }) => {
    const before = await getGoalTitles(page, '#milestone-list');
    expect(before).toEqual(['Alpha', 'Beta']);

    await pressArrowOnDragBtn(page, '#milestone-list', 0, 'ArrowDown');

    await page.waitForFunction(() => {
      const items = [...document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list')
        ?.querySelectorAll('goal-item') ?? []];
      return items[0]?._goal?.title === 'Beta';
    });

    const after = await getGoalTitles(page, '#milestone-list');
    expect(after).toEqual(['Beta', 'Alpha']);
  });

  test('ArrowUp moves the second goal up one position', async ({ page }) => {
    await pressArrowOnDragBtn(page, '#milestone-list', 1, 'ArrowUp');

    await page.waitForFunction(() => {
      const items = [...document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list')
        ?.querySelectorAll('goal-item') ?? []];
      return items[0]?._goal?.title === 'Beta';
    });

    const after = await getGoalTitles(page, '#milestone-list');
    expect(after).toEqual(['Beta', 'Alpha']);
  });

  test('reordering is reversible — ArrowDown then ArrowUp restores original order', async ({ page }) => {
    await pressArrowOnDragBtn(page, '#milestone-list', 0, 'ArrowDown');
    await page.waitForFunction(() => {
      const items = [...document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list')
        ?.querySelectorAll('goal-item') ?? []];
      return items[0]?._goal?.title === 'Beta';
    });

    await pressArrowOnDragBtn(page, '#milestone-list', 1, 'ArrowUp');
    await page.waitForFunction(() => {
      const items = [...document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list')
        ?.querySelectorAll('goal-item') ?? []];
      return items[0]?._goal?.title === 'Alpha';
    });

    const after = await getGoalTitles(page, '#milestone-list');
    expect(after).toEqual(['Alpha', 'Beta']);
  });
});

// ── Goal drag-reorder — persistence ──────────────────────────────────────────

test.describe('Goal drag-reorder — persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await addGoal(page, '#add-capstone', '#capstone-list', 'First');
    await addGoal(page, '#add-capstone', '#capstone-list', 'Second');
  });

  test('reordered goal order survives page reload', async ({ page }) => {
    await pressArrowOnDragBtn(page, '#capstone-list', 0, 'ArrowDown');
    await page.waitForFunction(() => {
      const items = [...document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list')
        ?.querySelectorAll('goal-item') ?? []];
      return items[0]?._goal?.title === 'Second';
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list')
        ?.querySelectorAll('goal-item').length ?? 0) >= 2
    );

    const after = await getGoalTitles(page, '#capstone-list');
    expect(after[0]).toBe('Second');
    expect(after[1]).toBe('First');
  });
});
