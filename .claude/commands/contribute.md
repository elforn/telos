# /contribute

Prepare a component or module for contribution to Socle.

This command lives in the app project. It evaluates whether a piece of app code
is genuinely general-purpose enough to belong in the library, cleans it up if so,
and produces a ready-to-submit package the developer can attach to a GitHub issue.

No GitHub API. No automated PR. The command does the hard evaluation work —
the developer does the submission.

## Usage
/contribute <component-or-file-path>

Example: `/contribute app/components/drag-select/drag-select.js`

---

## What to do

### Step 1 — Eligibility check (stop here if any fail)

Run these checks before touching anything. If any fail, report the finding
clearly and stop — do not proceed to packaging.

**Domain concept check.**
Read every line of the file. Flag any word, variable name, class name, or string
that refers to a specific app domain. Examples that would fail:
- Variable names like `goalTitle`, `matchScore`, `teaVariety`
- Strings like `'Mark goal complete'`, `'End match'`
- Logic that only makes sense in one specific context

A component passes if a developer building a completely different app
(a recipe tracker, a field survey tool, a reading log) could use it unchanged.

**App layer isolation check.**
Does the file import from anywhere outside `_lib/`? Any import from `app/`
is an automatic fail — library code cannot depend on app code.

**Size and complexity check.**
Is this component doing one clear job? Flag anything that is doing two jobs
and could be split. The library favours small, composable pieces over large
all-in-one components.

**Test check.**
Does a `.test.js` file exist alongside this component? If not, fail.
The library does not accept untested contributions.

**Accessibility check.**
Does the component meet Tier 1 accessibility requirements from `/a11y`?
Run the Tier 1 checks now. Any blocking failure stops the contribution.

If all checks pass, proceed to Step 2.
If any fail, report exactly what needs to change before resubmitting.
Do not offer to fix it — the developer owns their code.

---

### Step 2 — Library fit analysis

Pass the eligibility checks? Now evaluate whether this actually belongs
in the library — eligibility is necessary but not sufficient.

Ask and answer each:

**Is this a solved problem in `_lib/` already?**
Check whether `_lib/core/` or `_lib/modules/` already has something that
covers this. If yes, the contribution might be an improvement to an existing
component rather than a new one — note this.

**Which library module would this live in?**
- `core/` — used by virtually every app (router, store, base components)
- `modules/gestures/` — gesture primitives
- `modules/sync/` — export/import/merge
- `modules/ui/` — optional shared UI components
- A new module — only if it genuinely doesn't fit above

**Would this make sense in the library's reference app (yearly goals)?**
If yes, it's probably general enough. If it only makes sense in the contributing
developer's specific app, it probably isn't.

**What is the maintenance cost?**
Every file added to the library must be maintained, documented, tested, and
considered for every future API change. Is this component worth that ongoing cost?
Rate: Low / Medium / High. Anything High needs a strong justification.

---

### Step 3 — Prepare the contribution package

Create a folder at `_contribution/` in the app project root.
Do not modify the original files in `app/`.

```
_contribution/
  <component-name>/
    <component-name>.js       ← cleaned component (see rules below)
    <component-name>.test.js  ← existing tests, unchanged
    proposal.md               ← short proposal note
```

**Cleaning rules for the component file:**
- Replace any remaining domain-specific variable names or strings with
  generic equivalents (`label`, `value`, `title`, `onComplete`)
- Ensure all imports reference `_lib/` paths as they would exist in the library
  (adjust relative paths accordingly)
- Remove any `app/`-specific imports entirely — if the component needed them
  to work, it is not ready for the library
- Do not change logic, structure, or behaviour — only naming and imports

**Writing `proposal.md`:**

```markdown
# Contribution proposal: <component-name>

## What it does
One paragraph. What problem does this solve? What does a developer use it for?

## Why it belongs in the library
One paragraph. Why is this general-purpose? What kinds of apps would use it?

## Suggested location
core/components/<name>/ OR modules/<module>/<name>/

## Changes made to make it library-ready
Bullet list of what was cleaned up from the original app version.

## Known limitations
Anything the library maintainer should know before accepting.

## Tests
What is covered. What is not covered and why.
```

---

### Step 4 — Submission instructions

After creating `_contribution/`, report:

1. Whether the contribution passed all checks (summary)
2. The contents of `proposal.md` so the developer can review before submitting
3. These exact submission instructions:

---

**To submit this contribution:**

1. Open an issue on the Socle GitHub repository
2. Title: `Contribution: <component-name>`
3. Paste the contents of `_contribution/<component-name>/proposal.md`
4. Attach or paste the component and test files

The maintainer will review, request changes if needed, and integrate
it using `/generate-claude` as part of the next release if accepted.

**The `_contribution/` folder is temporary.** Add it to `.gitignore`
if you don't want it committed to your app's repository.

---

### What this command does not do

- It does not open a GitHub issue or PR automatically
- It does not modify your original `app/` files
- It does not guarantee acceptance — the maintainer makes that call
- It does not run `/generate-claude` — that is a library-side command
