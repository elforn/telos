import { AppElement } from '../../core/app-element.js';

const MOBILE_BREAKPOINT = 600;

class ModalDialog extends AppElement {
  template() {
    return `
      <style>
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        dialog {
          border: none;
          border-radius: var(--radius-lg);
          padding: var(--space-6) var(--space-5);
          max-inline-size: min(90vw, 400px);
          inline-size: 100%;
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          box-shadow: var(--shadow-sheet);
        }

        dialog[open] {
          animation: fade-in 0.2s ease-out;
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .handle { display: none; }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          dialog {
            position: fixed;
            inset-block-end: 0;
            inset-inline-start: 0;
            inset-block-start: auto;
            margin: 0;
            inline-size: 100%;
            max-inline-size: 100%;
            border-end-start-radius: 0;
            border-end-end-radius: 0;
            border-start-start-radius: var(--radius-lg);
            border-start-end-radius: var(--radius-lg);
            padding-block-end: calc(var(--space-6) + var(--safe-area-bottom, 0px));
          }

          dialog[open] {
            animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .handle {
            display: block;
            inline-size: 36px;
            block-size: 4px;
            border-radius: var(--radius-full);
            background: var(--color-border);
            margin: 0 auto var(--space-4);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          dialog[open],
          dialog::backdrop { animation: none; }
        }

        .footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
          margin-block-start: var(--space-4);
        }
      </style>
      <dialog aria-modal="true">
        <div class="handle" aria-hidden="true"></div>
        <slot></slot>
        <div class="footer"><slot name="footer"></slot></div>
      </dialog>
    `;
  }

  subscribe() {
    this._dialog = this.shadowRoot.querySelector('dialog');
    const label = this.getAttribute('aria-label');
    if (label) this._dialog.setAttribute('aria-label', label);

    this._onClose = () => this.dispatchEvent(
      new CustomEvent('modal-close', { bubbles: true, composed: true })
    );
    this._dialog.addEventListener('close', this._onClose);

    // Guard prevents the gesture that opened the dialog from immediately dismissing it.
    // Backdrop clicks (outside dialog box) have e.target === the dialog element itself.
    this._onBackdrop = e => { if (!this._justOpened && e.target === this._dialog) this.close(); };
    this._dialog.addEventListener('click', this._onBackdrop);
  }

  unsubscribe() {
    this._dialog?.removeEventListener('close', this._onClose);
    this._dialog?.removeEventListener('click', this._onBackdrop);
  }

  show() {
    this._justOpened = true;
    this._dialog?.showModal();
    requestAnimationFrame(() => { this._justOpened = false; });
  }

  close() { this._dialog?.close(); }
}

customElements.define('modal-dialog', ModalDialog);
