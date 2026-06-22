// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/item-dialog/item-dialog.js';

const ITEM = { id: 'i1', title: 'Buy flowers', status: 'paused', note: 'From the corner shop', url: 'https://example.com', tags: [], inGoals: [] };
const ITEM_IN_GOALS = { ...ITEM, inGoals: [{ year: '2026', section: 'milestones', goalId: 'g1' }] };

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return modal;
}

function stubSheet(el) {
  const sheet = el.shadowRoot.querySelector('#action-sheet');
  sheet.showModal = vi.fn(() => sheet.setAttribute('open', ''));
  sheet.close     = vi.fn(() => sheet.removeAttribute('open'));
}

function stubPickerModal(el) {
  const picker = el.shadowRoot.querySelector('#list-picker');
  const modal  = picker.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn();
}

function pickerShadow(el) {
  return el.shadowRoot.querySelector('#list-picker').shadowRoot;
}

function mount() {
  const el = document.createElement('item-dialog');
  document.body.appendChild(el);
  stubModal(el);
  stubSheet(el);
  stubPickerModal(el);
  return el;
}

function openListPicker(el) {
  el.shadowRoot.querySelector('#menu-btn').click();
  el.shadowRoot.querySelector('#action-move-btn').click();
}

function openGoalPromoter(el) {
  el.shadowRoot.querySelector('#menu-btn').click();
  el.shadowRoot.querySelector('#action-promote-btn').click();
}

afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

// ── open() ────────────────────────────────────────────────────────────────────

describe('item-dialog — open', () => {
  it('calls show() on the modal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('pre-fills title input with item title', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#title-input').value).toBe('Buy flowers');
  });

  it('clears title input when opened with no item', () => {
    const el = mount();
    el.open(ITEM);
    el.open(null);
    expect(el.shadowRoot.querySelector('#title-input').value).toBe('');
  });

  it('pre-fills note textarea with item note', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#note-input').value).toBe('From the corner shop');
  });

  it('clears note textarea when opened with no item', () => {
    const el = mount();
    el.open(ITEM);
    el.open(null);
    expect(el.shadowRoot.querySelector('#note-input').value).toBe('');
  });

  it('pre-fills url input with item url', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#url-input').value).toBe('https://example.com');
  });

  it('clears url input when opened with no item', () => {
    const el = mount();
    el.open(ITEM);
    el.open(null);
    expect(el.shadowRoot.querySelector('#url-input').value).toBe('');
  });

  it('url field is hidden by default on new item', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('.url-row').hidden).toBe(true);
  });

  it('url field is shown automatically when item has a url', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('.url-row').hidden).toBe(false);
  });

  it('url-toggle sets aria-expanded to true when url field is shown', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#url-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking url-toggle reveals the url field', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#url-toggle').click();
    expect(el.shadowRoot.querySelector('.url-row').hidden).toBe(false);
  });

  it('url open button is hidden when url is empty', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#url-open').hidden).toBe(true);
  });

  it('url open button is visible when item has a url', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#url-open').hidden).toBe(false);
  });

  it('pre-selects the item status radio', () => {
    const el = mount();
    el.open(ITEM);
    const checked = el.shadowRoot.querySelector('input[name="status"]:checked');
    expect(checked?.value).toBe('paused');
  });

  it('defaults to open status when no item is given', () => {
    const el = mount();
    el.open(null);
    const checked = el.shadowRoot.querySelector('input[name="status"]:checked');
    expect(checked?.value).toBe('open');
  });

  it('shows delete button when opened with an existing item', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(false);
  });

  it('hides delete button when opened with no item', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(true);
  });
});

// ── save ──────────────────────────────────────────────────────────────────────

describe('item-dialog — save', () => {
  it('save button is disabled when title is empty', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(true);
  });

  it('save button enables when title has text', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'New item';
    inp.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(false);
  });

  it('dispatches item-saved with title and status on save click', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'My item';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.title).toBe('My item');
    expect(events[0].detail.status).toBe('open');
  });

  it('includes note in item-saved detail when note is filled', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Item';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#note-input').value = 'A helpful note';
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.note).toBe('A helpful note');
  });

  it('note is undefined in item-saved detail when note is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Item';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.note).toBeUndefined();
  });

  it('includes url in item-saved detail when url is filled', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Item';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#url-input').value = 'https://example.com';
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.url).toBe('https://example.com');
  });

  it('url is undefined in item-saved detail when url is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Item';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.url).toBeUndefined();
  });

  it('dispatches item-saved with the selected status', () => {
    const el = mount();
    el.open({ ...ITEM, status: 'done' });
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.status).toBe('done');
  });

  it('does not dispatch item-saved when title is only whitespace', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = '   ';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(0);
  });

  it('trims whitespace from the saved title', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = '  Flowers  ';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.title).toBe('Flowers');
  });

  it('closes the dialog after saving', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Something';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('dispatches item-saved on Enter key in the title input', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Enter save';
    inp.dispatchEvent(new Event('input'));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.title).toBe('Enter save');
  });

  it('item-saved is bubbles and composed', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Test';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('item-dialog — delete', () => {
  it('dispatches item-delete on first click', () => {
    const el = mount();
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events).toHaveLength(1);
  });

  it('item-delete is bubbles and composed', () => {
    const el = mount();
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('closes the dialog on first click', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(ITEM);
    el.shadowRoot.querySelector('#delete').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── cancel ────────────────────────────────────────────────────────────────────

describe('item-dialog — cancel', () => {
  it('closes the dialog when cancel is clicked', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    el.shadowRoot.querySelector('#cancel').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── draft ─────────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'telos.draft.new-item';

describe('item-dialog — draft', () => {
  it('loads draft title when opening a new item', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'Draft title', note: '', url: '' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#title-input').value).toBe('Draft title');
  });

  it('loads draft note when opening a new item', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'T', note: 'Draft note', url: '' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#note-input').value).toBe('Draft note');
  });

  it('loads draft url and shows the url field', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'T', note: '', url: 'https://draft.com' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#url-input').value).toBe('https://draft.com');
    expect(el.shadowRoot.querySelector('.url-row').hidden).toBe(false);
  });

  it('does not load draft when opening an existing item', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'Draft', note: '', url: '' }));
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#title-input').value).toBe('Buy flowers');
  });

  it('saves draft on title input', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Typing a draft';
    inp.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).title).toBe('Typing a draft');
  });

  it('saves draft on note input', () => {
    const el = mount();
    el.open(null);
    const ta = el.shadowRoot.querySelector('#note-input');
    ta.value = 'Draft note';
    ta.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).note).toBe('Draft note');
  });

  it('saves draft on url input', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#url-input');
    inp.value = 'https://typed.com';
    inp.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).url).toBe('https://typed.com');
  });

  it('does not save draft when editing an existing item', () => {
    const el = mount();
    el.open(ITEM);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Modified';
    inp.dispatchEvent(new Event('input'));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears draft on save', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'Draft', note: '', url: '' }));
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'Saved item';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears draft on cancel', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 'Draft', note: '', url: '' }));
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#cancel').click();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('preserves draft on backdrop close', () => {

    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    const inp = el.shadowRoot.querySelector('#title-input');
    inp.value = 'In progress';
    inp.dispatchEvent(new Event('input'));
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).title).toBe('In progress');
  });
});

// ── Move to list ──────────────────────────────────────────────────────────────

const LIST_A = { id: 'la', name: 'Shopping', color: null };
const LIST_B = { id: 'lb', name: 'Ideas',    color: '#FF0000' };

describe('item-dialog — move to list', () => {
  it('menu-btn is hidden when opened with no item (new item)', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(true);
  });

  it('menu-btn is visible when opened with an existing item', () => {
    const el = mount();
    el.open(ITEM);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
  });

  it('clicking Move to list (via action sheet) opens list-picker-dialog', () => {
    const el = mount();
    el.open(ITEM);
    const pickerModal = pickerShadow(el).querySelector('#modal');
    openListPicker(el);
    expect(pickerModal.show).toHaveBeenCalledOnce();
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(false);
  });

  it('Back button in list-picker closes the picker modal', () => {
    const el = mount();
    el.open(ITEM);
    const pickerModal = pickerShadow(el).querySelector('#modal');
    openListPicker(el);
    pickerShadow(el).querySelector('#back-btn').click();
    expect(pickerModal.close).toHaveBeenCalledOnce();
  });

  it('Move and Copy CTAs are disabled before any list is selected', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    expect(pickerShadow(el).querySelector('#move-btn').disabled).toBe(true);
    expect(pickerShadow(el).querySelector('#copy-btn').disabled).toBe(true);
  });

  it('Move and Copy CTAs are enabled after selecting a list', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    expect(pickerShadow(el).querySelector('#move-btn').disabled).toBe(false);
    expect(pickerShadow(el).querySelector('#copy-btn').disabled).toBe(false);
  });

  it('deselecting all lists disables the CTAs again', () => {
    const el = mount();
    el.availableLists = [LIST_A];
    el.open(ITEM);
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('[data-list-id="la"]').click(); // deselect
    expect(pickerShadow(el).querySelector('#move-btn').disabled).toBe(true);
    expect(pickerShadow(el).querySelector('#copy-btn').disabled).toBe(true);
  });

  it('list rows are rendered from availableLists', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    const rows = pickerShadow(el).querySelectorAll('[data-list-id]');
    expect(rows.length).toBe(2);
  });

  it('no-lists message is shown when availableLists is empty', () => {
    const el = mount();
    el.availableLists = [];
    el.open(ITEM);
    openListPicker(el);
    expect(pickerShadow(el).querySelector('#no-lists-msg').hidden).toBe(false);
  });

  it('selection count row is hidden before any selection', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    expect(pickerShadow(el).querySelector('#count-row').hidden).toBe(true);
  });

  it('selection count row shows count after selecting lists', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('[data-list-id="lb"]').click();
    expect(pickerShadow(el).querySelector('#count-row').hidden).toBe(false);
    expect(pickerShadow(el).querySelector('#count').textContent).toContain('2');
  });

  it('clear button deselects all and hides count row', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('[data-list-id="lb"]').click();
    pickerShadow(el).querySelector('#clear-btn').click();
    expect(pickerShadow(el).querySelector('#count-row').hidden).toBe(true);
    expect(pickerShadow(el).querySelector('#move-btn').disabled).toBe(true);
    expect(pickerShadow(el).querySelector('#copy-btn').disabled).toBe(true);
  });

  it('emits item-move with copy=false and correct targetListIds on Move', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-move', e => events.push(e));
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('#move-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.copy).toBe(false);
    expect(events[0].detail.targetListIds).toEqual(['la']);
  });

  it('emits item-move with copy=true on Copy', () => {
    const el = mount();
    el.availableLists = [LIST_A];
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-move', e => events.push(e));
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('#copy-btn').click();
    expect(events[0].detail.copy).toBe(true);
  });

  it('item-move includes current form values', () => {
    const el = mount();
    el.availableLists = [LIST_A];
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-move', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Updated title';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('#move-btn').click();
    expect(events[0].detail.title).toBe('Updated title');
  });

  it('emits item-move with multiple selected lists', () => {
    const el = mount();
    el.availableLists = [LIST_A, LIST_B];
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-move', e => events.push(e));
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('[data-list-id="lb"]').click();
    pickerShadow(el).querySelector('#move-btn').click();
    expect(events[0].detail.targetListIds.sort()).toEqual(['la', 'lb'].sort());
  });

  it('item-move is bubbles and composed', () => {
    const el = mount();
    el.availableLists = [LIST_A];
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-move', e => events.push(e));
    openListPicker(el);
    pickerShadow(el).querySelector('[data-list-id="la"]').click();
    pickerShadow(el).querySelector('#move-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

// ── Copy note ─────────────────────────────────────────────────────────────────

describe('item-dialog — copy note', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('copy button is present in the shadow DOM', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#note-copy-btn')).not.toBeNull();
  });

  it('does not call clipboard.writeText when note is empty', async () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#note-copy-btn').click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('calls clipboard.writeText with the note text', async () => {
    const el = mount();
    el.open(null);
    const note = el.shadowRoot.querySelector('#note-input');
    note.value = 'Pick up from the corner shop';
    note.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#note-copy-btn').click();
    await vi.waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Pick up from the corner shop')
    );
  });

  it('adds is-copied class after a successful copy', async () => {
    const el = mount();
    el.open(null);
    const note = el.shadowRoot.querySelector('#note-input');
    note.value = 'A note';
    note.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#note-copy-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#note-copy-btn').classList.contains('is-copied')).toBe(true)
    );
  });

  it('also copies when the dialog is opened with an existing item', async () => {
    const el = mount();
    el.open(ITEM);
    el.shadowRoot.querySelector('#note-copy-btn').click();
    await vi.waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('From the corner shop')
    );
  });
});

// ── Immediate status commit ───────────────────────────────────────────────────

describe('item-dialog — immediate status commit', () => {
  it('dispatches item-status-changed when a radio changes in edit mode', () => {
    const el = mount();
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-status-changed', e => events.push(e));
    const radio = el.shadowRoot.querySelector('input[name="status"][value="done"]');
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(events).toHaveLength(1);
    expect(events[0].detail.status).toBe('done');
  });

  it('does not dispatch item-status-changed in create mode', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('item-status-changed', e => events.push(e));
    const radio = el.shadowRoot.querySelector('input[name="status"][value="done"]');
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(events).toHaveLength(0);
  });

  it('item-status-changed is bubbles and composed', () => {
    const el = mount();
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-status-changed', e => events.push(e));
    const radio = el.shadowRoot.querySelector('input[name="status"][value="paused"]');
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

// ── Add to goal ───────────────────────────────────────────────────────────────

describe('item-dialog — add to goal', () => {
  it('clicking Add to goal (via action sheet) switches to goal-promoter view', () => {
    const el = mount();
    el.open(ITEM);
    openGoalPromoter(el);
    expect(el.shadowRoot.querySelector('#view-goal-promoter').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(true);
  });

  it('Back button in goal-promoter returns to main view', () => {
    const el = mount();
    el.open(ITEM);
    openGoalPromoter(el);
    el.shadowRoot.querySelector('#promote-back').click();
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-goal-promoter').hidden).toBe(true);
  });

  it('year select is populated with 5 years around currentYear', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    openGoalPromoter(el);
    const options = [...el.shadowRoot.querySelectorAll('#year-select option')];
    expect(options.map(o => o.value)).toEqual(['2024', '2025', '2026', '2027', '2028']);
  });

  it('currentYear option is selected by default', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    openGoalPromoter(el);
    expect(el.shadowRoot.querySelector('#year-select').value).toBe('2026');
  });

  it('Add to goal CTA is enabled when item has no existing inGoals entries', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    openGoalPromoter(el);
    expect(el.shadowRoot.querySelector('#add-to-goal-cta').disabled).toBe(false);
  });

  it('Add to goal CTA is disabled when chosen year+section already in inGoals', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM_IN_GOALS);
    openGoalPromoter(el);
    // Default: year=2026, section=capstone — not in inGoals → enabled
    expect(el.shadowRoot.querySelector('#add-to-goal-cta').disabled).toBe(false);
    // Switch to milestones (which IS in inGoals)
    const milestonesRadio = el.shadowRoot.querySelector('input[name="goal-section"][value="milestones"]');
    milestonesRadio.checked = true;
    milestonesRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.shadowRoot.querySelector('#add-to-goal-cta').disabled).toBe(true);
  });

  it('in-goals section is hidden when item has no inGoals', () => {
    const el = mount();
    el.open(ITEM);
    openGoalPromoter(el);
    expect(el.shadowRoot.querySelector('#in-goals-section').hidden).toBe(true);
  });

  it('in-goals section is visible and shows pills when item has inGoals entries', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM_IN_GOALS);
    openGoalPromoter(el);
    expect(el.shadowRoot.querySelector('#in-goals-section').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('.in-goals-pill')).not.toBeNull();
  });

  it('emits item-promote with correct year and section', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-promote', e => events.push(e));
    openGoalPromoter(el);
    const wowRadio = el.shadowRoot.querySelector('input[name="goal-section"][value="wow"]');
    wowRadio.checked = true;
    wowRadio.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot.querySelector('#add-to-goal-cta').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.year).toBe('2026');
    expect(events[0].detail.section).toBe('wow');
  });

  it('item-promote includes current form values', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-promote', e => events.push(e));
    el.shadowRoot.querySelector('#title-input').value = 'Renamed item';
    el.shadowRoot.querySelector('#title-input').dispatchEvent(new Event('input'));
    openGoalPromoter(el);
    el.shadowRoot.querySelector('#add-to-goal-cta').click();
    expect(events[0].detail.title).toBe('Renamed item');
  });

  it('item-promote is bubbles and composed', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(ITEM);
    const events = [];
    el.addEventListener('item-promote', e => events.push(e));
    openGoalPromoter(el);
    el.shadowRoot.querySelector('#add-to-goal-cta').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});
