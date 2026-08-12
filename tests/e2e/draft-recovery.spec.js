import { test, expect } from '@playwright/test';
import { waitForPage, waitForListsPage, waitForListDetailPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// A stale draft (captured on a prior background/kill while the dialog was open,
// mid-edit) must never silently overwrite an already-committed record on the next
// open — it's only ever applied via an explicit tap on the draft-toggle button.
// See app/utils/dialog-snapshot.js and app/utils/draft-toggle.js.

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
  await page.evaluate(n => {
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
      ?.querySelector('#list-container')?.querySelectorAll('lists-page-item').length ?? 0) >= 1
  );
}

async function navToFirstList(page) {
  await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('lists-page').shadowRoot
      .querySelector('#list-container')
      .querySelector('lists-page-item');
    const row = item.shadowRoot.querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await waitForListDetailPage(page);
}

async function openNewItemDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#add-row').click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function fillTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#title-input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
}

async function fillNote(page, note) {
  await page.evaluate(n => {
    const ta = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#note-input');
    ta.value = n;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, note);
}

async function saveItemDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('item-dialog').shadowRoot
      .querySelector('#close').click();
  });
  await page.waitForFunction(() =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('#item-list')?.querySelectorAll('list-item').length ?? 0) >= 1
  );
}

async function openExistingItemDialog(page) {
  await page.evaluate(() => {
    const item = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    const row = item.shadowRoot.querySelector('.row');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
    row.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, composed: true, pointerId: 1, button: 0 }));
  });
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('list-detail-page')?.shadowRoot
      ?.querySelector('item-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

function itemField(page, field) {
  return page.evaluate(f => {
    const el = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return el?._item?.[f];
  }, field);
}

function itemId(page) {
  return page.evaluate(() => {
    const el = document.querySelector('app-router').shadowRoot
      .querySelector('list-detail-page').shadowRoot
      .querySelector('#item-list list-item');
    return el?._item?.id;
  });
}

// Simulates the app being backgrounded/killed mid-edit with the note/url
// accidentally cleared: writes a stale draft straight into localStorage, keyed
// to the item's real id, bypassing the UI (the dialog itself clears this key on
// a normal close, so it can only be produced this way in a test).
async function seedStaleDraft(page, id, draft) {
  await page.evaluate(({ id, draft }) => {
    localStorage.setItem(`telos:snapshot.new-item:${id}`, JSON.stringify(draft));
  }, { id, draft });
}

test.describe('Item dialog — draft recovery does not clobber saved fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await navToLists(page);
    await createList(page, 'Draft recovery test list');
    await navToFirstList(page);
    await openNewItemDialog(page);
    await fillTitle(page, 'Deactivate SFR Navigation');
    await fillNote(page, 'http://c.sfr.fr/conseiller_technique_RED');
    await saveItemDialog(page);
    await waitForIDBFlush(page);
  });

  test('reopening with a stale pending draft shows the real stored note, not the draft', async ({ page }) => {
    const id = await itemId(page);
    await seedStaleDraft(page, id, { title: 'Deactivate SFR Navigation', note: '', url: '', tags: [] });

    // Reload — the draft lives in localStorage and must survive independently of the SPA's in-memory state.
    // The URL is already /lists/:listId (real route), so reload lands straight back on list-detail-page.
    await page.reload();
    await waitForListDetailPage(page);
    await openExistingItemDialog(page);

    const noteVal = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#note-input').value
    );
    expect(noteVal).toBe('http://c.sfr.fr/conseiller_technique_RED');

    const btn = await page.evaluate(() => {
      const b = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#draft-toggle-btn');
      return { hidden: b.hidden, text: b.textContent.trim(), pending: b.classList.contains('has-pending-draft') };
    });
    expect(btn.hidden).toBe(false);
    expect(btn.text).toBe('Restore draft');
    expect(btn.pending).toBe(true);
  });

  test('the draft-toggle button previews the draft and reverts back — same button, both directions', async ({ page }) => {
    const id = await itemId(page);
    await seedStaleDraft(page, id, { title: 'Deactivate SFR Navigation', note: '', url: '', tags: [] });

    await page.reload();
    await waitForListDetailPage(page);
    await openExistingItemDialog(page);

    const readNote = () => page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#note-input').value
    );
    const readBtnText = () => page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#draft-toggle-btn').textContent.trim()
    );
    const clickToggle = () => page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#draft-toggle-btn').click()
    );

    expect(await readNote()).toBe('http://c.sfr.fr/conseiller_technique_RED');
    expect(await readBtnText()).toBe('Restore draft');

    await clickToggle(); // preview the draft
    expect(await readNote()).toBe('');
    expect(await readBtnText()).toBe('Revert');

    await clickToggle(); // back to the stored value
    expect(await readNote()).toBe('http://c.sfr.fr/conseiller_technique_RED');
    expect(await readBtnText()).toBe('Restore draft');
  });

  test('bumping an unrelated field (due date) and closing — without ever tapping the draft button — leaves note/url intact', async ({ page }) => {
    // This is the exact original bug scenario: a stale draft is pending, the user
    // only means to reschedule the due date, and never interacts with the
    // draft-toggle button at all.
    const id = await itemId(page);
    await seedStaleDraft(page, id, { title: 'Deactivate SFR Navigation', note: '', url: '', dueDate: '2026-08-11', tags: [] });

    await page.reload();
    await waitForListDetailPage(page);
    await openExistingItemDialog(page);

    await page.evaluate(() => {
      const input = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot
        .querySelector('item-dialog').shadowRoot
        .querySelector('#duedate-input');
      input.value = '2026-08-20';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await saveItemDialog(page);
    await waitForIDBFlush(page);

    const note = await itemField(page, 'note');
    const dueDate = await itemField(page, 'dueDate');
    expect(note).toBe('http://c.sfr.fr/conseiller_technique_RED');
    expect(dueDate).toBe('2026-08-20');
  });
});
