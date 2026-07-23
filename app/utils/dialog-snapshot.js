// One-shot form snapshot for the creation/edit dialogs (list / goal / item).
//
// Nothing is written while you type. A snapshot is written only when the page
// is hidden or unloaded (reload, tab switch, PWA backgrounding) with a dialog
// open, or when a new entry that can't be committed yet (content but no title)
// is closed. Each distinct record gets its own localStorage key (real id for
// an existing record, a context key like `new:${listId}` for a not-yet-created
// one) — so a draft for one record/context is never overwritten by a draft
// captured for a different one, and is applied once on the next open of that
// same record/context.
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

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function clear(key) {
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Wire hide/unload snapshot persistence onto a dialog (an AppElement).
 *
 * @param {AppElement} el  the dialog element (uses its auto-cleanup `listen`)
 * @param {object} opts
 * @param {string}          opts.key       localStorage key prefix for this dialog — combined
 *                          with recordId() to give each record/context its own key
 * @param {() => boolean}   opts.isOpen    is the modal currently shown
 * @param {() => (string|null)} opts.recordId  id of the record being edited, or a context key
 *                          (e.g. `new:${listId}`) for a not-yet-created entry
 * @param {() => (object|null)} opts.snapshot   current form state to keep, or null when there's nothing worth keeping
 * @param {(data: object) => void} opts.restore  apply a restored snapshot to the form
 * @returns {{ capture: () => void, restoreFor: () => (object|null), clear: () => void }}
 *   capture()   — snapshot now (or clear if empty). Called on hide, and by the dialog when closing a
 *                 new entry that can't be committed yet.
 *   restoreFor() — from open(): apply the snapshot for the current recordId(), if any. Returns the
 *                 restored data (so the caller can keep it for a Clear/Revert ⇄ Undo toggle), or
 *                 null if there was nothing to restore.
 *   clear()     — drop the snapshot (on commit, or when an edited record's dialog closes).
 */
export function installDialogSnapshot(el, { key, isOpen, recordId, snapshot, restore }) {
  const storageKey = () => `${key}:${recordId() ?? ''}`;

  const capture = () => {
    const data = snapshot();
    if (data) write(storageKey(), data);
    else clear(storageKey());
  };

  const onHide = () => { if (isOpen()) capture(); };
  el.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); });
  el.listen(window, 'pagehide', onHide);

  return {
    capture,
    restoreFor() {
      const data = read(storageKey());
      if (!data) return null;
      restore(data);
      return data;
    },
    clear() { clear(storageKey()); },
  };
}
