// Exploratory data-volume stress test — NOT part of the CI-gated suite.
//
// Not picked up by `npm test` / `npm run test:e2e` (playwright.config.js's
// testDir is tests/e2e). Run explicitly:
//
//   npx playwright test tests/perf/data-volume-stress.spec.js
//
// Seeds IndexedDB directly (bypassing the UI, same pattern as
// tests/e2e/persistence.spec.js) with a real personal .telos backup scaled up
// SCALE times, then logs render/filter/edit timings to the console. No pass/fail
// budgets — read the numbers, decide what (if anything) is worth turning into a
// permanent regression test.
//
// Requires a real .telos backup as a seed. Point TELOS_SEED_FILE at one, or
// drop it at the repo root — .telos files are gitignored, so this only runs
// where someone has supplied real data locally.

import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  waitForPage as waitForHomePage,
  waitForListsPage,
  waitForListDetailPage,
  waitForIDBFlush,
} from '../e2e/helpers.js';

const SCALE = Number(process.env.TELOS_STRESS_SCALE ?? 6); // requested range was 5-7x; 6 is the midpoint
const SEED_FILE = process.env.TELOS_SEED_FILE
  ?? path.resolve(process.cwd(), '202608010010_telos-all.telos');

function loadSeedPayload() {
  if (!existsSync(SEED_FILE)) {
    throw new Error(
      `Seed file not found at ${SEED_FILE}. Set TELOS_SEED_FILE to a real .telos backup, ` +
      `or place one at the repo root.`
    );
  }
  const json = execFileSync('unzip', ['-p', SEED_FILE, 'data.json'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  const envelope = JSON.parse(json);
  return envelope.events[0].payload;
}

// Tiles the real dataset SCALE times: lists get cloned with fresh ids (items'
// inGoals cleared on clones, since they'd point at goal ids that only exist in
// the one untouched copy); goal years are tiled backward in time so the most
// recent, untouched copy keeps its real years/ids (so "current year" stays
// meaningful) while older synthetic copies extend history further into the past.
function scaleDataset(payload, scale) {
  const origLists = payload.lists ?? [];
  const origGoals = payload.goals ?? {};
  const origYears = Object.keys(origGoals).sort();

  const lists = [];
  for (let c = 0; c < scale; c++) {
    const isOriginal = c === scale - 1;
    for (const list of origLists) {
      lists.push({
        ...list,
        id: isOriginal ? list.id : `${list.id}-c${c}`,
        name: isOriginal ? list.name : `${list.name} (${c + 1})`,
        items: list.items.map(item => ({
          ...item,
          id: isOriginal ? item.id : `${item.id}-c${c}`,
          inGoals: isOriginal ? item.inGoals : [],
        })),
      });
    }
  }

  const goals = {};
  for (let c = 0; c < scale; c++) {
    const isOriginal = c === scale - 1;
    const shiftYears = (scale - 1 - c) * origYears.length;
    for (const year of origYears) {
      const newYear = isOriginal ? year : String(Number(year) - shiftYears);
      const clonedSections = {};
      for (const [section, arr] of Object.entries(origGoals[year])) {
        clonedSections[section] = arr.map(g => ({
          ...g,
          id: isOriginal ? g.id : `${g.id}-c${c}`,
        }));
      }
      goals[newYear] = clonedSections;
    }
  }

  return { lists, goals };
}

test.describe('Data-volume stress (exploratory, not CI-gated)', () => {
  test('renders under a scaled real-world dataset', async ({ page }) => {
    const payload = loadSeedPayload();
    const { lists, goals } = scaleDataset(payload, SCALE);
    const totalItems = lists.reduce((n, l) => n + l.items.length, 0);
    const totalGoals = Object.values(goals)
      .reduce((n, sections) => n + Object.values(sections).reduce((m, arr) => m + arr.length, 0), 0);
    const largestList = [...lists].sort((a, b) => b.items.length - a.items.length)[0];

    console.log(
      `[seed] scale=${SCALE}x -> ${lists.length} lists, ${totalItems} items, ` +
      `${Object.keys(goals).length} years, ${totalGoals} goals. ` +
      `Largest list "${largestList.name}" = ${largestList.items.length} items.`
    );

    // First real boot creates the IDB schema before we write into it directly.
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await waitForHomePage(page);

    await page.evaluate(({ lists, goals }) => new Promise((res, rej) => {
      const r = indexedDB.open('telos', 1);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('state', 'readwrite');
        const os = tx.objectStore('state');
        const g = os.get('root');
        g.onsuccess = () => os.put({ id: 'root', data: { ...(g.result?.data ?? {}), lists, goals } });
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      };
      r.onerror = () => rej(r.error);
    }), { lists, goals });

    // Cold boot -> home-page render, from persisted (not live-set) state.
    let t0 = Date.now();
    await page.reload();
    await waitForHomePage(page);
    console.log(`[timing] cold boot -> home-page render: ${Date.now() - t0}ms`);

    // Lists overview render, all lists.
    t0 = Date.now();
    await page.evaluate(() => document.querySelector('bottom-nav').shadowRoot.querySelector('#pill-lists').click());
    await waitForListsPage(page);
    await page.waitForFunction((n) => {
      const c = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('lists-page')?.shadowRoot?.querySelector('#list-container');
      return !!c && c.children.length >= n;
    }, lists.length);
    console.log(`[timing] lists overview render (${lists.length} lists): ${Date.now() - t0}ms`);

    // Single largest-list detail render.
    t0 = Date.now();
    await page.goto(`/lists/${largestList.id}`);
    await waitForListDetailPage(page);
    await page.waitForFunction((n) => {
      const c = document.querySelector('app-router')?.shadowRoot
        ?.querySelector('list-detail-page')?.shadowRoot?.querySelector('#item-list');
      return !!c && c.children.length >= n;
    }, largestList.items.length);
    console.log(`[timing] largest list detail render (${largestList.items.length} items): ${Date.now() - t0}ms`);

    // In-list status filter re-render.
    t0 = Date.now();
    await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot;
      sr.querySelector('#filter-btn').click();
      sr.querySelector('#filter-expand-btn').click();
      sr.querySelector('#fstatus-open').click();
    });
    await page.waitForFunction(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot;
      return sr.querySelector('#fstatus-open')?.getAttribute('aria-pressed') === 'true';
    });
    console.log(`[timing] status filter apply: ${Date.now() - t0}ms`);

    // Clear the filter before the edit-round-trip timing below, so it's not
    // measuring a filtered (smaller) re-render on top of the write.
    await page.evaluate(() => {
      document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot.querySelector('#filter-clear-btn').click();
    });

    // Single-item status edit -> store write -> IDB flush round trip.
    t0 = Date.now();
    await page.evaluate(() => {
      const sr = document.querySelector('app-router').shadowRoot
        .querySelector('list-detail-page').shadowRoot;
      sr.querySelector('#item-list list-item')?.shadowRoot.querySelector('#badge-btn')?.click();
    });
    await waitForIDBFlush(page);
    console.log(`[timing] single-item edit -> IDB flush round trip: ${Date.now() - t0}ms`);
  });
});
