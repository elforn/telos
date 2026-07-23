// Clear/Revert ⇄ Undo toggle for a dialog's draft-recovery button.
//
// Shared across item/goal/list-dialog and list-detail's import-text. Each
// dialog's form fields differ (title/note/url/tags vs title/notes/tags vs
// name/color vs a single textarea), so applyValues stays dialog-specific —
// but the toggle mechanics (visibility, label swap, which of draft/target is
// currently showing) are identical everywhere, so they live here once.

/**
 * Wire a Clear/Revert ⇄ Undo toggle button.
 *
 * @param {AppElement} el  the dialog element (uses its auto-cleanup `listen`)
 * @param {object} opts
 * @param {HTMLButtonElement}      opts.button
 * @param {(data: object) => void} opts.applyValues  set the dialog's form fields from data
 * @returns {{ reset: (opts: { draft: object|null, target: object, clearLabel: string, undoLabel: string }) => void }}
 *   reset() — call from open(): draft is the data restoreFor() returned (or null if nothing
 *   was restored), target is what Clear/Revert should apply (blank for a new entry, the
 *   stored record for an existing one), clearLabel/undoLabel are this dialog's button text.
 */
export function installDraftToggle(el, { button, applyValues }) {
  let draft = null;
  let target = null;
  let showingDraft = false;
  let clearLabel = '';
  let undoLabel = '';

  const update = () => {
    button.hidden = !draft;
    if (draft) button.textContent = showingDraft ? clearLabel : undoLabel;
  };

  // Keep the mobile keyboard open when a text field is focused — same
  // pointerdown-preventDefault pattern used for every other in-dialog action
  // button (copy-note, url-toggle, status pills, tag-chip remove).
  el.listen(button, 'pointerdown', e => e.preventDefault());
  el.listen(button, 'click', () => {
    if (!draft) return; // hidden whenever there's no draft, but guard against a stray click
    showingDraft = !showingDraft;
    applyValues(showingDraft ? draft : target);
    update();
  });

  return {
    reset({ draft: newDraft, target: newTarget, clearLabel: cl, undoLabel: ul }) {
      draft = newDraft;
      target = newTarget;
      showingDraft = !!draft;
      clearLabel = cl;
      undoLabel = ul;
      update();
    },
  };
}
