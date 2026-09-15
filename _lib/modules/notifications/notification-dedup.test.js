import { describe, it, expect } from 'vitest';
import { NotificationDedup } from './notification-dedup.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let dbCounter = 0;
function freshDedup(options) {
  return NotificationDedup(`test-notifications-${dbCounter++}`, options);
}

describe('NotificationDedup', () => {
  it('reports not notified when nothing recorded', async () => {
    const dedup = freshDedup();
    expect(await dedup.alreadyNotifiedToday()).toBe(false);
  });

  it('reports notified after marking today', async () => {
    const dedup = freshDedup();
    await dedup.markNotifiedToday();
    expect(await dedup.alreadyNotifiedToday()).toBe(true);
  });

  it('does not report notified for a stale date', async () => {
    const dbName = `test-notifications-${dbCounter++}`;
    const dedup = NotificationDedup(dbName);
    // Write a stale record directly via a second instance sharing the same DB.
    const { openDB, put } = await import('../../core/idb/idb.js');
    const db = await openDB(dbName, 1, d => d.createObjectStore('meta', { keyPath: 'id' }));
    await put(db, 'meta', { id: 'digest', lastNotifiedDate: '2000-01-01' });
    db.close();
    expect(await dedup.alreadyNotifiedToday()).toBe(false);
  });

  it('supports custom store name and record id so multiple digests can coexist', async () => {
    const dbName = `test-notifications-${dbCounter++}`;
    const a = NotificationDedup(dbName, { storeName: 'meta', recordId: 'a' });
    const b = NotificationDedup(dbName, { storeName: 'meta', recordId: 'b' });
    await a.markNotifiedToday();
    expect(await a.alreadyNotifiedToday()).toBe(true);
    expect(await b.alreadyNotifiedToday()).toBe(false);
  });

  it('marks today\'s date, not a stale one', async () => {
    const dedup = freshDedup();
    await dedup.markNotifiedToday();
    const { openDB, get } = await import('../../core/idb/idb.js');
    const db = await openDB(`test-notifications-${dbCounter - 1}`, 1, d => d.createObjectStore('meta', { keyPath: 'id' }));
    const record = await get(db, 'meta', 'digest');
    db.close();
    expect(record.lastNotifiedDate).toBe(todayISO());
  });
});
