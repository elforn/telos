import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import '../list-picker-dialog/list-picker-dialog.js';

const DRAFT_KEY = 'telos.draft.new-goal';
const SECTIONS  = ['capstone', 'milestones', 'wow', 'focus'];

class GoalDialog extends AppElement {
  // ── Public properties ─────────────────────────────────────────────────────

  set currentYear(val)    { this._currentYear    = val; }
  get currentYear()       { return this._currentYear ?? new Date().getFullYear(); }

  set availableLists(val) { this._availableLists = val ?? []; }
  get availableLists()    { return this._availableLists ?? []; }

  // ── Public API ────────────────────────────────────────────────────────────

  open(goal = null, { year, section } = {}) {
    this._goal        = goal;
    this._isNew       = !goal;
    this._fromYear    = year    ?? String(this.currentYear);
    this._fromSection = section ?? 'capstone';
    const draft = this._isNew ? this._loadDraft() : null;
    this._input.value = goal?.title ?? draft?.title ?? '';
    this._saveBtn.disabled = !this._input.value.trim();
    if (this._deleteBtn) {
      this._deleteBtn.hidden = !goal;
      this._deleteBtn.classList.remove('is-confirm');
      this._deleteBtn.textContent = t('goal-dialog.delete');
    }
    if (this._menuBtn) this._menuBtn.hidden = !goal;
    this._deleteConfirm = false;
    this._descInput.value = goal?.description ?? draft?.description ?? '';
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
        h2 {
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
          margin-block-end: var(--space-4);
          line-height: var(--line-height-tight);
        }

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

        /* ── Description textarea ────────────────────────────────────────── */

        textarea {
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
          resize: none;
          min-block-size: 3.5rem;
          overflow-y: auto;
          margin-block-end: var(--space-4);
        }

        textarea:focus { border-color: var(--color-accent); }
        textarea::placeholder { color: var(--color-text-muted); }

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
          letter-spacing: 0.08em;
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

        #menu-btn { background: none; color: var(--color-text-secondary); padding-inline: var(--space-3); letter-spacing: 0.05em; }
        #delete { background: none; color: var(--color-danger); }
        #delete.is-confirm { background: var(--color-danger); color: var(--color-text-inverse); }
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
          <h2>${t('goal-dialog.heading')}</h2>
          <input id="input"
                 type="text"
                 aria-label="${t('goal-dialog.placeholder')}"
                 placeholder="${t('goal-dialog.placeholder')}"
                 autocomplete="off"
                 enterkeyhint="go"
                 maxlength="80" />
          <textarea id="desc-input"
                    aria-label="${t('goal-dialog.description-placeholder')}"
                    placeholder="${t('goal-dialog.description-placeholder')}"></textarea>
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
          <button type="button" id="menu-btn" hidden aria-label="${t('goal-dialog.more-actions')}">···</button>
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

    this._saved         = false;
    this._deleteConfirm = false;
    this._isNew         = false;

    // ── Main view ─────────────────────────────────────────────────────────────

    this._onInput = () => {
      this._saveBtn.disabled = !this._input.value.trim();
      this._saveDraft();
    };

    this._onDescInput = () => {
      this._syncDescHeight();
      this._saveDraft();
    };

    this._onSave = () => {
      const title = this._input.value.trim();
      if (!title) return;
      this._saved = true;
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      const description = this._descInput.value.trim() || undefined;
      this.dispatchEvent(new CustomEvent('goal-saved', {
        bubbles: true, composed: true, detail: { title, description },
      }));
      this._modal.close();
    };

    this._onCancel = () => {
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this._modal.close();
    };

    this._onDelete = () => {
      if (!this._deleteConfirm) {
        this._deleteConfirm = true;
        this._deleteBtn.classList.add('is-confirm');
        this._deleteBtn.textContent = t('goal-dialog.delete-confirm');
        return;
      }
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
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };
    this._onResize  = () => this._syncDescHeight();

    this._input.addEventListener('input',   this._onInput);
    this._input.addEventListener('keydown', this._onKeyDown);
    this._descInput.addEventListener('input', this._onDescInput);
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
    this._input?.removeEventListener('input',   this._onInput);
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._descInput?.removeEventListener('input', this._onDescInput);
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
    const minH = 56;
    const maxH = Math.max(vh - 260, 100);
    ta.style.blockSize = `${Math.max(Math.min(ta.scrollHeight, maxH), minH)}px`;
  }

  _loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
  }

  _saveDraft() {
    if (!this._isNew) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title:       this._input.value,
      description: this._descInput.value,
    }));
  }
}

customElements.define('goal-dialog', GoalDialog);
