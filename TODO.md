# Telos — Roadmap

## Done ✅
- Capstone, milestones, wow, focus goals per year
- Progress bar (hold-drag), fail state, swipe-to-reveal edit actions
- Year navigation, year header with progress strip
- Year photo as header background
- Export / import (.tlos)
- Deploy to https://elforn.github.io/telos via GitHub Actions

## Up next — foundation
Land these first; they underpin everything else.

### 1. Dark theme
Auto-follows system preference on first launch. Manual override in the year-header
menu: light / dark / system. Saved in store. All colour tokens are CSS custom
properties — add a `[data-theme="dark"]` block.

### 2. Year accent colour
One colour per year. While that year is active, `--color-accent` on `:root` updates
to the stored colour. Colour picker in year-header menu. Stored as
`accentColors: { [year]: '#rrggbb' }`.

### 3. Lists (trans-year)
Create and manage named lists (ideas, gifts, home improvements, identity anchors,
etc.). Items have title, description, due date, status (open / paused / done), and
tags. Filter by status or tag. Link an item into any goal section in any year — the
item stays in the list with `inGoals` updated to record every place it was used.
A single item can feed goals in multiple years.

### 4. Frequency goal types (weekly and monthly)
Two additional goal types alongside the existing percentage tracker:
- **Weekly** — target N times/week (e.g. "gym 3×/week"). "Every day" is a UI
  preset for target=7.
- **Monthly** — target N times/month (e.g. "meditate 20×/month").

Both are logged by tapping a date (one entry per calendar day max; past dates
allowed). Success per period = completions / target, weighted running average
across periods (recent periods weighted higher). Compact dot/bar visual for the
last 8 weeks or 6 months in the goal list. Visual representation TBD.

## Navigation & UX
- **Year selector overlay** — tap year title in header → bottom-sheet picker;
  years with any content shown with a filled dot.
- **Goal ordering in edit mode** — drag handles in edit mode to reorder goals
  within a section.
- Share Target API — register as a system share target; incoming shares go into
  a chosen list.

## Later — depth
- **Year / quarterly reflection** — 1–5 star rating + short note, storable
  annually or per quarter (Q1–Q4). Modal UI, TBD.
- **Success card** — when a percentage goal hits 100%, offer "Share this win":
  generates a card and triggers the Web Share API. No server needed.
- **Year summary card** — shareable image of the full year plan (Web Share API).
- **Check-in badge reminder** — app icon badge (Badging API) showing count of
  frequency goals behind target. Updated on app open and via Periodic Background
  Sync (Chrome Android, no server needed).
- **Walkthrough / onboarding** — first-launch guide, skippable.

## Stretch
- Frequency goal dot-calendar — richer visual for weekly/monthly goal types.
- Analytics — goal stats, tag stats, progress over time. Tags on both goals and
  items are stored from day one specifically to enable this. Very late stage.
