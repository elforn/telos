import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage } from './helpers.js';

const currentYear = new Date().getFullYear();

// COLOR_PALETTE from lists-page-item: [null, '#E5534B', '#E07633', '#D4A928', '#3DAD6A', '#29A8A1', '#4A94D4', '#8B67D6']
const RED  = '#E5534B';
const BLUE = '#4A94D4';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function navToLists(page) {
  await page.evaluate(() =>
    document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click()
  );
  await waitForListsPage(page);
}

async function openNewListDialog(page) {
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
}

async function fillListName(page, name) {
  await page.evaluate(n => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('#input');
    inp.value = n;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
}

async function clickColorSwatch(page, color) {
  await page.evaluate(c => {
    const wrap = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('list-dialog').shadowRoot
      .querySelector('.color-swatches');
    const swatch = wrap.querySelector(`[data-color="${c}"]`);
    swatch?.click();
  }, color);
}

async function saveListDialog(page) {
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
}

function firstListColor(page) {
  return page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container lists-page-item');
    return item?._list?.color ?? null;
  });
}

// ── List color — creation ─────────────────────────────────────────────────────

test.describe('List color — creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
  });

  test('selecting a color swatch saves the color on the list', async ({ page }) => {
    await openNewListDialog(page);
    await clickColorSwatch(page, RED);
    await fillListName(page, 'Coloured list');
    await saveListDialog(page);

    const color = await firstListColor(page);
    expect(color).toBe(RED);
  });

  test('selecting the No colour swatch saves null', async ({ page }) => {
    await openNewListDialog(page);
    // First pick a real colour, then switch back to none
    await clickColorSwatch(page, RED);
    await clickColorSwatch(page, '');  // data-color="" is the null/no-colour swatch
    await fillListName(page, 'No colour list');
    await saveListDialog(page);

    const color = await firstListColor(page);
    expect(color).toBeNull();
  });

  test('selected swatch has aria-pressed="true"', async ({ page }) => {
    await openNewListDialog(page);
    await clickColorSwatch(page, BLUE);

    const pressed = await page.evaluate(c => {
      const swatch = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector(`[data-color="${c}"]`);
      return swatch?.getAttribute('aria-pressed');
    }, BLUE);
    expect(pressed).toBe('true');
  });

  test('deselected swatches have aria-pressed="false"', async ({ page }) => {
    await openNewListDialog(page);
    await clickColorSwatch(page, RED);
    await clickColorSwatch(page, BLUE);

    const redPressed = await page.evaluate(c => {
      const swatch = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector(`[data-color="${c}"]`);
      return swatch?.getAttribute('aria-pressed');
    }, RED);
    expect(redPressed).toBe('false');
  });
});

// ── List color — editing ──────────────────────────────────────────────────────

test.describe('List color — editing', () => {
  test('dialog pre-selects the saved color when editing via the name-edit button', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);

    // Create a list with a colour
    await openNewListDialog(page);
    await clickColorSwatch(page, RED);
    await fillListName(page, 'Red list');
    await saveListDialog(page);

    // Navigate into the list detail page
    await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('lists-page').shadowRoot
        .querySelector('#list-container lists-page-item');
      const row = item.shadowRoot.querySelector('.row');
      row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    });
    await waitForListDetailPage(page);

    // Click the name-edit button (pencil icon) to open list-dialog in edit mode
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('#name-edit-btn').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot
        ?.querySelector('list-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });

    // The RED swatch should be pre-selected
    const pressed = await page.evaluate(c => {
      const swatch = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('list-dialog').shadowRoot
        .querySelector(`[data-color="${c}"]`);
      return swatch?.getAttribute('aria-pressed');
    }, RED);
    expect(pressed).toBe('true');
  });
});
