import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { tagColor } from '../../utils/tag-color.js';

// tag-input — UI component for editing a single record's tag list (chips +
// free-text add + autocomplete). Extracted from goal-dialog/item-dialog,
// which had byte-for-byte identical tag-chip markup/CSS/behavior.
//
// Properties:
//   tags          string[]  — current chip list. Setting it re-renders and does
//                              NOT dispatch tags-changed (it's a programmatic reset,
//                              e.g. opening a different record).
//   existingTags  string[]  — all known tags, for the add-input's autocomplete.
//
// Events (bubbles + composed):
//   tags-changed  { tags }  — fired whenever the user adds or removes a tag.
//                              The parent decides whether/how to propagate this
//                              (e.g. dialogs suppress it while _isNew).
//
// Methods:
//   commitPending()  — commits any text still sitting uncommitted in the add
//                       input as a tag (no trailing comma/Enter needed), and
//                       returns the resulting tags array. Does NOT dispatch
//                       tags-changed — callers read the return value directly,
//                       matching the original dialogs' commit-on-read behavior.

class TagInput extends AppElement {
  set tags(value) {
    this._tags = [...(value ?? [])];
    if (this.shadowRoot) { this._renderChips(); this._updateSuggestions(); }
  }
  get tags() { return [...(this._tags ?? [])]; }

  set existingTags(value) {
    this._existingTags = value ?? [];
    if (this.shadowRoot) this._updateSuggestions();
  }
  get existingTags() { return this._existingTags ?? []; }

  commitPending() {
    this._commitPendingTag();
    return this.tags;
  }

  template() {
    return `
      <style>
        :host {
          --_chip-x-font-size:    0.9em;
          --_chip-x-bg:           rgba(0, 0, 0, 0.12);
          --_chip-x-bg-hover:     rgba(0, 0, 0, 0.22);
          --_suggestions-shadow:  0 -4px 10px rgba(0, 0, 0, 0.07);
          display: block;
        }

        .tag-area {
          position: relative;
        }

        .tag-chips-wrap {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          gap: var(--space-2);
          align-items: stretch;
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          box-sizing: border-box;
          cursor: text;
        }

        .tag-chips-wrap:focus-within { border-color: var(--color-accent); }

        .tag-chip {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          box-sizing: border-box;
          min-block-size: 0;
          gap: var(--space-1);
          padding-inline-start: var(--space-3);
          padding-inline-end: var(--space-1);
          color: var(--color-text-primary);
          border-radius: var(--radius-full);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          font-family: var(--font-family);
          white-space: nowrap;
          border: none;
          cursor: pointer;
          touch-action: manipulation;
        }

        .tag-chip:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .tag-chip-x {
          background: var(--_chip-x-bg);
          border-radius: var(--radius-full);
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          font-size: var(--_chip-x-font-size);
          pointer-events: none;
        }

        .tag-chip:hover .tag-chip-x { background: var(--_chip-x-bg-hover); }

        .tag-text-input {
          flex: 1 0 80px;
          min-inline-size: 80px;
          background: none;
          border: none;
          padding: 0;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          margin-block-end: 0;
          inline-size: auto;
          display: inline;
        }

        .tag-text-input::placeholder { color: var(--color-text-muted); }

        #tag-suggestions {
          position: absolute;
          inset-block-end: 100%;
          inset-inline: 0;
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          padding-block-start: var(--space-3);
          padding-block-end: var(--space-2);
          background: var(--color-surface);
          border-block-start: 0.5px solid var(--color-border);
          box-shadow: var(--_suggestions-shadow);
          border-start-start-radius: var(--radius-sm);
          border-start-end-radius: var(--radius-sm);
          z-index: 1;
        }

        #tag-suggestions[hidden] { display: none; }

        .tag-suggestion {
          min-block-size: 28px;
          padding-block: 0;
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-caption);
          font-family: var(--font-family);
          touch-action: manipulation;
        }

        .tag-suggestion:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="tag-area">
        <div id="tag-suggestions" hidden aria-label="${t('item-dialog.tags-label')}"></div>
        <div class="tag-chips-wrap" id="tag-chips-wrap" role="group" aria-label="${t('item-dialog.tags-label')}">
          <input type="text"
                 class="tag-text-input"
                 aria-label="${t('item-dialog.tags-placeholder')}"
                 placeholder="${t('item-dialog.tags-placeholder')}"
                 autocomplete="off"
                 autocapitalize="none" />
        </div>
      </div>
    `;
  }

  subscribe() {
    this._tags ??= [];
    this._existingTags ??= [];
    this._tagChipsWrap   = this.shadowRoot.querySelector('#tag-chips-wrap');
    this._tagTextInput   = this.shadowRoot.querySelector('.tag-text-input');
    this._tagSuggestions = this.shadowRoot.querySelector('#tag-suggestions');

    this._onKeyDown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._addTag(this._tagTextInput.value);
      } else if (e.key === 'Backspace' && !this._tagTextInput.value && this._tags.length) {
        e.preventDefault();
        this._removeTag(this._tags[this._tags.length - 1]);
      }
    };

    this._onInput = () => {
      const val = this._tagTextInput.value;
      if (val.includes(',')) {
        val.split(',').slice(0, -1).forEach(p => this._addTag(p));
        this._tagTextInput.value = val.split(',').at(-1);
      }
      this._updateSuggestions();
    };

    this._onBlur = () => {
      if (this._tagTextInput.value.trim()) this._addTag(this._tagTextInput.value);
    };

    this._onWrapClick = e => {
      const chip = e.target.closest('.tag-chip');
      if (chip) { this._removeTag(chip.dataset.tag); return; }
      this._tagTextInput.focus();
    };

    this._tagTextInput.addEventListener('keydown', this._onKeyDown);
    this._tagTextInput.addEventListener('input', this._onInput);
    this._tagTextInput.addEventListener('blur', this._onBlur);
    this._tagChipsWrap.addEventListener('click', this._onWrapClick);
    // Keep the mobile keyboard up: taps on suggestions/chips must not blur the input.
    this._onSuggestionPointerDown = e => e.preventDefault();
    this._tagSuggestions.addEventListener('pointerdown', this._onSuggestionPointerDown);
    this._onChipRemovePointerDown = e => { if (e.target.closest('.tag-chip')) e.preventDefault(); };
    this._tagChipsWrap.addEventListener('pointerdown', this._onChipRemovePointerDown);

    this._renderChips();
    this._updateSuggestions();
  }

  unsubscribe() {
    this._tagTextInput?.removeEventListener('keydown', this._onKeyDown);
    this._tagTextInput?.removeEventListener('input', this._onInput);
    this._tagTextInput?.removeEventListener('blur', this._onBlur);
    this._tagChipsWrap?.removeEventListener('click', this._onWrapClick);
    this._tagSuggestions?.removeEventListener('pointerdown', this._onSuggestionPointerDown);
    this._tagChipsWrap?.removeEventListener('pointerdown', this._onChipRemovePointerDown);
  }

  _addTag(raw) {
    const tag = raw.replace(/,/g, '').trim().toLowerCase();
    if (!tag || this._tags.includes(tag)) { this._tagTextInput.value = ''; return; }
    this._tags.push(tag);
    this._tagTextInput.value = '';
    this._renderChips();
    this._updateSuggestions();
    this._dispatchTagsChanged();
  }

  _removeTag(tag) {
    this._tags = this._tags.filter(t => t !== tag);
    this._renderChips();
    this._dispatchTagsChanged();
  }

  _dispatchTagsChanged() {
    this.dispatchEvent(new CustomEvent('tags-changed', {
      bubbles: true, composed: true, detail: { tags: [...this._tags] },
    }));
  }

  _commitPendingTag() {
    const raw = this._tagTextInput?.value.trim().toLowerCase().replace(/,/g, '');
    if (raw && !this._tags.includes(raw)) {
      this._tags.push(raw);
      if (this._tagTextInput) this._tagTextInput.value = '';
      this._renderChips();
    }
  }

  _renderChips() {
    if (!this._tagChipsWrap) return;
    this._tagChipsWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
    for (const tag of this._tags) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip';
      btn.dataset.tag = tag;
      btn.setAttribute('aria-label', t('tag.remove', { tag }));
      btn.style.background = tagColor(tag);
      btn.appendChild(document.createTextNode(tag));
      const x = document.createElement('span');
      x.className = 'tag-chip-x';
      x.setAttribute('aria-hidden', 'true');
      x.textContent = '×';
      btn.appendChild(x);
      this._tagChipsWrap.insertBefore(btn, this._tagTextInput);
    }
  }

  _updateSuggestions() {
    if (!this._tagSuggestions) return;
    const partial = this._tagTextInput.value.trim().toLowerCase();
    if (!partial) { this._tagSuggestions.hidden = true; this._tagSuggestions.replaceChildren(); return; }
    const matches = (this._existingTags ?? []).filter(tag => tag.includes(partial) && !this._tags.includes(tag));
    if (!matches.length) { this._tagSuggestions.hidden = true; this._tagSuggestions.replaceChildren(); return; }
    this._tagSuggestions.replaceChildren();
    for (const tag of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-suggestion';
      btn.textContent = tag;
      btn.style.borderColor = tagColor(tag);
      btn.addEventListener('click', () => { this._addTag(tag); this._tagTextInput.focus(); });
      this._tagSuggestions.appendChild(btn);
    }
    this._tagSuggestions.hidden = false;
  }
}

customElements.define('tag-input', TagInput);
