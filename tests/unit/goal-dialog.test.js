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
  sheet.show  = vi.fn();
  sheet.close = vi.fn();
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

  it('deadline field is hidden by default on a new goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('.duedate-field').hidden).toBe(true);
  });

  it('deadline field is shown automatically when goal has a dueDate', () => {
    const el = mount();
    el.open({ title: 'Grand Capstone', dueDate: '2026-12-31' });
    expect(el.shadowRoot.querySelector('.duedate-field').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#duedate-input').value).toBe('2026-12-31');
  });

  it('clicking duedate-toggle (in the overflow menu) reveals the deadline field', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#action-duedate-toggle').click();
    expect(el.shadowRoot.querySelector('.duedate-field').hidden).toBe(false);
  });

  it('duedate-toggle sets aria-pressed to true when shown', () => {
    const el = mount();
    el.open({ title: 'Grand Capstone', dueDate: '2026-12-31' });
    const btn = el.shadowRoot.querySelector('#action-duedate-toggle');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('duedate-toggle sets aria-pressed to false when hidden', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#action-duedate-toggle').getAttribute('aria-pressed')).toBe('false');
  });

  it('duedate-toggle closes the overflow menu', () => {
    const el = mount();
    el.open(null);
    el.shadowRoot.querySelector('#action-duedate-toggle').click();
    expect(el.shadowRoot.querySelector('#action-sheet').close).toHaveBeenCalled();
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
    input.focus(); // a real Enter keydown only targets a focused input, so blur() actually fires
    input.value = 'Keyboard save';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events[0].detail.title).toBe('Keyboard save');
  });

  it('quick-add: Enter on a new goal resets the form and keeps the dialog open', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    el.open(null);
    const input = el.shadowRoot.querySelector('#input');
    input.focus();
    input.value = 'First goal';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(modal.close).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(el._isNew).toBe(true);
  });

  it('quick-add: resets notes, due date and tags — not just the title', () => {
    const el = mount();
    el.open(null);
    const sr = el.shadowRoot;
    sr.querySelector('#input').value = 'First goal';
    sr.querySelector('#desc-input').value = 'Some notes';
    sr.querySelector('#duedate-input').value = '2026-12-31';
    const tagInput = sr.querySelector('#tag-input').shadowRoot.querySelector('.tag-text-input');
    tagInput.value = 'health';
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const input = sr.querySelector('#input');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(sr.querySelector('#desc-input').value).toBe('');
    expect(sr.querySelector('#duedate-input').value).toBe('');
    expect(sr.querySelector('#tag-input').tags).toEqual([]);
    expect(sr.querySelector('#delete').hidden).toBe(true);
  });

  it('quick-add: a second Enter creates a second goal without closing', () => {
    const el = mount();
    el.open(null);
    const created = [];
    el.addEventListener('goal-created', e => created.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.focus();
    input.value = 'First goal';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.focus();
    input.value = 'Second goal';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(created).toHaveLength(2);
    expect(created[0].detail.title).toBe('First goal');
    expect(created[1].detail.title).toBe('Second goal');
  });

  it('commits (goal-created) when the title blurs on a new goal', () => {
    const el = mount();
    el.open(null);
    const created = [];
    el.addEventListener('goal-created', e => created.push(e));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Blur save';
    input.dispatchEvent(new Event('blur'));
    expect(created).toHaveLength(1);
    expect(created[0].detail.title).toBe('Blur save');
  });

  it('does not create a second time on close after a blur-commit (fires goal-closed)', () => {
    const el = mount();
    el.open(null);
    const created = [], closed = [];
    el.addEventListener('goal-created', () => created.push(1));
    el.addEventListener('goal-closed', () => closed.push(1));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Once';
    input.dispatchEvent(new Event('blur'));   // commit
    el.shadowRoot.querySelector('#modal').dispatchEvent(new CustomEvent('modal-close'));
    expect(created).toHaveLength(1);
    expect(closed).toHaveLength(1);
  });

  it('does not double-create when close fires before the input blur', () => {
    const el = mount();
    el.open(null);
    const created = [];
    el.addEventListener('goal-created', () => created.push(1));
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'Once';
    // Real browser order for a focused input: dialog close first, then blur.
    el.shadowRoot.querySelector('#modal').dispatchEvent(new CustomEvent('modal-close'));
    input.dispatchEvent(new Event('blur'));
    expect(created).toHaveLength(1);
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

  it('includes dueDate in goal-created when deadline is filled', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Grand Capstone';
    el.shadowRoot.querySelector('#duedate-input').value = '2026-12-31';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.dueDate).toBe('2026-12-31');
  });

  it('dueDate is undefined in goal-created when deadline is empty', () => {
    const el = mount();
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Grand Capstone';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.dueDate).toBeUndefined();
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

  it('dispatches goal-duedate-changed when deadline changes', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal' });
    const events = [];
    el.addEventListener('goal-duedate-changed', e => events.push(e));
    const inp = el.shadowRoot.querySelector('#duedate-input');
    inp.value = '2026-10-01';
    inp.dispatchEvent(new Event('change'));
    expect(events).toHaveLength(1);
    expect(events[0].detail.dueDate).toBe('2026-10-01');
  });

  it('clicking duedate-clear empties the field and dispatches goal-duedate-changed with undefined', () => {
    const el = mount();
    el.open({ id: '1', title: 'Goal', dueDate: '2026-10-01' });
    const events = [];
    el.addEventListener('goal-duedate-changed', e => events.push(e));
    el.shadowRoot.querySelector('#duedate-clear').click();
    expect(el.shadowRoot.querySelector('#duedate-input').value).toBe('');
    expect(events).toHaveLength(1);
    expect(events[0].detail.dueDate).toBeUndefined();
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

  it('Enter key blurs the input for a new goal (quick-add, does not close)', () => {
    const el = mount();
    const modal = el.shadowRoot.querySelector('#modal');
    const input = el.shadowRoot.querySelector('#input');
    el.open(null);
    input.focus();
    input.value = 'Fresh goal';
    const blurSpy = vi.spyOn(input, 'blur');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(blurSpy).toHaveBeenCalled();
    expect(modal.close).not.toHaveBeenCalled();
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

// ── hide-time snapshot ──────────────────────────────────────────────────────────

const SNAPSHOT_KEY = 'telos:snapshot.new-goal';
function snapshotKey(id) { return `${SNAPSHOT_KEY}:${id}`; }

function markOpen(el) {
  const d = el.shadowRoot.querySelector('#modal').shadowRoot.querySelector('dialog');
  if (d) d.open = true;
}
function hidePage() {
  window.dispatchEvent(new Event('pagehide'));
}

const EXISTING_GOAL = { id: 'g1', title: 'Real goal', tracking: { type: 'percentage', value: 0 } };

describe('goal-dialog — hide-time snapshot', () => {
  // ── new goal ──
  it('snapshots a titleless new goal that has notes on hide, keyed by year+section', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    markOpen(el);
    el.shadowRoot.querySelector('#desc-input').value = 'Some idea';
    hidePage();
    const snap = JSON.parse(localStorage.getItem(snapshotKey('new:2026:capstone')));
    expect(snap.notes).toBe('Some idea');
  });

  it('restores title and notes on the next new open in the same year+section', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'T', notes: 'N', tags: ['health'] }));
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('T');
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('N');
  });

  it('does not restore a new-goal draft when opening a different year', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'For 2026' }));
    const el = mount();
    el.currentYear = 2027;
    el.open(null);
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
  });

  it('does not restore a new-goal draft when opening a different section', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'For capstone' }));
    const el = mount();
    el.currentYear = 2026;
    el.open(null, { year: '2026', section: 'wow' });
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
  });

  it('does not restore a new-goal draft when opening an existing goal', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'Snap' }));
    const el = mount();
    el.currentYear = 2026;
    el.open(EXISTING_GOAL);
    expect(el.shadowRoot.querySelector('#input').value).toBe('Real goal');
  });

  it('does not write a snapshot for an empty new goal on hide', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    markOpen(el);
    hidePage();
    expect(localStorage.getItem(snapshotKey('new:2026:capstone'))).toBeNull();
  });

  it('clears the snapshot when the new goal is committed', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    markOpen(el);
    el.shadowRoot.querySelector('#input').value = 'Run a marathon';
    hidePage();
    expect(localStorage.getItem(snapshotKey('new:2026:capstone'))).not.toBeNull();
    el.shadowRoot.querySelector('#modal').close(); // title present → commits → clears
    expect(localStorage.getItem(snapshotKey('new:2026:capstone'))).toBeNull();
  });

  it('preserves a titleless new goal on close instead of discarding it', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    markOpen(el);
    el.shadowRoot.querySelector('#desc-input').value = 'Idea without a title';
    el.shadowRoot.querySelector('#modal').close(); // no title → capture
    const snap = JSON.parse(localStorage.getItem(snapshotKey('new:2026:capstone')));
    expect(snap.notes).toBe('Idea without a title');
  });

  // ── existing goal ──
  it('snapshots an existing goal with an unsaved title edit on hide, keyed by id', () => {
    const el = mount();
    el.open(EXISTING_GOAL);
    markOpen(el);
    el.shadowRoot.querySelector('#input').value = 'Real goal (edited)';
    hidePage();
    const snap = JSON.parse(localStorage.getItem(snapshotKey('g1')));
    expect(snap.title).toBe('Real goal (edited)');
  });

  it('does not snapshot an existing goal with no unsaved edit on hide', () => {
    const el = mount();
    el.open(EXISTING_GOAL);
    markOpen(el);
    hidePage();
    expect(localStorage.getItem(snapshotKey('g1'))).toBeNull();
  });

  it('shows the stored record, not a pending draft, when reopening an existing goal', () => {
    // A draft must never silently overwrite an already-committed value — it's
    // only reachable via the draft-toggle button (see the toggle tests below).
    localStorage.setItem(snapshotKey('g1'), JSON.stringify({ title: 'Pending', notes: '', tags: [] }));
    const el = mount();
    el.open(EXISTING_GOAL);
    expect(el.shadowRoot.querySelector('#input').value).toBe(EXISTING_GOAL.title);
  });

  it('does not restore an existing-goal snapshot when opening a different goal', () => {
    localStorage.setItem(snapshotKey('g1'), JSON.stringify({ title: 'Pending', notes: '', tags: [] }));
    const el = mount();
    el.open({ id: 'g2', title: 'Another goal', tracking: { type: 'percentage', value: 0 } });
    expect(el.shadowRoot.querySelector('#input').value).toBe('Another goal');
  });

  it('clears the snapshot when an edited existing goal is closed', () => {
    const el = mount();
    el.open(EXISTING_GOAL);
    markOpen(el);
    el.shadowRoot.querySelector('#input').value = 'Edited';
    hidePage();
    expect(localStorage.getItem(snapshotKey('g1'))).not.toBeNull();
    el.shadowRoot.querySelector('#modal').close(); // existing close → clear
    expect(localStorage.getItem(snapshotKey('g1'))).toBeNull();
  });

  it('a draft for one year is not overwritten by a draft captured for a different year', () => {
    const el1 = mount();
    el1.currentYear = 2026;
    el1.open(null);
    markOpen(el1);
    el1.shadowRoot.querySelector('#desc-input').value = 'for 2026';
    hidePage();

    const el2 = mount();
    el2.currentYear = 2027;
    el2.open(null);
    markOpen(el2);
    el2.shadowRoot.querySelector('#desc-input').value = 'for 2027';
    hidePage();

    expect(JSON.parse(localStorage.getItem(snapshotKey('new:2026:capstone'))).notes).toBe('for 2026');
    expect(JSON.parse(localStorage.getItem(snapshotKey('new:2027:capstone'))).notes).toBe('for 2027');
  });
});

// ── draft recovery toggle ───────────────────────────────────────────────────

describe('goal-dialog — draft recovery toggle', () => {
  it('hides the toggle button when no draft was restored', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').hidden).toBe(true);
  });

  it('hides the toggle button when the stored draft belongs to a different year', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'Draft goal' }));
    const el = mount();
    el.currentYear = 2027;
    el.open(null);
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').hidden).toBe(true);
  });

  it('shows a Clear toggle when a draft is restored into a new goal', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'Draft goal', notes: 'Draft notes', tags: [] }));
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    expect(btn.hidden).toBe(false);
    expect(btn.textContent).toBe('Clear');
  });

  it('clicking Clear blanks the form and flips the button to Undo', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'Draft goal', notes: 'Draft notes', tags: [] }));
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    el.shadowRoot.querySelector('#draft-toggle-btn').click();
    expect(el.shadowRoot.querySelector('#input').value).toBe('');
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('');
    expect(el.shadowRoot.querySelector('#draft-toggle-btn').textContent).toBe('Undo');
  });

  it('clicking Undo after Clear restores the draft again', () => {
    localStorage.setItem(snapshotKey('new:2026:capstone'), JSON.stringify({ title: 'Draft goal', notes: 'Draft notes', tags: [] }));
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    btn.click(); // Clear
    btn.click(); // Undo
    expect(el.shadowRoot.querySelector('#input').value).toBe('Draft goal');
    expect(el.shadowRoot.querySelector('#desc-input').value).toBe('Draft notes');
    expect(btn.textContent).toBe('Clear');
  });

  it('shows a "Restore draft" toggle, pending-styled, when a draft exists for an existing goal', () => {
    localStorage.setItem(snapshotKey('g1'), JSON.stringify({ title: 'Edited', notes: 'Edited notes', tags: [] }));
    const el = mount();
    el.open(EXISTING_GOAL);
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    expect(btn.hidden).toBe(false);
    expect(btn.textContent).toBe('Restore draft');
    expect(btn.classList.contains('has-pending-draft')).toBe(true);
    // Form still shows the real stored record, not the draft, until the button is tapped.
    expect(el.shadowRoot.querySelector('#input').value).toBe(EXISTING_GOAL.title);
  });

  it('clicking "Restore draft" previews the draft, and clicking Revert goes back — same button, both directions', () => {
    localStorage.setItem(snapshotKey('g1'), JSON.stringify({ title: 'Edited', notes: 'Edited notes', tags: [] }));
    const el = mount();
    el.open(EXISTING_GOAL);
    const btn = el.shadowRoot.querySelector('#draft-toggle-btn');
    btn.click(); // Restore draft → preview
    expect(el.shadowRoot.querySelector('#input').value).toBe('Edited');
    expect(btn.textContent).toBe('Revert');
    btn.click(); // Revert → back to stored
    expect(el.shadowRoot.querySelector('#input').value).toBe(EXISTING_GOAL.title);
    expect(btn.textContent).toBe('Restore draft');
  });

  it('does not store a _savedAt field any more (TTL removed)', () => {
    const el = mount();
    el.currentYear = 2026;
    el.open(null);
    markOpen(el);
    el.shadowRoot.querySelector('#desc-input').value = 'notes only';
    hidePage();
    const snap = JSON.parse(localStorage.getItem(snapshotKey('new:2026:capstone')));
    expect(snap._savedAt).toBeUndefined();
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

});

describe('goal-dialog — more actions (⋯ menu)', () => {
  it('menu button is visible even when opened with no goal (new goal) — the deadline toggle must be reachable while creating', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
  });

  it('menu button is visible when opened with an existing goal', () => {
    const el = mount();
    el.open({ id: '1', title: 'My goal' });
    expect(el.shadowRoot.querySelector('#menu-btn').hidden).toBe(false);
  });

  it('clicking menu button calls show() on the action sheet', () => {
    const el = mount();
    const sheet = el.shadowRoot.querySelector('#action-sheet');
    el.open({ id: '1', title: 'My goal' });
    el.shadowRoot.querySelector('#menu-btn').click();
    expect(sheet.show).toHaveBeenCalledOnce();
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
  // Chip rendering/a11y itself is covered exhaustively by tag-input.test.js —
  // this just checks goal-dialog wires goal.tags into <tag-input> correctly.
  it('tag chip has aria-label containing the tag name', () => {
    const el = mount();
    el.open({ id: '1', title: 'Run a 5k', tags: ['health', 'fitness'] });
    const chips = el.shadowRoot.querySelector('#tag-input').shadowRoot.querySelectorAll('.tag-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute('aria-label')).toContain('health');
    expect(chips[1].getAttribute('aria-label')).toContain('fitness');
  });
});

describe('goal-dialog — share markdown', () => {
  const goal = { id: '1', title: 'Run a 5k', notes: 'My desc', tags: [], tracking: { type: 'percentage', value: 40 } };

  it('dispatches goal-export-request with the current goal on Share Markdown', () => {
    const el = mount();
    el.open(goal);
    const events = [];
    el.addEventListener('goal-export-request', e => events.push(e));
    el.shadowRoot.querySelector('#action-export-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal).toEqual(goal);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('closes the action sheet and the modal on Share Markdown', () => {
    const el = mount();
    el.open(goal);
    el.shadowRoot.querySelector('#action-export-btn').click();
    expect(el.shadowRoot.querySelector('#action-sheet').close).toHaveBeenCalled();
    expect(el.shadowRoot.querySelector('#modal').close).toHaveBeenCalled();
  });
});

describe('goal-dialog — share goal', () => {
  const goal = { id: '1', title: 'Run a 5k', notes: 'My desc', tags: [], tracking: { type: 'percentage', value: 40 } };

  it('dispatches goal-share-request with the current goal on Share', () => {
    const el = mount();
    el.open(goal);
    const events = [];
    el.addEventListener('goal-share-request', e => events.push(e));
    el.shadowRoot.querySelector('#action-share-btn').click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal).toEqual(goal);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
  });

  it('closes the action sheet and the modal on Share', () => {
    const el = mount();
    el.open(goal);
    el.shadowRoot.querySelector('#action-share-btn').click();
    expect(el.shadowRoot.querySelector('#action-sheet').close).toHaveBeenCalled();
    expect(el.shadowRoot.querySelector('#modal').close).toHaveBeenCalled();
  });
});

describe('goal-dialog — type selector (new goal only)', () => {
  function pill(el, type) {
    return el.shadowRoot.querySelector(`.type-pill[data-type="${type}"]`);
  }
  function create(el, detail = {}) {
    el.open(null);
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = detail.title ?? 'New goal';
    el.shadowRoot.querySelector('#modal').close();
    return events;
  }

  it('defaults to percentage — no target block, pill-group visible for a new goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#type-pills').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#type-locked').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(true);
    expect(pill(el, 'percentage').getAttribute('aria-checked')).toBe('true');
  });

  it('selecting weekly reveals the target block with the default target', () => {
    const el = mount();
    el.open(null);
    pill(el, 'weekly').click();
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#target-value').textContent).toBe('3');
    expect(el.shadowRoot.querySelector('#everyday-chip').hidden).toBe(false);
  });

  it('selecting monthly reveals the target block, no Every-day preset', () => {
    const el = mount();
    el.open(null);
    pill(el, 'monthly').click();
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#target-value').textContent).toBe('4');
    expect(el.shadowRoot.querySelector('#everyday-chip').hidden).toBe(true);
  });

  it('stepper increments/decrements and clamps to TARGET_LIMITS.weekly (1–7)', () => {
    const el = mount();
    el.open(null);
    pill(el, 'weekly').click();
    const down = el.shadowRoot.querySelector('#target-down');
    const up   = el.shadowRoot.querySelector('#target-up');
    for (let i = 0; i < 5; i++) down.click(); // 3 -> 1, then clamps
    expect(el.shadowRoot.querySelector('#target-value').textContent).toBe('1');
    expect(down.disabled).toBe(true);
    for (let i = 0; i < 10; i++) up.click(); // clamps at 7
    expect(el.shadowRoot.querySelector('#target-value').textContent).toBe('7');
    expect(up.disabled).toBe(true);
  });

  it('Every-day preset sets weekly target to 7 and shows as active', () => {
    const el = mount();
    el.open(null);
    pill(el, 'weekly').click();
    el.shadowRoot.querySelector('#everyday-chip').click();
    expect(el.shadowRoot.querySelector('#target-value').textContent).toBe('7');
    expect(el.shadowRoot.querySelector('#everyday-chip').getAttribute('aria-pressed')).toBe('true');
  });

  it('switching back to percentage hides the target block again', () => {
    const el = mount();
    el.open(null);
    pill(el, 'weekly').click();
    pill(el, 'percentage').click();
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(true);
    expect(pill(el, 'percentage').getAttribute('aria-checked')).toBe('true');
    expect(pill(el, 'weekly').getAttribute('aria-checked')).toBe('false');
  });

  it('goal-created carries a percentage tracking object by default', () => {
    const el = mount();
    const events = create(el);
    expect(events[0].detail.tracking).toEqual({ type: 'percentage', value: 0 });
  });

  it('goal-created carries the selected weekly type/target with empty entries', () => {
    const el = mount();
    el.open(null);
    pill(el, 'weekly').click();
    el.shadowRoot.querySelector('#target-up').click(); // 3 -> 4
    const events = [];
    el.addEventListener('goal-created', e => events.push(e));
    el.shadowRoot.querySelector('#input').value = 'Move my body';
    el.shadowRoot.querySelector('#modal').close();
    expect(events[0].detail.tracking).toEqual({ type: 'weekly', target: 4, entries: [] });
  });

  it('resets to percentage default after a quick-add commit (Enter) starts the next entry', () => {
    const el = mount();
    el.open(null);
    pill(el, 'monthly').click();
    const input = el.shadowRoot.querySelector('#input');
    input.value = 'First goal';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el.shadowRoot.querySelector('#type-pills').hidden).toBe(false);
    expect(pill(el, 'percentage').getAttribute('aria-checked')).toBe('true');
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(true);
  });

  it('type is locked (no pill group) once viewing an existing goal', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 } });
    expect(el.shadowRoot.querySelector('#type-pills').hidden).toBe(true);
    expect(el.shadowRoot.querySelector('#type-locked').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#target-block').hidden).toBe(true);
  });

  it('locked label shows type and target for an existing frequency goal', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 5, entries: [] } });
    expect(el.shadowRoot.querySelector('#type-locked-label').textContent).toContain('5');
  });
});

describe('goal-dialog — Fix a day (frequency goals only)', () => {
  it('the Fix-a-day menu item is hidden for a percentage goal', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'percentage', value: 0 } });
    expect(el.shadowRoot.querySelector('#action-fixday-btn').hidden).toBe(true);
  });

  it('the Fix-a-day menu item is hidden for a brand-new (unsaved) goal', () => {
    const el = mount();
    el.open(null);
    expect(el.shadowRoot.querySelector('#action-fixday-btn').hidden).toBe(true);
  });

  it('the Fix-a-day menu item is visible for an existing frequency goal', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'monthly', target: 4, entries: [] } });
    expect(el.shadowRoot.querySelector('#action-fixday-btn').hidden).toBe(false);
  });

  it('opens the fix-day view and renders 14 day chips', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 3, entries: [] } });
    el.shadowRoot.querySelector('#action-fixday-btn').click();
    expect(el.shadowRoot.querySelector('#view-fixday').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(true);
    expect(el.shadowRoot.querySelectorAll('#fixday-chips .day-chip')).toHaveLength(14);
  });

  it('back returns to the main view', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 3, entries: [] } });
    el.shadowRoot.querySelector('#action-fixday-btn').click();
    el.shadowRoot.querySelector('#fixday-back').click();
    expect(el.shadowRoot.querySelector('#view-main').hidden).toBe(false);
    expect(el.shadowRoot.querySelector('#view-fixday').hidden).toBe(true);
  });

  it('marks the chip for an already-logged date as pressed', () => {
    const el = mount();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 3, entries: [iso] } });
    el.shadowRoot.querySelector('#action-fixday-btn').click();
    const chips = [...el.shadowRoot.querySelectorAll('#fixday-chips .day-chip')];
    const todayChip = chips.find(c => c.dataset.iso === iso);
    expect(todayChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking a chip dispatches goal-entry-toggle with the goal and iso', () => {
    const el = mount();
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 3, entries: [] } });
    el.shadowRoot.querySelector('#action-fixday-btn').click();
    const events = [];
    el.addEventListener('goal-entry-toggle', e => events.push(e));
    const chip = el.shadowRoot.querySelector('#fixday-chips .day-chip');
    chip.click();
    expect(events).toHaveLength(1);
    expect(events[0].detail.goal.id).toBe('g1');
    expect(events[0].detail.iso).toBe(chip.dataset.iso);
  });

  it('clicking an already-logged chip flips aria-pressed back to false', () => {
    const el = mount();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    el.open({ id: 'g1', title: 'X', tracking: { type: 'weekly', target: 3, entries: [iso] } });
    el.shadowRoot.querySelector('#action-fixday-btn').click();
    const chip = [...el.shadowRoot.querySelectorAll('#fixday-chips .day-chip')].find(c => c.dataset.iso === iso);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });
});

