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

afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

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

// ── new list creation ─────────────────────────────────────────────────────────

describe('list-dialog — new list creation', () => {
  it('dispatches list-created on modal-close when name is non-empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Reading list';
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(1);
    expect(events[0].detail.name).toBe('Reading list');
  });

  it('trims whitespace from name in list-created', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = '  Books  ';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.name).toBe('Books');
  });

  it('does not dispatch list-created when name is whitespace only', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = '   ';
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(0);
  });

  it('dispatches list-created on Enter key when name is non-empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Keyboard save';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.name).toBe('Keyboard save');
  });

  it('list-created is bubbles and composed', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Test';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});

// ── edit existing (blur-save) ─────────────────────────────────────────────────

describe('list-dialog — edit existing (blur-save)', () => {
  it('dispatches list-name-changed when name blurs with a new value', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-name-changed', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Updated name';
    inp.dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(1);
    expect(events[0].detail.name).toBe('Updated name');
  });

  it('does not dispatch list-name-changed when name is unchanged on blur', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-name-changed', e => events.push(e));
    el.shadowRoot.querySelector('#input').dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(0);
  });

  it('reverts name field to last valid value when cleared on blur', () => {
    const el = mount();
    el.open(LIST);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = '';
    inp.dispatchEvent(new Event('blur'));
    expect(inp.value).toBe(LIST.name);
  });

  it('dispatches list-closed on modal close for existing list', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-closed', e => events.push(e));
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(1);
  });

  it('Close button closes the modal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(LIST);
    el.shadowRoot.querySelector('#close').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('Enter key blurs and closes for existing list', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(LIST);
    el.shadowRoot.querySelector('#input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('list-dialog — delete', () => {
  it('dispatches list-delete on first click', () => {
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

  it('closes the dialog on first click', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(LIST);
    el.shadowRoot.querySelector('#delete').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});


// ── draft ─────────────────────────────────────────────────────────────────────

const LIST_DRAFT_KEY = 'telos:draft.new-list';

describe('list-dialog — draft', () => {
  it('loads draft name when opening a new list', () => {
    localStorage.setItem(LIST_DRAFT_KEY, JSON.stringify({ name: 'Draft list', color: null }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('Draft list');
  });

  it('loads draft color when opening a new list', () => {
    localStorage.setItem(LIST_DRAFT_KEY, JSON.stringify({ name: '', color: '#3DAD6A' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('.swatch[data-color="#3DAD6A"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('does not load draft when opening an existing list', () => {
    localStorage.setItem(LIST_DRAFT_KEY, JSON.stringify({ name: 'Draft', color: null }));
    const el = mount();
    el.open(LIST);
    expect(el.shadowRoot.querySelector('#input').value).toBe('Gift ideas');
  });

  it('saves draft on name input', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'My new list';
    inp.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(LIST_DRAFT_KEY)).name).toBe('My new list');
  });

  it('saves draft when a color swatch is selected', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(JSON.parse(localStorage.getItem(LIST_DRAFT_KEY)).color).toBe('#4A94D4');
  });

  it('does not save draft when editing an existing list', () => {
    const el = mount();
    el.open(LIST);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Modified';
    inp.dispatchEvent(new Event('input'));
    expect(localStorage.getItem(LIST_DRAFT_KEY)).toBeNull();
  });

  it('clears draft when modal closes with non-empty name', () => {
    localStorage.setItem(LIST_DRAFT_KEY, JSON.stringify({ name: 'Draft', color: null }));
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#input').value = 'Saved list';
    el.shadowRoot.querySelector('#modal').close();
    expect(localStorage.getItem(LIST_DRAFT_KEY)).toBeNull();
  });

  it('preserves draft when modal closes with empty name', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'In progress';
    inp.dispatchEvent(new Event('input'));
    inp.value = '';
    el.shadowRoot.querySelector('#modal').close();
    expect(JSON.parse(localStorage.getItem(LIST_DRAFT_KEY)).name).toBe('In progress');
  });
});

// ── color picker ──────────────────────────────────────────────────────────────

describe('list-dialog — color picker', () => {
  it('color swatches are always visible without any interaction', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('.color-swatches').hidden).toBe(false);
  });

  it('selected swatch gets aria-pressed true', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('only one swatch has aria-pressed true at a time', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    el.shadowRoot.querySelector('.swatch[data-color="#E5534B"]').click();
    const pressed = [...el.shadowRoot.querySelectorAll('.swatch[aria-pressed="true"]')];
    expect(pressed).toHaveLength(1);
    expect(pressed[0].dataset.color).toBe('#E5534B');
  });

  it('color is included in list-created detail when a swatch is selected', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    el.shadowRoot.querySelector('#input').value = 'Books';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.color).toBe('#4A94D4');
  });

  it('color is null in list-created detail when no swatch is selected', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Books';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.color).toBeNull();
  });

  it('pre-selects the list colour when opened with an existing list', () => {
    const el = mount();
    el.open(LIST_WITH_COLOR);
    expect(el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('pre-selects no color when list has no color', () => {
    const el = mount();
    el.open(LIST);
    expect(el.shadowRoot.querySelector('.swatch[data-color=""]').getAttribute('aria-pressed')).toBe('true');
  });

  it('selecting none swatch dispatches list-color-changed with null in edit mode', () => {
    const el = mount();
    el.open(LIST_WITH_COLOR);
    const events = [];
    el.addEventListener('list-color-changed', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color=""]').click();
    expect(events[0].detail.color).toBeNull();
  });
});

// ── immediate color commit ────────────────────────────────────────────────────

describe('list-dialog — immediate color commit', () => {
  it('dispatches list-color-changed when a swatch is clicked in edit mode', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-color-changed', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.color).toBe('#4A94D4');
  });

  it('dispatches list-color-changed with null when the none swatch is clicked in edit mode', () => {
    const el = mount();
    el.open(LIST_WITH_COLOR);
    const events = [];
    el.addEventListener('list-color-changed', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color=""]').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.color).toBeNull();
  });

  it('does not dispatch list-color-changed in create mode', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('list-color-changed', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(events).toHaveLength(0);
  });

  it('list-color-changed is bubbles and composed', () => {
    const el = mount();
    el.open(LIST);
    const events = [];
    el.addEventListener('list-color-changed', e => events.push(e));
    el.shadowRoot.querySelector('.swatch[data-color="#4A94D4"]').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });
});
