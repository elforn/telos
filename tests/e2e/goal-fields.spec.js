import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openGoalDialog(page, addId) {
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
}

async function fillTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
}

async function fillDesc(page, desc) {
  await page.evaluate(d => {
    const ta = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#desc-input');
    ta.value = d;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, desc);
}

async function saveDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#save').click();
  });
}

async function tapGoalItem(page, listId) {
  const bounds = await page.evaluate(id => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(`${id} goal-item`).shadowRoot
      .querySelector('.bar');
    return bar?.getBoundingClientRect().toJSON();
  }, listId);
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function createGoalWithDesc(page, title, desc) {
  await openGoalDialog(page, '#add-capstone');
  await fillTitle(page, title);
  await fillDesc(page, desc);
  await saveDialog(page);
  await page.waitForFunction(() => {
    const list = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list');
    return list?.querySelectorAll('goal-item').length > 0;
  });
}

// ── Goal description — creation ───────────────────────────────────────────────

test.describe('Goal description — creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoalWithDesc(page, 'Run a marathon', 'Train 3x per week starting in January');
  });

  test('description is stored as notes on the goal', async ({ page }) => {
    const notes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.notes;
    });
    expect(notes).toBe('Train 3x per week starting in January');
  });

  test('description persists across page reload', async ({ page }) => {
    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return !!item?._goal?.notes;
    });

    const notes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.notes;
    });
    expect(notes).toBe('Train 3x per week starting in January');
  });
});

// ── Goal description — editing ────────────────────────────────────────────────

test.describe('Goal description — editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoalWithDesc(page, 'Run a marathon', 'Initial note');
  });

  test('edit dialog pre-populates the description field', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');

    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#desc-input').value
    );
    expect(val).toBe('Initial note');
  });

  test('updating description persists the change', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');
    await fillDesc(page, 'Updated note');
    await saveDialog(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item?._goal?.notes === 'Updated note';
    });

    const notes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.notes;
    });
    expect(notes).toBe('Updated note');
  });

  test('clearing description saves as undefined', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');
    await fillDesc(page, '');
    await saveDialog(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return !item?._goal?.notes;
    });

    const notes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.notes;
    });
    expect(notes).toBeUndefined();
  });
});
