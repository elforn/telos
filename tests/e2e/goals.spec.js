import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

async function shadowQuery(page, ...selectors) {
  return page.evaluateHandle(
    sels => {
      let el = document.querySelector('app-router').shadowRoot.querySelector('home-page');
      for (const sel of sels) el = el?.shadowRoot?.querySelector(sel);
      return el;
    },
    selectors
  );
}

async function openDialog(page, addBtnId) {
  const handle = await shadowQuery(page, addBtnId);
  await handle.evaluate(el => el.click());
}

async function fillAndSaveDialog(page, title) {
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
      .querySelector('input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#save').click();
  });
}

async function goalItemCount(page, listId) {
  return page.evaluate(id => {
    const list = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id);
    return list?.querySelectorAll('goal-item').length ?? 0;
  }, listId);
}

async function enableEditMode(page, editBtnId) {
  await page.evaluate(id => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id).click();
  }, editBtnId);
}

// ── Goal creation ─────────────────────────────────────────────────────────────

test.describe('Goal creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('can create a capstone goal via edit mode + add button', async ({ page }) => {
    await enableEditMode(page, '#capstone-edit-btn');
    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Summit Everest');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    expect(await goalItemCount(page, '#capstone-list')).toBe(1);
  });

  test('can create a 3-month milestone', async ({ page }) => {
    await enableEditMode(page, '#milestone-edit-btn');
    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'Run 100km');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    expect(await goalItemCount(page, '#milestone-list')).toBe(1);
  });

  test('can create a wow moment', async ({ page }) => {
    await enableEditMode(page, '#wow-edit-btn');
    await openDialog(page, '#add-wow');
    await fillAndSaveDialog(page, 'First marathon');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#wow-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    expect(await goalItemCount(page, '#wow-list')).toBe(1);
  });

  test('created goal persists across page reload', async ({ page }) => {
    await enableEditMode(page, '#milestone-edit-btn');
    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'Persist me');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#milestone-list goal-item');
      return item?._goal?.title;
    });
    expect(title).toBe('Persist me');
  });
});

// ── Goal deletion ─────────────────────────────────────────────────────────────

test.describe('Goal deletion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await enableEditMode(page, '#milestone-edit-btn');
    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'To be deleted');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('delete via delete button in edit mode removes the item', async ({ page }) => {
    const deleted = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#milestone-list goal-item');
      if (!item) return false;
      item.shadowRoot.querySelector('#delete-btn').click();
      return true;
    });
    expect(deleted).toBe(true);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    expect(await goalItemCount(page, '#milestone-list')).toBe(0);
  });

  test('deletion persists across reload', async ({ page }) => {
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#milestone-list goal-item');
      item?.shadowRoot?.querySelector('#delete-btn').click();
    });

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list') !== null
    );

    expect(await goalItemCount(page, '#milestone-list')).toBe(0);
  });

  test('multiple goals: only the deleted one is removed', async ({ page }) => {
    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'Keep me');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 2;
    });

    await page.evaluate(() => {
      const items = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelectorAll('#milestone-list goal-item');
      items[0]?.shadowRoot?.querySelector('#delete-btn').click();
    });

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const remainingTitle = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#milestone-list goal-item');
      return item?._goal?.title;
    });
    expect(remainingTitle).toBe('Keep me');
  });
});

// ── Goal progress via hold-drag ───────────────────────────────────────────────

test.describe('Goal progress via hold-drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await enableEditMode(page, '#capstone-edit-btn');
    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Drag me');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('hold-drag on bar updates goal percentage', async ({ page }) => {
    const barBox = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });

    const startX  = barBox.x + 10;
    const midY    = barBox.y + barBox.height / 2;
    const targetX = barBox.x + barBox.width * 0.6;

    await page.mouse.move(startX, midY);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.move(targetX, midY, { steps: 20 });
    await page.mouse.up();

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.percentage ?? 0) > 0;
    });

    const pct = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal?.percentage;
    });
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

// ── Goal fail / restore ───────────────────────────────────────────────────────

test.describe('Goal fail / restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await enableEditMode(page, '#capstone-edit-btn');
    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Fail me');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
      // Exit edit mode
    await enableEditMode(page, '#capstone-edit-btn');
  });

  test('fail button marks goal as failed', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('#fail-btn').click();
    });

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.percentage ?? 0) < 0;
    });

    const pct = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal?.percentage;
    });
    expect(pct).toBeLessThan(0);
  });

  test('failed goal can be restored', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('#fail-btn').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.percentage ?? 0) < 0;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('#fail-btn').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.percentage ?? 0) >= 0;
    });

    const pct = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal?.percentage;
    });
    expect(pct).toBeGreaterThanOrEqual(0);
  });
});

// ── Goal delete via dialog ────────────────────────────────────────────────────

test.describe('Goal delete via dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await enableEditMode(page, '#capstone-edit-btn');
    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Delete me via dialog');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('dialog shows delete button when editing an existing goal', async ({ page }) => {
    const barBounds = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.click(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);

    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });

    const deleteHidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#delete').hidden
    );
    expect(deleteHidden).toBe(false);
  });

  test('clicking delete in the dialog removes the goal', async ({ page }) => {
    const barBounds = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.click(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);

    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#delete').click();
    });

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    expect(await goalItemCount(page, '#capstone-list')).toBe(0);
  });

  test('dialog-deleted goal does not reappear after reload', async ({ page }) => {
    const barBounds = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.click(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);

    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#delete').click();
    });

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list') !== null
    );

    expect(await goalItemCount(page, '#capstone-list')).toBe(0);
  });
});
