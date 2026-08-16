import { AppElement } from '../../../_lib/core/app-element.js';
import { attachMarkdownHighlight } from '../../utils/markdown-highlight.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';
import '../tag-input/tag-input.js';
import { icons } from '../../icons.js';
import { installDialogSnapshot } from '../../utils/dialog-snapshot.js';
import { installDraftToggle } from '../../utils/draft-toggle.js';
import { isFrequency, TARGET_LIMITS, isLoggedOn } from '../../utils/tracking.js';
import { todayISO } from '../../utils/today-iso.js';

const SECTIONS  = ['capstone', 'milestones', 'wow', 'focus'];
const SNAPSHOT_KEY = 'telos:snapshot.new-goal';
const TYPES = ['percentage', 'weekly', 'monthly'];
const FIX_DAYS = 14;
const DEFAULT_TARGET = { weekly: 3, monthly: 4 };

class GoalDialog extends AppElement {
  // ── Public properties ─────────────────────────────────────────────────────

  set currentYear(val)    { this._currentYear    = val; }
  get currentYear()       { return this._currentYear ?? new Date().getFullYear(); }

  set availableLists(val) { this._availableLists = val ?? []; }
  get availableLists()    { return this._availableLists ?? []; }

  set existingTags(val)   {
    this._existingTags = val ?? [];
    if (this._tagInputEl) this._tagInputEl.existingTags = this._existingTags;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  open(goal = null, { year, section } = {}) {
    this._fromYear    = year    ?? String(this.currentYear);
    this._fromSection = section ?? 'capstone';
    this._resetForm(goal);
    this._modal.show(this._input);
    setTimeout(() => {
      const len = this._input.value.length;
      this._input.setSelectionRange(len, len);
      requestAnimationFrame(() => this._syncDescHeight());
    }, 0);
  }

  // Populates the form for `goal` (or blanks it for a new entry) without touching
  // the modal's open/closed state. Reused by open() and by the Enter quick-add
  // path, which resets in place to add another goal rather than closing and
  // reopening the native dialog.
  _resetForm(goal = null) {
    this._goal        = goal;
    this._isNew       = !goal;
    this._input.value = goal?.title ?? '';
    if (this._deleteBtn) this._deleteBtn.hidden = !goal;
    if (this._menuBtn) this._menuBtn.hidden = false;
    if (this._fixDayBtn) this._fixDayBtn.hidden = !goal || !isFrequency(goal);
    if (this._archiveBtn) {
      this._archiveBtn.hidden = !goal;
      this._archiveBtn.textContent = goal?.archived ? t('goal-dialog.unarchive') : t('goal-dialog.archive');
      this._archiveBtn.setAttribute('aria-pressed', String(!!goal?.archived));
    }
    this._descInput.value = goal?.notes ?? '';
    this._descHighlight?.sync();

    this._dueDateInput.value = goal?.dueDate ?? '';
    this._showDueDateField(!!goal?.dueDate);

    this._tagInputEl.tags = goal?.tags ?? [];

    // Type is chosen once, at creation — a fresh draft always starts at the
    // default (percentage), an existing goal's type is fixed and shown locked.
    this._draftType   = 'percentage';
    this._draftTarget = DEFAULT_TARGET.weekly;
    this._renderTypeSection();

    this._lastValidTitle   = goal?.title ?? '';
    this._lastValidNotes   = goal?.notes ?? '';
    this._lastValidDueDate = goal?.dueDate ?? '';

    this._closeBtn.setAttribute('aria-label',
      this._isNew ? t('goal-dialog.save-and-close') : t('goal-dialog.close'));
    this._modal.shadowRoot?.querySelector('dialog')?.setAttribute('aria-label',
      this._isNew ? t('goal-dialog.title-new') : t('goal-dialog.title-edit'));

    // Draft recovery: target is blank for a new entry, the stored record for an existing one.
    const targetValues = goal
      ? { title: goal.title ?? '', notes: goal.notes, dueDate: goal.dueDate, tags: [...(goal.tags ?? [])] }
      : { title: '', notes: undefined, dueDate: undefined, tags: [] };
    // Existing records: a draft is only ever offered via the button, never silently
    // applied over the real value the form already shows (peek() doesn't write it).
    // New entries: nothing committed to protect, so recovering the draft on open
    // (restoreFor()) is safe and expected.
    const draftValues = this._isNew ? (this._snapshot?.restoreFor() ?? null) : (this._snapshot?.peek() ?? null);
    this._draftToggle.reset({
      draft: draftValues,
      target: targetValues,
      showDraftInitially: this._isNew,
      clearLabel: this._isNew ? t('goal-dialog.draft-clear') : t('goal-dialog.draft-revert'),
      undoLabel:  this._isNew ? t('goal-dialog.draft-undo')  : t('goal-dialog.draft-restore'),
    });

    this._showView('main');
  }

  template() {
    return `
      <style>
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
          margin-block-end: var(--space-3);
        }

        input[type="text"]:focus { border-color: var(--color-accent); }
        input[type="text"]::placeholder { color: var(--color-text-muted); }

        /* ── Deadline — full width, matches input[type=text] styling. Input
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

        /* ── Type selector + target stepper (new goals only) ────────────── */

        .type-field { margin-block-end: var(--space-4); }

        .field-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-2);
        }

        .type-pill-group {
          display: flex;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          padding: var(--space-1);
        }

        .type-pill {
          flex: 1;
          min-block-size: var(--touch-target);
          border: none;
          background: transparent;
          border-radius: var(--radius-full);
          padding-inline: var(--space-2);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .type-pill[aria-checked="true"] {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        /* Locked (existing goal) — plain text, not a control: type is fixed
           after creation, so there is nothing here to interact with. */
        .type-locked {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text-secondary);
          font-size: var(--font-size-body);
          margin: 0;
        }

        .type-locked svg { inline-size: var(--icon-size-sm); block-size: var(--icon-size-sm); flex-shrink: 0; }

        .target-block {
          margin-block-start: var(--space-3);
          padding-block-start: var(--space-3);
          border-block-start: 0.5px solid var(--color-border);
        }

        .target-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .target-stepper {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: var(--space-1);
        }

        .stepper-btn {
          min-block-size: var(--touch-target-small, 32px);
          min-inline-size: var(--touch-target-small, 32px);
          border-radius: var(--radius-full);
          border: none;
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          font-size: var(--font-size-subheading);
          line-height: 1;
          padding: 0;
        }

        .stepper-btn:disabled { opacity: 0.4; cursor: default; }

        .target-value {
          min-inline-size: 1.5ch;
          text-align: center;
          font-weight: var(--font-weight-bold);
          font-variant-numeric: tabular-nums;
        }

        .preset-chip {
          border: 0.5px solid var(--color-border);
          background: transparent;
          border-radius: var(--radius-full);
          padding-inline: var(--space-3);
          min-block-size: var(--touch-target-small, 32px);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
        }

        .preset-chip[aria-pressed="true"] {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .target-hint {
          margin: var(--space-2) 0 0;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
        }

        /* ── Fix-a-day chips (mirrors move-view's picker-heading spacing) ─ */

        .day-chips {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-block-end: var(--space-1);
        }

        .day-chip {
          flex-shrink: 0;
          inline-size: 40px;
          block-size: 48px;
          border-radius: var(--radius-md);
          border: 0.5px solid var(--color-border);
          background: var(--color-surface-raised);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          font-size: var(--font-size-micro);
        }

        .day-chip .dow { text-transform: uppercase; letter-spacing: var(--letter-spacing-caps); color: var(--color-text-muted); }
        .day-chip .num { font-weight: var(--font-weight-semibold); font-variant-numeric: tabular-nums; color: var(--color-text-primary); }

        .day-chip[aria-pressed="true"] {
          background: var(--color-accent);
          border-color: var(--color-accent);
        }
        .day-chip[aria-pressed="true"] .dow,
        .day-chip[aria-pressed="true"] .num { color: var(--color-text-inverse); }

        .day-chip:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Description textarea + highlight overlay ───────────────────── */

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
          line-height: 1.5;
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
          min-block-size: 3.5rem;
          overflow: hidden;
          margin-block-end: 0;
          line-height: 1.5;
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

        /* ── Tags — chip/suggestion styling lives in <tag-input> now ─────── */

        tag-input {
          margin-block-end: var(--space-4);
        }

        /* ── Buttons ─────────────────────────────────────────────────────── */

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

        /* Toggle-type sheet items get a leading icon and a trailing checkmark
           (shown only when active) so they read as switches, not actions. */
        .sheet-item-toggle { gap: var(--space-3); }

        .sheet-toggle-icon {
          display: flex;
          flex-shrink: 0;
          color: var(--color-text-secondary);
        }

        .sheet-toggle-icon svg { inline-size: var(--icon-size-sm); block-size: var(--icon-size-sm); }

        .sheet-toggle-label { flex: 1; }

        .sheet-toggle-check {
          display: flex;
          flex-shrink: 0;
          color: var(--color-accent);
          visibility: hidden;
        }

        .sheet-toggle-check svg { inline-size: var(--icon-size-sm); block-size: var(--icon-size-sm); }

        .sheet-item-toggle[aria-pressed="true"] .sheet-toggle-check { visibility: visible; }

        .sheet-divider {
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          margin-block: var(--space-1);
        }

        /* ── Move view ───────────────────────────────────────────────────── */

        .picker-heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-3);
        }

        #move-year-select {
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
          cursor: pointer;
        }

        #move-year-select:focus { border-color: var(--color-accent); }

        #move-section-group {
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

        /* ── Footer layouts ──────────────────────────────────────────────── */

        .actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          gap: var(--space-2);
          margin-inline-start: auto;
        }

        #menu-btn { background: none; color: var(--color-text-secondary); padding-inline: var(--space-2); display: flex; align-items: center; }
        #delete { background: none; color: var(--color-danger); }
        #archive { background: none; color: var(--color-text-secondary); }
        #close, #move-back { background: none; color: var(--color-text-secondary); }
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

        #copy-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #copy-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        #move-btn {
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        #move-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
      </style>

      <modal-dialog id="modal">
        <!-- ── View: main edit ───────────────────────────────────────────── -->
        <div id="view-main">
          <input id="input"
                 type="text"
                 aria-label="${t('goal-dialog.placeholder')}"
                 placeholder="${t('goal-dialog.placeholder')}"
                 autocomplete="off"
                 enterkeyhint="go"
                 maxlength="80" />
          <div class="type-field">
            <p class="field-label">${t('goal-dialog.type-label')}</p>
            <div class="type-pill-group" id="type-pills" role="radiogroup" aria-label="${t('goal-dialog.type-label')}">
              ${TYPES.map(ty => `
                <button type="button" class="type-pill" data-type="${ty}" role="radio" aria-checked="false">${t('goal-dialog.type-' + ty)}</button>
              `).join('')}
            </div>
            <p class="type-locked" id="type-locked" hidden>${icons.lock}<span id="type-locked-label"></span></p>
            <div class="target-block" id="target-block" hidden>
              <p class="field-label" id="target-label"></p>
              <div class="target-row">
                <div class="target-stepper">
                  <button type="button" class="stepper-btn" id="target-down" aria-label="${t('goal-dialog.target-decrease')}">−</button>
                  <span class="target-value" id="target-value"></span>
                  <button type="button" class="stepper-btn" id="target-up" aria-label="${t('goal-dialog.target-increase')}">+</button>
                </div>
                <button type="button" class="preset-chip" id="everyday-chip" hidden>${t('goal-dialog.everyday-preset')}</button>
              </div>
              <p class="target-hint" id="target-hint"></p>
            </div>
          </div>
          <div class="textarea-wrap">
            <div class="md-highlight" aria-hidden="true"></div>
            <textarea id="desc-input"
                      aria-label="${t('goal-dialog.notes-placeholder')}"
                      placeholder="${t('goal-dialog.notes-placeholder')}"></textarea>
            <button type="button" class="copy-btn" id="desc-copy-btn" aria-label="${t('goal-dialog.copy-notes')}" title="${t('goal-dialog.copy-notes')}">${icons.copy}</button>
          </div>
          <div class="duedate-field" hidden>
            <input id="duedate-input"
                   type="date"
                   aria-label="${t('goal-dialog.duedate-toggle')}" />
            <button type="button" id="duedate-clear" aria-label="${t('goal-dialog.duedate-clear')}">${icons.xMark}</button>
          </div>
          <tag-input id="tag-input"></tag-input>
        </div>

        <!-- ── View: move to year+section ───────────────────────────────── -->
        <div id="view-move" hidden>
          <p class="picker-heading">${t('goal-dialog.move-to-year')}</p>
          <label class="picker-heading" for="move-year-select">${t('goal-dialog.move-year-label')}</label>
          <select id="move-year-select"></select>
          <div id="move-section-group" role="group" aria-label="${t('goal-dialog.move-section-label')}">
            ${SECTIONS.map((s, i) => `
              <label class="section-option">
                <input type="radio" name="goal-move-section" value="${s}" ${i === 0 ? 'checked' : ''}>
                ${t('goal-dialog.move-section-' + s)}
              </label>
            `).join('')}
          </div>
        </div>

        <!-- ── View: fix a day (frequency goals only) ─────────────────────── -->
        <div id="view-fixday" hidden>
          <p class="picker-heading">${t('goal-dialog.fixday-heading')}</p>
          <div class="day-chips" id="fixday-chips"></div>
        </div>

        <!-- ── Footer: main ─────────────────────────────────────────────── -->
        <div slot="footer" class="actions footer-main">
          <button type="button" id="menu-btn" hidden aria-label="${t('goal-dialog.more-actions')}">${icons.dotsVertical}</button>
          <button type="button" id="delete" hidden>${t('goal-dialog.delete')}</button>
          <button type="button" id="archive" hidden aria-pressed="false">${t('goal-dialog.archive')}</button>
          <button type="button" id="draft-toggle-btn" hidden></button>
          <div class="actions-end">
            <button type="button" id="close" aria-label="${t('goal-dialog.close')}">${t('goal-dialog.close')}</button>
          </div>
        </div>

        <!-- ── Footer: move ─────────────────────────────────────────────── -->
        <div slot="footer" class="actions footer-move" hidden>
          <button type="button" id="move-back">${t('goal-dialog.picker-back')}</button>
          <div class="actions-end">
            <button type="button" id="move-btn" disabled>${t('goal-dialog.move-cta')}</button>
            <button type="button" id="copy-btn" disabled>${t('goal-dialog.copy-cta')}</button>
          </div>
        </div>

        <!-- ── Footer: fix a day ────────────────────────────────────────── -->
        <div slot="footer" class="actions footer-fixday" hidden>
          <button type="button" id="fixday-back">${t('goal-dialog.picker-back')}</button>
        </div>

        <div id="save-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
      </modal-dialog>

      <!-- ── Action sheet ─────────────────────────────────────────────────── -->
      <modal-dialog id="action-sheet" aria-label="${t('goal-dialog.more-actions')}">
        <button type="button" id="action-duedate-toggle" class="sheet-item sheet-item-toggle" aria-pressed="false">
          <span class="sheet-toggle-icon">${icons.calendar}</span>
          <span class="sheet-toggle-label">${t('goal-dialog.duedate-toggle')}</span>
          <span class="sheet-toggle-check">${icons.check}</span>
        </button>
        <button type="button" id="action-fixday-btn" class="sheet-item" hidden>${t('goal-dialog.fixday-menu')}</button>
        <hr class="sheet-divider">
        <button type="button" id="action-move-btn" class="sheet-item">${t('goal-dialog.move-to-year')}</button>
        <button type="button" id="action-create-btn" class="sheet-item">${t('goal-dialog.create-list-item')}</button>
        <button type="button" id="action-export-btn" class="sheet-item">${t('goal-dialog.extract-markdown')}</button>
        <button type="button" id="action-share-btn" class="sheet-item">${t('goal-dialog.share-goal')}</button>
      </modal-dialog>

      <!-- ── List picker (opens as sub-modal for Create list item) ──────── -->
      <list-picker-dialog id="list-picker"></list-picker-dialog>
    `;
  }

  subscribe() {
    this._modal         = this.shadowRoot.querySelector('#modal');
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
    this._input         = this.shadowRoot.querySelector('#input');
    this._descInput     = this.shadowRoot.querySelector('#desc-input');
    this._descHighlight = attachMarkdownHighlight(
      this._descInput,
      this.shadowRoot.querySelector('.md-highlight'),
    );
    this._descCopyBtn   = this.shadowRoot.querySelector('#desc-copy-btn');
    this._dueDateInput  = this.shadowRoot.querySelector('#duedate-input');
    this._dueDateClear  = this.shadowRoot.querySelector('#duedate-clear');
    this._dueDateToggle = this.shadowRoot.querySelector('#action-duedate-toggle');
    this._dueDateRow    = this.shadowRoot.querySelector('.duedate-field');
    this._tagInputEl     = this.shadowRoot.querySelector('#tag-input');
    this._tagInputEl.existingTags = this._existingTags ?? [];
    this._deleteBtn     = this.shadowRoot.querySelector('#delete');
    this._archiveBtn    = this.shadowRoot.querySelector('#archive');
    this._menuBtn       = this.shadowRoot.querySelector('#menu-btn');
    this._closeBtn      = this.shadowRoot.querySelector('#close');
    this._draftToggleBtn = this.shadowRoot.querySelector('#draft-toggle-btn');
    this._saveStatus    = this.shadowRoot.querySelector('#save-status');
    this._viewMain      = this.shadowRoot.querySelector('#view-main');
    this._viewMove      = this.shadowRoot.querySelector('#view-move');
    this._footerMain    = this.shadowRoot.querySelector('.footer-main');
    this._footerMove    = this.shadowRoot.querySelector('.footer-move');
    this._moveYearSel   = this.shadowRoot.querySelector('#move-year-select');
    this._moveSectionGrp = this.shadowRoot.querySelector('#move-section-group');
    this._moveMoveBtn   = this.shadowRoot.querySelector('#move-btn');
    this._moveCopyBtn   = this.shadowRoot.querySelector('#copy-btn');
    this._actionSheet       = this.shadowRoot.querySelector('#action-sheet');
    this._listPickerDialog  = this.shadowRoot.querySelector('#list-picker');

    this._typePillGroup  = this.shadowRoot.querySelector('#type-pills');
    this._typePills      = [...this.shadowRoot.querySelectorAll('.type-pill')];
    this._typeLocked      = this.shadowRoot.querySelector('#type-locked');
    this._typeLockedLabel = this.shadowRoot.querySelector('#type-locked-label');
    this._targetBlock    = this.shadowRoot.querySelector('#target-block');
    this._targetLabel    = this.shadowRoot.querySelector('#target-label');
    this._targetValueEl  = this.shadowRoot.querySelector('#target-value');
    this._targetDownBtn  = this.shadowRoot.querySelector('#target-down');
    this._targetUpBtn    = this.shadowRoot.querySelector('#target-up');
    this._everydayChip   = this.shadowRoot.querySelector('#everyday-chip');
    this._targetHint     = this.shadowRoot.querySelector('#target-hint');

    this._viewFixDay     = this.shadowRoot.querySelector('#view-fixday');
    this._footerFixDay   = this.shadowRoot.querySelector('.footer-fixday');
    this._fixDayBtn      = this.shadowRoot.querySelector('#action-fixday-btn');
    this._fixDayBack     = this.shadowRoot.querySelector('#fixday-back');
    this._fixDayChips    = this.shadowRoot.querySelector('#fixday-chips');

    this._isNew           = false;
    this._lastValidTitle   = '';
    this._lastValidNotes   = '';
    this._lastValidDueDate = '';

    // ── Main view ─────────────────────────────────────────────────────────────

    this._onTitleBlur = () => {
      const v = this._input.value.trim();
      if (this._isNew) {
        // Commit on blur (like item-dialog) so a new goal is saved the moment the
        // title loses focus — via Enter, tapping another field, or the mobile Go
        // key — instead of relying on the close click, which mobile can swallow
        // while dismissing the keyboard. Once committed we're in edit mode, so
        // modal-close dispatches goal-closed rather than a second goal-created.
        if (!v) return;
        const notes   = this._descInput.value.trim() || undefined;
        const dueDate = this._dueDateInput.value || undefined;
        const tags    = this._tagInputEl.commitPending();
        const tracking = this._draftTracking();
        this._isNew = false;
        this._lastValidTitle = v;
        this._snapshot?.clear();
        this.dispatchEvent(new CustomEvent('goal-created', {
          bubbles: true, composed: true, detail: { title: v, notes, dueDate, tags, tracking },
        }));
        this._renderTypeSection();
        return;
      }
      if (!v) { this._input.value = this._lastValidTitle; return; }
      if (v === this._lastValidTitle) return;
      this._lastValidTitle = v;
      this.dispatchEvent(new CustomEvent('goal-title-changed', {
        bubbles: true, composed: true, detail: { title: v },
      }));
      this._announceSaved();
    };

    this._onDescInput = () => {
      this._syncDescHeight();
    };

    this._onNotesBlur = () => {
      if (this._isNew) return;
      const v = this._descInput.value.trim();
      if (v === this._lastValidNotes) return;
      this._lastValidNotes = v;
      this.dispatchEvent(new CustomEvent('goal-notes-changed', {
        bubbles: true, composed: true, detail: { notes: v || undefined },
      }));
      this._announceSaved();
    };

    this._onDescCopy = async () => {
      const text = this._descInput.value.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        this._descCopyBtn.innerHTML = icons.check;
        this._descCopyBtn.classList.add('is-copied');
        this._copyResetTimer = setTimeout(() => {
          this._descCopyBtn.innerHTML = icons.copy;
          this._descCopyBtn.classList.remove('is-copied');
        }, 1500);
      } catch {} // clipboard unavailable — fail silently
    };

    this._onDueDateInput = () => {
      if (this._isNew) return;
      const v = this._dueDateInput.value;
      if (v === this._lastValidDueDate) return;
      this._lastValidDueDate = v;
      this.dispatchEvent(new CustomEvent('goal-duedate-changed', {
        bubbles: true, composed: true, detail: { dueDate: v || undefined },
      }));
      this._announceSaved();
    };

    // Triggered from the overflow menu — closes the sheet (the real use case
    // is "turn this on and go fill it in", not toggling several fields in one
    // visit), but still doesn't auto-focus the revealed field: focusing it
    // right after a menu interaction would be a jarring second focus change
    // (and would dismiss the on-screen keyboard if title/notes had it open).
    // Let the user tap in when they're ready.
    this._onDueDateToggle = () => {
      this._showDueDateField(this._dueDateRow.hidden);
      requestAnimationFrame(() => this._syncDescHeight());
      this._actionSheet.close();
    };

    this._onDueDateClear = () => {
      this._dueDateInput.value = '';
      this._onDueDateInput();
    };

    this._onClose = () => { this._modal.close(); };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('goal-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      if (this._isNew) {
        const title = this._input.value.trim();
        if (title) {
          this._snapshot?.clear(); // committed — drop any hide-time snapshot
          const notes = this._descInput.value.trim() || undefined;
          const dueDate = this._dueDateInput.value || undefined;
          const tags  = this._tagInputEl.commitPending();
          const tracking = this._draftTracking();
          // Mark committed so a blur fired *after* this close (the browser fires
          // the dialog's close before the focused input's blur) doesn't re-create
          // via _onTitleBlur's commit-on-blur path.
          this._isNew = false;
          this._lastValidTitle = title;
          this.dispatchEvent(new CustomEvent('goal-created', {
            bubbles: true, composed: true, detail: { title, notes, dueDate, tags, tracking },
          }));
        } else {
          this._snapshot?.capture(); // can't commit without a title — preserve notes/tags
        }
      } else {
        this._snapshot?.clear(); // edited record closed — store owns it now
        this.dispatchEvent(new CustomEvent('goal-closed', { bubbles: true, composed: true }));
      }
      this._actionSheet?.close();
      clearTimeout(this._copyResetTimer);
    };

    this._onKeyDown = e => {
      if (e.key !== 'Enter') return;
      if (this._isNew) {
        if (!this._input.value.trim()) return; // require title for new goals
        this._input.blur(); // commits via _onTitleBlur → _isNew = false
        // Quick-add: reset the form in place and keep the dialog open for the
        // next goal, rather than closing — avoids a native close()/reopen()
        // cycle (and the focus-restoration/keyboard-activation quirk that
        // otherwise causes an inconsistent, browser-dependent auto-reopen).
        this._resetForm(null);
        this._input.focus();
        requestAnimationFrame(() => this._syncDescHeight());
      } else {
        this._input.blur(); // triggers _onTitleBlur before close
        this._modal.close();
      }
    };

    this._onResize  = () => this._syncDescHeight();

    // ── Tag input ─────────────────────────────────────────────────────────────
    // Chip/suggestion mechanics live in <tag-input>; the dialog only decides
    // whether a change is worth propagating upward (suppressed while _isNew,
    // same as every other field — a new goal isn't "changed", it's drafted).

    this._onTagsChanged = e => {
      if (this._isNew) return;
      this.dispatchEvent(new CustomEvent('goal-tags-changed', {
        bubbles: true, composed: true, detail: { tags: e.detail.tags },
      }));
    };
    this._tagInputEl.addEventListener('tags-changed', this._onTagsChanged);

    this._input.addEventListener('keydown', this._onKeyDown);
    this._input.addEventListener('blur',    this._onTitleBlur);
    this._descInput.addEventListener('input', this._onDescInput);
    this._descInput.addEventListener('blur',  this._onNotesBlur);
    this._descCopyBtn.addEventListener('pointerdown', e => e.preventDefault());
    this._descCopyBtn.addEventListener('click', this._onDescCopy);
    this._dueDateInput.addEventListener('change', this._onDueDateInput);
    this._dueDateClear.addEventListener('pointerdown', e => e.preventDefault());
    this._dueDateClear.addEventListener('click', this._onDueDateClear);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this._closeBtn.addEventListener('click', this._onClose);
    this._draftToggle = installDraftToggle(this, {
      button: this._draftToggleBtn,
      applyValues: data => {
        this._applyFormValues(data);
        requestAnimationFrame(() => this._syncDescHeight());
      },
    });
    this._modal.addEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);

    // ── Action sheet ──────────────────────────────────────────────────────────

    this._onMenuBtn = () => this._actionSheet.show();
    this._menuBtn.addEventListener('click', this._onMenuBtn);

    this._dueDateToggle.addEventListener('click', this._onDueDateToggle);

    this._onArchivePD = e => e.preventDefault();
    this._archiveBtn.addEventListener('pointerdown', this._onArchivePD);
    this._onActionArchive = () => {
      const archived = !this._goal?.archived;
      if (this._goal) this._goal = { ...this._goal, archived };
      this._archiveBtn.textContent = archived ? t('goal-dialog.unarchive') : t('goal-dialog.archive');
      this._archiveBtn.setAttribute('aria-pressed', String(archived));
      this.dispatchEvent(new CustomEvent('goal-archived-changed', {
        bubbles: true, composed: true, detail: { archived },
      }));
    };
    this._archiveBtn.addEventListener('click', this._onActionArchive);

    this._onActionMove = () => { this._actionSheet.close(); this._showView('move'); };
    this.shadowRoot.querySelector('#action-move-btn').addEventListener('click', this._onActionMove);

    this._onActionFixDay = () => { this._actionSheet.close(); this._showView('fixday'); };
    this._fixDayBtn.addEventListener('click', this._onActionFixDay);

    this._onActionCreate = () => {
      this._actionSheet.close();
      this._listPickerDialog.lists = this.availableLists;
      this._listPickerDialog.show();
    };
    this.shadowRoot.querySelector('#action-create-btn').addEventListener('click', this._onActionCreate);

    this._onActionExport = () => {
      this._actionSheet.close();
      this._modal.close();
      this.dispatchEvent(new CustomEvent('goal-export-request', {
        bubbles: true, composed: true, detail: { goal: this._goal },
      }));
    };
    this.shadowRoot.querySelector('#action-export-btn').addEventListener('click', this._onActionExport);

    this._onActionShare = () => {
      this._actionSheet.close();
      this._modal.close();
      this.dispatchEvent(new CustomEvent('goal-share-request', {
        bubbles: true, composed: true, detail: { goal: this._goal },
      }));
    };
    this.shadowRoot.querySelector('#action-share-btn').addEventListener('click', this._onActionShare);

    // ── Move view ─────────────────────────────────────────────────────────────

    this._onMoveBack = () => this._showView('main');
    this.shadowRoot.querySelector('#move-back').addEventListener('click', this._onMoveBack);

    this._onMoveChange = () => this._updateMoveCtaState();
    this._moveYearSel.addEventListener('change', this._onMoveChange);
    this._moveSectionGrp.addEventListener('change', this._onMoveChange);

    this._onMoveCta = () => this._commitMove(false);
    this._moveMoveBtn.addEventListener('click', this._onMoveCta);

    this._onCopyCta = () => this._commitMove(true);
    this._moveCopyBtn.addEventListener('click', this._onCopyCta);

    // ── Fix-a-day view (frequency goals only) ───────────────────────────────────

    this._onFixDayBack = () => this._showView('main');
    this._fixDayBack.addEventListener('click', this._onFixDayBack);

    this._onFixDayChipClick = e => {
      const chip = e.target.closest('.day-chip');
      if (!chip || !this._goal) return;
      const iso = chip.dataset.iso;
      const wasLogged = chip.getAttribute('aria-pressed') === 'true';
      this.dispatchEvent(new CustomEvent('goal-entry-toggle', {
        bubbles: true, composed: true, detail: { goal: this._goal, iso },
      }));
      // Reflect immediately — the store round-trip updates `goal` on the next
      // property set, but the toggle should feel instant under a tap.
      const entries = this._goal.tracking.entries;
      this._goal = {
        ...this._goal,
        tracking: {
          ...this._goal.tracking,
          entries: wasLogged ? entries.filter(d => d !== iso) : [...entries, iso].sort(),
        },
      };
      chip.setAttribute('aria-pressed', String(!wasLogged));
    };
    this._fixDayChips.addEventListener('click', this._onFixDayChipClick);

    // ── Type selector + target stepper (new goals only) ─────────────────────────

    this._onTypePillClick = e => {
      const pill = e.target.closest('.type-pill');
      if (!pill || !this._isNew || pill.dataset.type === this._draftType) return;
      this._draftType = pill.dataset.type;
      // Switching type always resets to that type's own default target —
      // weekly's and monthly's scales differ enough (1–7 vs 1–31) that
      // carrying over a stale number from the other type wouldn't be
      // meaningful, so there's no "preserve the number" case to protect.
      if (this._draftType !== 'percentage') this._draftTarget = DEFAULT_TARGET[this._draftType];
      this._renderTypeSection();
    };
    this._typePills.forEach(p => p.addEventListener('click', this._onTypePillClick));

    this._onTargetDown = () => {
      const [min] = TARGET_LIMITS[this._draftType];
      this._draftTarget = Math.max(min, this._draftTarget - 1);
      this._renderTypeSection();
    };
    this._targetDownBtn.addEventListener('click', this._onTargetDown);

    this._onTargetUp = () => {
      const [, max] = TARGET_LIMITS[this._draftType];
      this._draftTarget = Math.min(max, this._draftTarget + 1);
      this._renderTypeSection();
    };
    this._targetUpBtn.addEventListener('click', this._onTargetUp);

    this._onEverydayChip = () => {
      this._draftTarget = 7;
      this._renderTypeSection();
    };
    this._everydayChip.addEventListener('click', this._onEverydayChip);

    // ── List picker (Create list item) ────────────────────────────────────────

    this._onListPick = e => {
      const { targetListIds, newListName, copy } = e.detail;
      this.dispatchEvent(new CustomEvent('goal-create-item', {
        bubbles: true, composed: true,
        detail: {
          goal: this._goal,
          targetListIds, newListName, copy,
          fromYear: this._fromYear,
          fromSection: this._fromSection,
        },
      }));
      this._modal.close();
    };
    this._listPickerDialog.addEventListener('list-pick', this._onListPick);

    this._snapshot = installDialogSnapshot(this, {
      key:      SNAPSHOT_KEY,
      isOpen:   () => !!this._modal.shadowRoot?.querySelector('dialog')?.open,
      recordId: () => this._snapshotRecordId(),
      snapshot: () => {
        const title = this._input.value;
        const notes = this._descInput.value;
        const dueDate = this._dueDateInput.value;
        if (this._isNew) {
          const tags = this._tagInputEl.commitPending();
          return (title.trim() || notes.trim() || dueDate || tags.length) ? { title, notes, dueDate, tags } : null;
        }
        // existing: only if a text field has an unsaved edit (tags/dueDate commit immediately)
        return (title !== this._lastValidTitle || notes !== this._lastValidNotes)
          ? { title, notes, dueDate, tags: this._tagInputEl.tags } : null;
      },
      restore: data => this._applyFormValues(data),
    });
  }

  unsubscribe() {
    this.shadowRoot.removeEventListener('pointerdown', this._onButtonPointerDown);
    this._descHighlight?.detach();
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._input?.removeEventListener('blur',    this._onTitleBlur);
    this._descInput?.removeEventListener('input', this._onDescInput);
    this._descInput?.removeEventListener('blur',  this._onNotesBlur);
    this._descCopyBtn?.removeEventListener('click', this._onDescCopy);
    this._dueDateInput?.removeEventListener('change', this._onDueDateInput);
    this._dueDateToggle?.removeEventListener('click', this._onDueDateToggle);
    this._dueDateClear?.removeEventListener('click', this._onDueDateClear);
    this._tagInputEl?.removeEventListener('tags-changed', this._onTagsChanged);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this._closeBtn?.removeEventListener('click', this._onClose);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
    this._menuBtn?.removeEventListener('click', this._onMenuBtn);
    this._archiveBtn?.removeEventListener('pointerdown', this._onArchivePD);
    this._archiveBtn?.removeEventListener('click', this._onActionArchive);
    this.shadowRoot.querySelector('#action-move-btn')?.removeEventListener('click', this._onActionMove);
    this.shadowRoot.querySelector('#action-create-btn')?.removeEventListener('click', this._onActionCreate);
    this.shadowRoot.querySelector('#action-export-btn')?.removeEventListener('click', this._onActionExport);
    this.shadowRoot.querySelector('#action-share-btn')?.removeEventListener('click', this._onActionShare);
    this.shadowRoot.querySelector('#move-back')?.removeEventListener('click', this._onMoveBack);
    this._moveYearSel?.removeEventListener('change', this._onMoveChange);
    this._moveSectionGrp?.removeEventListener('change', this._onMoveChange);
    this._moveMoveBtn?.removeEventListener('click', this._onMoveCta);
    this._moveCopyBtn?.removeEventListener('click', this._onCopyCta);
    this._listPickerDialog?.removeEventListener('list-pick', this._onListPick);
    this._fixDayBtn?.removeEventListener('click', this._onActionFixDay);
    this._fixDayBack?.removeEventListener('click', this._onFixDayBack);
    this._fixDayChips?.removeEventListener('click', this._onFixDayChipClick);
    this._typePills?.forEach(p => p.removeEventListener('click', this._onTypePillClick));
    this._targetDownBtn?.removeEventListener('click', this._onTargetDown);
    this._targetUpBtn?.removeEventListener('click', this._onTargetUp);
    this._everydayChip?.removeEventListener('click', this._onEverydayChip);
  }

  // ── Draft recovery toggle ─────────────────────────────────────────────────

  // A new goal has no id of its own — scope its draft to the year+section
  // it's being added to, so a draft started in one slot never resurfaces in,
  // or gets overwritten by, another (including a different year).
  _snapshotRecordId() {
    return this._goal?.id ?? `new:${this._fromYear}:${this._fromSection}`;
  }

  _applyFormValues({ title, notes, dueDate, tags }) {
    this._input.value = title ?? '';
    this._descInput.value = notes ?? '';
    this._descHighlight?.sync();
    this._dueDateInput.value = dueDate ?? '';
    this._showDueDateField(!!dueDate);
    this._tagInputEl.tags = tags ?? [];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _draftTracking() {
    return this._draftType === 'percentage'
      ? { type: 'percentage', value: 0 }
      : { type: this._draftType, target: this._draftTarget, entries: [] };
  }

  // Type is chosen once, at creation — an interactive pill group for a fresh
  // draft, a plain locked label (with the target baked into the text) for an
  // existing goal. There is no third "disabled pill group" state on purpose:
  // a greyed-out control still invites tapping, a label doesn't.
  _renderTypeSection() {
    this._typePillGroup.hidden = !this._isNew;
    this._typeLocked.hidden = this._isNew;

    if (!this._isNew) {
      this._targetBlock.hidden = true;
      // this._goal is the source of truth once it's known — but right after an
      // in-session blur-commit (still the same dialog visit, goal-created just
      // fired) nothing hands the real stored record back here, so fall back to
      // the draft that was just submitted; it describes the same goal exactly.
      const type   = this._goal?.tracking?.type   ?? this._draftType;
      const target = this._goal?.tracking?.target ?? this._draftTarget;
      this._typeLockedLabel.textContent = (type === 'weekly' || type === 'monthly')
        ? t(`goal-dialog.type-locked-${type}`, { target })
        : t('goal-dialog.type-locked-percentage');
      return;
    }

    this._typePills.forEach(p => p.setAttribute('aria-checked', String(p.dataset.type === this._draftType)));

    const showTarget = this._draftType !== 'percentage';
    this._targetBlock.hidden = !showTarget;
    if (!showTarget) return;

    const [min, max] = TARGET_LIMITS[this._draftType];
    this._targetValueEl.textContent = String(this._draftTarget);
    this._targetLabel.textContent = t(`goal-dialog.target-label-${this._draftType}`);
    this._targetDownBtn.disabled = this._draftTarget <= min;
    this._targetUpBtn.disabled = this._draftTarget >= max;
    this._everydayChip.hidden = this._draftType !== 'weekly';
    this._everydayChip.setAttribute('aria-pressed', String(this._draftType === 'weekly' && this._draftTarget === 7));
    this._targetHint.textContent = t(`goal-dialog.target-hint-${this._draftType}`, { n: this._draftTarget });
  }

  // The last FIX_DAYS days, oldest first, each a toggle reflecting whether an
  // entry exists for that date — tapping a filled chip removes it, an empty
  // one back-fills it, same control either direction (see CLAUDE.md Sharing-
  // style "one control, two jobs" precedent).
  _renderFixDayChips() {
    if (!this._goal) return;
    const entries = new Set(this._goal.tracking?.entries ?? []);
    const today = todayISO();
    const [ty, tm, td] = today.split('-').map(Number);
    const dows = [t('goal-dialog.dow-sun'), t('goal-dialog.dow-mon'), t('goal-dialog.dow-tue'), t('goal-dialog.dow-wed'), t('goal-dialog.dow-thu'), t('goal-dialog.dow-fri'), t('goal-dialog.dow-sat')];
    const chips = [];
    for (let i = FIX_DAYS - 1; i >= 0; i--) {
      const d = new Date(ty, tm - 1, td - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const logged = entries.has(iso);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'day-chip';
      chip.dataset.iso = iso;
      chip.setAttribute('aria-pressed', String(logged));
      chip.setAttribute('aria-label', `${dows[d.getDay()]} ${d.getDate()}${logged ? `, ${t('goal-dialog.fixday-logged')}` : ''}`);
      chip.innerHTML = `<span class="dow" aria-hidden="true">${dows[d.getDay()]}</span><span class="num" aria-hidden="true">${d.getDate()}</span>`;
      chips.push(chip);
    }
    this._fixDayChips.replaceChildren(...chips);
  }

  _showDueDateField(show) {
    this._dueDateRow.hidden = !show;
    this._dueDateToggle.setAttribute('aria-pressed', String(show));
  }

  _showView(name) {
    this._viewMain.hidden    = name !== 'main';
    this._viewMove.hidden    = name !== 'move';
    this._viewFixDay.hidden  = name !== 'fixday';
    this._footerMain.hidden  = name !== 'main';
    this._footerMove.hidden  = name !== 'move';
    this._footerFixDay.hidden = name !== 'fixday';
    if (name === 'move') this._renderMoveView();
    if (name === 'fixday') this._renderFixDayChips();
  }

  _renderMoveView() {
    const y = Number(this.currentYear);
    this._moveYearSel.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const yr  = y - 2 + i;
      const opt = document.createElement('option');
      opt.value       = String(yr);
      opt.textContent = String(yr);
      this._moveYearSel.appendChild(opt);
    }
    this._moveYearSel.value = this._fromYear ?? String(y);

    const radios = this._moveSectionGrp.querySelectorAll('input[type="radio"]');
    radios.forEach(r => { r.checked = r.value === (this._fromSection ?? 'capstone'); });

    this._updateMoveCtaState();
  }

  _updateMoveCtaState() {
    const toYear    = this._moveYearSel?.value;
    const toSection = this._moveSectionGrp?.querySelector('input:checked')?.value;
    const same = toYear === this._fromYear && toSection === this._fromSection;
    if (this._moveMoveBtn) this._moveMoveBtn.disabled = same;
    if (this._moveCopyBtn) this._moveCopyBtn.disabled = false;
  }

  _commitMove(copy) {
    const toYear    = this._moveYearSel.value;
    const toSection = this._moveSectionGrp.querySelector('input:checked')?.value;
    if (!toSection) return;
    this.dispatchEvent(new CustomEvent('goal-move', {
      bubbles: true, composed: true,
      detail: {
        goal: this._goal,
        fromYear: this._fromYear, fromSection: this._fromSection,
        toYear, toSection, copy,
      },
    }));
    this._modal.close();
  }

  _syncDescHeight() {
    const ta = this._descInput;
    if (!ta) return;
    ta.style.blockSize = 'auto';
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const dueDateRowH = this._dueDateRow?.hidden ? 0 : (this._dueDateRow?.offsetHeight ?? 0);
    const MIN_H        = 56;
    const CHROME_H     = 320; // approx header + footer + input + tags chrome
    const MIN_WRAP_H   = 100;
    const maxH = Math.max(vh - CHROME_H - dueDateRowH, MIN_WRAP_H);
    ta.style.blockSize = `${Math.max(ta.scrollHeight, MIN_H)}px`;
    const wrap = ta.closest('.textarea-wrap');
    if (wrap) wrap.style.maxBlockSize = `${maxH}px`;
  }

  _announceSaved() {
    if (!this._saveStatus) return;
    this._saveStatus.textContent = t('dialog.saved-sr');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => { this._saveStatus.textContent = ''; }, 1500);
  }
}

customElements.define('goal-dialog', GoalDialog);
