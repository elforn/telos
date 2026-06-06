import { describe, it, expect } from 'vitest';
import { openDB } from './idb.js';
import { runMigrations, CURRENT_VERSION } from './migrations.js';

let dbSeq = 0;
function freshName() { return `test-migrations-${dbSeq++}`; }

async function openMigrated(name) {
  return openDB(name, CURRENT_VERSION, runMigrations);
}

describe('runMigrations', () => {
  it('creates the events object store', async () => {
    const db = await openMigrated(freshName());
    expect(db.objectStoreNames.contains('events')).toBe(true);
    db.close();
  });

  it('events store uses id as keyPath', async () => {
    const db = await openMigrated(freshName());
    const keyPath = db.transaction('events', 'readonly').objectStore('events').keyPath;
    expect(keyPath).toBe('id');
    db.close();
  });

  it('creates the by_recordedAt index', async () => {
    const db = await openMigrated(freshName());
    const hasIndex = db.transaction('events', 'readonly').objectStore('events').indexNames.contains('by_recordedAt');
    expect(hasIndex).toBe(true);
    db.close();
  });

  it('is a no-op when oldVersion equals newVersion', async () => {
    const db = await openMigrated(freshName());
    expect(() => runMigrations(db, CURRENT_VERSION, CURRENT_VERSION)).not.toThrow();
    db.close();
  });

  it('creates the images object store', async () => {
    const db = await openMigrated(freshName());
    expect(db.objectStoreNames.contains('images')).toBe(true);
    db.close();
  });

  it('images store uses id as keyPath', async () => {
    const db = await openMigrated(freshName());
    const keyPath = db.transaction('images', 'readonly').objectStore('images').keyPath;
    expect(keyPath).toBe('id');
    db.close();
  });

  it('throws for an undefined migration version', () => {
    const db = { createObjectStore: () => {} };
    expect(() => runMigrations(db, 98, 99)).toThrow('No migration defined for schema version 99');
  });

});
