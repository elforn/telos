// Destination picker for an aggregate goal's membership — the goal-side
// counterpart to list-picker-dialog, which could not be reused: its property
// is literally `lists`, its rows read list.id/.name/.color, every string it
// uses is an item-dialog.* key, its footer is hardwired to Move/Copy and
// emits list-pick with targetListIds/copy, and its single-line rows have
// nowhere to put the "2026 / Capstone" context a cross-year goal reference
// needs. What is reused is its *pattern*: the .row/.row.selected/.row-check
// markup, role=listbox + role=option + aria-multiselectable, a Set of keys,
// _updateCtaState and _syncItemsHeight.
//
// Deliberately offers no "create a goal" affordance. list-picker-dialog can
// offer one because a list is just a name; a goal needs a year, a section and
// a type, which is a second goal-dialog.
//
// UI tier: everything arrives as a property and leaves as one event. No store
// access at all — the graph it walks for cycle detection is rebuilt from the
// availableGoals array it is handed.
import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { percentValue } from '../../utils/tracking.js';
import { memberKey, wouldCycle, goalsFromEntries } from '../../utils/aggregate.js';
import { attachListboxKeys } from '../../utils/listbox-keys.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

// Room the modal's own chrome needs above and below the scrolling list —
// heading, count row, footer and the dialog's padding. Subtracted from the
// visual viewport so the footer stays reachable with a keyboard open; the
// floor keeps at least one row visible on a very short viewport.
const LIST_CHROME_PX = 280;
const LIST_MIN_PX = 80;

// The store's own section order, for sorting rows within a year.
const SECTION_ORDER = ['capstone', 'milestones', 'wow', 'focus'];

class GoalPickerDialog extends AppElement {
  // ── Public properties ──────────────────────────────────────────────────

  // [{ year, section, goal }] — every goal in the store.
  set availableGoals(val) { this._availableGoals = val ?? []; }
  get availableGoals()    { return this._availableGoals ?? []; }

  // The aggregate being edited, so it can exclude itself and anything that
  // would loop back to it. Undefined for a brand-new goal, which has no id
  // yet and therefore cannot be part of a cycle.
  set selfId(val) { this._selfId = val ?? null; }
  get selfId()    { return this._selfId ?? null; }

  // Already-chosen members, excluded from the list rather than shown as
  // disabled rows — picking one again has no meaning.
  set existingMembers(val) { this._existingMembers = val ?? []; }
  get existingMembers()    { return this._existingMembers ?? []; }

  // ── Public API ─────────────────────────────────────────────────────────

  show() {
    this._selectedKeys = new Set();
    this._renderRows();
    this._updateCtaState();
    this._modal.show();
    this._syncItemsHeight();
  }

  template() {
    return `
      <style>
        :host { display: contents; }

        /* Consistent modal padding across the app: --space-5 on both axes. */
        #modal { --space-6: var(--space-5); }

        .heading {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0 0 var(--space-3);
        }

        #count-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-block-end: var(--space-2);
          font-size: var(--font-size-caption);
          color: var(--color-text-secondary);
        }

        #count-row[hidden] { display: none; }

        #clear-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
        }

        #items {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-block-size: 60vh;
          overflow-y: auto;
        }

        /* A year heading, not a numbered step — it carries real information
           (which year a goal lives in) and only appears when the year
           actually changes down the list. */
        .year-head {
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: var(--space-2) 0 0;
        }

        .year-head:first-child { margin-block-start: 0; }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          inline-size: 100%;
          min-block-size: var(--touch-target);
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          font-family: var(--font-family);
          text-align: start;
          cursor: pointer;
        }

        .row:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .row.selected {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
        }

        /* Two lines, because a member can live in another year and that
           context decides whether it is the right goal to pick. */
        .row-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-inline-size: 0;
        }

        .row-title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .row-sub {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .row.selected .row-sub { color: var(--color-accent); }

        .row-pct {
          flex-shrink: 0;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .row.selected .row-pct { color: var(--color-accent); }

        .row-check {
          flex-shrink: 0;
          font-size: var(--font-size-body);
          opacity: 0;
          transition: opacity 0.1s;
        }

        .row.selected .row-check { opacity: 1; }

        #empty-msg {
          color: var(--color-text-muted);
          font-size: var(--font-size-body);
          font-family: var(--font-family);
          text-align: center;
          padding-block: var(--space-6);
          margin: 0;
        }

        button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-2);
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

        #add-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          padding-inline: var(--space-4);
        }

        #add-btn:disabled { opacity: 0.4; cursor: default; }

        .actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }
      </style>

      <modal-dialog id="modal" aria-label="${t('goal-picker.heading')}">
        <p class="heading">${t('goal-picker.heading')}</p>
        <div id="count-row" hidden>
          <span id="count"></span>
          <button type="button" id="clear-btn" aria-label="${t('goal-picker.clear')}">✕</button>
        </div>
        <div id="items" role="listbox" aria-multiselectable="true" aria-label="${t('goal-picker.heading')}"></div>
        <p id="empty-msg" hidden>${t('goal-picker.empty')}</p>

        <div slot="footer" class="actions">
          <button type="button" id="back-btn">${t('goal-picker.back')}</button>
          <button type="button" id="add-btn" disabled>${t('goal-picker.add-cta')}</button>
        </div>
      </modal-dialog>
    `;
  }

  subscribe() {
    this._modal    = this.shadowRoot.querySelector('#modal');
    this._itemsEl  = this.shadowRoot.querySelector('#items');
    this._emptyEl  = this.shadowRoot.querySelector('#empty-msg');
    this._countRow = this.shadowRoot.querySelector('#count-row');
    this._countEl  = this.shadowRoot.querySelector('#count');
    this._clearBtn = this.shadowRoot.querySelector('#clear-btn');
    this._addBtn   = this.shadowRoot.querySelector('#add-btn');
    this._backBtn  = this.shadowRoot.querySelector('#back-btn');

    this._selectedKeys = new Set();

    this._onClear = () => {
      this._selectedKeys.clear();
      this._itemsEl.querySelectorAll('.row.selected').forEach(row => {
        row.classList.remove('selected');
        row.setAttribute('aria-selected', 'false');
      });
      this._updateCtaState();
    };
    this._clearBtn.addEventListener('click', this._onClear);

    this._onBack = () => this._modal.close();
    this._backBtn.addEventListener('click', this._onBack);

    this._onAdd = () => {
      const refs = this._candidates()
        .filter(c => this._selectedKeys.has(c.key))
        .map(({ year, section, goalId }) => ({ year, section, goalId }));
      this._modal.close();
      this.dispatchEvent(new CustomEvent('goal-pick', {
        bubbles: true, composed: true, detail: { refs },
      }));
    };
    this._addBtn.addEventListener('click', this._onAdd);

    this._onResize = () => this._syncItemsHeight();
    (window.visualViewport ?? window).addEventListener('resize', this._onResize);

    // One tab stop for the whole list, arrows to move within it — what
    // role="listbox" already promises.
    this._listboxKeys = attachListboxKeys(this._itemsEl);
  }

  unsubscribe() {
    this._clearBtn?.removeEventListener('click', this._onClear);
    this._backBtn?.removeEventListener('click', this._onBack);
    this._addBtn?.removeEventListener('click', this._onAdd);
    this._listboxKeys?.detach();
    (window.visualViewport ?? window).removeEventListener('resize', this._onResize);
  }

  // ── Internals ──────────────────────────────────────────────────────────

  // Everything pickable: all goals except the aggregate itself, anything
  // already a member, and anything that would close a loop. Cycles are kept
  // out here rather than caught later — computeAggregate's own per-path guard
  // is a defence against imported data, not a substitute for not offering
  // the choice in the first place.
  _candidates() {
    const graph = goalsFromEntries(this.availableGoals);
    const taken = new Set(this.existingMembers.map(memberKey));
    return this.availableGoals.flatMap(({ year, section, goal }) => {
      if (!goal?.id) return [];
      if (goal.id === this.selfId) return [];
      const ref = { year: String(year), section, goalId: goal.id };
      const key = memberKey(ref);
      if (taken.has(key)) return [];
      if (wouldCycle(ref, this.selfId, graph)) return [];
      return [{ ...ref, key, goal }];
    }).sort((a, b) =>
      // Newest year first (the current year's goals are the ones in reach),
      // then the sections in their canonical display order. Sorted here
      // rather than trusting the caller because _renderRows only emits a
      // year heading when the year changes — which is only correct if the
      // rows actually arrive grouped by year.
      b.year.localeCompare(a.year) || SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));
  }

  // Two jobs, kept apart: this one walks the sorted candidates and emits a
  // year heading whenever the year changes (which is only correct because
  // _candidates sorts); _buildRow owns one row's markup.
  _renderRows() {
    const candidates = this._candidates();
    this._itemsEl.replaceChildren();
    this._emptyEl.hidden = candidates.length > 0;

    let lastYear = null;
    for (const c of candidates) {
      if (c.year !== lastYear) {
        lastYear = c.year;
        const head = document.createElement('p');
        head.className = 'year-head';
        head.textContent = c.year;
        this._itemsEl.appendChild(head);
      }
      this._itemsEl.appendChild(this._buildRow(c));
    }
    this._listboxKeys?.syncTabStops();
  }

  // A real <button> so click, Enter and Space all come from the platform;
  // role="option" is what makes it an item of the listbox rather than a
  // standalone control. See app/utils/listbox-keys.js for focus movement.
  _buildRow(c) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.dataset.memberKey = c.key;

    const text = document.createElement('div');
    text.className = 'row-text';
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = c.goal.title ?? '';
    const sub = document.createElement('span');
    sub.className = 'row-sub';
    // The same sublabel string upcoming-dialog uses, already translated.
    sub.textContent = t('upcoming.sub-goal', {
      year: c.year,
      section: t(`goal-dialog.move-section-${c.section}`),
    });
    text.append(title, sub);

    const pct = document.createElement('span');
    pct.className = 'row-pct';
    pct.textContent = `${percentValue(c.goal)}%`;

    const check = document.createElement('span');
    check.className = 'row-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    row.append(text, pct, check);
    row.addEventListener('click', () => this._toggle(c.key, row));
    return row;
  }

  _toggle(key, row) {
    const selected = this._selectedKeys.has(key);
    if (selected) this._selectedKeys.delete(key);
    else this._selectedKeys.add(key);
    row.classList.toggle('selected', !selected);
    row.setAttribute('aria-selected', String(!selected));
    this._updateCtaState();
  }

  _updateCtaState() {
    const count = this._selectedKeys.size;
    this._addBtn.disabled = count === 0;
    this._countRow.hidden = count === 0;
    if (count > 0) this._countEl.textContent = t('goal-picker.selected', { n: count });
  }

  // Same viewport-aware cap list-picker-dialog uses, so a long list still
  // leaves the footer reachable with the keyboard open.
  _syncItemsHeight() {
    if (!this._itemsEl) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    this._itemsEl.style.maxBlockSize = `${Math.max(vh - LIST_CHROME_PX, LIST_MIN_PX)}px`;
  }
}

customElements.define('goal-picker-dialog', GoalPickerDialog);
