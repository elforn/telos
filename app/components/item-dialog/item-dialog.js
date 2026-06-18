import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

const STATUSES = ['open', 'paused', 'done'];

class ItemDialog extends AppElement {
  open(item = null) {
    this._titleInput.value = item?.title ?? '';
    this._saveBtn.disabled = !this._titleInput.value.trim();
    this._deleteBtn.hidden = !item;
    const status = item?.status ?? 'open';
    const radio = this.shadowRoot.querySelector(`input[name="status"][value="${status}"]`);
    if (radio) radio.checked = true;
    this._noteInput.value = item?.note ?? '';
    this._urlInput.value  = item?.url  ?? '';
    this._syncUrlOpen();
    this._showUrlField(!!item?.url);
    this._saved = false;
    // Block the synthetic click that fires after pointerup on Android Chrome — it lands
    // on the dialog backdrop (top layer) after modal-dialog's _justOpened guard expires.
    this._blockBackdropClick = true;
    this._modal.show();
    if (!item) this._titleInput.select();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._blockBackdropClick = false;
      this._syncNoteHeight();
      if (item) this._noteInput.focus();
    }));
  }

  template() {
    return `
      <style>
        /* Halve the modal's default 24px top/bottom padding */
        #modal { --space-6: var(--space-3); }

        input[type="text"] {
          display: block;
          inline-size: 100%;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          margin-block-end: var(--space-4);
        }

        input[type="text"]:focus { border-color: var(--color-accent); }
        input[type="text"]::placeholder { color: var(--color-text-muted); }

        textarea {
          display: block;
          inline-size: 100%;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          resize: none;
          min-block-size: 3.5rem;
          overflow-y: auto;
          margin-block-end: var(--space-4);
        }

        textarea:focus { border-color: var(--color-accent); }
        textarea::placeholder { color: var(--color-text-muted); }

        /* ── Status + URL toggle ─────────────────────────────────────────── */

        .status-field { margin-block-end: var(--space-4); }

        .pills-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .status-options {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
          align-items: center;
        }

        .status-option {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          cursor: pointer;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          color: var(--color-text-secondary);
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }

        .status-option:has(input:checked) {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .status-option input { display: none; }

        #url-toggle {
          display: inline-flex;
          align-items: center;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-accent);
          background: transparent;
          color: var(--color-accent);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          cursor: pointer;
          flex-shrink: 0;
          min-block-size: auto;
          line-height: normal;
          margin-inline-start: auto;
        }

        #url-toggle[aria-expanded="true"] {
          background: var(--color-accent-subtle);
        }

        #url-toggle:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── URL row ─────────────────────────────────────────────────────── */

        .url-row {
          display: flex;
          gap: var(--space-2);
          align-items: center;
          margin-block-start: var(--space-3);
        }

        .url-row input[type="text"] {
          flex: 1;
          margin-block-end: 0;
        }

        #url-open {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-3);
          border-radius: var(--radius-sm);
          border: 0.5px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-accent);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
        }

        #url-open:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Footer ──────────────────────────────────────────────────────── */

        .actions {
          display: flex;
          justify-content: space-between;
          gap: var(--space-2);
          flex: 1;
        }

        .actions-end {
          display: flex;
          gap: var(--space-2);
        }

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

        #delete { background: none; color: var(--color-danger); }
        #cancel { background: none; color: var(--color-text-secondary); }

        #save {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        #save:disabled { opacity: 0.4; cursor: default; }
      </style>

      <modal-dialog id="modal">
        <input id="title-input"
               type="text"
               aria-label="${t('item-dialog.title-placeholder')}"
               placeholder="${t('item-dialog.title-placeholder')}"
               autocomplete="off"
               maxlength="120" />
        <textarea id="note-input"
                  aria-label="${t('item-dialog.note-placeholder')}"
                  placeholder="${t('item-dialog.note-placeholder')}"></textarea>
        <div class="status-field">
          <div class="pills-row">
            <div class="status-options" role="group" aria-label="${t('item-dialog.status-label')}">
              ${STATUSES.map(s => `
                <label class="status-option">
                  <input type="radio" name="status" value="${s}" ${s === 'open' ? 'checked' : ''}>
                  ${t('item-dialog.status-' + s)}
                </label>
              `).join('')}
            </div>
            <button type="button" id="url-toggle" aria-expanded="false">🔗 ${t('item-dialog.url-toggle')}</button>
          </div>
          <div class="url-row" hidden>
            <input id="url-input"
                   type="text"
                   aria-label="${t('item-dialog.url-placeholder')}"
                   placeholder="${t('item-dialog.url-placeholder')}"
                   autocomplete="off"
                   inputmode="url" />
            <button type="button" id="url-open" hidden>${t('item-dialog.url-open')}</button>
          </div>
        </div>
        <div slot="footer" class="actions">
          <button type="button" id="delete" hidden>${t('item-dialog.delete')}</button>
          <div class="actions-end">
            <button type="button" id="cancel">${t('item-dialog.cancel')}</button>
            <button type="button" id="save" disabled>${t('item-dialog.save')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal      = this.shadowRoot.querySelector('#modal');
    this._titleInput = this.shadowRoot.querySelector('#title-input');
    this._noteInput  = this.shadowRoot.querySelector('#note-input');
    this._urlInput   = this.shadowRoot.querySelector('#url-input');
    this._urlOpen    = this.shadowRoot.querySelector('#url-open');
    this._urlToggle  = this.shadowRoot.querySelector('#url-toggle');
    this._urlRow     = this.shadowRoot.querySelector('.url-row');
    this._saveBtn    = this.shadowRoot.querySelector('#save');
    this._deleteBtn  = this.shadowRoot.querySelector('#delete');
    this._saved      = false;

    this._onTitleInput = () => {
      this._saveBtn.disabled = !this._titleInput.value.trim();
    };

    this._onNoteInput = () => this._syncNoteHeight();

    this._onUrlInput = () => this._syncUrlOpen();

    this._onUrlToggle = () => {
      this._showUrlField(this._urlRow.hidden);
      if (!this._urlRow.hidden) this._urlInput.focus();
      requestAnimationFrame(() => this._syncNoteHeight());
    };

    this._onUrlOpen = () => {
      const url = this._urlInput.value.trim();
      if (url) window.open(url, '_blank', 'noopener');
    };

    this._onSave = () => {
      const title = this._titleInput.value.trim();
      if (!title) return;
      const status = this.shadowRoot.querySelector('input[name="status"]:checked')?.value ?? 'open';
      const note   = this._noteInput.value.trim() || undefined;
      const url    = this._urlInput.value.trim()  || undefined;
      this._saved = true;
      this.dispatchEvent(new CustomEvent('item-saved', {
        bubbles: true, composed: true, detail: { title, status, note, url },
      }));
      this._modal.close();
    };

    this._onCancel = () => this._modal.close();

    this._onDelete = () => {
      this.dispatchEvent(new CustomEvent('item-delete', { bubbles: true, composed: true }));
      this._modal.close();
    };

    this._onModalClose = e => {
      e.stopPropagation();
      this._saved = false;
    };

    // Intercept backdrop clicks that fire after the dialog opens on Android Chrome.
    // The synthetic click from the opening tap reaches the <dialog> backdrop (top layer)
    // after modal-dialog's _justOpened guard has expired. Capture it here first.
    this._blockBackdropClick = false;
    this._onShadowCapture = e => {
      if (this._blockBackdropClick && e.target === this._modal) {
        this._blockBackdropClick = false;
        e.stopPropagation();
      }
    };
    this.shadowRoot.addEventListener('click', this._onShadowCapture, { capture: true });

    this._onKeyDown = e => { if (e.key === 'Enter') this._onSave(); };

    this._onResize = () => this._syncNoteHeight();

    this._titleInput.addEventListener('input',   this._onTitleInput);
    this._titleInput.addEventListener('keydown', this._onKeyDown);
    this._noteInput.addEventListener('input',    this._onNoteInput);
    this._urlInput.addEventListener('input',     this._onUrlInput);
    this._urlToggle.addEventListener('click',    this._onUrlToggle);
    this._urlOpen.addEventListener('click',      this._onUrlOpen);
    this._saveBtn.addEventListener('click',   this._onSave);
    this._deleteBtn.addEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel').addEventListener('click', this._onCancel);
    this._modal.addEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);
  }

  unsubscribe() {
    this._titleInput?.removeEventListener('input',   this._onTitleInput);
    this._titleInput?.removeEventListener('keydown', this._onKeyDown);
    this._noteInput?.removeEventListener('input',    this._onNoteInput);
    this._urlInput?.removeEventListener('input',     this._onUrlInput);
    this._urlToggle?.removeEventListener('click',    this._onUrlToggle);
    this._urlOpen?.removeEventListener('click',      this._onUrlOpen);
    this._saveBtn?.removeEventListener('click',   this._onSave);
    this._deleteBtn?.removeEventListener('click', this._onDelete);
    this.shadowRoot.querySelector('#cancel')?.removeEventListener('click', this._onCancel);
    this._modal?.removeEventListener('modal-close', this._onModalClose);
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
    this.shadowRoot?.removeEventListener('click', this._onShadowCapture, { capture: true });
  }

  _syncNoteHeight() {
    const ta = this._noteInput;
    if (!ta) return;
    ta.style.blockSize = 'auto';
    const vh = window.visualViewport?.height ?? window.innerHeight;
    // Subtract the URL row height when it's visible so the textarea shrinks to fit
    const urlRowH = this._urlRow?.hidden ? 0 : (this._urlRow?.offsetHeight ?? 0);
    const minH = 56;
    const maxH = Math.max(vh - 280 - urlRowH, 120);
    ta.style.blockSize = `${Math.max(Math.min(ta.scrollHeight, maxH), minH)}px`;
  }

  _syncUrlOpen() {
    if (this._urlOpen) this._urlOpen.hidden = !this._urlInput.value.trim();
  }

  _showUrlField(show) {
    this._urlRow.hidden = !show;
    this._urlToggle.setAttribute('aria-expanded', String(show));
  }
}

customElements.define('item-dialog', ItemDialog);
