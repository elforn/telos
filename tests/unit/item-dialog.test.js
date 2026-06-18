// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/item-dialog/item-dialog.js';

const ITEM = { id: 'i1', title: 'Buy flowers', status: 'paused', note: 'From the corner shop', url: 'https://example.com' };

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return modal;
}

function mount() {
  const el = document.createElement('item-dialog');
  document.body.appendChild(el);
  stubModal(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

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
  it('dispatches item-delete when delete is clicked', () => {
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

  it('closes the dialog after delete', () => {
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
