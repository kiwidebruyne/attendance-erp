---
name: gh-issue-review
description: Review GitHub issues before implementation, judge whether they should be kept, reworked, split, deferred, or closed, and post concise verdict comments. Use when Codex needs to evaluate one or more GitHub issues for scope, repo fit, issue quality, sequencing, or implementation readiness before writing code.
---

# GitHub Issue Review

## Overview

Use this skill to review GitHub issues before implementation. It builds repo context, applies a fixed rubric, and posts short decision-oriented comments instead of jumping straight into code.

## Required Inputs

- One or more issue numbers from the checked-out repository, or an explicit request to review all matching issues in the checked-out repository.
- Optional request for a dry run when the user wants drafts without posting.
- Keep each invocation scoped to a single GitHub repository.
- Treat `--all` as a capped first pass over up to 100 matching issues, not a full backfill.

## Workflow

1. Build repo context first.
   - List `docs/` before anything else.
   - Read `AGENTS.md`, `docs/README.md`, and the domain docs that govern the area under review.
   - Read the smallest set of config or entrypoint files that can validate the issue's claims.
   - Keep the review scoped to the checked-out repository. If the user points at an issue in another repository, do not use this skill unless that repository is checked out locally.
   - Treat repo contracts as a secondary check. Use best practices as the primary lens unless the user says otherwise.
2. Collect issue data with the helper script.
   - For a capped first pass over open issues:
     ```bash
     bun ".agents/skills/gh-issue-review/scripts/collect_issue_context.js" --all
     ```
   - For selected issues:
     ```bash
     bun ".agents/skills/gh-issue-review/scripts/collect_issue_context.js" 2 5 7
     ```
   - `--all` reviews up to the first 100 matching issues per run and returns `selection.limit` / `selection.truncated` metadata. Call that limit out explicitly when it affects the review scope, and do not imply that this helper paginates beyond the cap.
   - The script returns repo metadata plus issue bodies and comments as JSON. Read only the fields you need and then inspect local files directly.
3. Apply the rubric in `references/review-rubric.md`.
   - Choose exactly one verdict: `keep`, `rework`, `split`, `defer`, or `close`.
   - Distinguish idea quality from issue quality. A good idea with a weak issue body usually means `rework`, not `close`.
   - Prefer the smallest irreversible contract. Push broad issues toward narrower scope or docs/examples when that solves the real problem.
   - For template or platform repos, question whether the requested default belongs in the baseline at all.
4. Write a concise comment in the issue's language.
   - Use this order exactly:
     1. `Verdict`
     2. `What is valid`
     3. `What needs discussion`
     4. `Recommended rewrite/split`
     5. `Dependencies or sequencing`
   - Keep each section short. The comment should help a maintainer decide what to do next, not serve as a mini design doc.
   - Mention issue-template or repo-contract gaps only when they affect implementation clarity, testability, or scope control.
5. Post the comment.
   - Write the final markdown to a temporary file.
   - Post it with the helper script:
     ```bash
     bun ".agents/skills/gh-issue-review/scripts/post_issue_comment.js" 12 --body-file "$tmp"
     ```
   - Use `--dry-run` only when the user explicitly wants drafts instead of posting.

## Review Rules

- Default to `rework` when the problem is plausible but the scope is too broad, too mixed, or missing key acceptance details.
- Use `split` when one issue bundles multiple independently shippable concerns.
- Use `defer` when the idea is reasonable but depends on missing contracts, missing architecture decisions, or lower-level issues landing first.
- Use `close` only when the change does not solve a meaningful problem, creates unjustified baseline bloat, or is better tracked elsewhere.
- Always call out the strongest reason for the verdict first.
- If new evidence would change the verdict, say what evidence is missing.

## Helper Scripts

- `scripts/collect_issue_context.js`
  - Fetch issue bodies, comments, and lightweight repo metadata as JSON.
  - Accept issue numbers or `--all`.
  - Cap `--all` runs at 100 issues and surface that limit in the JSON output.
- `scripts/post_issue_comment.js`
  - Post a prepared markdown comment from a file.
  - Support `--dry-run` for validation without publishing.

## References

- Read `references/review-rubric.md` for:
  - verdict definitions
  - issue-quality checks
  - template and platform repo heuristics
  - a compact markdown comment template
