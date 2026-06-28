import { AppElement } from '../../../_lib/core/app-element.js';
import { attachMarkdownHighlight } from '../../utils/markdown-highlight.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';
import { icons } from '../../icons.js';
import { tagColor } from '../../utils/tag-color.js';

const STATUSES = ['open', 'paused', 'done'];
const SECTIONS = ['capstone', 'milestones', 'wow', 'focus'];
const DRAFT_KEY = 'telos:draft.new-item';

class ItemDialog extends AppElement {
  // ── Public properties ────────────────────────────────────────────────────────

  set availableLists(val) { this._availableLists = val ?? []; }
  get availableLists() { return this._availableLists ?? []; }

  set currentYear(val) { this._currentYear = val; }
  get currentYear() { return this._currentYear ?? new Date().getFullYear(); }

  set existingTags(val) { this._existingTags = val ?? []; }

  // ── Public API ───────────────────────────────────────────────────────────────

  open(item = null) {
    this._item = item;
    this._isNew = !item;
    this._showView('main');

    const draft = this._isNew ? this._loadDraft() : null;
    this._titleInput.value = item?.title ?? draft?.title ?? '';
    this._saveBtn.disabled = !this._titleInput.value.trim();
    this._deleteBtn.hidden = !item;
    this._deleteBtn.textContent = t('item-dialog.delete');

    const status = item?.status ?? 'open';
    const radio = this.shadowRoot.querySelector(`input[name="status"][value="${status}"]`);
    if (radio) radio.checked = true;

    this._noteInput.value = item?.note ?? draft?.note ?? '';
    this._noteHighlight?.sync();
    this._urlInput.value = item?.url ?? draft?.url ?? '';
    this._syncUrlOpen();
    this._showUrlField(!!(item?.url ?? draft?.url));

    this._tags = [...(item?.tags ?? draft?.tags ?? [])];
    this._tagInput.value = '';
    this._renderTagChips();
    this._updateSuggestions();

    this._menuBtn.hidden = this._isNew;

    this._saved = false;
    this._modal.show(item ? this._noteInput : this._titleInput);
    requestAnimationFrame(() => requestAnimationFrame(() => this._syncNoteHeight()));
  }

  template() {
    return `
      <style>
        /* ── Modal padding override ──────────────────────────────────────── */
        #modal { --space-6: var(--space-3); }

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

        /* ── Status pills ────────────────────────────────────────────────── */
        .status-field { margin-block-end: var(--space-4); }

        .pills-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .status-options {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
          align-items: center;
        }

        .status-option {
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

        /* ── URL toggle ──────────────────────────────────────────────────── */
        #url-toggle {
          display: inline-flex;
          align-items: center;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-accent);
          background: transparent;
          color: var(--color-accent);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          cursor: pointer;
          flex-shrink: 0;
          min-block-size: auto;
          line-height: normal;
          margin-inline-start: auto;
        }

        #url-toggle[aria-expanded="true"] { background: var(--color-accent-subtle); }

        #url-toggle:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── URL row ─────────────────────────────────────────────────────── */
        .url-row {
          display: flex;
          gap: var(--space-2);
          align-items: center;
          margin-block-start: var(--space-3);
        }

        .url-row input[type="text"] {
          flex: 1;
          margin-block-end: 0;
        }

        #url-open {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-3);
          border-radius: var(--radius-sm);
          border: 0.5px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-accent);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
        }

        #url-open:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

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

        #action-sheet::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          #action-sheet[open] { animation: none; }
          #action-sheet::backdrop { animation: none; }
        }

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

        #menu-btn { background: none; color: var(--color-text-secondary); padding-inline: var(--space-2); display: flex; align-items: center; }
        #delete { background: none; color: var(--color-danger); }
        #cancel { background: none; color: var(--color-text-secondary); }

        #save, #add-to-goal-cta {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled, #add-to-goal-cta:disabled {
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
          gap: var(--space-2);
          margin-inline-start: auto;
        }
      </style>

      <modal-dialog id="modal">

        <!-- ── View 1: Main form ──────────────────────────────────────────── -->
        <div id="view-main">
          <input id="title-input"
                 type="text"
                 aria-label="${t('item-dialog.title-placeholder')}"
                 placeholder="${t('item-dialog.title-placeholder')}"
                 autocomplete="off"
                 enterkeyhint="go"
                 maxlength="120" />
          <div class="textarea-wrap">
            <div class="md-highlight" aria-hidden="true"></div>
            <textarea id="note-input"
                      aria-label="${t('item-dialog.note-placeholder')}"
                      placeholder="${t('item-dialog.note-placeholder')}"
                      enterkeyhint="newline"></textarea>
            <button type="button" class="copy-btn" id="note-copy-btn" aria-label="${t('item-dialog.copy-note')}" title="${t('item-dialog.copy-note')}">${icons.copy}</button>
          </div>
          <div class="status-field">
            <div class="pills-row">
              <div class="status-options" role="group" aria-label="${t('item-dialog.status-label')}">
                ${STATUSES.map(s => `
                  <label class="status-option">
                    <input type="radio" name="status" value="${s}" ${s === 'open' ? 'checked' : ''}>
                    ${t('item-dialog.status-' + s)}
                  </label>
                `).join('')}
              </div>
              <button type="button" id="url-toggle" aria-expanded="false">🔗 ${t('item-dialog.url-toggle')}</button>
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
          <div class="tag-area">
            <div id="tag-suggestions" hidden aria-label="${t('item-dialog.tags-label')}"></div>
            <div class="tag-chips-wrap" id="tag-chips-wrap" role="group" aria-label="${t('item-dialog.tags-label')}">
              <input type="text"
                     id="tag-input"
                     aria-label="${t('item-dialog.tags-placeholder')}"
                     placeholder="${t('item-dialog.tags-placeholder')}"
                     autocomplete="off"
                     autocapitalize="none" />
            </div>
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
          <div class="actions-end">
            <button type="button" id="cancel">${t('item-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('item-dialog.save')}</button>
          </div>
        </div>

        <!-- ── Footer: goal promoter ──────────────────────────────────────── -->
        <div slot="footer" class="actions footer-goal-promoter" hidden>
          <button type="button" id="promote-back">${t('item-dialog.picker-back')}</button>
          <button type="button" id="add-to-goal-cta">${t('item-dialog.goal-add-cta')}</button>
        </div>

      </modal-dialog>

      <dialog id="action-sheet" aria-label="${t('item-dialog.more-actions')}">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button type="button" id="action-move-btn" class="sheet-item">${t('item-dialog.move-to-list')}</button>
        <button type="button" id="action-promote-btn" class="sheet-item">${t('item-dialog.add-to-goal')}</button>
        <button type="button" id="action-export-btn" class="sheet-item">${t('item-dialog.extract-markdown')}</button>
      </dialog>

      <list-picker-dialog id="list-picker"></list-picker-dialog>
    `;
  }

  subscribe() {
    this._modal = this.shadowRoot.querySelector('#modal');
    this._titleInput = this.shadowRoot.querySelector('#title-input');
    this._noteInput = this.shadowRoot.querySelector('#note-input');
    this._noteHighlight = attachMarkdownHighlight(
      this._noteInput,
      this.shadowRoot.querySelector('.md-highlight'),
    );
    this._noteCopyBtn = this.shadowRoot.querySelector('#note-copy-btn');
    this._urlInput = this.shadowRoot.querySelector('#url-input');
    this._urlOpen = this.shadowRoot.querySelector('#url-open');
    this._urlToggle = this.shadowRoot.querySelector('#url-toggle');
    this._urlRow = this.shadowRoot.querySelector('.url-row');
    this._tagChipsWrap = this.shadowRoot.querySelector('#tag-chips-wrap');
    this._tagInput = this.shadowRoot.querySelector('#tag-input');
    this._tagSuggestions = this.shadowRoot.querySelector('#tag-suggestions');
    this._saveBtn = this.shadowRoot.querySelector('#save');
    this._deleteBtn = this.shadowRoot.querySelector('#delete');
    this._menuBtn = this.shadowRoot.querySelector('#menu-btn');
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

    this._saved = false;
    this._view = 'main';
    this._tags = [];

    // ── Main view ─────────────────────────────────────────────────────────────

    this._onTitleInput = () => {
      this._saveBtn.disabled = !this._titleInput.value.trim();
      this._saveDraft();
    };

    this._onNoteInput = () => { this._syncNoteHeight(); this._saveDraft(); };

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

    this._onUrlInput = () => { this._syncUrlOpen(); this._saveDraft(); };

    this._onUrlToggle = () => {
      const opening = this._urlRow.hidden;
      this._showUrlField(opening);
      if (opening) this._urlInput.focus();
      else this._noteInput.focus();
      requestAnimationFrame(() => this._syncNoteHeight());
    };

    this._onUrlOpen = () => {
      const url = this._urlInput.value.trim();
      if (url) window.open(url, '_blank', 'noopener');
    };

    this._onSave = () => {
      const { title, status, note, url, tags } = this._getFormValues();
      if (!title) return;
      this._saved = true;
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this.dispatchEvent(new CustomEvent('item-saved', {
        bubbles: true, composed: true, detail: { title, status, note, url, tags },
      }));
      this._modal.close();
    };

    this._onCancel = () => {
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('item-cancelled', { bubbles: true, composed: true }));
      }
      this._modal.close();
    };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('item-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      this._saved = false;
      clearTimeout(this._copyResetTimer);
      if (this._actionSheet?.open) this._actionSheet.close();
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };

    this._onStatusChange = e => {
      if (this._isNew) return;
      this.dispatchEvent(new CustomEvent('item-status-changed', {
        bubbles: true, composed: true,
        detail: { status: e.target.value },
      }));
    };

    this._onResize = () => this._syncNoteHeight();

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

    this._titleInput.addEventListener('input', this._onTitleInput);
    this._titleInput.addEventListener('keydown', this._onKeyDown);
    this._noteInput.addEventListener('input', this._onNoteInput);
    this._noteCopyBtn.addEventListener('pointerdown', e => e.preventDefault());
    this._noteCopyBtn.addEventListener('click', this._onNoteCopy);
    this._urlInput.addEventListener('input', this._onUrlInput);
    this._urlToggle.addEventListener('pointerdown', e => e.preventDefault());
    this._urlToggle.addEventListener('click', this._onUrlToggle);
    this._urlOpen.addEventListener('click', this._onUrlOpen);
    this._tagInput.addEventListener('keydown', this._onTagKeyDown);
    this._tagInput.addEventListener('input', this._onTagInput);
    this._tagInput.addEventListener('blur', this._onTagBlur);
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
    // preventDefault stops the browser's default label→radio handling so we
    // control exactly when checked is set and fire 'change' in one step.
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

    this._onMenuBtn = () => this._actionSheet.showModal();
    this._menuBtn.addEventListener('click', this._onMenuBtn);

    this._onSheetBackdrop = e => { if (e.target === this._actionSheet) this._actionSheet.close(); };
    this._actionSheet.addEventListener('click', this._onSheetBackdrop);

    this._onActionMove = () => {
      this._actionSheet.close();
      this._listPickerDialog.lists = this.availableLists;
      this._listPickerDialog.show();
    };
    this.shadowRoot.querySelector('#action-move-btn').addEventListener('click', this._onActionMove);

    this._onActionPromote = () => { this._actionSheet.close(); this._showView('goal-promoter'); };
    this.shadowRoot.querySelector('#action-promote-btn').addEventListener('click', this._onActionPromote);

    this._onActionExport = () => {
      this._actionSheet.close();
      this._modal.close();
      this.dispatchEvent(new CustomEvent('item-export-request', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
    };
    this.shadowRoot.querySelector('#action-export-btn').addEventListener('click', this._onActionExport);

    // ── Move to list ──────────────────────────────────────────────────────────

    this._onListPick = e => {
      const { targetListIds, newListName, copy } = e.detail;
      const { title, status, note, url, tags } = this._getFormValues();
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this.dispatchEvent(new CustomEvent('item-move', {
        bubbles: true, composed: true,
        detail: { title, status, note, url, tags, targetListIds, newListName, copy },
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
  }

  unsubscribe() {
    this._noteHighlight?.detach();
    this._titleInput?.removeEventListener('input', this._onTitleInput);
    this._titleInput?.removeEventListener('keydown', this._onKeyDown);
    this._noteInput?.removeEventListener('input', this._onNoteInput);
    this._noteCopyBtn?.removeEventListener('click', this._onNoteCopy);
    this._urlInput?.removeEventListener('input', this._onUrlInput);
    this._urlToggle?.removeEventListener('click', this._onUrlToggle);
    this._urlOpen?.removeEventListener('click', this._onUrlOpen);
    this._tagInput?.removeEventListener('keydown', this._onTagKeyDown);
    this._tagInput?.removeEventListener('input', this._onTagInput);
    this._tagInput?.removeEventListener('blur', this._onTagBlur);
    this._tagChipsWrap?.removeEventListener('click', this._onTagWrapClick);
    this._tagSuggestions?.removeEventListener('pointerdown', this._onSuggestionPointerDown);
    this._tagChipsWrap?.removeEventListener('pointerdown', this._onChipRemovePointerDown);
    this._saveBtn?.removeEventListener('click', this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
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
    const { title, status, note, url, tags } = this._getFormValues();
    if (this._isNew) localStorage.removeItem(DRAFT_KEY);
    this.dispatchEvent(new CustomEvent('item-promote', {
      bubbles: true, composed: true,
      detail: { title, status, note, url, tags, year, section },
    }));
    this._modal.close();
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
    this.dispatchEvent(new CustomEvent('item-tags-changed', {
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

  // ── Shared helpers ────────────────────────────────────────────────────────

  _getFormValues() {
    // Commit any uncommitted tag text on save
    const rawTag = this._tagInput?.value.trim().toLowerCase().replace(/,/g, '');
    if (rawTag && !this._tags.includes(rawTag)) {
      this._tags.push(rawTag);
      if (this._tagInput) this._tagInput.value = '';
      this._renderTagChips();
    }
    const title = this._titleInput.value.trim();
    const status = this.shadowRoot.querySelector('input[name="status"]:checked')?.value ?? 'open';
    const note = this._noteInput.value.trim() || undefined;
    const url = this._urlInput.value.trim() || undefined;
    const tags = [...this._tags];
    return { title, status, note, url, tags };
  }

  _syncNoteHeight() {
    const ta = this._noteInput;
    if (!ta) return;
    ta.style.blockSize = 'auto';
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const urlRowH = this._urlRow?.hidden ? 0 : (this._urlRow?.offsetHeight ?? 0);
    const MIN_H = 56;
    const CHROME_H = 340; // approx header + footer + title + status + tags chrome
    const MIN_WRAP_H = 120;
    const maxH = Math.max(vh - CHROME_H - urlRowH, MIN_WRAP_H);
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
      title: this._titleInput.value,
      note: this._noteInput.value,
      url: this._urlInput.value,
      tags: [...this._tags],
    }));
  }

  _syncUrlOpen() {
    if (this._urlOpen) this._urlOpen.hidden = !this._urlInput.value.trim();
  }

  _showUrlField(show) {
    this._urlRow.hidden = !show;
    this._urlToggle.setAttribute('aria-expanded', String(show));
  }
}

customElements.define('item-dialog', ItemDialog);
