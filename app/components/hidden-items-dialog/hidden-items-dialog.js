import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

// UI-tier: property-in (open(items)) / event-out (upcoming-row-tap, reused
// verbatim from upcoming-dialog.js so bottom-nav.js's existing navigate-and-
// flash handler works unchanged for both dialogs — the "where does this
// take me" behaviour is identical, only which items get shown differs),
// zero store knowledge. bottom-nav.js owns computing the entries (via
// app/utils/upcoming.js's collectHiddenUrgent) and opening this dialog.
//
// Deliberately second-class relative to <upcoming-dialog>, not a second copy
// of it: a flat list, no folding sections, no per-row "why" detail, no
// urgency colour-coding on the rows themselves — these are items the user
// has already chosen not to be shown, and the whole point of this dialog is
// a quiet, plain "here's what that's hiding," not a second Upcoming view.
// Reachable only from a link inside <upcoming-dialog>, never its own bell/
// badge, and never a notification trigger on its own (see
// notification-digest.js's buildDigest).
class HiddenItemsDialog extends AppElement {
  template() {
    return `
      <style>
        #dialog { --space-6: var(--space-5); }

        .hidden-frame {
          display: flex;
          flex-direction: column;
          block-size: 100%;
        }

        .hidden-scroll {
          flex: 1;
          min-block-size: 0;
          overflow-y: auto;
        }

        .hidden-header {
          flex-shrink: 0;
          padding-block-end: var(--space-3);
          margin-block-end: var(--space-3);
          border-block-end: 0.5px solid var(--color-border);
        }

        .hidden-title {
          margin: 0 0 var(--space-1);
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
        }

        .hidden-subtitle {
          margin: 0;
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
        }

        .hidden-row {
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

        .hidden-row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        .hidden-row-title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hidden-row-sub {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hidden-empty {
          margin: 0;
          padding-block: var(--space-4);
          font-size: var(--font-size-body);
          color: var(--color-text-muted);
          text-align: center;
        }

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

      <modal-dialog id="dialog" aria-label="${t('hidden-items.heading')}">
        <div class="hidden-frame">
          <div class="hidden-header">
            <h2 class="hidden-title">${t('hidden-items.heading')}</h2>
            <p class="hidden-subtitle">${t('hidden-items.subtitle')}</p>
          </div>
          <div class="hidden-scroll" id="hidden-scroll">
            <p class="hidden-empty" id="hidden-empty" hidden>${t('hidden-items.empty')}</p>
          </div>
        </div>
        <div slot="footer" style="display:flex; justify-content:flex-end; flex:1;">
          <button type="button" class="close-btn" id="hidden-close-btn">${t('hidden-items.close')}</button>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._dialog = this.shadowRoot.querySelector('#dialog');
    this._scroll = this.shadowRoot.querySelector('#hidden-scroll');
    this._emptyEl = this.shadowRoot.querySelector('#hidden-empty');
    this._items = [];

    this.listen(this._scroll, 'click', e => {
      const row = e.target.closest('.hidden-row');
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

    this.listen(this.shadowRoot.querySelector('#hidden-close-btn'), 'click', () => this._dialog.close());
  }

  // Pre-fills from collectHiddenUrgent's flat entry array and opens. Zero
  // store knowledge — bottom-nav.js recomputes this on every relevant store
  // change and just hands over the latest snapshot.
  open(items) {
    this._items = items ?? [];
    this._render();
    this._dialog.show();
  }

  _render() {
    const nodes = this._items.map(entry => this._buildRow(entry));
    this._emptyEl.hidden = this._items.length > 0;
    this._scroll.replaceChildren(this._emptyEl, ...nodes);
  }

  _buildRow(entry) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'hidden-row';
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
      <span class="hidden-row-title"></span>
      <span class="hidden-row-sub"></span>
    `;
    row.querySelector('.hidden-row-title').textContent = entry.title;
    row.querySelector('.hidden-row-sub').textContent = sub;
    row.setAttribute('aria-label', `${entry.title}, ${sub}`);
    return row;
  }
}

customElements.define('hidden-items-dialog', HiddenItemsDialog);
