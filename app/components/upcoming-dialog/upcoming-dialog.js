import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

// Urgency-first section order, matching the notification digest's own
// grouping — see app/utils/upcoming.js for how each bucket is computed.
const SECTIONS = [
  { key: 'overdue',  labelKey: 'upcoming.section-overdue',  dotClass: 'od' },
  { key: 'today',    labelKey: 'upcoming.section-today',    dotClass: 'tod' },
  { key: 'tomorrow', labelKey: 'upcoming.section-tomorrow', dotClass: 'tom' },
];

// UI-tier: property-in (open()) / event-out (upcoming-row-tap, modal-close
// from the wrapped modal-dialog), zero store knowledge — bottom-nav.js owns
// computing the bucketed entries (via app/utils/upcoming.js) and the
// navigate-to-context behaviour a row tap triggers.
class UpcomingDialog extends AppElement {
  template() {
    return `
      <style>
        /* Consistent modal padding across the app: --space-5 on both axes. */
        #dialog { --space-6: var(--space-5); }

        /* Same nested-scroll-region technique as reflection-dialog: a single
           flex-column frame fills modal-dialog's own .body exactly, so .body
           itself never needs to scroll — only .upcoming-scroll does, and its
           scrollbar naturally starts below the fixed title instead of
           bleeding up alongside it. */
        .upcoming-frame {
          display: flex;
          flex-direction: column;
          block-size: 100%;
        }

        .upcoming-scroll {
          flex: 1;
          min-block-size: 0;
          overflow-y: auto;
        }

        .upcoming-header {
          flex-shrink: 0;
          padding-block-end: var(--space-3);
          margin-block-end: var(--space-3);
          border-block-end: 0.5px solid var(--color-border);
        }

        .upcoming-title {
          margin: 0;
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
        }

        .upcoming-section-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding-block: var(--space-3) var(--space-1);
        }

        .upcoming-section-head:first-child {
          padding-block-start: 0;
        }

        .upcoming-dot {
          inline-size: 8px;
          block-size: 8px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }
        .upcoming-dot.od,
        .upcoming-dot.tod { background: var(--color-danger); }
        .upcoming-dot.tom { background: var(--color-warning); }

        .upcoming-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
        }

        .upcoming-section-count {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
        }

        .upcoming-row {
          display: flex;
          flex-direction: column;
          gap: 1px;
          inline-size: 100%;
          min-block-size: var(--touch-target);
          padding-block: var(--space-2);
          border: none;
          background: none;
          cursor: pointer;
          text-align: start;
          font-family: var(--font-family);
        }

        .upcoming-row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        .upcoming-row-title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upcoming-row-sub {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upcoming-empty {
          margin: 0;
          padding-block: var(--space-4);
          font-size: var(--font-size-body);
          color: var(--color-text-muted);
          text-align: center;
        }

        /* Matches reflection-dialog's own #close exactly: a plain text
           button, no separate save step exists on this dialog either. */
        .close-btn {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          background: none;
          color: var(--color-text-secondary);
        }

        .close-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <modal-dialog id="dialog" aria-label="${t('upcoming.heading')}">
        <div class="upcoming-frame">
          <div class="upcoming-header">
            <h2 class="upcoming-title">${t('upcoming.heading')}</h2>
          </div>
          <div class="upcoming-scroll" id="upcoming-scroll">
            <p class="upcoming-empty" id="upcoming-empty" hidden>${t('upcoming.empty')}</p>
          </div>
        </div>
        <div slot="footer" style="display:flex; justify-content:flex-end; flex:1;">
          <button type="button" class="close-btn" id="upcoming-close-btn">${t('upcoming.close')}</button>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._dialog = this.shadowRoot.querySelector('#dialog');
    this._scroll = this.shadowRoot.querySelector('#upcoming-scroll');
    this._emptyEl = this.shadowRoot.querySelector('#upcoming-empty');
    this._items = { overdue: [], today: [], tomorrow: [] };

    this.listen(this._scroll, 'click', e => {
      const row = e.target.closest('.upcoming-row');
      if (!row) return;
      const detail = { kind: row.dataset.kind, id: row.dataset.id };
      if (row.dataset.kind === 'goal') {
        detail.year = row.dataset.year;
        detail.section = row.dataset.section;
      } else {
        detail.listId = row.dataset.listId;
      }
      this.dispatchEvent(new CustomEvent('upcoming-row-tap', { bubbles: true, composed: true, detail }));
      this._dialog.close();
    });

    this.listen(this.shadowRoot.querySelector('#upcoming-close-btn'), 'click', () => this._dialog.close());
  }

  // Pre-fills from the { overdue, today, tomorrow } shape app/utils/upcoming.js
  // produces and opens. Zero store knowledge — bottom-nav.js recomputes this
  // on every relevant store change and just hands over the latest snapshot.
  open(items) {
    this._items = items ?? { overdue: [], today: [], tomorrow: [] };
    this._render();
    this._dialog.show();
  }

  _render() {
    const nodes = [];
    let any = false;
    for (const { key, labelKey, dotClass } of SECTIONS) {
      const entries = this._items[key] ?? [];
      if (!entries.length) continue;
      any = true;
      nodes.push(this._buildSectionHead(labelKey, dotClass, entries.length));
      for (const entry of entries) nodes.push(this._buildRow(entry));
    }
    this._emptyEl.hidden = any;
    this._scroll.replaceChildren(this._emptyEl, ...nodes);
  }

  _buildSectionHead(labelKey, dotClass, count) {
    const head = document.createElement('div');
    head.className = 'upcoming-section-head';
    head.innerHTML = `
      <span class="upcoming-dot ${dotClass}" aria-hidden="true"></span>
      <span class="upcoming-section-label"></span>
      <span class="upcoming-section-count"></span>
    `;
    head.querySelector('.upcoming-section-label').textContent = t(labelKey);
    head.querySelector('.upcoming-section-count').textContent = String(count);
    return head;
  }

  _buildRow(entry) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'upcoming-row';
    row.dataset.kind = entry.kind;
    row.dataset.id = entry.id;
    if (entry.kind === 'goal') {
      row.dataset.year = entry.year;
      row.dataset.section = entry.section;
    } else {
      row.dataset.listId = entry.listId;
    }
    const sub = entry.kind === 'goal'
      ? t('upcoming.sub-goal', { year: entry.year, section: t(`goal-dialog.move-section-${entry.section}`) })
      : t('upcoming.sub-item', { list: entry.listName });
    row.innerHTML = `
      <span class="upcoming-row-title"></span>
      <span class="upcoming-row-sub"></span>
    `;
    row.querySelector('.upcoming-row-title').textContent = entry.title;
    row.querySelector('.upcoming-row-sub').textContent = sub;
    row.setAttribute('aria-label', `${entry.title}, ${sub}`);
    return row;
  }
}

customElements.define('upcoming-dialog', UpcomingDialog);
