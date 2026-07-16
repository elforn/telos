import { AppElement } from '../../_lib/core/app-element.js';
import { navigate } from '../../_lib/core/router/router.js';
import { BASE_PATH } from '../base-path.js';
import { setState, getState, setRuntimeState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';
import { syncChildren } from '../../_lib/core/dom/sync-children.js';
import { t } from '../../_lib/core/strings.js';
import { toast } from '../../_lib/modules/toast/toast.js';
import '../components/list-item/list-item.js';
import '../components/item-dialog/item-dialog.js';
import '../components/list-dialog/list-dialog.js';
import '../components/add-row/add-row.js';
import '../components/list-picker-dialog/list-picker-dialog.js';
import { icons } from '../icons.js';
import { tagColor } from '../utils/tag-color.js';
import '../components/export-sheet/export-sheet.js';
import { exportListMarkdown, exportItemsMarkdown } from '../utils/export-markdown.js';

const EXPORT_MODE_LIST      = 'list';
const EXPORT_MODE_SELECTION = 'selection';
const EXPORT_MODE_ITEM      = 'item';

class ListDetailPage extends AppElement {
  template() {
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          dialog[open], dialog::backdrop { animation: none; }
        }

        :host {
          display: block;
          --page-padding: var(--space-5);
        }

        /* ── Header — matches year-header style ──────────────────────────── */

        .page-header {
          position: sticky;
          inset-block-start: var(--update-banner-height, 0px);
          z-index: 100;
          background: var(--color-surface);
          border-block-end: var(--header-strip-height) solid var(--color-border);
          padding-block-start: var(--safe-area-top);
          padding-inline: var(--page-padding);
        }

        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-block-size: 64px;
        }

        .back-btn,
        .menu-btn {
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
        }

        .menu-btn {
          margin-inline-end: var(--edge-btn-bleed);
        }

        .back-btn svg,
        .menu-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .back-btn {
          margin-inline-start: calc(-0.8 * var(--page-padding));
        }

        .back-btn:focus-visible,
        .menu-btn:focus-visible {
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
          padding: var(--space-3) var(--space-5) var(--space-3);
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

        /* ── Import dialog ───────────────────────────────────────────────── */

        #import-dialog textarea {
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

        #import-dialog textarea:focus {
          border-color: var(--color-accent);
        }

        #import-dialog textarea::placeholder {
          color: var(--color-text-muted);
        }

        .import-footer {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          border-block-start: 1px solid var(--color-border);
        }

        .import-footer-end {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-inline-start: auto;
        }

        #import-count {
          font-size: var(--font-size-caption);
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        .import-footer button {
          min-block-size: var(--touch-target);
          padding-inline: var(--space-4);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          font-weight: var(--font-weight-medium);
          touch-action: manipulation;
        }

        .import-footer button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #import-cancel-btn {
          background: none;
          color: var(--color-text-secondary);
        }

        #import-cta-btn {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          flex-shrink: 0;
        }

        #import-cta-btn:disabled {
          opacity: 0.4;
          cursor: default;
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
          inset-inline: 0;
          inset-block-end: 0;
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

        @keyframes bulk-bar-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
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

        #bulk-status-btn {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        #bulk-move-btn {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          border: 1.5px solid var(--color-border);
        }

        .bulk-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* ── Filter button ───────────────────────────────────────────────── */

        .filter-btn {
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
          position: relative;
        }

        .filter-btn svg {
          inline-size: 22px;
          block-size: 22px;
          pointer-events: none;
        }

        .filter-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        .filter-btn-dot {
          position: absolute;
          inset-block-start: 10px;
          inset-inline-end: 10px;
          inline-size: 6px;
          block-size: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
        }

        /* ── Filter bar ──────────────────────────────────────────────────── */

        #filter-bar {
          padding-block: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          border-block-start: 0.5px solid var(--color-border);
        }

        #filter-bar[hidden] { display: none; }

        .filter-top-row {
          display: flex;
          align-items: center;
        }

        .filter-search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-1);
          background: var(--color-surface-raised);
          border: 0.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding-inline: var(--space-3);
        }

        .filter-search-wrap:focus-within {
          border-color: var(--color-accent);
        }

        .filter-search-icon {
          flex-shrink: 0;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
        }

        .filter-search-icon svg {
          inline-size: 16px;
          block-size: 16px;
          pointer-events: none;
        }

        #filter-search {
          flex: 1;
          min-block-size: 34px;
          background: none;
          border: none;
          outline: none;
          font-family: var(--font-family);
          font-size: var(--font-size-body);
          color: var(--color-text-primary);
        }

        #filter-search::-webkit-search-cancel-button { display: none; }

        #filter-search::placeholder {
          color: var(--color-text-muted);
        }

        .filter-clear-btn,
        .filter-expand-btn {
          flex-shrink: 0;
          min-block-size: var(--touch-target);
          min-inline-size: var(--touch-target);
          border: none;
          background: none;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          touch-action: manipulation;
        }

        .filter-clear-btn svg {
          inline-size: 20px;
          block-size: 20px;
          pointer-events: none;
        }

        .filter-clear-btn {
          margin-inline-end: var(--edge-btn-bleed);
        }

        .filter-clear-btn.active {
          color: var(--color-danger);
        }

        .filter-expand-btn svg {
          inline-size: 16px;
          block-size: 16px;
          pointer-events: none;
        }

        .filter-expand-btn {
          position: relative;
        }

        .filter-expand-btn[aria-expanded="true"] svg {
          transform: rotate(180deg);
        }

        .filter-expand-dot {
          position: absolute;
          inset-block-start: 6px;
          inset-inline-end: 6px;
          inline-size: 6px;
          block-size: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
          pointer-events: none;
        }

        .filter-clear-btn:focus-visible,
        .filter-expand-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #filter-panel {
          display: flex;
          flex-direction: column;
          gap: calc(var(--space-1) + 1px);
        }

        #filter-panel[hidden] { display: none; }

        .filter-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          overflow-x: auto;
          flex-wrap: nowrap;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .filter-row::-webkit-scrollbar { display: none; }

        .filter-pill,
        .filter-tag-chip {
          flex-shrink: 0;
          min-block-size: var(--touch-target-small);
          padding-inline: var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: none;
          cursor: pointer;
          font-family: var(--font-family);
          font-size: var(--font-size-caption);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          white-space: nowrap;
          touch-action: manipulation;
        }

        .filter-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-text-on-accent);
        }

        .filter-tag-chip {
          border-color: var(--tag-color, var(--color-border));
        }

        .filter-tag-chip.active {
          background: var(--tag-color, var(--color-accent));
          border-color: var(--tag-color, var(--color-accent));
          color: var(--color-text-primary);
        }

        .filter-pill:focus-visible,
        .filter-tag-chip:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        #filter-empty {
          text-align: center;
          padding-block: var(--space-8);
          color: var(--color-text-muted);
          font-size: var(--font-size-body);
        }

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
          <button class="filter-btn" id="filter-btn" aria-label="${t('list-detail.filter-toggle')}" aria-expanded="false">${icons.funnel}<span class="filter-btn-dot" hidden aria-hidden="true"></span></button>
          <button class="menu-btn" id="menu-btn" aria-label="${t('list-detail.menu')}" aria-expanded="false">${icons.dotsVertical}</button>
        </div>
        <div id="filter-bar" hidden>
          <div class="filter-top-row">
            <div class="filter-search-wrap">
              <span class="filter-search-icon" aria-hidden="true">${icons.magnifyingGlass}</span>
              <input type="search" id="filter-search" placeholder="${t('list-detail.filter-search')}" aria-label="${t('list-detail.filter-search')}" autocomplete="off" />
            </div>
            <button class="filter-expand-btn" id="filter-expand-btn" aria-label="${t('list-detail.filter-expand')}" aria-expanded="false" aria-controls="filter-panel">${icons.chevronDown}<span class="filter-expand-dot" hidden aria-hidden="true"></span></button>
            <button class="filter-clear-btn" id="filter-clear-btn" aria-label="${t('list-detail.filter-clear')}">${icons.funnelX}</button>
          </div>
          <div id="filter-panel" hidden>
            <div class="filter-row" id="filter-status-row" role="group" aria-label="${t('list-detail.status-label')}">
              <button class="filter-pill" id="fstatus-open" aria-pressed="false">${t('item-dialog.status-open')}</button>
              <button class="filter-pill" id="fstatus-paused" aria-pressed="false">${t('item-dialog.status-paused')}</button>
              <button class="filter-pill" id="fstatus-done" aria-pressed="false">${t('item-dialog.status-done')}</button>
              <button class="filter-pill" id="fstatus-closed" aria-pressed="false">${t('item-dialog.status-closed')}</button>
            </div>
            <div class="filter-row" id="filter-tag-row" hidden></div>
          </div>
        </div>
      </div>

      <main>
        <div id="item-list" role="list"></div>
        <p id="filter-empty" hidden>${t('list-detail.filter-empty')}</p>
        <p role="status" class="sr-only" id="filter-live"></p>
        <add-row id="add-row">+ ${t('list-detail.add')}</add-row>
      </main>

      <dialog id="menu" aria-label="${t('list-detail.menu')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.status-label')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('list-detail.status-label')}">
            <button class="status-pill" id="status-show-btn">${t('list-detail.status-show')}</button>
            <button class="status-pill" id="status-hide-btn">${t('list-detail.status-hide')}</button>
          </div>
        </div>
        <div class="menu-section">
          <p class="menu-section-label">${t('settings.tag-strip')}</p>
          <div class="status-pill-group" role="group" aria-label="${t('settings.tag-strip')}">
            <button class="status-pill" id="tags-show-btn">${t('settings.reminder-on')}</button>
            <button class="status-pill" id="tags-hide-btn">${t('settings.reminder-off')}</button>
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
        <div class="menu-delete-section">
          <button class="menu-delete-btn" id="list-delete-btn">${t('list-detail.delete-list')}</button>
        </div>
      </dialog>

      <item-dialog id="dialog"></item-dialog>
      <list-dialog id="list-dialog"></list-dialog>

      <div id="bulk-bar" hidden role="toolbar" aria-label="${t('list-detail.cancel-selection')}">
        <button type="button" id="bulk-close-btn" aria-label="${t('list-detail.cancel-selection')}">${icons.xMark}</button>
        <span id="bulk-count"></span>
        <button type="button" id="bulk-more-btn" aria-label="${t('list-detail.bulk-more')}">${icons.dotsVertical}</button>
        <button type="button" id="bulk-delete-btn" aria-label="${t('list-detail.bulk-delete')}">${icons.trash}</button>
        <button type="button" class="bulk-btn" id="bulk-status-btn">${t('list-detail.bulk-status')}</button>
        <button type="button" class="bulk-btn" id="bulk-move-btn">${t('list-detail.bulk-move')}</button>
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

      <dialog id="bulk-more-sheet" aria-label="${t('list-detail.bulk-more')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <button class="menu-item" id="bulk-export-btn">
          <span>${t('list-detail.bulk-extract-markdown')}</span>
          <span class="menu-item-value" aria-hidden="true">›</span>
        </button>
      </dialog>

      <export-sheet id="export-sheet"></export-sheet>

      <list-picker-dialog id="bulk-picker"></list-picker-dialog>

      <dialog id="import-dialog" aria-label="${t('list-detail.import-heading')}">
        <div class="menu-handle" aria-hidden="true"></div>
        <div class="menu-section">
          <p class="menu-section-label">${t('list-detail.import-heading')}</p>
          <textarea id="import-textarea"
                    placeholder="${t('list-detail.import-placeholder')}"
                    rows="6"
                    enterkeyhint="enter"></textarea>
        </div>
        <div class="import-footer">
          <button type="button" id="import-cancel-btn">${t('list-detail.import-cancel')}</button>
          <div class="import-footer-end">
            <span id="import-count" hidden></span>
            <button type="button" id="import-cta-btn" disabled>${t('list-detail.import-cta')}</button>
          </div>
        </div>
      </dialog>
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
    this._drag        = null;
    this._insertLine  = null;
    this._selectionMode = false;
    this._selectedIds   = new Set();

    this._showStatus = true; // updated from store on first _onLists call

    this._onBack = () => navigate(`${BASE_PATH}lists`);
    this.shadowRoot.querySelector('#back-btn').addEventListener('click', this._onBack);

    const menuBtn = this.shadowRoot.querySelector('#menu-btn');
    this._onMenuBtn = () => {
      this._menuDialog.showModal();
      menuBtn.setAttribute('aria-expanded', 'true');
    };
    menuBtn.addEventListener('click', this._onMenuBtn);

    this._onMenuClose = () => {
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    this._menuDialog.addEventListener('close', this._onMenuClose);

    this._onBackdrop = e => { if (e.target === this._menuDialog) this._menuDialog.close(); };
    this._menuDialog.addEventListener('click', this._onBackdrop);

    // ── Name edit button ──────────────────────────────────────────────────────
    this._onNameEdit = () => {
      const list = getState().lists?.find(l => l.id === this._listId);
      if (list) {
        this._listEditSnapshot = getState().lists;
        this._listDialog.open(list);
      }
    };
    this.shadowRoot.querySelector('#name-edit-btn').addEventListener('click', this._onNameEdit);

    // ── List dialog (edit name / color) ───────────────────────────────────────
    this._onListNameChanged = e => {
      setState('lists', (getState().lists ?? []).map(l =>
        l.id !== this._listId ? l : { ...l, name: e.detail.name }
      ));
    };
    this._listDialog.addEventListener('list-name-changed', this._onListNameChanged);

    this._onListColorChanged = e => {
      setState('lists', (getState().lists ?? []).map(l => {
        if (l.id !== this._listId) return l;
        const { color: _, ...rest } = l;
        return e.detail.color ? { ...rest, color: e.detail.color } : rest;
      }));
    };
    this._listDialog.addEventListener('list-color-changed', this._onListColorChanged);

    this._onListClosed = () => {
      const snap = this._listEditSnapshot;
      this._listEditSnapshot = null;
      if (snap && JSON.stringify(getState().lists) !== JSON.stringify(snap)) {
        toast(t('lists.toast-list-saved'), 'success',
          { action: { label: t('undo.button'), onClick: () => setState('lists', snap) } });
      }
    };
    this._listDialog.addEventListener('list-closed', this._onListClosed);

    this._onListDialogDelete = () => this._deleteCurrentList();
    this._listDialog.addEventListener('list-delete', this._onListDialogDelete);

    // ── Delete list (menu) ────────────────────────────────────────────────────
    this._onListDeleteBtn = () => { this._menuDialog.close(); this._deleteCurrentList(); };
    this.shadowRoot.querySelector('#list-delete-btn').addEventListener('click', this._onListDeleteBtn);

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
    this.shadowRoot.querySelector('#status-show-btn').addEventListener('click', this._onStatusShow);
    this.shadowRoot.querySelector('#status-hide-btn').addEventListener('click', this._onStatusHide);

    this._onAddRow = () => {
      this._editingItem = null;
      this._createdItemId = null;
      this._itemEditSnapshot = getState().lists;
      this._prepareDialog(null);
      this._dialog.open(null);
    };
    this.shadowRoot.querySelector('#add-row').addEventListener('click', this._onAddRow);

    this._onItemTap = e => {
      if (this._selectionMode) return;
      const cleanItem = this._prepareDialog(e.detail.item);
      this._editingItem = cleanItem;
      this._createdItemId = null;
      this._itemEditSnapshot = getState().lists;
      this._dialog.open(cleanItem);
    };
    this._itemList.addEventListener('item-tap', this._onItemTap);

    this._onItemDelete = e => {
      const snapshot = getState().lists;
      this._deleteItem(e.detail.item.id);
      toast(t('lists.toast-item-deleted'), 'info', { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
    };
    this._itemList.addEventListener('item-delete', this._onItemDelete);

    this._onItemDoneToggle = e => {
      const item = e.detail.item;
      const newStatus = item.status === 'done' ? 'open' : 'done';
      this._editItem(item.id, { title: item.title, status: newStatus });
    };
    this._itemList.addEventListener('item-done-toggle', this._onItemDoneToggle);

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
    this._itemList.addEventListener('item-status-cycle', this._onItemStatusCycle);

    this._onItemCreated = e => {
      const { id, title, status, note, url, tags } = e.detail;
      this._addItem({ id, title, status, note, url, tags });
      this._editingItem = { id, title, status, note, url, tags, inGoals: [] };
      this._createdItemId = id;
    };
    this.shadowRoot.addEventListener('item-created', this._onItemCreated);

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
    this._dialog.addEventListener('item-closed', this._onItemClosed);

    this._onDialogDelete = () => {
      if (this._editingItem) {
        const snapshot = getState().lists;
        this._itemEditSnapshot = null; // suppress item-closed undo toast — delete has its own
        this._deleteItem(this._editingItem.id);
        toast(t('lists.toast-item-deleted'), 'info', { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
      }
    };
    this._dialog.addEventListener('item-delete', this._onDialogDelete);

    this._onItemTitleChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, title: e.detail.title } : i
      ));
    };
    this._dialog.addEventListener('item-title-changed', this._onItemTitleChanged);

    this._onItemNoteChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, note: e.detail.note } : i
      ));
    };
    this._dialog.addEventListener('item-note-changed', this._onItemNoteChanged);

    this._onItemUrlChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, url: e.detail.url } : i
      ));
    };
    this._dialog.addEventListener('item-url-changed', this._onItemUrlChanged);

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
    this._dialog.addEventListener('item-status-changed', this._onItemStatusChanged);

    this._onItemTagsChanged = e => {
      if (!this._editingItem) return;
      this._mutateItems(items => items.map(i =>
        i.id === this._editingItem.id ? { ...i, tags: e.detail.tags } : i
      ));
    };
    this._dialog.addEventListener('item-tags-changed', this._onItemTagsChanged);

    this._onItemMove = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, tags, targetListIds, newListName, copy } = e.detail;
      const item         = this._editingItem;
      const updatedItem  = { ...item, title, status, note, url, tags };
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
    this._dialog.addEventListener('item-move', this._onItemMove);

    this._onItemPromote = e => {
      if (!this._editingItem) return;
      const { title, status, note, url, tags, year, section } = e.detail;
      const item    = this._editingItem;
      const goalId  = crypto.randomUUID();
      const goal    = { id: goalId, title, tags: [], percentage: 0 };
      const state   = getState();
      const yearStr = String(year);
      const existing = state.goals?.[yearStr] ?? { capstone: [], milestones: [], wow: [], focus: [] };

      setState('goals', {
        ...state.goals,
        [yearStr]: { ...existing, [section]: [...(existing[section] ?? []), goal] },
      });

      const updatedItem = {
        ...item, title, status, note, url, tags,
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
    this._dialog.addEventListener('item-promote', this._onItemPromote);

    // ── Drag-to-reorder ───────────────────────────────────────────────────────

    this._onItemDragStart = e => {
      if (this._selectionMode) return;
      const { item, element: dragEl, startX, startY } = e.detail;
      const items     = [...this._itemList.querySelectorAll('list-item')];
      const fromIndex = items.indexOf(dragEl);
      const rect      = dragEl.getBoundingClientRect();

      dragEl.style.opacity = '0.4';

      const clone = this._createDragClone(rect, item.title);
      clone.style.left = `${rect.left}px`;
      clone.style.top  = `${rect.top}px`;
      document.body.appendChild(clone);

      if (!this._insertLine) {
        this._insertLine = document.createElement('div');
        this._insertLine.style.cssText = 'height:2px;border-radius:1px;margin-block:calc(var(--space-2)/2);pointer-events:none;background:var(--color-accent)';
      }

      this._drag = { item, fromIndex, dragEl, clone,
        offsetX: startX - rect.left, offsetY: startY - rect.top,
        targetIndex: fromIndex, scrollSpeed: 0, scrollRaf: null };

      const scrollLoop = () => {
        if (!this._drag) return;
        if (this._drag.scrollSpeed !== 0) window.scrollBy(0, this._drag.scrollSpeed);
        this._drag.scrollRaf = requestAnimationFrame(scrollLoop);
      };
      this._drag.scrollRaf = requestAnimationFrame(scrollLoop);

      dragEl.addEventListener('pointermove',   this._onDragMove);
      dragEl.addEventListener('pointerup',     this._onDragEnd);
      dragEl.addEventListener('pointercancel', this._onDragEnd);
    };

    this._onDragMove = e => {
      if (!this._drag) return;
      const { dragEl, clone, offsetX, offsetY } = this._drag;
      clone.style.left = `${e.clientX - offsetX}px`;
      clone.style.top  = `${e.clientY - offsetY}px`;

      const SCROLL_ZONE = 100;
      const MAX_SPEED   = 14;
      const vh = window.innerHeight;
      if (e.clientY < SCROLL_ZONE)
        this._drag.scrollSpeed = -MAX_SPEED * (1 - e.clientY / SCROLL_ZONE);
      else if (e.clientY > vh - SCROLL_ZONE)
        this._drag.scrollSpeed =  MAX_SPEED * (1 - (vh - e.clientY) / SCROLL_ZONE);
      else
        this._drag.scrollSpeed = 0;

      const idx = this._insertIndexAt(this._itemList, e.clientY, dragEl);
      this._drag.targetIndex = idx;
      this._updateInsertLine(this._itemList, idx, dragEl);
    };

    this._onDragEnd = () => {
      if (!this._drag) return;
      const { fromIndex, dragEl, clone, targetIndex } = this._drag;
      dragEl.removeEventListener('pointermove',   this._onDragMove);
      dragEl.removeEventListener('pointerup',     this._onDragEnd);
      dragEl.removeEventListener('pointercancel', this._onDragEnd);
      dragEl.style.opacity = '';
      cancelAnimationFrame(this._drag.scrollRaf);
      clone.remove();
      this._insertLine?.remove();
      this._drag = null;
      this._placeItem(fromIndex, targetIndex);
    };

    this._onItemReorderKey = e => {
      const { item, direction } = e.detail;
      const items = [...this._itemList.querySelectorAll('list-item')];
      const fromIndex = items.findIndex(el => el._item?.id === item.id);
      if (fromIndex === -1) return;
      const toIndex = direction === -1 ? Math.max(0, fromIndex - 1) : fromIndex + 2;
      this._placeItem(fromIndex, toIndex);
    };

    this._onBulkClose = () => this._exitSelectionMode();
    this.shadowRoot.querySelector('#bulk-close-btn').addEventListener('click', this._onBulkClose);

    this._bulkCountEl      = this.shadowRoot.querySelector('#bulk-count');
    this._bulkPickerDialog = this.shadowRoot.querySelector('#bulk-picker');
    this._bulkStatusSheet  = this.shadowRoot.querySelector('#bulk-status-sheet');
    this._bulkMoreSheet    = this.shadowRoot.querySelector('#bulk-more-sheet');

    this._onBulkDelete = () => {
      const ids = [...this._selectedIds];
      const snapshot = getState().lists;
      this._mutateItems(items => items.filter(i => !ids.includes(i.id)));
      this._exitSelectionMode();
      toast(t('list-detail.bulk-delete-toast', { n: ids.length }), 'info', { action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) } });
    };
    this.shadowRoot.querySelector('#bulk-delete-btn').addEventListener('click', this._onBulkDelete);

    this._onBulkStatus = () => this._bulkStatusSheet.showModal();
    this.shadowRoot.querySelector('#bulk-status-btn').addEventListener('click', this._onBulkStatus);

    this._onBulkStatusBackdrop = e => { if (e.target === this._bulkStatusSheet) this._bulkStatusSheet.close(); };
    this._bulkStatusSheet.addEventListener('click', this._onBulkStatusBackdrop);

    this._onBulkStatusOpen   = () => this._applyBulkStatus('open');
    this._onBulkStatusPaused = () => this._applyBulkStatus('paused');
    this._onBulkStatusDone   = () => this._applyBulkStatus('done');
    this._onBulkStatusClosed = () => this._applyBulkStatus('closed');
    this.shadowRoot.querySelector('#bulk-status-open').addEventListener('click', this._onBulkStatusOpen);
    this.shadowRoot.querySelector('#bulk-status-paused').addEventListener('click', this._onBulkStatusPaused);
    this.shadowRoot.querySelector('#bulk-status-done').addEventListener('click', this._onBulkStatusDone);
    this.shadowRoot.querySelector('#bulk-status-closed').addEventListener('click', this._onBulkStatusClosed);

    this._onBulkMore = () => this._bulkMoreSheet.showModal();
    this._onBulkMoreBackdrop = e => { if (e.target === this._bulkMoreSheet) this._bulkMoreSheet.close(); };
    this.shadowRoot.querySelector('#bulk-more-btn').addEventListener('click', this._onBulkMore);
    this._bulkMoreSheet.addEventListener('click', this._onBulkMoreBackdrop);

    this._exportSheet = this.shadowRoot.querySelector('#export-sheet');
    this._exportMode  = EXPORT_MODE_LIST;

    this._onExportMenuBtn = () => {
      this._menuDialog.close();
      this._exportMode = EXPORT_MODE_LIST;
      this._exportSheet.show();
    };
    this.shadowRoot.querySelector('#export-menu-btn').addEventListener('click', this._onExportMenuBtn);

    this._onBulkExportBtn = () => {
      this._bulkMoreSheet.close();
      this._exportMode = EXPORT_MODE_SELECTION;
      this._exportSheet.show();
    };
    this.shadowRoot.querySelector('#bulk-export-btn').addEventListener('click', this._onBulkExportBtn);

    this._onExportConfirm = e => {
      const { metadata, notes } = e.detail;
      const lists = getState().lists ?? [];
      const list  = lists.find(l => l.id === this._listId);
      if (!list) return;
      let md;
      if (this._exportMode === EXPORT_MODE_SELECTION) {
        const ids   = [...this._selectedIds];
        const items = (list.items ?? []).filter(i => ids.includes(i.id));
        md = exportItemsMarkdown(items, list.name, { metadata, notes });
      } else if (this._exportMode === EXPORT_MODE_ITEM) {
        md = exportItemsMarkdown([this._exportItem], list.name, { metadata, notes });
      } else {
        md = exportListMarkdown(list, { metadata, notes });
      }
      navigator.clipboard.writeText(md).catch(() => {});
      toast(t('export.copied'), 'success');
    };
    this._exportSheet.addEventListener('extract-confirm', this._onExportConfirm);

    this._onItemExportRequest = e => {
      this._exportItem = e.detail.item;
      this._exportMode = EXPORT_MODE_ITEM;
      this._exportSheet.show();
    };
    this.shadowRoot.addEventListener('item-export-request', this._onItemExportRequest);

    this._onBulkMove = () => this._openBulkPicker();
    this.shadowRoot.querySelector('#bulk-move-btn').addEventListener('click', this._onBulkMove);

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
    this._bulkPickerDialog.addEventListener('list-pick', this._onBulkListPick);

    this._onItemLongPress = e => {
      if (!this._selectionMode) this._enterSelectionMode(e.detail.item.id);
    };
    this._itemList.addEventListener('item-long-press', this._onItemLongPress);

    this._onItemSelectToggle = e => {
      const id = e.detail.item.id;
      if (this._selectedIds.has(id)) this._selectedIds.delete(id);
      else this._selectedIds.add(id);
      if (this._selectedIds.size === 0) { this._exitSelectionMode(); return; }
      this._syncSelectionUI();
    };
    this._itemList.addEventListener('item-select-toggle', this._onItemSelectToggle);

    this._itemList.addEventListener('item-drag-start',  this._onItemDragStart);
    this._itemList.addEventListener('item-reorder-key', this._onItemReorderKey);

    // ── Import from text ──────────────────────────────────────────────────────

    this._importDialog   = this.shadowRoot.querySelector('#import-dialog');
    this._importTextarea = this.shadowRoot.querySelector('#import-textarea');
    this._importCountEl  = this.shadowRoot.querySelector('#import-count');
    this._importCtaBtn   = this.shadowRoot.querySelector('#import-cta-btn');
    this._importParsed   = [];

    this._onImportMenuBtn = () => {
      this._menuDialog.close();
      this._importTextarea.value = '';
      this._importParsed = [];
      this._updateImportUI();
      this._importDialog.showModal();
      requestAnimationFrame(() => this._importTextarea.focus());
    };
    this.shadowRoot.querySelector('#import-menu-btn').addEventListener('click', this._onImportMenuBtn);

    this._onImportTextarea = () => {
      this._importParsed = this._parseImportText(this._importTextarea.value);
      this._updateImportUI();
    };
    this._importTextarea.addEventListener('input', this._onImportTextarea);

    this._onImportCancel = () => this._importDialog.close();
    this.shadowRoot.querySelector('#import-cancel-btn').addEventListener('click', this._onImportCancel);

    this._onImportBackdrop = e => { if (e.target === this._importDialog) this._importDialog.close(); };
    this._importDialog.addEventListener('click', this._onImportBackdrop);

    this._onImportCta = () => {
      if (!this._importParsed.length) return;
      const snapshot = getState().lists;
      const n = this._importParsed.length;
      this._addItems(this._importParsed);
      this._importDialog.close();
      toast(t('list-detail.import-toast', { n }), 'success', {
        action: { label: t('undo.button'), onClick: () => setState('lists', snapshot) },
      });
    };
    this._importCtaBtn.addEventListener('click', this._onImportCta);

    // ── Filter bar ────────────────────────────────────────────────────────────

    this._filterBar       = this.shadowRoot.querySelector('#filter-bar');
    this._filterSearch    = this.shadowRoot.querySelector('#filter-search');
    this._filterPanel     = this.shadowRoot.querySelector('#filter-panel');
    this._filterTagRow    = this.shadowRoot.querySelector('#filter-tag-row');
    this._filterEmpty     = this.shadowRoot.querySelector('#filter-empty');
    this._filterLive      = this.shadowRoot.querySelector('#filter-live');
    this._filterExpandBtn = this.shadowRoot.querySelector('#filter-expand-btn');
    this._filterBtnEl     = this.shadowRoot.querySelector('#filter-btn');

    this._filter = { query: '', statuses: new Set(), tags: new Set() };
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
    this._filterBtnEl.addEventListener('click', this._onFilterBtn);

    this._onFilterExpand = () => {
      this._panelExpanded = !this._panelExpanded;
      this._saveFilter();
      this._syncFilterUI();
    };
    this._filterExpandBtn.addEventListener('click', this._onFilterExpand);

    this._onFilterSearch = () => {
      this._filter.query = this._filterSearch.value;
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this._filterSearch.addEventListener('input', this._onFilterSearch);

    this._onFilterStatus = e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      const statusMap = { 'fstatus-open': 'open', 'fstatus-paused': 'paused', 'fstatus-done': 'done', 'fstatus-closed': 'closed' };
      const s = statusMap[btn.id];
      if (!s) return;
      if (this._filter.statuses.has(s)) this._filter.statuses.delete(s);
      else this._filter.statuses.add(s);
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.shadowRoot.querySelector('#filter-status-row').addEventListener('click', this._onFilterStatus);

    this._onFilterClear = () => {
      this._filter = { query: '', statuses: new Set(), tags: new Set() };
      this._filterSearch.value = '';
      this._saveFilter();
      this._syncFilterUI();
      this._applyFilter();
    };
    this.shadowRoot.querySelector('#filter-clear-btn').addEventListener('click', this._onFilterClear);

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
      this._showStatus = list.showStatus ?? true;
      this._applyStatusPref();
      this._renderItems(list.items ?? []);
      this._rebuildTagChips(list.items ?? []);
      this._syncFilterUI();
      if (!this._filterSuppressed) this._applyFilter();
    };
    subscribe('lists', this._onLists);

    this._onListsTagsVisible = tagsVisible => {
      const visible = tagsVisible?.[this._listId] === true;
      document.documentElement.style.setProperty('--tag-strip-display', visible ? 'block' : 'none');
      this.shadowRoot?.querySelector('#tags-show-btn')?.classList.toggle('active', visible);
      this.shadowRoot?.querySelector('#tags-hide-btn')?.classList.toggle('active', !visible);
    };
    subscribe('listsTagsVisible', this._onListsTagsVisible);

    this._onTagsShowBtn = () => {
      setState('listsTagsVisible', { ...getState().listsTagsVisible, [this._listId]: true });
      this._menuDialog.close();
    };
    this._onTagsHideBtn = () => {
      setState('listsTagsVisible', { ...getState().listsTagsVisible, [this._listId]: false });
      this._menuDialog.close();
    };
    this.shadowRoot.querySelector('#tags-show-btn').addEventListener('click', this._onTagsShowBtn);
    this.shadowRoot.querySelector('#tags-hide-btn').addEventListener('click', this._onTagsHideBtn);
  }

  unsubscribe() {
    clearTimeout(this._filterSuppressTimer);
    this.shadowRoot?.querySelector('#back-btn')?.removeEventListener('click', this._onBack);
    this.shadowRoot?.querySelector('#menu-btn')?.removeEventListener('click', this._onMenuBtn);
    this._menuDialog?.removeEventListener('close', this._onMenuClose);
    this._menuDialog?.removeEventListener('click', this._onBackdrop);
    this.shadowRoot?.querySelector('#name-edit-btn')?.removeEventListener('click', this._onNameEdit);
    this._listDialog?.removeEventListener('list-name-changed', this._onListNameChanged);
    this._listDialog?.removeEventListener('list-color-changed', this._onListColorChanged);
    this._listDialog?.removeEventListener('list-closed', this._onListClosed);
    this._listDialog?.removeEventListener('list-delete', this._onListDialogDelete);
    this.shadowRoot?.querySelector('#list-delete-btn')?.removeEventListener('click', this._onListDeleteBtn);
    this.shadowRoot?.querySelector('#status-show-btn')?.removeEventListener('click', this._onStatusShow);
    this.shadowRoot?.querySelector('#status-hide-btn')?.removeEventListener('click', this._onStatusHide);
    this.shadowRoot?.querySelector('#add-row')?.removeEventListener('click', this._onAddRow);
    this._itemList?.removeEventListener('item-tap', this._onItemTap);
    this._itemList?.removeEventListener('item-delete', this._onItemDelete);
    this._itemList?.removeEventListener('item-done-toggle', this._onItemDoneToggle);
    this._itemList?.removeEventListener('item-status-cycle', this._onItemStatusCycle);
    this.shadowRoot?.querySelector('#bulk-close-btn')?.removeEventListener('click', this._onBulkClose);
    this.shadowRoot?.querySelector('#bulk-delete-btn')?.removeEventListener('click', this._onBulkDelete);
    this.shadowRoot?.querySelector('#bulk-status-btn')?.removeEventListener('click', this._onBulkStatus);
    this._bulkStatusSheet?.removeEventListener('click', this._onBulkStatusBackdrop);
    this.shadowRoot?.querySelector('#bulk-status-open')?.removeEventListener('click', this._onBulkStatusOpen);
    this.shadowRoot?.querySelector('#bulk-status-paused')?.removeEventListener('click', this._onBulkStatusPaused);
    this.shadowRoot?.querySelector('#bulk-status-done')?.removeEventListener('click', this._onBulkStatusDone);
    this.shadowRoot?.querySelector('#bulk-status-closed')?.removeEventListener('click', this._onBulkStatusClosed);
    this.shadowRoot?.querySelector('#bulk-more-btn')?.removeEventListener('click', this._onBulkMore);
    this._bulkMoreSheet?.removeEventListener('click', this._onBulkMoreBackdrop);
    this.shadowRoot?.querySelector('#bulk-move-btn')?.removeEventListener('click', this._onBulkMove);
    this._bulkPickerDialog?.removeEventListener('list-pick', this._onBulkListPick);
    this._itemList?.removeEventListener('item-long-press',     this._onItemLongPress);
    this._itemList?.removeEventListener('item-select-toggle',  this._onItemSelectToggle);
    this._itemList?.removeEventListener('item-drag-start',  this._onItemDragStart);
    this._itemList?.removeEventListener('item-reorder-key', this._onItemReorderKey);
    this.shadowRoot?.removeEventListener('item-created', this._onItemCreated);
    this._dialog?.removeEventListener('item-closed', this._onItemClosed);
    this._dialog?.removeEventListener('item-delete', this._onDialogDelete);
    this._dialog?.removeEventListener('item-title-changed', this._onItemTitleChanged);
    this._dialog?.removeEventListener('item-note-changed',  this._onItemNoteChanged);
    this._dialog?.removeEventListener('item-url-changed',   this._onItemUrlChanged);
    this._dialog?.removeEventListener('item-status-changed', this._onItemStatusChanged);
    this._dialog?.removeEventListener('item-tags-changed',   this._onItemTagsChanged);
    this._dialog?.removeEventListener('item-move',   this._onItemMove);
    this._dialog?.removeEventListener('item-promote', this._onItemPromote);
    if (this._drag) {
      const { dragEl, clone } = this._drag;
      dragEl.removeEventListener('pointermove',   this._onDragMove);
      dragEl.removeEventListener('pointerup',     this._onDragEnd);
      dragEl.removeEventListener('pointercancel', this._onDragEnd);
      dragEl.style.opacity = '';
      cancelAnimationFrame(this._drag.scrollRaf);
      clone.remove();
      this._insertLine?.remove();
      this._drag = null;
    }
    unsubscribe('lists', this._onLists);
    unsubscribe('listsTagsVisible', this._onListsTagsVisible);
    this.shadowRoot?.querySelector('#tags-show-btn')?.removeEventListener('click', this._onTagsShowBtn);
    this.shadowRoot?.querySelector('#tags-hide-btn')?.removeEventListener('click', this._onTagsHideBtn);
    this.shadowRoot?.querySelector('#export-menu-btn')?.removeEventListener('click', this._onExportMenuBtn);
    this.shadowRoot?.querySelector('#bulk-export-btn')?.removeEventListener('click', this._onBulkExportBtn);
    this._exportSheet?.removeEventListener('extract-confirm', this._onExportConfirm);
    this.shadowRoot?.removeEventListener('item-export-request', this._onItemExportRequest);
    this.shadowRoot?.querySelector('#import-menu-btn')?.removeEventListener('click', this._onImportMenuBtn);
    this._importTextarea?.removeEventListener('input', this._onImportTextarea);
    this.shadowRoot?.querySelector('#import-cancel-btn')?.removeEventListener('click', this._onImportCancel);
    this._importDialog?.removeEventListener('click', this._onImportBackdrop);
    this._importCtaBtn?.removeEventListener('click', this._onImportCta);
    this._filterBtnEl?.removeEventListener('click', this._onFilterBtn);
    this._filterExpandBtn?.removeEventListener('click', this._onFilterExpand);
    this._filterSearch?.removeEventListener('input', this._onFilterSearch);
    this.shadowRoot?.querySelector('#filter-status-row')?.removeEventListener('click', this._onFilterStatus);
    this.shadowRoot?.querySelector('#filter-clear-btn')?.removeEventListener('click', this._onFilterClear);
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

  _addItem({ id, title, status, note, url, tags }) {
    const item = {
      id: id ?? crypto.randomUUID(), title, status,
      note, url, dueDate: undefined,
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
    setRuntimeState('pendingListUndo', { snapshot, listName });
    navigate(`${BASE_PATH}lists`);
  }

  // ── Drag helpers ──────────────────────────────────────────────────────────

  _insertIndexAt(list, y, ghostEl) {
    const items = [...list.querySelectorAll('list-item')];
    for (const item of items.filter(el => el !== ghostEl)) {
      const r = item.getBoundingClientRect();
      if (y < r.top + r.height / 2) return items.indexOf(item);
    }
    return items.length;
  }

  _updateInsertLine(list, targetIndex, ghostEl) {
    const items = [...list.querySelectorAll('list-item')];
    if (targetIndex >= items.length) list.appendChild(this._insertLine);
    else list.insertBefore(this._insertLine, items[targetIndex]);
  }

  _createDragClone(rect, title) {
    const clone = document.createElement('div');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.cssText = [
      'position:fixed',
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'background:var(--color-surface)',
      'border:0.5px solid var(--color-border)',
      'border-radius:var(--radius-md)',
      'box-shadow:var(--shadow-drag)',
      'display:flex',
      'align-items:center',
      'padding:0 var(--space-3)',
      'pointer-events:none',
      'z-index:9999',
      'overflow:hidden',
      'white-space:nowrap',
      'text-overflow:ellipsis',
      'font-family:var(--font-family)',
      'font-size:var(--font-size-body)',
      'font-weight:var(--font-weight-medium)',
      'color:var(--color-text-primary)',
    ].join(';');
    clone.textContent = title;
    return clone;
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

  // ── Filter helpers ────────────────────────────────────────────────────────

  _loadFilter() {
    try {
      const raw = localStorage.getItem(`telos:filter:list:${this._listId}`);
      if (raw) {
        const { query = '', statuses = [], tags = [], panelExpanded = false, barExpanded = false } = JSON.parse(raw);
        this._filter = { query, statuses: new Set(statuses), tags: new Set(tags) };
        this._panelExpanded = panelExpanded;
        this._barExpanded = barExpanded;
      }
    } catch { /* ignore */ }
  }

  _saveFilter() {
    const { query, statuses, tags } = this._filter;
    if (query || statuses.size || tags.size || this._barExpanded || this._panelExpanded) {
      localStorage.setItem(`telos:filter:list:${this._listId}`,
        JSON.stringify({ query, statuses: [...statuses], tags: [...tags], panelExpanded: this._panelExpanded, barExpanded: this._barExpanded }));
    } else {
      localStorage.removeItem(`telos:filter:list:${this._listId}`);
    }
  }

  _isFilterActive() {
    const { query, statuses, tags } = this._filter;
    return !!(query || statuses.size || tags.size);
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
    const dot = this._filterBtnEl?.querySelector('.filter-btn-dot');
    if (dot) dot.hidden = !active;
    this.shadowRoot?.querySelector('#filter-clear-btn')?.classList.toggle('active', active);
    const expandDot = this._filterExpandBtn?.querySelector('.filter-expand-dot');
    if (expandDot) expandDot.hidden = !(this._filter.statuses.size || this._filter.tags.size);
    this._filterTagRow?.querySelectorAll('.filter-tag-chip').forEach(chip => {
      const on = this._filter.tags.has(chip.dataset.tag);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    const panelOpen = this._panelExpanded || this._filter.statuses.size > 0 || this._filter.tags.size > 0;
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
    const { query, statuses, tags } = this._filter;
    return !!(query.toLowerCase().trim() || statuses.size || tags.size);
  }

  _itemMatchesFilter(item) {
    const { query, statuses, tags } = this._filter;
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

  _openBulkPicker() {
    this._bulkPickerDialog.lists        = getState().lists ?? [];
    this._bulkPickerDialog.sourceListId = this._listId;
    this._bulkPickerDialog.mode         = null;
    this._bulkPickerDialog.show();
  }

  // ── Import ────────────────────────────────────────────────────────────────

  _parseImportText(text) {
    const TITLE_MAX = 120;
    const BULLET_RE = /^[\-\*\•]\s+/;
    const URL_RE    = /https?:\/\/\S+/g;

    const rawItems = [];
    let current = null;

    for (const line of text.split('\n')) {
      const isIndented = /^[ \t]/.test(line) && line.trim() !== '';
      if (isIndented) {
        if (current) {
          current.continuationLines.push(line.trim().replace(BULLET_RE, ''));
        }
      } else {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (current) rawItems.push(current);
        current = { titleRaw: trimmed.replace(BULLET_RE, '').trim(), continuationLines: [] };
      }
    }
    if (current) rawItems.push(current);

    return rawItems.map(({ titleRaw, continuationLines }) => {
      const tooLong = titleRaw.length > TITLE_MAX;
      let title = titleRaw;
      if (tooLong) {
        const candidate = titleRaw.slice(0, TITLE_MAX);
        const lastSpace = candidate.lastIndexOf(' ');
        title = lastSpace > TITLE_MAX / 2 ? candidate.slice(0, lastSpace) : candidate;
      }

      const noteParts = [];
      if (tooLong) noteParts.push(titleRaw);
      noteParts.push(...continuationLines);
      const note = noteParts.length ? noteParts.join('\n') : undefined;

      const allText = [titleRaw, ...continuationLines].join('\n');
      const urls = allText.match(URL_RE) ?? [];
      const url  = urls.length ? urls[urls.length - 1].replace(/[.,;:!?)"']+$/, '') : undefined;

      return { title, note, url };
    });
  }

  _updateImportUI() {
    const n = this._importParsed.length;
    const m = this._importParsed.filter(i => i.note || i.url).length;

    if (n === 0) {
      this._importCountEl.hidden = true;
      this._importCountEl.textContent = '';
    } else {
      this._importCountEl.hidden = false;
      this._importCountEl.textContent = m > 0
        ? t('list-detail.import-count-extras', { n, m })
        : t('list-detail.import-count', { n });
    }
    this._importCtaBtn.disabled = n === 0;
  }

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
