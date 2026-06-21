# /status

Report what is built, what is missing, and what to work on next.
Do not start any work. Report only.

## What to do

### Core health
- [X] `_lib/` present and `_lib/lib-version.json` readable — run `npx socle update` if stale
- [X] `index.html` present, `manifest.json` configured (name, icons, theme_color filled in)
- [X] `--color-accent` overridden for this app in `_lib/core/styles/tokens.css`
- [X] `app/strings.js` is the first import in `app/main.js` (if i18n strings are in use)

### Routing
- [X] `<app-router>` registered in `index.html`
- [X] At least one page component in `app/pages/`
- [X] 404 / fallback route handled by a not-found page

### Data layer
- [X] Schema version and migrations reviewed — run `/migration` if schema changed

### Components
List every file in `app/components/` and `app/pages/`. For each:
- Does a `.test.js` exist?
- Has `/a11y` been run?

### Tests
- Are Vitest unit tests passing? (`npm test`)
- Are Playwright E2E tests present for offline behaviour and data persistence?
- Has `/test-pwa` been run?

### Build
- Does `npm run build` complete without errors?
- Is `dist/sw.js` generated with a full asset list?
- Does the offline E2E test pass after a fresh build?

### Docs
- Is `README.md` present and accurate?
- Is `CHANGELOG.md` up to date?

### Planned features
For each roadmap item: ✅ done / ⬜ not started.

- [X] Dark theme: `[data-theme="dark"]` token overrides present in CSS
- [X] Dark theme: `theme` store key; year-header menu has light/dark/system toggle
- [X] Year accent colour: `accentColors` store key; year change writes to `--color-accent` on `:root`
- [X] Goal ordering: drag-reorder in `home-page.js`
- [X] Lists: `app/pages/lists-page.js` exists and is routed
- [X] Lists: `app/components/list-item/` component exists
- [X] Lists: item status uses `open | paused | done` (not `active | completed`)
- [ ] Lists: items filterable by status and tag in the UI
- [ ] Goals: tag field present in schema and editable in goal dialog
- [ ] Goals: tags filterable in the year view
- [ ] Frequency goals: `tracking.type = 'weekly'` and `'monthly'` handled in goal-item and home-page
- [ ] Frequency goals: log-completion UI allows picking a past date
- [ ] Frequency goals: max one entry per calendar day enforced
- [ ] Year selector overlay: tap year title → bottom-sheet picker with content dots

---

## Output format

For each area: ✅ done / 🔄 in progress / ⬜ not started

Then state clearly: **"Recommended next step: [specific task]"**
