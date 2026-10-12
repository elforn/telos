import { test, expect } from '@playwright/test';

test.describe('Offline behaviour', () => {
  test('app loads from cache when offline after first visit', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // Wait for full app init — ensures all module files are fetched and cached by the SW
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await context.setOffline(true);
    await page.reload();

    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );
    await expect(page.locator('app-router')).toBeAttached();
  });

  test('goals written online are readable after going offline and reloading', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    // Create a goal while online
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
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot.querySelector('input');
      inp.value = 'Offline goal';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot.querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length > 0;
    });

    // Go offline and reload — goal must survive
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Offline goal');
  });

  test('self-hosted Onest font loads offline (no fallback to system font)', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    const onestAvailable = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px Onest');
    });
    expect(onestAvailable).toBe(true);
  });

  // A group's percentage is a number already in IDB — reading it needs no
  // network at all, and the reconciler that maintains it runs entirely
  // locally. This confirms the whole chain (boot -> reconcile -> render -> a
  // local write) works with the network cut.
  test('a group reconciles and renders with the network cut', async ({ page, context }) => {
    const year = new Date().getFullYear();
    await page.goto(`/${year}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await context.setOffline(true);

    // Seed with no aggValue, so the boot pass has to compute it offline.
    await page.evaluate(async y => {
      const Y = String(y);
      await new Promise((res, rej) => {
        const r = indexedDB.open('telos', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('state', 'readwrite');
          const os = tx.objectStore('state');
          const g = os.get('root');
          g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}), goals: {
            [Y]: {
              capstone: [{ id: 'grp', title: 'Offline group', tags: [], tracking: {
                type: 'aggregate', members: [{ year: Y, section: 'focus', goalId: 'f1' }],
              } }],
              milestones: [], wow: [],
              focus: [{ id: 'f1', title: 'Member', tags: [], tracking: { type: 'percentage', value: 45 } }],
            },
          } } });
          tx.oncomplete = () => { db.close(); res(); };
          tx.onerror = () => { db.close(); rej(tx.error); };
        };
        r.onerror = () => rej(r.error);
      });
    }, year);

    // Reload from cache alone.
    await page.reload();
    await page.waitForFunction(() =>
      !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
    );

    await page.waitForFunction(() => {
      const row = [...document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')]
        .find(el => el._goal?.id === 'grp');
      return row?._goal?.tracking?.aggValue === 45;
    });

    const rendered = await page.evaluate(() => {
      const row = [...document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelectorAll('goal-item')]
        .find(el => el._goal?.id === 'grp');
      return {
        fill: row.shadowRoot.querySelector('.fill').style.width,
        label: row.shadowRoot.querySelector('.pct-label').textContent,
      };
    });
    expect(rendered.fill).toBe('45%');
    expect(rendered.label).toBe('1 goal');
  });
});
