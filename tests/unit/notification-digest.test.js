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

describe('notification-digest — buildDigest hiddenCount', () => {
  it('defaults to no hidden clause when the argument is omitted', () => {
    const digest = buildDigest({ overdue: [item('a')], today: [], tomorrow: [] });
    expect(digest.body).toBe('Overdue (1)');
  });

  it('appends a hidden clause when the digest is already firing', () => {
    const digest = buildDigest({ overdue: [item('a')], today: [], tomorrow: [] }, 3);
    expect(digest.body).toBe('Overdue (1) · 3 hidden');
  });

  it('hiddenCount of 0 adds nothing to the body', () => {
    const digest = buildDigest({ overdue: [item('a')], today: [], tomorrow: [] }, 0);
    expect(digest.body).toBe('Overdue (1)');
  });
});

describe('notification-digest — buildDigest, hidden-only fallback (total is 0 but hiddenCount is not)', () => {
  it('still returns null when both total and hiddenCount are 0', () => {
    expect(buildDigest({ overdue: [], today: [], tomorrow: [] }, 0)).toBeNull();
  });

  it('fires a minimal digest naming only the hidden count — the sole remaining path to the Hidden-items modal when nothing else is visible', () => {
    const digest = buildDigest({ overdue: [], today: [], tomorrow: [] }, 5);
    expect(digest).not.toBeNull();
    expect(digest.title).toBe('5 hidden');
    expect(digest.body).toBe('Tap to review');
  });

  it('does not use the normal per-bucket title/body shape in this fallback', () => {
    const digest = buildDigest({ overdue: [], today: [], tomorrow: [] }, 2);
    expect(digest.title).not.toContain('need attention');
    expect(digest.body).not.toContain('Overdue');
  });
});
