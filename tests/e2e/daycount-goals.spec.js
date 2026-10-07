// Computed-style regression coverage for the day-count type. Lives in e2e
// rather than a unit test deliberately: happy-dom reports DOM properties, not
// resolved CSS, so it cannot catch a specificity loss — which is exactly what
// happened here (the blanket input[type="text"] rule, 0-1-1, silently beat
// .count-chip-input at 0-1-0 and the field kept rendering as a plain box).
// Confirms the day-count count field really
// renders as the accent pill rather than a default text box, by reading
// computed styles in a real browser instead of trusting the stylesheet.
// Uses the new-goal path because an existing goal's dialog opens on the
// Overview tab, leaving the edit form unlaid-out at zero height.
import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

test('day-count count field renders as the accent pill, stretched to the stepper', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
    ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open);

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('.type-pill[data-type="daycount"]').click();
  });

  await page.waitForFunction(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    return dlg.querySelector('#target-input')?.getBoundingClientRect().height > 0;
  });

  const m = await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    const input = dlg.querySelector('#target-input');
    const stepper = dlg.querySelector('#target-mini-stepper');
    const cs = getComputedStyle(input);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      radius: cs.borderTopLeftRadius,
      borderWidth: cs.borderTopWidth,
      value: input.value,
      inputH: Math.round(input.getBoundingClientRect().height),
      stepperH: Math.round(stepper.getBoundingClientRect().height),
      inputW: Math.round(input.getBoundingClientRect().width),
    };
  });

  expect(m.borderWidth).toBe('0px');
  expect(m.background).toBe('rgb(91, 173, 224)');      // --color-accent, not the UA box
  expect(m.color).toBe('rgb(255, 255, 255)');
  expect(parseFloat(m.radius)).toBeGreaterThan(20);     // full pill, not a 6px input corner
  expect(m.value).toBe('50');
  expect(m.inputH).toBeGreaterThan(0);                  // guards the stretch check below
  expect(m.inputH).toBe(m.stepperH);                    // matches the stepper beside it
});

test('the diamond and its contour are both rounded, with an even gap between them', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
    ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open);
  await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    dlg.querySelector('.type-pill[data-type="daycount"]').click();
    dlg.querySelector('#input').value = 'Cold plunge';
    dlg.querySelector('#input').dispatchEvent(new Event('input', { bubbles: true }));
    dlg.querySelector('#close').click();
  });
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('#capstone-list goal-item'));

  const g = await page.evaluate(() => {
    const row = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item').shadowRoot;
    const fill = row.querySelector('.daycount-fill path');
    const ring = row.querySelector('.daycount-ring path');
    const box = r => ({ w: +r.getBBox().width.toFixed(2), h: +r.getBBox().height.toFixed(2) });
    return {
      fillD: fill.getAttribute('d'),
      ringD: ring.getAttribute('d'),
      fill: box(fill),
      ring: box(ring),
      ringStroke: getComputedStyle(ring).strokeWidth,
      ringFill: getComputedStyle(ring).fill,
    };
  });

  // Both paths use quadratic corners — a sharp polygon would have none.
  expect(g.fillD).toContain('Q');
  expect(g.ringD).toContain('Q');
  expect(g.ringFill).toBe('none');
  // Fill is the standard 27px token; the ring sits evenly outside it.
  expect(g.fill.w).toBeCloseTo(27, 0);
  expect(g.fill.h).toBeCloseTo(27, 0);
  const gap = (g.ring.w - g.fill.w) / 2;
  expect(gap).toBeGreaterThan(1.5);
  expect(gap).toBeLessThan(3);
});

// ── Behaviour, not styling ────────────────────────────────────────────────
// The token is both the visual and the tap target, so this needs real pointer
// events (the Gestures mixin ignores synthetic clicks) and a real reload to
// prove the entry reached IDB — neither is reachable from happy-dom.

async function openDialog(page, addBtnId) {
  await page.evaluate(id => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector(id).click();
  }, addBtnId);
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
    ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open);
}

async function createDayCountGoal(page, title, target) {
  await openDialog(page, '#add-capstone');
  await page.evaluate(n => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    dlg.querySelector('.type-pill[data-type="daycount"]').click();
    const field = dlg.querySelector('#target-input');
    field.value = String(n);
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, target);
  await page.evaluate(t => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    const inp = dlg.querySelector('input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    dlg.querySelector('#close').click();
  }, title);
  await page.waitForFunction(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot
    .querySelectorAll('#capstone-list goal-item').length === 1);
}

function rowState(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('#capstone-list goal-item');
    const root = item.shadowRoot;
    return {
      entries: item._goal.tracking.entries.length,
      target: item._goal.tracking.target,
      type: item._goal.tracking.type,
      numeral: root.querySelector('.daycount-num').textContent,
      logged: root.querySelector('.daycount-token').classList.contains('logged'),
      fillWidth: root.querySelector('.fill').style.width,
    };
  });
}

test('tapping the diamond logs today, and the entry survives a reload', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);
  await createDayCountGoal(page, 'Cold plunge', 50);

  expect(await rowState(page)).toMatchObject({ type: 'daycount', target: 50, entries: 0, numeral: '0', logged: false });

  // A real tap on the token itself — the single-tap shortcut, not the
  // 500ms hold that works anywhere else on the row.
  const box = await page.evaluate(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('#capstone-list goal-item').shadowRoot
    .querySelector('.daycount-token').getBoundingClientRect().toJSON());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await page.waitForFunction(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('#capstone-list goal-item')
    ._goal.tracking.entries.length === 1);

  const after = await rowState(page);
  expect(after.numeral).toBe('1');      // days done, not the target
  expect(after.logged).toBe(true);      // contour showing
  expect(after.fillWidth).toBe('2%');   // 1/50 — the flat count, no weighting

  // The store writes to IDB asynchronously; reloading before it lands would
  // test the reload, not the persistence.
  await waitForIDBFlush(page);
  await page.reload();
  await waitForPage(page);
  // The whole tracking shape has to survive, not just the entry — a type or
  // target lost on the way through IDB would silently rescore the goal.
  expect(await rowState(page)).toMatchObject({
    type: 'daycount', target: 50, entries: 1, numeral: '1', logged: true, fillWidth: '2%',
  });
});

test('Fix-a-day never offers a date before 1 January of the goal year', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);
  await createDayCountGoal(page, 'Cold plunge', 160);

  const box = await page.evaluate(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('#capstone-list goal-item').shadowRoot
    .querySelector('.bar').getBoundingClientRect().toJSON());
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height / 2);
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
    ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open);

  await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    dlg.querySelector('#fixday-chip').click();
  });

  const strip = await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    const chips = [...dlg.querySelectorAll('#fixday-chips .day-chip')];
    return { first: chips[0].dataset.iso, last: chips[chips.length - 1].dataset.iso, count: chips.length };
  });

  // The bug this guards: a 160-day goal's strip used to reach back 366 days,
  // into the previous year. One backfilled December date then became the
  // first entry, and the whole streak pace line was anchored on it.
  const year = new Date().getFullYear();
  expect(strip.first).toBe(`${year}-01-01`);
  expect(strip.last.startsWith(String(year))).toBe(true);
});
