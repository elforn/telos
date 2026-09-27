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

  expect(charts.length).toBeGreaterThan(0);
  for (const c of charts) {
    // The invariant that matters: overflow, native scrolling, and keyboard
    // reachability are all the same switch. A chart that can't scroll must stay
    // out of the tab order and must not claim touch-action, so the dialog's own
    // swipe-to-change-tab keeps working over it.
    expect(c.scrollable, `${c.id} scrollable-x`).toBe(c.overflows);
    expect(c.tabindex, `${c.id} tabindex`).toBe(c.overflows ? '0' : null);
    if (c.overflows) expect(c.touchAction, `${c.id} touch-action`).toBe('pan-x');
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
