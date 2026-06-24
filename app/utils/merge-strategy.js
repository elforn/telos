function goalsDiffer(a, b) {
  return a.title !== b.title || a.notes !== b.notes;
}

function listItemsDiffer(a, b) {
  return a.title !== b.title || a.note !== b.note || a.url !== b.url;
}

// Merge two ordered arrays by ID.
// New items (ID not in local) → appended at end.
// Same ID + content differs → conflict copy inserted immediately after local item, ⚭-prefixed, fresh UUID.
// Same ID + identical content → silently skipped.
function _mergeOrdered(localItems, importedItems, differsFn) {
  const localById      = new Map(localItems.map(item => [item.id, item]));
  const conflictCopies = new Map();
  const toAddAtEnd     = [];

  for (const imported of importedItems) {
    const local = localById.get(imported.id);
    if (!local) {
      toAddAtEnd.push(imported);
    } else if (differsFn(local, imported)) {
      const copy = { ...imported, id: crypto.randomUUID(), title: `⚭ ${imported.title}` };
      if (!conflictCopies.has(imported.id)) conflictCopies.set(imported.id, []);
      conflictCopies.get(imported.id).push(copy);
    }
  }

  const result = [];
  for (const item of localItems) {
    result.push(item);
    const copies = conflictCopies.get(item.id);
    if (copies) result.push(...copies);
  }
  result.push(...toAddAtEnd);
  return result;
}

function _mergeGoals(local, imported) {
  const result = { ...local };
  for (const [year, importedYear] of Object.entries(imported ?? {})) {
    if (!result[year]) { result[year] = importedYear; continue; }
    const merged = {};
    for (const section of ['capstone', 'milestones', 'wow', 'focus']) {
      merged[section] = _mergeOrdered(
        result[year][section] ?? [],
        importedYear[section] ?? [],
        goalsDiffer,
      );
    }
    result[year] = merged;
  }
  return result;
}

function _mergeLists(local, imported) {
  const result    = [...local];
  const localById = new Map(local.map(l => [l.id, l]));

  for (const importedList of imported ?? []) {
    const localList = localById.get(importedList.id);
    if (!localList) { result.push(importedList); continue; }

    const mergedItems = _mergeOrdered(
      localList.items ?? [],
      importedList.items ?? [],
      listItemsDiffer,
    );
    // Length is a safe proxy for "anything changed" because _mergeOrdered only adds, never removes or mutates.
    if (mergedItems.length !== (localList.items?.length ?? 0)) {
      const idx = result.findIndex(l => l.id === importedList.id);
      result[idx] = { ...localList, items: mergedItems };
    }
  }
  return result;
}

// App-provided merge strategy passed to applyMerge().
// local always wins for existing year-keyed entries; new years from import are added.
export function mergeStrategy(current, imported) {
  return {
    goals:        _mergeGoals(current.goals ?? {}, imported.goals ?? {}),
    lists:        _mergeLists(current.lists ?? [], imported.lists ?? []),
    accentColors: { ...imported.accentColors, ...current.accentColors },
    reflections:  { ...imported.reflections,  ...current.reflections  },
    images:       { ...imported.images,       ...current.images       },
  };
}
