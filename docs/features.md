# Features

## Bulk item actions (list detail)

Long-press any item in a list to enter selection mode. A ribbon slides up from the
bottom with the actions you can apply to every selected item at once. Tap more items
to add them to the selection; the count on the ribbon updates as you go.

The ribbon offers **Delete** (icon), **Tags**, and **Status**, plus a **More** (···)
overflow menu holding **Move** and **Extract Markdown**.

### Bulk tags

Tap **Tags** to open a bottom sheet for tagging the whole selection at once. Because
your selection can mix items with different tags, chips use a **union / indeterminate**
model:

- A **solid chip** is a tag on **every** selected item.
- A **dim (dashed) chip** is a tag on **some** — but not all — selected items.

How you edit:

- **Type a tag and press Enter** (or comma) to add it to every selected item. Existing
  tags autocomplete as you type.
- **Tap a dim chip's label** to apply that tag to the rest of the selection (it turns
  solid).
- **Tap a chip's ×** to remove that tag from every selected item.

Changes **apply immediately** — there is no Save button. This mirrors the blur-to-save
behaviour used elsewhere in the app: the live chips and the coloured tag strips on the
items behind the sheet are your confirmation, so no toast is shown. Closing the sheet
ends selection mode, matching Status and Move.

**Gotcha:** removing a partial tag is a two-step action by design — tap its label to
promote it to all, then tap × to clear it from all. This avoids the ambiguity of a
single tap meaning both "add to the rest" and "remove from some".

The bulk tag UI is the `<bulk-tag-editor>` component
(`app/components/bulk-tag-editor/`). It owns no store state: it receives the selected
items' tag arrays via `selectedTags`, the known-tag list via `existingTags`, and emits
`bulk-tag-apply` / `bulk-tag-remove` events (`{ tag }`) that the page applies through
`_mutateItems`.

## Archiving lists

Open a list, tap the pencil next to its name (the same dialog you use to rename it or
pick its colour), then tap **Archive** at the bottom. The list disappears from the Lists
overview immediately — archiving only declutters that page, the list itself stays fully
functional: its items, colour, and status are untouched, and it's still a valid
destination when moving, copying, or promoting items from elsewhere in the app.

To find an archived list again, open the filter panel on the Lists overview and tap the
**Archived** chip. This flips the view to show *only* archived lists (matching any other
active filters, like a text search), the same exclusive-reveal behaviour goals already
use for their own **Archived** filter. Tap **Unarchive** in the same rename dialog to
bring a list back into the default view.

A small dot next to the list's name is the only visual cue that a list is archived —
useful once the Archived filter has revealed it, since otherwise it looks identical to
any other list card.

This mirrors `goal.archived` (`app/pages/home-page.js`) end to end: same hide-by-default,
filter-pill-reveal semantics, same toggle-from-the-edit-dialog interaction. See the
`List` schema entry in `CLAUDE.md` for the exact field shape
(`archived?: boolean`) and the `list-archived-changed` event contract between
`list-dialog.js` and `list-detail-page.js`.
