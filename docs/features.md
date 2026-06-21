# Features

## Goal actions — move/copy to year and create list item

**When:** v1.6.x

### What it does

When you open an existing goal, the ··· button in the dialog footer reveals two extra actions:

- **Move to year** — move or copy the goal to any year (current ± 2) and any section (Capstone, Milestones, Wow Moments, Forward Focus).
- **Create list item** — send the goal's title and description into one or more lists as a new list item.

Both flows match item-dialog's established patterns exactly, so the interaction model is consistent.

### Move / copy to year

Tap ··· → **Move to year**. The move view shows a year selector (5 options: current year ± 2) and section pills. The current year and section are pre-selected. Move and Copy are disabled until you change at least one of them.

| Button | Effect |
|---|---|
| Move | Removes the goal from the source year+section and adds it to the target. Goal id is preserved. |
| Copy | Keeps the original in place and adds a copy (new id) to the target. |

The dialog closes immediately. A toast confirms the action ("Goal moved to Milestones").

### Create list item

Tap ··· → **Create list item**. The `list-picker-dialog` opens as a sub-modal. Select one or more existing lists, or type a name in **＋ New list** to create one on the fly.

| Button | Effect |
|---|---|
| Copy | Creates a new list item from the goal's title + description; the goal stays in place. |
| Move | Creates the list item and also deletes the goal. |

The new list item has `status: 'open'`, inherits the goal's `title` and `description` (as `note`), and has an empty `inGoals` array — progress is not linked back.

### Events

`goal-dialog` fires these on the host element with `{ bubbles: true, composed: true }`:

```js
// Fired when Move or Copy is clicked in the move view
'goal-move'  →  { goal, fromYear, fromSection, toYear, toSection, copy: boolean }

// Fired when list-picker-dialog resolves
'goal-create-item'  →  { goal, targetListIds, newListName, copy: boolean, fromYear, fromSection }
```

`home-page` handles both events: `goal-move` updates `getState().goals` directly; `goal-create-item` appends to `getState().lists` and, when `copy: false`, also removes the goal.

### Context injection

Before calling `goal-dialog.open()`, `home-page` sets two properties so the dialog has the data it needs:

```js
this._dialog.currentYear    = this._year;        // number — used to build the year range
this._dialog.availableLists = getState().lists ?? [];
this._dialog.open(goal, { year: String(this._year), section: 'milestones' });
```

---

## Lists page — tap to navigate, swipe right to colour-cycle

**When:** v1.5.x

### What it does

Tapping a list row navigates directly into that list's detail page. Previously, tapping opened an edit dialog and a separate arrow button was required to navigate — this inverted the primary vs. secondary action. The redesign aligns with the principle that navigation is always the primary intent.

Swiping a list row **right** cycles through a colour palette and snaps back. The colour appears as a left-border accent on the row.

### List row gestures

| Gesture | Action |
|---|---|
| Tap | Navigate into list |
| Swipe right (slow, 2× width) | Cycle accent colour |
| Swipe right (fast flick) | Cycle accent colour |
| Drag handle (⠿) | Reorder list |

Left swipe has no action on list rows (unlike `list-item` rows, which reveal delete/done).

### Editing a list name or colour

From inside a list, tap the list name in the header. The edit dialog opens with the current name and colour pre-filled. Save to apply changes.

### Deleting a list

From inside a list, tap ··· (menu) → **Delete list**. A second tap is required to confirm. Dismissing the menu resets the confirm state.

The edit dialog (opened via the list name) also has a delete action with the same two-tap confirm.

### Colour palette

Seven colours plus a "no colour" slot (transparent border). The palette cycles in order; reaching the end resets to no colour.

```js
export const COLOR_PALETTE = [null, '#E5534B', '#E07633', '#D4A928', '#3DAD6A', '#29A8A1', '#4A94D4', '#8B67D6'];
```

`null` = no colour (transparent accent border). Colour is stored on the `List` object as `color?: string` (hex).

### Events emitted by `lists-page-item`

| Event | Detail | When |
|---|---|---|
| `list-tap` | `{ list }` | Tap on row |
| `list-color-cycle` | `{ list }` | Swipe right commits |
| `list-drag-start` | `{ list, element, startX, startY }` | Drag handle pointerdown |
| `list-reorder-key` | `{ list, direction }` | ArrowUp / ArrowDown on drag handle |
