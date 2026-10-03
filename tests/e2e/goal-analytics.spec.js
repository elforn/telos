import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// goal-analytics sits two shadow boundaries deep (app-router → home-page →
// goal-dialog → <goal-analytics>), and the tab strip driving it lives inside
// modal-dialog's own shadow root again. Injected into the page so every
// evaluate() below can reach them without repeating the whole chain.
const SHADOW_HELPERS = () => {
  const gd = () => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot
    .querySelector('goal-dialog');
  window.__gd = gd;
  window.__ga = () => gd().shadowRoot.querySelector('#analytics');
  window.__modal = () => gd().shadowRoot.querySelector('#modal');
  window.__dialogOpen = () => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return !!d?.open;
  };
};

async function createGoal(page, { title, type }) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => window.__dialogOpen());
  await page.evaluate(({ title, type }) => {
    const inp = window.__gd().shadowRoot.querySelector('#input');
    inp.value = title;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    window.__gd().shadowRoot.querySelector(`.type-pill[data-type="${type}"]`)?.click();
  }, { title, type });
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__gd().shadowRoot.querySelector('#close').click());
  await page.waitForFunction(() => !window.__dialogOpen());
  // The dialog closing and the row appearing are separate async steps — the
  // store write lands first, the list re-render follows. Waiting only on the
  // dialog made reopenGoal race the render and intermittently find no rows.
  await page.waitForFunction(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelectorAll('goal-item').length > 0);
}

// Reopening goes through a real pointer click on the row's bar: goal-item uses
// the Gestures mixin, so a synthetic .click() never reaches it.
async function reopenGoal(page) {
  const box = await page.evaluate(() => {
    const items = [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')];
    return items[items.length - 1].shadowRoot.querySelector('.bar').getBoundingClientRect().toJSON();
  });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__dialogOpen());
}

async function gotoTab(page, index) {
  await page.evaluate(i => {
    window.__modal().shadowRoot.querySelectorAll('.tab-seg')[i].click();
  }, index);
  await page.waitForTimeout(300); // entrance animation + the rAF-deferred overflow pass
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(SHADOW_HELPERS);
  await page.goto(`/${currentYear}`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await waitForPage(page);
});

test('an unsaved draft shows no analytics tabs', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => window.__dialogOpen());
  // Nothing to analyse on a never-saved draft — stays a plain single-pill sheet.
  expect(await page.evaluate(() => window.__modal().tabCount)).toBe(0);
});

test('a saved weekly goal exposes Edit + 4 analytics tabs and renders each one', async ({ page }) => {
  await createGoal(page, { title: 'Weekly analytics', type: 'weekly' });
  await reopenGoal(page);

  expect(await page.evaluate(() => window.__modal().tabCount)).toBe(5);

  // Tab 0 is the edit form; 1..4 are Overview / Score / Activity / Streaks.
  await gotoTab(page, 1);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.hero-number'))).toBe(true);

  await gotoTab(page, 2);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.calc-grid'))).toBe(true);

  await gotoTab(page, 3);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.histogram'))).toBe(true);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.heatmap'))).toBe(true);

  await gotoTab(page, 4);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.empty-note, .streak-row'))).toBe(true);
});

test('a saved goal opens on Overview, and the edit form is one tap away', async ({ page }) => {
  await createGoal(page, { title: 'Opens on overview', type: 'weekly' });
  await reopenGoal(page);
  expect(await page.evaluate(() => window.__modal().activeTab)).toBe(1);
  expect(await page.evaluate(() => !window.__gd().shadowRoot.querySelector('#view-analytics').hidden)).toBe(true);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.hero-number'))).toBe(true);
  // Nothing takes the caret — focusing the title field would raise the
  // on-screen keyboard over a page that exists to be read.
  expect(await page.evaluate(() =>
    window.__gd().shadowRoot.activeElement === window.__gd().shadowRoot.querySelector('#input'))).toBe(false);

  // The footer's Edit button goes back to the form, with the notes field
  // sized properly despite having been measured while hidden.
  await page.evaluate(() => window.__gd().shadowRoot.querySelector('#analytics-edit-btn').click());
  await page.waitForFunction(() => !window.__gd().shadowRoot.querySelector('#view-main').hidden);
  const notesOk = await page.evaluate(() => {
    const ta = window.__gd().shadowRoot.querySelector('textarea');
    return ta.getBoundingClientRect().height > 0;
  });
  expect(notesOk).toBe(true);
});

// A deadline set in the edit form has to reach the analytics pages, which
// render off the dialog's own copy of the record — the store round-trip does
// not come back while the dialog is open.
test('a deadline set in the edit form shows up on Overview', async ({ page }) => {
  await createGoal(page, { title: 'Deadline flow', type: 'weekly' });
  await reopenGoal(page);

  // Opens on Overview: no deadline card yet.
  expect(await page.evaluate(() => [...window.__ga().shadowRoot.querySelectorAll('.stat-label')]
    .some(l => l.textContent === 'Deadline'))).toBe(false);

  // Go to Edit, set a deadline through the real chip + input.
  await gotoTab(page, 0);
  const due = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 5);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await page.evaluate(d => {
    const gd = window.__gd();
    gd.shadowRoot.querySelector('#duedate-chip').click();
    const inp = gd.shadowRoot.querySelector('#duedate-input');
    inp.value = d; inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, due);
  await page.waitForTimeout(200);

  // Back to Overview — the card must be there now, with the live wording.
  await gotoTab(page, 1);
  const card = await page.evaluate(() => {
    const c = [...window.__ga().shadowRoot.querySelectorAll('.stat')]
      .find(x => x.querySelector('.stat-label')?.textContent === 'Deadline');
    return c ? { value: c.querySelector('.stat-value').textContent, sub: c.querySelector('.stat-sub')?.textContent } : null;
  });
  expect(card).not.toBeNull();
  expect(card.sub).toBe('due this week');
});

test('a percentage goal has no Score tab, so Activity sits one index earlier', async ({ page }) => {
  await createGoal(page, { title: 'Percentage analytics', type: 'percentage' });
  await reopenGoal(page);
  // Edit + Overview + Activity + Streaks — no rolling-score page for this type.
  expect(await page.evaluate(() => window.__modal().tabCount)).toBe(4);
  await gotoTab(page, 2);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.histogram'))).toBe(true);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.calc-grid'))).toBe(false);
  // Weekday cadence is meaningless without per-day entries.
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.freqgrid'))).toBe(false);
});

test('a countdown goal exposes Overview only', async ({ page }) => {
  await createGoal(page, { title: 'Countdown analytics', type: 'countdown' });
  await reopenGoal(page);
  expect(await page.evaluate(() => window.__modal().tabCount)).toBe(2);
  await gotoTab(page, 1);
  expect(await page.evaluate(() => !!window.__ga().shadowRoot.querySelector('.hero-number'))).toBe(true);
});

test('no analytics page scrolls the dialog sideways', async ({ page }) => {
  // The charts own their horizontal scrolling internally; the page around
  // them must never gain any. Caught a real bug once: the sticky page head
  // bled outward with a negative inline margin, making every analytics page
  // 16px wider than the dialog body. Only real layout can see this — the
  // element's own box is fine in isolation, it is the containing scroll
  // width that goes wrong.
  await createGoal(page, { title: 'Sideways scroll', type: 'weekly' });
  await reopenGoal(page);
  for (const tab of [1, 2, 3, 4]) {
    await gotoTab(page, tab);
    const fits = await page.evaluate(() => {
      const body = window.__gd().shadowRoot.querySelector('#modal').shadowRoot.querySelector('.body');
      return body.scrollWidth <= body.clientWidth;
    });
    expect(fits, `tab ${tab} overflows horizontally`).toBe(true);
  }
});

test('the page head stays pinned while the analytics body scrolls', async ({ page }) => {
  await createGoal(page, { title: 'Pinned head', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 1);
  const before = await page.evaluate(() =>
    window.__ga().shadowRoot.querySelector('.page-head').getBoundingClientRect().top);
  await page.evaluate(() => {
    const body = window.__gd().shadowRoot.querySelector('#modal').shadowRoot.querySelector('.body');
    body.scrollTop = 240;
  });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() =>
    window.__ga().shadowRoot.querySelector('.page-head').getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(2);
});

test('only charts that genuinely overflow become scrollable and keyboard-reachable', async ({ page }) => {
  await createGoal(page, { title: 'Overflow behaviour', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 3); // Activity

  const charts = await page.evaluate(() =>
    ['hist-scroll', 'cal-scroll', 'freq-scroll'].map(id => {
      const el = window.__ga().shadowRoot.querySelector('#' + id);
      if (!el) return null;
      return {
        id,
        overflows: el.scrollWidth > el.clientWidth,
        scrollable: el.classList.contains('scrollable-x'),
        tabindex: el.getAttribute('tabindex'),
        touchAction: getComputedStyle(el).touchAction,
      };
    }).filter(Boolean));

  const bodyTouchAction = await page.evaluate(() => getComputedStyle(
    window.__gd().shadowRoot.querySelector('#modal').shadowRoot.querySelector('.body')).touchAction);

  expect(charts.length).toBeGreaterThan(0);
  // The dialog body concedes the vertical axis and claims the horizontal one in
  // JS (Socle 1.3.0). Asserted here because everything below depends on it.
  expect(bodyTouchAction).toBe('pan-y pinch-zoom');

  for (const c of charts) {
    // Overflow, native scrolling and keyboard reachability are all the same switch.
    expect(c.scrollable, `${c.id} scrollable-x`).toBe(c.overflows);
    expect(c.tabindex, `${c.id} tabindex`).toBe(c.overflows ? '0' : null);
    // No chart may declare an axis of its own, overflowing or not. touch-action
    // intersects down the whole ancestor chain and a descendant can only ever
    // subtract: under the body's `pan-y pinch-zoom`, a chart asking for `pan-x`
    // intersects to nothing at all — the `none` that leaves the browser flinging
    // invisibly and spending the user's next tap cancelling it. These charts
    // carried `pan-x` until Socle 1.3.0, which looked like "let this one pan
    // sideways" but never could: native horizontal panning inside a tabbed
    // dialog is a platform constraint (docs/gestures.md, "Axis ownership"), and
    // the scroll-to-now pass plus keyboard scrolling cover it instead.
    expect(c.touchAction, `${c.id} touch-action`).toBe('auto');
  }
});

test('the analytics view never overflows the page horizontally', async ({ page }) => {
  await createGoal(page, { title: 'No page overflow', type: 'weekly' });
  await reopenGoal(page);
  for (const tab of [1, 2, 3, 4]) {
    await gotoTab(page, tab);
    const o = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    expect(o.doc, `tab ${tab} must not widen the document`).toBeLessThanOrEqual(o.win);
  }
});

test('every analytics page carries an h2 heading and labelled charts', async ({ page }) => {
  await createGoal(page, { title: 'A11y structure', type: 'weekly' });
  await reopenGoal(page);
  for (const tab of [2, 3, 4]) {
    await gotoTab(page, tab);
    const a11y = await page.evaluate(() => {
      const root = window.__ga().shadowRoot;
      return {
        h2: root.querySelector('h2.page-title')?.textContent?.trim() ?? null,
        unlabelledCharts: [...root.querySelectorAll('[role="img"]')]
          .filter(c => !c.getAttribute('aria-label')?.trim()).length,
      };
    });
    expect(a11y.h2, `tab ${tab} heading`).toBeTruthy();
    expect(a11y.unlabelledCharts, `tab ${tab} unlabelled charts`).toBe(0);
  }
});

test('the Edit tab is reachable again from the analytics footer', async ({ page }) => {
  await createGoal(page, { title: 'Back to edit', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 2);
  await page.evaluate(() => window.__gd().shadowRoot.querySelector('#analytics-edit-btn').click());
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({
    activeTab: window.__modal().activeTab,
    editVisible: !window.__gd().shadowRoot.querySelector('#view-main').hidden,
  }));
  expect(state.activeTab).toBe(0);
  expect(state.editVisible).toBe(true);
});

test('arrow keys page between analytics tabs without a swipe', async ({ page }) => {
  await createGoal(page, { title: 'Keyboard paging', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 1);

  await page.evaluate(() => {
    const tabs = window.__modal().shadowRoot.querySelector('.handle-tabs');
    tabs.querySelector('.tab-seg[aria-selected="true"]').focus();
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__modal().activeTab)).toBe(2);

  await page.evaluate(() => {
    const tabs = window.__modal().shadowRoot.querySelector('.handle-tabs');
    tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__modal().activeTab)).toBe(1);
});

// Geometry, so it has to be e2e — happy-dom resolves no layout at all, and
// this whole class of bug is about boxes ending up wider than their declared
// size. Both assertions guard the same root cause: .ax and .bar-col are
// `flex: 0 0 18px`, but a flex item's min-inline-size defaults to `auto`, so a
// slot holding a label wider than 18px silently grew to fit it. That made the
// labels row wider than the bars row it annotates (labels drifting off their
// own bar), and since the scroll container takes scrollWidth from the wider
// row, scrolling fully right stopped short of the newest bar — it read as the
// chart sitting centred rather than hanging right.
test('the histogram hangs its newest bar flush right, with the axis the same width as the bars', async ({ page }) => {
  await createGoal(page, { title: 'Flush right', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 3); // Activity

  const m = await page.evaluate(() => {
    const ga = window.__ga().shadowRoot;
    const sc = ga.querySelector('#hist-scroll');
    const bars = ga.querySelector('.histogram');
    const axis = ga.querySelector('.histogram-axis');
    return {
      overflows: sc.scrollWidth > sc.clientWidth,
      gapToRight: sc.getBoundingClientRect().right - bars.getBoundingClientRect().right,
      barsW: bars.getBoundingClientRect().width,
      axisW: axis.getBoundingClientRect().width,
      slots: [...axis.querySelectorAll('.ax')].map(a => a.getBoundingClientRect().width),
    };
  });

  expect(m.overflows).toBe(true); // 26 weeks never fits — otherwise this proves nothing
  expect(Math.abs(m.gapToRight)).toBeLessThan(1);
  expect(Math.abs(m.axisW - m.barsW)).toBeLessThan(1);
  expect(Math.max(...m.slots)).toBeLessThanOrEqual(18);
});

// Changing a timeframe used to call _render(), which replaces .page's innerHTML
// wholesale. The select was recreated with the same id so it looked fine, but
// it was a different node — so focus fell to the document body and a keyboard
// user was thrown to the top of the page on every change. Only .card-body is
// swapped now; .card-head, and therefore the select, is never touched.
// Needs e2e: this is about node identity and focus, neither of which happy-dom
// models faithfully through a shadow root.
test('changing a timeframe keeps focus on the select and leaves the rest of the page alone', async ({ page }) => {
  await createGoal(page, { title: 'Targeted render', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 1); // Overview

  const r = await page.evaluate(() => {
    const ga = window.__ga().shadowRoot;
    const sel = ga.querySelector('#tf-progress');
    const hero = ga.querySelector('.hero-number');
    const perf = ga.querySelector('#perf-body');
    const bodyHTML = ga.querySelector('#progress-body').innerHTML;
    sel.focus();
    const focusBefore = ga.activeElement?.id;
    sel.value = 'quarter';
    sel.dispatchEvent(new Event('change'));
    return {
      focusBefore,
      focusAfter: ga.activeElement?.id,
      sameSelect: ga.querySelector('#tf-progress') === sel,
      heroUntouched: ga.querySelector('.hero-number') === hero,
      otherCardUntouched: ga.querySelector('#perf-body') === perf,
      bodyChanged: ga.querySelector('#progress-body').innerHTML !== bodyHTML,
    };
  });

  expect(r.focusBefore).toBe('tf-progress');
  expect(r.focusAfter).toBe('tf-progress');   // was null — focus fell to <body>
  expect(r.sameSelect).toBe(true);
  expect(r.heroUntouched).toBe(true);
  expect(r.otherCardUntouched).toBe(true);
  expect(r.bodyChanged).toBe(true);           // the card it owns did update
});

test('the Activity histogram re-anchors to its newest bar after a targeted swap', async ({ page }) => {
  await createGoal(page, { title: 'Targeted activity', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 3); // Activity

  const r = await page.evaluate(async () => {
    const ga = window.__ga().shadowRoot;
    const sel = ga.querySelector('#tf-activity');
    const cal = ga.querySelector('#cal-scroll');
    sel.focus();
    sel.value = 'quarter';
    sel.dispatchEvent(new Event('change'));
    await new Promise(res => requestAnimationFrame(res));
    const hs = ga.querySelector('#hist-scroll');
    const bars = ga.querySelector('.histogram');
    return {
      focusAfter: ga.activeElement?.id,
      calendarUntouched: ga.querySelector('#cal-scroll') === cal,
      barCount: ga.querySelectorAll('.bar-col').length,
      gapToRight: hs.getBoundingClientRect().right - bars.getBoundingClientRect().right,
    };
  });

  expect(r.focusAfter).toBe('tf-activity');
  expect(r.calendarUntouched).toBe(true);     // only the histogram card rebuilt
  expect(r.barCount).toBe(4);                 // quarter, capped at the year's 4
  expect(Math.abs(r.gapToRight)).toBeLessThan(1); // _syncScrollable still ran
});

// goal-dialog's tab handler sets .year, .goal and .activePage on every tab
// change. All three setters re-render, so a tab change used to rebuild the page
// twice — once for a goal that had not changed, then again for the page that
// had. Both .year and .goal are reference-guarded now. Measured here rather
// than reasoned about: the wasted render was invisible, just slow.
test('switching analytics tabs rebuilds the page once, not twice', async ({ page }) => {
  await createGoal(page, { title: 'Render count', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 1); // Overview

  const r = await page.evaluate(async () => {
    const ga = window.__ga();
    let renders = 0;
    const orig = ga._render.bind(ga);
    ga._render = function () { renders++; return orig(); };

    // Nothing outside the dialog should be involved at all — .page lives in
    // goal-analytics' own shadow root, so the rows behind the modal are untouched.
    const home = document.querySelector('app-router').shadowRoot.querySelector('home-page');
    const firstRow = home.shadowRoot.querySelector('goal-item');

    window.__modal().shadowRoot.querySelectorAll('.tab-seg')[2].click(); // Overview -> Score
    await new Promise(res => setTimeout(res, 400));

    return {
      renders,
      scoreShown: !!ga.shadowRoot.querySelector('.calc-grid'),
      behindModalUntouched: home.shadowRoot.querySelector('goal-item') === firstRow,
    };
  });

  expect(r.renders).toBe(1);                 // was 2
  expect(r.scoreShown).toBe(true);           // and it did actually switch page
  expect(r.behindModalUntouched).toBe(true);
});

// Native horizontal panning is unavailable to these charts: modal-dialog's body
// declares `pan-y pinch-zoom` while tabs are active, touch-action intersects down
// the whole ancestor chain, and a descendant can never loosen what an ancestor
// restricted. Socle 1.3.0 names manual pointer-driven replication as the remedy
// (docs/gestures.md, "Axis ownership"). Confirmed broken on a real device before
// this existed — no scroll at all — so the drag path is worth pinning.
// scrollLeft on these charts is driven by goal-analytics' own rAF fling, so
// "has it stopped" can only be answered by watching frames — never by waiting a
// fixed time. A fling that slams into an edge terminates immediately (its
// `next === el.scrollLeft` guard), which is the common case and settles in
// ~300ms; one that merely decelerates *near* an edge has no such exit and
// crawls sub-pixel until |v| drops below FLING_MIN_VELOCITY, ~1s from a
// typical release velocity. A 600ms sleep caught that tail roughly once in
// twenty runs, reading a baseline that then drifted a pixel or two before the
// next assertion — the whole flake. Returns the settled value.
async function settledScrollLeft(page) {
  return page.evaluate(() => new Promise(resolve => {
    const el = window.__ga().shadowRoot.querySelector('#hist-scroll');
    let last = el.scrollLeft, stable = 0;
    const tick = () => {
      if (el.scrollLeft === last) stable++; else { stable = 0; last = el.scrollLeft; }
      if (stable >= 10) resolve(el.scrollLeft);   // ~165ms of no movement at 60fps
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

test('a chart that overflows can be dragged horizontally', async ({ page }) => {
  await createGoal(page, { title: 'Drag scroll', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 3); // Activity

  const box = await page.evaluate(() => {
    const el = window.__ga().shadowRoot.querySelector('#hist-scroll');
    return { ...el.getBoundingClientRect().toJSON(), overflows: el.scrollWidth > el.clientWidth };
  });
  expect(box.overflows).toBe(true); // 26 weeks never fits — otherwise this proves nothing

  // Opens anchored to "now" at the right edge, so drag right to go back in time.
  const before = await page.evaluate(() => window.__ga().shadowRoot.querySelector('#hist-scroll').scrollLeft);
  expect(before).toBeGreaterThan(0);

  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 40 + (120 * i / 6), y);
  await page.mouse.up();

  const after = await page.evaluate(() => window.__ga().shadowRoot.querySelector('#hist-scroll').scrollLeft);
  expect(after).toBeLessThan(before);          // dragging right scrolled back
  expect(before - after).toBeGreaterThan(50);  // and by roughly the drag distance

  // A vertical drag must be released to the dialog, not swallowed as a scroll.
  // The baseline has to be taken once the chart has genuinely stopped, or this
  // measures the tail of the coast rather than the vertical drag.
  const mid = await settledScrollLeft(page);
  await page.mouse.move(box.x + 100, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 100, y + (80 * i / 6));
  await page.mouse.up();
  const afterVertical = await page.evaluate(() => window.__ga().shadowRoot.querySelector('#hist-scroll').scrollLeft);
  expect(afterVertical).toBe(mid);
});

// The hand-rolled scroll needs hand-rolled momentum too: replicating the drag
// 1:1 stopped dead on release, which reads as broken next to every other scroll
// surface on the platform. Unlike the compositor fling that caused the swallowed
// taps, this one is ours — a press just cancels it and costs nothing.
test('a flicked chart keeps coasting after release, and a press stops it', async ({ page }) => {
  await createGoal(page, { title: 'Chart momentum', type: 'weekly' });
  await reopenGoal(page);
  await gotoTab(page, 3); // Activity

  const read = () => page.evaluate(() => window.__ga().shadowRoot.querySelector('#hist-scroll').scrollLeft);
  const box = await page.evaluate(() =>
    window.__ga().shadowRoot.querySelector('#hist-scroll').getBoundingClientRect().toJSON());
  const y = box.y + box.height / 2;

  // A fast flick: short, quick moves so the release velocity is real.
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(box.x + 40 + i * 24, y);
  const atRelease = await read();
  await page.mouse.up();

  await page.waitForTimeout(250);
  const coasted = await read();
  expect(coasted).toBeLessThan(atRelease); // kept going after the finger left

  // Pressing on a coasting chart stops it where it is.
  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(box.x + 60 + i * 24, y);
  await page.mouse.up();
  await page.waitForTimeout(40);
  const mid = await read();
  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const afterPress = await read();
  await page.mouse.up();
  expect(Math.abs(afterPress - mid)).toBeLessThan(12); // halted, not still coasting
});

// ── Streaks: a run of one is not a streak ────────────────────────────────────
// Seeded straight into IDB and loaded cold (mirrors upcoming.spec.js's own
// pattern), so these assert what a real launch renders rather than what a
// live setState happens to leave behind. The floor itself lives in
// topStreaks (MIN_STREAK_DAYS); goal-analytics.test.js covers the function.

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function seedGoalWithEntries(page, entries) {
  await page.evaluate(async ({ entries, year }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readwrite');
        const os = tx.objectStore('state');
        const g = os.get('root');
        g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}),
          goals: { [year]: {
            capstone: [{ id: 'streaky', title: 'Streak goal', tags: [],
                         tracking: { type: 'weekly', target: 5, entries } }],
            milestones: [], wow: [], focus: [],
          } },
        } });
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      };
      r.onerror = () => rej(r.error);
    });
  }, { entries, year: String(currentYear) });
  await page.reload();
  await waitForPage(page);
  await page.waitForFunction(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelectorAll('goal-item').length > 0);
}

test('the Streaks tab lists runs of 2+ days and ignores isolated ones', async ({ page }) => {
  // A 4-day run, a 2-day run, and three days that stand alone.
  await seedGoalWithEntries(page, [
    daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5),
    daysAgo(10), daysAgo(11),
    daysAgo(20), daysAgo(30), daysAgo(40),
  ]);
  await reopenGoal(page);
  await gotoTab(page, 4);

  const lengths = await page.evaluate(() =>
    [...window.__ga().shadowRoot.querySelectorAll('.streak-len')].map(el => el.textContent.trim()));
  // Rows are ordered most-recent-first: the 4-day run ended 2 days ago, the
  // 2-day run 10 days ago. Neither ordering nor length admits the three lone
  // days — they are gone entirely.
  expect(lengths).toEqual(['4d', '2d']);
});

test('the Streaks tab falls back to its empty note when no day has a neighbour', async ({ page }) => {
  await seedGoalWithEntries(page, [daysAgo(2), daysAgo(8), daysAgo(15)]);
  await reopenGoal(page);
  await gotoTab(page, 4);

  expect(await page.evaluate(() => window.__ga().shadowRoot.querySelectorAll('.streak-row').length)).toBe(0);
  const note = await page.evaluate(() => window.__ga().shadowRoot.querySelector('.empty-note')?.textContent ?? '');
  expect(note).toContain('two days in a row');
});
