// Dedup state for an at-most-once-per-day notification, kept in its own IDB
// database — never inside the app's main store. A background write racing
// the page's own store read-modify-write cycle (setState always persists the
// full in-memory snapshot, see core/store/store.js) would be a lossy race;
// a separate database with a single record sidesteps it entirely. It also
// isn't app data — it has no business surviving into a full backup
// export/import.
//
// dbName is required so multiple apps (or a background layer with no page
// context to share config through) can agree on a fixed contract: same DB
// name, 'meta' store, 'digest' record id, by default.
import { openDB, get, put } from '../../core/idb/idb.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NotificationDedup(dbName, { storeName = 'meta', recordId = 'digest' } = {}) {
  function open() {
    return openDB(dbName, 1, db => db.createObjectStore(storeName, { keyPath: 'id' }));
  }

  return {
    async alreadyNotifiedToday() {
      const db = await open();
      const record = await get(db, storeName, recordId);
      db.close();
      return record?.lastNotifiedDate === todayISO();
    },

    async markNotifiedToday() {
      const db = await open();
      await put(db, storeName, { id: recordId, lastNotifiedDate: todayISO() });
      db.close();
    },
  };
}
