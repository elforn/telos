// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/list-dialog/list-dialog.js';

const LIST = { id: 'l1', name: 'Gift ideas' };
const LIST_WITH_COLOR = { id: 'l2', name: 'Gift ideas', color: '#4A94D4' };

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return modal;
}

function mount() {
  const el = document.createElement('list-dialog');
  document.body.appendChild(el);
  stubModal(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

// ── open() ────────────────────────────────────────────────────────────────────

describe('list-dialog — open', () => {
  it('calls show() on the modal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('pre-fills input with existing list name', () => {
    const el = mount();
    el.open(LIST);
    expect(el.shadowRoot.querySelector('#input').value).toBe('Gift ideas');
  });

  it('clears input when opened with no list', () => {
    const el = mount();
    el.open(LIST);
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
  });

  it('shows delete button when opened with an existing list', () => {
    const el = mount();
    el.open(LIST);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(false);
  });

  it('hides delete button when opened with no list', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(true);
  });
});

// ── save ──────────────────────────────────────────────────────────────────────

describe('list-dialog — save', () => {
  it('save button is disabled when input is empty', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(true);
  });

  it('save button enables when input has text', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Books';
    inp.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(false);
  });

  it('dispatches list-saved with the name on save click', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Reading list';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.name).toBe('Reading list');
  });

  it('does not dispatch list-saved when input is only whitespace', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = '   ';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(0);
  });

  it('trims whitespace from the saved name', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = '  Books  ';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.name).toBe('Books');
  });

  it('closes the dialog after saving', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Ideas';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('dispatches list-saved on Enter key in input', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Keyboard save';
    inp.dispatchEvent(new Event('input'));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.name).toBe('Keyboard save');
  });

  it('list-saved is bubbles and composed', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Test';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('list-dialog — delete', () => {
  it('dispatches list-delete when delete is clicked', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events).toHaveLength(1);
  });

  it('list-delete is bubbles and composed', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('closes the dialog after delete', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(LIST);
    el.shadowRoot.querySelector('#delete').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── cancel ────────────────────────────────────────────────────────────────────

describe('list-dialog — cancel', () => {
  it('closes the dialog when cancel is clicked', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    el.shadowRoot.querySelector('#cancel').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── color picker ──────────────────────────────────────────────────────────────

describe('list-dialog — color picker', () => {
  it('color swatches are hidden by default', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('.color-swatches').hidden).toBe(true);
  });

  it('clicking color-toggle reveals swatches', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#color-toggle').click();
    expect(el.shadowRoot.querySelector('.color-swatches').hidden).toBe(false);
  });

  it('clicking a swatch collapses the swatches row', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#color-toggle').click();
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(el.shadowRoot.querySelector('.color-swatches').hidden).toBe(true);
  });

  it('selected swatch gets aria-pressed true', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#color-toggle').click();
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    el.shadowRoot.querySelector('#color-toggle').click();
    expect(el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('color is included in list-saved detail when a swatch is selected', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    el.shadowRoot.querySelector('#color-toggle').click();
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Books';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.color).toBe('#4A94D4');
  });

  it('color is null in list-saved detail when no swatch is selected', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Books';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.color).toBeNull();
  });

  it('pre-selects the list colour when opened with an existing list', () => {
    const el = mount();
    el.open(LIST_WITH_COLOR);
    el.shadowRoot.querySelector('#color-toggle').click();
    expect(el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('pre-selects no color when list has no color', () => {
    const el = mount();
    el.open(LIST);
    el.shadowRoot.querySelector('#color-toggle').click();
    expect(el.shadowRoot.querySelector('.swatch[data-color=""]').getAttribute('aria-pressed')).toBe('true');
  });

  it('selecting none swatch clears a previously set color', () => {
    const el = mount();
    el.open(LIST_WITH_COLOR);
    const events = [];
    el.addEventListener('list-saved', e => events.push(e));
    el.shadowRoot.querySelector('#color-toggle').click();
    el.shadowRoot.querySelector('.swatch[data-color=""]').click();
    el.shadowRoot.querySelector('#input').dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.color).toBeNull();
  });
});
