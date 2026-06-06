# /scope

Analyse a feature request before any code is written.
Run this before starting any non-trivial new feature. Do not write code — report only.

## Usage
/scope "<feature description>"

Example: `/scope "add a calendar view for scheduling matches"`

## What to do

Evaluate the request against each dimension below. Be direct and specific — this is a decision-making tool, not a rubber stamp.

---

### 1. Does it belong in this app?

Is this feature part of what this app is for, or is it scope creep?

- Does it serve a real problem the app's users have today?
- Is it consistent with the app's existing data model and flows?
- Could this be solved by a simpler change to something that already exists?

If the feature looks genuinely general-purpose (a reusable gesture, a routing utility, a store pattern any app could use), note that it may be worth contributing back to Socle via `/contribute` — but that's a separate decision, not a blocker.

---

### 2. Scope creep test

Does this add surface area that contradicts the project's core principles?

Check explicitly:
- Does it require a runtime npm package or external dependency?
- Does it add backend-like behaviour (user accounts, remote storage, authentication)?
- Does it add UI complexity beyond what mobile-first interactions require?
- Is it a "nice to have" that solves a problem the user doesn't have yet?
- Is it a tuning option or fallback for a limitation that has not caused an observed problem?
- Does it increase the total codebase size significantly for marginal gain?

If any of these are yes, flag it clearly. Do not soften the finding.

---

### 3. Complexity cost

Estimate honestly:
- How many new files would this add?
- Does it touch the store schema (requiring a migration) or stay in UI only?
- Does it introduce a new dependency on an existing component?
- Does it require new test infrastructure?

Rate the cost: **Low / Medium / High**

---

### 4. Alternatives

Is there a simpler way to achieve the user's actual goal without building this feature?

Always propose at least one alternative if the cost is Medium or High.

---

### 5. Verdict

One of three outcomes:

- **Build it** — fits the app, low-medium cost, consistent with principles
- **Build a simpler version** — the goal is valid but the proposed implementation is over-engineered; describe the simpler version
- **Do not build** — out of scope, contradicts principles, or solves a problem that doesn't exist yet; explain clearly

The developer makes the final call. This command provides the analysis, not the decision.
