import { test, expect } from '@playwright/test';
import { waitForPage as waitForHomePage, waitForListsPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

async function createCapstoneGoal(page, title) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#add-capstone').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
  await page.evaluate(t => {
    const sr = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot;
    const inp = sr.querySelector('input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    sr.querySelector('#close').click();
  }, title);
  await page.waitForFunction(() => {
    const list = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list');
    return list?.querySelectorAll('goal-item').length > 0;
  });
}

function getCapstoneItem(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list goal-item');
    return item ? { title: item._goal?.title, percentage: item._goal?.tracking?.value } : null;
  });
}

test.describe('Data persistence', () => {
  test('capstone goal title persists across page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    await createCapstoneGoal(page, 'Run a marathon');

    await waitForIDBFlush(page);
    await page.reload();
    await waitForHomePage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    const item = await getCapstoneItem(page);
    expect(item?.title).toBe('Run a marathon');
  });

  test('capstone goal progress persists across page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    await createCapstoneGoal(page, 'Persistence test');

    await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      bar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return (item?._goal?.tracking?.value ?? 0) > 0;
    });

    const before = await getCapstoneItem(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForHomePage(page);

    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    const after = await getCapstoneItem(page);
    expect(after?.percentage).toBe(before?.percentage);
  });

  test('editing an existing frequency goal (weekly→monthly switch + target) persists across page reload', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    // Create as weekly via the type pill, same as frequency-goals.spec.js.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#add-capstone').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="weekly"]').click();
    });
    await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot;
      const inp = sr.querySelector('input');
      inp.value = 'Stretch';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      sr.querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    // Reopen and switch weekly → monthly, bump the target.
    const barBox = await page.evaluate(() => {
      const bar = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.bar');
      return bar.getBoundingClientRect().toJSON();
    });
    await page.mouse.move(barBox.x + barBox.width * 0.5, barBox.y + barBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('.type-pill[data-type="monthly"]').click();
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#target-up').click();
    });
    await page.waitForFunction(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tracking?.type === 'monthly' && item?._goal?.tracking?.target === 5;
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });

    await waitForIDBFlush(page);
    await page.reload();
    await waitForHomePage(page);
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    const tracking = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item._goal.tracking;
    });
    expect(tracking.type).toBe('monthly');
    expect(tracking.target).toBe(5);
  });

  test('app shell renders after reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);
    await page.reload();
    await waitForHomePage(page);
    await expect(page.locator('app-router')).toBeAttached();
  });

  test('year navigation shows independent goals per year', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    const prevYear = currentYear - 1;
    await page.goto(`/${prevYear}`);
    await waitForHomePage(page);

    const yearDisplayed = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#year')?.textContent
    );
    expect(yearDisplayed).toBe(String(prevYear));
  });

  // Guards the pre-boot bottom-nav timing fix: the nav pill mounts (and
  // subscribes) before boot() loads state, so its urgency roll-up must be
  // refreshed after boot — which must also hold on a cold reload from IDB.
  test('nav-pill urgency roll-up appears after a cold reload from persisted data', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    // Seed a list holding one overdue open item, then reload so the app boots
    // from persisted state rather than a live setState.
    await page.evaluate(async () => {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      const overdue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const lists = [{ id: 'l1', name: 'Groceries', items: [
        { id: 'i1', title: 'Milk', status: 'open', tags: [], inGoals: [], dueDate: overdue },
      ] }];
      await new Promise((res, rej) => {
        const r = indexedDB.open('telos', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('state', 'readwrite');
          const os = tx.objectStore('state');
          const g = os.get('root');
          g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}), lists } });
          tx.oncomplete = () => { db.close(); res(); };
          tx.onerror = () => { db.close(); rej(tx.error); };
        };
        r.onerror = () => rej(r.error);
      });
    });

    await page.reload();
    await waitForHomePage(page);

    const handle = await page.waitForFunction(() => {
      const dot = document.querySelector('bottom-nav')?.shadowRoot?.querySelector('#lists-dot');
      return dot && !dot.hidden ? { urgency: dot.dataset.urgency, count: dot.dataset.count } : null;
    });
    const val = await handle.jsonValue();
    expect(val.urgency).toBe('overdue');
    expect(val.count).toBe('1');
  });

  // Guards the new archived field's round-trip through the real IDB boot path
  // (unit tests use fake-indexeddb; this exercises the genuine browser store).
  test('archiving a list persists across a cold reload from IDB', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
    );
    await waitForListsPage(page);

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#add-row').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('list-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector('#input');
      inp.value = 'Persist archive test';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector('#close').click();
    });
    await page.waitForFunction(() =>
      (document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) >= 1
    );

    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container lists-page-item');
      const row = item.shadowRoot.querySelector('.row');
      row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    });
    await waitForListDetailPage(page);

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#menu-btn').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('#menu')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#archive-archived-btn').click();
    });
    // Navigate back to the Lists overview so the reload below lands on that
    // route (page.reload() reloads whatever URL we're currently on).
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#back-btn').click();
    });
    await waitForListsPage(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForListsPage(page);

    const archived = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container lists-page-item');
      return item?._list?.archived ?? null;
    });
    expect(archived).toBe(true);

    // Hidden by default on the overview after the cold reload, same as a live session.
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container lists-page-item')?.hidden
    );
    expect(hidden).toBe(true);
  });
});
