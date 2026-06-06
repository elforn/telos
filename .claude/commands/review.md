# /review

Review a file for complexity, standards compliance, and alignment with app principles.

## Usage
/review <filepath>

## What to do

Read the file and evaluate it against the following. Report each section separately.

### 1. Complexity audit
- Is there any logic that could be expressed in fewer lines without losing clarity?
- Are there any abstractions that are not yet earning their complexity (used only once, or solving a problem that doesn't exist yet)?
- Are there any loops, conditionals, or data transforms that could be simplified?
- Flag anything over ~40 lines in a single function.

### 2. Standards compliance
Check against project rules:
- [ ] No runtime library imports — vanilla JS only
- [ ] **UI compliance** (for any component with a template): all style values from `_lib/core/styles/tokens.css`, touch targets met, no hover-only interactions, colour never the only state indicator.
- [ ] No hardcoded design values (colours, spacing, typography) — CSS custom properties only
- [ ] No comments explaining *what* code does (only *why*, and only when non-obvious)
- [ ] No CommonJS (`require`, `module.exports`) — ES modules only
- [ ] No silent failures or swallowed errors, especially in store/IDB operations
- [ ] Web Components: no full re-renders after initial mount (targeted DOM updates only)
- [ ] Store writes go through `dispatch()` or `setState()` — never directly to IDB
- [ ] **Safe area insets**: any element with `position: fixed` and `inset-block-start: 0` must use `padding-block-start: calc(var(--space-N) + var(--safe-area-top))` — never a flat padding value. Likewise, elements with `position: fixed` and `inset-block-end: 0` (bottom sheets, toasts, nav bars) must use `padding-block-end: calc(var(--space-N) + var(--safe-area-bottom, 0px))`.

### 3. Maintainability

Evaluate whether a developer returning to this code in 6 months could understand and modify it confidently.

- Are names (variables, functions, components, files) self-explanatory without needing comments?
- Is there any implicit coupling — does this file assume something about another file that isn't made explicit through imports or function signatures?
- Is any component or function doing more than one job? If so, name the jobs clearly and flag whether they should be split.
- Are there any magic values (numbers, strings) that should be named constants?
- Is the file longer than it needs to be? Flag anything that could be extracted without adding indirection complexity.
- For Web Components specifically: is the component's public interface (attributes, properties, events) clear from reading the class alone, without needing to trace through callers?

### 4. Test coverage gap
- Does a corresponding `.test.js` exist?
- Are the tests sufficient for the complexity of the file?
- If not, note what's missing (do not write the tests — use `/test` for that).
- Has `/a11y` been run on this component? If it is a UI component and no a11y audit exists, flag it.

### 5. Verdict
One of:
- **Good to go** — no significant issues
- **Minor issues** — list them, suggest fixes inline
- **Needs rework** — explain what needs to change and why before continuing

Do not rewrite the file unless explicitly asked. Report findings only.
