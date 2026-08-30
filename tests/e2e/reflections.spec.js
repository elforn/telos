import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clickInYH(page, selector) {
  await page.evaluate(sel => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

async function clickInHomePage(page, selector) {
  await page.evaluate(sel => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(sel).click();
  }, selector);
}

async function openReflectionDialog(page) {
  await clickInYH(page, '#menu-btn');
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#menu')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
  await clickInYH(page, '#year-reflection-btn');
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#reflection-dialog')?.shadowRoot
      ?.querySelector('#dialog')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

async function openReflectionDialogFromCard(page) {
  await clickInHomePage(page, '#reflection-card');
  await page.waitForFunction(() =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#reflection-dialog')?.shadowRoot
      ?.querySelector('#dialog')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

async function rateStar(page, aspect, value) {
  await page.evaluate(({ aspect, value }) => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#reflection-dialog').shadowRoot
      .querySelector(`.star-group[data-aspect="${aspect}"] .star-btn[data-value="${value}"]`)
      .click();
  }, { aspect, value });
}

async function setComment(page, text) {
  await page.evaluate(text => {
    const textarea = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#reflection-dialog').shadowRoot
      .querySelector('#reflection-comment');
    textarea.focus();
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.blur();
  }, text);
}

async function closeReflectionDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#reflection-dialog').shadowRoot
      .querySelector('#reflection-close-btn').click();
  });
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('year-header')?.shadowRoot
      ?.querySelector('#reflection-dialog')?.shadowRoot
      ?.querySelector('#dialog')?.shadowRoot
      ?.querySelector('dialog')?.open
  );
}

function cardHidden(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#reflection-card').hidden
  );
}

function cardScoreText(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#reflection-card-score-num').textContent
  );
}

function cardCommentText(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#reflection-card-comment').textContent
  );
}

function commentValue(page) {
  return page.evaluate(() =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#reflection-dialog').shadowRoot
      .querySelector('#reflection-comment').value
  );
}

function starFilled(page, aspect, value) {
  return page.evaluate(({ aspect, value }) =>
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('year-header').shadowRoot
      .querySelector('#reflection-dialog').shadowRoot
      .querySelector(`.star-group[data-aspect="${aspect}"] .star-btn[data-value="${value}"]`)
      .classList.contains('filled')
  , { aspect, value });
}

async function rateAllFive(page) {
  await rateStar(page, 'people', 5);
  await rateStar(page, 'health', 4);
  await rateStar(page, 'wealth', 3);
  await rateStar(page, 'contribution', 4);
  await rateStar(page, 'wonder', 4);
}

// ── Reflections ───────────────────────────────────────────────────────────────

test.describe('Reflections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('the summary card is hidden until a reflection exists', async ({ page }) => {
    expect(await cardHidden(page)).toBe(true);
  });

  test('create a reflection, reload, and see the correct aggregate + comment on the summary card', async ({ page }) => {
    await openReflectionDialog(page);
    await rateAllFive(page);
    await setComment(page, 'A genuinely great year, all around.');
    await closeReflectionDialog(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    expect(await cardHidden(page)).toBe(false);
    expect(await cardScoreText(page)).toBe('4.0');
    expect(await cardCommentText(page)).toBe('A genuinely great year, all around.');
  });

  test('tapping the summary card reopens the dialog pre-filled', async ({ page }) => {
    await openReflectionDialog(page);
    await rateAllFive(page);
    await setComment(page, 'Pre-filled check');
    await closeReflectionDialog(page);

    await openReflectionDialogFromCard(page);
    expect(await commentValue(page)).toBe('Pre-filled check');
    expect(await starFilled(page, 'people', 5)).toBe(true);
    expect(await starFilled(page, 'wealth', 4)).toBe(false);
  });

  test('editing a score after reload updates the aggregate and persists', async ({ page }) => {
    await openReflectionDialog(page);
    await rateAllFive(page);
    await closeReflectionDialog(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    expect(await cardScoreText(page)).toBe('4.0');

    await openReflectionDialogFromCard(page);
    await rateStar(page, 'health', 5);
    await closeReflectionDialog(page);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    expect(await cardScoreText(page)).toBe('4.2');
  });

  test('toggling visibility off hides the card, and persists across reload', async ({ page }) => {
    await openReflectionDialog(page);
    await rateStar(page, 'people', 5);
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#reflection-dialog').shadowRoot
        .querySelector('#reflection-visibility-btn').click();
    });
    await closeReflectionDialog(page);

    expect(await cardHidden(page)).toBe(true);

    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    expect(await cardHidden(page)).toBe(true);
  });

  test('including the reflection in a year markdown export is opt-in via the export sheet checkbox', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openReflectionDialog(page);
    await rateStar(page, 'people', 5);
    await setComment(page, 'Exported comment check');
    await closeReflectionDialog(page);

    await clickInYH(page, '#menu-btn');
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#menu')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    await clickInYH(page, '#year-export-btn');
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#export-sheet')?.shadowRoot
        ?.querySelector('#sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );

    // Reflection option visible for a year export, unchecked by default.
    const rowHidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-sheet').shadowRoot
        .querySelector('#reflection-row').hidden
    );
    expect(rowHidden).toBe(false);

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-sheet').shadowRoot
        .querySelector('#copy-btn').click();
    });
    const textUnchecked = await page.evaluate(() => navigator.clipboard.readText());
    expect(textUnchecked).not.toContain('Exported comment check');

    await clickInYH(page, '#menu-btn');
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#menu')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    await clickInYH(page, '#year-export-btn');
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('year-header')?.shadowRoot
        ?.querySelector('#export-sheet')?.shadowRoot
        ?.querySelector('#sheet')?.shadowRoot
        ?.querySelector('dialog')?.open
    );
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-sheet').shadowRoot
        .querySelector('#reflection-check').checked = true;
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('year-header').shadowRoot
        .querySelector('#export-sheet').shadowRoot
        .querySelector('#copy-btn').click();
    });
    const textChecked = await page.evaluate(() => navigator.clipboard.readText());
    expect(textChecked).toContain('Exported comment check');
  });
});
