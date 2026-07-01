import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

class ListPickerDialog extends AppElement {
  // ── Public properties ────────────────────────────────────────────────────────

  set lists(val) { this._lists = val ?? []; }
  get lists()    { return this._lists ?? []; }

  // 'move' hides the Copy button; 'copy' hides the Move button; null shows both
  set mode(val) { this._mode = val ?? null; }
  get mode()    { return this._mode ?? null; }

  // when set, Move is disabled if only the source list is selected (copy = duplicate)
  set sourceListId(val) { this._sourceListId = val ?? null; }
  get sourceListId()    { return this._sourceListId ?? null; }

  // ── Public API ───────────────────────────────────────────────────────────────

  show() {
    this._selectedIds = new Set();
    if (this._newListInput) {
      this._newListInput.value = '';
      this._newListForm.hidden = true;
      this._newListBtn.hidden  = false;
    }
    this._renderRows();
    this._updateCtaState();
    this._modal.show();
    this._syncItemsHeight();
  }

  template() {
    return `
      <style>
        :host { display: contents; }

        /* ── Modal padding override ──────────────────────────────────────── */
        #modal { --space-6: var(--space-3); }

        /* ── Heading ─────────────────────────────────────────────────────── */
        .heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-3);
        }

        /* ── Count / clear row ───────────────────────────────────────────── */
        #count-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-block-end: var(--space-2);
        }

        #count {
          flex: 1;
          font-size: var(--font-size-caption);
          font-family: var(--font-family);
          color: var(--color-text-muted);
        }

        #clear-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: var(--space-1);
          min-block-size: auto;
          font-size: var(--font-size-body);
          line-height: 1;
        }

        #clear-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        /* ── Items list ──────────────────────────────────────────────────── */
        #items {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          min-block-size: 8rem;
          max-block-size: 60vh;
          overflow-y: auto;
        }

        /* ── List rows ───────────────────────────────────────────────────── */
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          text-align: start;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .row.selected {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .row-name {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
          min-inline-size: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .row-dot {
          display: inline-block;
          inline-size: 8px;
          block-size: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .row-check {
          font-size: var(--font-size-body);
          opacity: 0;
          transition: opacity 0.1s;
          flex-shrink: 0;
        }

        .row.selected .row-check { opacity: 1; }

        /* ── New list row ────────────────────────────────────────────────── */
        #new-list-btn {
          inline-size: 100%;
          text-align: start;
          background: none;
          border: 1px dashed var(--color-border);
          color: var(--color-text-secondary);
          margin-block-end: var(--space-2);
        }

        #new-list-btn:hover, #new-list-btn:focus-visible {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        #new-list-form {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-block-end: var(--space-2);
        }

        #new-list-input {
          flex: 1;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          outline: none;
        }

        #new-list-input:focus {
          border-color: var(--color-accent);
        }

        #new-list-cancel {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          padding-inline: 0;
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
        }

        /* ── Empty state ─────────────────────────────────────────────────── */
        #no-lists-msg {
          color: var(--color-text-muted);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          text-align: center;
          padding-block: var(--space-6);
          margin: 0;
        }

        /* ── Footer buttons ──────────────────────────────────────────────── */
        button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
        }

        button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #back-btn { background: none; color: var(--color-text-secondary); }

        #move-btn {
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        #copy-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #move-btn:disabled, #copy-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        /* ── Footer layout ───────────────────────────────────────────────── */
        .actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          gap: var(--space-2);
          margin-inline-start: auto;
        }
      </style>

      <modal-dialog id="modal" aria-label="${t('item-dialog.move-to-list')}">
        <p class="heading">${t('item-dialog.move-to-list')}</p>
        <div id="count-row" hidden>
          <span id="count"></span>
          <button type="button" id="clear-btn" aria-label="${t('item-dialog.picker-clear')}">✕</button>
        </div>
        <button type="button" id="new-list-btn">${t('item-dialog.new-list-btn')}</button>
        <div id="new-list-form" hidden>
          <input type="text" id="new-list-input" placeholder="${t('item-dialog.new-list-placeholder')}" aria-label="${t('item-dialog.new-list-placeholder')}" autocomplete="off" />
          <button type="button" id="new-list-cancel" aria-label="${t('item-dialog.picker-back')}">✕</button>
        </div>
        <div id="items" role="listbox" aria-multiselectable="true" aria-label="${t('item-dialog.move-to-list')}"></div>
        <p id="no-lists-msg" hidden>${t('item-dialog.no-other-lists')}</p>

        <div slot="footer" class="actions">
          <button type="button" id="back-btn">${t('item-dialog.picker-back')}</button>
          <div class="actions-end">
            <button type="button" id="move-btn" disabled>${t('item-dialog.move-cta')}</button>
            <button type="button" id="copy-btn" disabled>${t('item-dialog.copy-cta')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal     = this.shadowRoot.querySelector('#modal');
    this._itemsEl   = this.shadowRoot.querySelector('#items');
    this._noListsEl = this.shadowRoot.querySelector('#no-lists-msg');
    this._countRow  = this.shadowRoot.querySelector('#count-row');
    this._countEl   = this.shadowRoot.querySelector('#count');
    this._clearBtn  = this.shadowRoot.querySelector('#clear-btn');
    this._moveBtn   = this.shadowRoot.querySelector('#move-btn');
    this._copyBtn   = this.shadowRoot.querySelector('#copy-btn');

    this._newListBtn   = this.shadowRoot.querySelector('#new-list-btn');
    this._newListForm  = this.shadowRoot.querySelector('#new-list-form');
    this._newListInput = this.shadowRoot.querySelector('#new-list-input');

    this._selectedIds = new Set();

    this._onNewListBtn = () => {
      this._newListBtn.hidden  = true;
      this._newListForm.hidden = false;
      this._newListInput.focus();
    };
    this._newListBtn.addEventListener('click', this._onNewListBtn);

    this._onNewListCancel = () => {
      this._newListInput.value = '';
      this._newListForm.hidden = true;
      this._newListBtn.hidden  = false;
      this._updateCtaState();
    };
    this.shadowRoot.querySelector('#new-list-cancel').addEventListener('click', this._onNewListCancel);

    this._onNewListInput = () => this._updateCtaState();
    this._newListInput.addEventListener('input', this._onNewListInput);

    this._onResize = () => this._syncItemsHeight();
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);

    this._onClearBtn = () => {
      this._selectedIds.clear();
      this._itemsEl.querySelectorAll('.row.selected').forEach(row => {
        row.classList.remove('selected');
        row.setAttribute('aria-selected', 'false');
      });
      this._updateCtaState();
    };
    this._clearBtn.addEventListener('click', this._onClearBtn);

    this._onBackBtn = () => this._modal.close();
    this.shadowRoot.querySelector('#back-btn').addEventListener('click', this._onBackBtn);

    this._onMoveBtn = () => this._commit(false);
    this._moveBtn.addEventListener('click', this._onMoveBtn);

    this._onCopyBtn = () => this._commit(true);
    this._copyBtn.addEventListener('click', this._onCopyBtn);
  }

  unsubscribe() {
    this._newListBtn?.removeEventListener('click', this._onNewListBtn);
    this.shadowRoot.querySelector('#new-list-cancel')?.removeEventListener('click', this._onNewListCancel);
    this._newListInput?.removeEventListener('input', this._onNewListInput);
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
    this._clearBtn?.removeEventListener('click', this._onClearBtn);
    this.shadowRoot.querySelector('#back-btn')?.removeEventListener('click', this._onBackBtn);
    this._moveBtn?.removeEventListener('click', this._onMoveBtn);
    this._copyBtn?.removeEventListener('click', this._onCopyBtn);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _syncItemsHeight() {
    if (!this._itemsEl) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    // Subtract fixed chrome: handle + heading + count/new-list area + footer + dialog padding
    this._itemsEl.style.maxBlockSize = `${Math.max(vh - 280, 80)}px`;
  }

  _renderRows() {
    const lists = this.lists;
    this._noListsEl.hidden = lists.length > 0;
    this._itemsEl.replaceChildren();

    for (const list of lists) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.dataset.listId = list.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'row-name';

      if (list.color) {
        const dot = document.createElement('span');
        dot.className = 'row-dot';
        dot.style.background = list.color;
        nameSpan.appendChild(dot);
      }
      nameSpan.appendChild(document.createTextNode(list.name));

      const check = document.createElement('span');
      check.className = 'row-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      row.appendChild(nameSpan);
      row.appendChild(check);

      row.addEventListener('click', () => {
        if (this._selectedIds.has(list.id)) {
          this._selectedIds.delete(list.id);
          row.classList.remove('selected');
          row.setAttribute('aria-selected', 'false');
        } else {
          this._selectedIds.add(list.id);
          row.classList.add('selected');
          row.setAttribute('aria-selected', 'true');
        }
        this._updateCtaState();
      });

      this._itemsEl.appendChild(row);
    }
  }

  _updateCtaState() {
    const count      = this._selectedIds.size;
    const hasNewList = (this._newListInput?.value.trim().length ?? 0) > 0;
    const has        = count > 0 || hasNewList;
    const sourceSelected = this._sourceListId && this._selectedIds.has(this._sourceListId) && !hasNewList;
    this._moveBtn.disabled = !has || !!sourceSelected;
    this._copyBtn.disabled = !has;
    this._moveBtn.hidden = this._mode === 'copy';
    this._copyBtn.hidden = this._mode === 'move';
    this._countRow.hidden = count === 0;
    if (count > 0) this._countEl.textContent = t('item-dialog.picker-selected', { n: count });
  }

  _commit(copy) {
    const targetListIds = [...this._selectedIds];
    const newListName   = this._newListInput?.value.trim() || null;
    if (targetListIds.length === 0 && !newListName) return;
    this.dispatchEvent(new CustomEvent('list-pick', {
      bubbles: true, composed: true,
      detail: { targetListIds, newListName, copy },
    }));
    this._modal.close();
  }
}

customElements.define('list-picker-dialog', ListPickerDialog);
