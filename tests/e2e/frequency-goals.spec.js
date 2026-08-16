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

// Fix-a-day is inline, a real toggle — tap the summary to unfold the
// day-chip strip in place (tapping again would collapse it back).
async function openFixDay(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#fixday-summary').click();
  });
  await page.waitForFunction(() => {
    const inline = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#fixday-inline');
    return inline && !inline.hidden;
  });
}

// Type/target show a plain read-only readout for an existing goal — "Change
// type" in the ⋮ menu reveals the interactive pill group in its place.
async function expandType(page) {
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
  await page.waitForFunction(() => {
    const pills = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#type-pills');
    return pills && !pills.hidden;
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

  test('Fix a day: correct a past date via the inline day-chip strip', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    // A brand-new goal has zero entries, so recentDots trims the history
    // strip down to nothing (just the current/today token survives — see
    // the leading-empty-trim tests in tracking.test.js) — confirm that
    // token itself renders at a real, non-zero size. The equivalent check
    // for actual history dots runs further below, once the backfill gives
    // the strip something non-empty to show (a className/state check alone
    // previously missed a real bug here: .freq-dots had no CSS rule at all,
    // defaulting to display:inline, under which width/height are spec-
    // ignored on non-replaced boxes — history dots rendered at zero
    // effective size while still carrying the "correct" class the whole
    // time; happy-dom's unit tests can't catch this, no real layout engine).
    const todayDotSize = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      const r = item.shadowRoot.querySelector('.freq-today .freq-dot').getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(todayDotSize.width).toBeGreaterThan(0);
    expect(todayDotSize.height).toBeGreaterThan(0);
    expect(await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item.shadowRoot.querySelectorAll('.freq-dots .freq-dot').length;
    })).toBe(0); // trimmed away — no history yet

    await tapBar(page);
    await openFixDay(page);

    const chipCount = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelectorAll('#fixday-chips .day-chip').length
    );
    expect(chipCount).toBe(42); // 7 × PERIOD_WINDOW.weekly (6)

    // 3 weeks (21 days) back — an old miss to back-fill, distinct from
    // "today" (which the hold gesture already covers in the other test
    // above; this one is specifically about arbitrary dates). Deliberately
    // not the strip's absolute oldest chip: FIX_DAY_SPAN is sized for the
    // worst case (today being a Sunday), so on other days the oldest few
    // chips can fall just outside the 6-week window recentDots actually
    // tracks — 21 days back is safely inside that window regardless of
    // what day of the week "today" happens to be when this runs.
    const firstChipIso = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 21);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const wasPressedBefore = await page.evaluate(iso =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).getAttribute('aria-pressed')
    , firstChipIso);
    expect(wasPressedBefore).toBe('false');

    await page.evaluate(iso => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).click();
    }, firstChipIso);

    await page.waitForFunction(iso =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).getAttribute('aria-pressed') === 'true'
    , firstChipIso);

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
    // the dialog even closes, not just after. The strip started fully
    // trimmed (fresh goal, zero entries, nothing but the current token);
    // the back-fill should now be the trim anchor, so at least one real
    // history dot exists and is met/partial, not missed.
    const historyDots = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.freq-dots .freq-dot')]
        .map(d => ({ className: d.className, ...d.getBoundingClientRect().toJSON() }));
    });
    expect(historyDots.length).toBeGreaterThan(0); // trim no longer collapses it to nothing
    expect(historyDots.some(d => d.className.includes('met') || d.className.includes('partial'))).toBe(true);
    // Real rendered size for every dot now shown, not just the right class —
    // this is the actual regression check for the historical .freq-dots
    // invisible-container bug (see the comment above).
    for (const d of historyDots) {
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBeGreaterThan(0);
    }

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

    // Dismiss the whole dialog via Escape, same as a real backdrop tap
    // (rather than collapsing the strip itself first), and confirm the
    // correction survived the close — this is the actual scenario: does the
    // row still show it once you're back looking at the list, not just
    // while the dialog happens to be open.
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

  test('editing an existing goal: target stays editable, and weekly↔monthly can be switched live', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);

    // Collapsed by default — a plain readout, not the pill group, on first open.
    const collapsedState = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        readoutHidden: root.querySelector('#type-readout').hidden,
        pillsHidden: root.querySelector('#type-pills').hidden,
      };
    });
    expect(collapsedState.readoutHidden).toBe(false);
    expect(collapsedState.pillsHidden).toBe(true);

    // "Change type" in the ⋮ menu reveals the pill group — fully
    // interactive, no locked state at all, percentage included, since
    // switching never destroys data.
    await expandType(page);
    const pillState = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        pillsHidden: root.querySelector('#type-pills').hidden,
        percentagePillHidden: root.querySelector('.type-pill[data-type="percentage"]').hidden,
      };
    });
    expect(pillState.pillsHidden).toBe(false);
    expect(pillState.percentagePillHidden).toBe(false);

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
    await expandType(page);
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

  test('switching percentage↔frequency preserves both sides — nothing is destroyed by the switch', async ({ page }) => {
    // Create as a default percentage goal, give it some progress.
    await openDialog(page, '#add-capstone');
    await saveDialog(page, 'Read more');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });
    await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      for (let i = 0; i < 6; i++) bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.value ?? 0) > 0;
    });
    const originalValue = (await goalItemTracking(page)).value;

    // Switch to weekly, log an entry.
    await tapBar(page);
    await expandType(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="weekly"]').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'weekly';
    });
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

    // Switch back to percentage — the original value must reappear, not reset.
    await tapBar(page);
    await expandType(page);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="percentage"]').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'percentage';
    });
    const backToPercentage = await goalItemTracking(page);
    expect(backToPercentage.value).toBe(originalValue);
    expect(backToPercentage.entries).toContain(loggedIso); // dormant, not deleted

    // And switching to weekly again recovers the logged entry.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="weekly"]').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'weekly';
    });
    const backToWeekly = await goalItemTracking(page);
    expect(backToWeekly.entries).toContain(loggedIso);
    expect(backToWeekly.value).toBe(originalValue); // still dormant, still there
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

  test('type/target (via the ⋮ menu) and Fix-a-day (inline toggle) are independent — both can be open together, Fix-a-day collapses back on a second tap', async ({ page }) => {
    await openDialog(page, '#add-capstone');
    await selectType(page, 'weekly');
    await saveDialog(page, 'Move my body');
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    await tapBar(page);

    // Collapsed on first open: a plain readout for type, a collapsed toggle
    // for Fix-a-day, no pill group or day-chip strip yet.
    let state = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        readoutHidden: root.querySelector('#type-readout').hidden,
        pillsHidden: root.querySelector('#type-pills').hidden,
        fixdaySummaryHidden: root.querySelector('#fixday-summary').hidden,
        fixdayExpanded: root.querySelector('#fixday-summary').getAttribute('aria-expanded'),
      };
    });
    expect(state.readoutHidden).toBe(false);
    expect(state.pillsHidden).toBe(true);
    expect(state.fixdaySummaryHidden).toBe(false);
    expect(state.fixdayExpanded).toBe('false');

    // Opening type via the menu and Fix-a-day via its own toggle — both end
    // up expanded simultaneously, unlike the old shared-row design.
    await expandType(page);
    await openFixDay(page);
    state = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        pillsHidden: root.querySelector('#type-pills').hidden,
        fixdayInlineHidden: root.querySelector('#fixday-inline').hidden,
      };
    });
    expect(state.pillsHidden).toBe(false);
    expect(state.fixdayInlineHidden).toBe(false);

    // Tapping the Fix-a-day summary again collapses it back — a real
    // toggle, not a reveal-once control like type/target's menu trigger.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#fixday-summary').click();
    });
    state = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      return {
        fixdayInlineHidden: root.querySelector('#fixday-inline').hidden,
        fixdaySummaryHidden: root.querySelector('#fixday-summary').hidden,
        fixdayExpanded: root.querySelector('#fixday-summary').getAttribute('aria-expanded'),
        pillsHidden: root.querySelector('#type-pills').hidden, // untouched by the fixday collapse
      };
    });
    expect(state.fixdayInlineHidden).toBe(true);
    expect(state.fixdaySummaryHidden).toBe(false); // stays visible, doesn't disappear
    expect(state.fixdayExpanded).toBe('false');
    expect(state.pillsHidden).toBe(false);
  });
});
