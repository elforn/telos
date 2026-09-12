import { AppElement } from '../../../_lib/core/app-element.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { buildDayStrip, dayStripStyles } from '../../utils/day-strip.js';
import '../../../_lib/modules/modal-dialog/modal-dialog.js';

// Urgency-first section order, matching the notification digest's own
// grouping — see app/utils/upcoming.js for how each bucket is computed.
const SECTIONS = [
  { key: 'overdue',  labelKey: 'upcoming.section-overdue' },
  { key: 'today',    labelKey: 'upcoming.section-today' },
  { key: 'tomorrow', labelKey: 'upcoming.section-tomorrow' },
];

// Each section folds independently — overdue/today start open (the loudest,
// most actionable buckets), tomorrow starts folded (a heads-up, not
// something to act on right now). Resets to these defaults every time the
// dialog opens, rather than remembering a prior session's fold state.
const DEFAULT_EXPANDED = { overdue: true, today: true, tomorrow: false };

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

        /* A section head is itself the fold/unfold toggle — a full-width
           reset button, same idiom as .upcoming-row below. */
        .upcoming-section-head {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          inline-size: 100%;
          min-block-size: var(--touch-target);
          padding-block: var(--space-3) var(--space-2);
          border: none;
          border-block-end: 0.5px solid var(--color-border);
          background: none;
          cursor: pointer;
          text-align: start;
          font-family: var(--font-family);
        }

        .upcoming-section-head:first-child {
          padding-block-start: 0;
        }

        .upcoming-section-head:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        /* Larger and bolder than a plain caption label so each section reads
           as its own clearly-separated block, not just a small heading. The
           icon below is what actually mirrors each bucket's own
           calendar-badge colour (see urgency-badge.js) pixel-for-pixel; the
           label text here is a softer echo of the same identity rather than
           a literal colour match — 'overdue' in particular uses
           --color-overdue-bg's *pill* as its icon fill, but that fixed,
           theme-invariant value is not safe as plain text colour (it sits
           too close to --color-surface's own dark-theme value to stay
           legible) — --color-text-primary reads as "the most serious,
           matter-of-fact" heading instead, which fits the pill's own
           deliberately-uncoloured, no-nonsense identity. */
        .upcoming-section-label {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
        }

        .upcoming-section-head[data-key="overdue"] .upcoming-section-label {
          color: var(--color-text-primary);
        }
        .upcoming-section-head[data-key="today"] .upcoming-section-label,
        .upcoming-section-head[data-key="tomorrow"] .upcoming-section-label {
          color: var(--color-danger);
        }

        /* The same calendar glyph (icons.calendar) every bucket already
           uses elsewhere (see urgency-badge.js), styled identically here —
           this dialog is populated directly from the same buckets
           (collectUpcoming) that drive a goal/item's own row icon, so the
           two must always agree on what each bucket looks like. Overdue and
           Today both get the filled-pill treatment (dark-neutral-on-red-
           glyph and red-on-inverse-glyph respectively — see urgency-badge.js
           for why 'overdue' deliberately isn't red, distinguishing it from
           'today's still-actionable red); Tomorrow stays the plain
           (unfilled) icon, matching the plain badge that bucket gets on an
           ordinary row. Padding/border-radius apply to every bucket
           unconditionally (mirroring urgency-badge.js's own base rule) so
           the icon occupies the same footprint whether or not it's filled. */
        .upcoming-section-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          border-radius: var(--radius-sm);
          padding: 2px;
        }
        .upcoming-section-icon svg {
          display: block;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }
        .upcoming-section-head[data-key="overdue"] .upcoming-section-icon {
          color: var(--color-danger);
          background: var(--color-overdue-bg);
        }
        .upcoming-section-head[data-key="today"] .upcoming-section-icon {
          color: var(--color-text-inverse);
          background: var(--color-danger);
        }
        .upcoming-section-head[data-key="tomorrow"] .upcoming-section-icon {
          color: var(--color-danger);
        }

        .upcoming-section-count {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
        }

        .upcoming-chevron {
          margin-inline-start: auto;
          flex-shrink: 0;
          display: flex;
          color: var(--color-text-muted);
        }

        .upcoming-chevron svg {
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
          transition: transform 0.15s ease;
        }

        /* Chevron points down (its natural orientation) while expanded —
           revealing what's below — and rotates to point sideways once
           folded, same disclosure-triangle convention used elsewhere. */
        .upcoming-section-head[aria-expanded="false"] .upcoming-chevron svg {
          transform: rotate(-90deg);
        }

        @media (prefers-reduced-motion: reduce) {
          .upcoming-chevron svg { transition: none; }
        }

        .upcoming-section-body[hidden] { display: none; }

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

        /* "Why" commentary — never affects which section a row lands in,
           just describes it. Plain text for a dueDate's day-count or a
           frequency goal's aggregate shortfall count (Any/monthly, which
           have no specific day to point to); the shared day-strip (see
           day-strip.js, also used by the goal edit dialog) for
           scheduled-days/every-day, where position alone disambiguates
           Tue/Thu and Sat/Sun with a single letter per slot — no
           translated day names needed, and no ambiguity from letters alone. */
        .upcoming-detail-text {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
        }

        ${dayStripStyles()}

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

        /* Deliberately plain/muted — a second-class link to a second-class
           list (see hidden-items-dialog.js), not another row among the
           overdue/today/tomorrow sections above it. Sits outside the
           scroll region so it's always visible regardless of scroll
           position or how many sections are expanded. */
        .upcoming-hidden-link {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          padding-block: var(--space-2);
          margin-block-start: var(--space-2);
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          background: none;
          cursor: pointer;
          text-align: start;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-muted);
        }

        .upcoming-hidden-link[hidden] { display: none; }

        .upcoming-hidden-link:focus-visible {
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
          <button type="button" class="upcoming-hidden-link" id="upcoming-hidden-link" hidden></button>
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
    this._hiddenLink = this.shadowRoot.querySelector('#upcoming-hidden-link');
    this._items = { overdue: [], today: [], tomorrow: [] };
    this._expanded = { ...DEFAULT_EXPANDED };
    this._syncHiddenLink();

    this.listen(this._hiddenLink, 'click', () => {
      this.dispatchEvent(new CustomEvent('upcoming-hidden-tap', { bubbles: true, composed: true }));
      this._dialog.close();
    });

    this.listen(this._scroll, 'click', e => {
      const head = e.target.closest('.upcoming-section-head');
      if (head) {
        const key = head.dataset.key;
        const expanded = !this._expanded[key];
        this._expanded[key] = expanded;
        head.setAttribute('aria-expanded', String(expanded));
        const body = this._scroll.querySelector(`.upcoming-section-body[data-key="${key}"]`);
        if (body) body.hidden = !expanded;
        return;
      }
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
    this._expanded = { ...DEFAULT_EXPANDED };
    this._render();
    this._dialog.show();
  }

  // How many overdue/today items currently live in a hidden year/list (see
  // collectHiddenUrgent) — bottom-nav.js sets this alongside open(). Only
  // ever shown as a plain link, never a section among the real ones above —
  // see hidden-items-dialog.js for why this stays second-class.
  set hiddenCount(value) {
    this._hiddenCount = value ?? 0;
    this._syncHiddenLink();
  }
  get hiddenCount() { return this._hiddenCount ?? 0; }

  _syncHiddenLink() {
    if (!this._hiddenLink) return;
    const count = this._hiddenCount ?? 0;
    this._hiddenLink.hidden = count === 0;
    if (count > 0) this._hiddenLink.textContent = t('upcoming.hidden-link', { count });
  }

  _render() {
    const nodes = [];
    let any = false;
    for (const { key, labelKey } of SECTIONS) {
      const entries = this._items[key] ?? [];
      if (!entries.length) continue;
      any = true;
      const expanded = this._expanded[key];
      nodes.push(this._buildSectionHead(key, labelKey, entries.length, expanded));
      nodes.push(this._buildSectionBody(key, entries, expanded));
    }
    this._emptyEl.hidden = any;
    this._scroll.replaceChildren(this._emptyEl, ...nodes);
  }

  _buildSectionHead(key, labelKey, count, expanded) {
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'upcoming-section-head';
    head.dataset.key = key;
    head.setAttribute('aria-expanded', String(expanded));
    head.innerHTML = `
      <span class="upcoming-section-icon" aria-hidden="true">${icons.calendar}</span>
      <span class="upcoming-section-label"></span>
      <span class="upcoming-section-count"></span>
      <span class="upcoming-chevron" aria-hidden="true">${icons.chevronDown}</span>
    `;
    head.querySelector('.upcoming-section-label').textContent = t(labelKey);
    head.querySelector('.upcoming-section-count').textContent = String(count);
    return head;
  }

  _buildSectionBody(key, entries, expanded) {
    const body = document.createElement('div');
    body.className = 'upcoming-section-body';
    body.dataset.key = key;
    body.hidden = !expanded;
    for (const entry of entries) body.appendChild(this._buildRow(entry));
    return body;
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

    // entry.detail is optional "why" commentary (see app/utils/upcoming.js)
    // — never affects the row's own tap behaviour, purely descriptive. The
    // plain-text form is aria-hidden; the day-strip form carries its own
    // role="img"/aria-label (see day-strip.js) but is reached by neither —
    // this row's own aria-label below overrides its subtree's accessible
    // name entirely, so either way a screen reader hears one coherent
    // announcement, built from ariaText, not the visual rendering itself.
    let ariaLabel = `${entry.title}, ${sub}`;
    if (entry.detail) {
      const { node, ariaText } = this._buildDetail(entry.detail);
      row.appendChild(node);
      ariaLabel += `, ${ariaText}`;
    }
    row.setAttribute('aria-label', ariaLabel);
    return row;
  }

  _buildDetail(detail) {
    if (detail.kind === 'days') {
      const strip = buildDayStrip(detail.days);
      // The accessible text stays focused on what's actionable — only the
      // missed days — rather than reading out the full success/unscheduled/
      // pending picture the visual strip shows; that richer detail is a
      // supplementary at-a-glance aid, not core information.
      const missedNames = detail.days.filter(d => d.state === 'missed').map(d => t(`goal-dialog.dow-${d.wd}`)).join(', ');
      return { node: strip, ariaText: t('upcoming.detail-missed-days-aria', { days: missedNames }) };
    }
    const text = detail.kind === 'overdue'
      ? t('upcoming.detail-days-overdue', { days: detail.days })
      : t('upcoming.detail-missed-count', { count: detail.count });
    const span = document.createElement('span');
    span.className = 'upcoming-detail-text';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = text;
    return { node: span, ariaText: text };
  }
}

customElements.define('upcoming-dialog', UpcomingDialog);
