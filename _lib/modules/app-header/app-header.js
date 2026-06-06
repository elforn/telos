import { AppElement } from '../../core/app-element.js';

class AppHeader extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          position: sticky;
          /* update-banner is position:fixed — this shifts the sticky threshold
             and the element's own flow position below the banner when visible */
          inset-block-start: var(--update-banner-height, 0px);
          margin-block-start: var(--update-banner-height, 0px);
          z-index: 100;
          background: var(--color-bg);
          border-block-end: 1px solid var(--color-border);
          padding-block-start: var(--safe-area-top, 0px);
        }
        .inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-block: var(--space-3);
          padding-inline: var(--space-4);
          min-block-size: var(--touch-target);
        }
        .title {
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          margin-block: 0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
      </style>
      <header class="inner">
        <h1 class="title">${this.getAttribute('label') ?? ''}</h1>
        <div class="action"><slot name="action"></slot></div>
      </header>
    `;
  }
}

customElements.define('app-header', AppHeader);
