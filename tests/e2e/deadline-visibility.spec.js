import { test, expect } from '@playwright/test';
import { waitForPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Direct IDB seed (mirrors upcoming.spec.js's own pattern) — boots the app
// from real persisted state so the toggles reflect what a cold load would
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

async function openYearMenu(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#menu')?.shadowRoot?.querySelector('dialog')?.open
  );
}

async function clickYearDeadlinesOff(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#deadlines-off-btn').click();
  });
}

async function clickYearDeadlinesWarn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#deadlines-warn-btn').click();
  });
}

async function openListDetailMenu(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#menu-btn').click();
  });
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#menu')?.shadowRoot?.querySelector('dialog')?.open
  );
}

async function clickListDeadlinesHide(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#deadlines-hide-btn').click();
  });
}

// Checks real computed style, not just the .hidden DOM property — a native
// [hidden] attribute can be silently overridden by an author CSS rule
// declaring `display` on the same element (author origin beats the UA
// [hidden] rule regardless of specificity), which happy-dom's own unit
// tests can't catch since they never compute real CSS.
function badgeDisplay(page, path) {
  return page.evaluate(path => {
    let el = document.querySelector('app-router').shadowRoot.querySelector(path[0]).shadowRoot;
    for (const step of path.slice(1, -1)) el = el.querySelector(step).shadowRoot;
    el = el.querySelector(path[path.length - 1]);
    return getComputedStyle(el).display;
  }, path);
}

test.describe('Deadline visibility — year level', () => {
  test('hiding deadlines for the current year clears a goal\'s full-row-red, the bell badge, and shows the hidden badge next to year-header\'s filter button', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: { [currentYear]: { capstone: [{ id: 'g1', title: 'Ship investor deck', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-2) }], milestones: [], wow: [], focus: [] } },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.dataset.urgency === 'overdue'
    );

    const bellHiddenBefore = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-btn').hidden
    );
    expect(bellHiddenBefore).toBe(false);

    const badgePath = ['home-page', 'year-header', '#deadlines-hidden-badge'];
    expect(await badgeDisplay(page, badgePath)).toBe('none');

    await openYearMenu(page);
    await clickYearDeadlinesOff(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.dataset.urgency === 'none'
    );

    expect(await badgeDisplay(page, badgePath)).not.toBe('none');

    // The bell stays reachable (it's the only path to the Hidden-items
    // dialog) but drops its red numeric badge, since this goal is now a
    // second-class hidden item, not something to act on today.
    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#bell-badge')?.hidden === true
    );
    const bellHiddenAfter = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-btn').hidden
    );
    expect(bellHiddenAfter).toBe(false);
  });
});

test.describe('Deadline visibility — the Warn level', () => {
  test('Warn clears a goal\'s full-row-red but keeps its icon, is not treated as hidden, and survives a cold reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: { [currentYear]: { capstone: [{ id: 'g1', title: 'Ship investor deck', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-2) }], milestones: [], wow: [], focus: [] } },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.hasAttribute('data-failed')
    );

    const badgePath = ['home-page', 'year-header', '#deadlines-hidden-badge'];
    expect(await badgeDisplay(page, badgePath)).toBe('none'); // 'full' isn't hidden either

    await openYearMenu(page);
    await clickYearDeadlinesWarn(page);

    // Failed clears, but the icon itself stays exactly as it was.
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.hasAttribute('data-failed') === false
    );
    const iconAtWarn = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').dataset.urgency
    );
    expect(iconAtWarn).toBe('overdue');

    // 'warn' is not "hidden" — the awareness badge stays off, unlike 'off'.
    expect(await badgeDisplay(page, badgePath)).toBe('none');

    // Persists across a cold reload, both the stored value and the render.
    const stored = await page.evaluate(() => new Promise(res => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readonly');
        const req = tx.objectStore('state').get('root');
        req.onsuccess = () => { db.close(); res(req.result?.data?.goalsDeadlinesVisible); };
      };
    }));
    expect(stored).toEqual({ [currentYear]: 'warn' });

    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.dataset.urgency === 'overdue'
    );
    const failedAfterReload = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').hasAttribute('data-failed')
    );
    expect(failedAfterReload).toBe(false);
  });
});

test.describe('Deadline visibility — list level', () => {
  test('hiding deadlines for one list clears its items\' full-row-red without affecting other lists, and shows the hidden badge next to list-detail-page\'s filter button', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      lists: [
        { id: 'l1', name: 'Admin', items: [{ id: 'i1', title: 'Renew passport', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(-1) }] },
      ],
    });
    await page.reload();
    await page.goto('/lists/l1');
    await waitForListDetailPage(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.dataset.urgency === 'overdue'
    );

    const badgeDisplayDirect = () => page.evaluate(() => {
      const el = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#deadlines-hidden-badge');
      return getComputedStyle(el).display;
    });
    expect(await badgeDisplayDirect()).toBe('none');

    await openListDetailMenu(page);
    await clickListDeadlinesHide(page);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.dataset.urgency === 'none'
    );

    expect(await badgeDisplayDirect()).not.toBe('none');

    const stored = await page.evaluate(() => new Promise(res => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readonly');
        const req = tx.objectStore('state').get('root');
        req.onsuccess = () => { db.close(); res(req.result?.data?.listsDeadlinesVisible); };
      };
    }));
    expect(stored).toEqual({ l1: false });
  });
});
