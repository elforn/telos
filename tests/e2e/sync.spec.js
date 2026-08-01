import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { waitForPage, waitForListsPage, openSettings, clickInBottomNav } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Year-header helpers ────────────────────────────────────────────────────────

async function openYearMenu(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#menu-btn').click();
  });
}

// ── Bottom-nav import helpers ─────────────────────────────────────────────────

async function injectImportFile(page, content) {
  if (Buffer.isBuffer(content)) {
    await page.evaluate((bytes) => {
      const file  = new File([new Uint8Array(bytes)], 'data.telos', { type: 'application/octet-stream' });
      const dt    = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('bottom-nav').shadowRoot.querySelector('#import-input');
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, Array.from(content));
  } else {
    const json = typeof content === 'string' ? content : JSON.stringify(content);
    await page.evaluate((j) => {
      const file  = new File([j], 'export.json', { type: 'application/json' });
      const dt    = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('bottom-nav').shadowRoot.querySelector('#import-input');
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, json);
  }
}

async function waitForImportModal(page) {
  await page.waitForFunction(() =>
    document.querySelector('bottom-nav')?.shadowRoot
      ?.querySelector('#import-modal')?.shadowRoot?.querySelector('dialog')?.open
  );
}

async function importModalState(page) {
  return page.evaluate(() => {
    const bn     = document.querySelector('bottom-nav').shadowRoot;
    const dialog = bn.querySelector('#import-modal').shadowRoot.querySelector('dialog');
    return {
      open:           dialog.open,
      message:        bn.querySelector('#import-message').textContent,
      cancelHidden:   bn.querySelector('#import-cancel').hidden,
      mergeHidden:    bn.querySelector('#import-merge').hidden,
      replaceHidden:  bn.querySelector('#import-replace').hidden,
      closeHidden:    bn.querySelector('#import-close').hidden,
    };
  });
}

// ── Goal helpers ──────────────────────────────────────────────────────────────

async function createGoal(page, title) {
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
      .querySelector('#close').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list')?.querySelectorAll('goal-item').length ?? 0) > 0
  );
}

async function goalCount(page) {
  return page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#capstone-list')?.querySelectorAll('goal-item').length ?? 0
  );
}

// ── List helpers ──────────────────────────────────────────────────────────────

async function navToLists(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
  );
  await waitForListsPage(page);
}

async function createList(page, name) {
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
  await page.evaluate((n) => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#input');
    inp.value = n;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#close').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) > 0
  );
}

async function listCount(page) {
  return page.evaluate(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('lists-page')?.shadowRoot
      ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0
  );
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sync — settings items', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openSettings(page);
  });

  test('Export all years button is present in settings', async ({ page }) => {
    const present = await page.evaluate(() =>
      !!document.querySelector('bottom-nav').shadowRoot.querySelector('#export-all-btn')
    );
    expect(present).toBe(true);
  });

  test('Import button is present in settings', async ({ page }) => {
    const present = await page.evaluate(() =>
      !!document.querySelector('bottom-nav').shadowRoot.querySelector('#import-btn')
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

  test('Export all years triggers a file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^\d{12}_telos-all\.telos$/);
  });

  test('exported file starts with ZIP local-file-header magic bytes', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
      })(),
    ]);
    const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
    await download.saveAs(tmpPath);
    const bytes = fs.readFileSync(tmpPath);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
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
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, Buffer.from([0x53, 0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, 0x00]));
    await waitForImportModal(page);
    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.cancelHidden).toBe(true);
    expect(state.mergeHidden).toBe(true);
    expect(state.replaceHidden).toBe(true);
    expect(state.closeHidden).toBe(false);
  });

  test('importing invalid JSON shows error dialog', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, 'this is not json {{');
    await waitForImportModal(page);
    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.cancelHidden).toBe(true);
    expect(state.mergeHidden).toBe(true);
    expect(state.replaceHidden).toBe(true);
    expect(state.closeHidden).toBe(false);
  });

  test('importing wrong socleVersion shows error dialog', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, { socleVersion: 99, events: [], images: [] });
    await waitForImportModal(page);
    const state = await importModalState(page);
    expect(state.cancelHidden).toBe(true);
    expect(state.mergeHidden).toBe(true);
    expect(state.replaceHidden).toBe(true);
    expect(state.closeHidden).toBe(false);
  });

  test('importing valid legacy JSON shows preview dialog with merge and replace buttons', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    const payload = {
      socleVersion: 1,
      events: [
        { id: 'imported-1', deviceId: null, recordedAt: 1000, occurredAt: 1000,
          type: 'simple:state', payload: { goals: {}, lists: [], images: {} } },
      ],
      images: [],
    };
    await injectImportFile(page, payload);
    await waitForImportModal(page);
    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.cancelHidden).toBe(false);
    expect(state.mergeHidden).toBe(false);
    expect(state.replaceHidden).toBe(false);
    expect(state.closeHidden).toBe(true);
  });

  test('cancel button closes the modal without writing any data', async ({ page }) => {
    await createGoal(page, 'Existing goal');
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    const payload = {
      socleVersion: 1,
      events: [
        { id: 'cancel-1', deviceId: null, recordedAt: 1000, occurredAt: 1000,
          type: 'simple:state', payload: { goals: {}, lists: [], images: {} } },
      ],
      images: [],
    };
    await injectImportFile(page, payload);
    await waitForImportModal(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-cancel').click()
    );
    await page.waitForFunction(() =>
      !document.querySelector('bottom-nav')?.shadowRoot
        ?.querySelector('#import-modal')?.shadowRoot?.querySelector('dialog')?.open
    );
    expect(await goalCount(page)).toBe(1);
  });

  test('replace all button shows a Sure? confirmation before executing', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    const payload = {
      socleVersion: 1,
      events: [
        { id: 'sure-1', deviceId: null, recordedAt: 1000, occurredAt: 1000,
          type: 'simple:state', payload: { goals: {}, lists: [], images: {} } },
      ],
      images: [],
    };
    await injectImportFile(page, payload);
    await waitForImportModal(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
    );
    const label = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').textContent.trim()
    );
    expect(label).toBe('Sure?');
    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.cancelHidden).toBe(false);
    expect(state.mergeHidden).toBe(false);
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
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
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

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, exportedBytes);
    await waitForImportModal(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
    );
    await waitForPage(page);

    expect(await goalCount(page)).toBe(1);
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        ?.querySelector('home-page').shadowRoot
        ?.querySelector('#capstone-list goal-item')?.shadowRoot
        ?.querySelector('.title')?.textContent?.trim()
    );
    expect(title).toBe('Round-trip goal');
  });

  test('export then import restores lists after IDB clear', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await navToLists(page);
    await createList(page, 'Gift ideas');
    expect(await listCount(page)).toBe(1);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
      })(),
    ]);
    const tmpPath = path.join(os.tmpdir(), download.suggestedFilename());
    await download.saveAs(tmpPath);
    const exportedBytes = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    await clearIDB(page);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForListsPage(page);
    expect(await listCount(page)).toBe(0);

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, exportedBytes);
    await waitForImportModal(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
    );
    await waitForListsPage(page);
    expect(await listCount(page)).toBe(1);

    const listName = await page.evaluate(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot
        ?.querySelector('lists-page-item')?.shadowRoot
        ?.querySelector('.list-name')?.textContent
    );
    expect(listName).toBe('Gift ideas');
  });

  test('export then import via Replace all restores goals after IDB clear', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await createGoal(page, 'Replace trip goal');
    expect(await goalCount(page)).toBe(1);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
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

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, exportedBytes);
    await waitForImportModal(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
    );
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
    );
    await waitForPage(page);

    expect(await goalCount(page)).toBe(1);
    const title = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        ?.querySelector('home-page').shadowRoot
        ?.querySelector('#capstone-list goal-item')?.shadowRoot
        ?.querySelector('.title')?.textContent?.trim()
    );
    expect(title).toBe('Replace trip goal');
  });

  test('dismissing import modal via Escape resets the replace button label', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    const payload = {
      socleVersion: 1,
      events: [
        { id: 'escape-1', deviceId: null, recordedAt: 1000, occurredAt: 1000,
          type: 'simple:state', payload: { goals: {}, lists: [], images: {} } },
      ],
      images: [],
    };

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, payload);
    await waitForImportModal(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
    );
    const sureLabel = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').textContent.trim()
    );
    expect(sureLabel).toBe('Sure?');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() =>
      !document.querySelector('bottom-nav')?.shadowRoot
        ?.querySelector('#import-modal')?.shadowRoot?.querySelector('dialog')?.open
    );

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, payload);
    await waitForImportModal(page);

    const resetLabel = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').textContent.trim()
    );
    expect(resetLabel).toBe('Replace all');
  });
});

test.describe('Sync — slice handoff', () => {
  test('picking a shared list file via Import adds it, hides Replace, and preserves existing lists', async ({ page }) => {
    // Exercises the manual file-picker arrival path (Settings → Import → choose file) —
    // distinct from the "Sync — share target" test below, which exercises the
    // share-target POST arrival path. Both use the real plain-text handoff format
    // (shareHandoff() in app/utils/handoff.js never produces ZIP — see CLAUDE.md's
    // Sharing section for why).
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    await navToLists(page);
    await createList(page, 'My own list');
    expect(await listCount(page)).toBe(1);

    const sliceFile = {
      socleVersion: 1,
      exportedAt: new Date().toISOString(),
      events: [{
        type: 'simple:state',
        payload: {
          __telosHandoff: true,
          kind: 'list',
          lists: [{ id: 'shared-1', name: 'Shared list', items: [
            { id: 'shared-item-1', title: 'Shared item', status: 'open', tags: [], inGoals: [] },
          ] }],
        },
      }],
    };

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, sliceFile);
    await waitForImportModal(page);

    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.mergeHidden).toBe(false);
    expect(state.replaceHidden).toBe(true); // never offer Replace for a slice — it would wipe "My own list"

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
    );
    await waitForListsPage(page);

    expect(await listCount(page)).toBe(2);
    const names = await page.evaluate(() =>
      [...document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelectorAll('lists-page-item')]
        .map(el => el.shadowRoot.querySelector('.list-name')?.textContent)
    );
    expect(names).toContain('My own list');
    expect(names).toContain('Shared list');
  });
});

test.describe('Sync — share target', () => {
  test('POSTing a shared .txt handoff file lands as a pending import on next load', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    const payload = {
      __telosHandoff: true,
      kind: 'list',
      lists: [{ id: 'shared-target-1', name: 'Shared via target', items: [] }],
    };
    const json = JSON.stringify({
      socleVersion: 1,
      exportedAt: new Date().toISOString(),
      events: [{ type: 'simple:state', payload }],
    });

    // Posting via an in-page fetch (not Playwright's own request API) so the
    // request actually goes through the registered service worker's fetch
    // handler — that's what intercepts /share-target and stores the pending
    // share, exactly as a real "Share..." from another app would.
    await page.evaluate(async text => {
      const fd = new FormData();
      fd.append('files', new File([text], 'shared.txt', { type: 'text/plain' }));
      await fetch('/share-target', { method: 'POST', body: fd });
    }, json);

    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await waitForImportModal(page);

    const state = await importModalState(page);
    expect(state.open).toBe(true);
    expect(state.mergeHidden).toBe(false);
    expect(state.replaceHidden).toBe(true); // list-kind handoff hides Replace

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
    );
    await waitForPage(page);

    // Reloading again must not re-apply the same share — readShareInbox() consumes it once.
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    const reopened = await page.evaluate(() =>
      document.querySelector('bottom-nav')?.shadowRoot
        ?.querySelector('#import-modal')?.shadowRoot?.querySelector('dialog')?.open ?? false
    );
    expect(reopened).toBe(false);
  });
});
