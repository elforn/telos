# Changelog

All notable changes to Telos are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- `TODO.md` — full feature roadmap covering lists, frequency goals, dark theme, year accent colour, and longer-term ideas
- Not-found page redesigned with proper styling, accessible heading, and a "Go to this year" button

### Changed
- App accent colour set to `#5BADE0` (light blue) via `index.html` `:root` override — `_lib/` remains unchanged
- CLAUDE.md data model updated: goal schema now documents `percentage | weekly | monthly` tracking types; `ListItem` status renamed to `open | paused | done`; new top-level store keys `theme`, `accentColors`, `reflections` documented
- CLAUDE.md strengthens the `_lib/` read-only rule — all overrides belong in `app/` or `index.html`

---

## [1.0.0] — 2026-06-06

### Added
- Capstone, milestones, wow, and focus goal sections per year
- Progress bar with hold-drag interaction (0–100 %); fail state (−1); swipe-to-reveal delete and fail actions in edit mode
- Year navigation — tap prev/next in the header to move between years
- Year photo — full-bleed header background image per year
- Export / import as `.tlos` file via the sync module
- Service worker with offline-first caching
- PWA manifest (installable on Android Chrome and Firefox)
- Deployed to `https://elforn.github.io/telos` via GitHub Actions

### Fixed
- Router base-path handling for GitHub Pages — routes and `navigate()` calls now correctly prefix `/telos/` in the deployed build, derived from `import.meta.url` rather than a DOM query
