import { test, expect } from '@playwright/test';

// ── Automated checks ──────────────────────────────────────────────────────────

test('manifest.json is reachable and has required installability fields', async ({ page, baseURL }) => {
  const res = await page.request.get(`${baseURL}/manifest.json`);
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toMatch(/^(standalone|fullscreen|minimal-ui)$/);

  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  const icon = manifest.icons[0];
  expect(icon.src).toBeTruthy();
  expect(icon.sizes).toBeTruthy();
});

test('icon declared in manifest is reachable', async ({ page, baseURL }) => {
  const res = await page.request.get(`${baseURL}/manifest.json`);
  const manifest = await res.json();

  // Resolve icon src relative to the manifest (served at root)
  const iconUrl = new URL(manifest.icons[0].src, baseURL).href;
  const iconRes = await page.request.get(iconUrl);
  expect(iconRes.status()).toBe(200);
});

test('service worker registers successfully', async ({ page, baseURL }) => {
  await page.goto(baseURL);
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration();
    const sw = reg?.active ?? reg?.installing ?? reg?.waiting;
    return sw?.state ?? 'none';
  });
  expect(['activating', 'activated', 'installing', 'installed']).toContain(swState);
});

// ── Manual checklist ──────────────────────────────────────────────────────────
// The beforeinstallprompt event cannot be reliably triggered in Playwright.
// Run through this checklist manually in Chrome or Firefox before every release.
//
// [ ] App is served over HTTPS (or localhost for local testing)
// [ ] manifest.json — DevTools > Application > Manifest, no errors shown
// [ ] Service worker active — DevTools > Application > Service Workers
// [ ] Install prompt appears in Chrome on second visit (address bar icon)
// [ ] Installed app opens in standalone mode (no browser chrome)
// [ ] App icon correct on home screen / app launcher
// [ ] Splash screen displays correctly on Android (background_color)
// [ ] App fully functional offline when installed (no network, full reload)
// [ ] Update banner appears after deploying a new build and reopening
// [ ] Tapping Reload on the update banner applies the new version correctly
