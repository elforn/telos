# Changelog

All notable changes to Telos are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Goals now have an optional **description field** — add notes or context to any goal via the edit dialog
- A small `ℹ` indicator appears on the goal card when a description is set

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
