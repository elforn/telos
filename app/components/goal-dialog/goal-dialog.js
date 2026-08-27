import { AppElement } from '../../../_lib/core/app-element.js';
import { attachMarkdownHighlight } from '../../utils/markdown-highlight.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';
import '../tag-input/tag-input.js';
import { icons } from '../../icons.js';
import { installDialogSnapshot } from '../../utils/dialog-snapshot.js';
import { installDraftToggle } from '../../utils/draft-toggle.js';
import { TARGET_LIMITS, FIX_DAY_SPAN, DEFAULT_TARGET, isEntryType, isDecreasing } from '../../utils/tracking.js';
import { todayISO } from '../../utils/today-iso.js';
import { swatches } from '../../utils/color-palette.js';

const SECTIONS  = ['capstone', 'milestones', 'wow', 'focus'];
const SNAPSHOT_KEY = 'telos:snapshot.new-goal';
const TYPES = ['percentage', 'weekly', 'monthly', 'decreasing'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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
    if (this._changeTypeBtn) this._changeTypeBtn.hidden = !goal;
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
    this._selectColor(goal?.color ?? null);

    // Type/target stay editable for the life of the goal (including
    // percentage↔frequency, which just flips the discriminant — see
    // tracking.js). A fresh draft starts at the percentage default; an
    // existing goal seeds from its real current type/target, and starts
    // collapsed behind a plain read-only label — a seldom-changed setting,
    // changed via "Change type" in the ⋮ menu rather than shown expanded on
    // every open. Fix-a-day starts collapsed too, independently.
    this._draftType   = goal?.tracking?.type   ?? 'percentage';
    // `?? DEFAULT_TARGET[this._draftType]` picks up the right seed per type
    // (0 for decreasing, which is falsy but meaningful — never `||` here);
    // the trailing `?? DEFAULT_TARGET.weekly` only matters for 'percentage',
    // which has no entry of its own and never reads _draftTarget anyway.
    this._draftTarget = goal?.tracking?.target ?? DEFAULT_TARGET[this._draftType] ?? DEFAULT_TARGET.weekly;
    this._typeExpanded = false;
    this._fixDayExpanded = false;
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
      ? { title: goal.title ?? '', notes: goal.notes, dueDate: goal.dueDate, tags: [...(goal.tags ?? [])], color: goal.color ?? null }
      : { title: '', notes: undefined, dueDate: undefined, tags: [], color: null };
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

        /* Brief highlight the instant a field is revealed via its footer
           toggle — not shown when the field is already open because the
           goal already has a value (see _resetForm/_applyFormValues,
           which never add this class). An outline ring rather than a
           background wash so it reads the same regardless of the field's
           own background (the due-date box has one, a bare row wouldn't).
           .textarea-wrap gets the same treatment when the field is *hidden*
           instead — collapsing it shifts the layout the same way revealing
           it did, so the notes field is flashed to show where things
           settled (see _onDueDateToggle). */
        @keyframes field-flash-ring {
          0%   { outline-color: transparent; }
          25%  { outline-color: color-mix(in srgb, var(--color-accent) 70%, transparent); }
          100% { outline-color: transparent; }
        }
        .duedate-field.flash-reveal,
        .textarea-wrap.flash-reveal {
          outline: 2px solid transparent;
          outline-offset: 2px;
          animation: field-flash-ring 700ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .duedate-field.flash-reveal, .textarea-wrap.flash-reveal { animation: none; }
        }

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

        /* ── Field toggle icon — a compact, icon-only footer button that
           reveals the Deadline field directly below the tags, replacing an
           earlier icon-in-the-tags-row placement (itself a replacement for
           a full-width text-label chip row, itself a replacement for the
           original overflow-menu toggle — each iteration traded
           discoverability for compactness). Lives inside .actions-end,
           immediately left of Close — deliberately far from Delete on the
           other end of the footer so a mis-tap can't delete the record.
           Starts collapsed (shown only if the goal already has a dueDate —
           see _resetForm/_applyFormValues) so the compact default stays
           compact. Filled accent when the field is open, plain outline
           when closed — same idiom as the pressed pill state elsewhere. ── */
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

        /* ── Type selector + target stepper ──────────────────────────────── */

        .type-field { margin-block-end: var(--space-4); }

        /* Existing goal, type/target: no presence on the main view at all —
           a whole row for three words of read-only context was still too
           prominent for a set-once, rarely-revisited setting. The current
           value instead rides along as trailing text on the ⋮ menu's
           "Change type" item itself (a settings-row pattern: label start,
           value end) — visible only where you'd actually look for it. */
        .sheet-item-value {
          gap: var(--space-2);
        }

        .sheet-item-value-text {
          flex: 1;
          text-align: end;
          color: var(--color-text-muted);
        }

        /* Fix-a-day: a real expand/collapse toggle, unlike type/target's
           menu-triggered reveal — stays visible in both states, chevron
           flips to signal which way tapping it goes. Plain muted label, not
           button chrome — inherits touch-target sizing and cursor from the
           generic button rule above, but overrides padding/background so it
           reads as text, not a control (matches the old locked-label's
           visual weight, and the "minor control" category the copy button
           uses --touch-target-small for — tapped occasionally, not the
           frequently-tapped stepper, which does need the full 40px; see the
           target-hint a11y note in CHANGELOG). */
        .summary-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-block-size: var(--touch-target-small);
          padding-inline: 0;
          background: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: normal;
        }

        .summary-toggle svg {
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
          flex-shrink: 0;
          transition: transform 0.15s;
        }

        .summary-toggle[aria-expanded="true"] svg {
          transform: rotate(180deg);
        }

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
          min-inline-size: 0;
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
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .type-pill[aria-checked="true"] {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        .target-block {
          margin-block-start: var(--space-3);
          padding-block-start: var(--space-3);
          border-block-start: 0.5px solid var(--color-border);
        }

        .target-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2) var(--space-3);
        }

        .target-stepper {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: var(--space-3);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: var(--space-1);
        }

        .stepper-btn {
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
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
          flex-shrink: 0;
          border: 0.5px solid var(--color-border);
          background: transparent;
          border-radius: var(--radius-full);
          padding-inline: var(--space-3);
          min-block-size: var(--touch-target);
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

        /* Month landmark — the strip spans up to 4 months (monthly goals),
           long enough that an undifferentiated run of day chips loses its
           place; a plain label, not a control. */
        .day-divider {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-inline: 2px;
          block-size: 48px;
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          white-space: nowrap;
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
          align-items: center;
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
          <input id="input"
                 type="text"
                 aria-label="${t('goal-dialog.placeholder')}"
                 placeholder="${t('goal-dialog.placeholder')}"
                 autocomplete="off"
                 enterkeyhint="go"
                 maxlength="80" />
          <div class="textarea-wrap">
            <div class="md-highlight" aria-hidden="true"></div>
            <textarea id="desc-input"
                      aria-label="${t('goal-dialog.notes-placeholder')}"
                      placeholder="${t('goal-dialog.notes-placeholder')}"></textarea>
            <button type="button" class="copy-btn" id="desc-copy-btn" aria-label="${t('goal-dialog.copy-notes')}" title="${t('goal-dialog.copy-notes')}">${icons.copy}</button>
          </div>
          <tag-input id="tag-input"></tag-input>
          <div class="duedate-field" hidden>
            <input id="duedate-input"
                   type="date"
                   aria-label="${t('goal-dialog.duedate-toggle')}" />
            <button type="button" id="duedate-clear" aria-label="${t('goal-dialog.duedate-clear')}">${icons.xMark}</button>
          </div>
          <div class="type-field">
            <div class="type-pill-group" id="type-pills" role="radiogroup" aria-label="${t('goal-dialog.type-label')}">
              ${TYPES.map(ty => `
                <button type="button" class="type-pill" data-type="${ty}" role="radio" aria-checked="false">${t('goal-dialog.type-' + ty)}</button>
              `).join('')}
            </div>
            <div class="target-block" id="target-block" hidden>
              <p class="field-label sr-only" id="target-label"></p>
              <div class="target-row">
                <div class="target-stepper">
                  <button type="button" class="stepper-btn" id="target-down" aria-label="${t('goal-dialog.target-decrease')}">−</button>
                  <span class="target-value" id="target-value"></span>
                  <button type="button" class="stepper-btn" id="target-up" aria-label="${t('goal-dialog.target-increase')}">+</button>
                </div>
                <button type="button" class="preset-chip" id="everyday-chip" hidden>${t('goal-dialog.everyday-preset')}</button>
              </div>
            </div>
            <button type="button" class="summary-toggle" id="fixday-summary" hidden aria-expanded="false">
              <span>${t('goal-dialog.fixday-summary')}</span>
              ${icons.chevronDown}
            </button>
            <div class="target-block" id="fixday-inline" hidden>
              <div class="day-chips" id="fixday-chips"></div>
            </div>
          </div>
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

        <!-- ── Footer: main ─────────────────────────────────────────────── -->
        <div slot="footer" class="actions footer-main">
          <button type="button" id="menu-btn" hidden aria-label="${t('goal-dialog.more-actions')}">${icons.dotsVertical}</button>
          <button type="button" id="delete" hidden>${t('goal-dialog.delete')}</button>
          <button type="button" id="archive" hidden aria-pressed="false">${t('goal-dialog.archive')}</button>
          <button type="button" id="draft-toggle-btn" hidden></button>
          <div class="actions-end">
            <button type="button" class="field-icon-btn" id="duedate-chip" aria-pressed="false" aria-label="${t('goal-dialog.duedate-toggle')}" title="${t('goal-dialog.duedate-toggle')}">${icons.calendar}</button>
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

        <div id="save-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
      </modal-dialog>

      <!-- ── Action sheet ─────────────────────────────────────────────────── -->
      <modal-dialog id="action-sheet" aria-label="${t('goal-dialog.more-actions')}">
        <button type="button" id="action-change-type-btn" class="sheet-item sheet-item-value" hidden>
          <span>${t('goal-dialog.change-type-menu')}</span>
          <span class="sheet-item-value-text" id="change-type-value"></span>
        </button>
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
    this._textareaWrap  = this.shadowRoot.querySelector('.textarea-wrap');
    this._descHighlight = attachMarkdownHighlight(
      this._descInput,
      this.shadowRoot.querySelector('.md-highlight'),
    );
    this._descCopyBtn   = this.shadowRoot.querySelector('#desc-copy-btn');
    this._dueDateInput  = this.shadowRoot.querySelector('#duedate-input');
    this._dueDateClear  = this.shadowRoot.querySelector('#duedate-clear');
    this._dueDateToggle = this.shadowRoot.querySelector('#duedate-chip');
    this._dueDateRow    = this.shadowRoot.querySelector('.duedate-field');
    this._tagInputEl     = this.shadowRoot.querySelector('#tag-input');
    this._tagInputEl.existingTags = this._existingTags ?? [];
    this._colorSwatches = this.shadowRoot.querySelector('.color-swatches');
    this._selectedColor = null;
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

    this._typePills        = [...this.shadowRoot.querySelectorAll('.type-pill')];
    this._typePillGroup    = this.shadowRoot.querySelector('#type-pills');
    this._changeTypeBtn   = this.shadowRoot.querySelector('#action-change-type-btn');
    this._changeTypeValue = this.shadowRoot.querySelector('#change-type-value');
    this._targetBlock    = this.shadowRoot.querySelector('#target-block');
    this._targetLabel    = this.shadowRoot.querySelector('#target-label');
    this._targetValueEl  = this.shadowRoot.querySelector('#target-value');
    this._targetDownBtn  = this.shadowRoot.querySelector('#target-down');
    this._targetUpBtn    = this.shadowRoot.querySelector('#target-up');
    this._everydayChip   = this.shadowRoot.querySelector('#everyday-chip');

    this._fixDaySummary  = this.shadowRoot.querySelector('#fixday-summary');
    this._fixDayInline   = this.shadowRoot.querySelector('#fixday-inline');
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
        const color   = this._selectedColor ?? undefined;
        const tracking = this._draftTracking();
        this._isNew = false;
        this._lastValidTitle = v;
        this._snapshot?.clear();
        this.dispatchEvent(new CustomEvent('goal-created', {
          bubbles: true, composed: true, detail: { title: v, notes, dueDate, tags, color, tracking },
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

    // Deliberately does *not* focus the revealed date input: a native date
    // control isn't a text field, so focusing it would swap away whatever
    // on-screen keyboard was up for the field the user was actually editing
    // (e.g. notes) instead of just leaving it be — the scroll+flash below is
    // enough to show the field appeared, without forcing that swap.
    // _flashField (which scrolls the field into view) must run *after*
    // _syncDescHeight, not before: _syncDescHeight resizes the notes
    // textarea's wrap to make room for the newly-revealed field, and that
    // resize lands a frame later than this handler. Scrolling first and
    // resizing second scrolls to a position the layout shift then moves out
    // from under it — the field ends up back off-screen, most noticeable on
    // shorter screens where the deadline field itself can start below the
    // fold. Both run inside the same rAF now so the scroll always targets
    // the settled layout. Closing (hiding) the field instead flashes the
    // notes field — collapsing it shifts the layout the same way opening it
    // did, so the same "here's what moved" cue applies in reverse.
    this._onDueDateToggle = () => {
      const opening = this._dueDateRow.hidden;
      this._showDueDateField(opening);
      requestAnimationFrame(() => {
        this._syncDescHeight();
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
          const color = this._selectedColor ?? undefined;
          const tracking = this._draftTracking();
          // Mark committed so a blur fired *after* this close (the browser fires
          // the dialog's close before the focused input's blur) doesn't re-create
          // via _onTitleBlur's commit-on-blur path.
          this._isNew = false;
          this._lastValidTitle = title;
          this.dispatchEvent(new CustomEvent('goal-created', {
            bubbles: true, composed: true, detail: { title, notes, dueDate, tags, color, tracking },
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

    // ── Colour swatches ──────────────────────────────────────────────────────
    // Mirrors list-dialog exactly: a new goal just tracks _selectedColor for
    // goal-created to pick up; an existing goal commits immediately.
    this._onSwatchClick = e => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      this._selectColor(swatch.dataset.color || null);
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('goal-color-changed', {
          bubbles: true, composed: true,
          detail: { color: this._selectedColor },
        }));
      }
    };
    this._onSwatchPointerDown = e => e.preventDefault();
    this._colorSwatches.addEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches.addEventListener('click', this._onSwatchClick);

    this._input.addEventListener('keydown', this._onKeyDown);
    this._input.addEventListener('blur',    this._onTitleBlur);
    this._descInput.addEventListener('input', this._onDescInput);
    this._descInput.addEventListener('blur',  this._onNotesBlur);
    this._descCopyBtn.addEventListener('pointerdown', e => e.preventDefault());
    this._descCopyBtn.addEventListener('click', this._onDescCopy);
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
        requestAnimationFrame(() => this._syncDescHeight());
      },
    });
    this._modal.addEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);

    // ── Action sheet ──────────────────────────────────────────────────────────

    this._onMenuBtn = () => this._actionSheet.show();
    this._menuBtn.addEventListener('click', this._onMenuBtn);

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

    // ── Fix-a-day (frequency goals only) — inline, a real expand/collapse
    // toggle (unlike type/target's menu-triggered, one-way reveal below).

    this._onFixDaySummaryClick = () => {
      this._fixDayExpanded = !this._fixDayExpanded;
      this._renderFixDaySummary();
      // Land on today, not the oldest day, each time it opens — the strip
      // can run back up to 4 months, and the days worth fixing are almost
      // always recent ones.
      if (this._fixDayExpanded) this._fixDayChips.scrollLeft = this._fixDayChips.scrollWidth;
    };
    this._fixDaySummary.addEventListener('click', this._onFixDaySummaryClick);

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

    // ── Type selector + target stepper (editable for new AND existing goals) ────

    // Reached via "Change type" in the ⋮ menu for an existing goal (not a
    // tap on the readout itself, which is plain text) — reveal-once, no
    // re-collapse control, same idiom as the due-date field toggle just
    // above: once shown, it just stays shown for the rest of this dialog
    // visit. Independent of Fix-a-day now — no coordination needed.
    this._onActionChangeType = () => {
      this._actionSheet.close();
      this._typeExpanded = true;
      this._renderTypeSection();
    };
    this._changeTypeBtn.addEventListener('click', this._onActionChangeType);

    this._onTypePillClick = e => {
      const pill = e.target.closest('.type-pill');
      if (!pill || pill.dataset.type === this._draftType) return;
      this._draftType = pill.dataset.type;
      // Switching to weekly/monthly always resets the *target* to that
      // type's own default — weekly's and monthly's scales differ enough
      // (1–7 vs 1–31) that carrying over a stale number from the other type
      // wouldn't be meaningful. This only resets `target`; `value` and
      // `entries` (the fields that actually hold history) are untouched —
      // see _commitTrackingChange.
      if (this._draftType !== 'percentage') this._draftTarget = DEFAULT_TARGET[this._draftType];
      this._renderTypeSection();
      if (!this._isNew) this._commitTrackingChange();
    };
    this._typePills.forEach(p => p.addEventListener('click', this._onTypePillClick));

    this._onTargetDown = () => {
      const [min] = TARGET_LIMITS[this._draftType];
      this._draftTarget = Math.max(min, this._draftTarget - 1);
      this._renderTypeSection();
      if (!this._isNew) this._commitTrackingChange();
    };
    this._targetDownBtn.addEventListener('click', this._onTargetDown);

    this._onTargetUp = () => {
      const [, max] = TARGET_LIMITS[this._draftType];
      this._draftTarget = Math.min(max, this._draftTarget + 1);
      this._renderTypeSection();
      if (!this._isNew) this._commitTrackingChange();
    };
    this._targetUpBtn.addEventListener('click', this._onTargetUp);

    this._onEverydayChip = () => {
      this._draftTarget = 7;
      this._renderTypeSection();
      if (!this._isNew) this._commitTrackingChange();
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
          return (title.trim() || notes.trim() || dueDate || tags.length || this._selectedColor)
            ? { title, notes, dueDate, tags, color: this._selectedColor } : null;
        }
        // existing: only if a text field has an unsaved edit (tags/dueDate/colour commit immediately)
        return (title !== this._lastValidTitle || notes !== this._lastValidNotes)
          ? { title, notes, dueDate, tags: this._tagInputEl.tags, color: this._selectedColor } : null;
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
    this._colorSwatches?.removeEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches?.removeEventListener('click', this._onSwatchClick);
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
    this._fixDaySummary?.removeEventListener('click', this._onFixDaySummaryClick);
    this._fixDayChips?.removeEventListener('click', this._onFixDayChipClick);
    this._changeTypeBtn?.removeEventListener('click', this._onActionChangeType);
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

  _applyFormValues({ title, notes, dueDate, tags, color }) {
    this._input.value = title ?? '';
    this._descInput.value = notes ?? '';
    this._descHighlight?.sync();
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

  // ── Private ───────────────────────────────────────────────────────────────

  // Full widened shape from the start (see tracking.js) — value/target/
  // entries all present regardless of which type is picked, so a brand-new
  // goal already conforms to the same shape a switched-type goal would.
  _draftTracking() {
    return { type: this._draftType, value: 0, target: this._draftTarget, entries: [] };
  }

  // Existing goal: no presence on the main view at all until "Change type"
  // is tapped in the ⋮ menu (_onActionChangeType) — even a plain read-only
  // line was still a whole row for three words. The current value instead
  // rides along as trailing text on that menu item itself, kept in sync on
  // every render regardless of expand state. Reveal-once once opened from
  // the menu, no re-collapse control — same idiom as the due-date field
  // toggle. A brand-new goal never collapses at all — picking a type is the
  // point of creating one, so the full picker always shows immediately.
  // Independent of Fix-a-day (see _renderFixDaySummary) — the two used to
  // share one expansion slot; they no longer do, since type is menu-gated
  // now and doesn't need to coordinate with anything.
  _renderTypeSection() {
    const showTypeEditor = this._isNew || this._typeExpanded;
    this._typePillGroup.hidden = !showTypeEditor;
    this._renderFixDaySummary();

    // 'percentage' is the one type with no target concept at all — every
    // other type (including any future one) uses its own type-summary-*
    // string rather than silently falling back to "Percentage" here.
    this._changeTypeValue.textContent = this._draftType === 'percentage'
      ? t('goal-dialog.type-percentage')
      : t(`goal-dialog.type-summary-${this._draftType}`, { target: this._draftTarget });

    if (!showTypeEditor) {
      this._targetBlock.hidden = true;
      return;
    }

    this._typePills.forEach(p => p.setAttribute('aria-checked', String(p.dataset.type === this._draftType)));

    const showTarget = isEntryType(this._draftType);
    this._targetBlock.hidden = !showTarget;
    if (!showTarget) return;

    const [min, max] = TARGET_LIMITS[this._draftType];
    this._targetValueEl.textContent = String(this._draftTarget);
    this._targetLabel.textContent = t(`goal-dialog.target-label-${this._draftType}`);
    // Weekly/monthly leave the label screen-reader-only — the bare stepper
    // number reads fine next to the "Every day" chip for context. Decreasing
    // has no such chip, so a bare "0" next to nothing would be opaque —
    // this is the one type whose label actually needs to be seen.
    this._targetLabel.classList.toggle('sr-only', this._draftType !== 'decreasing');
    this._targetDownBtn.disabled = this._draftTarget <= min;
    this._targetUpBtn.disabled = this._draftTarget >= max;
    this._everydayChip.hidden = this._draftType !== 'weekly';
    this._everydayChip.setAttribute('aria-pressed', String(this._draftType === 'weekly' && this._draftTarget === 7));
  }

  // Fix-a-day: a real expand/collapse toggle (see _onFixDaySummaryClick),
  // visible whenever the goal is currently frequency regardless of expand
  // state — unlike type/target's reveal-once menu trigger, this button
  // never hides itself, just flips its chevron. Derived from _draftType,
  // not this._goal — callers set _draftType and call _renderTypeSection
  // (which calls this) before _commitTrackingChange() has updated
  // this._goal, so this._goal.tracking.type would still read the stale,
  // pre-switch value here.
  _renderFixDaySummary() {
    const canFixDay = !this._isNew && isEntryType(this._draftType);
    if (!canFixDay && this._fixDayExpanded) this._fixDayExpanded = false;
    this._fixDaySummary.hidden = !canFixDay;
    this._fixDaySummary.setAttribute('aria-expanded', String(this._fixDayExpanded));
    this._fixDayInline.hidden = !this._fixDayExpanded;
    if (this._fixDayExpanded) this._renderFixDayChips();
  }

  // Persists a type or target edit for an existing goal immediately (unlike
  // the new-goal draft, which only commits on title blur/close). value and
  // entries both carry through untouched regardless of which type is now
  // active — that's the whole point: switching never destroys the inactive
  // side, so switching back recovers exactly what was there before. Doesn't
  // require this._goal to be known: right after an in-session blur-commit
  // it's still null (home-page resolves the target goal from its own
  // _editingGoal, not from this event's detail), and a goal that new
  // genuinely has no prior value/entries yet, so the `?? 0`/`?? []`
  // fallbacks are exactly correct, not just safe defaults.
  _commitTrackingChange() {
    const tracking = {
      type: this._draftType,
      value: this._goal?.tracking?.value ?? 0,
      target: this._draftTarget,
      entries: this._goal?.tracking?.entries ?? [],
    };
    if (this._goal) this._goal = { ...this._goal, tracking };
    this.dispatchEvent(new CustomEvent('goal-tracking-changed', {
      bubbles: true, composed: true, detail: { tracking },
    }));
    this._announceSaved();
  }

  // The last FIX_DAY_SPAN[type] days, oldest first, each a toggle reflecting
  // whether an entry exists for that date — tapping a filled chip removes it,
  // an empty one back-fills it, same control either direction (see CLAUDE.md
  // Sharing-style "one control, two jobs" precedent). Sized per type since
  // that's exactly how far back a backfill can still move the score (see
  // FIX_DAY_SPAN). A month-label divider is inserted wherever the strip
  // crosses into a new calendar month — plain landmarks, not chips.
  _renderFixDayChips() {
    if (!this._goal) return;
    const type = this._goal.tracking.type;
    const entries = new Set(this._goal.tracking?.entries ?? []);
    const today = todayISO();
    const [ty, tm, td] = today.split('-').map(Number);
    const dows = [t('goal-dialog.dow-sun'), t('goal-dialog.dow-mon'), t('goal-dialog.dow-tue'), t('goal-dialog.dow-wed'), t('goal-dialog.dow-thu'), t('goal-dialog.dow-fri'), t('goal-dialog.dow-sat')];
    const span = FIX_DAY_SPAN[type];
    const nodes = [];
    let lastMonth = null;
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(ty, tm - 1, td - i);
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        const divider = document.createElement('span');
        divider.className = 'day-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.textContent = t(`goal-dialog.month-${MONTH_KEYS[lastMonth]}`);
        nodes.push(divider);
      }
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const logged = entries.has(iso);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'day-chip';
      chip.dataset.iso = iso;
      chip.setAttribute('aria-pressed', String(logged));
      const loggedWord = t(isDecreasing(this._goal) ? 'goal-dialog.fixday-slipped' : 'goal-dialog.fixday-logged');
      chip.setAttribute('aria-label', `${dows[d.getDay()]} ${d.getDate()}${logged ? `, ${loggedWord}` : ''}`);
      chip.innerHTML = `<span class="dow" aria-hidden="true">${dows[d.getDay()]}</span><span class="num" aria-hidden="true">${d.getDate()}</span>`;
      nodes.push(chip);
    }
    this._fixDayChips.replaceChildren(...nodes);
  }

  _showDueDateField(show) {
    this._dueDateRow.hidden = !show;
    this._dueDateToggle.setAttribute('aria-pressed', String(show));
  }

  // A brief outline pulse marking a field that just appeared via its footer
  // toggle — never called when a field opens because it already had a value
  // (see _resetForm/_applyFormValues, which call _showDueDateField directly).
  // scrollIntoView matters here: the field can end up below the fold of the
  // scrollable dialog (e.g. a long notes textarea pushes it down) — flashing
  // an off-screen field is invisible. setTimeout rather than animationend,
  // matching goal-item's _logTick — under prefers-reduced-motion the
  // animation is `none`, so animationend would never fire and the class
  // would stick until the next toggle removed it.
  _flashField(el) {
    clearTimeout(el._flashTimer);
    el.classList.remove('flash-reveal');
    void el.offsetWidth; // force reflow so a rapid re-toggle restarts the animation
    el.classList.add('flash-reveal');
    this._scrollWithinModalBody(el);
    el._flashTimer = setTimeout(() => el.classList.remove('flash-reveal'), 700);
  }

  // el.scrollIntoView() walks *every* scrollable ancestor, including
  // modal-dialog's own <dialog> element — which has overflow:hidden (no
  // scrollbar, never user-scrollable) but is still a valid scroll container
  // per spec, so scrollIntoView silently nudges its scrollTop too. That
  // offset has no way to reset itself (nothing lets the user scroll it
  // back), so it accumulates across every reveal/hide, progressively
  // shifting the whole card upward — the drag handle can end up pushed
  // above the visible card entirely (confirmed via dialog.scrollTop
  // climbing on repeated reveals in on-device + desktop testing, see
  // item-dialog.js's identical fix). Scrolling `.body` (the modal's actual
  // intended scroll region) directly, instead of asking the browser to walk
  // the whole ancestor chain, avoids ever touching dialog's own scrollTop.
  _scrollWithinModalBody(el) {
    const body = this._modal?.shadowRoot?.querySelector('.body');
    if (!body) return;
    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elCenterInBody = (elRect.top - bodyRect.top) + body.scrollTop + elRect.height / 2;
    const targetScrollTop = Math.max(0, elCenterInBody - body.clientHeight / 2);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.scrollTo({ top: targetScrollTop, behavior: reduced ? 'auto' : 'smooth' });
  }

  _showView(name) {
    this._viewMain.hidden    = name !== 'main';
    this._viewMove.hidden    = name !== 'move';
    this._footerMain.hidden  = name !== 'main';
    this._footerMove.hidden  = name !== 'move';
    if (name === 'move') this._renderMoveView();
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
