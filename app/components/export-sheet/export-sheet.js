import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

class ExportSheet extends AppElement {
  template() {
    return `
      <style>
        /* Consistent modal padding across the app: --space-5 on both axes. */
        #sheet { --space-6: var(--space-5); }

        .option-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target-lg);
          border-block-start: 0.5px solid var(--color-border);
          cursor: pointer;
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          gap: var(--space-3);
        }

        .option-row input[type="checkbox"] {
          --_toggle-w:     44px;
          --_toggle-h:     26px;
          --_thumb-size:   20px;
          --_thumb-offset: 3px;
          --_thumb-bg:     white;

          appearance: none;
          inline-size: var(--_toggle-w);
          block-size: var(--_toggle-h);
          border-radius: var(--radius-full);
          background: var(--color-border);
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
          transition: background 0.2s;
        }

        .option-row input[type="checkbox"]::after {
          content: '';
          position: absolute;
          inset-block-start: var(--_thumb-offset);
          inset-inline-start: var(--_thumb-offset);
          inline-size: var(--_thumb-size);
          block-size: var(--_thumb-size);
          border-radius: 50%;
          background: var(--_thumb-bg);
          box-shadow: var(--shadow-card);
          transition: inset-inline-start 0.2s;
        }

        .option-row input[type="checkbox"]:checked {
          background: var(--color-accent);
        }

        .option-row input[type="checkbox"]:checked::after {
          inset-inline-start: calc(var(--_toggle-w) - var(--_thumb-size) - var(--_thumb-offset));
        }

        .copy-btn {
          display: block;
          inline-size: 100%;
          margin-block-start: var(--space-3);
          padding-block: var(--space-3);
          background: var(--color-accent);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          text-align: center;
        }

        .copy-btn:active {
          opacity: 0.8;
        }
      </style>

      <modal-dialog id="sheet">
        <label class="option-row" id="metadata-row">
          <span>${t('export-sheet.metadata')}</span>
          <input type="checkbox" id="metadata-check">
        </label>
        <label class="option-row" id="notes-row">
          <span>${t('export-sheet.notes')}</span>
          <input type="checkbox" id="notes-check">
        </label>
        <button class="copy-btn" id="copy-btn">${t('export-sheet.extract')}</button>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._dialog       = this.shadowRoot.querySelector('#sheet');
    this._metadataCheck = this.shadowRoot.querySelector('#metadata-check');
    this._notesCheck    = this.shadowRoot.querySelector('#notes-check');

    this._onCopy = () => {
      const metadata = this._metadataCheck.checked;
      const notes    = this._notesCheck.checked;
      this._dialog.close();
      this.dispatchEvent(new CustomEvent('extract-confirm', {
        bubbles: true, composed: true, detail: { metadata, notes },
      }));
    };
    this.shadowRoot.querySelector('#copy-btn').addEventListener('click', this._onCopy);
  }

  unsubscribe() {
    this.shadowRoot.querySelector('#copy-btn').removeEventListener('click', this._onCopy);
  }

  show() {
    this._metadataCheck.checked = false;
    this._notesCheck.checked    = false;
    this._dialog.show();
  }
}

customElements.define('export-sheet', ExportSheet);
