# /contribution-scan

Scan your app for components that may be general-purpose enough to contribute back to the Socle library.

This is a discovery tool — it finds candidates without you having to point at a specific file. Run it periodically, or after you've built several components. For the full eligibility check and contribution packaging, use `/contribute <filepath>` on each candidate this command surfaces.

---

## What to do

### Step 1 — Find all components

List every `.js` file in `app/components/`. Skip `app/pages/` — page components own layout and routing context, which makes them almost always domain-specific.

For each file, run the checks below.

---

### Step 2 — Evaluate each component

**Store import check**

Scan for any import from `_lib/core/store/` or any `from.*store` path. A store import means the component is Page or Service tier — not UI tier — and is almost certainly domain-specific. Mark as **Not eligible**.

**App layer check**

Scan for any import that references `app/` outside of `_lib/`. Any path that imports from `app/strings.js`, `app/store/`, or another `app/` component means the component has a domain dependency. Mark as **Not eligible**.

**Domain concept check**

Scan class names, variable names, string literals in `template()`, and dispatched event types for domain-specific terms — any word that refers to a real-world concept in this specific app (goal, match, score, user, invoice, recipe, order, court, athlete).

Generic terms are fine: `title`, `label`, `value`, `item`, `index`, `count`, `progress`, `status`, `selected`, `disabled`.

- Multiple domain terms → **Not eligible**
- One or two borderline terms that could be renamed → **Possible**
- No domain terms → passes

**Test check**

Does `<component-name>.test.js` exist alongside the component file? Missing test → flag as **Possible** (a test is required before contributing, but the component may still be a candidate worth preparing).

**Single-responsibility check**

Does the component do one clear job? Flag if the file is over ~120 lines or has more than one distinct public interface (attributes + emitted events + gesture handling all in one). Mixed responsibility does not disqualify — note it as something to split before contributing.

---

### Step 3 — Rank and report

Group results into three tiers:

**Strong candidates** — no store imports, no `app/` imports, no domain terms, test exists. Ready for `/contribute`.

**Possible candidates** — passes most checks but has one fixable issue: a domain-specific variable name that could be renamed, a missing test, or a minor responsibility overlap. State the specific fix needed.

**Not eligible** — store imports, `app/` imports, or multiple domain concepts. One-line reason only.

---

## Report format

```
## Contribution scan

### Strong candidates
- `app/components/swipe-row/swipe-row.js` — gesture-enabled list row, no domain terms, test exists
  → Run: /contribute app/components/swipe-row/swipe-row.js

### Possible candidates
- `app/components/progress-bar/progress-bar.js` — clean UI component, but no test file
  Fix: add a test, then run /contribute
- `app/components/status-pill/status-pill.js` — generic pill component, uses "goalState" as prop name
  Fix: rename prop to "status" or "state", then run /contribute

### Not eligible
- `app/components/year-header/year-header.js` — imports from store (service tier)
- `app/components/goal-dialog/goal-dialog.js` — domain terms: goal, year, capstone
```

End with a count: `X strong, Y possible, Z not eligible.`

If no candidates exist at all, say so — that is useful information.

---

## What this command does not do

- It does not modify any files
- It does not run `/contribute` — that is the developer's next step after reviewing candidates
- It does not guarantee library acceptance — the maintainer makes that call
- It does not scan `app/pages/` — page components are always domain-specific
