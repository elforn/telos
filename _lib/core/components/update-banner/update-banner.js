import { AppElement } from '../../app-element.js';
import { subscribe, unsubscribe } from '../../store/store.js';
import { t } from '../../strings.js';

class UpdateBanner extends AppElement {
  template() {
    return `
      <style>
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        :host {
          display: block;
          position: fixed;
          inset-block-start: 0;
          inset-inline: 0;
          z-index: 200;
          background: var(--color-action-dark);
          color: var(--color-action-dark-text);
          font-family: var(--font-family);
          animation: slide-down 0.25s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          :host { animation: none; }
        }
        :host([hidden]) { display: none; }

        .bar {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding-block-start: calc(var(--space-2) + var(--safe-area-top));
          padding-block-end: var(--space-2);
          padding-inline: var(--page-padding);
        }

        span {
          flex: 1;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-on-dark);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        button {
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          padding-block: var(--space-1);
          min-block-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #reload {
          background: var(--color-accent);
          color: var(--color-text-primary);
          border-radius: var(--radius-full);
          padding-inline: var(--space-4);
        }

        #dismiss {
          background: var(--color-on-dark-dim);
          color: var(--color-on-dark-muted);
          border-radius: var(--radius-full);
          padding-inline: var(--space-3);
        }
      </style>
      <div class="bar">
        <span>${t('update-banner.available')}</span>
        <div class="actions">
          <button id="reload">${t('update-banner.reload')}</button>
          <button id="dismiss" aria-label="${t('update-banner.dismiss')}">&#x2715;</button>
        </div>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'alert');
    this._onUpdate = visible => {
      if (visible) {
        this.removeAttribute('hidden');
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty(
            '--update-banner-height', `${this.offsetHeight}px`
          );
        });
      }
    };
    subscribe('updateAvailable', this._onUpdate);

    this._onReload = () => {
      navigator.serviceWorker.getRegistration()
        .then(r => {
          if (r?.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
          else location.reload();
        });
    };
    this._onDismiss = () => {
      this.setAttribute('hidden', '');
      document.documentElement.style.removeProperty('--update-banner-height');
    };

    this.shadowRoot.querySelector('#reload').addEventListener('click', this._onReload);
    this.shadowRoot.querySelector('#dismiss').addEventListener('click', this._onDismiss);
  }

  unsubscribe() {
    unsubscribe('updateAvailable', this._onUpdate);
    this.shadowRoot.querySelector('#reload')?.removeEventListener('click', this._onReload);
    this.shadowRoot.querySelector('#dismiss')?.removeEventListener('click', this._onDismiss);
  }
}

customElements.define('update-banner', UpdateBanner);
