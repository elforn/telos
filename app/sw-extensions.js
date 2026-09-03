// Appended verbatim onto the generated service worker by utils/build.js
// (mirrors how utils/extra-assets.js is the optional app-level extension
// point for the asset list — this is the same idea for sw.js itself).
// Plain JS, no imports/exports: _lib/core/sw-manager/sw-manager.js (owned
// by Socle, not editable here) registers the service worker without
// `{ type: 'module' }`, so this file runs as a classic script sharing the
// same global scope as everything above it in the generated sw.js —
// BASE_PATH is already in scope from there, no need to redeclare it.
//
// Chrome-only, best-effort background layer for the day-before/today/
// overdue notification digest — periodicSync only exists on Chromium
// (installed PWAs), and even there the *browser* decides actual firing
// cadence, not this code; there is no guaranteed timing. The foreground
// half (app/components/due-date-notifier/) is the reliable, universal
// mechanism that works on every browser; this is purely an enhancement on
// top for "maybe get notified without opening the app at all."
//
// Deliberately dueDate-only, NOT the fuller frequency-pace-aware urgency
// app/utils/frequency-urgency.js computes in the page — being a classic
// script, this file can't import that module, and duplicating (then
// maintaining, twice) that whole system here isn't worth it for a layer
// that's already just "best-effort." A plain dueDate check covers the
// common case without that ongoing cost.

const TELOS_DB = 'telos';
const NOTIF_DB = 'telos-notifications';
const DIGEST_TAG = 'telos-due-date-check';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whole days from todayIso until iso (negative if in the past) — same
// local-calendar-parts approach as app/utils/urgency.js's daysUntil, to
// avoid new Date(iso) landing on the wrong day (that constructor is UTC).
function daysUntil(iso, todayIso) {
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = iso.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const due = new Date(dy, dm - 1, dd);
  return Math.round((due - today) / 86400000);
}

function bucketOf(dueDate, active, todayIso) {
  if (!dueDate || !active) return 'none';
  if (dueDate < todayIso) return 'overdue'; // lexical compare == chronological for YYYY-MM-DD
  if (dueDate === todayIso) return 'today';
  return daysUntil(dueDate, todayIso) === 1 ? 'tomorrow' : 'none';
}

// Frequency types (weekly/monthly/decreasing) don't carry a simple flat
// percentage — this file doesn't replicate tracking.js's real
// percentValue() (see the module doc above), so anything without a plain
// `value` is just treated as active. Erring toward "still active" only
// risks one extra notification for an unusual dueDate-on-a-frequency-goal
// combination, never a missed one.
function isActive(goal) {
  return goal?.tracking?.type === 'percentage' ? (goal.tracking.value ?? 0) < 100 : true;
}

function collectDueDateUpcoming(state, todayIso) {
  const overdue = [];
  const today = [];
  const tomorrow = [];
  const sections = ['capstone', 'milestones', 'wow', 'focus'];

  for (const yearGoals of Object.values(state?.goals ?? {})) {
    for (const section of sections) {
      for (const goal of yearGoals?.[section] ?? []) {
        if (goal.archived) continue;
        const bucket = bucketOf(goal.dueDate, isActive(goal), todayIso);
        if (bucket === 'overdue') overdue.push(goal);
        else if (bucket === 'today') today.push(goal);
        else if (bucket === 'tomorrow') tomorrow.push(goal);
      }
    }
  }

  for (const list of state?.lists ?? []) {
    for (const item of list.items ?? []) {
      const active = item.status !== 'done' && item.status !== 'closed';
      const bucket = bucketOf(item.dueDate, active, todayIso);
      if (bucket === 'overdue') overdue.push(item);
      else if (bucket === 'today') today.push(item);
      else if (bucket === 'tomorrow') tomorrow.push(item);
    }
  }

  return { overdue, today, tomorrow };
}

// Same shape/contract as app/utils/notification-dedup.js's own open() —
// kept in sync manually since this file can't import that module. Handles
// onupgradeneeded itself (unlike a plain read) so whichever side — this
// background check or the foreground page — happens to open this database
// first still creates the store correctly for the other.
function openNotifDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOTIF_DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('meta', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readMainState() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TELOS_DB, 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) { db.close(); resolve(null); return; }
      const tx = db.transaction('state', 'readonly');
      const getReq = tx.objectStore('state').get('root');
      getReq.onsuccess = () => { db.close(); resolve(getReq.result?.data ?? null); };
      getReq.onerror = () => { db.close(); reject(getReq.error); };
    };
    req.onerror = () => reject(req.error);
    // Deliberately no onupgradeneeded — the app's own boot() (_lib/core/
    // store/store.js) always creates this database first; periodicSync
    // registration itself only ever happens from a foreground settings
    // toggle, so by the time this can fire, boot() has already run at
    // least once.
  });
}

async function checkDueDatesInBackground() {
  const today = todayISO();

  const notifDb = await openNotifDB();
  const lastRecord = await new Promise((resolve, reject) => {
    const tx = notifDb.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get('digest');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  notifDb.close();
  if (lastRecord?.lastNotifiedDate === today) return; // already notified today, foreground or background

  const state = await readMainState();
  if (!state) return; // app never booted yet — nothing to check

  const buckets = collectDueDateUpcoming(state, today);
  const total = buckets.overdue.length + buckets.today.length + buckets.tomorrow.length;
  if (total === 0) return;

  // Plain English only — this file can't reach app/strings.js's t() (see
  // the module doc above), so unlike the foreground digest this one isn't
  // localized. In practice that only matters while the app itself isn't
  // open to show the localized version instead.
  const parts = [];
  if (buckets.overdue.length)  parts.push(`Overdue (${buckets.overdue.length})`);
  if (buckets.today.length)    parts.push(`Due today (${buckets.today.length})`);
  if (buckets.tomorrow.length) parts.push(`Due tomorrow (${buckets.tomorrow.length})`);

  await self.registration.showNotification(`${total} items need attention`, {
    body: parts.join(' · '),
    tag: 'telos-digest', // same tag the foreground digest uses — replaces rather than stacks
  });

  const writeDb = await openNotifDB();
  await new Promise((resolve, reject) => {
    const tx = writeDb.transaction('meta', 'readwrite');
    const req = tx.objectStore('meta').put({ id: 'digest', lastNotifiedDate: today });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  writeDb.close();
}

self.addEventListener('periodicsync', event => {
  if (event.tag === DIGEST_TAG) event.waitUntil(checkDueDatesInBackground());
});

// Cold-launch handling: the app might be fully closed, not just
// backgrounded, when a notification is tapped. If a window is already
// open, message it to open the Upcoming dialog directly rather than just
// focusing it on whatever page it happened to be on; otherwise open a new
// one with a query param the app's own boot logic reads once (see
// app/main.js) to do the same.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
      const existing = clientsList.find(c => 'focus' in c);
      if (existing) {
        existing.postMessage({ type: 'telos-open-upcoming' });
        return existing.focus();
      }
      return self.clients.openWindow(`${BASE_PATH}?upcoming=1`);
    })
  );
});
