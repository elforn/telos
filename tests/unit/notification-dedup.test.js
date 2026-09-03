import { describe, it, expect, beforeEach } from 'vitest';
import { lastNotifiedDate, markNotifiedToday } from '../../app/utils/notification-dedup.js';

// The module's DB name ('telos-notifications') is fixed, not parametrized
// per test (unlike the main store's own freshName() pattern in
// home-page.test.js etc.) — delete it before each test so results here
// never depend on what an earlier test in this run left behind.
beforeEach(() => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase('telos-notifications');
  req.onsuccess = resolve;
  req.onerror = () => reject(req.error);
  req.onblocked = resolve; // best-effort — nothing else should still hold it open between tests
}));

describe('notification-dedup', () => {
  it('returns null when nothing has ever been recorded', async () => {
    expect(await lastNotifiedDate()).toBeNull();
  });

  it('markNotifiedToday persists a date that lastNotifiedDate then returns', async () => {
    await markNotifiedToday('2026-08-10');
    expect(await lastNotifiedDate()).toBe('2026-08-10');
  });

  it('a later markNotifiedToday overwrites the earlier one, not appends', async () => {
    await markNotifiedToday('2026-08-10');
    await markNotifiedToday('2026-08-11');
    expect(await lastNotifiedDate()).toBe('2026-08-11');
  });
});
