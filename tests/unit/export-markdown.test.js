import { describe, it, expect } from 'vitest';
import {
  exportGoalsMarkdown,
  exportListMarkdown,
  exportItemsMarkdown,
} from '../../app/utils/export-markdown.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const YEAR = '2026';

const GOALS = {
  capstone:  [{ id: '1', title: 'Ship it', percentage: 60, tags: ['work'] }],
  milestones: [
    { id: '2', title: 'MVP done',  percentage: 100, tags: [] },
    { id: '3', title: 'Beta live', percentage: 0,   tags: ['work', 'q2'], notes: 'Need testers' },
  ],
  wow:   [],
  focus: [],
};

const GOALS_WITH_NOTES = {
  capstone: [{ id: '1', title: 'Ship it', percentage: 100, tags: ['work'], notes: 'Make it happen' }],
  milestones: [{ id: '2', title: 'MVP done', percentage: 50, tags: [], notes: undefined }],
  wow: [], focus: [],
};

const LIST = {
  name: 'Gift Ideas',
  items: [
    { id: 'a', title: 'Headphones', status: 'done',   tags: ['tech'],   note: undefined,    url: undefined,             dueDate: undefined },
    { id: 'b', title: 'Running shoes', status: 'open', tags: [],        note: 'Nike ones',  url: 'https://example.com', dueDate: '2026-07-03' },
    { id: 'c', title: 'Coffee machine', status: 'paused', tags: ['home'], note: undefined, url: undefined,             dueDate: undefined },
  ],
};

// ── Goals, no notes, no metadata ─────────────────────────────────────────────

describe('goals, no notes, no metadata', () => {
  it('outputs year heading', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).toContain('# 2026');
  });

  it('outputs section headings for non-empty sections only', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).toContain('## Capstone');
    expect(out).toContain('## 3 Month Milestones');
    expect(out).not.toContain('## 8 Week Wow Moments');
    expect(out).not.toContain('## Focus');
  });

  it('marks 100% goals with ✅', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).toContain('- ✅ MVP done');
  });

  it('outputs in-progress goals with no marker', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).toContain('- Ship it');
    expect(out).not.toContain('[60%]');
  });

  it('does not include tags', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).not.toContain('(work)');
  });

  it('uses bullet list format (no --- separators)', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, {});
    expect(out).not.toContain('---');
  });
});

// ── Goals, no notes, metadata ─────────────────────────────────────────────────

describe('goals, no notes, metadata', () => {
  it('shows percentage for in-progress goals', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, { metadata: true });
    expect(out).toContain('- [60%] Ship it');
  });

  it('shows ✅ for 100% goals', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, { metadata: true });
    expect(out).toContain('- ✅ MVP done');
  });

  it('includes tags when present', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, { metadata: true });
    expect(out).toContain('(work)');
  });

  it('skips tags when absent', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, { metadata: true });
    expect(out).toContain('- ✅ MVP done');
    expect(out).not.toMatch(/MVP done \(/);
  });

  it('uses bullet list format', () => {
    const out = exportGoalsMarkdown(GOALS, YEAR, { metadata: true });
    expect(out).not.toContain('---');
  });
});

// ── Goals, notes, no metadata ─────────────────────────────────────────────────

describe('goals, notes, no metadata', () => {
  it('uses content format with --- separators', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true });
    expect(out).toContain('---');
  });

  it('uses ### for goal headings', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true });
    expect(out).toContain('### ✅ Ship it');
  });

  it('includes note text verbatim', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true });
    expect(out).toContain('Make it happen');
  });

  it('renders goals without notes with only the title separator, no trailing ---', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true });
    expect(out).toContain('### MVP done');
    const idx   = out.indexOf('### MVP done\n---');
    expect(idx).toBeGreaterThan(-1);
    // No blank line + --- immediately after the heading separator
    const after = out.slice(idx + '### MVP done\n---'.length);
    expect(after.startsWith('\n\n---')).toBe(false);
  });

  it('does not include percentage in content', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true });
    expect(out).not.toContain('[100%]');
  });
});

// ── Goals, notes, metadata ────────────────────────────────────────────────────

describe('goals, notes, metadata', () => {
  it('shows [100%] in metadata line for done goals, not a second ✅', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true, metadata: true });
    expect(out).toContain('### ✅ Ship it');
    expect(out).toContain('[100%]');
    // Only one ✅ — in the heading, not in the metadata line
    const lines = out.split('\n');
    const metaLine = lines.find(l => l.startsWith('[100%]'));
    expect(metaLine).toBeDefined();
    expect(metaLine).not.toContain('✅');
  });

  it('includes tags on the metadata line', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true, metadata: true });
    expect(out).toContain('[100%] - (work)');
  });

  it('omits tag part when tags are empty', () => {
    const out = exportGoalsMarkdown(GOALS_WITH_NOTES, YEAR, { notes: true, metadata: true });
    expect(out).toContain('[50%]');
    expect(out).not.toMatch(/\[50%\] - \(/);
  });
});

// ── Lists, no notes, no metadata ─────────────────────────────────────────────

describe('lists, no notes, no metadata', () => {
  it('outputs list name as heading', () => {
    const out = exportListMarkdown(LIST, {});
    expect(out).toContain('# Gift Ideas');
  });

  it('marks done items with ✅', () => {
    const out = exportListMarkdown(LIST, {});
    expect(out).toContain('- ✅ Headphones');
  });

  it('outputs open and paused items with no marker', () => {
    const out = exportListMarkdown(LIST, {});
    expect(out).toContain('- Running shoes');
    expect(out).toContain('- Coffee machine');
    expect(out).not.toContain('[ ]');
    expect(out).not.toContain('[-]');
  });

  it('does not include note, url, or due date', () => {
    const out = exportListMarkdown(LIST, {});
    expect(out).not.toContain('Nike ones');
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('Due:');
  });
});

// ── Lists, no notes, metadata ─────────────────────────────────────────────────

describe('lists, no notes, metadata', () => {
  it('shows ✅ for done items', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).toContain('- ✅ Headphones (tech)');
  });

  it('shows [ ] for open items', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).toContain('- [ ] Running shoes');
  });

  it('shows [-] for paused items', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).toContain('- [-] Coffee machine (home)');
  });

  it('includes due date', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).toContain('Due: 2026.07.03');
  });

  it('converts date separators from - to .', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).not.toContain('2026-07-03');
    expect(out).toContain('2026.07.03');
  });

  it('does not include notes or url', () => {
    const out = exportListMarkdown(LIST, { metadata: true });
    expect(out).not.toContain('Nike ones');
    expect(out).not.toContain('example.com');
  });
});

// ── Lists, notes, no metadata ─────────────────────────────────────────────────

describe('lists, notes, no metadata', () => {
  it('uses content format with --- separators', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).toContain('---');
  });

  it('uses ## for item headings', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).toContain('## ✅ Headphones');
    expect(out).toContain('## Running shoes');
  });

  it('includes note content', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).toContain('Nike ones');
  });

  it('includes url with URL: prefix', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).toContain('URL: https://example.com');
  });

  it('renders items with no note or url with only the title separator, no trailing ---', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).toContain('## ✅ Headphones');
    const idx   = out.indexOf('## ✅ Headphones\n---');
    expect(idx).toBeGreaterThan(-1);
    const after = out.slice(idx + '## ✅ Headphones\n---'.length);
    expect(after.startsWith('\n\n---')).toBe(false);
  });

  it('does not include status markers (no metadata)', () => {
    const out = exportListMarkdown(LIST, { notes: true });
    expect(out).not.toContain('[ ]');
    expect(out).not.toContain('[-]');
  });
});

// ── Lists, notes, metadata ────────────────────────────────────────────────────

describe('lists, notes, metadata', () => {
  it('includes status markers in headings', () => {
    const out = exportListMarkdown(LIST, { notes: true, metadata: true });
    expect(out).toContain('## ✅ Headphones');
    expect(out).toContain('## [ ] Running shoes');
    expect(out).toContain('## [-] Coffee machine');
  });

  it('includes due date on metadata line', () => {
    const out = exportListMarkdown(LIST, { notes: true, metadata: true });
    expect(out).toContain('Due: 2026.07.03');
  });

  it('includes Paused label for paused items', () => {
    const out = exportListMarkdown(LIST, { notes: true, metadata: true });
    expect(out).toContain('Paused');
  });

  it('includes note content', () => {
    const out = exportListMarkdown(LIST, { notes: true, metadata: true });
    expect(out).toContain('Nike ones');
  });

  it('includes url with URL: prefix', () => {
    const out = exportListMarkdown(LIST, { notes: true, metadata: true });
    expect(out).toContain('URL: https://example.com');
  });
});

// ── exportItemsMarkdown (multi-select subset) ─────────────────────────────────

describe('exportItemsMarkdown (multi-select)', () => {
  it('uses the provided title as the heading', () => {
    const items = LIST.items.slice(0, 2);
    const out = exportItemsMarkdown(items, 'My Selection', {});
    expect(out).toContain('# My Selection');
    expect(out).not.toContain('# Gift Ideas');
  });

  it('only includes the provided items', () => {
    const items = [LIST.items[0]];
    const out = exportItemsMarkdown(items, 'Gift Ideas', {});
    expect(out).toContain('Headphones');
    expect(out).not.toContain('Running shoes');
  });
});
