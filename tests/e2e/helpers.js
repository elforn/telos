export async function waitForPage(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
  );
}

export async function waitForListsPage(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('lists-page')
  );
}

export async function waitForListDetailPage(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('list-detail-page')
  );
}

export async function waitForIDBFlush(page) {
  await page.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('telos', 1);
    r.onsuccess = () => {
      const tx = r.result.transaction(['state', 'images'], 'readonly');
      tx.objectStore('state').get('root');
      tx.objectStore('images').get('root');
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror   = () => { r.result.close(); rej(tx.error); };
    };
    r.onerror = () => rej(r.error);
  }));
}

export async function openSettings(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#gear-btn').click()
  );
  await page.waitForFunction(() =>
    document.querySelector('bottom-nav')?.shadowRoot
      ?.querySelector('#settings-modal')?.shadowRoot?.querySelector('dialog')?.open
  );
}

export async function clickInBottomNav(page, selector) {
  await page.evaluate((sel) =>
    document.querySelector('bottom-nav').shadowRoot.querySelector(sel).click()
  , selector);
}

// Days from 1 January of the current year through today, inclusive — the
// span Fix-a-day's chip strip covers for every tracking type now that it is
// year-bounded rather than a per-type trailing window.
export function daysSoFarThisYear() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - jan1) / 86400000) + 1;
}
