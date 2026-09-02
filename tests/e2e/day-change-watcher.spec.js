import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

// Real browser coverage for app/utils/day-change-watcher.js — the unit
// tests already cover the tracker/wiring logic against fakes; this proves
// the actual visibilitychange event, dispatched for real, reaches the real
// goal-item/bottom-nav DOM without a reload, in a real service-worker-backed
// page. See CLAUDE.md's Common mistakes note: nothing else in the app
// proactively re-checks "what day is it".

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

async function resume(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function hide(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.describe('Resuming on a new calendar day', () => {
  test('a goal-item\'s urgency icon and the bell badge both refresh on resume, with no reload', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 7, 10, 10, 0, 0)); // Monday
    const year = '2026';
    await page.goto(`/${year}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: {
        [year]: {
          capstone: [{ id: 'g1', title: 'Gym', tracking: { type: 'weekly', value: 0, target: 1, entries: [], reminderDays: ['mon'] } }],
          milestones: [], wow: [], focus: [],
        },
      },
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    const before = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item')?.dataset.urgency
    );
    expect(before).toBe('today'); // Monday is itself the scheduled day

    const bellBefore = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-badge')?.textContent
    );
    expect(bellBefore).toBe('1');

    // Tuesday, no reload — Monday's scheduled day was missed and is still
    // recoverable, so the row should turn full-row-red once the app notices.
    await page.clock.setFixedTime(new Date(2026, 7, 11, 9, 0, 0));
    await resume(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item')?.dataset.urgency === 'overdue'
    );

    const bellAfter = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-badge')?.textContent
    );
    expect(bellAfter).toBe('1'); // still 1 — overdue+today both count, just a different item now
  });

  test('does not refresh while the tab stays hidden, even once the day has moved on', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 7, 10, 10, 0, 0)); // Monday
    const year = '2026';
    await page.goto(`/${year}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: {
        [year]: {
          capstone: [{ id: 'g1', title: 'Gym', tracking: { type: 'weekly', value: 0, target: 1, entries: [], reminderDays: ['mon'] } }],
          milestones: [], wow: [], focus: [],
        },
      },
    });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item')?.dataset.urgency === 'today'
    );

    await page.clock.setFixedTime(new Date(2026, 7, 11, 9, 0, 0));
    await hide(page);
    await page.waitForTimeout(200); // give any (unwanted) refresh a chance to happen

    const urgency = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item')?.dataset.urgency
    );
    expect(urgency).toBe('today'); // unchanged — still hidden, nothing re-ran
  });
});
