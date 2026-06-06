# /status

Report what is built, what is missing, and what to work on next.
Do not start any work. Report only.

## What to do

### Core health
- [ ] `_lib/` present and `_lib/lib-version.json` readable — run `npx socle update` if stale
- [ ] `index.html` present, `manifest.json` configured (name, icons, theme_color filled in)
- [ ] `--color-accent` overridden for this app in `_lib/core/styles/tokens.css`
- [ ] `app/strings.js` is the first import in `app/main.js` (if i18n strings are in use)

### Routing
- [ ] `<app-router>` registered in `index.html`
- [ ] At least one page component in `app/pages/`
- [ ] 404 / fallback route handled by a not-found page

### Data layer
- [ ] At least one store action defined in `app/store/`
- [ ] Schema version and migrations reviewed — run `/migration` if schema changed
- [ ] Event types are clear from reading `app/store/reducer.js`

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

---

## Output format

For each area: ✅ done / 🔄 in progress / ⬜ not started

Then state clearly: **"Recommended next step: [specific task]"**
