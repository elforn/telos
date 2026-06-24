// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '../../app/strings.js';
import '../../app/components/goal-dialog/goal-dialog.js';

HTMLElement.prototype.setPointerCapture    = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

function stubModal(el) {
  const modal = el.shadowRoot.querySelector('#modal');
  modal.show  = vi.fn();
  modal.close = vi.fn(() => {
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  });
  return modal;
}

function stubActionSheet(el) {
  const sheet = el.shadowRoot.querySelector('#action-sheet');
  sheet.showModal = vi.fn(() => sheet.setAttribute('open', ''));
  sheet.close     = vi.fn(() => sheet.removeAttribute('open'));
  return sheet;
}

function stubListPicker(el) {
  const picker = el.shadowRoot.querySelector('#list-picker');
  const modal  = picker.shadowRoot?.querySelector('#modal');
  if (modal) { modal.show = vi.fn(); modal.close = vi.fn(); }
  picker.show = vi.fn();
  return picker;
}

function mount() {
  const el = document.createElement('goal-dialog');
  document.body.appendChild(el);
  stubModal(el);
  stubActionSheet(el);
  stubListPicker(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); });

describe('goal-dialog — open', () => {
  it('calls show() when open() is invoked', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    expect(modal.show).toHaveBeenCalledOnce();
  });

  it('populates input with existing goal title', () => {
    const el = mount();
    el.open({ title: 'Grand Capstone' });
    expect(el.shadowRoot.querySelector('#input').value).toBe('Grand Capstone');
  });

  it('clears input when opened with no goal', () => {
    const el = mount();
    el.open({ title: 'Old title' });
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
  });
});

describe('goal-dialog — save', () => {
  it('save button is disabled when input is empty', () => {
    const el = mount();
    el.open();
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(true);
  });

  it('save button enables when input has text', () => {
    const el = mount();
    el.open();
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    expect(el.shadowRoot.querySelector('#save').disabled).toBe(false);
  });

  it('dispatches goal-saved with the title on save click', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Grand Capstone';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.title).toBe('Grand Capstone');
  });

  it('does not dispatch goal-saved if input is only whitespace', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events).toHaveLength(0);
  });

  it('closes the dialog after saving', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open();
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Grand Capstone';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('dispatches goal-saved on Enter key in input', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Keyboard save';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.title).toBe('Keyboard save');
  });

  it('trims whitespace from saved title', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = '  My goal  ';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.title).toBe('My goal');
  });
});

describe('goal-dialog — delete', () => {
  it('delete button is hidden when opened with no goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(true);
  });

  it('delete button is visible when opened with an existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    expect(el.shadowRoot.querySelector('#delete').hidden).toBe(false);
  });

  it('dispatches goal-delete on first click', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    const events = [];
    el.addEventListener('goal-delete', e => events.push(e));
    el.shadowRoot.querySelector('#delete').click();
    expect(events).toHaveLength(1);
  });

  it('closes the dialog on first click', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#delete').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });
});

// ── draft ─────────────────────────────────────────────────────────────────────

const GOAL_DRAFT_KEY = 'telos.draft.new-goal';

describe('goal-dialog — draft', () => {
  it('loads draft title when opening a new goal', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('Draft goal');
  });

  it('does not load draft when opening an existing goal', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.open({ title: 'Real goal' });
    expect(el.shadowRoot.querySelector('#input').value).toBe('Real goal');
  });

  it('saves draft on title input', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Typing a draft';
    inp.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem(GOAL_DRAFT_KEY)).title).toBe('Typing a draft');
  });

  it('does not save draft when editing an existing goal', () => {
    const el = mount();
    el.open({ title: 'Existing' });
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Modified';
    inp.dispatchEvent(new Event('input'));
    expect(localStorage.getItem(GOAL_DRAFT_KEY)).toBeNull();
  });

  it('clears draft on save', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Saved goal';
    inp.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(localStorage.getItem(GOAL_DRAFT_KEY)).toBeNull();
  });

  it('clears draft on cancel', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#cancel').click();
    expect(localStorage.getItem(GOAL_DRAFT_KEY)).toBeNull();
  });

  it('preserves draft on backdrop close', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'In progress';
    inp.dispatchEvent(new Event('input'));
    modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
    expect(JSON.parse(localStorage.getItem(GOAL_DRAFT_KEY)).title).toBe('In progress');
  });
});

describe('goal-dialog — notes', () => {
  it('notes textarea is always visible', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#desc-input').hidden).toBe(false);
  });

  it('populates notes when opening an existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', notes: 'My notes' });
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('My notes');
  });

  it('clears notes when opening a goal without one', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', notes: 'Has notes' });
    el.open({ id: '2', title: 'Other' });
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('');
  });

  it('includes notes in goal-saved event', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'Some details';
    desc.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.notes).toBe('Some details');
  });

  it('emits undefined notes when textarea is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-saved', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(events[0].detail.notes).toBeUndefined();
  });

  it('saves notes in draft', () => {
    const el = mount();
    el.open(null);
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'Draft desc';
    desc.dispatchEvent(new Event('input'));
    const draft = JSON.parse(localStorage.getItem('telos.draft.new-goal'));
    expect(draft.notes).toBe('Draft desc');
  });

  it('restores notes from draft when opening new goal', () => {
    localStorage.setItem('telos.draft.new-goal', JSON.stringify({ title: 'T', notes: 'Saved desc' }));
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('Saved desc');
  });
});

describe('goal-dialog — more actions (⋯ menu)', () => {
  it('menu button is hidden when opened with no goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(true);
  });

  it('menu button is visible when opened with an existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
  });

  it('clicking menu button calls showModal on the action sheet', () => {
    const el = mount();
    const sheet = el.shadowRoot.querySelector('#action-sheet');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(sheet.showModal).toHaveBeenCalledOnce();
  });
});

describe('goal-dialog — move view', () => {
  const goal = { id: '1', title: 'Run a 5k', notes: 'My desc' };

  it('clicking action-move-btn switches to move view', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    expect(el.shadowRoot.querySelector('#view-move').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(true);
  });

  it('move view pre-selects the current year', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    expect(el.shadowRoot.querySelector('#move-year-select').value).toBe('2026');
  });

  it('move view pre-selects the current section', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'wow' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    const checked = el.shadowRoot.querySelector('#move-section-group input:checked');
    expect(checked?.value).toBe('wow');
  });

  it('Move and Copy buttons are disabled when same year+section selected', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(true);
  });

  it('Move and Copy buttons enable when a different year is selected', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    const sel = el.shadowRoot.querySelector('#move-year-select');
    sel.value = '2027';
    sel.dispatchEvent(new Event('change'));
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(false);
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(false);
  });

  it('Move and Copy buttons enable when a different section is selected', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    // happy-dom doesn't auto-uncheck siblings — uncheck current explicitly
    el.shadowRoot.querySelector('#move-section-group input[value="milestones"]').checked = false;
    const radio = el.shadowRoot.querySelector('#move-section-group input[value="focus"]');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(false);
  });

  it('dispatches goal-move with copy:false when Move is clicked', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    const sel = el.shadowRoot.querySelector('#move-year-select');
    sel.value = '2027';
    sel.dispatchEvent(new Event('change'));
    const events = [];
    el.addEventListener('goal-move', e => events.push(e));
    el.shadowRoot.querySelector('#move-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      fromYear: '2026', fromSection: 'milestones',
      toYear:   '2027', toSection:   'milestones',
      copy: false,
    });
    expect(events[0].detail.goal).toBe(goal);
  });

  it('dispatches goal-move with copy:true when Copy is clicked', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    const sel = el.shadowRoot.querySelector('#move-year-select');
    sel.value = '2025';
    sel.dispatchEvent(new Event('change'));
    const events = [];
    el.addEventListener('goal-move', e => events.push(e));
    el.shadowRoot.querySelector('#copy-btn').click();
    expect(events[0].detail.copy).toBe(true);
  });

  it('move-back button returns to main view', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    el.shadowRoot.querySelector('#move-back').click();
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-move').hidden).toBe(true);
  });
});

describe('goal-dialog — create list item', () => {
  const goal = { id: '1', title: 'Run a 5k', notes: 'Start with 1k' };

  it('clicking action-create-btn calls show() on list-picker-dialog', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    const picker = el.shadowRoot.querySelector('#list-picker');
    el.shadowRoot.querySelector('#action-create-btn').click();
    expect(picker.show).toHaveBeenCalledOnce();
  });

  it('passes availableLists to list-picker-dialog before showing', () => {
    const el = mount();
    const lists = [{ id: 'l1', name: 'Ideas', items: [] }];
    el.availableLists = lists;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-create-btn').click();
    expect(el.shadowRoot.querySelector('#list-picker').lists).toBe(lists);
  });

  it('dispatches goal-create-item when list-pick fires from picker', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    const events = [];
    el.addEventListener('goal-create-item', e => events.push(e));
    const picker = el.shadowRoot.querySelector('#list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: ['l1'], newListName: null, copy: true },
    }));
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      targetListIds: ['l1'],
      newListName: null,
      copy: true,
      fromYear: '2026',
      fromSection: 'milestones',
    });
    expect(events[0].detail.goal).toBe(goal);
  });

  it('goal-create-item with copy:false carries fromYear+fromSection for deletion', () => {
    const el = mount();
    el.open(goal, { year: '2025', section: 'focus' });
    const events = [];
    el.addEventListener('goal-create-item', e => events.push(e));
    const picker = el.shadowRoot.querySelector('#list-picker');
    picker.dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds: [], newListName: 'New list', copy: false },
    }));
    expect(events[0].detail.fromYear).toBe('2025');
    expect(events[0].detail.fromSection).toBe('focus');
    expect(events[0].detail.copy).toBe(false);
  });
});

describe('goal-dialog — copy notes', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('copy button is present in the shadow DOM', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#desc-copy-btn')).not.toBeNull();
  });

  it('does not call clipboard.writeText when notes is empty', async () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#desc-copy-btn').click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('calls clipboard.writeText with the notes text', async () => {
    const el = mount();
    el.open(null);
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'My goal notes';
    desc.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#desc-copy-btn').click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('My goal notes'));
  });

  it('adds is-copied class after a successful copy', async () => {
    const el = mount();
    el.open(null);
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'Some notes';
    desc.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#desc-copy-btn').click();
    await vi.waitFor(() =>
      expect(el.shadowRoot.querySelector('#desc-copy-btn').classList.contains('is-copied')).toBe(true)
    );
  });

  it('also copies when the dialog is opened with an existing goal', async () => {
    const el = mount();
    el.open({ id: '1', title: 'Run a 5k', notes: 'Start with 1k daily' });
    el.shadowRoot.querySelector('#desc-copy-btn').click();
    await vi.waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Start with 1k daily')
    );
  });
});

describe('goal-dialog — cancel', () => {
  it('dispatches goal-cancelled when cancel is clicked', () => {
    const el = mount();
    el.open();
    const events = [];
    el.addEventListener('goal-cancelled', e => events.push(e));
    el.shadowRoot.querySelector('#cancel').click();
    expect(events).toHaveLength(1);
  });

  it('does not dispatch goal-cancelled after a successful save', () => {
    const el = mount();
    el.open();
    const cancelled = [];
    el.addEventListener('goal-cancelled', e => cancelled.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'My goal';
    input.dispatchEvent(new Event('input'));
    el.shadowRoot.querySelector('#save').click();
    expect(cancelled).toHaveLength(0);
  });
});
