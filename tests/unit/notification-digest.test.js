import { describe, it, expect } from 'vitest';
import '../../app/strings.js';
import { buildDigest } from '../../app/utils/notification-digest.js';

const item = (id) => ({ id, title: `Item ${id}` });

describe('notification-digest — buildDigest', () => {
  it('returns null when every bucket is empty — no notification for nothing to report', () => {
    expect(buildDigest({ overdue: [], today: [], tomorrow: [] })).toBeNull();
  });

  it('returns null for missing/undefined buckets too, not just empty arrays', () => {
    expect(buildDigest({})).toBeNull();
  });

  it('titles with the total count across all three buckets', () => {
    const digest = buildDigest({ overdue: [item('a')], today: [item('b'), item('c')], tomorrow: [] });
    expect(digest.title).toBe('3 items need attention');
  });

  it('body includes only the non-empty sections, each with its own count', () => {
    const digest = buildDigest({ overdue: [item('a')], today: [], tomorrow: [item('b'), item('c')] });
    expect(digest.body).toContain('Overdue (1)');
    expect(digest.body).not.toContain('Due today');
    expect(digest.body).toContain('Due tomorrow (2)');
  });

  it('a single item in a single bucket still produces a valid digest', () => {
    const digest = buildDigest({ overdue: [], today: [item('a')], tomorrow: [] });
    expect(digest.title).toBe('1 items need attention'); // no pluralization anywhere in this app — see CLAUDE.md precedent
    expect(digest.body).toBe('Due today (1)');
  });
});
