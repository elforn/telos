const migrations = [
  null, // slot 0 — IDB versions start at 1
  db => {
    const store = db.createObjectStore('events', { keyPath: 'id' });
    store.createIndex('by_recordedAt', 'recordedAt');
  },
  db => {
    db.createObjectStore('images', { keyPath: 'id' });
  },
];

export function runMigrations(db, oldVersion, newVersion) {
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    if (!migrations[v]) throw new Error(`No migration defined for schema version ${v}`);
    migrations[v](db);
  }
}

export const CURRENT_VERSION = migrations.length - 1;
