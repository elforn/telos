import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

class ListDialog extends AppElement {
  open(list = null) {
    this._heading.textContent = list
      ? t('list-dialog.heading-edit')
      : t('list-dialog.heading-create');
    this._input.value = list?.name ?? '';
    this._saveBtn.disabled = !this._input.value.trim();
    this._deleteBtn.hidden = !list;
    this._saved = false;
    this._modal.show();
    this._input.select();
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

        input:focus { border-color: var(--color-accent); }
        input::placeholder { color: var(--color-text-muted); }

        .actions {
          display: flex;
          justify-content: space-between;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          gap: var(--space-2);
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

        #delete { background: none; color: var(--color-danger); }
        #cancel { background: none; color: var(--color-text-secondary); }

        #save {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled { opacity: 0.4; cursor: default; }
      </style>

      <modal-dialog id="modal">
        <h2 id="heading">${t('list-dialog.heading-create')}</h2>
        <input id="input"
               type="text"
               aria-label="${t('list-dialog.name-placeholder')}"
               placeholder="${t('list-dialog.name-placeholder')}"
               autocomplete="off"
               maxlength="60" />
        <div slot="footer" class="actions">
          <button type="button" id="delete" hidden>${t('list-dialog.delete')}</button>
          <div class="actions-end">
            <button type="button" id="cancel">${t('list-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('list-dialog.save')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal     = this.shadowRoot.querySelector('#modal');
    this._heading   = this.shadowRoot.querySelector('#heading');
    this._input     = this.shadowRoot.querySelector('#input');
    this._saveBtn   = this.shadowRoot.querySelector('#save');
    this._deleteBtn = this.shadowRoot.querySelector('#delete');
    this._saved     = false;

    this._onInput = () => {
      this._saveBtn.disabled = !this._input.value.trim();
    };

    this._onSave = () => {
      const name = this._input.value.trim();
      if (!name) return;
      this._saved = true;
      this.dispatchEvent(new CustomEvent('list-saved', {
        bubbles: true, composed: true, detail: { name },
      }));
      this._modal.close();
    };

    this._onCancel = () => this._modal.close();

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('list-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
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

  unsubscribe() {
    this._input?.removeEventListener('input',   this._onInput);
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._saveBtn?.removeEventListener('click', this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
  }
}

customElements.define('list-dialog', ListDialog);
