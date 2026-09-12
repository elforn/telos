import { test, expect } from '@playwright/test';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();
const otherYear = currentYear - 5; // far enough that it's never accidentally "current"

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

test.describe('Hidden items — second-class list reachable only from the Upcoming dialog', () => {
  test('the hidden link appears in Upcoming, opens the Hidden-items modal, and its row navigates', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // A real, visible overdue goal (so the bell/Upcoming dialog have
    // something to open onto) plus one in a year whose deadlines default
    // hidden — the case the hidden-items link exists for.
    await seedState(page, {
      goals: {
        [currentYear]: { capstone: [{ id: 'g1', title: 'Ship investor deck', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: '2020-01-01' }], milestones: [], wow: [], focus: [] },
        [otherYear]: { capstone: [{ id: 'g2', title: 'Old forgotten goal', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: '2020-01-01' }], milestones: [], wow: [], focus: [] },
      },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#bell-btn')?.hidden === false
    );

    await openUpcomingDialog(page);

    // The real overdue goal shows as a normal row; the hidden one doesn't
    // appear as a section at all — only via the link.
    const rowCount = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelectorAll('.upcoming-row').length
    );
    expect(rowCount).toBe(1);

    const linkText = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('#upcoming-hidden-link').textContent
    );
    expect(linkText).toBe('1 hidden — tap to review');

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('#upcoming-hidden-link').click()
    );

    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot
        ?.querySelector('#hidden-items-dialog')?.shadowRoot
        ?.querySelector('#dialog')?.shadowRoot?.querySelector('dialog')?.open
    );

    const hiddenRowText = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#hidden-items-dialog').shadowRoot
        .querySelector('.hidden-row-title').textContent
    );
    expect(hiddenRowText).toBe('Old forgotten goal');

    // Tapping the row navigates to the goal's year, without turning its
    // deadline visibility back on.
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#hidden-items-dialog').shadowRoot
        .querySelector('.hidden-row').click()
    );

    await page.waitForFunction(y =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.params?.year === String(y)
    , otherYear);

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.classList.contains('nav-flash')
    );

    const urgencyAfterNav = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').dataset.urgency
    );
    // Still 'none' — landing on it does not re-enable deadlines for the year.
    expect(urgencyAfterNav).toBe('none');

    const stillHidden = await page.evaluate(() => new Promise(res => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readonly');
        const req = tx.objectStore('state').get('root');
        req.onsuccess = () => { db.close(); res(req.result?.data?.goalsDeadlinesVisible ?? {}); };
      };
    }));
    expect(stillHidden).not.toHaveProperty(String(otherYear), true);
  });

  test('an archived-but-overdue goal in the current (visible) year shows in Hidden, labelled Archived, and tapping it reveals the Archived filter so the row is actually visible', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // Current year, deadlines fully on ('full' by default) — archiving is
    // its own independent reason to be hidden, not tied to the year setting.
    await seedState(page, {
      goals: {
        [currentYear]: { capstone: [{ id: 'g1', title: 'Retired but overdue', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: '2020-01-01', archived: true }], milestones: [], wow: [], focus: [] },
      },
    });
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#bell-btn')?.hidden === false
    );

    await openUpcomingDialog(page);

    // Archived means it never appears as a normal Upcoming row...
    const rowCount = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelectorAll('.upcoming-row').length
    );
    expect(rowCount).toBe(0);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('#upcoming-hidden-link').click()
    );
    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot
        ?.querySelector('#hidden-items-dialog')?.shadowRoot
        ?.querySelector('#dialog')?.shadowRoot?.querySelector('dialog')?.open
    );

    // ...but does appear in Hidden, labelled distinctly from a deadline-off year.
    const hiddenRowSub = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#hidden-items-dialog').shadowRoot
        .querySelector('.hidden-row-sub').textContent
    );
    expect(hiddenRowSub).toContain('Archived');

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#hidden-items-dialog').shadowRoot
        .querySelector('.hidden-row').click()
    );

    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item')?.classList.contains('nav-flash')
    );

    // The row is genuinely visible now (not just present-but-hidden), and
    // shows its real overdue/Failed state, not a suppressed 'none'.
    const state = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return { hidden: item.hidden, urgency: item.dataset.urgency, failed: item.hasAttribute('data-failed') };
    });
    expect(state.hidden).toBe(false);
    expect(state.urgency).toBe('overdue');
    expect(state.failed).toBe(true);

    const archivedPillActive = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-archived').classList.contains('active')
    );
    expect(archivedPillActive).toBe(true);
  });

  test('when everything visible is quiet, the bell still stays reachable (no numeric badge) so the hidden link isn\'t stranded', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // Nothing in the current (visible) year — only a hidden year has an
    // overdue goal. Before this fix the bell itself stayed hidden here,
    // stranding the user with no in-app way back to the Hidden-items dialog.
    await seedState(page, {
      goals: {
        [otherYear]: { capstone: [{ id: 'g2', title: 'Old forgotten goal', tags: [], tracking: { type: 'percentage', value: 10 }, dueDate: '2020-01-01' }], milestones: [], wow: [], focus: [] },
      },
    });
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() =>
      document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#bell-btn')?.hidden === false
    );
    const badgeText = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#bell-badge').textContent
    );
    expect(badgeText).toBe('');

    await openUpcomingDialog(page);
    const linkText = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot
        .querySelector('#upcoming-dialog').shadowRoot
        .querySelector('#upcoming-hidden-link').textContent
    );
    expect(linkText).toBe('1 hidden — tap to review');
  });
});
