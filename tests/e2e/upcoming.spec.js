import { test, expect } from '@playwright/test';
import { waitForPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Direct IDB seed (mirrors persistence.spec.js's own pattern) — boots the app
// from real persisted state so the bell/dialog reflect what a cold load would
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

async function openUpcomingDialog(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-btn').click()
  );
  await page.waitForFunction(() =>
    document.querySelector('bottom-nav')?.shadowRoot
      ?.querySelector('#upcoming-dialog')?.shadowRoot
      ?.querySelector('#dialog')?.shadowRoot?.querySelector('dialog')?.open
  );
}

test.describe('Upcoming dialog', () => {
  test('bell shows an overdue+today count and opens the dialog', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: { [currentYear]: { capstone: [{ id: 'g1', title: 'Ship investor deck', tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-2) }], milestones: [], wow: [], focus: [] } },
      lists: [{ id: 'l1', name: 'Admin', items: [{ id: 'i1', title: 'Renew passport', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(0) }] }],
    });
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#bell-btn')?.hidden === false
    );
    const badgeText = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-badge').textContent
    );
    expect(badgeText).toBe('2');

    await openUpcomingDialog(page);
    const rowCount = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelectorAll('.upcoming-row').length
    );
    expect(rowCount).toBe(2);
  });

  test('tapping a goal row navigates to its year and scrolls/flashes it, without opening goal-dialog', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // Goal lives in a year other than the one currently displayed — the case
    // the bell's badge (spanning every year) exists for in the first place.
    const otherYear = currentYear - 1;
    await seedState(page, {
      goals: { [otherYear]: { capstone: [{ id: 'g1', title: 'Ship investor deck', tracking: { type: 'percentage', value: 10 }, dueDate: isoDaysFromNow(-2) }], milestones: [], wow: [], focus: [] } },
      lists: [],
    });
    await page.reload();
    await waitForPage(page);

    await openUpcomingDialog(page);
    await page.evaluate(() => {
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('.upcoming-row').click();
    });

    // Router swaps home-page for the goal's year
    await page.waitForFunction(y =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.params?.year === String(y)
    , otherYear);

    // Lands on the goal itself (flashed), not a bare edit modal
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.classList.contains('nav-flash')
    );
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.title').textContent
    );
    expect(title).toBe('Ship investor deck');

    const dialogOpen = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open ?? false
    );
    expect(dialogOpen).toBe(false);
  });

  test('tapping an item row navigates to its list and scrolls/flashes it, without opening item-dialog', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await seedState(page, {
      goals: {},
      lists: [{ id: 'l1', name: 'Admin', items: [{ id: 'i1', title: 'Renew passport', status: 'open', tags: [], inGoals: [], dueDate: isoDaysFromNow(-1) }] }],
    });
    await page.reload();
    await waitForPage(page);

    await openUpcomingDialog(page);
    await page.evaluate(() => {
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('.upcoming-row').click();
    });

    await waitForListDetailPage(page);
    await waitForIDBFlush(page);

    // Lands on the item itself (flashed), not a bare edit modal
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-item')?.classList.contains('nav-flash')
    );
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-item').shadowRoot
        .querySelector('.title').textContent
    );
    expect(title).toBe('Renew passport');

    const dialogOpen = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('item-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open ?? false
    );
    expect(dialogOpen).toBe(false);
  });
});
