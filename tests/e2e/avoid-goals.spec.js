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

async function clickTargetUp(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#target-up').click();
  });
}

// Single toggle chip, not a pill group — one click flips week <-> 4weeks.
async function toggleAllowancePeriodChip(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#allowance-period-chip').click();
  });
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

// The current septagon is the row's one tap target, same idiom as
// .freq-today for weekly/monthly — real pointer events, since the gestures
// mixin tracks pointerdown/up rather than a synthetic .click().
async function tapCurrentSeptagon(page) {
  const box = await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item');
    return item.shadowRoot.querySelector('.septagon-week.current').getBoundingClientRect().toJSON();
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

async function openFixDay(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#fixday-chip').click();
  });
  await page.waitForFunction(() => {
    const inline = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#fixday-inline');
    return inline && !inline.hidden;
  });
}

test.describe('Avoid goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('create an Avoid goal, tap the current septagon to log a slip, tap again to undo', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await clickTargetUp(page); // allowance 0 -> 1
    await saveDialog(page, 'No ice cream');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    let tracking = await goalItemTracking(page);
    expect(tracking.type).toBe('decreasing');
    expect(tracking.target).toBe(1);
    expect(tracking.entries).toEqual([]);

    // Six real, non-zero-sized septagons — the same "invisible container"
    // regression class the frequency dot-strip has already been bitten by
    // once (a CSS rule missing entirely, dots carrying the right class
    // while rendering at zero effective size). happy-dom can't catch this;
    // a real layout engine can.
    const septagonSizes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.septagon-strip .septagon-week')]
        .map(w => w.getBoundingClientRect().toJSON());
    });
    expect(septagonSizes).toHaveLength(6);
    for (const s of septagonSizes) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }

    // pct-label stays hidden (the strip carries the score, same as frequency types).
    const pctHidden = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.pct-label').hidden;
    });
    expect(pctHidden).toBe(true);

    // Tap logs today.
    await tapCurrentSeptagon(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 1;
    });
    tracking = await goalItemTracking(page);
    expect(tracking.entries).toHaveLength(1);

    const ringLogged = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.septagon-week.current').classList.contains('logged');
    });
    expect(ringLogged).toBe(true);

    // Tap again undoes it.
    await tapCurrentSeptagon(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 0;
    });
  });

  test('a logged slip survives a full page reload (store -> IDB -> reload -> replay)', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await saveDialog(page, 'No ice cream');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapCurrentSeptagon(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 1;
    });
    const loggedIso = (await goalItemTracking(page)).entries[0];
    await waitForIDBFlush(page);

    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const afterReload = await goalItemTracking(page);
    expect(afterReload.type).toBe('decreasing');
    expect(afterReload.entries).toContain(loggedIso);
    const ringLoggedAfterReload = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.septagon-week.current').classList.contains('logged');
    });
    expect(ringLoggedAfterReload).toBe(true);
  });

  test('Fix a day on an Avoid goal spans 42 days (weekly-length), chip aria-label says "slipped"', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await saveDialog(page, 'No ice cream');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);
    await openFixDay(page);

    const chipCount = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip').length
    );
    expect(chipCount).toBe(42); // 7 × PERIOD_WINDOW.decreasing (6), same span as weekly

    // Back-fill 3 weeks ago — inside the window regardless of what day of
    // the week "today" happens to be when this runs (same reasoning as the
    // equivalent weekly test).
    const chipIso = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 21);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await page.evaluate(iso => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).click();
    }, chipIso);

    await page.waitForFunction(iso =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).getAttribute('aria-pressed') === 'true'
    , chipIso);

    // aria-label's "slipped"/"logged" suffix is only computed by
    // _renderFixDayChips on a real render pass, not live-updated by the
    // click handler (which only touches aria-pressed immediately) — collapse
    // and reopen Fix-a-day to force a fresh render with the entry now present.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chip').click(); // collapse
    });
    await openFixDay(page); // re-expand -> fresh render

    const ariaLabel = await page.evaluate(iso =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).getAttribute('aria-label')
    , chipIso);
    expect(ariaLabel).toContain('slipped');
    expect(ariaLabel).not.toContain('logged');

    const entries = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal.tracking.entries;
    });
    expect(entries).toContain(chipIso);
  });

  test('switching weekly -> Avoid -> weekly preserves entries end-to-end through the real dialog', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    // Log today as weekly first.
    const barBox = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.move(barBox.x + barBox.width * 0.5, barBox.y + barBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 1;
    });
    const loggedIso = (await goalItemTracking(page)).entries[0];

    // Switch to Avoid via the ⋮ menu, same real flow a user would take.
    await tapBar(page);
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
    await selectType(page, 'decreasing');
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'decreasing';
    });
    let tracking = await goalItemTracking(page);
    expect(tracking.entries).toContain(loggedIso); // reinterpreted as a slip, not deleted
    expect(tracking.target).toBe(0); // decreasing's own default allowance

    // And back to weekly recovers it as a completion again.
    await selectType(page, 'weekly');
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'weekly';
    });
    tracking = await goalItemTracking(page);
    expect(tracking.entries).toContain(loggedIso);
  });

  test('creating an Avoid goal with the 4-week allowance chip persists allowancePeriod through to IDB and a reload', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await clickTargetUp(page); // allowance 0 -> 1
    await toggleAllowancePeriodChip(page);
    await saveDialog(page, 'No takeout');

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    let tracking = await goalItemTracking(page);
    expect(tracking.allowancePeriod).toBe('4weeks');
    expect(tracking.target).toBe(1);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    tracking = await goalItemTracking(page);
    expect(tracking.allowancePeriod).toBe('4weeks');
  });

  test('the septagon strip reflects the pooled 4-week allowance, not a fresh weekly one', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await clickTargetUp(page); // allowance 0 -> 1
    await clickTargetUp(page); // allowance 1 -> 2
    await toggleAllowancePeriodChip(page);
    await saveDialog(page, 'No takeout');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    // Spend the whole allowance (2) in the block-start week (3 weeks ago —
    // still inside the same 4-week block as this week) via Fix a day.
    await tapBar(page);
    await openFixDay(page);
    const blockStartIsos = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 21); // Monday, 3 weeks ago
      const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      const tue = new Date(d); tue.setDate(tue.getDate() + 1);
      return [iso(d), iso(tue)];
    });
    for (const iso of blockStartIsos) {
      await page.evaluate(i => {
        document.querySelector('app-router').shadowRoot
          .querySelector('home-page').shadowRoot
          .querySelector('goal-dialog').shadowRoot
          .querySelector(`#fixday-chips .day-chip[data-iso="${i}"]`).click();
      }, iso);
    }
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 2;
    });

    // Log today too — the block's allowance is already spent, so this
    // should render as "over" (20% opacity), not "within" (60%), even
    // though it's the only slip in *this particular week*.
    await tapCurrentSeptagon(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 3;
    });

    const currentFillBackground = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelector('.septagon-week.current .septagon-fill').style.background;
    });
    expect(currentFillBackground).toContain('20%, transparent)'); // the "over" wedge colour
    expect(currentFillBackground).not.toContain('60%, transparent)'); // never rendered as merely "within"
  });
});
