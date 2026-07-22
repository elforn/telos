import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';
import { COLOR_PALETTE } from '../lists-page-item/lists-page-item.js';
import { installDialogSnapshot } from '../../utils/dialog-snapshot.js';

const SNAPSHOT_KEY = 'telos:snapshot.new-list';

// Labels parallel COLOR_PALETTE — update both together when adding/removing colours.
const SWATCH_LABELS = ['No colour', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple'];
const SWATCHES = COLOR_PALETTE.map((color, i) => ({ color, label: SWATCH_LABELS[i] }));

class ListDialog extends AppElement {
  open(list = null) {
    this._isNew = !list;
    this._listId = list?.id ?? null;
    this._input.value = list?.name ?? '';
    this._deleteBtn.hidden = !list;
    this._selectColor(list?.color ?? null);
    this._lastValidName = list?.name ?? '';
    this._closeBtn?.setAttribute('aria-label',
      this._isNew ? t('list-dialog.save-and-close') : t('list-dialog.close'));
    this._modal.shadowRoot?.querySelector('dialog')?.setAttribute('aria-label',
      this._isNew ? t('list-dialog.title-new') : t('list-dialog.title-edit'));
    this._snapshot?.restoreFor(list);
    this._modal.show(this._input);
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
        #close  { background: none; color: var(--color-text-secondary); }
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
               enterkeyhint="go"
               maxlength="60" />
        <div slot="footer" class="actions">
          <button type="button" id="delete" hidden>${t('list-dialog.delete')}</button>
          <div class="actions-end">
            <button type="button" id="close" aria-label="${t('list-dialog.close')}">${t('list-dialog.close')}</button>
          </div>
        </div>

        <div id="save-status" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal         = this.shadowRoot.querySelector('#modal');
    this._input         = this.shadowRoot.querySelector('#input');
    this._colorSwatches = this.shadowRoot.querySelector('.color-swatches');
    this._deleteBtn     = this.shadowRoot.querySelector('#delete');
    this._closeBtn      = this.shadowRoot.querySelector('#close');
    this._saveStatus    = this.shadowRoot.querySelector('#save-status');
    this._selectedColor = null;
    this._isNew         = false;
    this._lastValidName = '';

    this._onNameBlur = () => {
      if (this._isNew) return;
      const v = this._input.value.trim();
      if (!v) { this._input.value = this._lastValidName; return; }
      if (v === this._lastValidName) return;
      this._lastValidName = v;
      this.dispatchEvent(new CustomEvent('list-name-changed', {
        bubbles: true, composed: true, detail: { name: v },
      }));
      this._announceSaved();
    };

    this._onClose = () => { this._modal.close(); };

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('list-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      if (this._isNew) {
        const name = this._input.value.trim();
        if (name) {
          this._snapshot?.clear(); // committed — drop any hide-time snapshot
          this.dispatchEvent(new CustomEvent('list-created', {
            bubbles: true, composed: true,
            detail: { name, color: this._selectedColor },
          }));
        } else {
          this._snapshot?.capture(); // can't commit without a name — preserve any colour picked
        }
      } else {
        this._snapshot?.clear(); // edited record closed — store owns it now
        this.dispatchEvent(new CustomEvent('list-closed', { bubbles: true, composed: true }));
      }
    };

    this._onKeyDown = e => {
      if (e.key !== 'Enter') return;
      if (this._isNew) {
        if (!this._input.value.trim()) return; // require name for new lists
        this._modal.close();
      } else {
        this._input.blur(); // triggers _onNameBlur before close
        this._modal.close();
      }
    };

    this._onSwatchClick = e => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      this._selectColor(swatch.dataset.color || null);
      if (!this._isNew) {
        this.dispatchEvent(new CustomEvent('list-color-changed', {
          bubbles: true, composed: true,
          detail: { color: this._selectedColor },
        }));
      }
    };

    this._input.addEventListener('keydown', this._onKeyDown);
    this._input.addEventListener('blur',    this._onNameBlur);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this._closeBtn.addEventListener('click', this._onClose);
    this._onSwatchPointerDown = e => e.preventDefault();
    this._colorSwatches.addEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches.addEventListener('click', this._onSwatchClick);
    this._modal.addEventListener('modal-close', this._onModalClose);

    this._snapshot = installDialogSnapshot(this, {
      key:      SNAPSHOT_KEY,
      isOpen:   () => !!this._modal.shadowRoot?.querySelector('dialog')?.open,
      recordId: () => this._listId,
      snapshot: () => {
        const name = this._input.value;
        if (this._isNew) {
          return (name.trim() || this._selectedColor) ? { name, color: this._selectedColor } : null;
        }
        // existing: only if the name has an unsaved edit
        return name !== this._lastValidName ? { name, color: this._selectedColor } : null;
      },
      restore: ({ name, color }) => {
        this._input.value = name ?? '';
        this._selectColor(color ?? null);
      },
    });
  }

  unsubscribe() {
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._input?.removeEventListener('blur',    this._onNameBlur);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this._closeBtn?.removeEventListener('click', this._onClose);
    this._colorSwatches?.removeEventListener('pointerdown', this._onSwatchPointerDown);
    this._colorSwatches?.removeEventListener('click', this._onSwatchClick);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
  }

  _selectColor(color) {
    this._selectedColor = color;
    this._colorSwatches.querySelectorAll('.swatch').forEach(s => {
      s.setAttribute('aria-pressed', String((s.dataset.color || null) === color));
    });
  }

  _announceSaved() {
    if (!this._saveStatus) return;
    this._saveStatus.textContent = t('dialog.saved-sr');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => { this._saveStatus.textContent = ''; }, 1500);
  }
}

customElements.define('list-dialog', ListDialog);
