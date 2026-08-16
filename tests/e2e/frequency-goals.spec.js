import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

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

async function goalItemTracking(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item');
    return item?._goal?.tracking ?? null;
  });
}

async function holdOnBar(page) {
  const barBox = await page.evaluate(() => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item').shadowRoot
      .querySelector('.bar');
    return bar.getBoundingClientRect().toJSON();
  });
  const x = barBox.x + barBox.width * 0.5;
  const y = barBox.y + barBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600); // clears the 500ms hold-recognition dwell
  await page.mouse.up();
}

test.describe('Frequency goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('create a weekly goal, hold to log today, hold again to undo', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    let tracking = await goalItemTracking(page);
    expect(tracking.type).toBe('weekly');
    expect(tracking.target).toBe(3); // dialog default
    expect(tracking.entries).toEqual([]);

    // Tap (quick, no hold) opens the edit dialog rather than logging. A raw
    // .click() bypasses the gestures mixin entirely (it tracks pointerdown/up,
    // not synthetic clicks), so this has to be real pointer events, same as
    // the hold gesture below — just released immediately instead of held.
    const tapBox = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.move(tapBox.x + tapBox.width * 0.5, tapBox.y + tapBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    tracking = await goalItemTracking(page);
    expect(tracking.entries).toEqual([]); // tap alone never logs
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });

    // Hold logs today.
    await holdOnBar(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 1;
    });
    tracking = await goalItemTracking(page);
    expect(tracking.entries).toHaveLength(1);

    const loggedRing = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.freq-today').classList.contains('logged');
    });
    expect(loggedRing).toBe(true);

    // Hold again undoes it.
    await holdOnBar(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 0;
    });
  });

  test('create a monthly goal — squircle today-token, distinct from weekly\'s circle', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'monthly');
    await saveDialog(page, 'Call parents');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const tracking = await goalItemTracking(page);
    expect(tracking.type).toBe('monthly');
    expect(tracking.target).toBe(4); // dialog default

    const rx = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.freq-ring .progress').getAttribute('rx');
    });
    expect(Number(rx)).toBe(8); // the squircle radius, not a full circle
  });

  test('Every-day preset creates a weekly goal with target 7', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#everyday-chip').click();
    });
    await saveDialog(page, 'Meditate');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const tracking = await goalItemTracking(page);
    expect(tracking.type).toBe('weekly');
    expect(tracking.target).toBe(7);
  });
});
