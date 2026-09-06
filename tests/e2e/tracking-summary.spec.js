import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// Direct IDB seed (mirrors upcoming.spec.js's own pattern) — boots the app
// from real persisted state so the dialog reflects what a cold load would
// actually show, not just a live setState.
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

async function openGoalDialog(page) {
  const bounds = await page.evaluate(() => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-list goal-item').shadowRoot
      .querySelector('.bar');
    return bar?.getBoundingClientRect().toJSON();
  });
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

function trackingSummary(page) {
  return page.evaluate(() => {
    const el = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#tracking-summary');
    return { hidden: el.hidden, text: el.textContent };
  });
}

// The tracking summary only ever shows for an already-saved goal (never a
// brand-new draft) — seeding straight into IDB and reopening an existing
// goal's dialog is the only real path to it, unlike the rest of this file's
// sibling specs which build goals fresh through the creation flow.
test.describe('Goal dialog — tracking summary (real store round-trip)', () => {
  test('percentage goal shows "P: N% complete" near the title', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: { [currentYear]: { capstone: [{ id: 'g1', title: 'Read a book', tags: [], tracking: { type: 'percentage', value: 42 } }], milestones: [], wow: [], focus: [] } },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')
    );

    await openGoalDialog(page);
    const summary = await trackingSummary(page);
    expect(summary.hidden).toBe(false);
    expect(summary.text).toBe('P: 42% complete');
  });

  test('scheduled-days weekly goal shows "D: " plus a 7-slot, non-sighted-accessible day strip', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // Every weekday scheduled, no entries yet — deterministic regardless of
    // which real-world weekday the test happens to run on (each day is
    // either 'missed' or 'pending', never 'unscheduled'/'blank').
    await seedState(page, {
      goals: {
        [currentYear]: {
          capstone: [{
            id: 'g1', title: 'Meditate', tags: [],
            tracking: { type: 'weekly', target: 7, value: 0, entries: [], reminderDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
          }],
          milestones: [], wow: [], focus: [],
        },
      },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')
    );

    await openGoalDialog(page);

    const summary = await trackingSummary(page);
    expect(summary.hidden).toBe(false);
    expect(summary.text).toMatch(/^D: /);
    expect(summary.text).toContain('%'); // the "at P%" suffix alongside the strip

    const strip = await page.evaluate(() => {
      const el = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tracking-summary .day-strip');
      return {
        role: el.getAttribute('role'),
        label: el.getAttribute('aria-label'),
        slotCount: el.querySelectorAll('.day-slot').length,
      };
    });
    expect(strip.role).toBe('img');
    expect(strip.slotCount).toBe(7);
    // Every day is scheduled with nothing logged, so the label is entirely
    // "missed"/"scheduled" — a real screen-reader-visible per-day readout,
    // not just the 7 coloured letters sighted users see. Checks for all 7
    // day markers rather than splitting on ", " — one state's own label
    // ("logged, not scheduled") contains that exact separator, so a plain
    // split would be ambiguous (doesn't occur in this all-scheduled fixture,
    // but the check should hold regardless).
    expect(strip.label).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun): /);
    for (const dow of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(strip.label).toContain(`${dow}: `);
    }
    expect(strip.label).toMatch(/missed|scheduled/);
  });
});
