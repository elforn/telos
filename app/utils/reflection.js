// The five life-aspects an annual reflection scores, 1-5 each — the single
// source of truth for the aspect list, mirroring how color-palette.js
// centralizes COLOR_PALETTE and tracking.js centralizes TARGET_LIMITS.
// Nothing outside this file hardcodes the aspect list.
export const REFLECTION_ASPECTS = [
  { key: 'people',       labelKey: 'reflection.aspect-people-label',       hintKey: 'reflection.aspect-people-hint' },
  { key: 'health',       labelKey: 'reflection.aspect-health-label',       hintKey: 'reflection.aspect-health-hint' },
  { key: 'wealth',       labelKey: 'reflection.aspect-wealth-label',       hintKey: 'reflection.aspect-wealth-hint' },
  { key: 'contribution', labelKey: 'reflection.aspect-contribution-label', hintKey: 'reflection.aspect-contribution-hint' },
  { key: 'wonder',       labelKey: 'reflection.aspect-wonder-label',       hintKey: 'reflection.aspect-wonder-hint' },
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
