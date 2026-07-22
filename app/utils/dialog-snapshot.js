// One-shot form snapshot for the creation/edit dialogs (list / goal / item).
//
// Nothing is written while you type. A snapshot is written only when the page
// is hidden or unloaded (reload, tab switch, PWA backgrounding) with a dialog
// open, or when a new entry that can't be committed yet (content but no title)
// is closed. It is keyed by the record id (null for a new entry) and applied
// once on the next open of that same record.
//
// Why snapshot rather than commit on the way out: a commit is an async
// IndexedDB write, and a hard reload destroys the page before it flushes —
// the write is lost. localStorage is synchronous, so a snapshot survives.
//
// The boundary is "open vs closed": if a dialog is open when the page dies,
// the reload's own pagehide re-captures the current form, so the snapshot is
// always up to date (no per-keystroke tracking needed). Once a dialog is
// *closed*, the store owns the data and the snapshot is dropped — a committed
// edit that then fails to reach IDB on reload is the store's concern, the same
// as any other write before a reload.

const MAX_AGE_MS = 72 * 60 * 60 * 1000; // ignore snapshots older than 3 days

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed._savedAt || Date.now() - parsed._savedAt > MAX_AGE_MS) { localStorage.removeItem(key); return null; }
    return parsed;
  } catch { return null; }
}

function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ...data, _savedAt: Date.now() })); } catch {}
}

function clear(key) {
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Wire hide/unload snapshot persistence onto a dialog (an AppElement).
 *
 * @param {AppElement} el  the dialog element (uses its auto-cleanup `listen`)
 * @param {object} opts
 * @param {string}          opts.key       localStorage key for this dialog
 * @param {() => boolean}   opts.isOpen    is the modal currently shown
 * @param {() => (string|null)} opts.recordId  id of the record being edited, or null for a new one
 * @param {() => (object|null)} opts.snapshot   current form state to keep, or null when there's nothing worth keeping
 * @param {(data: object) => void} opts.restore  apply a restored snapshot to the form
 * @returns {{ capture: () => void, restoreFor: (record: object|null) => void, clear: () => void }}
 *   capture()   — snapshot now (or clear if empty). Called on hide, and by the dialog when closing a
 *                 new entry that can't be committed yet.
 *   restoreFor(record) — from open(): apply a snapshot only if it belongs to the record being opened.
 *   clear()     — drop the snapshot (on commit, or when an edited record's dialog closes).
 */
export function installDialogSnapshot(el, { key, isOpen, recordId, snapshot, restore }) {
  const capture = () => {
    const data = snapshot();
    if (data) write(key, { id: recordId(), ...data });
    else clear(key);
  };

  const onHide = () => { if (isOpen()) capture(); };
  el.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); });
  el.listen(window, 'pagehide', onHide);

  return {
    capture,
    restoreFor(record) {
      const snap = read(key);
      if (!snap) return;
      if (snap.id !== (record?.id ?? null)) return; // snapshot belongs to a different record
      const { id, _savedAt, ...data } = snap;
      restore(data);
    },
    clear() { clear(key); },
  };
}
