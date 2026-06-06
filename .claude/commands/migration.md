# /migration

Scaffold a new IDB schema migration.

## Usage
/migration <version> <description>

Example: `/migration 2 add-goal-index`

## What to do

1. **Read `_lib/core/idb/migrations.js`** to understand the existing migration chain and current schema version.

2. **Scaffold the new migration** as an entry in the migrations array:

```js
{
  version: <version>,
  description: '<description>',
  up(db, transaction) {
    // implement upgrade logic here
    // use db.createObjectStore() or transaction.objectStore() as appropriate
    // never delete data in a migration — append-only principle applies here too
  }
}
```

3. **Rules for migrations:**
   - Migrations run on IDB version upgrade, before any UI renders
   - A migration must never delete or overwrite existing records
   - A migration that fails must throw — it will be caught and will halt app startup with a visible error
   - New object stores get the standard event log schema by default:
     `{ keyPath: 'id', autoIncrement: false }` with an index on `recordedAt`
   - If adding an index to an existing store, use the existing transaction, do not recreate the store

4. **Update the schema version constant** in `_lib/core/idb/migrations.js`.

5. **Write a test** in a `migrations.test.js` file that:
   - Runs the migration on a fresh in-memory IDB
   - Verifies the new store or index exists
   - Verifies existing data in previous stores is untouched

6. **Report** what was added, the new schema version, and what the developer needs to fill in (the actual upgrade logic if it requires business context).
