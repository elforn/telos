import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openGoalDialog(page, addId) {
  await page.evaluate(id => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id).click();
  }, addId);

  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

async function fillTitle(page, title) {
  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);
}

async function addTagInDialog(page, tag) {
  await page.evaluate(tagVal => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#tag-input').shadowRoot
      .querySelector('.tag-text-input');
    inp.value = tagVal;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  }, tag);

  await page.waitForFunction(tagVal => {
    const wrap = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#tag-input')?.shadowRoot
      ?.querySelector('#tag-chips-wrap');
    return [...(wrap?.querySelectorAll('.tag-chip') ?? [])]
      .some(c => c.textContent.includes(tagVal));
  }, tag);
}

async function saveDialog(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#close').click();
  });
}

async function createGoalWithTag(page, addId, listId, title, tag) {
  const countBefore = await page.evaluate(id =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0
  , listId);

  await openGoalDialog(page, addId);
  await fillTitle(page, title);
  await addTagInDialog(page, tag);
  await saveDialog(page);

  await page.waitForFunction(([id, count]) =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0) >= count
  , [listId, countBefore + 1]);
}

async function tapGoalItem(page, listId) {
  const bounds = await page.evaluate(id => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(`${id} goal-item`).shadowRoot
      .querySelector('.bar');
    return bar?.getBoundingClientRect().toJSON();
  }, listId);
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.waitForFunction(() => {
    const d = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('goal-dialog')?.shadowRoot
      ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
    return d?.open;
  });
}

// ── Goal tags — creation ──────────────────────────────────────────────────────

test.describe('Goal tags — creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoalWithTag(page, '#add-capstone', '#capstone-list', 'Healthy living', 'health');
  });

  test('tag pill appears on the goal item after creation', async ({ page }) => {
    const pills = await page.evaluate(() => {
      const root = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot;
      return [...root.querySelectorAll('.tag-pill')].map(p => p.style.background);
    });
    expect(pills.length).toBe(1);
    expect(pills[0]).not.toBe('');
  });

  test('tag is stored on the goal and accessible via _goal', async ({ page }) => {
    const tags = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tags ?? [];
    });
    expect(tags).toContain('health');
  });

  test('tag persists across page reload', async ({ page }) => {
    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return (item?._goal?.tags ?? []).length > 0;
    });

    const tags = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tags ?? [];
    });
    expect(tags).toContain('health');
  });
});

// ── Goal tags — editing ───────────────────────────────────────────────────────

test.describe('Goal tags — editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoalWithTag(page, '#add-capstone', '#capstone-list', 'Healthy living', 'health');
  });

  test('edit dialog shows existing tag chip pre-populated', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');

    const chips = await page.evaluate(() =>
      [...document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tag-input').shadowRoot
        .querySelector('#tag-chips-wrap')
        .querySelectorAll('.tag-chip')]
        .map(c => c.dataset.tag)
    );
    expect(chips).toContain('health');
  });

  test('adding a second tag in edit dialog saves both tags', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');
    await addTagInDialog(page, 'fitness');
    await saveDialog(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return (item?._goal?.tags ?? []).length >= 2;
    });

    const tags = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tags ?? [];
    });
    expect(tags).toContain('health');
    expect(tags).toContain('fitness');
  });

  test('tapping a tag chip in the edit dialog removes it', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');

    // Tap the tag chip to remove it
    await page.evaluate(() => {
      const chip = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tag-input').shadowRoot
        .querySelector('#tag-chips-wrap .tag-chip');
      chip?.click();
    });

    // Chip should be gone from the dialog
    await page.waitForFunction(() => {
      const wrap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#tag-input')?.shadowRoot
        ?.querySelector('#tag-chips-wrap');
      return wrap?.querySelectorAll('.tag-chip').length === 0;
    });

    const chipsAfter = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tag-input').shadowRoot
        .querySelector('#tag-chips-wrap')
        .querySelectorAll('.tag-chip').length
    );
    expect(chipsAfter).toBe(0);
  });

  test('saving after tag removal persists the change', async ({ page }) => {
    await tapGoalItem(page, '#capstone-list');

    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tag-input').shadowRoot
        .querySelector('#tag-chips-wrap .tag-chip')?.click();
    });

    await page.waitForFunction(() => {
      const wrap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#tag-input')?.shadowRoot
        ?.querySelector('#tag-chips-wrap');
      return wrap?.querySelectorAll('.tag-chip').length === 0;
    });

    await saveDialog(page);

    await page.waitForFunction(() => {
      const item = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return (item?._goal?.tags ?? ['placeholder']).length === 0;
    });

    const tags = await page.evaluate(() => {
      const item = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item');
      return item?._goal?.tags ?? [];
    });
    expect(tags).toHaveLength(0);
  });
});

// ── Goal tags — filter chip in filter bar ────────────────────────────────────

test.describe('Goal tags — tag pills hidden when no tags', () => {
  test('tag pills are hidden on a goal without tags', async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);

    // Create goal with no tags
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#add-capstone').click();
    });
    await page.waitForFunction(() => {
      const d = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#modal')?.shadowRoot?.querySelector('dialog');
      return d?.open;
    });
    await page.evaluate(() => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#input');
      inp.value = 'No tags here';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#close').click();
    });
    await page.waitForFunction(() => {
      const list = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list');
      return list?.querySelectorAll('goal-item').length === 1;
    });

    const pillsState = await page.evaluate(() => {
      const el = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#capstone-list goal-item').shadowRoot
        .querySelector('.tag-pills');
      // getComputedStyle, not just .hidden: author CSS sets `display` on this
      // selector unconditionally, so the property alone can't prove it's gone.
      return { hidden: el?.hidden, display: getComputedStyle(el).display };
    });
    expect(pillsState.hidden).toBe(true);
    expect(pillsState.display).toBe('none');
  });
});
