# Telos

A personal yearly goal planner for your phone.

## What it does

- Set one headline **capstone goal** for the year
- Track three **3-month milestones** and six **8-week wow moments**
- Hold-drag a progress bar to update any goal; swipe in Edit mode to mark failed or delete
- Navigate between years to review past plans
- Attach a **year photo** as a visual anchor for the year
- Export and import data as a single `.telos` file — import merges with local data by default, or replaces it entirely
- Maintain **trans-year lists** (ideas, gifts, identity anchors, etc.) and link items into goal sections

Everything is stored locally on the device. No cloud sync, no sign-in.

## Using on mobile

Visit **https://elforn.github.io/telos** on your phone.

**Supported browsers:** Android Chrome and Firefox. iOS Safari is not supported — on iOS, use [Firefox for iOS](https://apps.apple.com/app/firefox-private-safe-browser/id989804926) instead.

### Installing as a PWA

- **Android (Chrome):** tap the "Add to Home Screen" prompt or browser menu → *Install app*
- **Android (Firefox):** browser menu → *Install*
- **iOS (Firefox):** Share sheet → *Add to Home Screen*
- **Desktop (Chrome / Edge):** address bar install icon or browser menu → *Install Telos*

---

## Development

Clone the repo and install dev tools (no runtime dependencies):

```bash
git clone https://github.com/elforn/telos.git
cd telos
npm install
```

### Running locally

The app is phone-first, so always develop over HTTPS. One-time cert setup:

```bash
npx socle cert
```

Then start the dev server:

```bash
npm run dev:https
```

This serves the app at `https://localhost:3002` and `https://<your-LAN-IP>:3002`.
Open the LAN address on your phone for real-device testing.

**Android CA trust (one-time per device):**
Run `mkcert -CAROOT` → copy `rootCA.pem` to the device → Settings → Security → Install certificate → CA certificate.

### Slash commands

This project ships with a `CLAUDE.md` that configures [Claude Code](https://claude.ai/code) for development. Key slash commands:

| Command | When to use |
|---|---|
| `/scope` | Before starting a new feature |
| `/component <name> <tier>` | Scaffold a new Web Component |
| `/migration <version> <desc>` | Scaffold a schema migration |
| `/test <file>` | Write or complete tests for a file |
| `/a11y` | Accessibility audit |
| `/review <file>` | Code review against project standards |
| `/docs feature <name>` | Document a completed feature |
| `/test-pwa` | PWA and offline behaviour tests |
| `/status` | Summarise what's done and what's left |
| `/commit` | Stage and commit with a generated message |
| `/contribution-scan` | Scan components for ones general-purpose enough to contribute back to Socle |
| `/contribute <file>` | Check eligibility, clean up, and package a component for contribution to Socle |

Feature workflow: → `/scope` → build → `/component` → `/test` → `/a11y` → `/i18n` → `/review` → `/docs feature` → `/commit`

Pre-ship workflow: `/migration` → `/test-pwa` → `/status` → `/docs changelog` → `/commit`

### Running tests

```bash
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests
npm test             # both
```

### Deploying

Push to `main` — GitHub Actions builds and deploys to GitHub Pages automatically.

### Contributing to Socle

Telos is built on [Socle](https://github.com/magp/socle), a vanilla JS app scaffold. The `_lib/` directory is managed by Socle — never edit it directly.

To pull in the latest scaffold updates:

```bash
npx socle update
```

Components you build in Telos that turn out to be genuinely general-purpose can be contributed back to Socle. Two slash commands handle this:

- **`/contribution-scan`** — scans all `app/components/` files and ranks them: *strong candidates* (no store imports, no domain-specific terms, test exists), *possible candidates* (one fixable issue), and *not eligible*. Run this periodically to spot candidates without having to review files manually.

- **`/contribute <file>`** — takes a single component through a full eligibility check (domain concepts, app-layer isolation, test coverage, accessibility), analyses where it would fit in the library, then produces a `_contribution/<name>/` package containing the cleaned component and a `proposal.md` ready to attach to a Socle GitHub issue.

The maintainer reviews the proposal and integrates it into the next release if accepted.

---

Built with [Socle](https://github.com/magp/socle).
