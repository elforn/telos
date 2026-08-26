import { AppElement } from '../../../_lib/core/app-element.js';
import { attachMarkdownHighlight } from '../../utils/markdown-highlight.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';
import '../tag-input/tag-input.js';
import { icons } from '../../icons.js';
import { installDialogSnapshot } from '../../utils/dialog-snapshot.js';
import { installDraftToggle } from '../../utils/draft-toggle.js';
import { swatches } from '../../utils/color-palette.js';

const STATUSES = ['open', 'paused', 'done', 'closed'];
const SECTIONS = ['capstone', 'milestones', 'wow', 'focus'];
const SNAPSHOT_KEY = 'telos:snapshot.new-item';

// Events emitted (all bubbles + composed):
//   item-created         { id, title, status, note, url, tags, dueDate }
//   item-closed
//   item-title-changed   { title }
//   item-note-changed    { note }
//   item-url-changed     { url }
//   item-duedate-changed { dueDate }
//   item-status-changed  { status }
//   item-tags-changed    { tags }
//   item-delete
//   item-move            { title, status, note, url, tags, dueDate, targetListIds, newListName, copy }
//   item-promote         { title, status, note, url, tags, dueDate, year, section }
//   item-share-request   { item }
//   item-export-request  { item }
class ItemDialog extends AppElement {
  // ── Public properties ────────────────────────────────────────────────────────

  set availableLists(val) { this._availableLists = val ?? []; }
  get availableLists() { return this._availableLists ?? []; }

  set sourceListId(val) { this._sourceListId = val ?? null; }
  get sourceListId() { return this._sourceListId ?? null; }

  set currentYear(val) { this._currentYear = val; }
  get currentYear() { return this._currentYear ?? new Date().getFullYear(); }

  set existingTags(val) {
    this._existingTags = val ?? [];
    if (this._tagInputEl) this._tagInputEl.existingTags = this._existingTags;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  open(item = null) {
    this._resetForm(item);
    this._modal.show(item ? this._noteInput : this._titleInput);
    requestAnimationFrame(() => requestAnimationFrame(() => this._syncNoteHeight()));
  }

  // Populates the form for `item` (or blanks it for a new entry) without touching
  // the modal's open/closed state. Reused by open() and by the Enter quick-add
  // path, which resets in place to add another item rather than closing and
  // reopening the native dialog.
  _resetForm(item = null) {
    this._item = item;
    this._isNew = !item;
    this._skipCreate = false;
    this._showView('main');

    this._titleInput.value = item?.title ?? '';
    this._deleteBtn.hidden = !item;
    this._deleteBtn.textContent = t('item-dialog.delete');

    const status = item?.status ?? 'open';
    const radio = this.shadowRoot.querySelector(`input[name="status"][value="${status}"]`);
    if (radio) radio.checked = true;

    this._noteInput.value = item?.note ?? '';
    this._noteHighlight?.sync();
    this._urlInput.value = item?.url ?? '';
    this._syncUrlOpen();
    this._showUrlField(!!item?.url);

    this._dueDateInput.value = item?.dueDate ?? '';
    this._showDueDateField(!!item?.dueDate);

    this._tagInputEl.tags = item?.tags ?? [];
    this._selectColor(item?.color ?? null);

    this._menuBtn.hidden = false;

    this._lastValidTitle   = item?.title ?? '';
    this._lastValidNote    = item?.note  ?? '';
    this._lastValidUrl     = item?.url   ?? '';
    this._lastValidDueDate = item?.dueDate ?? '';

    this._closeBtn.setAttribute('aria-label',
      this._isNew ? t('item-dialog.save-and-close') : t('item-dialog.close'));
    this._modal.shadowRoot?.querySelector('dialog')?.setAttribute('aria-label',
      this._isNew ? t('item-dialog.title-new') : t('item-dialog.title-edit'));

    // Draft recovery: target is blank for a new entry, the stored record for an existing one.
    const targetValues = item
      ? { title: item.title ?? '', note: item.note, url: item.url, dueDate: item.dueDate, tags: [...(item.tags ?? [])], color: item.color ?? null }
      : { title: '', note: undefined, url: undefined, dueDate: undefined, tags: [], color: null };
    // Existing records: a draft is only ever offered via the button, never silently
    // applied over the real value the form already shows (peek() doesn't write it).
    // New entries: nothing committed to protect, so recovering the draft on open
    // (restoreFor()) is safe and expected.
    const draftValues = this._isNew ? (this._snapshot?.restoreFor() ?? null) : (this._snapshot?.peek() ?? null);
    this._draftToggle.reset({
      draft: draftValues,
      target: targetValues,
      showDraftInitially: this._isNew,
      clearLabel: this._isNew ? t('item-dialog.draft-clear') : t('item-dialog.draft-revert'),
      undoLabel:  this._isNew ? t('item-dialog.draft-undo')  : t('item-dialog.draft-restore'),
    });
  }

  template() {
    return `
      <style>
        :host {
          --_note-min-h: 3.5rem;
        }

        /* Consistent modal padding across the app: --space-5 on both axes. */
        #modal { --space-6: var(--space-5); }

        .sr-only {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border-width: 0;
        }

        /* ── Text inputs ─────────────────────────────────────────────────── */
        input[type="text"] {
          display: block;
          inline-size: 100%;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          margin-block-end: var(--space-4);
        }

        input[type="text"]:focus { border-color: var(--color-accent); }
        input[type="text"]::placeholder { color: var(--color-text-muted); }

        /* ── Textarea wrapper + highlight overlay ────────────────────────── */

        .textarea-wrap {
          position: relative;
          margin-block-end: var(--space-4);
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow-y: auto;
        }

        .textarea-wrap:focus-within { border-color: var(--color-accent); }

        .md-highlight {
          position: absolute;
          inset-block-start: 0;
          inset-inline: 0;
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          line-height: var(--line-height-normal);
          white-space: pre-wrap;
          overflow-wrap: break-word;
          word-break: break-word;
          pointer-events: none;
          box-sizing: border-box;
        }

        .md-highlight .md-h { color: var(--color-warning); }
        .md-highlight .md-b { color: var(--color-warning); }
        .md-highlight .md-i { color: var(--color-accent); }

        textarea {
          display: block;
          inline-size: 100%;
          position: relative;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: transparent;
          caret-color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          resize: none;
          min-block-size: var(--_note-min-h);
          overflow: hidden;
          margin-block-end: 0;
          line-height: var(--line-height-normal);
        }

        textarea::placeholder { color: var(--color-text-muted); }
        /* The textarea glyphs are transparent (the visible text is painted by
           .md-highlight beneath). A bare ::selection color leaves the browser
           default background, which renders imperceptibly over transparent
           text on Firefox — so give the band an explicit background. */
        textarea::selection   { color: var(--color-text-on-accent); background: var(--color-accent-light); }

        .copy-btn {
          position: absolute;
          inset-block-start: var(--space-1);
          inset-inline-end: var(--space-1);
          block-size: var(--touch-target-small);
          inline-size: var(--touch-target-small);
          min-block-size: 0;
          padding: 0;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .copy-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .copy-btn.is-copied { color: var(--color-accent); }

        /* ── Status pills — grow together to span the full modal width, like
           a segmented control, so the group reads as one field. ──────────── */
        .status-field { margin-block-end: var(--space-4); }

        .status-options {
          display: flex;
          gap: var(--space-2);
          align-items: center;
        }

        .status-option {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-1);
          cursor: pointer;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }

        .status-option:has(input:checked) {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .status-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .status-option:has(input:focus-visible) {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Colour swatches (always visible, mirrors list-dialog exactly) ── */

        .color-swatches {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          padding-inline-start: var(--space-1);
          margin-block-end: var(--space-4);
          padding-top: var(--space-2);
        }

        .swatch {
          inline-size: 28px;
          block-size: 28px;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px var(--color-border);
          transition: box-shadow 0.1s;
          min-block-size: auto;
        }

        .swatch:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .swatch[aria-pressed="true"] {
          box-shadow: 0 0 0 2.5px var(--color-surface), 0 0 0 5px var(--color-text-primary);
        }

        .swatch-none {
          background: var(--color-surface-raised);
          box-shadow: inset 0 0 0 1px var(--color-border);
        }

        .swatch-none[aria-pressed="true"] {
          box-shadow: 0 0 0 2.5px var(--color-surface), 0 0 0 5px var(--color-text-secondary);
        }

        tag-input {
          margin-block-end: var(--space-4);
        }

        /* ── Field toggle icons — compact, icon-only footer buttons that
           reveal the Deadline / URL fields directly below the tags,
           replacing an earlier icon-in-the-tags-row placement (itself a
           replacement for a full-width text-label chip row, itself a
           replacement for the original overflow-menu toggles — each
           iteration traded discoverability for compactness). Live inside
           .actions-end, immediately left of Close — deliberately far from
           Delete on the other end of the footer so a mis-tap can't delete
           the record. Both fields start collapsed (shown only if already
           set — see _resetForm/_applyFormValues) so the compact default
           stays compact. Filled accent when the field is open, plain
           outline when closed — same idiom as the pressed pill state
           elsewhere. ── */
        .field-icon-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          padding: 0;
          border-radius: var(--radius-full);
          border: 0.5px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .field-icon-btn svg { inline-size: var(--icon-size-sm); block-size: var(--icon-size-sm); }

        .field-icon-btn[aria-pressed="true"] {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .field-icon-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── URL row — full width, matches input[type=text] styling ──────── */
        .url-row {
          display: flex;
          gap: var(--space-2);
          align-items: center;
          margin-block-end: var(--space-4);
        }

        .url-row input[type="text"] {
          flex: 1;
          margin-block-end: 0;
        }

        #url-open {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          padding-inline: var(--space-3);
          border-radius: var(--radius-sm);
          border: 0.5px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-accent);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #url-open:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Due date — full width, matches input[type=text] styling. Input
           and clear button share one bordered box so it reads as a single
           field, not two competing controls. ─────────────────────────── */
        .duedate-field {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          box-sizing: border-box;
          margin-block-end: var(--space-4);
        }

        .duedate-field:focus-within { border-color: var(--color-accent); }

        #duedate-input {
          flex: 1;
          min-inline-size: 0;
          block-size: 1lh;
          background: none;
          border: none;
          padding: 0;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
        }

        /* De-emphasised on purpose — clearing a date is reversible and rare
           enough that it shouldn't compete visually with the field itself.
           The visible box matches the icon so it doesn't force the row taller
           than the title input; ::before restores the touch-target-small hit
           area invisibly, extending past the box without affecting layout. */
        #duedate-clear {
          position: relative;
          flex-shrink: 0;
          min-block-size: 0;
          min-inline-size: 0;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
          padding: 0;
          border: none;
          border-radius: var(--radius-full);
          background: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #duedate-clear::before {
          content: '';
          position: absolute;
          inset: calc((var(--icon-size-sm) - var(--touch-target-small)) / 2);
        }

        #duedate-clear svg { inline-size: var(--icon-size-sm); block-size: var(--icon-size-sm); }

        #duedate-clear:hover { background: var(--color-surface); }

        #duedate-clear:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Brief highlight the instant a field is revealed via its footer
           toggle — not shown when the field is already open because the
           item already has a value (see _resetForm/_applyFormValues, which
           never add this class). An outline ring rather than a background
           wash so it reads the same regardless of the field's own
           background (the due-date box has one, the URL row doesn't).
           .textarea-wrap gets the same treatment when a field is *hidden*
           instead — collapsing due-date/URL shifts the layout the same way
           revealing it did, so the note field is flashed to show where
           things settled (see _onDueDateToggle/_onUrlToggle). */
        @keyframes field-flash-ring {
          0%   { outline-color: transparent; }
          25%  { outline-color: color-mix(in srgb, var(--color-accent) 70%, transparent); }
          100% { outline-color: transparent; }
        }
        .duedate-field.flash-reveal,
        .url-row.flash-reveal,
        .textarea-wrap.flash-reveal {
          outline: 2px solid transparent;
          outline-offset: 2px;
          animation: field-flash-ring 700ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .duedate-field.flash-reveal, .url-row.flash-reveal, .textarea-wrap.flash-reveal { animation: none; }
        }

        /* ── Action sheet ────────────────────────────────────────────────── */
        /* Consistent modal padding across the app: --space-5 on both axes. */
        #action-sheet { --space-6: var(--space-5); }

        .sheet-item {
          display: flex;
          align-items: center;
          min-block-size: var(--touch-target-lg);
          padding-inline: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          inline-size: 100%;
          text-align: start;
        }

        .sheet-item:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -2px;
        }

        /* ── Picker views (goal-promoter) ───────────────────────────────── */
        .picker-heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-3);
        }

        /* ── Goal promoter ───────────────────────────────────────────────── */
        #year-select {
          display: block;
          inline-size: 100%;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          margin-block-end: var(--space-4);
        }

        #year-select:focus { border-color: var(--color-accent); }

        #section-group {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-block-end: var(--space-4);
        }

        .section-option {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          cursor: pointer;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }

        .section-option:has(input:checked) {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .section-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .section-option:has(input:focus-visible) {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── In-goals display ────────────────────────────────────────────── */
        #in-goals-section {
          margin-block-end: var(--space-3);
        }

        #in-goals-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .in-goals-pill {
          display: inline-block;
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          background: var(--color-accent-subtle);
          color: var(--color-accent);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
        }

        /* ── Shared footer / button styles ───────────────────────────────── */
        button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
        }

        button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #menu-btn { background: none; color: var(--color-text-secondary); padding-inline: var(--space-2); display: flex; align-items: center; }
        #delete { background: none; color: var(--color-danger); }
        #close { background: none; color: var(--color-text-secondary); }
        #draft-toggle-btn { background: none; color: var(--color-text-secondary); }
        /* A draft the user hasn't looked at yet — louder than the plain-text
           footer buttons around it so it isn't missed (see draft-toggle.js). */
        #draft-toggle-btn.has-pending-draft {
          /* Solid fill, not the subtle tint used elsewhere: --color-accent text on
             --color-accent-subtle measures ~2.2:1, well under the 4.5:1 minimum for
             body text. --color-text-on-accent on solid --color-accent is ~6.9:1. */
          background: var(--color-accent);
          color: var(--color-text-on-accent);
          font-weight: var(--font-weight-semibold);
          border-radius: var(--radius-full);
          padding-inline: var(--space-3);
        }

        #add-to-goal-cta {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #add-to-goal-cta:disabled {
          opacity: 0.4;
          cursor: default;
        }

        #promote-back {
          background: none;
          color: var(--color-text-secondary);
        }

        /* ── Footer containers ───────────────────────────────────────────── */
        .actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-inline-start: auto;
        }

      </style>

      <modal-dialog id="modal">

        <!-- ── View 1: Main form ──────────────────────────────────────────── -->
        <div id="view-main">
          <div class="color-swatches">
            ${swatches().map(({ color, label }) => `
              <button type="button"
                class="swatch${!color ? ' swatch-none' : ''}"
                data-color="${color ?? ''}"
                aria-label="${label}"
                aria-pressed="false"
                ${color ? `style="background:${color}"` : ''}
              ></button>
            `).join('')}
          </div>
          <input id="title-input"
                 type="text"
                 aria-label="${t('item-dialog.title-placeholder')}"
                 placeholder="${t('item-dialog.title-placeholder')}"
                 autocomplete="off"
                 enterkeyhint="go"
                 maxlength="120" />
          <div class="status-field">
            <div class="status-options" role="group" aria-label="${t('item-dialog.status-label')}">
              ${STATUSES.map(s => `
                <label class="status-option">
                  <input type="radio" name="status" value="${s}" ${s === 'open' ? 'checked' : ''}>
                  ${t('item-dialog.status-' + s)}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="textarea-wrap">
            <div class="md-highlight" aria-hidden="true"></div>
            <textarea id="note-input"
                      aria-label="${t('item-dialog.note-placeholder')}"
                      placeholder="${t('item-dialog.note-placeholder')}"
                      enterkeyhint="newline"></textarea>
            <button type="button" class="copy-btn" id="note-copy-btn" aria-label="${t('item-dialog.copy-note')}" title="${t('item-dialog.copy-note')}">${icons.copy}</button>
          </div>
          <tag-input id="tag-input"></tag-input>
          <div class="duedate-field" hidden>
            <input id="duedate-input"
                   type="date"
                   aria-label="${t('item-dialog.duedate-toggle')}" />
            <button type="button" id="duedate-clear" aria-label="${t('item-dialog.duedate-clear')}">${icons.xMark}</button>
          </div>
          <div class="url-row" hidden>
            <input id="url-input"
                   type="text"
                   aria-label="${t('item-dialog.url-placeholder')}"
                   placeholder="${t('item-dialog.url-placeholder')}"
                   autocomplete="off"
                   inputmode="url" />
            <button type="button" id="url-open" hidden>${t('item-dialog.url-open')}</button>
          </div>
        </div>

        <!-- ── View 2: Goal promoter ──────────────────────────────────────── -->
        <div id="view-goal-promoter" hidden>
          <p class="picker-heading">${t('item-dialog.add-to-goal')}</p>
          <div id="in-goals-section" hidden>
            <p class="picker-heading">${t('item-dialog.in-goals-label')}</p>
            <div id="in-goals-list"></div>
          </div>
          <label class="picker-heading" for="year-select">${t('item-dialog.goal-year-label')}</label>
          <select id="year-select"></select>
          <div id="section-group" role="group" aria-label="${t('item-dialog.goal-section-label')}">
            ${SECTIONS.map((s, i) => `
              <label class="section-option">
                <input type="radio" name="goal-section" value="${s}" ${i === 0 ? 'checked' : ''}>
                ${t('item-dialog.goal-section-' + s)}
              </label>
            `).join('')}
          </div>
        </div>

        <!-- ── Footer: main ───────────────────────────────────────────────── -->
        <div slot="footer" class="actions footer-main">
          <button type="button" id="menu-btn" hidden aria-label="${t('item-dialog.more-actions')}">${icons.dotsVertical}</button>
          <button type="button" id="delete" hidden>${t('item-dialog.delete')}</button>
          <button type="button" id="draft-toggle-btn" hidden></button>
          <div class="actions-end">
            <button type="button" class="field-icon-btn" id="duedate-chip" aria-pressed="false" aria-label="${t('item-dialog.duedate-toggle')}" title="${t('item-dialog.duedate-toggle')}">${icons.calendar}</button>
            <button type="button" class="field-icon-btn" id="url-chip" aria-pressed="false" aria-label="${t('item-dialog.url-toggle')}" title="${t('item-dialog.url-toggle')}">${icons.link}</button>
            <button type="button" id="close" aria-label="${t('item-dialog.close')}">${t('item-dialog.close')}</button>
          </div>
        </div>

        <!-- ── Footer: goal promoter ──────────────────────────────────────── -->
        <div slot="footer" class="actions footer-goal-promoter" hidden>
          <button type="button" id="promote-back">${t('item-dialog.picker-back')}</button>
          <button type="button" id="add-to-goal-cta">${t('item-dialog.goal-add-cta')}</button>
        </div>

        <div id="save-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
      </modal-dialog>

      <modal-dialog id="action-sheet" aria-label="${t('item-dialog.more-actions')}">
        <button type="button" id="action-move-btn" class="sheet-item">${t('item-dialog.move-to-list')}</button>
        <button type="button" id="action-promote-btn" class="sheet-item">${t('item-dialog.add-to-goal')}</button>
        <button type="button" id="action-export-btn" class="sheet-item">${t('item-dialog.extract-markdown')}</button>
        <button type="button" id="action-share-btn" class="sheet-item">${t('item-dialog.share-item')}</button>
      </modal-dialog>

      <list-picker-dialog id="list-picker"></list-picker-dialog>
    `;
  }

  subscribe() {
    this._modal = this.shadowRoot.querySelector('#modal');
    // Tapping a button while a text field is focused would otherwise blur it
    // first (closing the on-screen keyboard) before the button's own click
    // handler runs. preventDefault on pointerdown stops that focus steal —
    // the click still fires normally on pointerup — so buttons act without
    // dismissing the keyboard mid-edit. Close/Delete end the editing session,
    // so the keyboard closing for those is correct and expected.
    this._onButtonPointerDown = e => {
      const btn = e.target.closest('button');
      if (btn && btn.id !== 'close' && btn.id !== 'delete') e.preventDefault();
    };
    this.shadowRoot.addEventListener('pointerdown', this._onButtonPointerDown);
    this._titleInput = this.shadowRoot.querySelector('#title-input');
    this._noteInput = this.shadowRoot.querySelector('#note-input');
    this._textareaWrap = this.shadowRoot.querySelector('.textarea-wrap');
    this._noteHighlight = attachMarkdownHighlight(
      this._noteInput,
      this.shadowRoot.querySelector('.md-highlight'),
    );
    this._noteCopyBtn = this.shadowRoot.querySelector('#note-copy-btn');
    this._urlInput = this.shadowRoot.querySelector('#url-input');
    this._urlOpen = this.shadowRoot.querySelector('#url-open');
    this._urlToggle = this.shadowRoot.querySelector('#url-chip');
    this._urlRow = this.shadowRoot.querySelector('.url-row');
    this._dueDateInput = this.shadowRoot.querySelector('#duedate-input');
    this._dueDateClear = this.shadowRoot.querySelector('#duedate-clear');
    this._dueDateToggle = this.shadowRoot.querySelector('#duedate-chip');
    this._dueDateRow = this.shadowRoot.querySelector('.duedate-field');
    this._tagInputEl = this.shadowRoot.querySelector('#tag-input');
    this._tagInputEl.existingTags = this._existingTags ?? [];
    this._colorSwatches = this.shadowRoot.querySelector('.color-swatches');
    this._selectedColor = null;
    this._deleteBtn = this.shadowRoot.querySelector('#delete');
    this._menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._closeBtn = this.shadowRoot.querySelector('#close');
    this._draftToggleBtn = this.shadowRoot.querySelector('#draft-toggle-btn');
    this._saveStatus = this.shadowRoot.querySelector('#save-status');
    this._actionSheet = this.shadowRoot.querySelector('#action-sheet');
    this._viewMain = this.shadowRoot.querySelector('#view-main');
    this._viewGoalPromoter = this.shadowRoot.querySelector('#view-goal-promoter');
    this._footerMain = this.shadowRoot.querySelector('.footer-main');
    this._footerGoalPromoter = this.shadowRoot.querySelector('.footer-goal-promoter');
    this._listPickerDialog = this.shadowRoot.querySelector('#list-picker');
    this._yearSelect = this.shadowRoot.querySelector('#year-select');
    this._inGoalsSection = this.shadowRoot.querySelector('#in-goals-section');
    this._inGoalsList = this.shadowRoot.querySelector('#in-goals-list');
    this._addToGoalCta = this.shadowRoot.querySelector('#add-to-goal-cta');

    this._isNew          = false;
    this._skipCreate      = false;
    this._view           = 'main';
    this._lastValidTitle   = '';
    this._lastValidNote    = '';
    this._lastValidUrl     = '';
    this._lastValidDueDate = '';

    // ── Main view ─────────────────────────────────────────────────────────────

    this._onTitleBlur = () => {
      const v = this._titleInput.value.trim();
      if (this._isNew) {
        if (!v) return;
        const { status, note, url, dueDate, tags, color } = this._getFormValues();
        const id = crypto.randomUUID();
        // Clear while _item is still null, so _snapshotRecordId() resolves to the
        // new:<listId> key the draft was actually captured/read under — clearing
        // after assigning _item below would target the fresh item's id instead,
        // a key nothing was ever written to, leaving the real draft un-cleared.
        this._snapshot?.clear(); // committed — drop any hide-time snapshot
        this._item = { id, title: v, status, note, url, dueDate, tags, color, inGoals: [] };
        this._isNew = false;
        this._lastValidTitle   = v;
        this._lastValidNote    = note;
        this._lastValidUrl     = url;
        this._lastValidDueDate = dueDate ?? '';
        this.dispatchEvent(new CustomEvent('item-created', {
          bubbles: true, composed: true,
          detail: { id, title: v, status, note, url, dueDate, tags, color },
        }));
        this._closeBtn.setAttribute('aria-label', t('item-dialog.close'));
        this._modal.shadowRoot?.querySelector('dialog')?.setAttribute('aria-label',
          t('item-dialog.title-edit'));
        this._deleteBtn.hidden = false;
        return;
      }
      if (!v) { this._titleInput.value = this._lastValidTitle; return; }
      if (v === this._lastValidTitle) return;
      this._lastValidTitle = v;
      this.dispatchEvent(new CustomEvent('item-title-changed', {
        bubbles: true, composed: true, detail: { title: v },
      }));
      this._announceSaved();
    };

    this._onNoteInput = () => { this._syncNoteHeight(); };

    this._onNoteBlur = () => {
      if (this._isNew) return;
      const v = this._noteInput.value.trim();
      if (v === this._lastValidNote) return;
      this._lastValidNote = v;
      this.dispatchEvent(new CustomEvent('item-note-changed', {
        bubbles: true, composed: true, detail: { note: v || undefined },
      }));
      this._announceSaved();
    };

    this._onNoteCopy = async () => {
      const text = this._noteInput.value.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        this._noteCopyBtn.innerHTML = icons.check;
        this._noteCopyBtn.classList.add('is-copied');
        this._copyResetTimer = setTimeout(() => {
          this._noteCopyBtn.innerHTML = icons.copy;
          this._noteCopyBtn.classList.remove('is-copied');
        }, 1500);
      } catch { } // clipboard unavailable — fail silently
    };

    this._onUrlInput = () => { this._syncUrlOpen(); };

    this._onUrlBlur = () => {
      if (this._isNew) return;
      const v = this._urlInput.value.trim();
      if (v === this._lastValidUrl) return;
      this._lastValidUrl = v;
      this.dispatchEvent(new CustomEvent('item-url-changed', {
        bubbles: true, composed: true, detail: { url: v || undefined },
      }));
      this._announceSaved();
    };

    // Focuses the revealed input itself (not just its container): a URL
    // field is text, so moving focus there keeps the on-screen keyboard up
    // (just retargeted), which reads better than leaving the note textarea
    // "selected" while a different field is visibly highlighted below it.
    // `preventScroll: true` stops the browser's own default focus-scroll
    // (usually block:'nearest') from fighting the deliberate block:'center'
    // scroll _flashField does right after — that call is left as the sole
    // authority on final position. _flashField (which scrolls the field into
    // view) must run *after* _syncNoteHeight, not before: _syncNoteHeight
    // resizes the note textarea's wrap to make room for the newly-revealed
    // field, and that resize lands a frame later than this handler.
    // Scrolling first and resizing second scrolls to a position the layout
    // shift then moves out from under it — the field ends up back
    // off-screen. Both run inside the same rAF now so the scroll always
    // targets the settled layout. Closing (hiding) the field instead flashes
    // the note field — collapsing it shifts the layout the same way opening
    // it did, so the same "here's what moved" cue applies in reverse.
    this._onUrlToggle = () => {
      const opening = this._urlRow.hidden;
      this._showUrlField(opening);
      requestAnimationFrame(() => {
        this._syncNoteHeight();
        if (opening) {
          this._urlInput.focus({ preventScroll: true });
          this._flashField(this._urlRow);
        } else {
          this._flashField(this._textareaWrap);
        }
      });
    };

    this._onUrlOpen = () => {
      const url = this._urlInput.value.trim();
      if (url) window.open(url, '_blank', 'noopener');
    };

    this._onDueDateInput = () => {
      if (this._isNew) return;
      const v = this._dueDateInput.value;
      if (v === this._lastValidDueDate) return;
      this._lastValidDueDate = v;
      this.dispatchEvent(new CustomEvent('item-duedate-changed', {
        bubbles: true, composed: true, detail: { dueDate: v || undefined },
      }));
      this._announceSaved();
    };

    // Unlike _onUrlToggle above, this deliberately does *not* focus the
    // revealed input: a native date control isn't a text field, so focusing
    // it would swap away whatever on-screen keyboard was up for the field
    // the user was actually editing (e.g. the note) instead of just leaving
    // it be — the scroll+flash below is enough to show the field appeared.
    // _flashField must still run after _syncNoteHeight so the scroll targets
    // the settled post-resize layout (see the note above). Closing (hiding)
    // the field flashes the note field instead, same as _onUrlToggle.
    this._onDueDateToggle = () => {
      const opening = this._dueDateRow.hidden;
      this._showDueDateField(opening);
      requestAnimationFrame(() => {
        this._syncNoteHeight();
        if (opening) this._flashField(this._dueDateRow);
        else this._flashField(this._textareaWrap);
      });
    };

    this._onDueDateClear = () => {
      this._dueDateInput.value = '';
      this._onDueDateInput();
    };

    this._onClose = () => { this._modal.close(); };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('item-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      if (this._isNew) {
        // _skipCreate: move/promote already dispatched item-move/item-promote
        // directly — don't also create it here.
        if (!this._skipCreate) {
          const { title, status, note, url, dueDate, tags, color } = this._getFormValues();
          if (title) {
            const id = crypto.randomUUID();
            this._isNew = false;
            this._lastValidTitle = title;
            this._snapshot?.clear(); // committed — drop any hide-time snapshot
            this.dispatchEvent(new CustomEvent('item-created', {
              bubbles: true, composed: true, detail: { id, title, status, note, url, dueDate, tags, color },
            }));
          } else {
            this._snapshot?.capture(); // can't commit without a title — preserve note/url/tags
          }
        }
        this._skipCreate = false;
      } else {
        this._snapshot?.clear(); // edited record closed — store owns it now
        this.dispatchEvent(new CustomEvent('item-closed', { bubbles: true, composed: true }));
      }
      clearTimeout(this._copyResetTimer);
      this._actionSheet?.close();
    };

    this._onKeyDown = e => {
      if (e.key !== 'Enter') return;
      if (this._isNew) {
        if (!this._titleInput.value.trim()) return; // require title for new items
        this._titleInput.blur(); // commits item via _onTitleBlur → _isNew = false
        // Quick-add: reset the form in place and keep the dialog open for the
        // next item, rather than closing — avoids a native close()/reopen()
        // cycle (and the focus-restoration/keyboard-activation quirk that
        // otherwise causes an inconsistent, browser-dependent auto-reopen).
        this._resetForm(null);
        this._titleInput.focus();
        requestAnimationFrame(() => requestAnimationFrame(() => this._syncNoteHeight()));
      } else {
        this._titleInput.blur(); // triggers _onTitleBlur before close
        this._modal.close();
      }
    };

    this._onStatusChange = e => {
      if (this._isNew) return;
      this.dispatchEvent(new CustomEvent('item-status-changed', {
        bubbles: true, composed: true,
        detail: { status: e.target.value },
      }));
    };

    this._onResize = () => this._syncNoteHeight();

    // ── Tag input ─────────────────────────────────────────────────────────────
    // Chip/suggestion mechanics live in <tag-input>; the dialog only decides
    // whether a change is worth propagating upward (suppressed while _isNew,
    // same as every other field — a new item isn't "changed", it's drafted).

    this._onTagsChanged = e => {
      if (this._isNew) return;
      this.dispatchEvent(new CustomEvent('item-tags-changed', {
        bubbles: true, composed: true, detail: { tags: e.detail.tags },
      }));
    };
    this._tagInputEl.addEventListener('tags-changed', this._onTagsChanged);

    // ── Colour swatches ──────────────────────────────────────────────────────
    // Mirrors list-dialog exactly: a new item just tracks _selectedColor for
    // item-created to pick up; an existing item commits immediately.
    this._onSwatchClick = e => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      this._selectColor(swatch.dataset.color || null);
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('item-color-changed', {
          bubbles: true, composed: true,
          detail: { color: this._selectedColor },
        }));
      }
    };
    this._onSwatchPointerDown = e => e.preventDefault();
    this._colorSwatches.addEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches.addEventListener('click', this._onSwatchClick);

    this._titleInput.addEventListener('keydown', this._onKeyDown);
    this._titleInput.addEventListener('blur',    this._onTitleBlur);
    this._noteInput.addEventListener('input', this._onNoteInput);
    this._noteInput.addEventListener('blur',  this._onNoteBlur);
    this._noteCopyBtn.addEventListener('pointerdown', e => e.preventDefault());
    this._noteCopyBtn.addEventListener('click', this._onNoteCopy);
    this._urlInput.addEventListener('input', this._onUrlInput);
    this._urlInput.addEventListener('blur',  this._onUrlBlur);
    this._urlOpen.addEventListener('click', this._onUrlOpen);
    this._urlToggle.addEventListener('click', this._onUrlToggle);
    this._dueDateInput.addEventListener('change', this._onDueDateInput);
    this._dueDateClear.addEventListener('pointerdown', e => e.preventDefault());
    this._dueDateClear.addEventListener('click', this._onDueDateClear);
    this._dueDateToggle.addEventListener('click', this._onDueDateToggle);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this._closeBtn.addEventListener('click', this._onClose);
    this._draftToggle = installDraftToggle(this, {
      button: this._draftToggleBtn,
      applyValues: data => {
        this._applyFormValues(data);
        requestAnimationFrame(() => this._syncNoteHeight());
      },
    });
    this._modal.addEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);
    // preventDefault stops the browser's default label→radio handling so we
    // control exactly when checked is set and fire 'change' in one step —
    // it also keeps focus (and the on-screen keyboard) on whatever field the
    // user was editing, since the tap never steals focus onto the radio.
    this._onStatusClick = e => {
      const label = e.target.closest('.status-option');
      if (!label) return;
      e.preventDefault();
      const input = label.querySelector('input[type="radio"]');
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    this._onStatusPointerDown = e => e.preventDefault();
    this.shadowRoot.querySelector('.status-options').addEventListener('pointerdown', this._onStatusPointerDown);
    this.shadowRoot.querySelector('.status-options').addEventListener('click', this._onStatusClick);
    this.shadowRoot.querySelector('.status-options').addEventListener('change', this._onStatusChange);

    // ── More actions (··· menu) ───────────────────────────────────────────────

    this._onMenuBtn = () => {
      // Remember what was focused (note/title) so a natural dismiss — swipe or
      // backdrop tap — can re-focus it and reopen the mobile keyboard. Cleared
      // when an action button closes the sheet itself. The pointerdown guard
      // above stops the menu button from stealing focus, so activeElement here
      // is still whatever text field the user was editing.
      this._sheetReturnFocus = this.shadowRoot.activeElement;
      this._actionSheet.show();
    };
    this._menuBtn.addEventListener('click', this._onMenuBtn);

    // A backdrop tap fires a click at the sheet's internal <dialog>
    // (composedPath()[0] === that dialog); the library closes the sheet on the
    // same click, and this bubbles to the host still synchronously inside the
    // gesture. Native focus restoration already ran during close() but not in a
    // gesture context, so the keyboard stays down — re-focusing here, still in
    // the click's call stack, reopens it, matching swipe-to-dismiss. Action
    // buttons close the sheet with target === the button (not the dialog), so
    // they fall through this guard and never refocus.
    this._onSheetBackdrop = e => {
      const sheetDialog = this._actionSheet.shadowRoot?.querySelector('dialog');
      if (!sheetDialog || e.composedPath()[0] !== sheetDialog) return;
      const el = this._sheetReturnFocus;
      if (!el) return;
      // close() already restored focus to el programmatically, so a plain
      // focus() is a no-op — the field has focus but the browser saw no new
      // focus event, so the mobile keyboard stays down. Blur then re-focus
      // synchronously inside this click forces a real gesture-driven focus
      // transition, which reopens the keyboard.
      el.blur();
      el.focus();
    };
    this._actionSheet.addEventListener('click', this._onSheetBackdrop);

    this._onActionMove = () => {
      this._sheetReturnFocus = null;
      this._actionSheet.close();
      this._listPickerDialog.lists = this.availableLists;
      this._listPickerDialog.sourceListId = this.sourceListId;
      this._listPickerDialog.show();
    };
    this.shadowRoot.querySelector('#action-move-btn').addEventListener('click', this._onActionMove);

    this._onActionPromote = () => { this._sheetReturnFocus = null; this._actionSheet.close(); this._showView('goal-promoter'); };
    this.shadowRoot.querySelector('#action-promote-btn').addEventListener('click', this._onActionPromote);

    this._onActionExport = () => {
      this._sheetReturnFocus = null;
      this._actionSheet.close();
      this._modal.close();
      this.dispatchEvent(new CustomEvent('item-export-request', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
    };
    this.shadowRoot.querySelector('#action-export-btn').addEventListener('click', this._onActionExport);

    this._onActionShare = () => {
      this._sheetReturnFocus = null;
      this._actionSheet.close();
      this._modal.close();
      this.dispatchEvent(new CustomEvent('item-share-request', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
    };
    this.shadowRoot.querySelector('#action-share-btn').addEventListener('click', this._onActionShare);

    // ── Move to list ──────────────────────────────────────────────────────────

    this._onListPick = e => {
      const { targetListIds, newListName, copy } = e.detail;
      const { title, status, note, url, dueDate, tags, color } = this._getFormValues();
      if (this._isNew) { this._skipCreate = true; this._snapshot?.clear(); }
      this.dispatchEvent(new CustomEvent('item-move', {
        bubbles: true, composed: true,
        detail: { title, status, note, url, dueDate, tags, color, targetListIds, newListName, copy },
      }));
      this._modal.close();
    };
    this._listPickerDialog.addEventListener('list-pick', this._onListPick);

    // ── Add to goal ───────────────────────────────────────────────────────────

    this._onPromoteBack = () => this._showView('main');
    this.shadowRoot.querySelector('#promote-back').addEventListener('click', this._onPromoteBack);

    this._onSectionChange = () => this._updateGoalGuard();
    this.shadowRoot.querySelector('#section-group').addEventListener('change', this._onSectionChange);

    this._onYearChange = () => this._updateGoalGuard();
    this._yearSelect.addEventListener('change', this._onYearChange);

    this._onAddToGoal = () => this._commitPromote();
    this._addToGoalCta.addEventListener('click', this._onAddToGoal);

    this._snapshot = installDialogSnapshot(this, {
      key:      SNAPSHOT_KEY,
      isOpen:   () => !!this._modal.shadowRoot?.querySelector('dialog')?.open,
      recordId: () => this._snapshotRecordId(),
      snapshot: () => {
        if (this._isNew) {
          const { title, note, url, dueDate, tags, color } = this._getFormValues();
          return (title || note || url || dueDate || tags.length || color) ? { title, note, url, dueDate, tags, color } : null;
        }
        // existing: only if a text field has an unsaved edit (tags/status/dueDate/colour commit immediately)
        const dirty = this._titleInput.value !== this._lastValidTitle
          || this._noteInput.value !== this._lastValidNote
          || this._urlInput.value !== this._lastValidUrl;
        if (!dirty) return null;
        const { title, note, url, dueDate, tags, color } = this._getFormValues();
        return { title, note, url, dueDate, tags, color };
      },
      restore: data => this._applyFormValues(data),
    });
  }

  unsubscribe() {
    this.shadowRoot.removeEventListener('pointerdown', this._onButtonPointerDown);
    this._noteHighlight?.detach();
    this._titleInput?.removeEventListener('keydown', this._onKeyDown);
    this._titleInput?.removeEventListener('blur',    this._onTitleBlur);
    this._noteInput?.removeEventListener('input', this._onNoteInput);
    this._noteInput?.removeEventListener('blur',  this._onNoteBlur);
    this._noteCopyBtn?.removeEventListener('click', this._onNoteCopy);
    this._colorSwatches?.removeEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches?.removeEventListener('click', this._onSwatchClick);
    this._urlInput?.removeEventListener('input', this._onUrlInput);
    this._urlInput?.removeEventListener('blur',  this._onUrlBlur);
    this._urlToggle?.removeEventListener('click', this._onUrlToggle);
    this._urlOpen?.removeEventListener('click', this._onUrlOpen);
    this._dueDateInput?.removeEventListener('change', this._onDueDateInput);
    this._dueDateToggle?.removeEventListener('click', this._onDueDateToggle);
    this._dueDateClear?.removeEventListener('click', this._onDueDateClear);
    this._tagInputEl?.removeEventListener('tags-changed', this._onTagsChanged);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this._closeBtn?.removeEventListener('click', this._onClose);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
    this.shadowRoot.querySelector('.status-options')?.removeEventListener('pointerdown', this._onStatusPointerDown);
    this.shadowRoot.querySelector('.status-options')?.removeEventListener('click', this._onStatusClick);
    this.shadowRoot.querySelector('.status-options')?.removeEventListener('change', this._onStatusChange);

    this._menuBtn?.removeEventListener('click', this._onMenuBtn);
    this._actionSheet?.removeEventListener('click', this._onSheetBackdrop);
    this.shadowRoot.querySelector('#action-move-btn')?.removeEventListener('click', this._onActionMove);
    this.shadowRoot.querySelector('#action-promote-btn')?.removeEventListener('click', this._onActionPromote);
    this.shadowRoot.querySelector('#action-export-btn')?.removeEventListener('click', this._onActionExport);
    this.shadowRoot.querySelector('#action-share-btn')?.removeEventListener('click', this._onActionShare);
    this._listPickerDialog?.removeEventListener('list-pick', this._onListPick);

    this.shadowRoot.querySelector('#promote-back')?.removeEventListener('click', this._onPromoteBack);
    this.shadowRoot.querySelector('#section-group')?.removeEventListener('change', this._onSectionChange);
    this._yearSelect?.removeEventListener('change', this._onYearChange);
    this._addToGoalCta?.removeEventListener('click', this._onAddToGoal);
  }

  // ── View management ───────────────────────────────────────────────────────

  _showView(name) {
    this._view = name;
    this._viewMain.hidden = name !== 'main';
    this._viewGoalPromoter.hidden = name !== 'goal-promoter';
    this._footerMain.hidden = name !== 'main';
    this._footerGoalPromoter.hidden = name !== 'goal-promoter';

    if (name === 'goal-promoter') this._renderGoalPromoter();
  }

  // ── Goal promoter ─────────────────────────────────────────────────────────

  _renderGoalPromoter() {
    // Populate year options
    const y = this.currentYear;
    this._yearSelect.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const yr = y - 2 + i;
      const opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = String(yr);
      this._yearSelect.appendChild(opt);
    }
    this._yearSelect.value = String(y);

    // Default to first section
    const firstSection = this.shadowRoot.querySelector('input[name="goal-section"]');
    if (firstSection) firstSection.checked = true;

    // Render in-goals pills
    const inGoals = this._item?.inGoals ?? [];
    this._inGoalsSection.hidden = inGoals.length === 0;
    this._inGoalsList.replaceChildren();
    for (const entry of inGoals) {
      const pill = document.createElement('span');
      pill.className = 'in-goals-pill';
      pill.textContent = `${entry.year} · ${t(`item-dialog.goal-section-${entry.section}`)}`;
      this._inGoalsList.appendChild(pill);
    }

    this._updateGoalGuard();
  }

  _checkedSection() {
    return [...this.shadowRoot.querySelectorAll('input[name="goal-section"]')].find(r => r.checked)?.value;
  }

  _updateGoalGuard() {
    const year = this._yearSelect?.value;
    const section = this._checkedSection();
    const alreadyAdded = (this._item?.inGoals ?? []).some(
      e => String(e.year) === String(year) && e.section === section
    );
    this._addToGoalCta.disabled = alreadyAdded;
    this._addToGoalCta.textContent = alreadyAdded
      ? t('item-dialog.goal-already-added')
      : t('item-dialog.goal-add-cta');
  }

  _commitPromote() {
    const year = this._yearSelect?.value;
    const section = this._checkedSection();
    if (!year || !section) return;
    const { title, status, note, url, dueDate, tags, color } = this._getFormValues();
    if (this._isNew) { this._skipCreate = true; this._snapshot?.clear(); }
    this.dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title, status, note, url, dueDate, tags, color, year, section },
    }));
    this._modal.close();
  }

  // ── Draft recovery toggle ─────────────────────────────────────────────────

  // A new item has no id of its own — scope its draft to the list it's being
  // added to, so a draft started in one list never resurfaces in, or gets
  // overwritten by, another.
  _snapshotRecordId() {
    return this._item?.id ?? `new:${this.sourceListId ?? ''}`;
  }

  _applyFormValues({ title, note, url, dueDate, tags, color }) {
    this._titleInput.value = title ?? '';
    this._noteInput.value  = note ?? '';
    this._noteHighlight?.sync();
    this._urlInput.value = url ?? '';
    this._syncUrlOpen();
    this._showUrlField(!!url);
    this._dueDateInput.value = dueDate ?? '';
    this._showDueDateField(!!dueDate);
    this._tagInputEl.tags = tags ?? [];
    this._selectColor(color ?? null);
  }

  _selectColor(color) {
    this._selectedColor = color;
    this._colorSwatches.querySelectorAll('.swatch').forEach(s => {
      s.setAttribute('aria-pressed', String((s.dataset.color || null) === color));
    });
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  _getFormValues() {
    const tags = this._tagInputEl.commitPending();
    const title = this._titleInput.value.trim();
    const status = this.shadowRoot.querySelector('input[name="status"]:checked')?.value ?? 'open';
    const note = this._noteInput.value.trim() || undefined;
    const url = this._urlInput.value.trim() || undefined;
    const dueDate = this._dueDateInput.value || undefined;
    return { title, status, note, url, dueDate, tags, color: this._selectedColor ?? undefined };
  }

  _syncNoteHeight() {
    const ta = this._noteInput;
    if (!ta) return;
    ta.style.blockSize = 'auto';
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const urlRowH = this._urlRow?.hidden ? 0 : (this._urlRow?.offsetHeight ?? 0);
    const dueDateRowH = this._dueDateRow?.hidden ? 0 : (this._dueDateRow?.offsetHeight ?? 0);
    const MIN_H = 56;
    const CHROME_H = 340; // approx header + footer + title + status + tags chrome
    const MIN_WRAP_H = 120;
    const maxH = Math.max(vh - CHROME_H - urlRowH - dueDateRowH, MIN_WRAP_H);
    ta.style.blockSize = `${Math.max(ta.scrollHeight, MIN_H)}px`;
    const wrap = ta.closest('.textarea-wrap');
    if (wrap) wrap.style.maxBlockSize = `${maxH}px`;
  }


  _syncUrlOpen() {
    if (this._urlOpen) this._urlOpen.hidden = !this._urlInput.value.trim();
  }

  _showUrlField(show) {
    this._urlRow.hidden = !show;
    this._urlToggle.setAttribute('aria-pressed', String(show));
  }

  _showDueDateField(show) {
    this._dueDateRow.hidden = !show;
    this._dueDateToggle.setAttribute('aria-pressed', String(show));
  }

  // A brief outline pulse marking a field that just appeared via its footer
  // toggle — never called when a field opens because it already had a value
  // (see _resetForm/_applyFormValues, which call _showUrlField/
  // _showDueDateField directly). scrollIntoView matters here: toggling the
  // *second* field (e.g. due date already open, then URL) can reveal it
  // below the fold of the scrollable dialog — flashing an off-screen field
  // is invisible, so the field is always brought into view first.
  // block: 'center' (not 'nearest') so the card visibly jumps to the new
  // field even when it's already marginally on-screen — 'nearest' can end
  // up scrolling by 0px in that case, reading as if nothing happened.
  // Uses setTimeout rather than animationend, matching goal-item's _logTick —
  // under prefers-reduced-motion the animation is `none`, so animationend
  // would never fire and the class would stick until the next toggle removed
  // it; the timer is stashed on the element itself (not `this`) since two
  // different fields can each have their own flash in flight independently.
  _flashField(el) {
    clearTimeout(el._flashTimer);
    el.classList.remove('flash-reveal');
    void el.offsetWidth; // force reflow so a rapid re-toggle restarts the animation
    el.classList.add('flash-reveal');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el._flashTimer = setTimeout(() => el.classList.remove('flash-reveal'), 700);
  }

  _announceSaved() {
    if (!this._saveStatus) return;
    this._saveStatus.textContent = t('dialog.saved-sr');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => { this._saveStatus.textContent = ''; }, 1500);
  }
}

customElements.define('item-dialog', ItemDialog);
