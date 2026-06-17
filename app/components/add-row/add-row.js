import { AppElement } from '../../../_lib/core/app-element.js';

class AddRow extends AppElement {
  template() {
    return `
      <style>
        :host {
          display: block;
          margin-block-start: var(--space-2);
        }

        button {
          display: flex;
          inline-size: 100%;
          min-block-size: var(--touch-target);
          background: none;
          border: var(--add-row-border, 1px dashed currentColor);
          border-radius: var(--radius-md);
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          cursor: pointer;
          color: var(--color-text-secondary);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          padding-inline: var(--space-3);
          touch-action: manipulation;
        }

        button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>
      <button type="button"><slot></slot></button>
    `;
  }
}

customElements.define('add-row', AddRow);
