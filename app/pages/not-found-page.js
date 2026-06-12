import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';

class NotFoundPage extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          min-block-size: 100dvh;
          background-color: var(--color-bg);
          background-image: radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in srgb, var(--color-accent) 8%, transparent) 0%, transparent 70%);
        }

        :host::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
          z-index: 0;
        }

        main {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-block-size: 100dvh;
          padding: var(--space-8);
          gap: var(--space-3);
          text-align: center;
        }

        .year-mock {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          margin-block-end: var(--space-4);
        }

        .code {
          font-size: clamp(5rem, 22vw, 8rem);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          letter-spacing: -0.03em;
          opacity: 0.15;
        }

        .strip {
          inline-size: clamp(5rem, 22vw, 8rem);
          block-size: var(--header-strip-height, 3px);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-block-start: var(--space-2);
        }

        .strip-fill {
          block-size: 100%;
          inline-size: 0%;
          background: var(--color-accent);
          border-radius: var(--radius-full);
        }

        h1 {
          font-size: var(--font-size-title);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          margin: 0;
        }

        p {
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          margin: 0;
          max-inline-size: 26ch;
          line-height: var(--line-height-normal);
        }

        button {
          margin-block-start: var(--space-4);
          background: var(--color-accent);
          color: var(--color-text-inverse);
          border: none;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-6);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-semibold);
          min-block-size: var(--touch-target-lg);
          cursor: pointer;
        }

        button:active { background: var(--color-accent-dark); }

        button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 3px;
        }
      </style>
      <main>
        <div class="year-mock" aria-hidden="true">
          <span class="code">404</span>
          <div class="strip"><div class="strip-fill"></div></div>
        </div>
        <h1>Nothing here</h1>
        <p>This page doesn't exist — but your goals are waiting.</p>
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
