# Features

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
