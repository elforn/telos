import { icons } from '../icons.js';

// Shared sticky page-header chrome (.page-header/.top-row) and filter-btn/
// menu-btn for lists-page and list-detail-page — confirmed byte-for-byte
// identical between the two. See ComponentDuplicationReport.md #5. home-page
// has no equivalent (it uses <year-header> instead), so this stays a
// 2-page share, not a 3-page one like filter-bar.js.
//
// Each page keeps its own .top-row *contents* around the shared buttons —
// lists-page has a static <h1> plus a .header-actions wrapper; list-detail-page
// has a back-btn and an editable-name <h1> with no wrapper. Only the
// filter-btn/menu-btn markup below is truly identical between the two.

export function pageHeaderStyles() {
  return `
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
      margin-inline-end: var(--edge-btn-bleed);
    }

    .menu-btn svg {
      inline-size: 22px;
      block-size: 22px;
      pointer-events: none;
    }

    .menu-btn:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `;
}

export function pageHeaderButtonsMarkup({ filterLabel, menuLabel }) {
  return `
    <button class="filter-btn" id="filter-btn" aria-label="${filterLabel}" aria-expanded="false">${icons.funnel}<span class="filter-btn-dot" hidden aria-hidden="true"></span></button>
    <button class="menu-btn" id="menu-btn" aria-label="${menuLabel}" aria-expanded="false">${icons.dotsVertical}</button>
  `;
}
