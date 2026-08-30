// The five life-aspects an annual reflection scores, 1-5 each — the single
// source of truth for the aspect list, mirroring how color-palette.js
// centralizes COLOR_PALETTE and tracking.js centralizes TARGET_LIMITS.
// Nothing outside this file hardcodes the aspect list.
//
// `abbrKey` is a *separate* translatable string, not derived from `labelKey`
// at render time — English "Wealth"/"Wonder" both start with W, and slicing
// the full label would collide. A dedicated key lets each locale pick its
// own unambiguous short form instead of the code guessing one.
export const REFLECTION_ASPECTS = [
  { key: 'people',       labelKey: 'reflection.aspect-people-label',       hintKey: 'reflection.aspect-people-hint',       abbrKey: 'reflection.aspect-people-abbr' },
  { key: 'health',       labelKey: 'reflection.aspect-health-label',       hintKey: 'reflection.aspect-health-hint',       abbrKey: 'reflection.aspect-health-abbr' },
  { key: 'wealth',       labelKey: 'reflection.aspect-wealth-label',       hintKey: 'reflection.aspect-wealth-hint',       abbrKey: 'reflection.aspect-wealth-abbr' },
  { key: 'contribution', labelKey: 'reflection.aspect-contribution-label', hintKey: 'reflection.aspect-contribution-hint', abbrKey: 'reflection.aspect-contribution-abbr' },
  { key: 'wonder',       labelKey: 'reflection.aspect-wonder-label',       hintKey: 'reflection.aspect-wonder-hint',       abbrKey: 'reflection.aspect-wonder-abbr' },
];

// Plain average of whichever aspects have actually been rated (1-5 each) —
// a partially-rated report averages only what's set rather than treating
// the rest as zero. Undefined when nothing is rated yet, so callers can
// distinguish "no report for this year" from "report exists, nothing scored".
// Nothing outside this file computes the average inline.
export function aggregateScore(reflection) {
  const rated = REFLECTION_ASPECTS
    .map(a => reflection?.scores?.[a.key])
    .filter(v => typeof v === 'number' && v > 0);
  if (!rated.length) return undefined;
  return Math.round((rated.reduce((sum, v) => sum + v, 0) / rated.length) * 10) / 10;
}

// Per-aspect average across every OTHER year with a reflection — what the
// home-card's bar chart compares the current year against. `year` is excluded
// so a year is never averaged against itself; a year missing a given aspect
// simply doesn't contribute to that aspect's average (same "only average
// what's set" rule as aggregateScore — never treated as 0). An aspect with no
// historical data anywhere (e.g. the very first year ever reflected on) is
// omitted from the result entirely, not reported as 0, so callers can tell
// "nothing to compare against yet" apart from "the average is genuinely low".
export function historicalAspectAverages(reflections, year) {
  const yearKey = String(year);
  const sums = {};
  const counts = {};
  for (const [y, reflection] of Object.entries(reflections ?? {})) {
    if (y === yearKey) continue;
    for (const aspect of REFLECTION_ASPECTS) {
      const v = reflection?.scores?.[aspect.key];
      if (typeof v !== 'number' || v <= 0) continue;
      sums[aspect.key] = (sums[aspect.key] ?? 0) + v;
      counts[aspect.key] = (counts[aspect.key] ?? 0) + 1;
    }
  }
  const averages = {};
  for (const aspect of REFLECTION_ASPECTS) {
    if (counts[aspect.key]) averages[aspect.key] = sums[aspect.key] / counts[aspect.key];
  }
  return averages;
}
