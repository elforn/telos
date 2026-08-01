// Turns free text (one item per line, indented lines become notes) into
// draft ListItem rows: { title, note, url }. Shared by list-detail-page's
// "Add from text" menu action and the import-text-dialog component (used
// for both that flow and the Share Target text/URL landing).
export function parseImportText(text) {
  const TITLE_MAX = 120;
  const BULLET_RE = /^[\-\*\•]\s+/;
  const URL_RE    = /https?:\/\/\S+/g;

  const rawItems = [];
  let current = null;

  for (const line of text.split('\n')) {
    const isIndented = /^[ \t]/.test(line) && line.trim() !== '';
    if (isIndented) {
      if (current) {
        current.continuationLines.push(line.trim().replace(BULLET_RE, ''));
      }
    } else {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (current) rawItems.push(current);
      current = { titleRaw: trimmed.replace(BULLET_RE, '').trim(), continuationLines: [] };
    }
  }
  if (current) rawItems.push(current);

  return rawItems.map(({ titleRaw, continuationLines }) => {
    const tooLong = titleRaw.length > TITLE_MAX;
    let title = titleRaw;
    if (tooLong) {
      const candidate = titleRaw.slice(0, TITLE_MAX);
      const lastSpace = candidate.lastIndexOf(' ');
      title = lastSpace > TITLE_MAX / 2 ? candidate.slice(0, lastSpace) : candidate;
    }

    const noteParts = [];
    if (tooLong) noteParts.push(titleRaw);
    noteParts.push(...continuationLines);
    const note = noteParts.length ? noteParts.join('\n') : undefined;

    const allText = [titleRaw, ...continuationLines].join('\n');
    const urls = allText.match(URL_RE) ?? [];
    const url  = urls.length ? urls[urls.length - 1].replace(/[.,;:!?)"']+$/, '') : undefined;

    return { title, note, url };
  });
}
