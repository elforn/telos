// Folds a Share Target payload's { title, text, url } fields into one string
// for import-text-dialog's textarea — no attempt to detect single- vs
// multi-item text; the result is just a starting point the user edits before
// confirming (see CLAUDE.md § Sharing).
//
// Rule (deterministic, same every time):
//   - title present: it's the one unindented line (parseImportText treats an
//     unindented line as the start of a new item) — text (every line) and
//     url, if present, follow indented beneath it, so the parser folds them
//     into that single item's note rather than starting new items.
//   - title absent: text is used as-is (preserves its own multi-item
//     splitting), falling back to a bare url.
export function combineSharedText({ title, text, url } = {}) {
  const titleLine = (title ?? '').trim();
  const bodyText  = (text ?? '').trim();
  const linkText  = (url ?? '').trim();

  if (!titleLine) return bodyText || linkText || '';

  const indented = [];
  if (bodyText) indented.push(...bodyText.split('\n').map(line => `  ${line}`));
  if (linkText && !bodyText.includes(linkText)) indented.push(`  ${linkText}`);

  return [titleLine, ...indented].join('\n');
}
