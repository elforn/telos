import { AppElement } from '../../../_lib/core/app-element.js';
import { attachMarkdownHighlight } from '../../utils/markdown-highlight.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';
import { icons } from '../../icons.js';
import { tagColor } from '../../utils/tag-color.js';

const DRAFT_KEY = 'telos:draft.new-goal';
const SECTIONS  = ['capstone', 'milestones', 'wow', 'focus'];

class GoalDialog extends AppElement {
  // ── Public properties ─────────────────────────────────────────────────────

  set currentYear(val)    { this._currentYear    = val; }
  get currentYear()       { return this._currentYear ?? new Date().getFullYear(); }

  set availableLists(val) { this._availableLists = val ?? []; }
  get availableLists()    { return this._availableLists ?? []; }

  set existingTags(val)   { this._existingTags   = val ?? []; }

  // ── Public API ────────────────────────────────────────────────────────────

  open(goal = null, { year, section } = {}) {
    this._goal        = goal;
    this._isNew       = !goal;
    this._fromYear    = year    ?? String(this.currentYear);
    this._fromSection = section ?? 'capstone';
    const draft = this._isNew ? this._loadDraft() : null;
    this._input.value = goal?.title ?? draft?.title ?? '';
    this._saveBtn.disabled = !this._input.value.trim();
    if (this._deleteBtn) this._deleteBtn.hidden = !goal;
    if (this._menuBtn) this._menuBtn.hidden = !goal;
    this._descInput.value = goal?.notes ?? draft?.notes ?? '';
    this._descHighlight?.sync();

    this._tags = [...(goal?.tags ?? draft?.tags ?? [])];
    this._tagInput.value = '';
    this._renderTagChips();
    this._updateSuggestions();

    this._saved = false;
    this._showView('main');
    this._modal.show(this._input);
    setTimeout(() => {
      const len = this._input.value.length;
      this._input.setSelectionRange(len, len);
      requestAnimationFrame(() => this._syncDescHeight());
    }, 0);
  }

  template() {
    return `
      <style>
        /* Halve the modal's default 24px top/bottom padding */
        #modal { --space-6: var(--space-3); }

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
        textarea::selection   { color: var(--color-text-primary); }

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

        /* ── Tags ────────────────────────────────────────────────────────── */

        .tag-chips-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          align-items: center;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-2) var(--space-3);
          min-block-size: var(--touch-target);
          box-sizing: border-box;
          cursor: text;
          margin-block-end: var(--space-4);
        }

        .tag-chips-wrap:focus-within { border-color: var(--color-accent); }

        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding-block: var(--space-1);
          padding-inline-start: var(--space-3);
          padding-inline-end: var(--space-1);
          color: var(--color-text-primary);
          border-radius: var(--radius-full);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          white-space: nowrap;
          min-block-size: 28px;
          border: none;
          cursor: pointer;
          touch-action: manipulation;
        }

        .tag-chip:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .tag-chip-x {
          background: rgba(0,0,0,0.12);
          border-radius: var(--radius-full);
          inline-size: 20px;
          block-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          font-size: 0.9em;
          pointer-events: none;
        }

        .tag-chip:hover .tag-chip-x { background: rgba(0,0,0,0.22); }

        #tag-input {
          flex: 1;
          min-inline-size: 80px;
          background: none;
          border: none;
          padding: 0;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          margin-block-end: 0;
          inline-size: auto;
          display: inline;
        }

        #tag-input::placeholder { color: var(--color-text-muted); }

        /* ── Tag suggestions ─────────────────────────────────────────────── */

        .tag-area {
          position: relative;
          margin-block-end: var(--space-4);
        }

        .tag-area .tag-chips-wrap {
          margin-block-end: 0;
        }

        #tag-suggestions {
          position: absolute;
          inset-block-end: 100%;
          inset-inline: 0;
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          padding-block-start: var(--space-3);
          padding-block-end: var(--space-2);
          background: var(--color-surface);
          border-block-start: 0.5px solid var(--color-border);
          box-shadow: 0 -4px 10px rgba(0,0,0,0.07);
          border-start-start-radius: var(--radius-sm);
          border-start-end-radius: var(--radius-sm);
          z-index: 1;
        }

        #tag-suggestions[hidden] { display: none; }

        .tag-suggestion {
          min-block-size: 28px;
          padding-block: 0;
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-caption);
          touch-action: manipulation;
        }

        .tag-suggestion:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Buttons ─────────────────────────────────────────────────────── */

        button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
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

        #action-sheet {
          position: fixed;
          inset-block-end: 0;
          inset-inline-start: 0;
          inset-block-start: auto;
          margin: 0;
          inline-size: 100%;
          max-inline-size: 100%;
          background: var(--color-surface);
          border: none;
          border-start-start-radius: var(--radius-lg);
          border-start-end-radius: var(--radius-lg);
          border-end-start-radius: 0;
          border-end-end-radius: 0;
          padding: 0;
          padding-block-end: calc(var(--space-4) + var(--safe-area-bottom, 0px));
          box-shadow: var(--shadow-sheet);
        }

        @keyframes sheet-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        #action-sheet[open] { animation: sheet-up 0.25s cubic-bezier(0.32, 0.72, 0, 1); }

        @media (prefers-reduced-motion: reduce) {
          #action-sheet[open] { animation: none; }
        }

        #action-sheet::backdrop { background: var(--color-overlay); }

        .sheet-handle {
          inline-size: 36px;
          block-size: 4px;
          border-radius: var(--radius-full);
          background: var(--color-border);
          margin: var(--space-3) auto var(--space-1);
        }

        .sheet-item {
          display: flex;
          align-items: center;
          min-block-size: var(--touch-target-lg);
          padding-inline: var(--space-5);
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
        #cancel, #move-back { background: none; color: var(--color-text-secondary); }

        #save, #copy-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled, #copy-btn:disabled {
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
          <div class="textarea-wrap">
            <div class="md-highlight" aria-hidden="true"></div>
            <textarea id="desc-input"
                      aria-label="${t('goal-dialog.notes-placeholder')}"
                      placeholder="${t('goal-dialog.notes-placeholder')}"></textarea>
            <button type="button" class="copy-btn" id="desc-copy-btn" aria-label="${t('goal-dialog.copy-notes')}" title="${t('goal-dialog.copy-notes')}">${icons.copy}</button>
          </div>
          <div class="tag-area">
            <div id="tag-suggestions" hidden aria-label="${t('goal-dialog.tags-label')}"></div>
            <div class="tag-chips-wrap" id="tag-chips-wrap" role="group" aria-label="${t('goal-dialog.tags-label')}">
              <input type="text"
                     id="tag-input"
                     aria-label="${t('goal-dialog.tags-placeholder')}"
                     placeholder="${t('goal-dialog.tags-placeholder')}"
                     autocomplete="off"
                     autocapitalize="none" />
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
          <div class="actions-end">
            <button type="button" id="cancel">${t('goal-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('goal-dialog.save')}</button>
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
      </modal-dialog>

      <!-- ── Action sheet (outside modal-dialog) ──────────────────────────── -->
      <dialog id="action-sheet" aria-label="${t('goal-dialog.more-actions')}">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button type="button" id="action-move-btn" class="sheet-item">${t('goal-dialog.move-to-year')}</button>
        <button type="button" id="action-create-btn" class="sheet-item">${t('goal-dialog.create-list-item')}</button>
      </dialog>

      <!-- ── List picker (opens as sub-modal for Create list item) ──────── -->
      <list-picker-dialog id="list-picker"></list-picker-dialog>
    `;
  }

  subscribe() {
    this._modal         = this.shadowRoot.querySelector('#modal');
    this._input         = this.shadowRoot.querySelector('#input');
    this._descInput     = this.shadowRoot.querySelector('#desc-input');
    this._descHighlight = attachMarkdownHighlight(
      this._descInput,
      this.shadowRoot.querySelector('.md-highlight'),
    );
    this._descCopyBtn   = this.shadowRoot.querySelector('#desc-copy-btn');
    this._tagChipsWrap    = this.shadowRoot.querySelector('#tag-chips-wrap');
    this._tagInput        = this.shadowRoot.querySelector('#tag-input');
    this._tagSuggestions  = this.shadowRoot.querySelector('#tag-suggestions');
    this._saveBtn       = this.shadowRoot.querySelector('#save');
    this._deleteBtn     = this.shadowRoot.querySelector('#delete');
    this._menuBtn       = this.shadowRoot.querySelector('#menu-btn');
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

    this._saved  = false;
    this._isNew  = false;
    this._tags   = [];

    // ── Main view ─────────────────────────────────────────────────────────────

    this._onInput = () => {
      this._saveBtn.disabled = !this._input.value.trim();
      this._saveDraft();
    };

    this._onDescInput = () => {
      this._syncDescHeight();
      this._saveDraft();
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

    this._onSave = () => {
      const title = this._input.value.trim();
      if (!title) return;
      this._saved = true;
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      const notes = this._descInput.value.trim() || undefined;
      const tags  = this._getTagValues();
      this.dispatchEvent(new CustomEvent('goal-saved', {
        bubbles: true, composed: true, detail: { title, notes, tags },
      }));
      this._modal.close();
    };

    this._onCancel = () => {
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this._modal.close();
    };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('goal-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      if (!this._saved) {
        this.dispatchEvent(new CustomEvent('goal-cancelled', { bubbles: true, composed: true }));
      }
      this._saved = false;
      if (this._actionSheet?.open) this._actionSheet.close();
      clearTimeout(this._copyResetTimer);
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };
    this._onResize  = () => this._syncDescHeight();

    // ── Tag input ─────────────────────────────────────────────────────────────

    this._onTagKeyDown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._addTag(this._tagInput.value);
      } else if (e.key === 'Backspace' && !this._tagInput.value && this._tags.length) {
        e.preventDefault();
        this._removeTag(this._tags[this._tags.length - 1]);
      }
    };

    this._onTagInput = () => {
      const val = this._tagInput.value;
      if (val.includes(',')) {
        val.split(',').slice(0, -1).forEach(p => this._addTag(p));
        this._tagInput.value = val.split(',').at(-1);
      }
      this._updateSuggestions();
    };

    this._onTagBlur = () => {
      if (this._tagInput.value.trim()) this._addTag(this._tagInput.value);
    };

    this._onTagWrapClick = e => {
      const chip = e.target.closest('.tag-chip');
      if (chip) { this._removeTag(chip.dataset.tag); return; }
      this._tagInput.focus();
    };

    this._input.addEventListener('input',   this._onInput);
    this._input.addEventListener('keydown', this._onKeyDown);
    this._descInput.addEventListener('input', this._onDescInput);
    this._descCopyBtn.addEventListener('pointerdown', e => e.preventDefault());
    this._descCopyBtn.addEventListener('click', this._onDescCopy);
    this._tagInput.addEventListener('keydown',   this._onTagKeyDown);
    this._tagInput.addEventListener('input',     this._onTagInput);
    this._tagInput.addEventListener('blur',      this._onTagBlur);
    this._tagChipsWrap.addEventListener('click', this._onTagWrapClick);
    this._onSuggestionPointerDown = e => e.preventDefault();
    this._tagSuggestions.addEventListener('pointerdown', this._onSuggestionPointerDown);
    this._onChipRemovePointerDown = e => { if (e.target.closest('.tag-chip')) e.preventDefault(); };
    this._tagChipsWrap.addEventListener('pointerdown', this._onChipRemovePointerDown);
    this._saveBtn.addEventListener('click', this._onSave);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel').addEventListener('click', this._onCancel);
    this._modal.addEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);

    // ── Action sheet ──────────────────────────────────────────────────────────

    this._onMenuBtn = () => this._actionSheet.showModal();
    this._menuBtn.addEventListener('click', this._onMenuBtn);

    this._onSheetBackdrop = e => { if (e.target === this._actionSheet) this._actionSheet.close(); };
    this._actionSheet.addEventListener('click', this._onSheetBackdrop);

    this._onActionMove = () => { this._actionSheet.close(); this._showView('move'); };
    this.shadowRoot.querySelector('#action-move-btn').addEventListener('click', this._onActionMove);

    this._onActionCreate = () => {
      this._actionSheet.close();
      this._listPickerDialog.lists = this.availableLists;
      this._listPickerDialog.show();
    };
    this.shadowRoot.querySelector('#action-create-btn').addEventListener('click', this._onActionCreate);

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
  }

  unsubscribe() {
    this._descHighlight?.detach();
    this._input?.removeEventListener('input',   this._onInput);
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._descInput?.removeEventListener('input', this._onDescInput);
    this._descCopyBtn?.removeEventListener('click', this._onDescCopy);
    this._tagInput?.removeEventListener('keydown',   this._onTagKeyDown);
    this._tagInput?.removeEventListener('input',     this._onTagInput);
    this._tagInput?.removeEventListener('blur',      this._onTagBlur);
    this._tagChipsWrap?.removeEventListener('click', this._onTagWrapClick);
    this._tagSuggestions?.removeEventListener('pointerdown', this._onSuggestionPointerDown);
    this._tagChipsWrap?.removeEventListener('pointerdown', this._onChipRemovePointerDown);
    this._saveBtn?.removeEventListener('click', this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
    this._menuBtn?.removeEventListener('click', this._onMenuBtn);
    this._actionSheet?.removeEventListener('click', this._onSheetBackdrop);
    this.shadowRoot.querySelector('#action-move-btn')?.removeEventListener('click', this._onActionMove);
    this.shadowRoot.querySelector('#action-create-btn')?.removeEventListener('click', this._onActionCreate);
    this.shadowRoot.querySelector('#move-back')?.removeEventListener('click', this._onMoveBack);
    this._moveYearSel?.removeEventListener('change', this._onMoveChange);
    this._moveSectionGrp?.removeEventListener('change', this._onMoveChange);
    this._moveMoveBtn?.removeEventListener('click', this._onMoveCta);
    this._moveCopyBtn?.removeEventListener('click', this._onCopyCta);
    this._listPickerDialog?.removeEventListener('list-pick', this._onListPick);
  }

  // ── Tag helpers ───────────────────────────────────────────────────────────

  _addTag(raw) {
    const tag = raw.replace(/,/g, '').trim().toLowerCase();
    if (!tag || this._tags.includes(tag)) { this._tagInput.value = ''; return; }
    this._tags.push(tag);
    this._tagInput.value = '';
    this._renderTagChips();
    this._saveDraft();
    this._updateSuggestions();
    this._dispatchTagsChanged();
  }

  _removeTag(tag) {
    this._tags = this._tags.filter(t => t !== tag);
    this._renderTagChips();
    this._saveDraft();
    this._dispatchTagsChanged();
  }

  _dispatchTagsChanged() {
    if (this._isNew) return;
    this.dispatchEvent(new CustomEvent('goal-tags-changed', {
      bubbles: true, composed: true, detail: { tags: [...this._tags] },
    }));
  }

  _renderTagChips() {
    this._tagChipsWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
    for (const tag of this._tags) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip';
      btn.dataset.tag = tag;
      btn.setAttribute('aria-label', t('tag.remove', { tag }));
      btn.style.background = tagColor(tag);
      btn.appendChild(document.createTextNode(tag));
      const x = document.createElement('span');
      x.className = 'tag-chip-x';
      x.setAttribute('aria-hidden', 'true');
      x.textContent = '×';
      btn.appendChild(x);
      this._tagChipsWrap.insertBefore(btn, this._tagInput);
    }
  }

  _updateSuggestions() {
    if (!this._tagSuggestions) return;
    const partial = this._tagInput.value.trim().toLowerCase();
    if (!partial) { this._tagSuggestions.hidden = true; this._tagSuggestions.replaceChildren(); return; }
    const matches = (this._existingTags ?? []).filter(t => t.includes(partial) && !this._tags.includes(t));
    if (!matches.length) { this._tagSuggestions.hidden = true; this._tagSuggestions.replaceChildren(); return; }
    this._tagSuggestions.replaceChildren();
    for (const tag of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-suggestion';
      btn.textContent = tag;
      btn.style.borderColor = tagColor(tag);
      btn.addEventListener('click', () => { this._addTag(tag); this._tagInput.focus(); });
      this._tagSuggestions.appendChild(btn);
    }
    this._tagSuggestions.hidden = false;
  }

  _getTagValues() {
    const rawTag = this._tagInput?.value.trim().toLowerCase().replace(/,/g, '');
    if (rawTag && !this._tags.includes(rawTag)) {
      this._tags.push(rawTag);
      if (this._tagInput) this._tagInput.value = '';
      this._renderTagChips();
    }
    return [...this._tags];
  }

  // ── Private ───────────────────────────────────────────────────────────────

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
    if (this._moveCopyBtn) this._moveCopyBtn.disabled = same;
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
    const MIN_H        = 56;
    const CHROME_H     = 320; // approx header + footer + input + tags chrome
    const MIN_WRAP_H   = 100;
    const maxH = Math.max(vh - CHROME_H, MIN_WRAP_H);
    ta.style.blockSize = `${Math.max(ta.scrollHeight, MIN_H)}px`;
    const wrap = ta.closest('.textarea-wrap');
    if (wrap) wrap.style.maxBlockSize = `${maxH}px`;
  }

  _loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
  }

  _saveDraft() {
    if (!this._isNew) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: this._input.value,
      notes: this._descInput.value,
      tags:  [...this._tags],
    }));
  }
}

customElements.define('goal-dialog', GoalDialog);
