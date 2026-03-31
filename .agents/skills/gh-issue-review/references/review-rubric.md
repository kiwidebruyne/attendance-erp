# GitHub Issue Review Rubric

Use this rubric to keep verdicts consistent and comments short.

## Verdicts

- `keep`
  - Use when the problem is real, the scope is already right-sized, and the issue is implementation-ready.
- `rework`
  - Use when the problem is valid but the issue body, scope, or acceptance criteria are not strong enough yet.
- `split`
  - Use when the issue bundles multiple concerns that should be tracked or shipped separately.
- `defer`
  - Use when the idea is reasonable but should wait for missing contracts, missing architecture decisions, or prerequisite issues.
- `close`
  - Use when the issue does not solve a meaningful problem, adds unjustified baseline surface area, or belongs in another artifact such as docs, an ADR, or a discussion.

## Core Questions

- Is there a real problem here, or only a convenient addition?
- Should this repository own the change directly, or would docs, an example, or downstream app code be a better fit?
- What is the smallest irreversible contract that solves the problem?
- Does the issue add lock-in through dependencies, runtime defaults, vendors, or maintenance burden?
- Is the proposed solution a symptom fix when a docs, workflow, or contract change would address the root cause?
- Is the issue too broad, mixing multiple concerns that should be split?
- Are there obvious prerequisites or sequencing constraints?

## Issue Quality Checks

- Title
  - Prefer a concise verb phrase.
- Body
  - Look for problem framing, current gap, proposed scope, acceptance criteria, test scenarios, and explicit out-of-scope boundaries.
- Evidence
  - If the issue claims pain or risk, ask what concrete failure, confusion, or maintenance cost it avoids.
- Testability
  - Acceptance criteria should describe observable outcomes, not only implementation details.
- Scope control
  - Call out missing out-of-scope notes when the issue could sprawl.

Do not nitpick formatting if the technical idea is the real blocker. Mention structure only when the missing sections make the issue hard to execute safely.

## Template And Platform Repo Heuristics

- Challenge every new default.
  - "Many projects eventually need this" is not enough by itself.
- Prefer docs or reference examples over baseline dependencies when the main need is education.
- Prefer baseline scaffolding when the framework already treats the file or behavior as a standard extension point.
- Defer placeholder scaffolding when the repo does not yet have the surrounding contract that would make the placeholder meaningful.
- Split docs, CI, operational defaults, and runtime behavior when they can land independently.

## Comment Template

```md
## Verdict
`rework`

## What is valid
- ...

## What needs discussion
- ...

## Recommended rewrite/split
- ...

## Dependencies or sequencing
- ...
```

Keep each section short. One or two bullets per section is usually enough.
