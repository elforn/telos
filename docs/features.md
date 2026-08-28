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

Open a list, tap the **⋮** menu, then use the **Archive** segmented switch — the same
Active/Archived pill-group style as the Status and Tag-colour toggles right above it in
the same menu. The list disappears from the Lists overview immediately — archiving only
declutters that page, the list itself stays fully functional: its items, colour, and
status are untouched, and it's still a valid destination when moving, copying, or
promoting items from elsewhere in the app. Which pill is highlighted always shows the
current state at a glance; a toast confirms the change right after you tap.

Archiving deliberately lives in the **⋮ menu**, not the rename dialog (which only edits
the list's name/colour) — it sits right after the Status and Tag-colour toggles (grouped
with them as the menu's per-list state controls) and before the Add from text / Extract
Markdown / Share to Telos / Delete actions below it.

To find an archived list again, open the filter panel on the Lists overview and tap the
**Archived** chip. This flips the view to show *only* archived lists (matching any other
active filters, like a text search), the same exclusive-reveal behaviour goals already
use for their own **Archived** filter. The **Empty** and **Not empty** chips are additive
with each other — selecting both shows every list regardless of item count — but neither
one reveals an archived list, empty or not; only the **Archived** chip does that.

A small dot next to the list's name is the only visual cue that a list is archived —
useful once the Archived filter has revealed it, since otherwise it looks identical to
any other list card.

This mirrors `goal.archived` (`app/pages/home-page.js`) in its data-model semantics
(hide-by-default, filter-pill-reveal) but *not* its interaction — goals toggle archived
from within `goal-dialog.js`'s own footer, since that dialog already carries a "more
actions" overflow sheet; `list-dialog.js` has no such sheet, so list archiving lives in
`list-detail-page.js`'s own "⋮" menu instead (`#archive-active-btn` / `#archive-archived-btn`,
directly wired to `setState('lists', ...)` — no cross-component event needed). See the
`List` schema entry in `CLAUDE.md` for the exact field shape (`archived?: boolean`).

## Year selector overlay

Tap the year title in the Goals header to open a bottom sheet listing years, so you can
jump further than one swipe at a time. This is a fast-jump alternative to the existing
swipe/prev/next navigation, not a replacement for it.

The list always covers the full 1900–2100 range and scrolls freely in both directions —
it's not a window around the current year, so any year in range is reachable by
scrolling regardless of whether it has content, including filling in older years
retroactively. It opens scrolled to the year you're currently viewing (not today's real
calendar year — if you've swiped away from today, the picker opens centred on wherever
you are). The floor (1900) mirrors the router's own year-param floor (`home-page.js`) —
a year below that redirects to not-found, so the two must move together; raising the
picker's floor without also raising the router's would silently break every row below
the new floor. The ceiling (2100) is just a practical cap on the list's length, well
inside the router's own ceiling (2500); nothing else depends on it.

Years with content show a small dot, tinted with that year's accent colour
(`accentColors[year]`, the same "Year colour" set from the "⋮" menu) when one is set,
falling back to a neutral dot otherwise. The dot sits in a fixed-width column to the
right of the year digits rather than next to them inline — an empty, invisible
placeholder still occupies that column on content-free years, so the digits stay
dead-centred across every row instead of drifting sideways on the rows that happen to
have a dot. The currently viewed year is highlighted, and the sheet always opens with
that row centred in the list (not just scrolled into view — vertically centred, the
same math the Today button below reuses). Tapping a year dispatches the same
`year-navigate` event the existing prev/next buttons and swipe gesture already use, so
`home-page.js` needed no new wiring — it already listens for that event and calls
`navigate()`.

A **Today** button in the sheet's header re-centres the (already open) list on today's
real calendar year — distinct from the highlighted row, which tracks the year you're
*viewing*, not today's date. It's a scroll shortcut, not a navigation: the sheet stays
open and no `year-navigate` fires, so browsing isn't interrupted — tap a row same as
ever to actually jump there.

Implemented entirely in `app/components/year-header/year-header.js` as a second
`<modal-dialog>` sheet (mirroring the existing "⋮" menu sheet in the same file), rather
than a new component — the row list has its own bounded, internally-scrolling container
(`#year-picker-list`), so scrolling the active row into view sets that container's
`scrollTop` directly instead of `el.scrollIntoView()` — see the scroll note on
`goal-dialog.js`'s `_scrollWithinModalBody` in `CLAUDE.md` for why `scrollIntoView` is
avoided on anything nested inside a `modal-dialog`.
