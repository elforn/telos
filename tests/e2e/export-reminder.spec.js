import { test, expect } from '@playwright/test';
import { waitForPage, openSettings, clickInBottomNav } from './helpers.js';

const currentYear = new Date().getFullYear();

async function injectImportFile(page, content) {
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

async function waitForImportModal(page) {
  await page.waitForFunction(() =>
    document.querySelector('bottom-nav')?.shadowRoot
      ?.querySelector('#import-modal')?.shadowRoot?.querySelector('dialog')?.open
  );
}

const emptyPayload = {
  socleVersion: 1,
  events: [
    { id: 'reminder-test', deviceId: null, recordedAt: 1000, occurredAt: 1000,
      type: 'simple:state', payload: { goals: {}, lists: [], images: {} } },
  ],
  images: [],
};

test.describe('Export reminder — badge visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await page.evaluate(() => {
      localStorage.removeItem('telos:lastExportedAt');
      localStorage.removeItem('telos:exportReminderEnabled');
      document.querySelector('bottom-nav')._updateGearBadge();
    });
  });

  test('gear badge is visible when no export has been made', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#gear-badge').hidden
    );
    expect(hidden).toBe(false);
  });

  test('export badge in settings is visible when no export has been made', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#export-badge').hidden
    );
    expect(hidden).toBe(false);
  });

  test('gear badge is hidden after exporting', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await openSettings(page);
        await clickInBottomNav(page, '#export-all-btn');
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.telos$/);

    const hidden = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#gear-badge').hidden
    );
    expect(hidden).toBe(true);
  });

  test('gear badge is visible when last export was more than 30 days ago', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('telos:lastExportedAt', String(Date.now() - 31 * 24 * 60 * 60 * 1000));
      document.querySelector('bottom-nav')._updateGearBadge();
    });
    const hidden = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#gear-badge').hidden
    );
    expect(hidden).toBe(false);
  });

  test('gear badge is hidden after clicking the Hide pill in settings', async ({ page }) => {
    await openSettings(page);
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('[data-reminder="off"]').click()
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#gear-badge').hidden
    );
    expect(hidden).toBe(true);
  });
});

test.describe('Export reminder — auto-backup before import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('merging an import file triggers an auto-backup download first', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, emptyPayload);
    await waitForImportModal(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() =>
        document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
      ),
    ]);

    expect(download.suggestedFilename()).toMatch(/^telos-backup-before-import-\d{12}\.telos$/);
  });

  test('replacing all data triggers an auto-backup download first', async ({ page }) => {
    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, emptyPayload);
    await waitForImportModal(page);

    // first click shows "Sure?" confirmation
    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
    );

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() =>
        document.querySelector('bottom-nav').shadowRoot.querySelector('#import-replace').click()
      ),
    ]);

    expect(download.suggestedFilename()).toMatch(/^telos-backup-before-import-\d{12}\.telos$/);
  });

  test('auto-backup before merge marks the last-exported timestamp', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('telos:lastExportedAt'));

    await openSettings(page);
    await clickInBottomNav(page, '#import-btn');
    await injectImportFile(page, emptyPayload);
    await waitForImportModal(page);

    await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() =>
        document.querySelector('bottom-nav').shadowRoot.querySelector('#import-merge').click()
      ),
    ]);

    const stored = await page.evaluate(() => localStorage.getItem('telos:lastExportedAt'));
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThan(0);
  });
});
