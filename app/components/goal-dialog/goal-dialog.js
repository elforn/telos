import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

const DRAFT_KEY = 'telos.draft.new-goal';

class GoalDialog extends AppElement {
  open(goal = null) {
    this._isNew = !goal;
    const draft = this._isNew ? this._loadDraft() : null;
    this._input.value = goal?.title ?? draft?.title ?? '';
    this._saveBtn.disabled = !this._input.value.trim();
    if (this._deleteBtn) {
      this._deleteBtn.hidden = !goal;
      this._deleteBtn.classList.remove('is-confirm');
      this._deleteBtn.textContent = t('goal-dialog.delete');
    }
    this._deleteConfirm = false;
    this._modal.show(this._input);
    // setSelectionRange must run after show()'s internal focus (both setTimeout 0,
    // but ours is queued second so it fires after the library has focused the element)
    setTimeout(() => {
      const len = this._input.value.length;
      this._input.setSelectionRange(len, len);
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

        input {
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
        }

        input:focus {
          border-color: var(--color-accent);
        }

        input::placeholder {
          color: var(--color-text-muted);
        }

        .actions {
          display: flex;
          justify-content: space-between;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          gap: var(--space-2);
          margin-inline-start: auto;
        }

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

        #delete {
          background: none;
          color: var(--color-danger);
        }

        #delete.is-confirm {
          background: var(--color-danger);
          color: var(--color-text-inverse);
        }

        #cancel {
          background: none;
          color: var(--color-text-secondary);
        }

        #save {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled {
          opacity: 0.4;
          cursor: default;
        }
      </style>

      <modal-dialog id="modal">
        <h2>${t('goal-dialog.heading')}</h2>
        <input id="input"
               type="text"
               aria-label="${t('goal-dialog.placeholder')}"
               placeholder="${t('goal-dialog.placeholder')}"
               autocomplete="off"
               maxlength="80" />
        <div slot="footer" class="actions">
          <button type="button" id="delete" hidden>${t('goal-dialog.delete')}</button>
          <div class="actions-end">
            <button type="button" id="cancel">${t('goal-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('goal-dialog.save')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal     = this.shadowRoot.querySelector('#modal');
    this._input     = this.shadowRoot.querySelector('#input');
    this._saveBtn   = this.shadowRoot.querySelector('#save');
    this._deleteBtn = this.shadowRoot.querySelector('#delete');
    this._saved          = false;
    this._deleteConfirm  = false;
    this._isNew          = false;

    this._onInput = () => {
      this._saveBtn.disabled = !this._input.value.trim();
      this._saveDraft();
    };

    this._onSave = () => {
      const title = this._input.value.trim();
      if (!title) return;
      this._saved = true;
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this.dispatchEvent(new CustomEvent('goal-saved', {
        bubbles: true, composed: true, detail: { title },
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
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };

    this._input.addEventListener('input',   this._onInput);
    this._input.addEventListener('keydown', this._onKeyDown);
    this._saveBtn.addEventListener('click', this._onSave);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel').addEventListener('click', this._onCancel);
    this._modal.addEventListener('modal-close', this._onModalClose);
  }

  _loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
  }

  _saveDraft() {
    if (!this._isNew) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: this._input.value }));
  }

  unsubscribe() {
    this._input?.removeEventListener('input',   this._onInput);
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._saveBtn?.removeEventListener('click', this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
  }
}

customElements.define('goal-dialog', GoalDialog);
