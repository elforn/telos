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

async function openFixDay(page) {
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
      .querySelector('#action-fixday-btn').click();
  });
  await page.waitForFunction(() => {
    const view = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#view-fixday');
    return view && !view.hidden;
  });
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

  test('Fix a day: correct a past date via the edit dialog\'s overflow menu', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    // Real rendered size, not just the right class — a className/state check
    // alone would have missed a real bug here: .freq-dots had no CSS rule at
    // all, defaulting to display:inline, under which width/height (and their
    // logical equivalents) are spec-ignored on non-replaced boxes. Every
    // history dot rendered at zero effective size — invisible, while still
    // carrying the "correct" class the whole time. happy-dom unit tests can't
    // catch this (no real layout engine); this is why it has to be a real
    // bounding-box check against an actual browser.
    const historyDotSizes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.freq-dots .freq-dot')]
        .map(d => d.getBoundingClientRect())
        .map(r => ({ width: r.width, height: r.height }));
    });
    expect(historyDotSizes).toHaveLength(5);
    for (const size of historyDotSizes) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }

    await tapBar(page);
    await openFixDay(page);

    const chipCount = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip').length
    );
    expect(chipCount).toBe(42); // 7 × PERIOD_WINDOW.weekly (6)

    // The very first chip (oldest of the 42) is 41 days ago — an old miss to
    // back-fill, distinct from "today" (which the hold gesture already covers
    // in the other test above; this one is specifically about arbitrary dates).
    const firstChipIso = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chips .day-chip').dataset.iso
    );
    const wasPressedBefore = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chips .day-chip').getAttribute('aria-pressed')
    );
    expect(wasPressedBefore).toBe('false');

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chips .day-chip').click();
    });

    await page.waitForFunction(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chips .day-chip').getAttribute('aria-pressed') === 'true'
    );

    // Back-fill landed in the store, not just the chip's own local aria state.
    const entriesAfterAdd = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal.tracking.entries;
    });
    expect(entriesAfterAdd).toContain(firstChipIso);

    // The row underneath the modal is the same live element (not destroyed),
    // so a correction should be visible in its dot-strip immediately — before
    // the dialog even closes, not just after. Every history dot started
    // "missed" (fresh goal, zero entries); the back-filled week should no
    // longer be.
    const historyDotClassesWhileOpen = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.freq-dots .freq-dot')].map(d => d.className);
    });
    expect(historyDotClassesWhileOpen.some(c => c.includes('met') || c.includes('partial'))).toBe(true);

    // A second, different chip: toggle on then off — covers the removal
    // direction (kept from the earlier version of this test) without
    // disturbing the first chip's entry, which stays logged through to the
    // dismiss-and-recheck below.
    const secondChip = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip')[1].dataset.iso
    );
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip')[1].click();
    });
    await page.waitForFunction(iso => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal.tracking.entries.includes(iso);
    }, secondChip);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip')[1].click();
    });
    await page.waitForFunction(iso => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return !item._goal.tracking.entries.includes(iso);
    }, secondChip);

    // No back button (removed — the sheet is dismissible like any other view,
    // not navigated back from). Dismiss the whole dialog via Escape, same as
    // a real backdrop tap, and confirm the correction survived the close —
    // this is the actual scenario: does the row still show it once you're
    // back looking at the list, not just while the dialog happens to be open.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return !d?.open;
    });

    const entriesAfterClose = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal.tracking.entries;
    });
    expect(entriesAfterClose).toContain(firstChipIso);
    expect(entriesAfterClose).not.toContain(secondChip);

    const historyDotClassesAfterClose = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.freq-dots .freq-dot')].map(d => d.className);
    });
    expect(historyDotClassesAfterClose.some(c => c.includes('met') || c.includes('partial'))).toBe(true);
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

  test('editing an existing goal: target stays editable, and weekly↔monthly can be switched (percentage stays off-limits)', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);

    // The pill group (not the locked label) is showing, with percentage
    // withheld — this is the real point of the feature: type/target aren't
    // frozen the moment the goal exists, only the percentage↔frequency
    // boundary is.
    const pillState = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        pillsHidden: root.querySelector('#type-pills').hidden,
        lockedHidden: root.querySelector('#type-locked').hidden,
        percentagePillHidden: root.querySelector('.type-pill[data-type="percentage"]').hidden,
      };
    });
    expect(pillState.pillsHidden).toBe(false);
    expect(pillState.lockedHidden).toBe(true);
    expect(pillState.percentagePillHidden).toBe(true);

    // Bump the target — commits immediately, no save/close needed.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#target-up').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.target === 4;
    });

    // Log today, then switch to monthly — the entry should carry over.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });
    await holdOnBar(page);
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.entries?.length ?? 0) === 1;
    });
    const loggedIso = (await goalItemTracking(page)).entries[0];

    await tapBar(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="monthly"]').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'monthly';
    });
    const afterSwitch = await goalItemTracking(page);
    expect(afterSwitch.type).toBe('monthly');
    expect(afterSwitch.target).toBe(4); // monthly's own default, not carried over from weekly
    expect(afterSwitch.entries).toContain(loggedIso); // same dates, just re-bucketed
  });

  test('Fix a day on a monthly goal spans 120 days with month-label dividers, opened scrolled to today', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'monthly');
    await saveDialog(page, 'Call parents');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);
    await openFixDay(page);

    const { chipCount, dividerCount, scrolledToEnd } = await page.evaluate(() => {
      const strip = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-chips');
      return {
        chipCount: strip.querySelectorAll('.day-chip').length,
        dividerCount: strip.querySelectorAll('.day-divider').length,
        scrolledToEnd: strip.scrollLeft > 0, // any distance in confirms it isn't stuck at the oldest day
      };
    });
    expect(chipCount).toBe(120); // 30 × PERIOD_WINDOW.monthly (4)
    expect(dividerCount).toBeGreaterThanOrEqual(4);
    expect(scrolledToEnd).toBe(true);
  });
});
