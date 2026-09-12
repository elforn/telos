import { AppElement } from '../../../_lib/core/app-element.js';
import { Gestures } from '../../../_lib/modules/gestures/gestures.js';
import { t } from '../../../_lib/core/strings.js';
import { icons } from '../../icons.js';
import { tagColor } from '../../utils/tag-color.js';
import { urgencyOf } from '../../utils/urgency.js';
import { urgencyBadgeMarkup, urgencyBadgeStyles } from '../../utils/urgency-badge.js';
import { markDelete } from '../../utils/delete-ghost-guard.js';
import { rowChromeStyles } from '../../utils/row-chrome.js';

const COLOR_WIDTH = 48;   // left-side colour panel, revealed by swiping right — mirrors lists-page-item
const DELETE_WIDTH = 60;   // icon-only delete button
const COMMIT_RATIO = 2.0;  // fraction of reveal width needed to commit
const COMMIT_VELOCITY = 0.35; // px/ms — fast flick commits regardless
const SWIPE_DEAD_ZONE = 15;   // px of drag before row starts moving

class ListItem extends Gestures(AppElement) {
  set item(value) {
    this._item = value;
    if (this.shadowRoot) this._update();
  }

  // Whether this item's list currently has deadline markers visible (see
  // deadline-visibility.js) — list-detail-page.js resolves and pushes this
  // in, matching how goal-item.js receives the equivalent per-year property.
  // Absent (undefined) defaults to visible.
  set deadlinesVisible(value) {
    this._deadlinesVisible = value;
    if (this.shadowRoot) this._update();
  }

  set selectionMode(val) {
    this._selectionMode = !!val;
    if (!val && this._revealedDir === null) {
      this._row?.style.removeProperty('pointer-events');
    }
  }
  get selectionMode() { return this._selectionMode ?? false; }

  set selected(val) {
    this._selected = !!val;
    this.classList.toggle('selected', this._selected);
    this.setAttribute('aria-selected', String(this._selected));
  }
  get selected() { return this._selected ?? false; }

  template() {
    return `
      <style>
        :host {
          display: block;
          position: relative;
        }

        /* Flush, edge-to-edge rows — the containing #item-list now owns the
           rounded corners/shadow (see list-detail-page.js), so this row no
           longer clips or rounds itself. Only the last row in the container
           drops its own bottom divider, via :host(:last-child) below, since
           :last-child reflects this custom element's own position in the
           light-DOM list regardless of what lives in its shadow root. */

        .action-btn {
          position: absolute;
          inset-block: 0;
          color: var(--color-text-inverse);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          font-family: var(--font-family);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Colour panel — left side, revealed by swiping row right. Mirrors
           lists-page-item's own .color-panel/swipe exactly: a momentary
           reveal that always snaps back (see onSwipe below), not a
           persisted state like the delete panel's left-swipe. */
        .color-panel {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          inline-size: ${COLOR_WIDTH}px;
          background: var(--color-panel-bg, var(--color-surface-raised));
        }

        /* delete — right side, revealed by swiping row left */
        .delete-btn {
          inset-inline-end: 0;
          inline-size: ${DELETE_WIDTH}px;
          background: var(--color-danger);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
        }

        .action-btn svg {
          pointer-events: none;
        }

        ${rowChromeStyles('.row')}

        .row {
          block-size: var(--row-height);
          padding-block: 10px;
          overflow: hidden;
          gap: 6px;
        }

        .drag-btn {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          background: none;
          border: none;
          cursor: grab;
          color: var(--color-text-muted);
          opacity: 0.45;
          font-size: var(--font-size-body);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-block: 0;
          padding-inline: 0 2px;
          margin-inline-start: -5px;
          font-family: var(--font-family);
          touch-action: none;
        }

        /* Groups title + tag-pills into one vertical stack sharing the same
           start edge, so the pills always sit below the text (never overlap
           it) and align to the title's own start rather than a hardcoded
           offset — both are just children of this flex column now. */
        .main-col {
          flex: 1;
          min-inline-size: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: hidden;
        }

        /* Fixed row height means the text budget is always exactly two lines
           total: either a 2-line title alone, or a 1-line title + one line of
           tag-pills below it. .main-col.has-tags (toggled in _update() from
           tags.length > 0) switches which of those two shapes is in effect —
           never both at once, so the row itself never needs to grow. */
        .title {
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          word-break: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .main-col.has-tags .title {
          -webkit-line-clamp: 1;
        }

        /* Tag colour — a row of short pill/oval dots (one per tag, no text),
           replacing the old full-width bottom-edge strip: once rows sit flush
           against each other, a strip spanning the whole row width would read
           as a second divider line touching the next row's own border. Each
           dot's colour is tagColor(tag)'s same hash-derived hue as before.
           Never wraps — a row that runs out of horizontal space just clips
           the overflow tags rather than wrapping to a second line, which
           would break the row's fixed height. */
        .tag-pills {
          display: var(--list-item-tags-display, flex);
          align-items: center;
          flex-wrap: nowrap;
          gap: 3px;
          overflow: hidden;
          pointer-events: none;
        }

        .tag-pills[hidden] { display: none; }

        .tag-pill {
          flex-shrink: 0;
          inline-size: 20px;
          block-size: 9px;
          border-radius: var(--radius-full);
        }

        .row[data-status="done"] {
          background: color-mix(in srgb, var(--color-app-accent) 15%, var(--color-surface));
        }

        .row[data-status="done"] .title {
          color: var(--color-text-muted);
        }

        /* No badge-specific override needed here any more — with no chip
           background at all (see .badge[data-status] below), the done row's
           own tint doesn't need a bolder solid variant to sit on top of. */

        .note-icon,
        .url-icon {
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: none;
          line-height: 1;
        }

        .note-icon svg,
        .url-icon svg {
          display: block;
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
        }

        .row[data-has-note="true"]  .note-icon { display: block; }
        .row[data-has-url="true"]   .url-icon  { display: block; }

        /* Due-date calendar — shared with goal-item's deadline badge, see
           app/utils/urgency-badge.js. Unlike goal-item's, this one is never
           year-gated (open/paused items with a date only). */
        ${urgencyBadgeStyles()}

        .badge {
          display: var(--list-badge-display, inline-flex);
          flex-shrink: 0;
          min-block-size: 20px;
          font-size: var(--font-size-micro);
          font-weight: var(--font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          border-radius: var(--radius-sm);
          padding: 2px var(--space-2);
          cursor: pointer;
          border: none;
          font-family: var(--font-family);
          touch-action: manipulation;
        }

        .badge:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Experimental, round 2 — no chip/box at all for any status now.
           Open stays regular-weight/neutral (the default, nothing-to-report
           state); Paused/Done/Closed are bold and coloured with each
           status's own normal theme-reactive token — safe to use those
           tokens directly again now that there's no forced-white background
           to fight against (that was the previous, now-reverted, attempt). */
        .badge[data-status="open"] {
          background: none;
          color: var(--color-text-primary);
          font-weight: var(--font-weight-regular);
        }

        .badge[data-status="paused"],
        .badge[data-status="done"],
        .badge[data-status="closed"] {
          background: none;
          font-weight: var(--font-weight-bold);
        }

        .badge[data-status="paused"] { color: var(--color-warning); }
        .badge[data-status="done"]   { color: var(--color-success); }
        .badge[data-status="closed"] { color: var(--color-danger); }

        .row[data-status="closed"] .title {
          color: var(--color-text-muted);
        }

        /* ── Failed escalation — full-row red once a dueDate has lapsed ──
           data-failed is its own boolean attribute, set in _update() below
           alongside — not instead of — data-urgency, which still carries
           the raw bucket for the calendar badge. List items have no
           frequency source to diverge from, so the two happen to derive
           from the same urgencyOf() call here, but remain two attributes.
           No progress fill to recolour here (unlike goal-item) — the whole
           row just flips to solid --color-danger, the same token/pairing the
           badge above already proves correct in both themes. The badge
           itself is left unstyled: its white glyph still reads fine even
           once its own small chip background blends into the row. */
        :host([data-failed]) .row { background: var(--color-danger); }
        :host([data-failed]) .title { color: var(--color-text-inverse); }
        :host([data-failed]) .note-icon,
        :host([data-failed]) .url-icon { color: var(--color-text-inverse); opacity: 0.75; }
        :host([data-failed]) .drag-btn { color: var(--color-text-inverse); }

        /* ── Selection mode ─────────────────────────────────────────────── */

        :host(.selected) .row {
          box-shadow: inset 0 0 0 2px var(--color-accent);
          background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
        }

        /* ── Done celebration ───────────────────────────────────────────── */

        @keyframes done-ring {
          0%   { outline-color: transparent; }
          30%  { outline-color: color-mix(in srgb, var(--color-app-accent) 60%, transparent); }
          100% { outline-color: transparent; }
        }

        @keyframes done-wash {
          0%   { background: var(--color-surface); }
          25%  { background: color-mix(in srgb, var(--color-app-accent) 30%, var(--color-surface)); }
          100% { background: color-mix(in srgb, var(--color-app-accent) 15%, var(--color-surface)); }
        }

        :host(.done-celebrate) {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: done-ring 500ms ease-out forwards;
        }

        :host(.done-celebrate) .row {
          animation: done-wash 500ms ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.done-celebrate) { animation: none; outline: none; }
          :host(.done-celebrate) .row { animation: none; }
        }

        /* Toggled externally (list-detail-page.js) after scrollIntoView, when
           this row is the destination of an Upcoming-dialog row tap — mirrors
           goal-item's own .nav-flash exactly. */
        @keyframes nav-flash-ring {
          0%   { outline-color: transparent; }
          25%  { outline-color: color-mix(in srgb, var(--color-app-accent) 70%, transparent); }
          100% { outline-color: transparent; }
        }
        :host(.nav-flash) .row {
          outline: 3px solid transparent;
          outline-offset: 1px;
          animation: nav-flash-ring 900ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.nav-flash) .row { animation: none; outline: none; }
        }
      </style>

      <div class="color-panel" id="color-panel" aria-hidden="true"></div>
      <button class="action-btn delete-btn" id="delete-btn" aria-label="${t('list-item.delete')}">${icons.trash}</button>
      <div class="row" tabindex="0" role="button" aria-label="">
        <button class="drag-btn" id="drag-btn" type="button" aria-label=""></button>
        <div class="main-col">
          <span class="title"></span>
          <div class="tag-pills" id="tag-pills" aria-hidden="true"></div>
        </div>
        <span class="note-icon" aria-hidden="true">${icons.info}</span>
        <span class="url-icon"  aria-hidden="true">${icons.link}</span>
        ${urgencyBadgeMarkup}
        <button type="button" class="badge" id="badge-btn" data-status="open"></button>
      </div>
    `;
  }

  subscribe() {
    this.setAttribute('role', 'listitem');
    this._row = this.shadowRoot.querySelector('.row');
    this._title = this.shadowRoot.querySelector('.title');
    this._tagPillsEl = this.shadowRoot.querySelector('.tag-pills');
    this._mainCol = this.shadowRoot.querySelector('.main-col');
    this._noteIcon = this.shadowRoot.querySelector('.note-icon');
    this._urlIcon = this.shadowRoot.querySelector('.url-icon');
    this._badge = this.shadowRoot.querySelector('.badge');
    this._deleteEl = this.shadowRoot.querySelector('#delete-btn');
    this._colorPanel = this.shadowRoot.querySelector('#color-panel');
    this._revealedDir = null;

    this._update();

    this._stopPointerDown = e => e.stopPropagation();

    // useDelay: rAF lets the browser's synthesized click fire on the still-present button before DOM removal
    this._onDeleteBtn = (useDelay = false) => {
      const fire = () => {
        this.dispatchEvent(new CustomEvent('item-delete', {
          bubbles: true, composed: true, detail: { item: this._item },
        }));
        this._closeReveal();
      };
      if (useDelay) requestAnimationFrame(fire);
      else fire();
    };
    // Delete fires on pointerup; note the time so the add row (which shifts up
    // when the last item is removed) can ignore the touch's synthesized click.
    this._onDeletePointerUp = e => { e.stopPropagation(); e.preventDefault(); markDelete(); this._onDeleteBtn(true); };
    this._onDeleteBtnKey = e => { e.stopPropagation(); if (e.detail === 0) this._onDeleteBtn(); };
    this._deleteEl.addEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl.addEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl.addEventListener('click', this._onDeleteBtnKey);

    this._onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onTap(); }
    };
    this._row.addEventListener('keydown', this._onKeyDown);

    const STATUS_CYCLE = { open: 'done', done: 'paused', paused: 'closed', closed: 'open' };
    this._onBadgePointerUp = e => {
      e.stopPropagation();
      e.preventDefault();
      // Clean up any gesture tracking the host started on our pointerdown
      clearTimeout(this._longPressTimer);
      this._gestureRemoveInflight?.();
      this._gesture = null;
      const next = STATUS_CYCLE[this._item?.status ?? 'open'];
      this.dispatchEvent(new CustomEvent('item-status-cycle', {
        bubbles: true, composed: true, detail: { item: this._item, next },
      }));
      if (next === 'done') this._celebrate();
    };
    this._onBadgeKey = e => { e.stopPropagation(); if (e.detail === 0) this._onBadgePointerUp(e); };
    this._badge.addEventListener('pointerup', this._onBadgePointerUp);
    this._badge.addEventListener('click', this._onBadgeKey);

    this._dragBtn = this.shadowRoot.querySelector('#drag-btn');
    this._dragBtn.setAttribute('aria-label', t('list-item.drag'));
    this._dragBtn.innerHTML = icons.grip;
    this._onDragBtnDown = e => {
      if (this._selectionMode) return;
      e.stopPropagation();
      this._dragBtn.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('item-drag-start', {
        bubbles: true, composed: true,
        detail: { item: this._item, element: this, startX: e.clientX, startY: e.clientY },
      }));
    };
    this._onDragBtnKey = e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('item-reorder-key', {
        bubbles: true, composed: true,
        detail: { item: this._item, direction: e.key === 'ArrowUp' ? -1 : 1 },
      }));
    };
    this._dragBtn.addEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn.addEventListener('keydown', this._onDragBtnKey);
  }

  unsubscribe() {
    this._deleteEl?.removeEventListener('pointerdown', this._stopPointerDown);
    this._deleteEl?.removeEventListener('pointerup', this._onDeletePointerUp);
    this._deleteEl?.removeEventListener('click', this._onDeleteBtnKey);
    this._row?.removeEventListener('keydown', this._onKeyDown);
    this._badge?.removeEventListener('pointerup', this._onBadgePointerUp);
    this._badge?.removeEventListener('click', this._onBadgeKey);
    this._dragBtn?.removeEventListener('pointerdown', this._onDragBtnDown);
    this._dragBtn?.removeEventListener('keydown', this._onDragBtnKey);
  }

  // ── Gestures ──────────────────────────────────────────────────────────────

  onTap() {
    if (this._revealedDir) { this._closeReveal(); return; }
    if (this._selectionMode) {
      this.dispatchEvent(new CustomEvent('item-select-toggle', {
        bubbles: true, composed: true, detail: { item: this._item },
      }));
      return;
    }
    this.dispatchEvent(new CustomEvent('item-tap', {
      bubbles: true, composed: true, detail: { item: this._item },
    }));
  }

  onLongPress() {
    this.dispatchEvent(new CustomEvent('item-long-press', {
      bubbles: true, composed: true, detail: { item: this._item },
    }));
  }

  _gestureCancel(e) {
    if (this._gesture?.phase === 'swipe') this._closeReveal();
    super._gestureCancel(e);
  }

  onSwipeMove(e) {
    if (this._selectionMode) return;
    this._row.style.transition = 'none';
    let offset;
    if (this._revealedDir === 'left') {
      offset = Math.min(0, -DELETE_WIDTH + e.dx);
    } else {
      const dx = e.dx > 0 ? Math.max(0, e.dx - SWIPE_DEAD_ZONE) : Math.min(0, e.dx + SWIPE_DEAD_ZONE);
      offset = Math.max(-DELETE_WIDTH, Math.min(COLOR_WIDTH, dx));
    }
    this._row.style.transform = `translateX(${offset}px)`;
  }

  onSwipe(e) {
    if (this._revealedDir) { this._closeReveal(); return; }
    if (this._selectionMode) return;

    // Right swipe cycles colour — a momentary reveal that always snaps back
    // (mirrors lists-page-item exactly), unlike left-swipe delete below,
    // which persists open until confirmed or dismissed. Marking an item done
    // now happens via the status badge (tap-to-cycle) instead of a swipe.
    if (e.direction === 'right') {
      const commit = e.distance >= COLOR_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
      if (commit) {
        this.dispatchEvent(new CustomEvent('item-color-cycle', {
          bubbles: true, composed: true, detail: { item: this._item },
        }));
      }
      this._closeReveal();
      return;
    }

    const commit = e.distance >= DELETE_WIDTH * COMMIT_RATIO || e.velocity >= COMMIT_VELOCITY;
    if (commit) {
      this._row.style.transform = `translateX(-${DELETE_WIDTH}px)`;
      this._revealedDir = 'left';
    } else {
      this._closeReveal();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _closeReveal() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._row.style.transition = reduced ? 'none' : 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._row.style.transform = '';
    this._revealedDir = null;
  }

  _celebrate() {
    this.classList.remove('done-celebrate');
    void this.offsetWidth;
    this.classList.add('done-celebrate');
    this.addEventListener('animationend', () => this.classList.remove('done-celebrate'), { once: true });
  }

  _update() {
    if (!this._row) return;
    const title = this._item?.title ?? '';
    const status = this._item?.status ?? 'open';
    const active = status !== 'done' && status !== 'closed';
    // deadlinesVisible === false suppresses this item's due-date urgency
    // entirely (no icon, no full-row-red) — mirrors goal-item.js's own gate
    // and collectUpcoming's notification-level gating (deadline-visibility.js).
    // List items have no frequency/tracking, so the icon and the full-row-red
    // "Failed" mechanism both derive from this one urgencyOf call — unlike
    // goal-item.js, there's no second, independent source to diverge from.
    // They're still set as two separate attributes below rather than one
    // reused value, so a future per-item difference wouldn't require
    // re-threading this — see goal-item.js for why that separation matters.
    const urgency = this._deadlinesVisible === false ? 'none' : urgencyOf(this._item?.dueDate, active);
    const failed = urgency === 'overdue';
    this._title.textContent = title;
    this._row.setAttribute('aria-label',
      urgency === 'none' ? title : t('list-item.duedate-aria', { title, when: t(`urgency.${urgency}`) }));
    this._row.dataset.status = status;
    this._row.dataset.hasNote = String(!!this._item?.note);
    this._row.dataset.hasUrl = String(!!this._item?.url);
    this.dataset.urgency = urgency;
    this.toggleAttribute('data-failed', failed);
    this._badge.textContent = t(`item-dialog.status-${status}`);
    this._badge.dataset.status = status;
    if (this._tagPillsEl) {
      const tags = this._item?.tags ?? [];
      this._tagPillsEl.innerHTML = tags
        .map(tag => `<span class="tag-pill" style="background:${tagColor(tag)}"></span>`)
        .join('');
      this._tagPillsEl.hidden = tags.length === 0;
      this._mainCol?.classList.toggle('has-tags', tags.length > 0);
    }
    const color = this._item?.color ?? null;
    this._row.style.setProperty('--row-accent-color', color ?? 'transparent');
    if (color) this._colorPanel.style.setProperty('--color-panel-bg', color);
    else this._colorPanel.style.removeProperty('--color-panel-bg');
  }
}

customElements.define('list-item', ListItem);
