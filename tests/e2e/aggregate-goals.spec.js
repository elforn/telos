// Real-browser coverage for the "Group" (aggregate) type. These four things
// cannot be checked in happy-dom, which reports DOM properties rather than
// resolved CSS and has no layout at all:
//   1. the 7th type pill really spanning the full grid row
//   2. the members block really rendering (and every other per-type block
//      really being out of the way) once Group is picked
//   3. the goal picker opening above goal-dialog as a second <dialog>
//   4. the reconciler's microtask write-back reaching the rendered row —
//      the end-to-end proof that editing a member updates its group
import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

const homeSR = () => document.querySelector('app-router').shadowRoot
  .querySelector('home-page').shadowRoot;
const dialogSR = () => homeSR().querySelector('goal-dialog').shadowRoot;

async function openNewCapstone(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => document.querySelector('app-router')?.shadowRoot
    ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
    ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open);
}

test('the 7th type pill spans the full grid row', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);
  await openNewCapstone(page);

  const m = await page.evaluate(() => {
    const group = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('#type-pills');
    const pills = [...group.querySelectorAll('.type-pill')];
    const last = pills[pills.length - 1];
    return {
      count: pills.length,
      lastType: last.dataset.type,
      groupW: Math.round(group.getBoundingClientRect().width),
      lastW: Math.round(last.getBoundingClientRect().width),
      firstW: Math.round(pills[0].getBoundingClientRect().width),
    };
  });

  expect(m.count).toBe(7);
  expect(m.lastType).toBe('aggregate');
  // Seven pills at three per row leaves one alone on the last row, which the
  // :last-child:nth-child(3n+1) rule stretches across the whole width.
  expect(m.lastW).toBeGreaterThan(m.firstW * 2);
  // Ratio rather than a pixel equality: the group box carries its own
  // padding, so the stretched pill is a few px narrower by design. What is
  // being asserted is that it spans the row, not that it matches to the px.
  expect(m.lastW / m.groupW).toBeGreaterThan(0.9);
});

test('picking Group reveals the members block and hides every other per-type block', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);

  await openNewCapstone(page);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('.type-pill[data-type="aggregate"]').click();
  });

  const m = await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    const block = dlg.querySelector('#members-block');
    const addBtn = dlg.querySelector('#members-add-btn');
    return {
      blockHidden: block.hidden,
      blockDisplay: getComputedStyle(block).display,
      // The empty state and the add affordance both have to actually render.
      emptyH: Math.round(dlg.querySelector('#members-empty').getBoundingClientRect().height),
      addH: Math.round(addBtn.getBoundingClientRect().height),
      addBorderStyle: getComputedStyle(addBtn).borderTopStyle,
      // Every other per-type block must be out of the way.
      targetHidden: dlg.querySelector('#target-block').hidden,
      countdownHidden: dlg.querySelector('#countdown-block').hidden,
      reminderHidden: dlg.querySelector('#reminder-days-block').hidden,
    };
  });

  expect(m.blockHidden).toBe(false);
  expect(m.blockDisplay).not.toBe('none');
  expect(m.emptyH).toBeGreaterThan(0);
  expect(m.addH).toBeGreaterThanOrEqual(40);
  expect(m.addBorderStyle).toBe('dashed');
  expect(m.targetHidden).toBe(true);
  expect(m.countdownHidden).toBe(true);
  expect(m.reminderHidden).toBe(true);
});

test('the goal picker opens above goal-dialog and returns to it on Back', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);
  await openNewCapstone(page);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('.type-pill[data-type="aggregate"]').click();
  });

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('#members-add-btn').click();
  });
  await page.waitForFunction(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
    .querySelector('#goal-picker').shadowRoot.querySelector('#modal').shadowRoot
    .querySelector('dialog')?.open);

  const both = await page.evaluate(() => {
    const dlg = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
    const outer = dlg.querySelector('#modal').shadowRoot.querySelector('dialog');
    const picker = dlg.querySelector('#goal-picker').shadowRoot
      .querySelector('#modal').shadowRoot.querySelector('dialog');
    return { outerOpen: outer.open, pickerOpen: picker.open };
  });
  // Both stacked, the goal dialog still open underneath.
  expect(both.outerOpen).toBe(true);
  expect(both.pickerOpen).toBe(true);

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
      .querySelector('#goal-picker').shadowRoot.querySelector('#back-btn').click();
  });
  await page.waitForFunction(() => !document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
    .querySelector('#goal-picker').shadowRoot.querySelector('#modal').shadowRoot
    .querySelector('dialog').open);

  const after = await page.evaluate(() => document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot
    .querySelector('#modal').shadowRoot.querySelector('dialog').open);
  expect(after).toBe(true);
});

// Seeds real persisted state, so the app boots from it exactly as a cold
// load would (the same direct-IDB pattern deadline-visibility.spec.js uses —
// the built bundle has no importable store module to reach into).
async function seedState(page, patch) {
  await page.evaluate(async patch => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readwrite');
        const os = tx.objectStore('state');
        const g = os.get('root');
        g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}), ...patch } });
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      };
      r.onerror = () => rej(r.error);
    });
  }, patch);
}

const groupFill = () => {
  const row = [...document.querySelector('app-router').shadowRoot
    .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')]
    .find(el => el._goal?.id === 'grp');
  return row?.shadowRoot.querySelector('.fill').style.width ?? null;
};

test('editing a member updates its group’s rendered row, with no further interaction', async ({ page }) => {
  await page.goto(`/${currentYear}`);
  await waitForPage(page);

  const y = String(currentYear);
  await seedState(page, {
    goals: {
      [y]: {
        capstone: [{
          id: 'grp', title: 'Ship the book', tags: [],
          tracking: { type: 'aggregate', members: [{ year: y, section: 'focus', goalId: 'mem' }] },
        }],
        milestones: [], wow: [],
        focus: [{ id: 'mem', title: 'First draft', tags: [], tracking: { type: 'percentage', value: 20 } }],
      },
    },
  });
  await page.reload();
  await waitForPage(page);

  // The boot pass alone should have computed the group from its member.
  await page.waitForFunction(`(${groupFill.toString()})() === '20%'`);

  const before = await page.evaluate(() => {
    const row = [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')]
      .find(el => el._goal?.id === 'grp');
    return {
      label: row.shadowRoot.querySelector('.pct-label').textContent,
      labelHidden: row.shadowRoot.querySelector('.pct-label').hidden,
      readonly: row.shadowRoot.querySelector('.bar').getAttribute('aria-readonly'),
    };
  });
  expect(before.label).toBe('1 goal');
  expect(before.labelHidden).toBe(false);
  // No glyph and nothing to scrub, so the bar announces itself read-only.
  expect(before.readonly).toBe('true');

  // Move the MEMBER through its own row's real keyboard path — goal-progress
  // up to home-page, a store write, the reconciler, back down to this row.
  // Four 5% steps: 20 -> 40.
  await page.evaluate(() => {
    const row = [...document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')]
      .find(el => el._goal?.id === 'mem');
    for (let i = 0; i < 4; i++) row.onHoldDragKey('right');
  });

  await page.waitForFunction(`(${groupFill.toString()})() === '40%'`);

  await waitForIDBFlush(page);
  const persisted = await page.evaluate(async () => {
    return new Promise(res => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const g = db.transaction('state', 'readonly').objectStore('state').get('root');
        g.onsuccess = () => { res(g.result?.data); db.close(); };
      };
    });
  });
  const grp = persisted.goals[String(new Date().getFullYear())].capstone.find(g => g.id === 'grp');
  expect(grp.tracking.aggValue).toBe(40);
  // No history is recorded: aggValue is a cache, and the evolution curve is
  // derived from the members at render time instead.
  expect('history' in grp.tracking).toBe(false);
});
