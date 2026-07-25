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
