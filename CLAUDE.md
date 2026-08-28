# Telos

A yearly goal planner

Scaffolded from Socle 0.2.5 on 2026-06-06. Now on 0.15.7.
Installed modules: core, gestures, sync, images, app-header, modal-dialog, toast, reorder, filter-state

---

## About this app

### Purpose
Telos is a personal yearly goal planner that helps individuals set and track a capstone goal, 3-month milestones, and 8-week wow moments per year. It also includes a trans-year lists system for capturing ideas, tasks, and other items that can be linked to goals.

### Context of use
Used for year-start planning sessions and periodic (weekly or monthly) check-ins. Primarily a phone app (95% of use); tablet and desktop are secondary. The app is local-only with no accounts or cloud sync.

### Users
- **Personal user** — the sole user of the app; plans their year, tracks progress, manages lists. No multi-user features.

### Key flows
1. **Set a capstone goal** — enter the one headline goal for the year, visible at a glance from the home screen.
2. **Add milestones and wow moments** — fill the three 3-month milestone and three 8-week wow moment slots for the year.
3. **Update goal progress** — hold-drag the progress bar on any goal item, or use arrow keys. A goal can also be marked as failed.
4. **Navigate between years** — swipe the year header or tap prev/next to review past or future years; each year is independent.
5. **Upload a year photo** — a photo displays as the header background and acts as a visual anchor for the year.
6. **Create and manage lists** — create trans-year lists (ideas, improvements, gift ideas, identity anchors, etc.), add items, filter by status or tag.
7. **Promote a list item to a goal** — link a list item into any year + section; the item stays in the list with `inGoals` updated. A single item can feed goals in multiple years. Progress is **not** synced — each side tracks independently.
8. **Share a list, item, goal, or year with another person's Telos install** — "Share to Telos" sends a re-importable handoff via the native share sheet (Android Chrome) or a file download (fallback, and always on Firefox); "Share Markdown" sends human-readable, one-way text. See **Sharing** below.

### Data model
All state lives in a **simple store** (setState/getState — no event log, no reducer). Top-level keys:

- **`goals`** — `{ [year]: { capstone: Goal[], milestones: Goal[], wow: Goal[], focus: Goal[] } }`. Each `Goal` has a fixed schema:
  ```
  { id, title, notes?, tags: string[], archived?: boolean, tracking: Tracking, dueDate?: string, color?: string }
  ```
  The field is `notes`, never `description` (renamed in 1.8.0). `archived` goals are hidden unless the Archived filter pill is active. `dueDate` (added 1.11.0) is an optional ISO date string (`YYYY-MM-DD`, from a native `<input type="date">`) shown as "Deadline" in the UI, editable via a compact icon-only `#duedate-chip` button that lives in the `goal-dialog` footer (`.actions-end`, immediately left of Close — kept off the Delete side of the footer so a mis-tap can't land on a destructive action) — collapsed by default, shown open only if the goal already has a dueDate. Tapping it reveals the date field inline with a brief highlight flash and an auto-scroll bringing it to the centre of the modal's internal scroll region (`_flashField`, timed to run only after the card's own height-resync so it doesn't scroll to a since-shifted position). The scroll itself goes through `_scrollWithinModalBody(el)`, which computes and sets `modal-dialog`'s own `.body.scrollTop` directly — **never** `el.scrollIntoView()`: that walks every scrollable ancestor, including `modal-dialog`'s own `<dialog>` element (`overflow: hidden` — no scrollbar, never user-scrollable, but still a valid scroll container per spec), silently nudging its `scrollTop` too. That offset has no way to reset itself, so it accumulates across every reveal/hide, progressively shifting the whole card upward until the drag handle is pushed off-screen above the visible card — confirmed via `dialog.scrollTop` climbing on repeated reveals in both on-device and desktop testing, and fixed once (2.5.2) in each of `goal-dialog.js`/`item-dialog.js` — deliberately does **not** move keyboard focus onto the revealed date input: a native date control isn't a text field, so focusing it would swap away whatever on-screen keyboard was up for the field actually being edited (e.g. notes) instead of just leaving it be. Tapping the chip again to *hide* the field instead flashes the notes field (`.textarea-wrap`) — collapsing it shifts the layout the same way revealing it did, so the same "here's what moved" cue applies in reverse. It surfaces as a **graduated urgency indicator** (added 1.16.0) — the `goal-item` calendar glyph is tinted by how soon the deadline is (grey `far` >30d → green `month` ≤30d → yellow `week` ≤7d → red `today`; `overdue` is its own state — a **filled solid-red calendar chip** (white glyph) so it out-weights plain red today). Shown only for active goals (`percentValue(goal) < 100 && !archived`). The bucket logic is centralised in `app/utils/urgency.js` (`urgencyOf`, `mostUrgent`, `urgentCount`) — never re-derive it inline. Goal deadline markers are **year-aware**: shown by default only for the current year; other years are toggled via the year-header menu (see `goalsDeadlinesVisible`). No filter pill.

  `color` (optional hex string, added 2.5.0) is purely decorative/organisational — no functional meaning, mirroring `List.color` (see below). Rendered as a 3px `border-inline-start` accent stripe on `goal-item`'s bar (CSS var `--goal-item-color`, `transparent` when absent). Editable two ways, both shared with lists and list items via `app/utils/color-palette.js` (`COLOR_PALETTE`, `swatches()`, `nextColor()` — the single source of truth every swipe-cycle and swatch picker in the app reads from; `swatches()` pairs each palette colour with its `t()`-resolved label fresh on every call — never cache the result, and never hardcode label strings alongside the palette): **swipe right** on the row cycles to the next palette colour (`goal-color-cycle` event → `home-page.js`'s per-section `_cycleGoalColor`, mirroring `lists-page.js`'s `_onListColorCycle` exactly — a *momentary* reveal that always snaps back, never a persisted swipe state like the delete panel's left-swipe), or **tap a swatch** in `goal-dialog`'s always-visible `.color-swatches` row (mirrors `list-dialog` exactly; commits immediately via `goal-color-changed` for an existing goal, carried in `goal-created`'s detail for a new one). Cycling back past the last palette colour removes the `color` key entirely (`{...rest, color} : rest`) rather than storing `color: null` — never store `null` for "no colour", always omit the key.

  **`tracking`** — the canonical progress shape (`app/utils/tracking.js`; migrated from the legacy flat `percentage: number` by `app/utils/migrate-goals.js`, wired through `boot({ migrate })` in `app/main.js` — see Migrations below). **Not a strict discriminated union** — `type: 'percentage' | 'weekly' | 'monthly'` is a pure discriminant, and `value`/`target`/`entries` are all optional fields that may or may not be present, independent of `type`:
  - `value: number` — 0–100, read when `type === 'percentage'`.
  - `target: number` — times/week (1–7) or times/month (1–31) depending on `type`, read when `type` is `weekly`/`monthly`. "Every day" is a UI preset for `target = 7` on a weekly goal, **not** its own type.
  - `entries: string[]` — unique ISO date strings (`YYYY-MM-DD`), one per calendar day max, past dates allowed; read when `type` is `weekly`/`monthly`.

  Switching `type` never deletes the inactive field(s) — a goal that's been both a percentage and a habit at different points keeps both `value` and `entries` around, so switching back recovers exactly what was there before (see **Type/target mutability** below). Every field is still genuinely optional, though: a goal migrated straight from the legacy flat format may have only `{ type: 'percentage', value }` forever, until the first time it's ever switched to weekly/monthly — nothing requires the other fields to exist, and every accessor treats them as possibly absent (`?? 0`, `?? []`, `?? DEFAULT_TARGET.weekly`), never as guaranteed.

  Nothing outside `app/utils/tracking.js` reads `.tracking` directly — every consumer goes through its accessors: `percentValue(goal, todayIso?)` (0–100 display value, works identically for all three types — `todayIso` is an optional override for deterministic tests, defaults to real today), `setPercent(goal, pct)` (percentage-type mutation), `logEntry`/`unlogEntry`/`isLoggedOn(goal, iso?)` (frequency-type mutation/read, `iso` defaults to today), `isFrequency(goal)`, and `recentDots(goal, todayIso?)` (UI-facing per-period classification, see below). For weekly/monthly: per-period success = `min(entries_in_period / target, 1)`; the displayed percentage is a **linearly recency-weighted average over the last `PERIOD_WINDOW[type]` periods** — the current (possibly still-open) period is weighted `PERIOD_WINDOW[type]`×, the oldest tracked period 1×, `weightSum` in between. `PERIOD_WINDOW` is `{ weekly: 6, monthly: 4 }` — split by type on purpose, not a single shared number: a "period" is such a different wall-clock span per type (6 weeks ≈ 1.5 months vs 4 months) that a shared count would mean a flawless brand-new monthly goal can't reach 100% for many months (every period before the goal existed counts as missed in the denominator). Weeks are **ISO weeks (Mon–Sun)** (`isoWeekKey`, standard nearest-Thursday algorithm — correctly buckets year-boundary weeks to whichever calendar year contains that week's Thursday). The `goal-item` row's glance strip is driven by `recentDots`, but deliberately does **not** mirror `PERIOD_WINDOW[type]` 1:1 — it reads `DOT_WINDOW` (`{ weekly: 6, monthly: 6 }`) instead, which for monthly goals is wider than the 4-period scored window: more history shown than actually counts, since seeing further back doesn't change the score, it just gives more context. `recentDots` also trims the *display* down further, front-only: it drops leading `missed` periods up to (not including) the first period with any progress, or — if the whole window is empty — collapses to just the current period alone, so a long losing streak doesn't visually anchor the row and a fresh restart reads as a fresh restart. Both of these are display-only; `percentValue`/`weightedAverage` (the score) always read the full, untrimmed `PERIOD_WINDOW`, a completely separate call. Target limits (`TARGET_LIMITS`, `{ weekly: [1,7], monthly: [1,31] }`) are exported from the same module so `goal-dialog`'s stepper never hardcodes them separately. The today-token dot (`.freq-today`) additionally renders the goal's raw `tracking.target` as a small numeral (`.freq-target-num`) — a static per-goal number, not a count, so it needs no trigger beyond a normal re-render. Its colour is `mix-blend-mode: difference` against a fixed white, not a state-keyed colour swap: the dot's fill is a conic-gradient split between `--color-accent` and `--color-border` for the `partial` state (the split point moves with the fraction, so any fixed colour picked for "mostly accent" goes invisible once the wedge is mostly border, and `--color-accent` itself is a user-customisable per-year hex with no guaranteed lightness) — difference-blending resolves a contrasting colour per-pixel regardless.

  **Type/target mutability.** Type and target stay editable for the life of the goal — new or existing, any direction, including percentage↔frequency. Switching never destroys data: `_commitTrackingChange` in `goal-dialog.js` builds the new tracking object by carrying `value` and `entries` through untouched (`this._goal?.tracking?.value ?? 0`, `?.entries ?? []`) regardless of which type is becoming active, so switching away and back recovers exactly what was there. Only `target` resets to the new type's default on a switch *into* weekly/monthly — weekly's and monthly's scales differ enough (1–7 vs 1–31) that carrying over a stale number wouldn't be meaningful, and this was true even before percentage↔frequency switching existed. Edits on an existing goal commit immediately via a `goal-tracking-changed` event (mirroring `goal-tags-changed` etc.), not via the new-goal draft-then-blur-commit flow. "Fix a day" (inline in the dialog, offered only while the goal is *currently* frequency, re-evaluated live on every type switch — see the type/target section below for how the two share one summary row) is sized to match: `FIX_DAY_SPAN` (`{ weekly: 42, monthly: 120 }`, i.e. `7×`/`30×` `PERIOD_WINDOW[type]`) is exactly how far back a backfilled entry can still move the displayed score — past that, scrolling further wouldn't do anything. Past ~2-3 weeks the day-chip strip inserts a plain (non-interactive) month-label divider so a multi-month scroll doesn't lose its place, and opens scrolled to today rather than the oldest day.

  **Type/target: full picker for a new goal, zero footprint on the main view for an existing one — its value lives only on the "Change type" menu item.** Picking a type is the point of creating a goal, so a fresh draft always shows the full interactive pill group + target stepper immediately. Once a goal exists, it's a seldom-touched setting, and the main view shows nothing for it at all — no readout row, no label. `#action-change-type-btn` in the ⋮ menu carries the current value as trailing, right-aligned, muted text (`#change-type-value`, e.g. "5×/week" or "Percentage" — a `.sheet-item-value`/`.sheet-item-value-text` pattern: label start-aligned, value `flex:1; text-align:end`, same idiom any future "settings row" menu item should reuse). Tapping the menu item closes the sheet and reveals the same pill group inline in the dialog, in the menu-value's place — reveal-once, no re-collapse control — unlike the due-date field's icon toggle in the same file's footer, which *is* a real toggle (tap again to re-hide). `_renderTypeSection()` keeps `#change-type-value` updated on every render regardless of expand state, since it's the only place the value is ever shown.

  **Fix-a-day: an independent, real expand/collapse toggle**, not coupled to type/target at all (an earlier iteration had the two sharing one summary row with mutual exclusion — dropped once type/target moved behind the menu instead of staying inline, since there was nothing left to coordinate with). `#fixday-summary` stays visible in both states — its chevron flips 180° via `[aria-expanded="true"]` to signal which way tapping it goes — unlike type/target's trigger, which disappears once revealed. `_renderFixDaySummary()` derives applicability from `_draftType`, not `this._goal.tracking.type` — callers set `_draftType` and call `_renderTypeSection()` (which calls this) *before* `_commitTrackingChange()` updates `this._goal`, so reading the goal directly would see the stale, pre-switch type. No heading text above the chip strip (removed as redundant with the trigger's own label and the strip's own month dividers).

- **`images`** — `{ [year]: blobId }`. Blobs stored via `attachBlob`/`getBlob`.
- **`lists`** — `List[]` where each `List` is `{ id, name, color?: string, showStatus?: boolean, archived?: boolean, items: ListItem[] }`. Lists are **trans-year** — never scoped to a specific year. `color` is an optional hex string for visual differentiation. `showStatus` (default `true`) controls whether item status badges are shown in the list detail view. `archived` (added 1.22.0) mirrors `goal.archived`: absent/`false` is active, `true` hides the list from the Lists overview by default, reshown only via the "Archived" filter pill (`lists-page.js`). The Lists overview's three state pills — **Empty**, **Not empty**, **Archived** — are **additive** (a `Set`, OR logic), exactly like the goal-state pills on `home-page.js`: archived lists are governed solely by the Archived pill (shown only when it's selected, regardless of Empty/Not empty — an archived empty list does **not** match a lone "Empty" filter); non-archived lists are OR-filtered by Empty/Not-empty when either is selected, ignoring the Archived pill entirely. Never make these mutually exclusive again — see `_listMatchesFilter` in `lists-page.js` for the exact structure to mirror. Archiving is toggled from the list-detail page's "⋮" menu (`list-detail-page.js`) via an **Active/Archived segmented switch** (`#archive-active-btn` / `#archive-archived-btn`, the same `.status-pill-group` widget already used for the Status and Tag-colour toggles in that menu) — deliberately **not** in `list-dialog.js`, which stays focused on identity fields (name/colour) plus Delete. Clicking the non-active pill flips `lists[].archived` via `setState` and closes the menu; clicking the already-active pill is a no-op. Archived lists stay fully functional — still valid move/copy/promote destinations in `list-picker-dialog` — only the overview listing is affected.
- **`ListItem`** — fixed schema (no progress tracking — only goals are tracked):
  ```
  { id, title, note?, url?, dueDate?, status: 'open' | 'paused' | 'done' | 'closed', tags: string[], color?: string, inGoals: Array<{ year: string, section: string, goalId: string }> }
  ```
  - `closed` means dropped/abandoned: closed items are hidden by default and appear only when the Closed filter pill is active (see `_applyFilter` in `list-detail-page.js`).
  - `inGoals` is an empty array when not linked; each entry records where the item was promoted. A single item can be promoted into goals across multiple years/sections.
  - Progress is **not** synced between list items and goal copies — each goal tracks independently.
  - `dueDate` (functional since 1.11.0) is an optional ISO date string (`YYYY-MM-DD`); it surfaces as the same graduated urgency indicator as goals (tinted `list-item` calendar via `app/utils/urgency.js`), active only when `status` isn't `done` or `closed`. Both "Due date" and "URL" are editable via compact icon-only `#duedate-chip`/`#url-chip` buttons that live in the `item-dialog` footer (`.actions-end`, immediately left of Close — kept off the Delete side so a mis-tap can't land on a destructive action) — collapsed by default, shown open only if the item already has a value. This is a deliberate compaction (2.5.0) from an earlier full-width text-label chip row in the tags row, itself a replacement for the original overflow-menu toggles — each iteration traded vertical footprint for discoverability, landing here. Tapping a chip to reveal its field scrolls it to the centre of the modal's internal scroll region and flashes a highlight ring (`_flashField`), timed to run only after the note textarea's own height-resync so it doesn't scroll to a since-shifted position. As in `goal-dialog.js`, the scroll goes through `_scrollWithinModalBody(el)` (setting `.body.scrollTop` directly) rather than `el.scrollIntoView()` — see the note on that method above; item-dialog is where the resulting bug (drag handle pushed off-screen after revealing two fields in sequence) was originally diagnosed. The URL field also moves keyboard focus onto itself on reveal (it's a real text field, so the on-screen keyboard just retargets); the due-date field deliberately does **not** — a native date control isn't a text field, so focusing it would swap away whatever keyboard was up for the field actually being edited. Tapping a chip again to *hide* the due-date field flashes the note field (`.textarea-wrap`) the same way, since collapsing it shifts the layout the same way revealing did. **Hiding the URL field is different**: instead of a flash, it synchronously focuses the note textarea (`this._noteInput.focus()`), in the same click, *before* `_showUrlField` runs — not deferred to the rAF like the flash path. Hiding a focused url-input blurs it and closes the on-screen keyboard; focusing notes directly instead keeps the keyboard open (just retargeted) and lets the browser's own native focus-into-view handling scroll it above the keyboard — `.textarea-wrap`'s existing `:focus-within` border-color rule doubles as the highlight, no separate ring needed. This asymmetry (URL focuses on hide, due-date doesn't) exists because only URL ever took focus in the first place. Promoting an item to a goal, or creating an item from a goal, carries `tags`, `dueDate`, and `color` across (see `_onItemPromote` in `list-detail-page.js`, `_onGoalCreateItem` in `home-page.js`) — same one-way copy, no ongoing sync, as everything else in the promote/create-item flow.
  - `color` (optional hex string, added 2.5.0) — identical mechanics to `Goal.color` above: a 3px accent stripe (`--item-color` CSS var on `list-item`'s `.row`), swipe-right-to-cycle (`item-color-cycle` → `list-detail-page.js`'s `_onItemColorCycle`), or a swatch tap in `item-dialog`'s `.color-swatches` row (`item-color-changed` for an existing item, carried in `item-created`/`item-move`/`item-promote` for new/moved/promoted ones). **Taking over the right-swipe gesture is why item-level swipe-to-done was removed** — marking an item done now goes exclusively through the status badge (tap-to-cycle `open → done → paused → closed → open`, unchanged) or the dialog's status pills; swipe is colour-only for items now, matching lists and goals.
- **`accentColors`** — `{ [year]: string }`. Hex colour per year. On year change, writes to `--color-accent` on `:root` (or resets to the default `#5BADE0`).
- **`goalsTagsVisible`** — `{ [year]: boolean }`. Whether tag chips are shown on goal items for that year.
- **`goalsDeadlinesVisible`** — `{ [year]: boolean }`. Whether deadline urgency markers are shown on goal items for that year. Absent key defaults to **on for the current year, off otherwise** (resolved in `year-header.js`, which drives a `--goal-deadline-display` CSS var). Toggled from the year-header menu, mirroring `goalsTagsVisible`.
- **`listsTagsVisible`** — `{ [listId]: boolean }`. Whether tag chips are shown on items of that list.
- **`listsRollupVisible`** — plain `boolean` (default `true` when absent), **not** per-list or per-year — a single global preference. Whether the urgency roll-up (dot + count) shows on `lists-page-item` cards and the bottom-nav Lists tab badge; toggled from a "⋮" menu on the Lists overview page (`lists-page.js`). Does **not** affect the per-item due-date calendar markers inside a list (those always show). `lists-page-item` receives this as a `rollupVisible` property from the page — it stays a pure UI component with zero store knowledge; `bottom-nav.js` reads the key directly since it already talks to the store elsewhere.
- **`reflections`** — **planned, not implemented** (merge-strategy already handles the key). Will be `{ [year]: { annual?, Q1?, Q2?, Q3?, Q4? } }`, each entry `{ note: string, stars: number }` (1–5 stars).

**Not store keys:** `theme` (`'light' | 'dark' | 'system'`) and locale live in **localStorage by design** (`_lib/core/theme/theme.js`, `_lib/core/strings.js`) — device-local preferences deliberately excluded from export/import. Never move them into the store.

### Sharing
Two outbound actions send content out of the app, for different purposes — don't conflate them:

- **"Share to Telos"** (list ⋮ menu, bulk-select ⋮ menu, item/goal action sheets, year menu) — hands a single list, item, group of bulk-selected items, goal, or year to **another person's own independent Telos install**; a one-time transport, not sync — no ongoing link back to the sender, each side tracks independently from then on. Builds `{ __telosHandoff: true, kind: 'list'|'item'|'items'|'goal'|'year', lists/item/items/goal/goals }` (`app/utils/handoff.js`), wraps it in the envelope Socle's sync module already reads (`{ socleVersion, exportedAt, events: [{ type: 'simple:state', payload }] }`), and shares it as a **plain-text `.txt`** file via `navigator.share({files})` — never ZIP. Falls back to a plain-text download when share is unavailable or fails for a real reason (a user-cancelled share does nothing, no fallback). `kind: 'items'` (a bulk selection from a list) is a separate payload shape from `kind: 'item'` — always an array — rather than making `item` polymorphic, so the single-item payload contract stays unchanged.
- **"Share Markdown"** (year/list/selection/item export-sheet, goal action sheet) — human-readable markdown via `navigator.share({title, text})`, falls back to clipboard copy. One-way, not re-importable — no `__telosHandoff` marker, just prose (`app/utils/share-markdown.js`).

**Why plain text, not ZIP, for "Share to Telos."** Confirmed via Chromium source (`chrome/browser/webshare/share_service_impl.cc`, `IsDangerousFilename`/`IsDangerousMimeType`): `navigator.share({files})` validates every shared file's extension *and* MIME type against a hardcoded allowlist covering only images, audio, video, PDF, and plain text/csv/html/css — **archives are excluded outright, under any MIME label, permanently.** `canShare()` doesn't run this deeper check (always optimistically returns `true`); `share()` itself does, rejecting with `NotAllowedError: Permission denied`. Never attempt to ZIP a payload meant for `navigator.share({files})` — relabeling the MIME type doesn't help, the check is real and unconditional.

**Receiving.** `previewImport()` already reads the handoff envelope through its pre-existing (pre-ZIP) legacy-JSON path, so no bespoke parser was needed — the plain-text format was chosen specifically so this stayed true. `mergeStrategy` ignores `__telosHandoff`/`kind`, reading only `lists`/`goals`, so the marker is safe to leave in the payload. Inbound routing lives in `bottom-nav.js`: `kind: 'list'|'year'` merges straight in with **Replace hidden** (merging a slice must never expose the destructive full-replace option — `mergeStrategy` already handles partial payloads defensively, but `applyReplace` would still wipe every other list/goal); `kind: 'item'|'items'` both show `<list-picker-dialog>` for destination (routed to the same landing, just with a one- vs many-item array); `kind: 'goal'` shows a year+section picker. Two reception paths, both registered in `manifest.json`:
- **`share_target`** — Chromium-only, requires the PWA installed, accepts `text/plain`/`.txt` files (not `.telos`/ZIP — full backups can't arrive this way) plus `title`/`text`/`url` form fields for content shared from *any* app (browser share sheet, notes apps, etc.), not just other Telos installs. `app/main.js` reads Socle's `readShareInbox()` once on boot: a share with `files` dispatches the same `telos-import-file` event the file-open path already fires (zero bespoke routing code); a share with no files but `title`/`text`/`url` present is folded into one string by `app/utils/combine-shared-text.js` and dispatched as `telos-share-text`, landing in `bottom-nav.js`'s list-independent `<import-text-dialog>` (see below).
- **`file_handlers`** (`.telos` + `.txt`) — **does not work on Android at all, ever** (File Handling API is desktop-only per Chrome's own documentation, not a bug or a caching issue). Works on desktop Chrome/Chromium only. `share_target` is the real phone-side reception mechanism — don't assume tap-to-open reaches phone users, the app's primary platform.

**Generic text/URL capture** (Share Target's `title`/`text`/`url` fields, no file — e.g. sharing a webpage or a note from another app). Always lands in lists, never goals (goals are slot-limited and year/section-scoped, the opposite of a quick-capture inbox). `combineSharedText({title, text, url})` folds the three fields into one string with **no attempt to detect single- vs multi-item text** — a deliberate simplification, not a missing feature: title (if present) becomes the one unindented line, `text`/`url` (if present) fold in indented beneath it so `parseImportText` attaches them to that single item's note rather than starting new items; if `title` is absent, `text` (or failing that `url`) is used as-is, preserving its own multi-item line-splitting. This means a multi-line `text` shared *alongside* a `title` becomes one item with a multi-line note (title swallows every line), not N separate items — accepted, since the result always lands pre-filled and fully editable in `<import-text-dialog>` before anything commits, same dialog and same live "N items" preview as the existing per-list "Add from text" menu action. That dialog (`app/components/import-text-dialog/`) is a shared **UI-tier** component (property-in/event-out, zero store knowledge) mounted twice: once in `list-detail-page.js` (`draftKey` scoped per list, confirming adds straight to that list) and once in `bottom-nav.js` (`draftKey` fixed to `'share-target'`, confirming shows `<list-picker-dialog>` for destination list(s) — same multi-select + inline new-list flow item-handoff already uses — before merging). Splitting the picker step out this way (edit text once, choose destination(s) after) avoids re-editing the same shared text once per destination list.

Full-backup export/import (Settings → Export/Import) is unrelated to all of the above — always ZIP, always a direct file download/picker, never goes through `navigator.share`, so none of the file-share-allowlist or `file_handlers` constraints apply to it.

### Constraints
- Local only: no accounts, no cloud sync. Export/import (full backup) and the two "Share..." actions above are the only data-transfer mechanisms.
- Keep it simple: no unnecessary settings, no complexity for its own sake.

### Common mistakes
- **Lists are trans-year.** Never scope a list or item to a year. Only entries in `inGoals` point into a year.
- **No progress sync between lists and goals.** When a list item is promoted to a goal, progress tracks independently on each side — do not attempt to keep them in sync.
- **List items have no tracking.** Only goals track progress. Do not add a `tracking` field to `ListItem`.
- **List item schema is fixed.** All items share the same field set regardless of which list they belong to — do not make the schema per-list-configurable.
- **`accentColors` is a top-level store key.** Never nest it inside `goals[year]`. `theme` and locale are NOT store keys — they live in localStorage by design.
- **`Goal.color`/`ListItem.color`/`List.color` are purely decorative** — organisation/decoration only, no functional meaning (unlike `status`, `tracking`, `dueDate`). Don't gate filtering, urgency, or any other logic on them.
- **The colour palette is centralised in `app/utils/color-palette.js`.** `COLOR_PALETTE`, `COLOR_LABELS`, and `nextColor()` are the single source for every swipe-cycle and swatch picker across lists, goals, and items — never hardcode a second palette or duplicate the cycling math. Cycling past the last colour removes the `color` key entirely (`{...rest, color} : rest`) — never persist `color: null`.
- **Item swipe-to-done is gone.** Right-swipe on a `list-item` row cycles colour now (`item-color-cycle`), matching goals and lists. Marking an item done is exclusively the status badge (tap-to-cycle) or the dialog's status pills — don't reintroduce a swipe-to-complete gesture, it would collide with colour-cycling on the same gesture.
- **Item status values are `open | paused | done | closed`.** The old names `active`, `in-goals`, and `completed` are invalid.
- **`in-goals` is not a valid item status.** Use `inGoals.length > 0` to detect linked items in the UI.
- **Frequency goals use `entries: string[]` of unique ISO dates.** One entry per calendar day maximum — do not allow duplicate dates. Past dates are allowed.
- **"Every day" is not a goal type.** It is `weekly` with `target=7`, offered as a UI preset. Do not add a `daily` type to the schema.
- **Frequency goal `entries` data grows over time.** Keep it as a flat array of date strings (YYYY-MM-DD). Do not store counts, times, or any per-entry metadata — just the date of each completion.
- **Deadline/due-date urgency lives in `app/utils/urgency.js`.** All buckets and aggregation come from `urgencyOf` / `mostUrgent` / `urgentCount` — never re-derive "overdue" or day-diff logic inline. Leaf goals/items show a **tinted calendar**; roll-ups (list cards, bottom-nav Years/Lists pills, app icon badge) show a **colour dot** for green/yellow/red only (quiet for `far`/`none`), plus a **count of today+overdue** when red. The app-icon badge uses `navigator.setAppBadge(n)` — Chrome/installed only (Firefox ignores it), so it's a pure enhancement, never the sole signal. Whether it actually *renders* on Android is out of the app's control even when the call succeeds with no error — confirmed via a raw manual `setAppBadge(5)` in a remote-debug session that resolved fine but showed nothing on the icon; this is a launcher/OS rendering gap, not a code bug (see `_updateAppBadge`'s error logging, added v1.19.1, for diagnosing a genuine failure vs. this). The **date filter** (a `dates` Set in each page's `_filter`, pills *Overdue/Week/Month/Later/None*) reuses `matchesDateBucket` / `DATE_FILTER_KEYS` from the same module — the dated pills mirror the markers (active-only), `none` means `!dueDate`. Present on the home (goals), list-detail (items), and lists-overview (matches if any item in the list falls in the bucket) filters.
- **Never edit `_lib/` directly** — it is replaced wholesale by `npx socle update`.
- **Never ZIP (or otherwise binary-encode) a payload meant for `navigator.share({files})`.** Chromium's file-share allowlist excludes archives outright, confirmed via source — see **Sharing** above. Plain text is the only format that actually reaches the native share sheet.
- **`file_handlers` does not work on Android, period.** Desktop Chrome/Chromium only. `share_target` is the real phone-side file-reception mechanism — see **Sharing** above.

---

## Stack

- Vanilla JS, CSS, HTML — no runtime dependencies
- Web Components (`AppElement` base class from `_lib/`)
- IndexedDB via `_lib/core/idb/`
- Service worker with offline-first caching
- Accent colour: `#5BADE0` — override via the `:root` block in `index.html`.
- Target browsers: Firefox and Android Chrome. iOS Safari is not supported — direct users to install Firefox.

---

## Project structure

```
_lib/            ← library code — never edit directly. Run `npx socle update` to upgrade.
app/
  components/    ← your Web Components
  pages/         ← your page components (one per route)
  store/         ← your store actions and reducer
  strings.js     ← English string defaults (must be first import in main.js)
  main.js        ← app entry point
tests/
  unit/          ← Vitest unit tests
  e2e/           ← Playwright E2E tests
utils/
  build.js       ← edit if custom build behaviour needed
index.html
manifest.json
dist/            ← generated by build, never commit
```

---

## Commands

```bash
npm run build        # build to dist/
npm run dev:https    # build + serve at https://localhost:3000 (required for SW on mobile)
npm test             # All tests (single run)
npm run test:watch   # Vitest in watch mode
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

---

## Rules

- All style values come from `_lib/core/styles/tokens.css` — no hardcoded fonts, spacing, or sizes
- State flows one way: action → store → IDB → component
- No full re-renders after initial mount — targeted DOM updates only
- CSS logical properties throughout (`margin-inline-start`, not `margin-left`)
- Elements with `position: sticky` or `fixed` at the top use `padding-block-start: var(--safe-area-top)` to avoid the notch; bottom elements use `padding-block-end: calc(var(--space-N) + var(--safe-area-bottom, 0px))`
- All custom events must use `{ bubbles: true, composed: true }` — without `composed: true`, events fired inside a shadow root are swallowed and never reach parent listeners
- Every new feature passes `/i18n`, `/a11y`, `/test`, and `/review` before `/commit`. Documentation is `CHANGELOG.md` only (updated via `/docs changelog` before shipping) plus `README.md`, which is edited only on explicit request — no `docs/` folder, no per-feature doc files.
- And to always run `/test-pwa` and bump at least a patch version for the app before pushing (commit the new version and push after the commit).

---

## Components

Three tiers:

- **Page** — one per route, owns layout, subscribes to store slices. Must contain a `<main>` landmark element.
- **UI** — reusable widgets, receive data via properties, emit events upward, zero store knowledge. Must be testable in isolation with no store dependency.
- **Service** — invisible elements (`<sw-manager>`, `<db-init>`), manage lifecycle, never render.

All components extend `AppElement`. Override `template()` to return an HTML string (called once on connect). Use `subscribe()` / `unsubscribe()` for event listeners and store bindings.

```js
import { AppElement } from '../../_lib/core/app-element.js';

class MyWidget extends AppElement {
  template() {
    return `
      <style>:host { display: block; }</style>
      <p class="label"></p>
    `;
  }

  subscribe() {
    this._label = this.shadowRoot.querySelector('.label');
    // set up listeners and store subscriptions here
  }

  unsubscribe() {
    // clean up listeners here
  }
}

customElements.define('my-widget', MyWidget);
```

---

## Store

```js
import { setState, getState, setRuntimeState, subscribe, unsubscribe } from '../../_lib/core/store/store.js';

// Read current state
const lists = getState().lists ?? [];

// Write a top-level key (persisted to IDB, notifies subscribers)
setState('lists', lists.map(l => l.id === id ? { ...l, name } : l));

// Ephemeral runtime state (not persisted, notifies subscribers)
setRuntimeState('pendingListUndo', { snapshot, listName });

// Subscribe — called immediately with current value, then on every change
subscribe('goals', this._onGoals = goals => this._renderGoals(goals));

// Unsubscribe — always clean up in unsubscribe()
unsubscribe('goals', this._onGoals);
```

**Migrations.** `boot()` accepts an optional `migrate: (state) => state` option (`app/main.js`), run once synchronously after merging `initialState` with the stored state and before the store is usable. Returning a new object (reference inequality) persists the migrated shape back to IDB immediately; returning the same reference is a no-op — `app/utils/migrate-goals.js` (`migrateGoals`, the `percentage` → `tracking` rewrite, see the data model section above) relies on this to skip a redundant IDB write once every stored goal has already been migrated. A prior migration (`description`→`notes`) was removed once no stored data needed it, then replaced by this one — the hook stays a single function reference, not a chain, since there's only ever one real consumer at a time.

---

## Testing

Unit tests live in `tests/unit/`. E2E tests live in `tests/e2e/`. Co-located `*.test.js` files exist in `_lib/` — read them as examples of correct test patterns.

**Environments:**
- Add `// @vitest-environment happy-dom` only when the test needs `document`, `customElements`, or Shadow DOM
- Pure store/IDB tests run in Node — no happy-dom annotation needed
- `fake-indexeddb` is loaded globally via `_lib/core/test-setup.js` — never mock IDB, run against the real API

**Gesture components** — happy-dom doesn't implement pointer capture. Add at module scope in any test file that mounts a gesture-enabled component:
```js
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
```

**Async DOM assertions** — store callbacks fire asynchronously after `dispatch()`. Use `vi.waitFor` rather than asserting synchronously:
```js
await vi.waitFor(() => expect(el.shadowRoot.querySelector('.title').textContent).toBe('Hello'));
```

---

## Dev server and mobile testing

```bash
npm run dev:https    # mobile — https://localhost:3002 + https://<LAN-IP>:3002
npm run dev          # desktop — http://localhost:3002
```

Service workers only register on HTTPS or `localhost`. Always use `dev:https` when testing offline mode or SW behaviour on a real device.

**HTTPS cert setup (one-time per machine):**
```bash
brew install mkcert && mkcert -install
mkcert localhost <LAN-IP>   # creates localhost+1.pem and localhost+1-key.pem in the project root
```

**Android CA trust (one-time per device):**
`mkcert -CAROOT` → copy `rootCA.pem` to device → Settings → Security → Install certificate → CA certificate.

**Testing offline:**
1. Start `npm run dev:https`
2. Visit the HTTPS URL on the device — wait a few seconds for the SW to install and pre-cache all assets
3. Kill the server (`pkill -f "serve dist"`)
4. Reload on the device — the app should load fully from cache

Cert files (`*.pem`, `*.key`, `*.crt`) are gitignored — never commit them.

---

## Workflow

**Before starting a new feature:** run `/scope`

**Building a feature:**
- `/component <name> <tier>` — scaffold a new Web Component
- `/migration <version> <description>` — scaffold a schema migration

**After completing a feature:** `/i18n` → `/a11y` → `/test` → `/review` → `/commit`

**Before shipping:** `/test-pwa` → `/status` → `/docs changelog` → bump at least patch version → `/commit` → git push

**To upgrade `_lib/`:** `npx socle update`

---

## Updating _lib/

```bash
npx socle update
```

Replaces `_lib/` files only. Your `app/` code is never touched.
If the update includes a new IDB schema version, run `/migration` to review and apply it.

> **`_lib/` is read-only.** Every file in it is overwritten on the next `npx socle update`.
> Any edit you make there will be silently lost. App-level overrides belong in `app/` or `index.html`:
> - Colour tokens → override in the `:root` block in `index.html`
> - Component behaviour → extend or wrap in `app/components/`, never patch `_lib/`
