import { describe, it, expect, afterEach } from 'vitest';
import { markDelete, isGhostClickAfterDelete, _resetDeleteGuard } from '../../app/utils/delete-ghost-guard.js';

afterEach(() => _resetDeleteGuard());

describe('delete-ghost-guard', () => {
  it('reports a ghost click immediately after a delete', () => {
    markDelete();
    expect(isGhostClickAfterDelete()).toBe(true);
  });

  it('does not report a ghost click when no delete has happened', () => {
    expect(isGhostClickAfterDelete()).toBe(false);
  });

  it('stops reporting once the window has elapsed', () => {
    markDelete();
    expect(isGhostClickAfterDelete(0)).toBe(false); // zero-width window: already past
  });

  it('_resetDeleteGuard clears the recorded delete', () => {
    markDelete();
    _resetDeleteGuard();
    expect(isGhostClickAfterDelete()).toBe(false);
  });
});
