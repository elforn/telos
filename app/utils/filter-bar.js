import { icons } from '../icons.js';

// Shared search/clear/expand/panel shell for home-page, lists-page, and
// list-detail-page. Extracted because the three had already drifted apart in
// several ways despite being the same widget: pill class name (.filter-pill
// vs .filter-chip), row-wrapper class name (.filter-top-row vs
// .filter-bar-row), a dead unused local `.filter-row` definition in
// lists-page (shadowed by its own `.filter-chip-row`), and hardcoded
// id→value maps duplicated in two pages' click handlers instead of a
// `data-state`/`data-status` attribute. Normalized on .filter-pill/
// .filter-top-row (2 of 3 pages already used them) — see
// ComponentDuplicationReport.md #4. lists-page's `.filter-chip-row` (wraps to
// multiple lines, unlike the shared `.filter-row`'s horizontal scroll) is a
// real behavioural difference, not drift, so it stays page-local.
//
// Deliberately NOT a <custom-element> — turning this into an encapsulated
// component would force every e2e test that queries these ids to add a
// shadow-root hop. Stays inside each page's own shadow root instead.
//
// Each page still owns its panel's inner rows (state/status pills, tag row)
// since that vocabulary is genuinely page-specific — only the shell (search,
// clear, expand, panel wrapper) is shared here. State/status pills should
// carry their value in a `data-state`/`data-status` attribute, read directly
// by the page's click handler, rather than a hardcoded id→value map.

export function filterBarStyles() {
  return `
    #filter-bar {
      border-block-start: 0.5px solid var(--color-border);
      padding-block: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      background: var(--color-surface);
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

    /* Date-bucket pills live in <date-filter-row> — it owns its own styling. */

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
  `;
}

// `slot` (optional) lets home-page slot this straight into <year-header>'s
// filter-bar slot, without an extra wrapper div — lists-page and
// list-detail-page pass nothing and mount it as a plain sibling of their
// own page-header.
export function filterBarMarkup({ searchPlaceholder, searchLabel, expandLabel, clearLabel, rowsHtml, slot }) {
  const slotAttr = slot ? ` slot="${slot}"` : '';
  return `
    <div${slotAttr} id="filter-bar" hidden>
      <div class="filter-top-row">
        <div class="filter-search-wrap">
          <span class="filter-search-icon" aria-hidden="true">${icons.magnifyingGlass}</span>
          <input type="search" id="filter-search" placeholder="${searchPlaceholder}" aria-label="${searchLabel}" autocomplete="off" />
        </div>
        <button class="filter-expand-btn" id="filter-expand-btn" aria-label="${expandLabel}" aria-expanded="false" aria-controls="filter-panel">${icons.chevronDown}<span class="filter-expand-dot" hidden aria-hidden="true"></span></button>
        <button class="filter-clear-btn" id="filter-clear-btn" aria-label="${clearLabel}">${icons.funnelX}</button>
      </div>
      <div id="filter-panel" hidden>${rowsHtml}</div>
    </div>
  `;
}
