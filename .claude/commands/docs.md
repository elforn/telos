# /docs

Maintain app documentation. Only two documents exist in this project:
`README.md` and `CHANGELOG.md`. No `docs/` folder, no per-feature doc files —
do not create one, even implicitly.

## Usage
/docs <scope>

Scopes:
- `changelog` — add entries to CHANGELOG.md for work done this session
- `readme`    — propose an update to README.md

---

## Scope: `changelog`

Update `CHANGELOG.md` following Keep a Changelog format.

Structure:
```markdown
## [Unreleased]

### Added
- Brief description of new capabilities (user-facing language)

### Changed
- Changes to existing behaviour

### Fixed
- Bug fixes

## [1.0.0] — 2025-06-01
...
```

Rules:
- Write for someone using the app — what changed for them?
- Group by version, newest first
- Each entry is one line, plain language
- Breaking data changes (migrations) get their own `### Migration required` section

Read `git log --oneline` since the last changelog entry and translate commits into entries.

---

## Scope: `readme`

`README.md` is held to a strict bar: it is the *only* place beyond
`CHANGELOG.md` where documentation is allowed to live, so nothing goes in
without deliberate approval. **Never edit README.md without asking first** —
propose the specific addition/change and wait for an explicit go-ahead, even
when a feature clearly seems README-worthy. This applies every time, not just
once per session.

Keep it scannable in 30 seconds.

Structure:
```markdown
# App Name

One sentence: what this app does.

## What it does
Bullet list of 4–6 capabilities.

## Running locally
How to build and serve.

## Running tests
How to run unit and E2E tests.

## Deploying
How to deploy (GitHub Pages via push to main).
```

Rules:
- No marketing language
- Every code block must be correct and runnable
- README stays under 100 lines — if it grows past that, cut content rather than spilling into a new file

---

## Writing standards

- **Sentence case** in all headings
- **Second person** ("you add a goal") not third person
- **Present tense** ("the store emits", not "the store will emit")
- **Short paragraphs** — three sentences maximum before a break or code example
- **Code examples over prose** — when in doubt, show the code
