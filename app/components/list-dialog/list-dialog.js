import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import { COLOR_PALETTE } from '../lists-page-item/lists-page-item.js';

const DRAFT_KEY = 'telos.draft.new-list';

// Labels parallel COLOR_PALETTE — update both together when adding/removing colours.
const SWATCH_LABELS = ['No colour', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple'];
const SWATCHES = COLOR_PALETTE.map((color, i) => ({ color, label: SWATCH_LABELS[i] }));

class ListDialog extends AppElement {
  open(list = null) {
    this._isNew = !list;
    const draft = this._isNew ? this._loadDraft() : null;
    this._input.value = list?.name ?? draft?.name ?? '';
    this._saveBtn.disabled = !this._input.value.trim();
    this._deleteBtn.hidden = !list;
    this._selectColor(list?.color ?? draft?.color ?? null);
    this._saved = false;
    this._modal.show(this._input);
  }

  template() {
    return `
      <style>
        /* Halve the modal's default 24px top/bottom padding */
        #modal { --space-6: var(--space-3); }

        /* ── Color swatches (always visible, above the input) ───────────── */

        .color-swatches {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          padding-inline-start: var(--space-1);
          margin-block-end: var(--space-5);
        }

        .swatch {
          inline-size: 28px;
          block-size: 28px;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
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

        /* ── Name input ──────────────────────────────────────────────────── */

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

        /* ── Footer ──────────────────────────────────────────────────────── */

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

        #delete { background: none; color: var(--color-danger); }
        #cancel { background: none; color: var(--color-text-secondary); }

        #save {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled { opacity: 0.4; cursor: default; }
      </style>

      <modal-dialog id="modal">
        <div class="color-swatches">
          ${SWATCHES.map(({ color, label }) => `
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
    this._modal  = this.shadowRoot.querySelector('#modal');
    this._input  = this.shadowRoot.querySelector('#input');
    this._colorSwatches = this.shadowRoot.querySelector('.color-swatches');
    this._saveBtn       = this.shadowRoot.querySelector('#save');
    this._deleteBtn     = this.shadowRoot.querySelector('#delete');
    this._selectedColor  = null;
    this._saved          = false;
    this._isNew          = false;

    this._onInput = () => {
      this._saveBtn.disabled = !this._input.value.trim();
      this._saveDraft();
    };

    this._onSave = () => {
      const name = this._input.value.trim();
      if (!name) return;
      this._saved = true;
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      this.dispatchEvent(new CustomEvent('list-saved', {
        bubbles: true, composed: true,
        detail: { name, color: this._selectedColor },
      }));
      this._modal.close();
    };

    this._onCancel = () => {
      if (this._isNew) localStorage.removeItem(DRAFT_KEY);
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('list-cancelled', { bubbles: true, composed: true }));
      }
      this._modal.close();
    };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('list-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      this._saved = false;
    };

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };

    this._onSwatchClick = e => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      this._selectColor(swatch.dataset.color || null);
      this._saveDraft();
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('list-color-changed', {
          bubbles: true, composed: true,
          detail: { color: this._selectedColor },
        }));
      }
    };

    this._input.addEventListener('input',   this._onInput);
    this._input.addEventListener('keydown', this._onKeyDown);
    this._saveBtn.addEventListener('click',   this._onSave);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel').addEventListener('click', this._onCancel);
    this._onSwatchPointerDown = e => e.preventDefault();
    this._colorSwatches.addEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches.addEventListener('click', this._onSwatchClick);
    this._modal.addEventListener('modal-close', this._onModalClose);
  }

  unsubscribe() {
    this._input?.removeEventListener('input',   this._onInput);
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._saveBtn?.removeEventListener('click',   this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._colorSwatches?.removeEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches?.removeEventListener('click', this._onSwatchClick);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
  }

  _loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
  }

  _saveDraft() {
    if (!this._isNew) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      name:  this._input.value,
      color: this._selectedColor,
    }));
  }

  _selectColor(color) {
    this._selectedColor = color;
    this._colorSwatches.querySelectorAll('.swatch').forEach(s => {
      s.setAttribute('aria-pressed', String((s.dataset.color || null) === color));
    });
  }
}

customElements.define('list-dialog', ListDialog);
