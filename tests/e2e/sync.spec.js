import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { waitForPage } from './helpers.js';

const currentYear = new Date().getFullYear();

async function clickInYearHeader(page, selector) {
  await page.evaluate((sel) => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

async function openMenu(page) {
  await clickInYearHeader(page, '#menu-btn');
}

async function createGoal(page, title) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#capstone-edit-btn').click();
  });
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
  await page.evaluate((t) => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#save').click();
  });
  await page.waitForFunction(() => {
    const list = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list');
    return list?.querySelectorAll('goal-item').length > 0;
  });
}

async function goalCount(page) {
  return page.evaluate(() => {
    const list = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list');
    return list?.querySelectorAll('goal-item').length ?? 0;
  });
}

async function injectImportFile(page, content) {
  if (Buffer.isBuffer(content)) {
    await page.evaluate((bytes) => {
      const file = new File([new Uint8Array(bytes)], 'data.telos', { type: 'application/octet-stream' });
      const dt   = new DataTransfer();
      dt.items.add(file);
      const yh    = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      const input = yh.shadowRoot.querySelector('#import-input');
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, Array.from(content));
  } else {
    const json = typeof content === 'string' ? content : JSON.stringify(content);
    await page.evaluate((json) => {
      const file = new File([json], 'export.json', { type: 'application/json' });
      const dt   = new DataTransfer();
      dt.items.add(file);
      const yh    = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      const input = yh.shadowRoot.querySelector('#import-input');
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, json);
  }
}

async function confirmDialogState(page) {
  return page.evaluate(() => {
    const yh = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header');
    const dialog = yh.shadowRoot.querySelector('#import-confirm');
    return {
      open:           dialog.open,
      message:        yh.shadowRoot.querySelector('#import-message').textContent,
      successHidden:  yh.shadowRoot.querySelector('#import-success-actions').hidden,
      errorHidden:    yh.shadowRoot.querySelector('#import-error-actions').hidden,
    };
  });
}

async function clearIDB(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('telos');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['state', 'images'], 'readwrite');
      tx.objectStore('state').clear();
      tx.objectStore('images').clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror    = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }));
}

test.describe('Sync — menu items', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openMenu(page);
  });

  test('Export this year menu item is present', async ({ page }) => {
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-year-btn').textContent.trim()
    );
    expect(text).toContain(String(currentYear));
  });

  test('Export all years menu item is present', async ({ page }) => {
    const present = await page.evaluate(() =>
      !!document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-all-btn')
    );
    expect(present).toBe(true);
  });

  test('Import menu item is present', async ({ page }) => {
    const present = await page.evaluate(() =>
      !!document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#import-btn')
    );
    expect(present).toBe(true);
  });
});

test.describe('Sync — export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('Export this year triggers a file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openMenu(page);
        await clickInYearHeader(page, '#export-year-btn');
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^\d{12}_telos-\d{4}\.telos$/);
  });

  test('Export all years triggers a file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openMenu(page);
        await clickInYearHeader(page, '#export-all-btn');
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^\d{12}_telos-all\.telos$/);
  });

  test('exported file starts with SCLE magic bytes', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openMenu(page);
        await clickInYearHeader(page, '#export-all-btn');
      })(),
    ]);
    const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
    await download.saveAs(tmpPath);
    const bytes = fs.readFileSync(tmpPath);
    expect(bytes[0]).toBe(0x53); // S
    expect(bytes[1]).toBe(0x43); // C
    expect(bytes[2]).toBe(0x4c); // L
    expect(bytes[3]).toBe(0x45); // E
    expect(bytes[4]).toBe(0x1f); // gzip magic
    expect(bytes[5]).toBe(0x8b);
    fs.unlinkSync(tmpPath);
  });
});

test.describe('Sync — import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('importing a corrupted binary file shows error dialog', async ({ page }) => {
    await openMenu(page);
    await clickInYearHeader(page, '#import-btn');
    // SCLE magic so readImportFile passes it as Uint8Array, but gzip payload is garbage.
    await injectImportFile(page, Buffer.from([0x53, 0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, 0x00]));
    await page.waitForFunction(() => {
      const yh = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      return yh.shadowRoot.querySelector('#import-confirm').open;
    });
    const state = await confirmDialogState(page);
    expect(state.open).toBe(true);
    expect(state.errorHidden).toBe(false);
    expect(state.successHidden).toBe(true);
  });

  test('importing invalid JSON shows error dialog', async ({ page }) => {
    await openMenu(page);
    await clickInYearHeader(page, '#import-btn');
    await injectImportFile(page, 'this is not json {{');
    await page.waitForFunction(() => {
      const yh = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      return yh.shadowRoot.querySelector('#import-confirm').open;
    });
    const state = await confirmDialogState(page);
    expect(state.open).toBe(true);
    expect(state.errorHidden).toBe(false);
    expect(state.successHidden).toBe(true);
  });

  test('importing wrong socleVersion shows error dialog', async ({ page }) => {
    await openMenu(page);
    await clickInYearHeader(page, '#import-btn');
    await injectImportFile(page, { socleVersion: 99, events: [], images: [] });
    await page.waitForFunction(() => {
      const yh = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      return yh.shadowRoot.querySelector('#import-confirm').open;
    });
    const state = await confirmDialogState(page);
    expect(state.errorHidden).toBe(false);
  });

  test('importing valid legacy JSON shows success dialog', async ({ page }) => {
    await openMenu(page);
    await clickInYearHeader(page, '#import-btn');
    const payload = {
      socleVersion: 1,
      events: [
        { id: 'imported-1', deviceId: null, recordedAt: 1000, occurredAt: 1000,
          type: 'simple:state', payload: { goals: {}, images: {} } },
      ],
      images: [],
    };
    await injectImportFile(page, payload);
    await page.waitForFunction(() => {
      const yh = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      return yh.shadowRoot.querySelector('#import-confirm').open;
    });
    const state = await confirmDialogState(page);
    expect(state.open).toBe(true);
    expect(state.successHidden).toBe(false);
    expect(state.errorHidden).toBe(true);
  });
});

test.describe('Sync — round-trip', () => {
  test('export then import restores goals after IDB clear', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await createGoal(page, 'Round-trip goal');
    expect(await goalCount(page)).toBe(1);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openMenu(page);
        await clickInYearHeader(page, '#export-all-btn');
      })(),
    ]);
    const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
    await download.saveAs(tmpPath);
    const exportedBytes = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    await clearIDB(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    expect(await goalCount(page)).toBe(0);

    await openMenu(page);
    await clickInYearHeader(page, '#import-btn');
    await injectImportFile(page, exportedBytes);
    await page.waitForFunction(() => {
      const yh = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header');
      return yh.shadowRoot.querySelector('#import-confirm').open;
    });

    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#import-reload').click();
    });
    await navigationPromise;
    await waitForPage(page);

    expect(await goalCount(page)).toBe(1);
    const title = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?.shadowRoot?.querySelector('.title')?.textContent?.trim();
    });
    expect(title).toBe('Round-trip goal');
  });
});
