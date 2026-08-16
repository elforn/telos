# Changelog

All notable changes to Telos are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.2.0] — 2026-08-16

### Changed
- **Weekly/monthly frequency goals: type and target are no longer frozen after creation.** Percentage↔frequency is still a permanent one-way door, locked in at creation — there's no meaningful mapping between a percentage value and a habit's entry history either direction. But switching between weekly and monthly, or adjusting the target count, now stays open for the life of the goal: the edit dialog's locked label becomes an interactive pill group again (percentage withheld), and target-stepper/Every-day edits commit immediately. Existing log entries carry over untouched across a weekly↔monthly switch — they're just dates, re-bucketed by whichever cadence is now selected.
- **The frequency-average window is no longer one shared number.** Split into weekly = 6 periods / monthly = 4: a "period" is such a different wall-clock span per type (6 weeks ≈ 1.5 months vs. 6 months) that sharing one count meant a flawless brand-new monthly goal couldn't reach 100% for half a year.
- **"Fix a day" now spans as far back as the score can actually move** — 42 days for weekly, 120 for monthly (up from a flat 14 for both) — with a plain month-label divider inserted wherever the strip crosses a calendar month, and opens scrolled to today rather than the oldest day.

## [2.1.3] — 2026-08-16

### Fixed
- **Frequency goal rows never showed history dots — only the current-period dot was ever visible.** The 5-dot history strip's container had no CSS layout rule at all, so it defaulted to `display: inline`, under which width and height are ignored by spec on every child dot — they were rendering at zero size the whole time, regardless of whether a period was met, partial, or missed. Confirmed on both mobile and desktop. Fixed by giving the strip its own `display: flex`.

## [2.1.2] — 2026-08-16

### Changed
- **Removed the "Back" button from the goal-dialog's Fix-a-day sheet.** It's dismissible the same way as every other view in the dialog (backdrop tap, Escape), so the button was a second control doing the same thing.

## [2.1.1] — 2026-08-16

### Changed
- **Goal-creation dialog: the Type/target section now sits after Tags**, not right after the title — a small ordering tweak from using the 2.1.0 feature.
- Trimmed two redundant labels in that section: the "Type" heading (the pill group already carries an equivalent accessible name) and the "Times per week/month" heading (the selected pill and the hint sentence below both already say it — kept for screen readers only, not visually).
- The target hint sentence now sits on the same row as the stepper, right-aligned, instead of its own line below.

### Fixed
- **The target stepper's ± buttons and the "Every day" preset chip were sized below this app's minimum touch target** (28px, a size class reserved for minor controls like the copy button — not primary, frequently-tapped ones). Now 40px, caught during an `/a11y` pass.

## [2.1.0] — 2026-08-16

### Added
- **Frequency goals — weekly and monthly habit tracking, alongside the existing percentage goals.** When creating a new goal, a Type selector (Percentage / Weekly / Monthly) picks how it's tracked; Weekly/Monthly reveal a target stepper (1–7 times/week, 1–31 times/month), with "Every day" as a one-tap weekly preset (target = 7). Type is fixed once the goal is created — the selector is replaced by a plain locked label in the edit dialog, since switching a goal's whole tracking shape mid-stream is a bigger decision than this iteration takes on.
- **New row interaction for frequency goals: tap still opens the edit dialog everywhere (unchanged); hold (~0.5s) logs or un-logs *today* — a toggle, not the percentage row's continuous drag.** The row shows a read-only glance strip (last 5 closed periods + today) instead of the percentage row's hidden `%` label: weekly periods render as circles, monthly as soft squares — the only thing on the row that says which unit you're looking at. Logging plays a small tick (reused from the existing done-item treatment — an outline pulse + background wash); the row's full particle-burst celebration is unchanged and now also fires correctly for frequency goals when every period in the glance window is met (percentage value reaching exactly 100% already implies that, no separate detection needed). Arrow-key equivalents (goal row focused, Left/Right) log/un-log the same as holding, for keyboard users.
- **Fixing a missed or mis-logged day** lives in the edit dialog's "⋮" menu → "Fix a day…", tucked away rather than sitting open by default since it's an occasional correction, not a daily action. Opens as an overlay in front of the dialog (mirroring the existing move-to-year sub-view pattern) showing the last 14 days as toggle chips — tap a filled one to remove that day's entry, an empty one to back-fill it.
- Progress for weekly/monthly goals is a **linearly recency-weighted average over the last 6 periods** (current period weighted 6×, oldest tracked period 1×) — documented in `app/utils/tracking.js` and CLAUDE.md's data model section. Weeks are ISO weeks (Monday–Sunday).

### Changed
- **Internal: goal progress storage migrated from a flat `percentage: number` to a `tracking` union** (`{ type: 'percentage', value }` / `{ type: 'weekly'|'monthly', target, entries }`), converted automatically and losslessly for every existing goal on first launch after this update (`app/utils/migrate-goals.js`, via the store's `boot({ migrate })` hook). No visible change for existing percentage goals — same values, same behaviour, just read through `percentValue(goal)` everywhere instead of a raw field.

### Fixed
- **The version number shown in Settings could silently lose its build hash.** `bottom-nav.js` fetched `version.json` with a bare relative path instead of the app's `BASE_PATH`-prefixed one every other request in that file already used — worked by coincidence from the home route, 404'd silently (an existing `.catch` swallowed the error) from a two-segment-deep route like a list page.
- **The Years-tab urgency badge could keep flagging a fully-completed goal as overdue.** Caught while migrating goal storage to `tracking` (above): one read site outside the converted call sites was still checking the old flat `percentage` field, which no longer exists on any goal — a 100%-done goal past its due date stayed stuck showing as overdue in the badge, indefinitely.

## [2.0.0] — 2026-08-16

### Changed
- **Richer goal-completion celebration.** The confetti burst shown when a goal hits 100% now scatters more particles per burst (8 → 12 each) — same white/accent/accent-dark colours already in use, just a denser fan across the existing animation.

## [1.22.4] — 2026-08-12

### Fixed
- **Quick-add (Enter-to-add-next) for new list items could resurrect an already-used draft on the next entry.** The commit-on-blur handler assigned the new item its real id *before* clearing the pending localStorage draft, so the clear call targeted the wrong key and the real `new:<listId>` draft was never actually removed — it kept silently reappearing (pre-filling the form) on every subsequent quick-add entry in that list, even after being restored and saved once already. Reordered so the draft is cleared before the new id is assigned; goal-dialog and list-dialog's equivalent commit-on-blur handlers never had this ordering issue.

### Changed
- **Internal refactor, no user-facing change.** Consolidated the duplicated filter-bar shell (search/clear/expand/panel) across home, lists, and list detail, and the duplicated page-header shell (filter/menu buttons) across lists and list detail, into shared modules. Same events, same visuals — see `ComponentDuplicationReport.md`.

## [1.22.3] — 2026-08-12

### Fixed
- **Editing an existing item, goal, or list could silently lose its note, link, or notes field.** Root cause: the draft-recovery feature (meant to survive the app being killed/backgrounded mid-edit) restored a stale, unsaved draft straight into the open/edit form on reopening a record — including a draft where the note/URL had been accidentally cleared before the app was backgrounded. If you then edited any other field (e.g. just the due date) and closed, that stale blank content silently overwrote the real, already-saved value. Reopening an existing item/goal/list now always shows what's actually saved; a pending draft is only ever applied via an explicit tap on a clearly-highlighted "Restore draft" button in the footer, which can be tapped again to go back to the saved value — so you can compare before deciding. New, not-yet-created entries are unaffected — recovering an in-progress draft there is still automatic, since there's no saved value to protect.

## [1.22.1] — 2026-08-12

### Changed
- **Internal refactor, no user-facing change.** Consolidated duplicated tag-editing UI (goal/item dialogs) and the due-date filter row (home, lists, list detail) into shared components, and unified the deadline/due-date badge so goals and list items can't silently drift apart in behaviour. Same events, same visuals — see `ComponentDuplicationReport.md` for the full rationale.

## [1.22.0] — 2026-08-11

### Added
- **Lists can now be archived.** Open a list, tap the **⋮** menu, then flip the Active/Archived switch — the list drops out of the Lists overview immediately, but stays fully functional (items, colour, and status untouched; still a valid destination for moving, copying, or promoting items). Flip it back to Active to bring it back. A new **Archived** filter chip on the Lists overview reveals archived lists on demand (mirrors how archived goals already work), and a small dot marks an archived list once it's shown.

## [1.21.3] — 2026-08-11

### Fixed
- **`<modal-dialog>` instances carried a prohibited `aria-label`.** Lighthouse's accessibility audit flagged every menu/action-sheet/dialog in the app: the component correctly forwards its host's `aria-label` onto the internal `<dialog>` element (which has an implicit `dialog` role and legitimately supports a label), but left the same attribute sitting on the light-DOM host too — which has no ARIA role of its own, making a name-giving attribute there a spec violation, even though no screen reader user was actually affected (the real accessible name was always correctly present on the inner element). Fixed upstream in Socle 0.15.6→0.15.8 (`modules/modal-dialog/modal-dialog.js` now removes the attribute from the host after forwarding it) and pulled in via `npx socle update`.
- **Page was missing explicit `noindex` guidance for search engines.** Telos is a personal tool, not content meant to be discovered via search — added `<meta name="robots" content="noindex, nofollow">` to `index.html`. (A companion Lighthouse "robots.txt" finding turned out to be about `elforn.github.io`'s domain root, which this repo's deploy doesn't control — the meta tag is the actual fix, since it's per-page and covers every route through the single app shell.)

## [1.21.2] — 2026-08-11

### Fixed
- **LCP image (year header photo) missing `fetchpriority="high"`.** Lighthouse's "LCP request discovery" audit flagged this; the image's `src` is still only assigned after an async IndexedDB blob read (inherent to local-only photo storage, not fixable), but the static attribute still tells the browser to prioritize the fetch once that happens.
- **`version.json` fetched twice on every boot.** `sw-manager`'s update-detection fetch (load-bearing, stays as-is) and `bottom-nav`'s separate fetch — only used to display the buildHash string in Settings — both ran unconditionally at boot. The Settings-only fetch is now deferred to the first time Settings is actually opened, dropping it out of the critical path entirely for sessions that never open it.

## [1.21.1] — 2026-08-03

### Fixed
- **Share Target (both "Share to Telos" and the generic text/URL capture) never actually worked on a real device**, despite passing its automated tests. Root cause, found via on-device testing: `_lib/core/sw.js`'s `fetch` handler checked `mode === 'navigate'` before checking for a Share Target POST — but a real OS share-sheet invocation *is* a top-level navigation, so that branch always won first and silently served the cached app shell without ever reading the share's data. The existing tests never caught this because they POST via an in-page `fetch()` call, which is never `mode: 'navigate'`. Fixed upstream in Socle 0.15.6 (`core/sw.js` — Share Target check now runs first) and pulled in via `npx socle update`. Added a new e2e test (`tests/e2e/sync.spec.js`) that submits a real `<form>` — a genuine top-level navigation, unlike every existing `fetch()`-based test — as the regression guard for this exact bug class; verified it actually fails against the pre-fix ordering before confirming it passes against the fix.
- **404 page's "go to current year" button navigated to a broken URL.** `not-found-page.js` built the target as `` `${BASE_PATH}/${year}` `` — since `BASE_PATH` already carries a trailing slash, this produced a double slash (`/telos//2026`) that the router couldn't match, landing back on the 404 page. One-character fix; the unit test's `BASE_PATH` mock was `''` (no trailing slash), which accidentally canceled the bug out and let it ship — the mock now uses a realistic value (`/telos/`), and a new e2e test clicks the actual button end-to-end.

## [1.21.0] — 2026-08-01

### Added
- **Share text or a link from any app straight into a list.** Telos now appears as a Share Target destination for plain text and URLs shared from any other app on Android Chrome, not just other Telos installs — sharing a webpage, a note, or a block of text lands in a pre-filled, fully editable "Add from text" dialog (the same one used by the existing per-list menu action), then lets you pick which list — existing or new — to add the resulting item(s) to.
- The "Add from text" dialog itself moved from `list-detail-page` into a shared, reusable `<import-text-dialog>` component so both the per-list menu action and the new Share Target landing use the identical dialog.

## [1.20.0] — 2026-08-01

### Added
- **Share to another Telos install.** A new "Share to Telos" action on lists, items, bulk-selected items, goals, and years sends a re-importable copy to someone else's independent Telos install via the native share sheet (or a file download as a fallback) — a one-time handoff, not a sync; each side tracks progress independently from then on.
- **Receiving a share.** Telos now appears as a share target on Android Chrome for files shared from other apps, and still opens shared/imported files directly on desktop. A shared list or year merges straight in; a shared item, group of items, or goal lets you pick which list, or which year and section, to land it in.
- **Share Markdown**, the existing clipboard-copy export for years/lists/selections/items, now also offers the native share sheet where available.

## [1.19.1] — 2026-07-28

### Fixed
- Toggling **Deadline** (goal dialog) or **Due date** / **Link** (item dialog) from the "···" overflow menu now closes the menu — the real use case is turning a field on and going to fill it in, not flipping several toggles in one visit.
- The Lists overview's new "⋮" menu button now sits to the right of the filter icon, matching the order used on the Years and list-detail headers.
- The app-icon badge call (`setAppBadge`/`clearAppBadge`) now properly catches asynchronous rejections and logs them — previously a bare `try/catch` only caught a synchronous throw, so a rejected promise (permission denial, unsupported context, etc.) failed silently with no visible error.

## [1.19.0] — 2026-07-28

### Added
- **Hide the urgency roll-ups from the Lists overview.** A new "⋮" menu on the Lists page has a **Date indicators** Show/Hide toggle — turning it off mutes the coloured roll-up dot on every list card *and* the Lists tab badge in the bottom nav (shown by default). The calendar markers on individual items inside a list are unaffected either way.

## [1.18.0] — 2026-07-28

### Added
- **Filter lists by due date, too.** The Lists overview filter now has the same **Due** row (*Overdue · Week · Month · Later · None*) as the goals and item filters — a list matches if any of its items falls in the selected window(s), so you can jump straight to "which lists need attention this week."

## [1.17.0] — 2026-07-28

### Added
- **Filter by due date.** The goals filter (per year) and each list's filter now have a **Due** row — *Overdue · Week · Month · Later · None* — each with a colour dot matching the deadline markers. Tap any combination to narrow to what's due in that window; **None** finds entries that have no date set. The dated pills follow what you see (open/active entries only), so "Overdue" shows exactly the items wearing the red marker.

## [1.16.0] — 2026-07-28

### Added
- **Deadline & due-date urgency at a glance.** Goals with a deadline, and open/paused list items with a due date, now show a small calendar marker tinted by how soon they're due — grey (later), green (this month), amber (this week), red (today) — and **overdue** entries get a bold filled-red marker so they stand out. Completed, archived, done, and closed entries stay quiet.
- **See where attention is needed without opening anything.** Each list card, and the **Years** and **Lists** tabs in the bottom bar, show a coloured dot for their most-urgent item; when something is due today or overdue it turns red and shows a count. On a supported installed device, the app icon carries that count as a badge too.

### Changed
- Goal deadline markers show for the **current year** by default; for other years they stay hidden until you turn them on from the year menu (**Deadline markers**), the same way tag colours work.
- The **due date** field is now shown by default when adding or editing a list item (the goal *Deadline* and item *Link* fields stay tucked away in the "···" menu as before).

## [1.15.0] — 2026-07-25

### Added
- Bulk-tag your list items. In selection mode, tap the new **Tags** button to add or remove tags across every selected item at once. Tags shared by all selected items show as solid chips; tags on only some show dim — tap a dim one to apply it to the rest, or tap × to remove a tag from all. Changes save as you make them.

### Changed
- The list selection ribbon now shows **Delete · Tags · Status**, with **Move** relocated into the "···" overflow menu next to Extract Markdown.

## [1.14.1] — 2026-07-25

### Fixed
- Dismissing the item "···" overflow menu by tapping the backdrop now reopens the on-screen keyboard on the field you were editing, matching swipe-to-dismiss. Previously the keyboard stayed down after a backdrop tap.

## [1.14.0] — 2026-07-25

### Changed
- Item and goal dialogs reordered: status (items) sits right after the title as a full-width segmented control instead of a pill row further down the form; URL now sits directly under the note; due date/deadline now sits directly above tags — in both dialogs.
- The overflow ("···") menu now shows a divider between its toggle switches (Due date, Link, Deadline) and its plain actions (Move to list, Add to goal, Extract Markdown), so the two groups read as visually distinct.
- Tapping most buttons inside an open item/goal dialog (clear date, copy note, open link, remove tag, archive, etc.) no longer closes the on-screen keyboard on mobile if you were mid-edit elsewhere in the form. Close and Delete still close it, since those end the editing session.

### Fixed
- The tag input field no longer grows taller as tags are added — it now stays the same height as the title field regardless of tag count, with tags scrolling horizontally instead of wrapping.

## [1.13.1] — 2026-07-25

### Changed
- The Due date/Link/Deadline toggles in the "···" overflow menu now show a leading icon and a checkmark when active, so they read clearly as switches rather than one-off actions.
- Footer button padding (Save, Close, Delete, etc.) is now narrower, matching the visual weight of the rest of the dialog.

### Fixed
- The Due date (items) and Deadline (goals) fields are now exactly the same height as the title field — the native date picker no longer stretched the row taller.

## [1.13.0] — 2026-07-25

### Changed
- Due date (items) and Link (items) and Deadline (goals) are now toggled on from the "···" menu instead of pills in the main form — the field appears full width, matching the title field, once turned on. The menu is now reachable while creating a brand-new item or goal, not just after the first save.

### Fixed
- Dialogs (Settings, item/goal editors, action sheets, etc.) no longer pop open on app launch or fail to close — a service-worker-library update briefly broke the underlying `<dialog>` visibility toggle.

## [1.12.0] — 2026-07-24

### Added
- Due dates on list items — set one from the item dialog (behind a collapsed "Due date" toggle, next to the existing Link toggle); overdue items show a small red calendar icon
- Deadlines on goals — same toggle pattern in the goal dialog, labeled "Deadline"; overdue goals (not archived, not yet 100%) show the same icon

### Changed
- Promoting a list item to a goal now carries its tags and due date onto the new goal, instead of dropping them (`tags: []` was previously hardcoded); creating a list item from a goal now carries the goal's tags and deadline the same way
- Goal deadlines are included in the Markdown export, the same way item due dates already were

### Fixed
- Deleting a list no longer leaves its saved filter behind in local storage

## [1.11.0] — 2026-07-24

### Added
- Two shortcuts on the install icon — "Lists" and "This year" (long-press on Android, right-click on desktop)

### Changed
- Typography (Onest) is now bundled with the app instead of loaded from Google Fonts — identical look, but the app now works fully offline with zero external requests, and skips two extra network round-trips on first load
- The install icon now has a dedicated maskable variant, so Android launchers that crop icons into a circle or squircle mask it correctly instead of reusing the regular icon
- The install splash screen background now matches the app's surface color instead of flashing accent blue before the real UI appears

### Fixed
- Automatic recovery from a stuck update (poisoned service-worker cache) now always backs up your data first, the same guarantee the manual "Repair installation" button in Settings already had — previously only the manual path was guaranteed to back up before clearing caches

## [1.10.6] — 2026-07-23

### Added
- A Clear/Revert ⇄ Undo toggle button on item, goal, and list dialogs, and the import-from-text sheet — restoring a draft now shows a way to discard it (or put it back) without retyping

### Fixed
- Drafts for new items, goals, and import-from-text no longer overwrite each other across different lists or years — each draft is now stored under its own key instead of a single shared one, so switching context (e.g. moving from a 2026 goal draft to a 2027 one) no longer silently erases the other
- Draft-recovery snapshots no longer expire after 72h — a draft is kept until it's explicitly cleared or committed
- Tapping the Clear/Revert/Undo button no longer dismisses the on-screen keyboard on mobile

### Changed
- The year header's menu and the export sheet now use the shared bottom-sheet component, closing the last gap in the modal-dialog migration
- Modal padding is consistent across the remaining dialogs (20px on both axes)

## [1.10.5] — 2026-07-22

### Added
- Import-from-text now keeps an unsaved draft per list — dismissing the dialog (Cancel, backdrop, swipe-down, or the app getting backgrounded mid-paste) preserves your typed text, restored the next time you reopen that list's import box

### Changed
- The item and goal "more actions" menus, and the list import-from-text dialog, now use the shared bottom-sheet component — closes the gap noted in 1.10.4; swipe-down-to-dismiss works there too now
- Modal padding is consistent across the app (20px on both axes) instead of varying per dialog
- Draft-recovery snapshots (new item/goal/list entries, and now import-from-text) are kept for 72h instead of 24h

### Fixed
- A CSS cascade bug left extra horizontal padding on the "more actions" menu buttons after the padding cleanup
- The Settings/Import dialog heading no longer carries an unintended top margin from the browser's default heading style, stacking on top of the sheet handle

---

## [1.10.4] — 2026-07-19

### Added
- Swipe down on a bottom-sheet dialog's handle to dismiss it — your content is saved on the way out, same as any other close. The handle is a full-width grab strip at the top of the sheet so it's easy to catch. (Socle 0.13.1)

### Fixed
- Swiping a dialog no longer risks triggering the browser's pull-to-refresh; the gesture is contained to the sheet, and pull-to-refresh on the main page is unaffected

### Note
- The raw menu / bulk-status / import sheets don't yet have the swipe handle — that arrives when they move onto the shared sheet component (planned)

---

## [1.10.3] — 2026-07-18

### Added
- In-progress edits to an **existing** goal, list, or item now also survive a reload, tab switch, or app backgrounding — if you're mid-edit when the page is hidden, reopening that same entry restores your unsaved change. Snapshots are keyed per entry, so one entry's pending edit never leaks into another's
- Closing a new entry that has content but **no title yet** (just a note, tag, or colour) no longer discards it — it's kept and restored next time you open that dialog, until you either give it a title or clear it

### Changed
- Once you close an edited entry, it's committed as before and its recovery snapshot is dropped; the snapshot only exists to recover an entry that was still open when the page was interrupted

## [1.10.2] — 2026-07-18

### Added
- In-progress input in a new goal/list/item dialog now survives a reload, tab switch, or app backgrounding. When the page is hidden with an unsaved new entry, its content is snapshotted and restored the next time you open that dialog — including entries that have only a note, tag, or colour but no title yet. Editing an existing entry commits the focused field on the way out, as before. Nothing is written while you type; the snapshot happens only at the moment the page is hidden

---

## [1.10.1] — 2026-07-18

### Removed
- The "resume unsaved text after a crash or accidental close" draft-recovery feature on new goal/list/item dialogs (`localStorage`-backed, per-keystroke). In every normal path — Enter, the close button, a backdrop tap, or (for items) blurring the title field — the typed content is already saved as the real goal/list/item before the draft would ever matter; the only scenario it protected against was a hard page reload while the dialog was still open, which is being addressed separately

### Fixed
- Removed dead per-dialog listeners that existed solely to write the draft on every keystroke

---

## [1.10.0] — 2026-07-17

### Changed
- Socle updated to 0.12.0 (adds the `reorder` module and a toast rendering fix)
- Drag-to-reorder on goals, lists, and list items now runs on the shared Socle `Reorder` module instead of three hand-rolled copies — same ghost clone, insert line, edge auto-scroll, and keyboard reorder behavior
- Toasts now render above any open dialog (a manual popover), fixing Undo/action buttons being unclickable behind a sheet, and toasts appearing hidden behind a dialog opened right after

### Fixed
- Deleting a list, item, or goal during a rapid create-then-open-next-dialog sequence could show the confirmation toast behind the newly opened sheet, making it invisible until the sheet closed

---

## [1.9.7] — 2026-07-17

### Added
- Creating a goal, list item, or list that an active filter immediately hides now shows an info toast — "…added — hidden by the current filter" — with a **Show** action that clears the filter and scrolls the new entry into view (en, fr, ca)

---

## [1.9.6] — 2026-07-16

### Changed
- Socle updated to 0.11.0
- The three list renderers (goals, lists, list items) now use the library's `syncChildren` reconciliation helper — behaviour unchanged, ~40 lines of duplicated code removed
- Lists page pilots the library's auto-cleanup `listen()`/`watch()` helpers — its manual listener teardown shrinks to only the mid-drag case

---

## [1.9.5] — 2026-07-16

### Added
- Deep links now load the app on GitHub Pages — visiting a URL like `/lists/…` directly (first visit, or after a repair) no longer shows GitHub's 404 page
- The version line in settings now shows the build hash (e.g. "Version 1.9.5 (4efb0fa4)")

### Changed
- Deploys are now gated on the full test suite — a push with failing tests never reaches the live app
- Releases are tagged (`v1.9.5`, …) from now on
- Unit test suite runs roughly twice as fast (shared test workers)

---

## [1.9.4] — 2026-07-16

### Changed
- Deleting a list now names it in the undo toast — "“Groceries” deleted" instead of "List deleted" (en, fr, ca)
- Goals created by promoting a list item now store progress in the same shape as every other goal; a one-time migration cleans up previously promoted goals (no visible change — they keep showing 0% until you set progress)

### Fixed
- CLAUDE.md data model documentation matched a planned design rather than the code — it now describes the actual goal shape, the `closed` item status, list `showStatus`, the tag-visibility store keys, and the fact that theme and locale live in localStorage by design

---

## [1.9.3] — 2026-07-01

### Added
- Archive / Unarchive goals — a button in the goal edit dialog immediately archives or unarchives a goal without closing the dialog; the keyboard stays open on mobile while toggling
- Archived goals are hidden by default and revealed by the new "Archived" filter pill on the Goals page
- A subtle dot appears on archived goal items when the Archived filter is active, so you can see their archived state at a glance
- Duplicate goals — selecting the same year and section in the goal move picker copies the goal in place; Move is disabled for same-destination to make the intent clear
- Duplicate list items — selecting the current list in the item or bulk move picker copies the item(s) in place; Move is disabled when the source list is selected
- Filter carry-over from Lists page — tapping a list while a search is active passes the query to the list detail page, so only matching items are shown on arrival
- Text filter on Goals and List items now matches tags in addition to title and notes — searching for a tag name surfaces all items that carry it

### Fixed
- Swiping on the status badge no longer triggers a status change — a swipe slides the row as intended; tapping the badge still cycles the status
- The current list was not appearing in the item move / copy picker — it is now included so same-list duplication works

---

## [1.9.2] — 2026-06-30

### Changed
- Drag handles (⠿) on goals, list items, and lists are tighter — 2 px trailing padding and a 5 px leading pull-in so the handle sits closer to the row edge without affecting touch target size

### Fixed
- Deleting a list item via the edit dialog showed a competing "Item saved" undo toast alongside the "Item deleted" toast — only the delete toast now appears

---

## [1.9.1] — 2026-06-28

### Added
- "Empty" and "Not empty" filter pills on the Lists page — quickly show only lists with no items, or only lists that have at least one item
- "More filters" expand button label for the filter panel on the Lists page (i18n: en, ca, fr)
- Filter result count announced to screen readers via a live region on all three filter pages (Lists, Goals, List items) — e.g. "3 lists match"
- `aria-controls` attribute on filter expand buttons links them to their panel for better assistive-technology support (all three filter pages)

### Changed
- Tapping anywhere on a tag chip in the goal or item edit dialog now removes the tag — previously only the × button was the target
- Filter panel now stays open when the filter bar is reopened if an active pill filter was set — Goals and List items pages now match the existing Lists page behaviour
- Clearing filters no longer collapses the expanded filter panel — clear resets filter values only; the panel stays where you left it

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
