import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, setRuntimeState } from '../../_lib/core/store/store.js';
import { syncChildren } from '../../_lib/core/dom/sync-children.js';
import { Reorder } from '../../_lib/modules/reorder/reorder.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import { withUndo } from '../../_lib/modules/toast/undo.js';
import { FilterState } from '../../_lib/modules/filter-state/filter-state.js';
import '../components/list-item/list-item.js';
import '../components/item-dialog/item-dialog.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import '../components/list-picker-dialog/list-picker-dialog.js';
import '../components/bulk-tag-editor/bulk-tag-editor.js';
import '../../_lib/modules/modal-dialog/modal-dialog.js';
import '../components/import-text-dialog/import-text-dialog.js';
import { icons } from '../icons.js';
import { tagColor } from '../utils/tag-color.js';
import { matchesDateBucket } from '../utils/urgency.js';
import { filterBarStyles, filterBarMarkup } from '../utils/filter-bar.js';
import { pageHeaderStyles, pageHeaderButtonsMarkup } from '../utils/page-header.js';
import '../components/export-sheet/export-sheet.js';
import '../components/date-filter-row/date-filter-row.js';
import { exportListMarkdown, exportItemsMarkdown } from '../utils/export-markdown.js';
import { isGhostClickAfterDelete } from '../utils/delete-ghost-guard.js';
import { nextColor } from '../utils/color-palette.js';
import { buildListHandoff, buildItemHandoff, buildItemsHandoff, shareHandoff } from '../utils/handoff.js';
import { shareMarkdown } from '../utils/share-markdown.js';

const EXPORT_MODE_LIST      = 'list';
const EXPORT_MODE_SELECTION = 'selection';
const EXPORT_MODE_ITEM      = 'item';

const FILTER_SHAPE = {
  query:          { kind: 'string' },
  statuses:       { kind: 'set' },
  dates:          { kind: 'set' },
  tags:           { kind: 'set' },
  panelExpanded:  { kind: 'boolean' },
  barExpanded:    { kind: 'boolean' },
};

class ListDetailPage extends AppElement {
  template() {
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          dialog[open], dialog::backdrop { animation: none; }
        }

        /* Consistent modal padding across the app: --space-5 on both axes. */
        #import-dialog, #menu { --space-6: var(--space-5); }

        /* #menu is a <modal-dialog> now (real container padding); #bulk-status-sheet
           and #bulk-more-sheet stay raw <dialog>s with zero container padding, so
           .menu-section/.menu-item's own inline padding must stay in place for them —
           scope the removal to #menu's own instances only. */
        #menu .menu-section, #menu .menu-item { padding-inline: 0; }

        /* The container now supplies top padding — the first section's own
           padding-block-start/divider would double up on top of it. */
        #menu .menu-section:first-child { padding-block-start: 0; border-block-start: none; }

        :host {
          display: block;
          max-inline-size: var(--page-max-width);
          margin-inline: auto;
          --page-padding: var(--space-5);
        }

        /* ── Header — matches year-header style; .page-header/.top-row/
           .filter-btn/.menu-btn shell shared via app/utils/page-header.js. ── */
        ${pageHeaderStyles()}

        /* .back-btn has no lists-page counterpart, so it stays local —
           duplicates .menu-btn's base properties (no shared 2-page pattern
           to extract into) plus its own margin-inline-start. */
        .back-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
          margin-inline-start: calc(-0.8 * var(--page-padding));
        }

        .back-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .back-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        h1 {
          flex: 1;
          min-inline-size: 0;
          font-size: var(--font-size-heading);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          line-height: 1;
          margin: 0;
        }

        .name-edit-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          inline-size: 100%;
          min-block-size: var(--touch-target);
          overflow: hidden;
          background: none;
          border: none;
          cursor: pointer;
          font: inherit;
          color: inherit;
          padding-left: 3px;
          padding-top: 4px;
          text-align: start;
        }

        .name-edit-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        .name-pencil {
          flex-shrink: 0;
          color: var(--color-text-muted);
          opacity: 0.6;
          display: flex;
          align-items: center;
        }

        .name-pencil svg {
          inline-size: var(--icon-size-sm);
          block-size: var(--icon-size-sm);
          pointer-events: none;
        }

        .menu-delete-section {
          padding-block: var(--space-3);
          border-block-start: 1px solid var(--color-border);
        }

        .menu-delete-btn {
          inline-size: 100%;
          min-block-size: var(--touch-target);
          background: none;
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-danger);
          text-align: center;
          padding-inline: var(--space-3);
          touch-action: manipulation;
        }

        .menu-delete-btn:focus-visible {
          outline: 2px solid var(--color-danger);
          outline-offset: 2px;
        }

        /* ── Menu nav items ──────────────────────────────────────────────── */

        .menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          inline-size: 100%;
          min-block-size: var(--touch-target-lg);
          padding-inline: var(--space-5);
          background: none;
          border: none;
          border-block-start: 0.5px solid var(--color-border);
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          text-align: start;
        }

        .menu-item:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -2px;
        }

        .menu-item-value {
          font-size: var(--font-size-body);
          color: var(--color-text-muted);
        }

        /* ── Main content ────────────────────────────────────────────────── */

        main {
          display: flex;
          flex-direction: column;
          padding: var(--space-3) var(--page-padding);
          padding-block-end: calc(var(--bottom-nav-height) + var(--space-2));
        }

        #item-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        /* ── Menu dialog — matches year-header sheet exactly ─────────────── */

        dialog {
          position: fixed;
          inset-block-end: 0;
          inset-inline-start: 0;
          inset-block-start: auto;
          margin: 0;
          inline-size: 100%;
          max-inline-size: 100%;
          background: var(--color-surface);
          border: none;
          border-start-start-radius: var(--radius-lg);
          border-start-end-radius: var(--radius-lg);
          border-end-start-radius: 0;
          border-end-end-radius: 0;
          padding: 0;
          padding-block-end: calc(var(--space-3) + var(--safe-area-bottom, 0px));
          box-shadow: var(--shadow-sheet);
          color: var(--color-text-primary);
          font-family: var(--font-family);
        }

        dialog[open] {
          animation: menu-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        dialog::backdrop {
          background: var(--color-overlay);
          animation: fade-in 0.2s ease-out;
        }

        .menu-handle {
          inline-size: var(--sheet-handle-width);
          block-size: var(--sheet-handle-height);
          border-radius: var(--radius-full);
          background: var(--color-border);
          margin: var(--space-3) auto var(--space-1);
        }

        .menu-section {
          padding: var(--space-4) var(--space-5);
        }

        .menu-section-label {
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-caps);
          margin: 0;
          margin-block-end: var(--space-2);
        }

        .status-pill-group {
          display: flex;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border-radius: var(--radius-full);
          padding: var(--pill-inset);
        }

        .status-pill {
          flex: 1;
          min-block-size: var(--touch-target);
          border: none;
          border-radius: var(--radius-full);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          text-align: center;
        }

        .status-pill.active {
          background: var(--color-surface);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-card);
        }

        .status-pill:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Bulk action bar ─────────────────────────────────────────────── */

        #bulk-bar {
          position: fixed;
          inset-inline-start: 50%;
          transform: translateX(-50%);
          inline-size: 100%;
          inset-block-end: 0;
          max-inline-size: var(--page-max-width);
          z-index: 300; /* above bottom-nav (200) and page-header (100) */
          background: var(--color-surface);
          border-block-start: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding-inline: var(--page-padding);
          padding-block: var(--space-2);
          padding-block-end: calc(var(--space-2) + var(--safe-area-bottom, 0px));
        }

        /* Composes with the base rule's translateX(-50%) centering — a bare
           translateY() here would replace (not add to) that transform for
           the animation's duration, popping the bar to the left edge for
           the slide-in before snapping back to centered. */
        @keyframes bulk-bar-in {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }

        @media (prefers-reduced-motion: no-preference) {
          #bulk-bar:not([hidden]) { animation: bulk-bar-in 0.22s cubic-bezier(0.32, 0.72, 0, 1); }
        }

        #bulk-close-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        #bulk-close-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-full);
        }

        #bulk-close-btn svg,
        #bulk-more-btn svg,
        #bulk-delete-btn svg {
          pointer-events: none;
        }

        #bulk-count {
          flex: 1;
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          min-inline-size: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        #bulk-delete-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--font-size-body);
          color: var(--color-danger);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        #bulk-delete-btn:focus-visible {
          outline: 2px solid var(--color-danger);
          outline-offset: 2px;
          border-radius: var(--radius-full);
        }

        .bulk-btn {
          flex-shrink: 1;
          min-inline-size: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-block-size: var(--touch-target);
          padding-inline: var(--space-3);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          touch-action: manipulation;
        }

        #bulk-more-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }

        #bulk-more-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-full);
        }

        #bulk-status-btn,
        #bulk-tags-btn {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .bulk-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Filter bar — shell shared via app/utils/filter-bar.js; panel-row
           vocabulary below stays local. */
        ${filterBarStyles()}

        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border-width: 0;
        }
      </style>

      <div class="page-header">
        <div class="top-row">
          <button class="back-btn" id="back-btn" aria-label="${t('list-detail.back')}">${icons.chevronLeft}</button>
          <h1><button class="name-edit-btn" id="name-edit-btn" aria-label="${t('list-detail.edit-name')}"><span id="list-name"></span><span class="name-pencil" aria-hidden="true">${icons.pencil}</span></button></h1>
          ${pageHeaderButtonsMarkup({ filterLabel: t('list-detail.filter-toggle'), menuLabel: t('list-detail.menu') })}
        </div>
        ${filterBarMarkup({
          searchPlaceholder: t('list-detail.filter-search'),
          searchLabel: t('list-detail.filter-search'),
          expandLabel: t('list-detail.filter-expand'),
          clearLabel: t('list-detail.filter-clear'),
          rowsHtml: `
            <div class="filter-row" id="filter-status-row" role="group" aria-label="${t('list-detail.status-label')}">
              <button class="filter-pill" id="fstatus-open" data-status="open" aria-pressed="false">${t('item-dialog.status-open')}</button>
              <button class="filter-pill" id="fstatus-paused" data-status="paused" aria-pressed="false">${t('item-dialog.status-paused')}</button>
              <button class="filter-pill" id="fstatus-done" data-status="done" aria-pressed="false">${t('item-dialog.status-done')}</button>
              <button class="filter-pill" id="fstatus-closed" data-status="closed" aria-pressed="false">${t('item-dialog.status-closed')}</button>
            </div>
            <date-filter-row id="date-filter-row"></date-filter-row>
            <div class="filter-row" id="filter-tag-row" hidden></div>
          `,
        })}
      </div>

      <main>
        <div id="item-list" role="list"></div>
        <p id="filter-empty" hidden>${t('list-detail.filter-empty')}</p>
        <p role="status" class="sr-only" id="filter-live"></p>
        <add-row id="add-row">+ ${t('list-detail.add')}</add-row>
      </main>

      <modal-dialog id="menu" aria-label="${t('list-detail.menu')}">
        <div class="menu-section">
          <p class="menu-section-label">${t('settings.tag-strip')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('settings.tag-strip')}">
            <button class="status-pill" id="tags-show-btn">${t('settings.reminder-on')}</button>
            <button class="status-pill" id="tags-hide-btn">${t('settings.reminder-off')}</button>
          </div>
        </div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.status-label')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('list-detail.status-label')}">
            <button class="status-pill" id="status-show-btn">${t('list-detail.status-show')}</button>
            <button class="status-pill" id="status-hide-btn">${t('list-detail.status-hide')}</button>
          </div>
        </div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.archive-label')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('list-detail.archive-label')}">
            <button class="status-pill" id="archive-active-btn">${t('list-detail.archive-active')}</button>
            <button class="status-pill" id="archive-archived-btn">${t('list-detail.archive-archived')}</button>
          </div>
        </div>
        <button class="menu-item" id="import-menu-btn">
          <span>${t('list-detail.add-from-text')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
        <button class="menu-item" id="export-menu-btn">
          <span>${t('list-detail.extract-markdown')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
        <button class="menu-item" id="share-list-menu-btn">
          <span>${t('list-detail.share-list')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
        <div class="menu-delete-section">
          <button class="menu-delete-btn" id="list-delete-btn">${t('list-detail.delete-list')}</button>
        </div>
      </modal-dialog>

      <item-dialog id="dialog"></item-dialog>
      <list-dialog id="list-dialog"></list-dialog>

      <div id="bulk-bar" hidden role="toolbar" aria-label="${t('list-detail.cancel-selection')}">
        <button type="button" id="bulk-close-btn" aria-label="${t('list-detail.cancel-selection')}">${icons.xMark}</button>
        <span id="bulk-count"></span>
        <button type="button" id="bulk-more-btn" aria-label="${t('list-detail.bulk-more')}">${icons.dotsVertical}</button>
        <button type="button" id="bulk-delete-btn" aria-label="${t('list-detail.bulk-delete')}">${icons.trash}</button>
        <button type="button" class="bulk-btn" id="bulk-tags-btn">${t('list-detail.bulk-tags')}</button>
        <button type="button" class="bulk-btn" id="bulk-status-btn">${t('list-detail.bulk-status')}</button>
      </div>

      <dialog id="bulk-status-sheet" aria-label="${t('list-detail.bulk-status-label')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.bulk-status-label')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('list-detail.bulk-status-label')}">
            <button class="status-pill" id="bulk-status-open">${t('item-dialog.status-open')}</button>
            <button class="status-pill" id="bulk-status-paused">${t('item-dialog.status-paused')}</button>
            <button class="status-pill" id="bulk-status-done">${t('item-dialog.status-done')}</button>
            <button class="status-pill" id="bulk-status-closed">${t('item-dialog.status-closed')}</button>
          </div>
        </div>
      </dialog>

      <dialog id="bulk-tags-sheet" aria-label="${t('list-detail.bulk-tags-label')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.bulk-tags-label')}</p>
          <bulk-tag-editor id="bulk-tag-editor"></bulk-tag-editor>
        </div>
      </dialog>

      <dialog id="bulk-more-sheet" aria-label="${t('list-detail.bulk-more')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <button class="menu-item" id="bulk-move-menu-btn">
          <span>${t('list-detail.bulk-move')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
        <button class="menu-item" id="bulk-export-btn">
          <span>${t('list-detail.bulk-extract-markdown')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
        <button class="menu-item" id="bulk-share-btn">
          <span>${t('list-detail.bulk-share')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
      </dialog>

      <export-sheet id="export-sheet"></export-sheet>

      <list-picker-dialog id="bulk-picker"></list-picker-dialog>

      <import-text-dialog id="import-dialog"></import-text-dialog>
    `;
  }

  subscribe() {
    this._listId = this.params?.listId;
    if (!this._listId) { navigate(`${BASE_PATH}lists`); return; }

    this._itemList    = this.shadowRoot.querySelector('#item-list');
    this._nameEl      = this.shadowRoot.querySelector('#list-name');
    this._pageHeader  = this.shadowRoot.querySelector('.page-header');
    this._dialog      = this.shadowRoot.querySelector('#dialog');
    this._listDialog  = this.shadowRoot.querySelector('#list-dialog');
    this._menuDialog  = this.shadowRoot.querySelector('#menu');
    this._editingItem = null;
    this._selectionMode = false;
    this._selectedIds   = new Set();

    this._showStatus = true; // updated from store on first _onLists call

    this._onBack = () => navigate(`${BASE_PATH}lists`);
    this.listen(this.shadowRoot.querySelector('#back-btn'), 'click', this._onBack);

    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.show();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    this.listen(menuBtn, 'click', this._onMenuBtn);

    this._onMenuClose = () => {
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    this.listen(this._menuDialog, 'modal-close', this._onMenuClose);

    // ── Name edit button ──────────────────────────────────────────────────────
    this._onNameEdit = () => {
      const list = getState().lists?.find(l => l.id === this._listId);
      if (list) {
        this._listEditSnapshot = getState().lists;
        this._listDialog.open(list);
      }
    };
    this.listen(this.shadowRoot.querySelector('#name-edit-btn'), 'click', this._onNameEdit);

    // ── List dialog (edit name / color) ───────────────────────────────────────
    this._onListNameChanged = e => {
      setState('lists', (getState().lists ?? []).map(l =>
        l.id !== this._listId ? l : { ...l, name: e.detail.name }
      ));
    };
    this.listen(this._listDialog, 'list-name-changed', this._onListNameChanged);

    this._onListColorChanged = e => {
      setState('lists', (getState().lists ?? []).map(l => {
        if (l.id !== this._listId) return l;
        const { color: _, ...rest } = l;
        return e.detail.color ? { ...rest, color: e.detail.color } : rest;
      }));
    };
    this.listen(this._listDialog, 'list-color-changed', this._onListColorChanged);

    this._onListClosed = () => {
      const snap = this._listEditSnapshot;
      this._listEditSnapshot = null;
      if (snap && JSON.stringify(getState().lists) !== JSON.stringify(snap)) {
        toast(t('lists.toast-list-saved'), 'success',
          { action: { label: t('undo.button'), onClick: () => setState('lists', snap) } });
      }
    };
    this.listen(this._listDialog, 'list-closed', this._onListClosed);

    this._onListDialogDelete = () => this._deleteCurrentList();
    this.listen(this._listDialog, 'list-delete', this._onListDialogDelete);

    // ── Archive list (menu) ───────────────────────────────────────────────────
    this._setArchived = archived => {
      this._menuDialog.close();
      setState('lists', (getState().lists ?? []).map(l =>
        l.id === this._listId ? { ...l, archived } : l
      ));
      toast(t(archived ? 'lists.toast-list-archived' : 'lists.toast-list-unarchived'), 'success');
    };
    this._onArchiveActive = () => { if (this._archived) this._setArchived(false); };
    this._onArchiveArchived = () => { if (!this._archived) this._setArchived(true); };
    this.listen(this.shadowRoot.querySelector('#archive-active-btn'), 'click', this._onArchiveActive);
    this.listen(this.shadowRoot.querySelector('#archive-archived-btn'), 'click', this._onArchiveArchived);

    // ── Delete list (menu) ────────────────────────────────────────────────────
    this._onListDeleteBtn = () => { this._menuDialog.close(); this._deleteCurrentList(); };
    this.listen(this.shadowRoot.querySelector('#list-delete-btn'), 'click', this._onListDeleteBtn);

    this._onStatusShow = () => {
      if (this._showStatus) return;
      setState('lists', (getState().lists ?? []).map(l =>
        l.id === this._listId ? { ...l, showStatus: true } : l
      ));
    };
    this._onStatusHide = () => {
      if (!this._showStatus) return;
      setState('lists', (getState().lists ?? []).map(l =>
        l.id === this._listId ? { ...l, showStatus: false } : l
      ));
    };
    this.listen(this.shadowRoot.querySelector('#status-show-btn'), 'click', this._onStatusShow);
    this.listen(this.shadowRoot.querySelector('#status-hide-btn'), 'click', this._onStatusHide);

    this._onAddRow = () => {
      // Ignore the synthesized click that follows deleting the last item — the
      // add row shifts up under the finger and would otherwise open this dialog.
      if (isGhostClickAfterDelete()) return;
      this._editingItem = null;
      this._createdItemId = null;
      this._itemEditSnapshot = getState().lists;
      this._prepareDialog(null);
      this._dialog.open(null);
    };
    this.listen(this.shadowRoot.querySelector('#add-row'), 'click', this._onAddRow);

    this._onItemTap = e => {
      if (this._selectionMode) return;
      const cleanItem = this._prepareDialog(e.detail.item);
      this._editingItem = cleanItem;
      this._createdItemId = null;
      this._itemEditSnapshot = getState().lists;
      this._dialog.open(cleanItem);
    };
    this.listen(this._itemList, 'item-tap', this._onItemTap);

    this._onItemDelete = e => {
      withUndo({
        getSnapshot: () => getState().lists,
        apply:       () => this._deleteItem(e.detail.item.id),
        restore:     snapshot => setState('lists', snapshot),
        message:     t('lists.toast-item-deleted'),
        undoLabel:   t('undo.button'),
      });
    };
    this.listen(this._itemList, 'item-delete', this._onItemDelete);

    // Marking an item done now happens via the status badge (tap-to-cycle)
    // rather than a swipe — right-swipe on list-item cycles colour instead
    // (item-color-cycle), mirroring list-color-cycle's own cycle-in-place.
    this._onItemColorCycle = e => {
      const item = e.detail?.item;
      if (!item) return;
      const color = nextColor(item.color);
      this._mutateItems(items => items.map(i => {
        if (i.id !== item.id) return i;
        const { color: _, ...rest } = i;
        return color ? { ...rest, color } : rest;
      }));
    };
    this.listen(this._itemList, 'item-color-cycle', this._onItemColorCycle);

    this._onItemStatusCycle = e => {
      const { item, next } = e.detail;
      if (next === 'closed') {
        this._filterSuppressed = true;
        clearTimeout(this._filterSuppressTimer);
        this._filterSuppressTimer = setTimeout(() => {
          this._filterSuppressed = false;
          this._applyFilter();
        }, 700);
      }
      this._editItem(item.id, { title: item.title, status: next });
    };
    this.listen(this._itemList, 'item-status-cycle', this._onItemStatusCycle);

    this._onItemCreated = e => {
      const { id, title, status, note, url, dueDate, tags, color } = e.detail;
      this._addItem({ id, title, status, note, url, dueDate, tags, color });
      this._editingItem = { id, title, status, note, url, dueDate, tags, color, inGoals: [] };
      this._createdItemId = id;
    };
    this.listen(this.shadowRoot, 'item-created', this._onItemCreated);

    this._onItemClosed = () => {
      const snap = this._itemEditSnapshot;
      this._itemEditSnapshot = null;
      const createdId = this._createdItemId;
      this._createdItemId = null;
      if (snap && JSON.stringify(getState().lists) !== JSON.stringify(snap)) {
        // Re-check against current state — the item may have been edited since creation
        const created = createdId
          ? ((getState().lists ?? []).find(l => l.id === this._listId)?.items ?? []).find(i => i.id === createdId)
          : null;
        if (created && this._itemFilterActive() && !this._itemMatchesFilter(created)) {
          toast(t('lists.toast-item-hidden'), 'info',
            { action: { label: t('filter.toast-show'), onClick: () => this._revealCreatedItem(created.id) } });
        } else {
          toast(t('lists.toast-item-saved'), 'success',
            { action: { label: t('undo.button'), onClick: () => setState('lists', snap) } });
        }
      }
      if (this._filterSuppressed) {
        clearTimeout(this._filterSuppressTimer);
        this._filterSuppressTimer = setTimeout(() => {
          this._filterSuppressed = false;
          this._applyFilter();
        }, 700);
      }
    };
    this.listen(this._dialog, 'item-closed', this._onItemClosed);

    this._onDialogDelete = () => {
      if (this._editingItem) {
        withUndo({
          getSnapshot: () => getState().lists,
          apply:       () => {
            this._itemEditSnapshot = null; // suppress item-closed undo toast — delete has its own
            this._deleteItem(this._editingItem.id);
          },
          restore:     snapshot => setState('lists', snapshot),
          message:     t('lists.toast-item-deleted'),
          undoLabel:   t('undo.button'),
        });
      }
    };
    this.listen(this._dialog, 'item-delete', this._onDialogDelete);

    this._onItemTitleChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, title: e.detail.title } : i
      ));
    };
    this.listen(this._dialog, 'item-title-changed', this._onItemTitleChanged);

    this._onItemNoteChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, note: e.detail.note } : i
      ));
    };
    this.listen(this._dialog, 'item-note-changed', this._onItemNoteChanged);

    this._onItemUrlChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, url: e.detail.url } : i
      ));
    };
    this.listen(this._dialog, 'item-url-changed', this._onItemUrlChanged);

    this._onItemDueDateChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, dueDate: e.detail.dueDate } : i
      ));
    };
    this.listen(this._dialog, 'item-duedate-changed', this._onItemDueDateChanged);

    this._onItemColorChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i => {
        if (i.id !== this._editingItem.id) return i;
        const { color: _, ...rest } = i;
        return e.detail.color ? { ...rest, color: e.detail.color } : rest;
      }));
    };
    this.listen(this._dialog, 'item-color-changed', this._onItemColorChanged);

    this._onItemStatusChanged = e => {
      if (!this._editingItem) return;
      const { status } = e.detail;
      // Suppress the filter immediately so the badge label updates without hiding
      // the item while the dialog is still open. The countdown starts on dialog close.
      if (status === 'closed') {
        this._filterSuppressed = true;
        clearTimeout(this._filterSuppressTimer);
      } else if (this._filterSuppressed) {
        // Changed away from 'closed' before closing — release suppression
        this._filterSuppressed = false;
        clearTimeout(this._filterSuppressTimer);
      }
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, status } : i
      ));
    };
    this.listen(this._dialog, 'item-status-changed', this._onItemStatusChanged);

    this._onItemTagsChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, tags: e.detail.tags } : i
      ));
    };
    this.listen(this._dialog, 'item-tags-changed', this._onItemTagsChanged);

    this._onItemMove = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, dueDate, tags, color, targetListIds, newListName, copy } = e.detail;
      const item         = this._editingItem;
      const updatedItem  = { ...item, title, status, note, url, dueDate, tags, color };
      const currentLists = getState().lists ?? [];
      const targetNames  = currentLists
        .filter(l => targetListIds.includes(l.id))
        .map(l => l.name);
      if (newListName) targetNames.unshift(newListName);

      const updatedLists = currentLists.map(l => {
        if (l.id === this._listId) {
          const items = (l.items ?? []).map(i => i.id === item.id ? updatedItem : i);
          const kept = copy ? items : items.filter(i => i.id !== item.id);
          const selfCopy = copy && targetListIds.includes(l.id)
            ? [{ ...updatedItem, id: crypto.randomUUID() }] : [];
          return { ...l, items: [...kept, ...selfCopy] };
        }
        if (targetListIds.includes(l.id)) {
          return { ...l, items: [...(l.items ?? []), { ...updatedItem, id: crypto.randomUUID() }] };
        }
        return l;
      });
      if (newListName) {
        updatedLists.push({ id: crypto.randomUUID(), name: newListName, items: [{ ...updatedItem, id: crypto.randomUUID() }] });
      }
      setState('lists', updatedLists);

      const n = targetListIds.length + (newListName ? 1 : 0);
      const msg = copy
        ? (n === 1 ? t('item-dialog.copy-toast', { name: targetNames[0] }) : t('item-dialog.copy-toast-many', { n }))
        : (n === 1 ? t('item-dialog.move-toast', { name: targetNames[0] }) : t('item-dialog.move-toast-many', { n }));
      toast(msg, 'success');
    };
    this.listen(this._dialog, 'item-move', this._onItemMove);

    this._onItemPromote = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, dueDate, tags, color, year, section } = e.detail;
      const item    = this._editingItem;
      const goalId  = crypto.randomUUID();
      const goal    = { id: goalId, title, tags: [...(tags ?? [])], dueDate, color, tracking: { type: 'percentage', value: 0 } };
      const state   = getState();
      const yearStr = String(year);
      const existing = state.goals?.[yearStr] ?? { capstone: [], milestones: [], wow: [], focus: [] };

      setState('goals', {
        ...state.goals,
        [yearStr]: { ...existing, [section]: [...(existing[section] ?? []), goal] },
      });

      const updatedItem = {
        ...item, title, status, note, url, dueDate, tags, color,
        inGoals: [...(item.inGoals ?? []), { year: yearStr, section, goalId }],
      };
      setState('lists', (getState().lists ?? []).map(l =>
        l.id === this._listId
          ? { ...l, items: (l.items ?? []).map(i => i.id === item.id ? updatedItem : i) }
          : l
      ));

      const sectionLabel = t(`item-dialog.goal-section-${section}`);
      toast(t('item-dialog.promote-toast', { year: yearStr, section: sectionLabel }), 'success');
    };
    this.listen(this._dialog, 'item-promote', this._onItemPromote);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────
    // list-item itself withholds item-drag-start while selectionMode is set
    // (kept in sync synchronously by _syncSelectionUI), so no page-level guard needed.

    this._detachReorder = Reorder.attach(this._itemList, {
      itemSelector:    'list-item',
      dragStartEvent:  'item-drag-start',
      reorderKeyEvent: 'item-reorder-key',
      cloneLabel:      d => d.item.title,
      onMove:          (from, to) => this._placeItem(from, to),
    });

    this._onBulkClose = () => this._exitSelectionMode();
    this.listen(this.shadowRoot.querySelector('#bulk-close-btn'), 'click', this._onBulkClose);

    this._bulkCountEl      = this.shadowRoot.querySelector('#bulk-count');
    this._bulkPickerDialog = this.shadowRoot.querySelector('#bulk-picker');
    this._bulkStatusSheet  = this.shadowRoot.querySelector('#bulk-status-sheet');
    this._bulkMoreSheet    = this.shadowRoot.querySelector('#bulk-more-sheet');
    this._bulkTagsSheet    = this.shadowRoot.querySelector('#bulk-tags-sheet');
    this._bulkTagEditor    = this.shadowRoot.querySelector('#bulk-tag-editor');

    this._onBulkDelete = () => {
      const ids = [...this._selectedIds];
      withUndo({
        getSnapshot: () => getState().lists,
        apply:       () => {
          this._mutateItems(items => items.filter(i => !ids.includes(i.id)));
          this._exitSelectionMode();
        },
        restore:     snapshot => setState('lists', snapshot),
        message:     t('list-detail.bulk-delete-toast', { n: ids.length }),
        undoLabel:   t('undo.button'),
      });
    };
    this.listen(this.shadowRoot.querySelector('#bulk-delete-btn'), 'click', this._onBulkDelete);

    this._onBulkStatus = () => this._bulkStatusSheet.showModal();
    this.listen(this.shadowRoot.querySelector('#bulk-status-btn'), 'click', this._onBulkStatus);

    this._onBulkStatusBackdrop = e => { if (e.target === this._bulkStatusSheet) this._bulkStatusSheet.close(); };
    this.listen(this._bulkStatusSheet, 'click', this._onBulkStatusBackdrop);

    this._onBulkStatusOpen   = () => this._applyBulkStatus('open');
    this._onBulkStatusPaused = () => this._applyBulkStatus('paused');
    this._onBulkStatusDone   = () => this._applyBulkStatus('done');
    this._onBulkStatusClosed = () => this._applyBulkStatus('closed');
    this.listen(this.shadowRoot.querySelector('#bulk-status-open'), 'click', this._onBulkStatusOpen);
    this.listen(this.shadowRoot.querySelector('#bulk-status-paused'), 'click', this._onBulkStatusPaused);
    this.listen(this.shadowRoot.querySelector('#bulk-status-done'), 'click', this._onBulkStatusDone);
    this.listen(this.shadowRoot.querySelector('#bulk-status-closed'), 'click', this._onBulkStatusClosed);

    this._onBulkTags = () => {
      this._refreshBulkTagEditor();
      this._bulkTagEditor.existingTags = this._collectAllTags(getState());
      this._bulkTagsSheet.showModal();
    };
    this.listen(this.shadowRoot.querySelector('#bulk-tags-btn'), 'click', this._onBulkTags);

    // Backdrop tap closes the sheet; closing ends selection (like Status/Move).
    this._onBulkTagsBackdrop = e => { if (e.target === this._bulkTagsSheet) this._bulkTagsSheet.close(); };
    this.listen(this._bulkTagsSheet, 'click', this._onBulkTagsBackdrop);
    this._onBulkTagsClose = () => { if (this._selectionMode) this._exitSelectionMode(); };
    this.listen(this._bulkTagsSheet, 'close', this._onBulkTagsClose);

    this._onBulkTagApply  = e => this._applyBulkTag(e.detail.tag);
    this._onBulkTagRemove = e => this._removeBulkTag(e.detail.tag);
    this.listen(this._bulkTagEditor, 'bulk-tag-apply', this._onBulkTagApply);
    this.listen(this._bulkTagEditor, 'bulk-tag-remove', this._onBulkTagRemove);

    this._onBulkMore = () => this._bulkMoreSheet.showModal();
    this._onBulkMoreBackdrop = e => { if (e.target === this._bulkMoreSheet) this._bulkMoreSheet.close(); };
    this.listen(this.shadowRoot.querySelector('#bulk-more-btn'), 'click', this._onBulkMore);
    this.listen(this._bulkMoreSheet, 'click', this._onBulkMoreBackdrop);

    this._exportSheet = this.shadowRoot.querySelector('#export-sheet');
    this._exportMode  = EXPORT_MODE_LIST;

    this._onExportMenuBtn = () => {
      this._menuDialog.close();
      this._exportMode = EXPORT_MODE_LIST;
      this._exportSheet.show();
    };
    this.listen(this.shadowRoot.querySelector('#export-menu-btn'), 'click', this._onExportMenuBtn);

    this._onShareListMenuBtn = async () => {
      this._menuDialog.close();
      const list = (getState().lists ?? []).find(l => l.id === this._listId);
      if (!list) return;
      try {
        await shareHandoff(buildListHandoff(list), list.name);
      } catch (err) {
        console.error('Share list failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this.shadowRoot.querySelector('#share-list-menu-btn'), 'click', this._onShareListMenuBtn);

    this._onBulkExportBtn = () => {
      this._bulkMoreSheet.close();
      this._exportMode = EXPORT_MODE_SELECTION;
      this._exportSheet.show();
    };
    this.listen(this.shadowRoot.querySelector('#bulk-export-btn'), 'click', this._onBulkExportBtn);

    this._onBulkShareBtn = async () => {
      this._bulkMoreSheet.close();
      const list = (getState().lists ?? []).find(l => l.id === this._listId);
      if (!list) return;
      const ids   = [...this._selectedIds];
      const items = (list.items ?? []).filter(i => ids.includes(i.id));
      if (!items.length) return;
      try {
        await shareHandoff(buildItemsHandoff(items), list.name);
      } catch (err) {
        console.error('Share selection failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this.shadowRoot.querySelector('#bulk-share-btn'), 'click', this._onBulkShareBtn);

    this._onExportConfirm = async e => {
      const { metadata, notes } = e.detail;
      const lists = getState().lists ?? [];
      const list  = lists.find(l => l.id === this._listId);
      if (!list) return;
      let md, title;
      if (this._exportMode === EXPORT_MODE_SELECTION) {
        const ids   = [...this._selectedIds];
        const items = (list.items ?? []).filter(i => ids.includes(i.id));
        md = exportItemsMarkdown(items, list.name, { metadata, notes });
        title = list.name;
      } else if (this._exportMode === EXPORT_MODE_ITEM) {
        md = exportItemsMarkdown([this._exportItem], list.name, { metadata, notes });
        title = this._exportItem.title;
      } else {
        md = exportListMarkdown(list, { metadata, notes });
        title = list.name;
      }
      try {
        const result = await shareMarkdown(md, title);
        if (result === 'copied') toast(t('export.copied'), 'success');
      } catch (err) {
        console.error('Export failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this._exportSheet, 'extract-confirm', this._onExportConfirm);

    this._onItemExportRequest = e => {
      this._exportItem = e.detail.item;
      this._exportMode = EXPORT_MODE_ITEM;
      this._exportSheet.show();
    };
    this.listen(this.shadowRoot, 'item-export-request', this._onItemExportRequest);

    this._onItemShareRequest = async e => {
      try {
        await shareHandoff(buildItemHandoff(e.detail.item), e.detail.item.title);
      } catch (err) {
        console.error('Share item failed:', err);
        toast(t('share.error'), 'error');
      }
    };
    this.listen(this.shadowRoot, 'item-share-request', this._onItemShareRequest);

    this._onBulkMove = () => { this._bulkMoreSheet.close(); this._openBulkPicker(); };
    this.listen(this.shadowRoot.querySelector('#bulk-move-menu-btn'), 'click', this._onBulkMove);

    this._onBulkListPick = e => {
      const { targetListIds, newListName, copy } = e.detail;
      const ids          = [...this._selectedIds];
      const currentLists = getState().lists ?? [];
      const sourceItems  = (currentLists.find(l => l.id === this._listId)?.items ?? [])
        .filter(i => ids.includes(i.id));
      const targetNames  = currentLists
        .filter(l => targetListIds.includes(l.id))
        .map(l => l.name);
      if (newListName) targetNames.unshift(newListName);

      const updatedLists = currentLists.map(l => {
        if (l.id === this._listId) {
          const kept = copy ? (l.items ?? []) : (l.items ?? []).filter(i => !ids.includes(i.id));
          const selfCopy = copy && targetListIds.includes(l.id)
            ? sourceItems.map(i => ({ ...i, id: crypto.randomUUID() })) : [];
          return { ...l, items: [...kept, ...selfCopy] };
        }
        if (targetListIds.includes(l.id)) {
          const clones = sourceItems.map(i => ({ ...i, id: crypto.randomUUID() }));
          return { ...l, items: [...(l.items ?? []), ...clones] };
        }
        return l;
      });
      if (newListName) {
        const clones = sourceItems.map(i => ({ ...i, id: crypto.randomUUID() }));
        updatedLists.push({ id: crypto.randomUUID(), name: newListName, items: clones });
      }
      setState('lists', updatedLists);

      const n   = targetListIds.length + (newListName ? 1 : 0);
      const msg = copy
        ? (n === 1 ? t('item-dialog.copy-toast', { name: targetNames[0] }) : t('item-dialog.copy-toast-many', { n }))
        : (n === 1 ? t('item-dialog.move-toast', { name: targetNames[0] }) : t('item-dialog.move-toast-many', { n }));
      toast(msg, 'success');
      if (!copy) this._exitSelectionMode();
    };
    this.listen(this._bulkPickerDialog, 'list-pick', this._onBulkListPick);

    this._onItemLongPress = e => {
      if (!this._selectionMode) this._enterSelectionMode(e.detail.item.id);
    };
    this.listen(this._itemList, 'item-long-press', this._onItemLongPress);

    this._onItemSelectToggle = e => {
      const id = e.detail.item.id;
      if (this._selectedIds.has(id)) this._selectedIds.delete(id);
      else this._selectedIds.add(id);
      if (this._selectedIds.size === 0) { this._exitSelectionMode(); return; }
      this._syncSelectionUI();
    };
    this.listen(this._itemList, 'item-select-toggle', this._onItemSelectToggle);

    // ── Import from text ──────────────────────────────────────────────────────

    this._importDialog = this.shadowRoot.querySelector('#import-dialog');
    // Scoped per list (mirrors item/goal/list dialogs) — a paste typed for
    // one list should never resurface when importing into another.
    this._importDialog.draftKey = this._listId;

    this._onImportMenuBtn = () => {
      this._menuDialog.close();
      this._importDialog.open();
    };
    this.listen(this.shadowRoot.querySelector('#import-menu-btn'), 'click', this._onImportMenuBtn);

    this._onImportConfirm = e => {
      const items = e.detail.items;
      const snapshot = getState().lists;
      this._addItems(items);
      toast(t('list-detail.import-toast', { n: items.length }), 'success', {
        action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) },
      });
    };
    this.listen(this._importDialog, 'import-text-confirm', this._onImportConfirm);

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar       = this.shadowRoot.querySelector('#filter-bar');
    this._filterSearch    = this.shadowRoot.querySelector('#filter-search');
    this._filterPanel     = this.shadowRoot.querySelector('#filter-panel');
    this._filterTagRow    = this.shadowRoot.querySelector('#filter-tag-row');
    this._filterEmpty     = this.shadowRoot.querySelector('#filter-empty');
    this._filterLive      = this.shadowRoot.querySelector('#filter-live');
    this._filterExpandBtn = this.shadowRoot.querySelector('#filter-expand-btn');
    this._filterBtnEl     = this.shadowRoot.querySelector('#filter-btn');

    this._filterState = FilterState(`telos:filter:list:${this._listId}`, FILTER_SHAPE);
    this._filter = { query: '', statuses: new Set(), dates: new Set(), tags: new Set() };
    this._panelExpanded = false;
    this._barExpanded = false;
    this._loadFilter();
    const inboundQ = new URLSearchParams(location.search).get('q');
    if (inboundQ) {
      this._filter.query = inboundQ;
      this._barExpanded = true;
      this._saveFilter();
    }

    this._onFilterTagChip = e => {
      const tag = e.currentTarget.dataset.tag;
      if (this._filter.tags.has(tag)) this._filter.tags.delete(tag);
      else this._filter.tags.add(tag);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };

    this._onFilterBtn = () => {
      const nowOpen = this._filterBar.hidden;
      this._filterBar.hidden = !nowOpen;
      this._filterBtnEl.setAttribute('aria-expanded', String(nowOpen));
      this._barExpanded = nowOpen;
      if (!nowOpen) this._panelExpanded = false;
      this._saveFilter();
      this._syncFilterUI();
      if (nowOpen) requestAnimationFrame(() => this._filterSearch?.focus());
    };
    this.listen(this._filterBtnEl, 'click', this._onFilterBtn);

    this._onFilterExpand = () => {
      this._panelExpanded = !this._panelExpanded;
      this._saveFilter();
      this._syncFilterUI();
    };
    this.listen(this._filterExpandBtn, 'click', this._onFilterExpand);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.listen(this._filterSearch, 'input', this._onFilterSearch);

    this._onFilterStatus = e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      const s = btn.dataset.status;
      if (!s) return;
      if (this._filter.statuses.has(s)) this._filter.statuses.delete(s);
      else this._filter.statuses.add(s);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-status-row'), 'click', this._onFilterStatus);

    this._onFilterDate = e => {
      const key = e.detail.key;
      if (this._filter.dates.has(key)) this._filter.dates.delete(key);
      else this._filter.dates.add(key);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this._dateFilterRow = this.shadowRoot.querySelector('#date-filter-row');
    this.listen(this._dateFilterRow, 'date-toggle', this._onFilterDate);

    this._onFilterClear = () => {
      this._filter = { query: '', statuses: new Set(), dates: new Set(), tags: new Set() };
      this._filterSearch.value = '';
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.listen(this.shadowRoot.querySelector('#filter-clear-btn'), 'click', this._onFilterClear);

    if (this._barExpanded) {
      this._filterBar.hidden = false;
      this._filterBtnEl.setAttribute('aria-expanded', 'true');
    }

    // ── Store ─────────────────────────────────────────────────────────────────

    this._onLists = lists => {
      const list = (lists ?? []).find(l => l.id === this._listId);
      if (!list) { navigate(`${BASE_PATH}lists`); return; }
      this._nameEl.textContent = list.name;
      this.shadowRoot.querySelector('#name-edit-btn')?.setAttribute('aria-label', `${t('list-detail.edit-name')}: ${list.name}`);
      this._pageHeader.style.borderBlockEndColor = list.color ?? '';
      this._archived = !!list.archived;
      this._applyArchivePref();
      this._showStatus = list.showStatus ?? true;
      this._applyStatusPref();
      this._renderItems(list.items ?? []);
      this._rebuildTagChips(list.items ?? []);
      this._syncFilterUI();
      if (!this._filterSuppressed) this._applyFilter();
    };
    this.watch('lists', this._onLists);

    this._onListsTagsVisible = tagsVisible => {
      const visible = tagsVisible?.[this._listId] === true;
      document.documentElement.style.setProperty('--tag-strip-display', visible ? 'block' : 'none');
      this.shadowRoot?.querySelector('#tags-show-btn')?.classList.toggle('active', visible);
      this.shadowRoot?.querySelector('#tags-hide-btn')?.classList.toggle('active', !visible);
    };
    this.watch('listsTagsVisible', this._onListsTagsVisible);

    this._onTagsShowBtn = () => {
      setState('listsTagsVisible', { ...getState().listsTagsVisible, [this._listId]: true });
      this._menuDialog.close();
    };
    this._onTagsHideBtn = () => {
      setState('listsTagsVisible', { ...getState().listsTagsVisible, [this._listId]: false });
      this._menuDialog.close();
    };
    this.listen(this.shadowRoot.querySelector('#tags-show-btn'), 'click', this._onTagsShowBtn);
    this.listen(this.shadowRoot.querySelector('#tags-hide-btn'), 'click', this._onTagsHideBtn);
  }

  unsubscribe() {
    // Static listeners and store subscriptions are auto-removed by listen()/watch().
    clearTimeout(this._filterSuppressTimer);
    this._detachReorder?.();
  }

  // ── Selection mode ────────────────────────────────────────────────────────

  _enterSelectionMode(firstItemId) {
    this._selectionMode = true;
    this._selectedIds   = new Set([firstItemId]);
    // Raise host to a document-level stacking context above bottom-nav (z-index: 200)
    this.style.position = 'relative';
    this.style.zIndex   = '201';
    this.shadowRoot.querySelector('#menu-btn').hidden = true;
    this.shadowRoot.querySelector('#bulk-bar').hidden = false;
    this._syncSelectionUI();
  }

  _exitSelectionMode() {
    this._selectionMode = false;
    this._selectedIds.clear();
    this.style.position = '';
    this.style.zIndex   = '';
    this.shadowRoot.querySelector('#menu-btn').hidden = false;
    this.shadowRoot.querySelector('#bulk-bar').hidden = true;
    this._syncSelectionUI();
  }

  _syncSelectionUI() {
    this._itemList?.querySelectorAll('list-item').forEach(el => {
      el.selectionMode = this._selectionMode;
      el.selected      = this._selectionMode && this._selectedIds.has(el._item?.id);
    });
    if (this._bulkCountEl) {
      this._bulkCountEl.textContent = t('list-detail.selection-count', { n: this._selectedIds.size });
    }
  }

  // ── Dialog setup ─────────────────────────────────────────────────────────

  _prepareDialog(item = null) {
    const state = getState();
    this._dialog.availableLists = state.lists ?? [];
    this._dialog.sourceListId   = this._listId;
    this._dialog.currentYear    = new Date().getFullYear();
    this._dialog.existingTags   = this._collectAllTags(state);

    if (!item || !(item.inGoals ?? []).length) return item;
    // Prune inGoals entries whose goal no longer exists — writes to store if any are found.

    const goals = state.goals ?? {};
    const validInGoals = item.inGoals.filter(({ year, section, goalId }) =>
      (goals[year]?.[section] ?? []).some(g => g.id === goalId)
    );
    if (validInGoals.length === item.inGoals.length) return item;

    const cleanItem = { ...item, inGoals: validInGoals };
    setState('lists', (state.lists ?? []).map(l =>
      l.id === this._listId
        ? { ...l, items: (l.items ?? []).map(i => i.id === item.id ? cleanItem : i) }
        : l
    ));
    return cleanItem;
  }

  // ── Store mutations ───────────────────────────────────────────────────────

  _mutateItems(fn) {
    setState('lists', (getState().lists ?? []).map(l =>
      l.id === this._listId ? { ...l, items: fn(l.items ?? []) } : l
    ));
  }

  _addItem({ id, title, status, note, url, dueDate, tags, color }) {
    const item = {
      id: id ?? crypto.randomUUID(), title, status,
      note, url, dueDate, color,
      tags: tags ?? [], inGoals: [],
    };
    this._mutateItems(items => [...items, item]);
  }

  _editItem(id, { title, status, note, url, tags }) {
    this._mutateItems(items => items.map(i => i.id === id ? { ...i, title, status, note, url, tags } : i));
  }

  _collectAllTags(state = getState()) {
    const tags = new Set();
    for (const yg of Object.values(state.goals ?? {})) {
      for (const section of Object.values(yg)) {
        if (Array.isArray(section)) {
          for (const goal of section) for (const tag of (goal.tags ?? [])) tags.add(tag);
        }
      }
    }
    for (const list of (state.lists ?? [])) {
      for (const item of (list.items ?? [])) for (const tag of (item.tags ?? [])) tags.add(tag);
    }
    return [...tags].sort();
  }

  _deleteItem(id) {
    this._mutateItems(items => items.filter(i => i.id !== id));
  }

  _deleteCurrentList() {
    const snapshot = getState().lists ?? [];
    const listName = snapshot.find(l => l.id === this._listId)?.name ?? '';
    setState('lists', snapshot.filter(l => l.id !== this._listId));
    localStorage.removeItem(`telos:filter:list:${this._listId}`);
    setRuntimeState('pendingListUndo', { snapshot, listName });
    navigate(`${BASE_PATH}lists`);
  }

  _placeItem(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return;
    this._mutateItems(items => {
      const arr = [...items];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, item);
      return arr;
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _applyStatusPref() {
    if (this._itemList) {
      if (this._showStatus) {
        this._itemList.style.removeProperty('--list-badge-display');
      } else {
        this._itemList.style.setProperty('--list-badge-display', 'none');
      }
    }
    const showBtn = this.shadowRoot?.querySelector('#status-show-btn');
    const hideBtn = this.shadowRoot?.querySelector('#status-hide-btn');
    if (showBtn) showBtn.classList.toggle('active', this._showStatus);
    if (hideBtn) hideBtn.classList.toggle('active', !this._showStatus);
  }

  _applyArchivePref() {
    const activeBtn   = this.shadowRoot?.querySelector('#archive-active-btn');
    const archivedBtn = this.shadowRoot?.querySelector('#archive-archived-btn');
    if (activeBtn)   activeBtn.classList.toggle('active', !this._archived);
    if (archivedBtn) archivedBtn.classList.toggle('active', this._archived);
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  _loadFilter() {
    const { query, statuses, dates, tags, panelExpanded, barExpanded } = this._filterState.load();
    this._filter = { query, statuses, dates, tags };
    this._panelExpanded = panelExpanded;
    this._barExpanded = barExpanded;
  }

  _saveFilter() {
    this._filterState.save({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _isFilterActive() {
    return this._filterState.isActive({ ...this._filter, panelExpanded: this._panelExpanded, barExpanded: this._barExpanded });
  }

  _syncFilterUI() {
    if (!this._filterBar) return;
    if (this._filterSearch) this._filterSearch.value = this._filter.query;
    const active = this._isFilterActive();
    for (const s of ['open', 'paused', 'done', 'closed']) {
      const btn = this.shadowRoot.querySelector(`#fstatus-${s}`);
      if (btn) {
        const on = this._filter.statuses.has(s);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
    }
    if (this._dateFilterRow) this._dateFilterRow.selected = this._filter.dates;
    const dot = this._filterBtnEl?.querySelector('.filter-btn-dot');
    if (dot) dot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
    const expandDot = this._filterExpandBtn?.querySelector('.filter-expand-dot');
    if (expandDot) expandDot.hidden = !(this._filter.statuses.size || this._filter.dates.size || this._filter.tags.size);
    this._filterTagRow?.querySelectorAll('.filter-tag-chip').forEach(chip => {
      const on = this._filter.tags.has(chip.dataset.tag);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    const panelOpen = this._panelExpanded || this._filter.statuses.size > 0 || this._filter.dates.size > 0 || this._filter.tags.size > 0;
    if (this._filterPanel) this._filterPanel.hidden = !panelOpen;
    if (this._filterExpandBtn) this._filterExpandBtn.setAttribute('aria-expanded', String(panelOpen));
  }

  _rebuildTagChips(items) {
    if (!this._filterTagRow) return;
    const allTags = new Set();
    for (const item of items) {
      for (const tag of (item.tags ?? [])) allTags.add(tag);
    }
    if (allTags.size === 0) {
      this._filterTagRow.hidden = true;
      this._filterTagRow.replaceChildren();
      return;
    }
    this._filterTagRow.hidden = false;
    this._filterTagRow.replaceChildren();
    for (const tag of [...allTags].sort()) {
      const btn = document.createElement('button');
      btn.className = 'filter-tag-chip';
      btn.type = 'button';
      btn.dataset.tag = tag;
      btn.textContent = tag;
      btn.style.setProperty('--tag-color', tagColor(tag));
      const on = this._filter.tags.has(tag);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.addEventListener('click', this._onFilterTagChip);
      this._filterTagRow.appendChild(btn);
    }
  }

  _revealCreatedItem(id) {
    this._onFilterClear();
    const el = [...(this._itemList?.querySelectorAll('list-item') ?? [])]
      .find(i => i._item?.id === id);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  _itemFilterActive() {
    const { query, statuses, dates, tags } = this._filter;
    return !!(query.toLowerCase().trim() || statuses.size || dates.size || tags.size);
  }

  _itemMatchesFilter(item) {
    const { query, statuses, dates, tags } = this._filter;
    const q = query.toLowerCase().trim();
    if (q) {
      const hay = `${item.title ?? ''} ${item.note ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statuses.size) {
      if (!statuses.has(item.status)) return false;
    } else if (item.status === 'closed') {
      return false;
    }
    if (dates.size) {
      const active = item.status !== 'done' && item.status !== 'closed';
      if (![...dates].some(key => matchesDateBucket(key, item.dueDate, active))) return false;
    }
    if (tags.size) {
      const itags = item.tags ?? [];
      if (![...tags].some(tag => itags.includes(tag))) return false;
    }
    return true;
  }

  _applyFilter() {
    const active = this._itemFilterActive();
    let anyVisible = false;
    let visibleCount = 0;

    this._itemList?.querySelectorAll('list-item').forEach(el => {
      const item = el._item;
      if (!item) { el.hidden = false; return; }
      const show = this._itemMatchesFilter(item);
      el.hidden = !show;
      if (show) { anyVisible = true; visibleCount++; }
    });

    if (this._filterEmpty) this._filterEmpty.hidden = !active || anyVisible;
    if (this._filterLive) this._filterLive.textContent = active ? t('list-detail.filter-count', { count: visibleCount }) : '';
    const dot = this._filterBtnEl?.querySelector('.filter-btn-dot');
    if (dot) dot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
  }

  // ── Bulk helpers ──────────────────────────────────────────────────────────

  _applyBulkStatus(status) {
    const ids = [...this._selectedIds];
    this._mutateItems(items => items.map(i => ids.includes(i.id) ? { ...i, status } : i));
    this._bulkStatusSheet.close();
    toast(t('list-detail.bulk-status-toast', { n: ids.length }), 'success');
    this._exitSelectionMode();
  }

  // Bulk tags apply immediately (no toast) — the live chips + tag strips are the
  // feedback, matching the blur-to-save behaviour used elsewhere. After each
  // change the editor is re-fed so common/partial chip states restyle.
  _applyBulkTag(tag) {
    const ids = [...this._selectedIds];
    this._mutateItems(items => items.map(i =>
      ids.includes(i.id) && !(i.tags ?? []).includes(tag)
        ? { ...i, tags: [...(i.tags ?? []), tag] } : i));
    this._refreshBulkTagEditor();
  }

  _removeBulkTag(tag) {
    const ids = [...this._selectedIds];
    this._mutateItems(items => items.map(i =>
      ids.includes(i.id) ? { ...i, tags: (i.tags ?? []).filter(t => t !== tag) } : i));
    this._refreshBulkTagEditor();
  }

  _refreshBulkTagEditor() {
    if (!this._bulkTagEditor) return;
    const ids   = this._selectedIds;
    const items = getState().lists?.find(l => l.id === this._listId)?.items ?? [];
    this._bulkTagEditor.selectedTags = items
      .filter(i => ids.has(i.id))
      .map(i => i.tags ?? []);
  }

  _openBulkPicker() {
    this._bulkPickerDialog.lists        = getState().lists ?? [];
    this._bulkPickerDialog.sourceListId = this._listId;
    this._bulkPickerDialog.mode         = null;
    this._bulkPickerDialog.show();
  }

  // ── Import ────────────────────────────────────────────────────────────────

  _addItems(newItems) {
    this._mutateItems(items => [
      ...items,
      ...newItems.map(({ title, note, url }) => ({
        id: crypto.randomUUID(), title, status: 'open',
        note, url, dueDate: undefined, tags: [], inGoals: [],
      })),
    ]);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _renderItems(items) {
    syncChildren(this._itemList, items, 'list-item', (el, item) => {
      el.item          = item;
      el.selectionMode = this._selectionMode;
      el.selected      = this._selectionMode && this._selectedIds.has(item.id);
    }, { getElId: el => el._item?.id });
  }
}

customElements.define('list-detail-page', ListDetailPage);
