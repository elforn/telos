# /landing-page

Generate a static landing page for this app at `site/index.html` and update the GitHub Actions workflow to serve both the landing page and the app from the same repository.

## What to do

### 1. Gather context

Read in order:
- `manifest.json` — app name, short name, description, theme_color, icons, start_url
- `package.json` — repository URL if present under `homepage` or `repository`
- `app/strings.js` — default locale strings (feature names, page titles, any descriptive text)
- `app/main.js` — which modules are imported (gestures, sync, images, etc.)

Then ask the user for:
1. A one-sentence tagline (what the app does for the user, not a technical description)
2. 3–5 feature highlights to show on the page
3. The GitHub repository URL if not found in `package.json`

Do not write any files until you have the tagline and features.

---

### 2. Create `site/index.html`

Single HTML file. All CSS inline in `<style>`. No JavaScript. No external CSS frameworks. Google Fonts is the only permitted external resource.

**Design system:**
- Font: Onest from Google Fonts, weights 300–600 only
  `https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600&display=swap`
- Background: `#FAFAF8` with CSS dot grid on `body`:
  `background-image: radial-gradient(circle, rgba(28,28,30,0.16) 1px, transparent 1px); background-size: 32px 32px`
- Accent: use `theme_color` from `manifest.json`. If it is very dark (luminance < 0.1) or very light (luminance > 0.8), fall back to `#E8824A`.
- Surface: `#FFFFFF` cards, `#EEEAE4` grey band
- Text: `#1C1C1E` primary, `#6E6E72` secondary (not lighter — contrast requirement)
- Max content width: `1100px`, centred with `margin-inline: auto`
- Responsive: readable single-column on mobile

**Accessibility (required on every page):**
- `lang="en"` on `<html>`
- Semantic landmarks: `<nav aria-label="Main">`, `<main>`, `<section>`, `<footer>`
- `scroll-margin-top: 58px` on all `section` elements (sticky nav offset)
- Global focus ring: `:focus-visible { outline: 2px solid <accent>; outline-offset: 3px; border-radius: 3px; }`
- Decorative SVGs: `aria-hidden="true"`
- External links: `rel="noopener"` on all `target="_blank"` links
- Animated elements: wrap in `@media (prefers-reduced-motion: no-preference)` or add a `prefers-reduced-motion: reduce` block that disables them

**Page sections:**

1. **Nav** — sticky, 58px tall, frosted glass (`rgba(250,250,248,0.9)` + `backdrop-filter: blur(14px)`), border-bottom `1px solid #E4E0DA`. Left: app name (weight 600, 0.9375rem). Right: anchor links to page sections + GitHub ↗. Hide right links on mobile (`max-width: 600px`).

2. **Hero** — centred, generous padding. App name in large type (clamp 3rem → 5.5rem, weight 600, letter-spacing -0.04em). Tagline as `<h1>` (clamp 2rem → 3.25rem, weight 300). One-line sub-headline in secondary colour. Two CTAs side by side: "Open app →" (accent filled, links to `/{repo-name}/app/`) and "GitHub ↗" (outline, links to GitHub repo).

3. **Features** — grey band (`#EEEAE4`), no top border. 3–4 column card grid (responsive). Each card: white surface, 1px border, 10px radius, generous padding. Card title `<h3>` (weight 600, 0.9375rem). Description in secondary colour (0.8125rem, line-height 1.72). No icons required.

4. **Get started** (dark band) — `background: #1C1C1E`. Two steps:
   - **Step 01** — Open the app at the GitHub Pages URL. First visit downloads everything. Works offline after that.
   - **Step 02** — Install to home screen. In the browser menu, choose "Install" or "Add to home screen". Launches like a native app.
   Show each step as a labelled block. White text (`#F5F2EE`) at reduced opacity (0.55) for descriptions. Orange accent for step labels.

5. **Footer** — `background: #1C1C1E`, no top border. Centred, small type. MPL-2.0 · GitHub link · (optional: link back to Socle). Text `rgba(245,242,238,0.55)`. Separators `rgba(245,242,238,0.15)`.

---

### 3. Update `.github/workflows/deploy.yml`

Replace the existing workflow with one that builds the app at the `/app/` subpath and assembles a combined Pages artifact:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build app
        run: node utils/build.js
        env:
          BASE_PATH: /${{ github.event.repository.name }}/app/
      - name: Assemble Pages artifact
        run: |
          mkdir -p _pages/app
          cp -r site/. _pages/
          cp -r dist/. _pages/app/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _pages/
      - uses: actions/deploy-pages@v4
        id: deployment
```

---

### 4. Report to the user

After writing both files, tell the user:

- **Landing page** will be at `https://<username>.github.io/<repo>/`
- **App** will be at `https://<username>.github.io/<repo>/app/`
- The Service Worker scope is `/app/` — it will never cache or intercept the landing page
- If the app was previously deployed, the URL has changed from `/<repo>/` to `/<repo>/app/` — existing bookmarks and any shared links need updating
- GitHub Pages must be enabled: Settings → Pages → Source: GitHub Actions
