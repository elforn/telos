import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { DATE_FILTER_KEYS } from '../../utils/urgency.js';

// date-filter-row — the 5-pill due-date bucket filter (Overdue/Week/Month/
// Later/None) shared by home-page, lists-page and list-detail-page. Extracted
// because the three pages' copies were byte-for-byte identical (markup, dot
// colour CSS, toggle wiring) — see ComponentDuplicationReport.md.
//
// Properties:
//   selected  Set<string> | string[]  — currently-active bucket keys.
//             Setting it re-renders pressed state and does NOT dispatch
//             date-toggle (programmatic sync from the page's own filter state).
//
// Events (bubbles + composed):
//   date-toggle  { key }  — a pill was tapped. The page owns the Set mutation
//                            (dates.add/delete) and re-feeds `selected`, same
//                            division of responsibility as bulk-tag-editor.

class DateFilterRow extends AppElement {
  set selected(value) {
    this._selected = new Set(value ?? []);
    if (this.shadowRoot) this._syncPressed();
  }
  get selected() { return new Set(this._selected ?? []); }

  template() {
    return `
      <style>
        :host { display: block; }

        .date-filter-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          overflow-x: auto;
          flex-wrap: nowrap;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .date-filter-row::-webkit-scrollbar { display: none; }

        .filter-date-pill {
          flex-shrink: 0;
          min-block-size: var(--touch-target-small);
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          white-space: nowrap;
          touch-action: manipulation;
        }

        .filter-date-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-text-on-accent);
        }

        .filter-date-pill:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Date pills carry a small urgency-coloured dot so the row self-documents. */
        .filter-date-pill::before {
          content: '';
          display: inline-block;
          inline-size: 8px;
          block-size: 8px;
          border-radius: var(--radius-full);
          margin-inline-end: var(--space-1);
          vertical-align: middle;
        }
        .filter-date-pill[data-date="overdue"]::before { background: var(--color-danger); }
        .filter-date-pill[data-date="week"]::before    { background: var(--color-warning); }
        .filter-date-pill[data-date="month"]::before   { background: var(--color-success); }
        .filter-date-pill[data-date="later"]::before   { background: var(--color-text-muted); }
        .filter-date-pill[data-date="none"]::before    { box-shadow: inset 0 0 0 1.5px var(--color-text-muted); }
      </style>

      <div class="date-filter-row" id="row" role="group" aria-label="${t('filter.date-label')}">
        ${DATE_FILTER_KEYS.map(key => `
          <button type="button" class="filter-date-pill" data-date="${key}" aria-pressed="false">${t('filter.date-' + key)}</button>
        `).join('')}
      </div>
    `;
  }

  subscribe() {
    this._selected ??= new Set();
    this._row = this.shadowRoot.querySelector('#row');

    this._onClick = e => {
      const btn = e.target.closest('.filter-date-pill');
      if (!btn) return;
      const key = btn.dataset.date;
      if (!DATE_FILTER_KEYS.includes(key)) return;
      this.dispatchEvent(new CustomEvent('date-toggle', {
        bubbles: true, composed: true, detail: { key },
      }));
    };
    this._row.addEventListener('click', this._onClick);

    this._syncPressed();
  }

  unsubscribe() {
    this._row?.removeEventListener('click', this._onClick);
  }

  _syncPressed() {
    for (const key of DATE_FILTER_KEYS) {
      const btn = this.shadowRoot.querySelector(`.filter-date-pill[data-date="${key}"]`);
      if (!btn) continue;
      const on = this._selected.has(key);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }
}

customElements.define('date-filter-row', DateFilterRow);
