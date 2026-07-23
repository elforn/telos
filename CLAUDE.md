# Telos

A yearly goal planner

Scaffolded from Socle 0.2.5 on 2026-06-06. Now on 0.14.2.
Installed modules: core, gestures, sync, images, app-header, modal-dialog, toast

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

### Data model
All state lives in a **simple store** (setState/getState — no event log, no reducer). Top-level keys:

- **`goals`** — `{ [year]: { capstone: Goal[], milestones: Goal[], wow: Goal[], focus: Goal[] } }`. Each `Goal` has a fixed schema:
  ```
  { id, title, notes?, tags: string[], archived?: boolean, percentage: number }
  ```
  `percentage` is the progress value, 0–100. The field is `notes`, never `description` (renamed in 1.8.0). `archived` goals are hidden unless the Archived filter pill is active.

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
- **`accentColors`** — `{ [year]: string }`. Hex colour per year. On year change, writes to `--color-accent` on `:root` (or resets to the default `#5BADE0`).
- **`goalsTagsVisible`** — `{ [year]: boolean }`. Whether tag chips are shown on goal items for that year.
- **`listsTagsVisible`** — `{ [listId]: boolean }`. Whether tag chips are shown on items of that list.
- **`reflections`** — **planned, not implemented** (merge-strategy already handles the key). Will be `{ [year]: { annual?, Q1?, Q2?, Q3?, Q4? } }`, each entry `{ note: string, stars: number }` (1–5 stars).

**Not store keys:** `theme` (`'light' | 'dark' | 'system'`) and locale live in **localStorage by design** (`_lib/core/theme/theme.js`, `_lib/core/strings.js`) — device-local preferences deliberately excluded from export/import. Never move them into the store.

### Constraints
- Local only: no accounts, no cloud sync. Export/import via the sync module is the only data-transfer mechanism.
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
- **Never edit `_lib/` directly** — it is replaced wholesale by `npx socle update`.

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
