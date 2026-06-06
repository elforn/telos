# /setup-claude

Build or refresh the app-context section of `CLAUDE.md` by asking the developer structured questions about their app.

Run this once after scaffolding, and again whenever the app's purpose, flows, or data model evolve significantly. The technical scaffold section of `CLAUDE.md` is never touched — only the app-context section is written or updated.

The goal is a `CLAUDE.md` that lets any future Claude session understand this app deeply without needing to read all the code first.

---

## What to do

### Step 1 — Read what already exists

Before asking anything, read the codebase to infer what you can:

- `CLAUDE.md` — check if an app-context section already exists (look for `## About this app`). If it does, read it and use it as a starting point — this may be a refresh, not a first run.
- `manifest.json` — app name and short description
- `app/store/reducer.js` — event types reveal the data model and domain vocabulary
- `app/pages/` — list of pages reveals the main user-facing flows
- `app/components/` — list of components gives a sense of UI patterns already built
- `package.json` — app name and version

Note what you were able to infer and what is still unknown. Use inferences to pre-fill answers where confident — ask the developer to confirm or correct, not to re-enter from scratch.

---

### Step 2 — Ask structured questions in four passes

Work through the passes in order. Ask one pass at a time — present all questions in a pass together, wait for answers, then move to the next pass. Do not ask all passes at once.

Adapt questions based on what you already inferred in Step 1. If you already know the app name from `manifest.json`, don't ask for it — confirm it. If you already see `GOAL_ADDED` and `GOAL_COMPLETED` event types, don't ask "what are your main data entities" — ask "your main entities appear to be goals — is that right, and are there others?"

---

**Pass 1 — Purpose**

Ask:
1. In one or two sentences, what does this app do and for whom?
2. In what context do people use it? (e.g. at a desk, in the field, during a competition, on the move)
3. Is there a primary device type? (e.g. phone only, tablet as hub, mix)

---

**Pass 2 — Users and flows**

Ask:
1. Who are the main user types? List them with a one-line description of their role. (e.g. "Judge — enters scores for one match at a time")
2. What are the 3–5 most important things a user does in this app? List them as short action phrases. (e.g. "Add a goal", "Mark a goal complete", "Review progress for the year")
3. What does "done" look like for the user's primary task? What's the moment they put the phone down satisfied?

---

**Pass 3 — Data model**

Ask:
1. What are the main domain concepts — the things your app tracks? (e.g. goals, matches, entries, sessions)
2. Looking at your event types (list them from the reducer), do these names reflect your domain correctly? Any that need renaming or explaining?
3. Are there any important business rules the data model encodes? (e.g. "a match can only be edited by the judge who created it", "goals are grouped by year")

---

**Pass 4 — Constraints and style**

Ask:
1. Are there any interaction constraints specific to this app's context? (e.g. "users are under time pressure — no confirmation dialogs", "users may have wet or gloved hands — large tap targets everywhere")
2. Are there any features or patterns you explicitly want to avoid in this app?
3. What's the one thing a new developer (or Claude) most commonly gets wrong about this app's domain or data model?

---

### Step 3 — Write the app-context section

Using all inferences and answers, write a `## About this app` section and insert it into `CLAUDE.md` immediately after the opening title block, before `## Stack`.

If a `## About this app` section already exists, replace it entirely.

Structure:

```markdown
## About this app

### Purpose
[1–2 sentences from Pass 1 Q1. Plain, factual, no marketing language.]

### Context of use
[1–2 sentences from Pass 1 Q2–3. Where, when, on what device.]

### Users
[Bullet list from Pass 2 Q1. One line per user type.]

### Key flows
[Numbered list from Pass 2 Q2. Each flow is an action phrase, optionally with a one-sentence note on what makes it non-obvious.]

### Data model
[Paragraph or bullet list from Pass 3. Name the main domain concepts, explain what each represents, and note any important business rules. Use the actual event type names from the reducer as the authoritative vocabulary — these are what Claude will see in code.]

### Constraints
[Bullet list from Pass 4 Q1–2. Only non-obvious constraints that differ from the defaults already in CLAUDE.md.]

### Common mistakes
[1–3 bullets from Pass 4 Q3. The things to watch out for. Be specific.]
```

---

### Step 4 — Confirm and save

Show the developer the generated `## About this app` section before writing it. Ask:

> "Does this accurately reflect your app? Anything to correct or add before I save it?"

Apply any corrections, then write the final version to `CLAUDE.md`.

Report: "App context written to CLAUDE.md. Future Claude sessions will start with this context loaded automatically."

---

## What this command does not do

- It does not modify the technical scaffold section of `CLAUDE.md` (stack, structure, rules, workflow)
- It does not make any changes to `app/` code
- It does not run tests or linting
- It does not need to be re-run unless the app's purpose or data model changes significantly
