# Telos

A yearly goal planner

Scaffolded from Socle 0.2.5 on 2026-06-06. Now on 0.15.3.
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
  { id, title, notes?, tags: string[], archived?: boolean, percentage: number, dueDate?: string }
  ```
  `percentage` is the progress value, 0–100. The field is `notes`, never `description` (renamed in 1.8.0). `archived` goals are hidden unless the Archived filter pill is active. `dueDate` (added 1.11.0) is an optional ISO date string (`YYYY-MM-DD`, from a native `<input type="date">`) shown as "Deadline" in the UI, editable via a collapsed toggle in `goal-dialog`. It surfaces as a **graduated urgency indicator** (added 1.16.0) — the `goal-item` calendar glyph is tinted by how soon the deadline is (grey `far` >30d → green `month` ≤30d → yellow `week` ≤7d → red `today`; `overdue` is its own state — a **filled solid-red calendar chip** (white glyph) so it out-weights plain red today). Shown only for active goals (`percentage < 100 && !archived`). The bucket logic is centralised in `app/utils/urgency.js` (`urgencyOf`, `mostUrgent`, `urgentCount`) — never re-derive it inline. Goal deadline markers are **year-aware**: shown by default only for the current year; other years are toggled via the year-header menu (see `goalsDeadlinesVisible`). No filter pill.

  **Planned — not yet implemented:** a `tracking` union replacing flat `percentage`. Code currently uses flat `percentage` everywhere. When built, `tracking` will be one of three types:
  - `{ type: 'percentage', value: number }` — value 0–100; Default for all new goals.
  - `{ type: 'weekly', target: number, entries: string[] }` — target = times/week (e.g. 3). "Every day" is a UI preset for target=7. `entries` = unique ISO date strings (YYYY-MM-DD), one per calendar day max; past dates allowed.
  - `{ type: 'monthly', target: number, entries: string[] }` — target = times/month. Same `entries` shape as weekly, different aggregation window.

  For `weekly` and `monthly`: success per period = `min(entries_in_period / target, 1)`. Both use a weighted running average across periods (more recent periods weighted higher).

- **`images`** — `{ [year]: blobId }`. Blobs stored via `attachBlob`/`getBlob`.
- **`lists`** — `List[]` where each `List` is `{ id, name, color?: string, showStatus?: boolean, items: ListItem[] }`. Lists are **trans-year** — never scoped to a specific year. `color` is an optional hex string for visual differentiation. `showStatus` (default `true`) controls whether item status badges are shown in the list detail view.
- **`ListItem`** — fixed schema (no progress tracking — only goals are tracked):
  ```
  { id, title, note?, url?, dueDate?, status: 'open' | 'paused' | 'done' | 'closed', tags: string[], inGoals: Array<{ year: string, section: string, goalId: string }> }
  ```
  - `closed` means dropped/abandoned: closed items are hidden by default and appear only when the Closed filter pill is active (see `_applyFilter` in `list-detail-page.js`).
  - `inGoals` is an empty array when not linked; each entry records where the item was promoted. A single item can be promoted into goals across multiple years/sections.
  - Progress is **not** synced between list items and goal copies — each goal tracks independently.
  - `dueDate` (functional since 1.11.0) is an optional ISO date string (`YYYY-MM-DD`); it surfaces as the same graduated urgency indicator as goals (tinted `list-item` calendar via `app/utils/urgency.js`), active only when `status` isn't `done` or `closed`. The due-date field is **shown by default** in `item-dialog` (1.16.0) — unlike the goal "Deadline" and item "URL" fields, which stay collapsed. Promoting an item to a goal, or creating an item from a goal, carries both `tags` and `dueDate` across (see `_onItemPromote` in `list-detail-page.js`, `_onGoalCreateItem` in `home-page.js`) — same one-way copy, no ongoing sync, as everything else in the promote/create-item flow.
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
- **`share_target`** — Chromium-only, requires the PWA installed, currently accepts only `text/plain`/`.txt` (not `.telos`/ZIP — full backups can't arrive this way). `app/main.js` reads Socle's `readShareInbox()` once on boot and dispatches the same `telos-import-file` event the file-open path already fires — zero bespoke routing code.
- **`file_handlers`** (`.telos` + `.txt`) — **does not work on Android at all, ever** (File Handling API is desktop-only per Chrome's own documentation, not a bug or a caching issue). Works on desktop Chrome/Chromium only. `share_target` is the real phone-side reception mechanism — don't assume tap-to-open reaches phone users, the app's primary platform.

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
- Every new feature passes `/i18n`, `/a11y`, `/test`, `/docs`, and `/review` before `/commit`.
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

**Migrations.** `boot()` accepts an optional `migrate: (state) => state` option (`app/main.js`), run once synchronously after merging `initialState` with the stored state and before the store is usable. Returning a new object (reference inequality) persists the migrated shape back to IDB immediately; returning the same reference is a no-op. No migration is currently registered — the last one (`description`→`notes`) was removed once no stored data needed it. The next real consumer will be the `tracking` union migration (`percentage` → `tracking`, see the data model section above).

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

**After completing a feature:** `/i18n` → `/a11y` → `/test` → `/review` → `/docs feature` → `/commit`

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
