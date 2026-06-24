const SECTION_LABELS = {
  capstone:   'Capstone',
  milestones: '3 Month Milestones',
  wow:        '8 Week Wow Moments',
  focus:      'Focus',
};

const SECTIONS = ['capstone', 'milestones', 'wow', 'focus'];

function _formatDate(iso) {
  return iso ? iso.replace(/-/g, '.') : null;
}

function _tags(tags) {
  return tags?.length ? `(${tags.join(', ')})` : null;
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function _goalListLine(goal, metadata) {
  const done = goal.percentage === 100;
  if (metadata) {
    const pct  = done ? '✅' : `[${goal.percentage}%]`;
    const tags = _tags(goal.tags);
    return `- ${pct} ${goal.title}${tags ? ` ${tags}` : ''}`;
  }
  return done ? `- ✅ ${goal.title}` : `- ${goal.title}`;
}

function _goalContentBlock(goal, metadata) {
  const done   = goal.percentage === 100;
  const prefix = done ? '✅ ' : '';
  const lines  = [`### ${prefix}${goal.title}`, '---'];
  let hasBody  = false;

  if (metadata) {
    const pct  = `[${goal.percentage}%]`;
    const tags = _tags(goal.tags);
    lines.push('', `${pct}${tags ? ` - ${tags}` : ''}`);
    hasBody = true;
  }

  if (goal.notes) { lines.push('', goal.notes); hasBody = true; }
  if (hasBody) lines.push('', '---');
  return lines.join('\n');
}

export function exportGoalsMarkdown(yearGoals, year, { metadata = false, notes = false } = {}) {
  const lines = [`# ${year}`];

  for (const section of SECTIONS) {
    const goals = yearGoals?.[section] ?? [];
    if (!goals.length) continue;

    const label = SECTION_LABELS[section];

    if (notes) {
      lines.push('', `## ${label}`, '---');
      for (const goal of goals) {
        lines.push('', _goalContentBlock(goal, metadata));
      }
    } else {
      lines.push('', `## ${label}`, '');
      for (const goal of goals) {
        lines.push(_goalListLine(goal, metadata));
      }
    }
  }

  return lines.join('\n');
}

// ── Lists ─────────────────────────────────────────────────────────────────────

function _itemListLine(item, metadata) {
  const done = item.status === 'done';
  if (metadata) {
    const marker = done ? '✅' : item.status === 'paused' ? '[-]' : '[ ]';
    const tags   = _tags(item.tags);
    const due    = item.dueDate ? `Due: ${_formatDate(item.dueDate)}` : null;
    const parts  = [tags, due].filter(Boolean);
    const suffix = parts.length ? ` ${parts.join(' ')}` : '';
    return `- ${marker} ${item.title}${suffix}`;
  }
  return done ? `- ✅ ${item.title}` : `- ${item.title}`;
}

function _itemContentBlock(item, metadata) {
  const done = item.status === 'done';
  const marker = done ? '✅ ' : item.status === 'paused' ? '[-] ' : '[ ] ';
  const prefix = metadata ? marker : (done ? '✅ ' : '');
  const lines  = [`## ${prefix}${item.title}`, '---'];

  let hasBody = false;

  if (metadata) {
    const due    = item.dueDate ? `Due: ${_formatDate(item.dueDate)}` : null;
    const tags   = _tags(item.tags);
    const paused = item.status === 'paused' ? 'Paused' : null;
    const parts  = [due, tags, paused].filter(Boolean);
    if (parts.length) { lines.push('', parts.join(' - ')); hasBody = true; }
  }

  if (item.note)  { lines.push('', item.note);          hasBody = true; }
  if (item.url)   { lines.push('', `URL: ${item.url}`); hasBody = true; }
  if (hasBody) lines.push('', '---');
  return lines.join('\n');
}

function _exportItems(items, title, { metadata = false, notes = false } = {}) {
  if (notes) {
    const lines = [`# ${title}`, '---'];
    for (const item of items) {
      lines.push('', _itemContentBlock(item, metadata));
    }
    return lines.join('\n');
  }

  const lines = [`# ${title}`, ''];
  for (const item of items) {
    lines.push(_itemListLine(item, metadata));
  }
  return lines.join('\n');
}

export function exportListMarkdown(list, options) {
  return _exportItems(list.items ?? [], list.name, options);
}

export function exportItemsMarkdown(items, listTitle, options) {
  return _exportItems(items, listTitle, options);
}
