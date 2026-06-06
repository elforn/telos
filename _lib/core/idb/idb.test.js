import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, put, get, del, getAll } from './idb.js';

let dbSeq = 0;
function freshName() { return `test-idb-${dbSeq++}`; }

describe('openDB', () => {
  it('opens a database at the requested version', async () => {
    const db = await openDB(freshName(), 1, () => {});
    expect(db.version).toBe(1);
    db.close();
  });

  it('calls onUpgrade with (db, oldVersion, newVersion) on first open', async () => {
    let captured = null;
    const db = await openDB(freshName(), 1, (db, old, next) => {
      captured = { old, next };
    });
    expect(captured).toEqual({ old: 0, next: 1 });
    db.close();
  });

  it('rejects when onUpgrade throws', async () => {
    await expect(
      openDB(freshName(), 1, () => { throw new Error('bad migration'); })
    ).rejects.toThrow('bad migration');
  });
});

describe('openDB — upgrade behaviour', () => {
  it('does not call onUpgrade when reopening at the same version', async () => {
    const name = freshName();
    let calls = 0;
    const db1 = await openDB(name, 1, () => { calls++; });
    db1.close();
    const db2 = await openDB(name, 1, () => { calls++; });
    db2.close();
    expect(calls).toBe(1);
  });
});

describe('put and getAll', () => {
  let db;
  beforeEach(async () => {
    db = await openDB(freshName(), 1, db => {
      db.createObjectStore('items', { keyPath: 'id' });
    });
  });

  it('stores a record and retrieves it with getAll', async () => {
    await put(db, 'items', { id: '1', value: 'hello' });
    const results = await getAll(db, 'items');
    expect(results).toEqual([{ id: '1', value: 'hello' }]);
  });

  it('getAll returns empty array when store is empty', async () => {
    const results = await getAll(db, 'items');
    expect(results).toEqual([]);
  });

  it('put overwrites a record with the same key', async () => {
    await put(db, 'items', { id: '1', value: 'first' });
    await put(db, 'items', { id: '1', value: 'second' });
    const results = await getAll(db, 'items');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('second');
  });

  it('put resolves with the stored key', async () => {
    const key = await put(db, 'items', { id: 'mykey', value: 'x' });
    expect(key).toBe('mykey');
  });
});

describe('get', () => {
  let db;
  beforeEach(async () => {
    db = await openDB(freshName(), 1, db => {
      db.createObjectStore('items', { keyPath: 'id' });
    });
  });

  it('retrieves a stored record by id', async () => {
    await put(db, 'items', { id: 'a', value: 'hello' });
    const result = await get(db, 'items', 'a');
    expect(result).toEqual({ id: 'a', value: 'hello' });
  });

  it('returns null for a missing id', async () => {
    const result = await get(db, 'items', 'missing');
    expect(result).toBeNull();
  });
});

describe('del', () => {
  let db;
  beforeEach(async () => {
    db = await openDB(freshName(), 1, db => {
      db.createObjectStore('items', { keyPath: 'id' });
    });
  });

  it('removes a record by id', async () => {
    await put(db, 'items', { id: 'a', value: 'hello' });
    await del(db, 'items', 'a');
    const results = await getAll(db, 'items');
    expect(results).toHaveLength(0);
  });

  it('is a no-op for a missing id', async () => {
    await expect(del(db, 'items', 'missing')).resolves.toBeUndefined();
  });
});
