import { test, expect } from '@playwright/test';
import { waitForPage, openSettings } from './helpers.js';

// The bottom nav is a full-bleed band: four cells that meet the bar's own
// edges, no track, no radius, no shadow. Every assertion here is on *computed*
// style or real layout geometry, which is precisely what the happy-dom unit
// suite cannot see — it reads DOM properties, never resolved CSS. (Same
// reasoning as the deadline-hidden badge's own e2e display assertion.)
//
// Not covered here, and not coverable: whether the full-bleed cells collide
// with Chrome for Android's edge-swipe back gesture. Synthesised input never
// engages the platform gesture recogniser, so that needs a real device.

function navMetrics(page) {
  return page.evaluate(() => {
    const sr = document.querySelector('bottom-nav').shadowRoot;
    const cs = el => getComputedStyle(el);
    const box = el => el.getBoundingClientRect();
    const nav = box(document.querySelector('bottom-nav'));
    const years = sr.querySelector('#pill-years');
    const lists = sr.querySelector('#pill-lists');
    const gear = sr.querySelector('#gear-btn');
    const pills = sr.querySelector('.pills');
    const active = years.classList.contains('active') ? years : lists;
    const inactive = active === years ? lists : years;
    return {
      navHeight: Math.round(nav.height),
      publishedHeight: getComputedStyle(document.documentElement)
        .getPropertyValue('--bottom-nav-height').trim(),
      radii: {
        pills: cs(pills).borderRadius,
        years: cs(years).borderRadius,
        lists: cs(lists).borderRadius,
        gear: cs(gear).borderRadius,
      },
      activeShadow: cs(active).boxShadow,
      activeBg: cs(active).backgroundColor,
      inactiveBg: cs(inactive).backgroundColor,
      hostPaddingInline: cs(document.querySelector('bottom-nav')).paddingInline,
      // Full bleed is relative to the HOST, not the viewport: :host is capped
      // at --page-max-width and centred, so on a desktop-width viewport the bar
      // is a 600px column and its cells meet *its* edges, not the screen's.
      firstCellInset: Math.round(Math.min(box(years).left, box(lists).left,
        sr.querySelector('#bell-btn').hidden ? Infinity : box(sr.querySelector('#bell-btn')).left) - nav.left),
      gearEndInset: Math.round(nav.right - box(gear).right),
      navWidth: Math.round(nav.width),
      viewportWidth: window.innerWidth,
      // Full height: the cell's bottom sits on the bar's own bottom.
      cellBottomVsNavBottom: Math.round(nav.bottom - box(active).bottom),
      cellHeight: Math.round(box(active).height),
    };
  });
}

test.describe('Bottom nav — full-bleed band', () => {
  test('nothing in the nav row is rounded', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    expect(m.radii).toEqual({ pills: '0px', years: '0px', lists: '0px', gear: '0px' });
  });

  test('the active cell has no shadow and fills the bar top to bottom', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    expect(m.activeShadow).toBe('none');
    // 1px of slack for the bar's own border-block-start.
    expect(m.cellBottomVsNavBottom).toBeLessThanOrEqual(1);
    expect(m.navHeight - m.cellHeight).toBeLessThanOrEqual(1);
  });

  test('cells reach both edges of the bar — no bar-level inset', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    expect(m.hostPaddingInline).toBe('0px');
    expect(m.firstCellInset).toBe(0);
    expect(m.gearEndInset).toBe(0);
  });

  test('at phone width the bar spans the viewport, so cells meet the screen edges', async ({ page }) => {
    // The app's primary surface — 95% of use. Below --page-max-width (600px)
    // the host is no longer capped, so bar edges and screen edges coincide.
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    expect(m.navWidth).toBe(m.viewportWidth);
    expect(m.firstCellInset).toBe(0);
    expect(m.gearEndInset).toBe(0);
  });

  test('only the active cell is filled', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    expect(m.activeBg).not.toBe(m.inactiveBg);
    // The inactive cell draws nothing of its own — it shows the bar through.
    expect(m.inactiveBg).toBe('rgba(0, 0, 0, 0)');
  });

  test('the published --bottom-nav-height matches the bar it measures', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const m = await navMetrics(page);
    // Pages reserve their bottom padding from this var, so a mismatch hides
    // the last row behind the bar.
    expect(m.publishedHeight).toBe(`${m.navHeight}px`);
  });

  test('a toast still clears the bar after the height change', async ({ page }) => {
    // #toast-container is pinned above the nav off --bottom-nav-height
    // (index.html), and the bar just went 67px -> 57px. The var is published at
    // runtime by a ResizeObserver, so this is the one consumer that silently
    // follows the nav's own geometry — and nothing asserted the clearance.
    await page.goto(`/${new Date().getFullYear()}`);
    await waitForPage(page);

    // Saving a goal is the shortest path to a real toast.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('#add-capstone').click();
    });
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog')?.open
    );
    await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot.querySelector('goal-dialog').shadowRoot;
      const inp = sr.querySelector('input');
      inp.value = 'Toast clearance';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      sr.querySelector('#close').click();
    });
    await expect(page.locator('#toast-container')).toBeVisible();

    const gap = await page.evaluate(() => {
      const toast = document.querySelector('#toast-container').getBoundingClientRect();
      const nav = document.querySelector('bottom-nav').getBoundingClientRect();
      return Math.round(nav.top - toast.bottom);
    });
    expect(gap).toBeGreaterThanOrEqual(0);
  });

  test('every cell clears the 40px minimum touch target', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const sizes = await page.evaluate(() => {
      const sr = document.querySelector('bottom-nav').shadowRoot;
      return ['#pill-years', '#pill-lists', '#gear-btn']
        .map(s => sr.querySelector(s).getBoundingClientRect())
        .map(b => ({ w: Math.round(b.width), h: Math.round(b.height) }));
    });
    for (const { w, h } of sizes) {
      expect(w).toBeGreaterThanOrEqual(40);
      expect(h).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('Bottom nav — settings close button', () => {
  test('closes the settings sheet', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    await openSettings(page);

    await page.evaluate(() =>
      document.querySelector('bottom-nav').shadowRoot.querySelector('#settings-close').click()
    );
    await page.waitForFunction(() =>
      !document.querySelector('bottom-nav').shadowRoot
        .querySelector('#settings-modal').shadowRoot.querySelector('dialog').open
    );
  });

  test('sits in the footer, reading as plain text rather than a filled action', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    await openSettings(page);

    const style = await page.evaluate(() => {
      const btn = document.querySelector('bottom-nav').shadowRoot.querySelector('#settings-close');
      const cs = getComputedStyle(btn);
      return {
        slot: btn.assignedSlot?.name,
        background: cs.backgroundColor,
        height: Math.round(btn.getBoundingClientRect().height),
      };
    });
    expect(style.slot).toBe('footer');
    // Settings has no save step, so Close must not read as a confirming action.
    expect(style.background).toBe('rgba(0, 0, 0, 0)');
    expect(style.height).toBeGreaterThanOrEqual(40);
  });
});
