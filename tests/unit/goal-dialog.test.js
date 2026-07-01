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

describe('goal-dialog — new goal creation', () => {
  it('dispatches goal-created on modal-close when title is non-empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Grand Capstone';
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(1);
    expect(events[0].detail.title).toBe('Grand Capstone');
  });

  it('trims whitespace from title in goal-created', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = '  My goal  ';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.title).toBe('My goal');
  });

  it('does not dispatch goal-created when title is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = '';
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(0);
  });

  it('does not dispatch goal-created when title is whitespace only', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = '   ';
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(0);
  });

  it('dispatches goal-created on Enter key when title is non-empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Keyboard save';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.title).toBe('Keyboard save');
  });

  it('Enter key does nothing when title is empty', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    el.shadowRoot.querySelector('#input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(modal.close).not.toHaveBeenCalled();
  });
});

describe('goal-dialog — edit existing (blur-save)', () => {
  it('dispatches goal-title-changed when title field blurs with a new value', () => {
    const el = mount();
    el.open({ id: '1', title: 'Original' });
    const events = [];
    el.addEventListener('goal-title-changed', e => events.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Updated';
    input.dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(1);
    expect(events[0].detail.title).toBe('Updated');
  });

  it('does not dispatch goal-title-changed when title is unchanged on blur', () => {
    const el = mount();
    el.open({ id: '1', title: 'Same' });
    const events = [];
    el.addEventListener('goal-title-changed', e => events.push(e));
    el.shadowRoot.querySelector('#input').dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(0);
  });

  it('reverts title field to last valid value when cleared on blur', () => {
    const el = mount();
    el.open({ id: '1', title: 'Keep me' });
    const input = el.shadowRoot.querySelector('#input');
    input.value = '';
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('Keep me');
  });

  it('dispatches goal-notes-changed when notes field blurs with a new value', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', notes: 'Old notes' });
    const events = [];
    el.addEventListener('goal-notes-changed', e => events.push(e));
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'New notes';
    desc.dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(1);
    expect(events[0].detail.notes).toBe('New notes');
  });

  it('dispatches goal-notes-changed with undefined when notes are cleared', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', notes: 'Old notes' });
    const events = [];
    el.addEventListener('goal-notes-changed', e => events.push(e));
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = '';
    desc.dispatchEvent(new Event('blur'));
    expect(events[0].detail.notes).toBeUndefined();
  });

  it('dispatches goal-closed on modal close for existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    const events = [];
    el.addEventListener('goal-closed', e => events.push(e));
    el.shadowRoot.querySelector('#modal').close();
    expect(events).toHaveLength(1);
  });

  it('Close button closes the modal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#close').click();
    expect(modal.close).toHaveBeenCalledOnce();
  });

  it('Enter key blurs and closes for existing goal', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(modal.close).toHaveBeenCalledOnce();
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

const GOAL_DRAFT_KEY = 'telos:draft.new-goal';

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

  it('clears draft when modal closes with non-empty title', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'Saved goal';
    el.shadowRoot.querySelector('#modal').close();
    expect(localStorage.getItem(GOAL_DRAFT_KEY)).toBeNull();
  });

  it('preserves draft when modal closes with empty title', () => {
    const el = mount();
    el.open(null);
    const inp = el.shadowRoot.querySelector('#input');
    inp.value = 'In progress';
    inp.dispatchEvent(new Event('input'));
    inp.value = '';
    el.shadowRoot.querySelector('#modal').close();
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

  it('includes notes in goal-created event', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'My goal';
    el.shadowRoot.querySelector('#desc-input').value = 'Some details';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.notes).toBe('Some details');
  });

  it('emits undefined notes in goal-created when textarea is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'My goal';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.notes).toBeUndefined();
  });

  it('saves notes in draft', () => {
    const el = mount();
    el.open(null);
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'Draft desc';
    desc.dispatchEvent(new Event('input'));
    const draft = JSON.parse(localStorage.getItem(GOAL_DRAFT_KEY));
    expect(draft.notes).toBe('Draft desc');
  });

  it('restores notes from draft when opening new goal', () => {
    localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify({ title: 'T', notes: 'Saved desc' }));
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

  it('Move button is disabled when same year+section selected', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    expect(el.shadowRoot.querySelector('#move-btn').disabled).toBe(true);
  });

  it('Copy button is enabled when same year+section selected (duplicate)', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#action-move-btn').click();
    expect(el.shadowRoot.querySelector('#copy-btn').disabled).toBe(false);
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

describe('goal-dialog — blur-save announce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets save-status text when title blurs with a changed value', () => {
    const el = mount();
    el.open({ id: '1', title: 'Original' });
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Updated';
    input.dispatchEvent(new Event('blur'));
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('Saved');
  });

  it('clears save-status text after 1500ms', () => {
    const el = mount();
    el.open({ id: '1', title: 'Original' });
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Updated';
    input.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(1500);
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('');
  });

  it('rapid blurs cancel the previous timer so only the last one clears', () => {
    const el = mount();
    el.open({ id: '1', title: 'Original' });
    const input = el.shadowRoot.querySelector('#input');

    input.value = 'Change 1';
    input.dispatchEvent(new Event('blur'));
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('Saved');

    vi.advanceTimersByTime(800); // 800ms into the first timer — hasn't fired yet

    input.value = 'Change 2';
    input.dispatchEvent(new Event('blur')); // clears first timer, starts new 1500ms
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('Saved');

    vi.advanceTimersByTime(700); // 1500ms since first blur — first timer was cancelled
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('Saved'); // still visible

    vi.advanceTimersByTime(800); // 1500ms since second blur — second timer fires
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('');
  });

  it('does not set save-status when title is unchanged on blur', () => {
    const el = mount();
    el.open({ id: '1', title: 'Same' });
    el.shadowRoot.querySelector('#input').dispatchEvent(new Event('blur'));
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('');
  });

  it('sets save-status when notes field blurs with a changed value', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', notes: 'Old' });
    const desc = el.shadowRoot.querySelector('#desc-input');
    desc.value = 'New notes';
    desc.dispatchEvent(new Event('blur'));
    expect(el.shadowRoot.querySelector('#save-status').textContent).toBe('Saved');
  });
});

describe('goal-dialog — archive button', () => {
  const goal = { id: '1', title: 'Run a 5k' };

  it('archive button is hidden for new goals', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#archive').hidden).toBe(true);
  });

  it('archive button is visible for existing goals', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    expect(el.shadowRoot.querySelector('#archive').hidden).toBe(false);
  });

  it('shows "Archive" text and aria-pressed=false for non-archived goal', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    const btn = el.shadowRoot.querySelector('#archive');
    expect(btn.textContent).toBe('Archive');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows "Unarchive" text and aria-pressed=true for archived goal', () => {
    const el = mount();
    el.open({ ...goal, archived: true }, { year: '2026', section: 'milestones' });
    const btn = el.shadowRoot.querySelector('#archive');
    expect(btn.textContent).toBe('Unarchive');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking Archive flips text to Unarchive without closing the dialog', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#archive').click();
    expect(el.shadowRoot.querySelector('#archive').textContent).toBe('Unarchive');
    expect(modal.close).not.toHaveBeenCalled();
  });

  it('clicking Archive sets aria-pressed to true', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#archive').click();
    expect(el.shadowRoot.querySelector('#archive').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking Archive again flips text back to Archive', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    el.shadowRoot.querySelector('#archive').click();
    el.shadowRoot.querySelector('#archive').click();
    expect(el.shadowRoot.querySelector('#archive').textContent).toBe('Archive');
    expect(el.shadowRoot.querySelector('#archive').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking Archive dispatches goal-archived-changed with archived:true', () => {
    const el = mount();
    el.open(goal, { year: '2026', section: 'milestones' });
    const events = [];
    el.addEventListener('goal-archived-changed', e => events.push(e));
    el.shadowRoot.querySelector('#archive').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.archived).toBe(true);
  });

  it('clicking Unarchive dispatches goal-archived-changed with archived:false', () => {
    const el = mount();
    el.open({ ...goal, archived: true }, { year: '2026', section: 'milestones' });
    const events = [];
    el.addEventListener('goal-archived-changed', e => events.push(e));
    el.shadowRoot.querySelector('#archive').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.archived).toBe(false);
  });
});

describe('goal-dialog — tag chip aria-labels', () => {
  it('tag chip has aria-label containing the tag name', () => {
    const el = mount();
    el.open({ id: '1', title: 'Run a 5k', tags: ['health', 'fitness'] });
    const chips = el.shadowRoot.querySelectorAll('.tag-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute('aria-label')).toContain('health');
    expect(chips[1].getAttribute('aria-label')).toContain('fitness');
  });

  it('tag chip aria-label is not a raw hex value', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', tags: ['work'] });
    const btn = el.shadowRoot.querySelector('.tag-chip');
    expect(btn.getAttribute('aria-label')).not.toMatch(/#[0-9a-fA-F]/);
  });
});

