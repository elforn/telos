# Changelog

All notable changes to Telos are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [1.8.0] — 2026-06-25

### Added
- Markdown highlighting in note and description fields — `*italic*`, `**bold**`, and `# headings` are tinted in colour as you type; the textarea stays plain text so cursor position is always accurate
- Import list items from text — paste or type one item per line in the list detail menu; indent a line to make it a note on the item above
- Swipe left on a toast to dismiss it before it auto-dismisses (Socle 0.9.20)
- Export reminder badge on the gear button and on the Export row in settings — appears when you haven't exported in more than 30 days
- Show / Hide pill group in settings to enable or disable the export reminder badge
- Automatic backup download before any import (merge or replace) — your data is saved to a `.telos` file before changes are applied; a toast confirms the backup

### Changed
- Tapping a status badge on a list item cycles through Open → Paused → Done → Open without opening the edit dialog
- Cancelling the goal or item edit dialog now reverts any unsaved changes — previously typing in a form and then cancelling would leave those values in the field on next open
- List detail page header separator now uses the list's accent colour when one is set — makes it instantly clear which list you're viewing
- Show/Hide status preference for each list is now stored with the list itself — the preference survives a fresh install and is included in export/import
- Header separator is now consistently 3 px across the Goals and Lists pages

### Fixed
- Toast appears above the bottom nav bar so navigation remains usable while a toast is showing
- Repair installation now lands on the app's home screen instead of the current path, which previously 404'd on GitHub Pages after cache clearing

---

## [1.7.0] — 2026-06-23

### Added
- Undo for delete actions — deleting a goal, list item, or entire list now shows an Undo button in the toast; tap within 5 seconds to restore
- Undo for edit saves — saving changes to a goal title/description, list name, or item title/note/URL also offers Undo; tap to revert to the previous values
- When a whole list is deleted from the list detail page, the Undo toast appears on the Lists page after navigation so you can recover without losing context
- Bulk delete also shows an Undo toast that restores all removed items at once
- Status radio buttons in the item edit dialog commit immediately on tap — no Save button needed for status changes
- Colour swatches in the list edit dialog commit immediately on tap — no Save button needed for colour changes

### Changed
- Delete buttons on goals, list items, and lists now act on a single tap — the two-tap "Sure?" confirmation flow has been removed; the Undo toast is the safety net
- Headings removed from goal and list edit dialogs — context is clear from the form fields and the Save button still guards against accidental edits

### Fixed
- Item dialog action sheet animation now respects `prefers-reduced-motion`

---

## [1.6.2] — 2026-06-22

### Added
- Long-press a list item to enter selection mode — tap more items to grow the selection
- Bulk delete all selected items in one tap from the bulk action bar
- Bulk move selected items to one or more other lists — items are removed from the current list
- Bulk copy selected items to one or more other lists — originals stay in the current list
- During bulk move or copy, create a brand-new destination list on the spot without leaving the flow
- Move or copy a single item to other lists directly from the item edit dialog
- Promote a list item to a goal from the item edit dialog — choose a year and section; a new goal is created and the item records where it was promoted
- Tapping "Add to goal" for a year/section the item is already linked to disables the CTA ("Already added")
- Bulk **Status** button — set all selected items to Open, Paused, or Done in one tap via a bottom-sheet
- Bulk **⋮** overflow button — placeholder bottom-sheet for future bulk actions without cluttering the bar layout
- All action icons (trash, drag handle, done/undo, chevrons, pencil, ×, ⋮, ℹ, link) are now crisp SVG paths from the Feather/Lucide icon set — no more emoji or Unicode characters
- Copy button on the description field (goal dialog) and note field (item dialog) — tap the clipboard icon to copy the text; a checkmark confirms for 1.5 seconds

### Changed
- Deselecting the last selected item exits selection mode automatically — no cancel button needed
- Bulk action bar appears above the bottom navigation bar during selection mode
- Bulk action bar redesigned: Copy button removed; Delete is now icon-only (trash); Status and Move are the primary text actions
- Delete buttons on list items and goal items are now icon-only (trash icon) — labels removed to save space, especially in French
- Swipe-reveal delete zone is narrower (60 px instead of 80 px) to match the icon-only button
- Delete list button in the options sheet now spans the full width with an outlined danger border and a separator above it — more visually contained and clearly separated from the status filter
- Tapping the copy button or colour swatches while the keyboard is open no longer dismisses the keyboard on mobile

### Fixed
- Selected list items now show an opaque accent tint — previously the semi-transparent overlay let the done and delete action buttons bleed through visually
- Marking a list item as done no longer briefly hides the bottom navigation bar — the celebration ring now uses `outline` instead of `box-shadow`, avoiding the stacking context that was clipping the nav

---

## [1.5.1] — 2026-06-20

### Added
- Opening a `.telos` file on desktop (Chrome/Edge) launches Telos and shows the import preview dialog — merge or replace as usual

### Changed
- Lists page navigation arrow is now styled with a muted accent tint, making it visually distinct as a navigation action
- Navigating back to the Lists page from a list detail restores your previous scroll position
- Swiping between years (or tapping prev/next) now preserves each year's scroll position — you can compare sections across years by swiping without losing your place
- Tapping the Years pill while already on today's year scrolls to the top; tapping it from a different year navigates to today's year and restores that year's last scroll position
- Per-year accent colour is now scoped to the year view only — the Lists page and navigation bar always use the app's default blue regardless of which year you last visited
- Colour swatch row in the list edit dialog has more breathing room below it

### Fixed
- Vertical alignment of elements in list row items — drag handle dots and navigation chevron are now CSS-drawn (immune to font metric variance), text nudged 1 px down for optical centering

---

## [1.5.0] — 2026-06-20

### Added
- Drag-to-reorder goals within each section — hold-drag the grip handle (⠿) to rearrange, or use the up/down arrow buttons as a keyboard alternative
- Drag-to-reorder lists on the Lists page — same grip-handle interaction

### Changed
- Swipe-to-reveal actions (delete, fail) refined across goal items, list rows, and list detail items — consistent snap behaviour and feel

---

## [1.4.2] — 2026-06-19

### Changed
- Socle updated to 0.9.18 — includes SW update-loop fix and improved sync test reliability

---

## [1.4.1] — 2026-06-19

### Fixed
- Service worker update loop is now detected and automatically repaired — a **Repair** button appears if the app gets stuck in an infinite reload cycle

---

## [1.4.0] — 2026-06-19

### Added
- Sync import now shows a preview of incoming data with conflict resolution — review changes before committing
- List items can have an optional **note** and **URL** — stored per item, shown in the detail view
- **List colour picker** — assign a colour to each list for visual differentiation; shown as a tinted badge
- Swipe-left to delete a list from the Lists page
- Goals can have an optional **description** — add context via the edit dialog; a small `ℹ` indicator appears on the card when set
- Goal dialog: edits auto-save as a draft so changes survive accidental dismissal
- Goal and list-item delete now requires a second tap to confirm, preventing accidental deletions

---

## [1.3.0] — 2026-06-17

### Added
- **Persistent bottom navigation bar** — switch between Years and Lists; includes a settings panel with theme, language, and import/export controls
- **Lists** — create named lists, add items, and manage them independently of any year

### Changed
- Theme and language settings moved from the year-header menu to the bottom nav settings panel
- Edit mode now persists when you navigate between years

### Fixed
- Year-header swipe gesture corrected for reliability after a year change
- Header height standardised across all pages

---

## [1.2.0] — 2026-06-13

### Added
- Appearance menu item (Light / System / Dark) — switch colour scheme from the year-header menu; persists across sessions
- Unit tests for `year-header` — menu open/close, year navigation events, accent colour picker, and theme badge updates
- Socle updated to 0.9.5: esbuild bundle pipeline (single hashed JS file, tokens.css inlined, no loose module files in dist)
- Anti-FOUC inline script in `index.html` applies the correct `data-theme` before first paint

### Changed
- `year-header` `subscribe()` split into focused setup methods for readability
- Locale files (`ca.js`, `fr.js`) standardised to single quotes with escaped apostrophes
- Colour swatch `aria-label` values are now descriptive names ("Sky blue", "Teal") instead of hex codes

### Fixed
- Import confirmation button text now uses `--color-text-inverse` for correct contrast on the accent background
- Photo upload and photo delete errors are now caught and logged instead of failing silently

---

## [1.1.0] — 2026-06-13

### Added
- Per-year accent colour picker — 10-colour palette in the year-header menu; resets to the default blue
- CSS particle burst animation plays when a goal is marked complete

### Changed
- 404 page redesigned to match the app's visual style with a faded "404" motif and accent-coloured CTA button

### Fixed
- Invalid `/:year` URL values (non-numeric, out-of-range) now redirect to the 404 page instead of a broken year view
- `tokens.css` link uses a root-absolute path so deep-URL navigation no longer breaks the stylesheet

---

## [1.0.0] — 2026-06-06

### Added
- Capstone, milestones, wow, and focus goal sections per year
- Progress bar with hold-drag interaction (0–100 %); fail state (−1); swipe-to-reveal delete and fail actions in edit mode
- Year navigation — tap prev/next in the header to move between years
- Year photo — full-bleed header background image per year
- Export / import as `.telos` file via the sync module
- Service worker with offline-first caching
- PWA manifest (installable on Android Chrome and Firefox)
- Deployed to `https://elforn.github.io/telos` via GitHub Actions

### Fixed
- Router base-path handling for GitHub Pages — routes and `navigate()` calls now correctly prefix `/telos/` in the deployed build, derived from `import.meta.url` rather than a DOM query
