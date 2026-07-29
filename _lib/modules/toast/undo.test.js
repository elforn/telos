// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineStrings } from '../../core/strings.js';
import { _resetToast } from './toast.js';
import { withUndo } from './undo.js';

defineStrings({ 'toast.close': '×' });

beforeEach(() => _resetToast());
afterEach(() => _resetToast());

describe('withUndo', () => {
  it('calls apply()', () => {
    const apply = vi.fn();
    withUndo({ getSnapshot: () => null, apply, restore: () => {}, message: 'Done' });
    expect(apply).toHaveBeenCalledOnce();
  });

  it('shows a toast with the given message', () => {
    withUndo({ getSnapshot: () => null, apply: () => {}, restore: () => {}, message: 'Deleted' });
    expect(document.querySelector('.socle-toast-msg').textContent).toBe('Deleted');
  });

  it('renders an undo button with default label "Undo"', () => {
    withUndo({ getSnapshot: () => null, apply: () => {}, restore: () => {}, message: 'Done' });
    const btn = document.querySelector('.socle-toast-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Undo');
  });

  it('respects a custom undoLabel', () => {
    withUndo({ getSnapshot: () => null, apply: () => {}, restore: () => {}, message: 'Done', undoLabel: 'Revert' });
    expect(document.querySelector('.socle-toast-btn').textContent).toBe('Revert');
  });

  it('calls restore with the captured snapshot when undo is clicked', () => {
    const restore = vi.fn();
    const snapshot = { items: [1, 2, 3] };
    withUndo({ getSnapshot: () => snapshot, apply: () => {}, restore, message: 'Done' });
    document.querySelector('.socle-toast-btn').click();
    expect(restore).toHaveBeenCalledWith(snapshot);
  });

  it('captures snapshot before apply runs', () => {
    const calls = [];
    withUndo({
      getSnapshot: () => { calls.push('snapshot'); return 42; },
      apply:       () => { calls.push('apply'); },
      restore:     () => {},
      message:     'Done',
    });
    expect(calls).toEqual(['snapshot', 'apply']);
  });

  it('does not show a toast if apply throws', () => {
    expect(() =>
      withUndo({ getSnapshot: () => null, apply: () => { throw new Error('oops'); }, restore: () => {}, message: 'Done' })
    ).toThrow('oops');
    expect(document.querySelector('.socle-toast')).toBeNull();
  });

  it('does not call restore if apply throws', () => {
    const restore = vi.fn();
    try {
      withUndo({ getSnapshot: () => null, apply: () => { throw new Error('fail'); }, restore, message: 'Done' });
    } catch {}
    expect(restore).not.toHaveBeenCalled();
  });

  it('returns the toast handle', () => {
    const handle = withUndo({ getSnapshot: () => null, apply: () => {}, restore: () => {}, message: 'Done' });
    expect(handle).toHaveProperty('dismiss');
    expect(handle).toHaveProperty('update');
  });

  it('dismiss() on the returned handle removes the toast', () => {
    vi.useFakeTimers();
    const { dismiss } = withUndo({ getSnapshot: () => null, apply: () => {}, restore: () => {}, message: 'Done' });
    dismiss();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.socle-toast')).toBeNull();
    vi.useRealTimers();
  });
});
