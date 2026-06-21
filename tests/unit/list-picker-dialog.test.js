// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/list-picker-dialog/list-picker-dialog.js';

const LIST_A = { id: 'la', name: 'Shopping', color: null };
const LIST_B = { id: 'lb', name: 'Ideas', color: '#FF0000' };
const LIST_C = { id: 'lc', name: 'Goals', color: '#00AA00' };

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn();
  return modal;
}

function mount() {
  const el = document.createElement('list-picker-dialog');
  document.body.appendChild(el);
  stubModal(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('list-picker-dialog — rendering', () => {
  it('renders a row for each list', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    expect(el.shadowRoot.querySelectorAll('[data-list-id]').length).toBe(2);
  });

  it('renders rows with correct data-list-id', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    expect(el.shadowRoot.querySelector('[data-list-id="la"]')).toBeTruthy();
    expect(el.shadowRoot.querySelector('[data-list-id="lb"]')).toBeTruthy();
  });

  it('shows no-lists message when lists is empty', () => {
    const el = mount();
    el.lists = [];
    el.show();
    expect(el.shadowRoot.querySelector('#no-lists-msg').hidden).toBe(false);
  });

  it('hides no-lists message when there are lists', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    expect(el.shadowRoot.querySelector('#no-lists-msg').hidden).toBe(true);
  });

  it('renders a color dot for lists with color', () => {
    const el = mount();
    el.lists = [LIST_B];
    el.show();
    expect(el.shadowRoot.querySelector('.row-dot')).toBeTruthy();
  });

  it('does not render a color dot for lists without color', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    expect(el.shadowRoot.querySelector('.row-dot')).toBeNull();
  });
});

// ── show() ────────────────────────────────────────────────────────────────────

describe('list-picker-dialog — show()', () => {
  it('calls show() on the internal modal', () => {
    const el = mount();
    el.lists = [LIST_A];
    const modal = el.shadowRoot.querySelector('#modal');
    el.show();
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('resets selection state on each show()', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(false);

    el.show();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#count-row').hidden).toBe(true);
  });
});

// ── Selection ─────────────────────────────────────────────────────────────────

describe('list-picker-dialog — selection', () => {
  it('Move and Copy CTAs are disabled before any selection', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(true);
  });

  it('Move and Copy CTAs are enabled after selecting a list', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(false);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(false);
  });

  it('row gets selected class and aria-selected=true when clicked', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const row = el.shadowRoot.querySelector('[data-list-id="la"]');
    row.click();
    expect(row.classList.contains('selected')).toBe(true);
    expect(row.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking selected row deselects it', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const row = el.shadowRoot.querySelector('[data-list-id="la"]');
    row.click();
    row.click();
    expect(row.classList.contains('selected')).toBe(false);
    expect(row.getAttribute('aria-selected')).toBe('false');
  });

  it('deselecting all lists disables CTAs again', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(true);
  });

  it('supports selecting multiple lists', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B, LIST_C];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('[data-list-id="lc"]').click();
    expect(el.shadowRoot.querySelector('#count').textContent).toContain('2');
  });
});

// ── Count row ─────────────────────────────────────────────────────────────────

describe('list-picker-dialog — count row', () => {
  it('count row is hidden before any selection', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    expect(el.shadowRoot.querySelector('#count-row').hidden).toBe(true);
  });

  it('count row becomes visible after selecting a list', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#count-row').hidden).toBe(false);
  });

  it('count text reflects number of selected lists', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('[data-list-id="lb"]').click();
    expect(el.shadowRoot.querySelector('#count').textContent).toContain('2');
  });

  it('clear button hides the count row', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#clear-btn').click();
    expect(el.shadowRoot.querySelector('#count-row').hidden).toBe(true);
  });

  it('clear button disables CTAs', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#clear-btn').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(true);
  });

  it('clear button deselects all rows', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B];
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('[data-list-id="lb"]').click();
    el.shadowRoot.querySelector('#clear-btn').click();
    const selected = el.shadowRoot.querySelectorAll('.row.selected');
    expect(selected.length).toBe(0);
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

describe('list-picker-dialog — list-pick event', () => {
  it('Move emits list-pick with copy=false', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.copy).toBe(false);
  });

  it('Copy emits list-pick with copy=true', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(events[0].detail.copy).toBe(true);
  });

  it('list-pick detail contains all selected targetListIds', () => {
    const el = mount();
    el.lists = [LIST_A, LIST_B, LIST_C];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('[data-list-id="lc"]').click();
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events[0].detail.targetListIds.sort()).toEqual(['la', 'lc'].sort());
  });

  it('list-pick is bubbles and composed', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('Move does not emit list-pick when nothing is selected', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events).toHaveLength(0);
  });

  it('emitting list-pick calls close() on the modal', () => {
    const el = mount();
    el.lists = [LIST_A];
    const modal = el.shadowRoot.querySelector('#modal');
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#move-btn').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── New list ──────────────────────────────────────────────────────────────────

describe('list-picker-dialog — new list', () => {
  it('New list button is rendered', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    expect(el.shadowRoot.querySelector('#new-list-btn')).not.toBeNull();
  });

  it('clicking New list button shows the input form and hides the button', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    expect(el.shadowRoot.querySelector('#new-list-form').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#new-list-btn').hidden).toBe(true);
  });

  it('typing in new list input enables CTAs', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    const input = el.shadowRoot.querySelector('#new-list-input');
    input.value = 'My New List';
    input.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(false);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(false);
  });

  it('CTAs remain disabled when new list input is empty', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    const input = el.shadowRoot.querySelector('#new-list-input');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
  });

  it('cancel button hides the form and restores the New list button', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    el.shadowRoot.querySelector('#new-list-cancel').click();
    expect(el.shadowRoot.querySelector('#new-list-form').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#new-list-btn').hidden).toBe(false);
  });

  it('cancel button disables CTAs again', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    const input = el.shadowRoot.querySelector('#new-list-input');
    input.value = 'New';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#new-list-cancel').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
  });

  it('list-pick includes newListName when input has text', () => {
    const el = mount();
    el.lists = [];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('#new-list-btn').click();
    const input = el.shadowRoot.querySelector('#new-list-input');
    input.value = 'Bucket List';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.newListName).toBe('Bucket List');
    expect(events[0].detail.copy).toBe(false);
  });

  it('list-pick includes newListName=null when input is empty', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events[0].detail.newListName).toBeNull();
  });

  it('list-pick can combine newListName and existing targetListIds', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    const events = [];
    el.addEventListener('list-pick', e => events.push(e));
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    el.shadowRoot.querySelector('#new-list-btn').click();
    const input = el.shadowRoot.querySelector('#new-list-input');
    input.value = 'New';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events[0].detail.targetListIds).toEqual(['la']);
    expect(events[0].detail.newListName).toBe('New');
  });

  it('show() resets the new list form', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.show();
    el.shadowRoot.querySelector('#new-list-btn').click();
    el.shadowRoot.querySelector('#new-list-input').value = 'Something';
    el.show();
    expect(el.shadowRoot.querySelector('#new-list-form').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#new-list-btn').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#new-list-input').value).toBe('');
  });
});

// ── Back button ───────────────────────────────────────────────────────────────

describe('list-picker-dialog — back button', () => {
  it('Back button calls close() on the modal', () => {
    const el = mount();
    el.lists = [LIST_A];
    const modal = el.shadowRoot.querySelector('#modal');
    el.show();
    el.shadowRoot.querySelector('#back-btn').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── mode prop ─────────────────────────────────────────────────────────────────

describe('list-picker-dialog — mode prop', () => {
  it('mode=move hides the Copy button', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.mode = 'move';
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#copy-btn').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#move-btn').hidden).toBe(false);
  });

  it('mode=copy hides the Move button', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.mode = 'copy';
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#move-btn').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#copy-btn').hidden).toBe(false);
  });

  it('mode=null shows both buttons', () => {
    const el = mount();
    el.lists = [LIST_A];
    el.mode = null;
    el.show();
    el.shadowRoot.querySelector('[data-list-id="la"]').click();
    expect(el.shadowRoot.querySelector('#move-btn').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#copy-btn').hidden).toBe(false);
  });
});
