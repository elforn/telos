function tagHue(tag) {
  let h = 2166136261; // FNV-1a offset basis — better distribution for short strings
  for (const c of tag) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

// One hash-derived hue per tag, semi-transparent so the pills harmonise with
// any row background. Both row types (goal-item, list-item) render tags as a
// row of pill dots and read this directly — a `tagStrip(tags)` gradient
// helper lived here while goal-item still drew a full-width bottom-edge
// strip, and went with it.
export function tagColor(tag) {
  return `hsla(${tagHue(tag)}, 50%, 58%, 0.8)`;
}
