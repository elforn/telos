import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';

class NotFoundPage extends AppElement {
  template() {
    return `
      <style>
        :host { display: block; }
        main {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-block-size: 100dvh;
          padding: var(--space-6);
          gap: var(--space-4);
          text-align: center;
        }
        .code {
          font-size: 5rem;
          font-weight: var(--font-weight-bold);
          color: var(--color-accent);
          line-height: 1;
        }
        h1 {
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          margin: 0;
        }
        p {
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          margin: 0;
        }
        button {
          margin-block-start: var(--space-2);
          background: var(--color-accent);
          color: var(--color-text-inverse);
          border: none;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-6);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-bold);
          min-block-size: 44px;
          cursor: pointer;
        }
        button:active { background: var(--color-accent-dark); }
      </style>
      <main>
        <span class="code" aria-hidden="true">404</span>
        <h1>Page not found</h1>
        <p>This URL doesn't exist. Head back to your goals.</p>
        <button id="home-btn">Go to this year</button>
      </main>
    `;
  }

  subscribe() {
    this._onHome = () => navigate(`${BASE_PATH}/${new Date().getFullYear()}`);
    this.shadowRoot.querySelector('#home-btn').addEventListener('click', this._onHome);
  }

  unsubscribe() {
    this.shadowRoot.querySelector('#home-btn')?.removeEventListener('click', this._onHome);
  }
}

customElements.define('not-found-page', NotFoundPage);
