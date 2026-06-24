import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';

class ExportSheet extends AppElement {
  template() {
    return `
      <style>
        dialog {
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
          padding-block-end: calc(var(--space-3) + var(--safe-area-bottom, 0px));
          box-shadow: var(--shadow-sheet);
          color: var(--color-text-primary);
          font-family: var(--font-family);
        }

        @media (prefers-reduced-motion: reduce) {
          dialog[open], dialog::backdrop { animation: none; }
        }

        dialog[open] {
          animation: sheet-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        @keyframes sheet-in {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .handle {
          inline-size: var(--sheet-handle-width);
          block-size: var(--sheet-handle-height);
          border-radius: var(--radius-full);
          background: var(--color-border);
          margin: var(--space-3) auto var(--space-1);
        }

        .option-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target-lg);
          padding-inline: var(--space-5);
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
          inline-size: calc(100% - var(--space-5) * 2);
          margin: var(--space-3) var(--space-5) 0;
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

      <dialog id="sheet">
        <div class="handle" aria-hidden="true"></div>
        <label class="option-row" id="metadata-row">
          <span>${t('export-sheet.metadata')}</span>
          <input type="checkbox" id="metadata-check">
        </label>
        <label class="option-row" id="notes-row">
          <span>${t('export-sheet.notes')}</span>
          <input type="checkbox" id="notes-check">
        </label>
        <button class="copy-btn" id="copy-btn">${t('export-sheet.extract')}</button>
      </dialog>
    `;
  }

  subscribe() {
    this._dialog       = this.shadowRoot.querySelector('#sheet');
    this._metadataCheck = this.shadowRoot.querySelector('#metadata-check');
    this._notesCheck    = this.shadowRoot.querySelector('#notes-check');

    this._onBackdrop = e => { if (e.target === this._dialog) this._dialog.close(); };
    this._dialog.addEventListener('click', this._onBackdrop);

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
    this._dialog.removeEventListener('click', this._onBackdrop);
    this.shadowRoot.querySelector('#copy-btn').removeEventListener('click', this._onCopy);
  }

  show() {
    this._metadataCheck.checked = false;
    this._notesCheck.checked    = false;
    this._dialog.showModal();
  }
}

customElements.define('export-sheet', ExportSheet);
