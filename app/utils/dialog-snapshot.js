// One-shot form snapshot for the creation dialogs (new list / goal / item).
//
// Unlike the old per-keystroke draft, nothing is written during normal typing.
// A snapshot is written *only* when the page is hidden or unloaded (reload,
// tab switch, PWA backgrounding) while a creation dialog holds unsaved content,
// and it is consumed exactly once on the next open. This preserves in-progress
// input across an interruption without living on the dialog's hot path.
//
// Why snapshot a NEW record rather than commit it on the way out: committing
// writes to IndexedDB asynchronously, and a hard reload destroys the page
// before that transaction can flush — the record is lost. localStorage is
// synchronous, so a snapshot survives even a reload. On the next open we
// restore it and the user confirms with one tap. For an EXISTING record the
// dialog instead blurs the focused field, letting the normal blur-save commit
// run (best-effort; reliable on backgrounding where the tab keeps running).

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // ignore snapshots older than a day

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { _savedAt, ...data } = JSON.parse(raw);
    if (!_savedAt || Date.now() - _savedAt > MAX_AGE_MS) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ...data, _savedAt: Date.now() })); } catch {}
}

function clear(key) {
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Wire hide/unload persistence onto a creation dialog (an AppElement).
 *
 * @param {AppElement} el  the dialog element (uses its auto-cleanup `listen`)
 * @param {object} opts
 * @param {string}          opts.key       localStorage key for this dialog
 * @param {() => boolean}   opts.isOpen    is the modal currently shown
 * @param {() => boolean}   opts.isNew     is it a new (uncommitted) record
 * @param {() => (object|null)} opts.snapshot  current form state, or null when empty
 * @param {(data: object) => void} opts.restore  apply a restored snapshot to the form
 * @returns {{ restore: () => void, clear: () => void }}
 *   restore() — call from open() for a new record; applies and consumes any snapshot.
 *   clear()   — call when a new record is committed, so a same-session snapshot can't resurface.
 */
export function installDialogSnapshot(el, { key, isOpen, isNew, snapshot, restore }) {
  const persist = () => {
    if (!isOpen()) return;
    if (isNew()) {
      // Uncommitted new record — snapshot synchronously so it survives a reload.
      const data = snapshot();
      if (data) write(key, data); else clear(key);
    } else {
      // Existing record — flush the focused field via its blur-save handler.
      el.shadowRoot?.activeElement?.blur();
    }
  };

  el.listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  el.listen(window, 'pagehide', persist);

  return {
    restore() {
      const data = read(key);
      if (data) { restore(data); clear(key); }
    },
    clear() { clear(key); },
  };
}
