import { test, expect } from '@playwright/test';
import { waitForPage, waitForIDBFlush } from './helpers.js';

const currentYear = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clickFilterBtn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#header').shadowRoot
      .querySelector('#filter-btn').click();
  });
}

async function openFilterBar(page) {
  await clickFilterBtn(page);
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#filter-bar')?.hidden
  );
}

async function clickExpandBtn(page) {
  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#filter-expand-btn').click();
  });
}

async function openFilterPanel(page) {
  await clickExpandBtn(page);
  await page.waitForFunction(() =>
    !document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector('#filter-panel')?.hidden
  );
}

async function typeInFilter(page, text) {
  await page.evaluate(q => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('#filter-search');
    inp.value = q;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function createGoal(page, addId, listId, title, tag = null) {
  const countBefore = await page.evaluate(id =>
    document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0
  , listId);

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

  await page.evaluate(t => {
    const inp = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#input');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, title);

  if (tag) {
    await page.evaluate(tagVal => {
      const inp = document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('goal-dialog').shadowRoot
        .querySelector('#tag-input');
      inp.value = tagVal;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    }, tag);

    await page.waitForFunction(tagVal => {
      const wrap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('goal-dialog')?.shadowRoot
        ?.querySelector('#tag-chips-wrap');
      return [...(wrap?.querySelectorAll('.tag-chip') ?? [])]
        .some(c => c.textContent.includes(tagVal));
    }, tag);
  }

  await page.evaluate(() => {
    document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector('goal-dialog').shadowRoot
      .querySelector('#close').click();
  });

  await page.waitForFunction(([id, count]) =>
    (document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(id)?.querySelectorAll('goal-item').length ?? 0) >= count
  , [listId, countBefore + 1]);
}

async function getGoalVisibility(page, listId) {
  return page.evaluate(id =>
    [...(document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(id)
      ?.querySelectorAll('goal-item') ?? [])]
      .map(el => ({ title: el._goal?.title ?? '', hidden: el.hidden }))
  , listId);
}

async function pressBarKey(page, listId, key, times = 1) {
  await page.evaluate(([id, k, n]) => {
    const bar = document.querySelector('app-router').shadowRoot
      .querySelector('home-page').shadowRoot
      .querySelector(`${id} goal-item`)?.shadowRoot
      ?.querySelector('.bar');
    for (let i = 0; i < n; i++) {
      bar?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    }
  }, [listId, key, times]);
}

async function waitForProgress(page, listId, pct) {
  await page.waitForFunction(([id, p]) => {
    const item = document.querySelector('app-router')?.shadowRoot
      ?.querySelector('home-page')?.shadowRoot
      ?.querySelector(`${id} goal-item`);
    return (item?._goal?.percentage ?? -1) === p;
  }, [listId, pct]);
}

// ── Filter bar toggle ─────────────────────────────────────────────────────────

test.describe('Goals — filter bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
  });

  test('filter bar is hidden on initial load', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(true);
  });

  test('filter button opens the filter bar', async ({ page }) => {
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(false);
  });

  test('filter button closes the filter bar when clicked again', async ({ page }) => {
    await openFilterBar(page);
    await clickFilterBtn(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(true);
  });
});

// ── Filter panel ──────────────────────────────────────────────────────────────

test.describe('Goals — filter panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await openFilterBar(page);
  });

  test('filter panel is hidden when filter bar first opens', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });

  test('expand button opens the filter panel', async ({ page }) => {
    await openFilterPanel(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(false);
  });

  test('expand button closes the filter panel when clicked again', async ({ page }) => {
    await openFilterPanel(page);
    await clickExpandBtn(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-panel')?.hidden === true
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });

  test('expand button has aria-controls pointing to filter-panel', async ({ page }) => {
    const ariaControls = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-expand-btn').getAttribute('aria-controls')
    );
    expect(ariaControls).toBe('filter-panel');
  });

  test('closing the filter bar collapses the filter panel', async ({ page }) => {
    await openFilterPanel(page);
    await clickFilterBtn(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(true);
  });
});

// ── Text search ───────────────────────────────────────────────────────────────

test.describe('Goals — text search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoal(page, '#add-capstone', '#capstone-list', 'Run a marathon');
    await createGoal(page, '#add-milestone', '#milestone-list', 'Complete a 10K');
    await openFilterBar(page);
  });

  test('text search hides non-matching goals', async ({ page }) => {
    await typeInFilter(page, 'marathon');
    await page.waitForFunction(() => {
      const milestone = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list goal-item');
      return milestone !== null && milestone.hidden === true;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    expect(capstone.find(g => g.title === 'Run a marathon')?.hidden).toBe(false);
    expect(milestone.find(g => g.title === 'Complete a 10K')?.hidden).toBe(true);
  });

  test('no-match message appears when no goals match', async ({ page }) => {
    await typeInFilter(page, 'zzznomatch');
    await page.waitForFunction(() =>
      !document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-empty')?.hidden
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-empty').hidden
    );
    expect(hidden).toBe(false);
  });

  test('live region announces match count when filter is active', async ({ page }) => {
    await typeInFilter(page, 'marathon');
    await page.waitForFunction(() => {
      const live = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-live');
      return live?.textContent?.trim().length > 0;
    });
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-live').textContent
    );
    expect(text).toContain('1');
  });

  test('live region is empty when no filter is active', async ({ page }) => {
    const text = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-live').textContent
    );
    expect(text).toBe('');
  });

  test('clear button resets the text filter', async ({ page }) => {
    await typeInFilter(page, 'marathon');
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-clear-btn').click();
    });
    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-search').value
    );
    expect(val).toBe('');
  });
});

// ── State pills ───────────────────────────────────────────────────────────────

test.describe('Goals — state pills', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoal(page, '#add-capstone',  '#capstone-list',  'Not started goal');
    await createGoal(page, '#add-milestone', '#milestone-list', 'Ongoing goal');
    await createGoal(page, '#add-wow',       '#wow-list',       'Done goal');
    // milestone → 5% (ongoing)
    await pressBarKey(page, '#milestone-list', 'ArrowRight', 1);
    await waitForProgress(page, '#milestone-list', 5);
    // wow → 100% (done)
    await pressBarKey(page, '#wow-list', 'ArrowRight', 20);
    await waitForProgress(page, '#wow-list', 100);
    await openFilterBar(page);
    await openFilterPanel(page);
  });

  test('done pill shows only 100% goals', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').click();
    });
    await page.waitForFunction(() => {
      const cap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return cap !== null && cap.hidden === true;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    const wow       = await getGoalVisibility(page, '#wow-list');
    expect(capstone[0]?.hidden).toBe(true);
    expect(milestone[0]?.hidden).toBe(true);
    expect(wow[0]?.hidden).toBe(false);
  });

  test('ongoing pill shows only in-progress goals', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-ongoing').click();
    });
    await page.waitForFunction(() => {
      const cap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return cap !== null && cap.hidden === true;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    const wow       = await getGoalVisibility(page, '#wow-list');
    expect(capstone[0]?.hidden).toBe(true);
    expect(milestone[0]?.hidden).toBe(false);
    expect(wow[0]?.hidden).toBe(true);
  });

  test('not-started pill shows only 0% goals', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-not-started').click();
    });
    await page.waitForFunction(() => {
      const milestone = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list goal-item');
      return milestone !== null && milestone.hidden === true;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    const wow       = await getGoalVisibility(page, '#wow-list');
    expect(capstone[0]?.hidden).toBe(false);
    expect(milestone[0]?.hidden).toBe(true);
    expect(wow[0]?.hidden).toBe(true);
  });

  test('active state pill has aria-pressed="true"', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').click();
    });
    const pressed = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').getAttribute('aria-pressed')
    );
    expect(pressed).toBe('true');
  });

  test('clear button shows all goals again', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#fstate-done').click();
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-clear-btn').click();
    });
    await page.waitForFunction(() => {
      const cap = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#capstone-list goal-item');
      return cap !== null && cap.hidden === false;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    const wow       = await getGoalVisibility(page, '#wow-list');
    expect(capstone[0]?.hidden).toBe(false);
    expect(milestone[0]?.hidden).toBe(false);
    expect(wow[0]?.hidden).toBe(false);
  });
});

// ── Tag filter ────────────────────────────────────────────────────────────────

test.describe('Goals — tag filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoal(page, '#add-capstone',  '#capstone-list',  'Health goal', 'health');
    await createGoal(page, '#add-milestone', '#milestone-list', 'Work goal');
    await openFilterBar(page);
    await openFilterPanel(page);
    // Wait for tag chips to be rendered
    await page.waitForFunction(() => {
      const row = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-tag-row');
      return !row?.hidden && row?.querySelector('.filter-tag-chip') !== null;
    });
  });

  test('tag row is visible when goals have tags', async ({ page }) => {
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row').hidden
    );
    expect(hidden).toBe(false);
  });

  test('tag chip for the goal tag is rendered', async ({ page }) => {
    const tags = await page.evaluate(() =>
      [...document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row')
        .querySelectorAll('.filter-tag-chip')]
        .map(c => c.dataset.tag)
    );
    expect(tags).toContain('health');
  });

  test('tag chip filters goals to show only the tagged goal', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').click();
    });
    await page.waitForFunction(() => {
      const ms = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#milestone-list goal-item');
      return ms !== null && ms.hidden === true;
    });
    const capstone  = await getGoalVisibility(page, '#capstone-list');
    const milestone = await getGoalVisibility(page, '#milestone-list');
    expect(capstone[0]?.hidden).toBe(false);
    expect(milestone[0]?.hidden).toBe(true);
  });

  test('active tag chip has aria-pressed="true"', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').click();
    });
    const pressed = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').getAttribute('aria-pressed')
    );
    expect(pressed).toBe('true');
  });

  test('clear button deactivates tag chip', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').click();
    });
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-clear-btn').click();
    });
    const pressed = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').getAttribute('aria-pressed')
    );
    expect(pressed).toBe('false');
  });

  test('filter panel stays open when bar is reopened with active tag filter', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-tag-row .filter-tag-chip').click();
    });
    await clickFilterBtn(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden === true
    );
    await openFilterBar(page);
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-panel').hidden
    );
    expect(hidden).toBe(false);
  });
});

// ── Filter persistence ────────────────────────────────────────────────────────

test.describe('Goals — filter persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${currentYear}`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForPage(page);
    await createGoal(page, '#add-capstone', '#capstone-list', 'My goal');
  });

  test('text search query persists across page reload', async ({ page }) => {
    await openFilterBar(page);
    await typeInFilter(page, 'my goal');
    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-search')?.value === 'my goal'
    );
    const val = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-search').value
    );
    expect(val).toBe('my goal');
  });

  test('filter bar open state persists across page reload', async ({ page }) => {
    await openFilterBar(page);
    await waitForIDBFlush(page);
    await page.reload();
    await waitForPage(page);
    await page.waitForFunction(() =>
      !document.querySelector('app-router')?.shadowRoot
        ?.querySelector('home-page')?.shadowRoot
        ?.querySelector('#filter-bar')?.hidden
    );
    const hidden = await page.evaluate(() =>
      document.querySelector('app-router').shadowRoot
        .querySelector('home-page').shadowRoot
        .querySelector('#filter-bar').hidden
    );
    expect(hidden).toBe(false);
  });
});
