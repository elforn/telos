// A deliberately separate IndexedDB database (not a key inside the main
// 'telos' store) for the one thing the notification digest needs to
// remember: the last calendar day it actually fired a notification. Kept
// apart from the main app state for two reasons:
//
// 1. The main store's setState() always writes the *page's own in-memory*
//    state snapshot back to IDB (see _lib/core/store/store.js) — a raw,
//    out-of-band IDB write to that same record (which is exactly what the
//    Chrome-only background layer's service-worker extension has to do,
//    since it has no page/window context to go through setState()) risks a
//    lost-update race the next time the page itself writes.
// 2. It's bookkeeping, not app data — it has no business surviving into a
//    full-backup export/import, unlike everything mergeStrategy.js covers.
//
// The service-worker extension (app/sw-extensions.js) reads/writes the same
// database directly via raw indexedDB calls — it can't import this module
// (classic, non-`type: module` service worker, see that file's own note) —
// so the shape here (db name, store name, record id/field) is effectively a
// tiny contract between the two. Keep them in sync if either changes.
import { openDB, get, put } from '../../_lib/core/idb/idb.js';

const DB_NAME = 'telos-notifications';
const STORE_NAME = 'meta';
const RECORD_ID = 'digest';

function open() {
  return openDB(DB_NAME, 1, db => db.createObjectStore(STORE_NAME, { keyPath: 'id' }));
}

export async function lastNotifiedDate() {
  const db = await open();
  const record = await get(db, STORE_NAME, RECORD_ID);
  db.close();
  return record?.lastNotifiedDate ?? null;
}

export async function markNotifiedToday(todayIso) {
  const db = await open();
  await put(db, STORE_NAME, { id: RECORD_ID, lastNotifiedDate: todayIso });
  db.close();
}
