import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { parseImportText } from '../../utils/parse-import-text.js';
import { installDialogSnapshot } from '../../utils/dialog-snapshot.js';
import { installDraftToggle } from '../../utils/draft-toggle.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

const SNAPSHOT_KEY = 'telos:snapshot.import-text';

// Free-text → draft-items dialog: paste or pre-filled text on one side, a
// live "N items" preview on the other, nothing committed until confirm.
// Used both for list-detail-page's own "Add from text" menu action (draftKey
// scoped per list) and bottom-nav's Share Target text/URL landing (draftKey
// fixed, no list chosen yet — see _onShareText in bottom-nav.js). Emits
// `import-text-confirm` with the parsed { title, note, url } rows; the
// consumer decides what to do with them (add to the current list, or show
// a destination picker) — this component has zero store knowledge.
class ImportTextDialog extends AppElement {
  set draftKey(val) { this._draftKey = val ?? ''; }
  get draftKey()    { return this._draftKey ?? ''; }

  template() {
    return `
      <style>
        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0;
          margin-block-end: var(--space-2);
        }

        textarea {
          display: block;
          inline-size: 100%;
          min-block-size: 9rem;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          box-sizing: border-box;
          resize: vertical;
          margin-block-end: 0;
        }

        textarea:focus {
          border-color: var(--color-accent);
        }

        textarea::placeholder {
          color: var(--color-text-muted);
        }

        .footer {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .footer-end {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-inline-start: auto;
        }

        #count {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        .footer button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          touch-action: manipulation;
        }

        .footer button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #cancel-btn, #draft-toggle-btn {
          background: none;
          color: var(--color-text-secondary);
        }

        #cta-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          flex-shrink: 0;
        }

        #cta-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
      </style>

      <modal-dialog id="modal" aria-label="${t('import-text.heading')}">
        <p class="menu-section-label">${t('import-text.heading')}</p>
        <textarea id="textarea"
                  placeholder="${t('import-text.placeholder')}"
                  rows="6"
                  enterkeyhint="enter"></textarea>
        <div slot="footer" class="footer">
          <button type="button" id="cancel-btn">${t('import-text.cancel')}</button>
          <button type="button" id="draft-toggle-btn" hidden></button>
          <div class="footer-end">
            <span id="count" hidden></span>
            <button type="button" id="cta-btn" disabled>${t('import-text.cta')}</button>
          </div>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal      = this.shadowRoot.querySelector('#modal');
    this._textarea   = this.shadowRoot.querySelector('#textarea');
    this._countEl    = this.shadowRoot.querySelector('#count');
    this._ctaBtn     = this.shadowRoot.querySelector('#cta-btn');
    this._toggleBtn  = this.shadowRoot.querySelector('#draft-toggle-btn');
    this._parsed     = [];

    const applyText = ({ text }) => {
      this._textarea.value = text ?? '';
      this._parsed = parseImportText(this._textarea.value);
      this._updateUI();
    };

    this._snapshot = installDialogSnapshot(this, {
      key:      SNAPSHOT_KEY,
      isOpen:   () => !!this._modal.shadowRoot?.querySelector('dialog')?.open,
      recordId: () => this.draftKey,
      snapshot: () => {
        const text = this._textarea.value;
        return text.trim() ? { text } : null;
      },
      restore: applyText,
    });

    this._draftToggle = installDraftToggle(this, {
      button: this._toggleBtn,
      applyValues: applyText,
    });

    this._onTextarea = () => {
      this._parsed = parseImportText(this._textarea.value);
      this._updateUI();
    };
    this.listen(this._textarea, 'input', this._onTextarea);

    this._onCancel = () => this._modal.close();
    this.listen(this.shadowRoot.querySelector('#cancel-btn'), 'click', this._onCancel);

    // Any dismissal (Cancel, backdrop, swipe-down) keeps unsaved text as a draft;
    // a successful confirm clears the textarea first so nothing is re-captured.
    this._onModalClose = () => {
      if (this._textarea.value.trim()) this._snapshot.capture();
      else this._snapshot.clear();
    };
    this.listen(this._modal, 'modal-close', this._onModalClose);

    this._onCta = () => {
      if (!this._parsed.length) return;
      const items = this._parsed;
      this._textarea.value = '';
      this._parsed = [];
      this._modal.close(); // → modal-close → _onModalClose sees the now-blank textarea, clears the draft
      this.dispatchEvent(new CustomEvent('import-text-confirm', {
        bubbles: true, composed: true, detail: { items },
      }));
    };
    this.listen(this._ctaBtn, 'click', this._onCta);
  }

  // prefillText: pre-populate with incoming share content (treated as
  // existing content to edit — the Clear/Undo toggle target — rather than a
  // blank new entry); omit for the plain "Add from text" menu action, which
  // starts blank and auto-restores any leftover draft, same as before.
  open(prefillText = null) {
    const hasPrefill = prefillText != null;
    const target = { text: hasPrefill ? prefillText : '' };

    this._textarea.value = target.text;
    this._parsed = parseImportText(this._textarea.value);
    this._updateUI();

    const draft = hasPrefill ? null : this._snapshot.restoreFor();
    this._draftToggle.reset({
      draft,
      target,
      clearLabel: t('import-text.draft-clear'),
      undoLabel:  t('import-text.draft-undo'),
    });

    this._modal.show(this._textarea);
  }

  _updateUI() {
    const n = this._parsed.length;
    const m = this._parsed.filter(i => i.note || i.url).length;

    if (n === 0) {
      this._countEl.hidden = true;
      this._countEl.textContent = '';
    } else {
      this._countEl.hidden = false;
      this._countEl.textContent = m > 0
        ? t('import-text.count-extras', { n, m })
        : t('import-text.count', { n });
    }
    this._ctaBtn.disabled = n === 0;
  }
}

customElements.define('import-text-dialog', ImportTextDialog);
