import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

const STATUSES = ['open', 'paused', 'done'];

class ItemDialog extends AppElement {
  open(item = null) {
    this._heading.textContent = item
      ? t('item-dialog.heading-edit')
      : t('item-dialog.heading-create');
    this._titleInput.value = item?.title ?? '';
    this._saveBtn.disabled = !this._titleInput.value.trim();
    this._deleteBtn.hidden = !item;
    const status = item?.status ?? 'open';
    const radio = this.shadowRoot.querySelector(`input[name="status"][value="${status}"]`);
    if (radio) radio.checked = true;
    this._saved = false;
    this._modal.show();
    this._titleInput.select();
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

        fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }

        legend {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
          margin-block-end: var(--space-2);
        }

        .status-options {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
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

        .status-option input { display: none; }

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
        <h2 id="heading">${t('item-dialog.heading-create')}</h2>
        <input id="title-input"
               type="text"
               aria-label="${t('item-dialog.title-placeholder')}"
               placeholder="${t('item-dialog.title-placeholder')}"
               autocomplete="off"
               maxlength="120" />
        <fieldset>
          <legend>${t('item-dialog.status-label')}</legend>
          <div class="status-options">
            ${STATUSES.map(s => `
              <label class="status-option">
                <input type="radio" name="status" value="${s}" ${s === 'open' ? 'checked' : ''}>
                ${t('item-dialog.status-' + s)}
              </label>
            `).join('')}
          </div>
        </fieldset>
        <div slot="footer" class="actions">
          <button type="button" id="delete" hidden>${t('item-dialog.delete')}</button>
          <div class="actions-end">
            <button type="button" id="cancel">${t('item-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('item-dialog.save')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal      = this.shadowRoot.querySelector('#modal');
    this._heading    = this.shadowRoot.querySelector('#heading');
    this._titleInput = this.shadowRoot.querySelector('#title-input');
    this._saveBtn    = this.shadowRoot.querySelector('#save');
    this._deleteBtn  = this.shadowRoot.querySelector('#delete');
    this._saved      = false;

    this._onInput = () => {
      this._saveBtn.disabled = !this._titleInput.value.trim();
    };

    this._onSave = () => {
      const title = this._titleInput.value.trim();
      if (!title) return;
      const status = this.shadowRoot.querySelector('input[name="status"]:checked')?.value ?? 'open';
      this._saved = true;
      this.dispatchEvent(new CustomEvent('item-saved', {
        bubbles: true, composed: true, detail: { title, status },
      }));
      this._modal.close();
    };

    this._onCancel = () => this._modal.close();

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('item-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      this._saved = false;
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };

    this._titleInput.addEventListener('input',   this._onInput);
    this._titleInput.addEventListener('keydown', this._onKeyDown);
    this._saveBtn.addEventListener('click', this._onSave);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel').addEventListener('click', this._onCancel);
    this._modal.addEventListener('modal-close', this._onModalClose);
  }

  unsubscribe() {
    this._titleInput?.removeEventListener('input',   this._onInput);
    this._titleInput?.removeEventListener('keydown', this._onKeyDown);
    this._saveBtn?.removeEventListener('click', this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
  }
}

customElements.define('item-dialog', ItemDialog);
