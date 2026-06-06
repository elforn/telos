# /docs

Maintain app documentation. Run this when a feature is complete and before /commit.
Documentation is not optional — a feature without docs is not done.

## Usage
/docs <scope>

Scopes:
- `feature <name>` — document a newly completed feature
- `changelog`       — add entries to CHANGELOG.md for work done this session
- `readme`          — update README.md

---

## Scope: `feature <name>`

Document a newly completed feature.

1. **Update `README.md`** if the feature is significant enough to affect the app overview or usage instructions.

2. **Add a section to `docs/features.md`** (create it if it doesn't exist) describing:
   - What the feature does and why
   - How to use it (code example if relevant)
   - Any constraints or gotchas

3. **Report** which files were updated and what sections changed.

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

Update `README.md`. Keep it scannable in 30 seconds.

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
- README stays under 100 lines — if it grows past that, content belongs in docs/

---

## Writing standards

- **Sentence case** in all headings
- **Second person** ("you add a goal") not third person
- **Present tense** ("the store emits", not "the store will emit")
- **Short paragraphs** — three sentences maximum before a break or code example
- **Code examples over prose** — when in doubt, show the code
