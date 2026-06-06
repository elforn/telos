import { openDB, put, get, getAll, del } from '../idb/idb.js';

let _db = null;
let _state = {};
const _subs = new Map(); // key → Set<callback>

export async function boot({ dbName, initialState = {} } = {}) {
  _db = await openDB(dbName, 1, db => {
    db.createObjectStore('state', { keyPath: 'id' });
    db.createObjectStore('images', { keyPath: 'id' });
  });
  const stored = await get(_db, 'state', 'root');
  _state = { ...initialState, ...(stored?.data ?? {}) };
}

export function setState(key, value) {
  const oldState = _state;
  _state = { ..._state, [key]: value };
  _notify(oldState, _state);
  put(_db, 'state', { id: 'root', data: _state });
}

export function getState() {
  return _state;
}

export function subscribe(key, cb) {
  if (!_subs.has(key)) _subs.set(key, new Set());
  _subs.get(key).add(cb);
  cb(_state[key]);
}

export function unsubscribe(key, cb) {
  _subs.get(key)?.delete(cb);
}

export async function attachBlob(id, blob) {
  if (!_db) throw new Error('Store.attachBlob called before Store.boot');
  return put(_db, 'images', { id, blob });
}

export async function getBlob(id) {
  if (!_db) throw new Error('Store.getBlob called before Store.boot');
  const record = await get(_db, 'images', id);
  return record?.blob ?? null;
}

export async function deleteBlob(id) {
  if (!_db) throw new Error('Store.deleteBlob called before Store.boot');
  return del(_db, 'images', id);
}

// Sync-compatible API — wraps current state as a single exportable event.
// Each call generates a fresh UUID so dedup in importData never suppresses the snapshot.
export async function getAllBlobs() {
  if (!_db) throw new Error('Store.getAllBlobs called before Store.boot');
  return getAll(_db, 'images');
}

export async function getAllEvents() {
  return [{
    id: crypto.randomUUID(),
    deviceId: null,
    recordedAt: Date.now(),
    occurredAt: Date.now(),
    type: 'simple:state',
    payload: _state,
  }];
}

export async function importEvents(events) {
  const snapshot = events.find(e => e.type === 'simple:state');
  if (!snapshot || !_db) return;
  // Write to IDB only — in-memory state and subscribers are not updated.
  // The app must reload for the imported state to take effect (same contract as event-log importEvents).
  await put(_db, 'state', { id: 'root', data: { ..._state, ...snapshot.payload } });
}

export function reset() {
  _db = null;
  _state = {};
  _subs.clear();
}

function _notify(oldState, newState) {
  for (const [key, callbacks] of _subs) {
    if (oldState[key] !== newState[key]) {
      for (const cb of callbacks) cb(newState[key]);
    }
  }
}
