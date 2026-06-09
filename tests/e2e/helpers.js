export async function waitForPage(page) {
  await page.waitForFunction(() =>
    !!document.querySelector('app-router')?.shadowRoot?.querySelector('home-page')
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
