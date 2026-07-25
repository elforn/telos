import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { tagColor } from '../../utils/tag-color.js';

// bulk-tag-editor — UI component for applying tags to several list items at once.
//
// Fed the tag arrays of the currently selected items via `selectedTags`, it
// derives which tags are on ALL of them (rendered as solid chips) vs on only
// SOME (rendered dim / indeterminate). It owns no store state — every change is
// announced upward and the parent re-feeds `selectedTags` so chips restyle live.
//
// Properties:
//   selectedTags  Array<string[]>  — each selected item's tags. Drives common vs partial.
//   existingTags  string[]         — all known tags, for the add-input's autocomplete.
//
// Events (bubbles + composed):
//   bulk-tag-apply   { tag }  — add this tag to all selected items
//   bulk-tag-remove  { tag }  — remove this tag from all selected items

class BulkTagEditor extends AppElement {
  set selectedTags(value) {
    this._selectedTags = (value ?? []).map(tags => [...(tags ?? [])]);
    if (this.shadowRoot) { this._renderChips(); this._updateSuggestions(); }
  }
  get selectedTags() { return this._selectedTags ?? []; }

  set existingTags(value) {
    this._existingTags = value ?? [];
    if (this.shadowRoot) this._updateSuggestions();
  }
  get existingTags() { return this._existingTags ?? []; }

  // Tags present on every selected item.
  _common() {
    const lists = this._selectedTags ?? [];
    if (!lists.length) return [];
    return [...new Set(lists[0])].filter(tag => lists.every(l => l.includes(tag)));
  }

  // Tags present on some — but not all — selected items.
  _partial() {
    const lists = this._selectedTags ?? [];
    if (lists.length < 2) return [];
    const all = new Set(lists.flat());
    const common = new Set(this._common());
    return [...all].filter(tag => !common.has(tag));
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

        .chips-wrap {
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

        .chips-wrap:focus-within { border-color: var(--color-accent); }

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
        }

        /* Partial (on some, not all) — dim + dashed to read as indeterminate. */
        .tag-chip.partial {
          opacity: 0.6;
          border: 1px dashed var(--color-border);
        }

        /* The apply-to-all label button on partial chips. */
        .tag-label {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          color: inherit;
          font: inherit;
          cursor: pointer;
          white-space: nowrap;
          touch-action: manipulation;
        }

        .tag-label:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-full);
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
          border: none;
          color: inherit;
          padding: 0;
          cursor: pointer;
          touch-action: manipulation;
        }

        .tag-chip:hover .tag-chip-x { background: var(--_chip-x-bg-hover); }

        .tag-chip-x:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .tag-input {
          flex: 1 0 80px;
          min-inline-size: 80px;
          background: none;
          border: none;
          padding: 0;
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          color: var(--color-text-primary);
          outline: none;
          inline-size: auto;
          display: inline;
        }

        .tag-input::placeholder { color: var(--color-text-muted); }

        .suggestions {
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

        .suggestions[hidden] { display: none; }

        .suggestion {
          min-block-size: 28px;
          padding-block: 0;
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-caption);
          font-family: var(--font-family);
          cursor: pointer;
          touch-action: manipulation;
        }

        .suggestion:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      </style>

      <div class="tag-area">
        <div class="suggestions" hidden aria-label="${t('item-dialog.tags-label')}"></div>
        <div class="chips-wrap" role="group" aria-label="${t('item-dialog.tags-label')}">
          <input type="text"
                 class="tag-input"
                 aria-label="${t('item-dialog.tags-placeholder')}"
                 placeholder="${t('item-dialog.tags-placeholder')}"
                 autocomplete="off"
                 autocapitalize="none"
                 autocorrect="off"
                 spellcheck="false"
                 enterkeyhint="done" />
        </div>
      </div>
    `;
  }

  subscribe() {
    this._selectedTags ??= [];
    this._existingTags ??= [];
    this._chipsWrap = this.shadowRoot.querySelector('.chips-wrap');
    this._input = this.shadowRoot.querySelector('.tag-input');
    this._suggestions = this.shadowRoot.querySelector('.suggestions');

    this._onKeyDown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._commitInput(this._input.value);
      }
    };

    this._onInput = () => {
      const val = this._input.value;
      if (val.includes(',')) {
        val.split(',').slice(0, -1).forEach(p => this._commitInput(p));
        this._input.value = val.split(',').at(-1);
      }
      this._updateSuggestions();
    };

    this._onBlur = () => {
      if (this._input.value.trim()) this._commitInput(this._input.value);
    };

    // × → remove from all; a partial chip's label button → apply to all.
    this._onWrapClick = e => {
      const x = e.target.closest('.tag-chip-x');
      if (x) { this._emit('bulk-tag-remove', x.closest('.tag-chip').dataset.tag); return; }
      const label = e.target.closest('.tag-label');
      if (label) { this._emit('bulk-tag-apply', label.closest('.tag-chip').dataset.tag); return; }
      if (!e.target.closest('.tag-chip')) this._input.focus();
    };

    this._input.addEventListener('keydown', this._onKeyDown);
    this._input.addEventListener('input', this._onInput);
    this._input.addEventListener('blur', this._onBlur);
    this._chipsWrap.addEventListener('click', this._onWrapClick);
    // Keep the mobile keyboard up: taps on chips/suggestions must not blur the input.
    this._onSuggestionPointerDown = e => e.preventDefault();
    this._suggestions.addEventListener('pointerdown', this._onSuggestionPointerDown);
    this._onChipPointerDown = e => { if (e.target.closest('.tag-chip')) e.preventDefault(); };
    this._chipsWrap.addEventListener('pointerdown', this._onChipPointerDown);

    this._renderChips();
    this._updateSuggestions();
  }

  unsubscribe() {
    this._input?.removeEventListener('keydown', this._onKeyDown);
    this._input?.removeEventListener('input', this._onInput);
    this._input?.removeEventListener('blur', this._onBlur);
    this._chipsWrap?.removeEventListener('click', this._onWrapClick);
    this._suggestions?.removeEventListener('pointerdown', this._onSuggestionPointerDown);
    this._chipsWrap?.removeEventListener('pointerdown', this._onChipPointerDown);
  }

  _commitInput(raw) {
    const tag = raw.replace(/,/g, '').trim().toLowerCase();
    this._input.value = '';
    if (!tag) return;
    this._emit('bulk-tag-apply', tag);
    this._updateSuggestions();
  }

  _emit(name, tag) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true, composed: true, detail: { tag },
    }));
  }

  _renderChips() {
    if (!this._chipsWrap) return;
    this._chipsWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
    // A chip is a presentational container holding sibling controls (never nested
    // buttons): the label is an "apply to all" button only for partial tags, plain
    // text for common ones; the × is always a "remove from all" button.
    const make = (tag, partial) => {
      const chip = document.createElement('span');
      chip.className = partial ? 'tag-chip partial' : 'tag-chip';
      chip.dataset.tag = tag;
      chip.style.background = tagColor(tag);
      if (partial) {
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'tag-label';
        label.setAttribute('aria-label', t('list-detail.bulk-tag-apply-all', { tag }));
        label.textContent = tag;
        chip.appendChild(label);
      } else {
        chip.appendChild(document.createTextNode(tag));
      }
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'tag-chip-x';
      x.setAttribute('aria-label', t('tag.remove', { tag }));
      x.textContent = '×';
      chip.appendChild(x);
      this._chipsWrap.insertBefore(chip, this._input);
    };
    // Common first (solid), then partial (dim).
    for (const tag of this._common()) make(tag, false);
    for (const tag of this._partial()) make(tag, true);
  }

  _updateSuggestions() {
    if (!this._suggestions) return;
    const partial = this._input.value.trim().toLowerCase();
    if (!partial) { this._suggestions.hidden = true; this._suggestions.replaceChildren(); return; }
    const present = new Set(this._common());
    const matches = (this._existingTags ?? [])
      .filter(tag => tag.includes(partial) && !present.has(tag));
    if (!matches.length) { this._suggestions.hidden = true; this._suggestions.replaceChildren(); return; }
    this._suggestions.replaceChildren();
    for (const tag of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion';
      btn.textContent = tag;
      btn.style.borderColor = tagColor(tag);
      btn.addEventListener('click', () => { this._emit('bulk-tag-apply', tag); this._input.value = ''; this._updateSuggestions(); this._input.focus(); });
      this._suggestions.appendChild(btn);
    }
    this._suggestions.hidden = false;
  }
}

customElements.define('bulk-tag-editor', BulkTagEditor);
