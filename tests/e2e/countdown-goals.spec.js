import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

async function openDialog(page, addBtnId) {
  await page.evaluate(id => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id).click();
  }, addBtnId);
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function selectType(page, type) {
  await page.evaluate(t => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector(`.type-pill[data-type="${t}"]`).click();
  }, type);
}

async function clickStartModePill(page, mode) {
  await page.evaluate(m => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector(`.start-mode-pill[data-mode="${m}"]`).click();
  }, mode);
}

async function setDueDate(page, iso) {
  await page.evaluate(v => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#duedate-input');
    inp.value = v;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, iso);
}

async function setCountdownStartDate(page, iso) {
  await page.evaluate(v => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#countdown-start-input');
    inp.value = v;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, iso);
}

async function saveDialog(page, title) {
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

async function goalItem(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item');
    return item ? { tracking: item._goal.tracking, dueDate: item._goal.dueDate } : null;
  });
}

async function tapBar(page) {
  const box = await page.evaluate(() => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item').shadowRoot
      .querySelector('.bar');
    return bar.getBoundingClientRect().toJSON();
  });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function openChangeType(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() => {
    const sheet = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#action-sheet')?.shadowRoot?.querySelector('dialog');
    return sheet?.open;
  });
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#action-change-type-btn').click();
  });
}

function farFutureIso(daysOut) {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('Countdown goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('creating a To date goal auto-opens the due-date field and defaults to Year start', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'countdown');

    // The due-date row is a real layout element — confirm it actually
    // rendered visible (non-zero size), not just an attribute flip.
    const dueDateRowBox = await page.evaluate(() => {
      const row = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.duedate-field');
      return row.hidden ? null : row.getBoundingClientRect().toJSON();
    });
    expect(dueDateRowBox).not.toBeNull();
    expect(dueDateRowBox.height).toBeGreaterThan(0);

    const startModeChecked = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.start-mode-pill[aria-checked="true"]').dataset.mode
    );
    expect(startModeChecked).toBe('yearStart');

    await setDueDate(page, farFutureIso(200));
    await saveDialog(page, 'Wedding countdown');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const goal = await goalItem(page);
    expect(goal.tracking.type).toBe('countdown');
    expect(goal.tracking.startMode).toBe('yearStart');
    expect(goal.tracking.startDate).toBe(`${currentYear}-01-01`);
    expect(goal.dueDate).toBe(farFutureIso(200));
  });

  test('the row renders a real, non-zero fill and an always-visible "Nd" label (not drag-gated)', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'countdown');
    await setDueDate(page, farFutureIso(100));
    await saveDialog(page, 'Launch countdown');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const state = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      const fill = item.shadowRoot.querySelector('.fill');
      const label = item.shadowRoot.querySelector('.pct-label');
      return {
        fillWidth: fill.getBoundingClientRect().width,
        barType: item.shadowRoot.querySelector('.bar').dataset.type,
        labelHidden: label.hidden,
        labelText: label.textContent,
      };
    });
    expect(state.barType).toBe('countdown');
    expect(state.fillWidth).toBeGreaterThanOrEqual(0); // real layout width, not NaN/undefined
    expect(state.labelHidden).toBe(false);
    expect(state.labelText).toMatch(/^\d+d$/);
  });

  test('a real hold-drag on the bar changes nothing — countdown is locked/automatic', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'countdown');
    await setDueDate(page, farFutureIso(100));
    await saveDialog(page, 'Launch countdown');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const before = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.fill').style.width;
    });

    const barBox = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.move(barBox.x + barBox.width * 0.2, barBox.y + barBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600); // past the hold-drag dwell — would enter scrub mode for percentage
    await page.mouse.move(barBox.x + barBox.width * 0.9, barBox.y + barBox.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.fill').style.width;
    });
    expect(after).toBe(before);

    const holdActive = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').classList.contains('hold-active')
    );
    expect(holdActive).toBe(false);
  });

  test('switching an existing percentage goal to To date force-opens the due-date field live, in the real dialog', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await saveDialog(page, 'Learn guitar'); // defaults to percentage
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);
    const dueDateHiddenBefore = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.duedate-field').hidden
    );
    expect(dueDateHiddenBefore).toBe(true); // never set, starts collapsed

    await openChangeType(page);
    await selectType(page, 'countdown');

    await page.waitForFunction(() => !document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('.duedate-field').hidden);

    await setDueDate(page, farFutureIso(150));
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'countdown';
    });
    const goal = await goalItem(page);
    expect(goal.tracking.type).toBe('countdown');
    expect(goal.tracking.startMode).toBe('yearStart');
  });

  test('a custom start date persists through IDB and a full page reload', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'countdown');
    await clickStartModePill(page, 'custom');
    await setCountdownStartDate(page, `${currentYear}-03-15`);
    await setDueDate(page, farFutureIso(120));
    await saveDialog(page, 'Custom start countdown');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    let goal = await goalItem(page);
    expect(goal.tracking.startMode).toBe('custom');
    expect(goal.tracking.startDate).toBe(`${currentYear}-03-15`);

    await waitForIDBFlush(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    goal = await goalItem(page);
    expect(goal.tracking.type).toBe('countdown');
    expect(goal.tracking.startMode).toBe('custom');
    expect(goal.tracking.startDate).toBe(`${currentYear}-03-15`);
  });
});
