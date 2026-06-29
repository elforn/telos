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
      .querySelector('#close').click();
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

// ── Goal creation ─────────────────────────────────────────────────────────────

test.describe('Goal creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('can create a capstone goal via add button', async ({ page }) => {
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

    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'To be deleted');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('delete via delete button removes the item', async ({ page }) => {
    const deleted = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#milestone-list goal-item');
      if (!item) return false;
      // Two clicks: first arms the confirm state, second fires goal-delete
      item.shadowRoot.querySelector('#delete-btn').click();
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

// ── Goal tap — opens dialog ───────────────────────────────────────────────────

test.describe('Goal tap — opens dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Tap test');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('tapping a goal opens the edit dialog', async ({ page }) => {
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
  });
});

// ── Shared helpers for actions ────────────────────────────────────────────────

async function tapGoalItem(page, listId, index = 0) {
  const barBounds = await page.evaluate((opts) => {
    const items = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelectorAll(`${opts.listId} goal-item`);
    const bar = items[opts.index]?.shadowRoot?.querySelector('.bar');
    return bar?.getBoundingClientRect().toJSON();
  }, { listId, index });
  if (!barBounds) throw new Error('goal-item not found');
  await page.mouse.click(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2);
}

async function waitForGoalDialog(page) {
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function openActionSheetInGoalDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#menu-btn').click();
  });
}

async function clickGoalDialogShadowEl(page, selector) {
  await page.evaluate(sel => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

// ── Goal move / copy to year ──────────────────────────────────────────────────

test.describe('Goal move to year', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openDialog(page, '#add-milestone');
    await fillAndSaveDialog(page, 'Carry forward');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('moving a goal removes it from the source section', async ({ page }) => {
    await tapGoalItem(page, '#milestone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-move-btn');

    // Switch to previous year
    await page.evaluate(y => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      sr.querySelector('#move-year-select').value = String(y);
      sr.querySelector('#move-year-select').dispatchEvent(new Event('change'));
    }, currentYear - 1);

    await clickGoalDialogShadowEl(page, '#move-btn');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });
    expect(await goalItemCount(page, '#milestone-list')).toBe(0);
  });

  test('moved goal appears in the target year', async ({ page }) => {
    await tapGoalItem(page, '#milestone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-move-btn');

    await page.evaluate(y => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      sr.querySelector('#move-year-select').value = String(y);
      sr.querySelector('#move-year-select').dispatchEvent(new Event('change'));
    }, currentYear - 1);

    await clickGoalDialogShadowEl(page, '#move-btn');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    await waitForIDBFlush(page);
    await page.goto(`/${currentYear - 1}`);
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
    expect(title).toBe('Carry forward');
  });

  test('copying a goal keeps it in the source year', async ({ page }) => {
    await tapGoalItem(page, '#milestone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-move-btn');

    await page.evaluate(y => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      sr.querySelector('#move-year-select').value = String(y);
      sr.querySelector('#move-year-select').dispatchEvent(new Event('change'));
    }, currentYear - 1);

    await clickGoalDialogShadowEl(page, '#copy-btn');

    await page.waitForFunction(() => {
      // Goal should STILL be in milestone-list (copy keeps original)
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#milestone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
    expect(await goalItemCount(page, '#milestone-list')).toBe(1);
  });

  test('toast appears after moving a goal', async ({ page }) => {
    await tapGoalItem(page, '#milestone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-move-btn');

    await page.evaluate(y => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      sr.querySelector('#move-year-select').value = String(y);
      sr.querySelector('#move-year-select').dispatchEvent(new Event('change'));
    }, currentYear + 1);

    await clickGoalDialogShadowEl(page, '#move-btn');

    const toastVisible = await page.waitForFunction(() => {
      const toast = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('toast-container')?.shadowRoot
        ?.querySelector('.toast');
      return toast !== null;
    }).catch(() => false);
    expect(toastVisible).toBeTruthy();
  });
});

// ── Goal create list item ─────────────────────────────────────────────────────

test.describe('Goal create list item', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await openDialog(page, '#add-capstone');
    await fillAndSaveDialog(page, 'Goal to share');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
  });

  test('create list item (copy) keeps the goal in place', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-create-btn');

    // The list-picker-dialog sub-modal should open
    await page.waitForFunction(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      const modal  = picker?.shadowRoot?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return modal?.open;
    });

    // Use "＋ New list" so no pre-seeded list is needed
    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      picker?.shadowRoot?.querySelector('#new-list-btn')?.click();
    });

    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      const inp = picker?.shadowRoot?.querySelector('#new-list-input');
      if (inp) {
        inp.value = 'Created from goal';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Click Copy — enabled because new-list name is filled
    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      picker?.shadowRoot?.querySelector('#copy-btn')?.click();
    });

    // Goal should still be present (copy keeps the goal)
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
    expect(await goalItemCount(page, '#capstone-list')).toBe(1);
  });

  test('create list item (move) removes the goal', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');
    await waitForGoalDialog(page);
    await openActionSheetInGoalDialog(page);
    await clickGoalDialogShadowEl(page, '#action-create-btn');

    await page.waitForFunction(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      const modal  = picker?.shadowRoot?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return modal?.open;
    });

    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      picker?.shadowRoot?.querySelector('#new-list-btn')?.click();
    });

    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      const inp = picker?.shadowRoot?.querySelector('#new-list-input');
      if (inp) {
        inp.value = 'Goal converted to item';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Click Move — creates item and deletes the goal
    await page.evaluate(() => {
      const gd = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const picker = gd.querySelector('#list-picker');
      picker?.shadowRoot?.querySelector('#move-btn')?.click();
    });

    // Goal should be gone (move deletes the goal)
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });
    expect(await goalItemCount(page, '#capstone-list')).toBe(0);
  });
});

// ── Goal delete via dialog ────────────────────────────────────────────────────

test.describe('Goal delete via dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

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
      // Two clicks: first arms the confirm state, second fires goal-delete
      const d = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#delete');
      d.click();
      d.click();
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
      // Two clicks: first arms the confirm state, second fires goal-delete
      const d = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#delete');
      d.click();
      d.click();
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

// ── Focus section ─────────────────────────────────────────────────────────────

test.describe('Focus section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('can create a focus goal', async ({ page }) => {
    await openDialog(page, '#add-focus');
    await fillAndSaveDialog(page, 'Read 24 books');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#focus-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    expect(await goalItemCount(page, '#focus-list')).toBe(1);
  });

  test('created focus goal persists across page reload', async ({ page }) => {
    await openDialog(page, '#add-focus');
    await fillAndSaveDialog(page, 'Focus persisted');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#focus-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#focus-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#focus-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Focus persisted');
  });

  test('delete via delete button removes a focus goal', async ({ page }) => {
    await openDialog(page, '#add-focus');
    await fillAndSaveDialog(page, 'To be deleted');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#focus-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#focus-list goal-item').shadowRoot
        .querySelector('#delete-btn').click();
    });

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#focus-list');
      return list?.querySelectorAll('goal-item').length === 0;
    });

    expect(await goalItemCount(page, '#focus-list')).toBe(0);
  });
});
