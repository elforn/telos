const MAX_SEGMENTS = 6;

function tagHue(tag) {
  let h = 2166136261; // FNV-1a offset basis — better distribution for short strings
  for (const c of tag) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

// Same palette for both chips and strip — semi-transparent so they harmonise with any background
function _stripColor(tag) {
  return `hsla(${tagHue(tag)}, 50%, 58%, 0.8)`;
}

export function tagColor(tag) {
  return _stripColor(tag);
}

export function tagStrip(tags) {
  const shown = tags.slice(0, MAX_SEGMENTS);
  if (!shown.length) return '';
  if (shown.length === 1) return _stripColor(shown[0]);
  const stops = shown.map((tag, i) => {
    const p0 = (i / shown.length * 100).toFixed(1);
    const p1 = ((i + 1) / shown.length * 100).toFixed(1);
    return `${_stripColor(tag)} ${p0}% ${p1}%`;
  }).join(', ');
  return `linear-gradient(to right, ${stops})`;
}
