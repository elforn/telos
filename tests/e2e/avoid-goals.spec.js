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
  // A saved goal opens on its Overview tab, so step onto the edit form — what
  // every test using this helper is actually exercising. A JS .click() still
  // reaches a hidden control, so without this the specs would keep "passing"
  // against an unrendered form. Waiting for the analytics view first means
  // the saved goal's own open() has definitely run (the creation dialog can
  // still be open when the row is tapped, and a tab click issued then is
  // wiped by the reopen that follows).
  await page.waitForFunction(() => {
    const sr = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot;
    return sr?.querySelector('#view-analytics')?.hidden === false;
  });
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#modal').shadowRoot.querySelectorAll('.tab-seg')[0].click();
  });
  await page.waitForFunction(() => {
    const sr = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot;
    return sr?.querySelector('#view-main')?.hidden === false;
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

    // Three real, non-zero-sized septagons (DOT_WINDOW.decreasing) — the
    // same "invisible container" regression class the frequency dot-strip
    // has already been bitten by once (a CSS rule missing entirely, dots
    // carrying the right class while rendering at zero effective size).
    // happy-dom can't catch this; a real layout engine can.
    const septagonSizes = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return [...item.shadowRoot.querySelectorAll('.septagon-strip .septagon-week')]
        .map(w => w.getBoundingClientRect().toJSON());
    });
    expect(septagonSizes).toHaveLength(3);
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

    // Avoid inverts the pressed/highlighted convention every other type
    // uses (see goal-dialog.js's _onFixDayChipClick/_renderFixDayChips): a
    // clean day is pressed by default, so logging a slip here flips this
    // chip to aria-pressed="false", not "true".
    await page.waitForFunction(iso =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector(`#fixday-chips .day-chip[data-iso="${iso}"]`).getAttribute('aria-pressed') === 'false'
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

  test('a slip past the allowance renders as an "over" wedge — drained, not filled, and never bordered', async ({ page }) => {
    // Allowance 0, so the very first slip is over it — no setup needed, and
    // no dependence on which weekday the suite happens to run on.
    await openDialog(page, '#add-capstone');
    await selectType(page, 'decreasing');
    await saveDialog(page, 'No takeout');
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

    const todayWedgeState = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      const currentFill = item.shadowRoot.querySelector('.septagon-week.current .septagon-fill');
      const todayIso = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const todayPath = currentFill.querySelector(`path[data-iso="${todayIso}"]`);
      const cleanPath = item.shadowRoot.querySelector('.septagon-strip path[data-state="clean"]');
      const todayStyle = getComputedStyle(todayPath);
      const cleanStyle = getComputedStyle(cleanPath);
      return {
        state: todayPath.getAttribute('data-state'),
        todayFill: todayStyle.fill,
        todayStroke: todayStyle.stroke,
        cleanFill: cleanStyle.fill,
        cleanStroke: cleanStyle.stroke,
      };
    });
    expect(todayWedgeState.state).toBe('over');
    expect(todayWedgeState.todayFill).not.toBe(todayWedgeState.cleanFill); // fully transparent, not the solid accent fill a clean wedge gets
    expect(todayWedgeState.todayStroke).toBe('none'); // no border on any wedge, any state — see goal-item.js's septagon-fill rules
    expect(todayWedgeState.todayStroke).toBe(todayWedgeState.cleanStroke); // clean has no border either — consistent across every state
  });
});
