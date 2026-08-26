import { t } from '../../_lib/core/strings.js';

// Shared 8-swatch palette (null = "no colour") — the single source of truth
// for every colour swipe-cycle and swatch picker in the app (lists, goals,
// items). `null` must stay first: colour-cycling always starts from "no
// colour" and cycling forward from the last real swatch wraps back to it.
export const COLOR_PALETTE = [null, '#E5534B', '#E07633', '#D4A928', '#3DAD6A', '#29A8A1', '#4A94D4', '#8B67D6'];

// i18n keys parallel COLOR_PALETTE — update both together when adding/removing colours.
const COLOR_LABEL_KEYS = [
  'color-picker.none', 'color-picker.red', 'color-picker.orange', 'color-picker.yellow',
  'color-picker.green', 'color-picker.teal', 'color-picker.blue', 'color-picker.purple',
];

// Resolves fresh on every call (not cached) so it reflects the active locale —
// call from inside template(), never store the result at module scope.
export function swatches() {
  return COLOR_PALETTE.map((color, i) => ({ color, label: t(COLOR_LABEL_KEYS[i]) }));
}

// Advances `current` to the next colour in the palette, wrapping around —
// shared by every swipe-to-cycle gesture (lists, goals, items).
export function nextColor(current) {
  const idx = COLOR_PALETTE.findIndex(c => c === (current ?? null));
  return COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length];
}
