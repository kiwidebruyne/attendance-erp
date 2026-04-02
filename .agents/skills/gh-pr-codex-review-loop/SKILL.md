---
name: gh-pr-codex-review-loop
description: "Repeatedly address GitHub pull request feedback until Codex marks the pull request as accepted with a :+1: reaction. Use when a user asks to iteratively apply PR review comments, run validations, push follow-up commits, and continue until Codex auto review is satisfied."
---

# GitHub PR Codex Review Loop

## Overview

Run a deterministic loop for PR hardening:
1. Check whether Codex already reacted with `:+1:`.
2. If not approved, gather Codex-authored feedback and record the latest feedback IDs.
3. Implement fixes, run validations, commit, and push.
4. Hand the 30-second wait state to a blocking script and stay idle until approval or newer feedback appears.

Use GitHub CLI (`gh`) for all GitHub operations.

## Required Inputs

- PR number or PR URL.
- Repository slug (`owner/repo`) when working outside the checked-out repo.
- Optional Codex actor names when your organization uses a custom bot identity.

## Loop Workflow

1. Check the approval signal:
```bash
node scripts/check_codex_thumbs_up.js 123 --repo owner/repo
```
2. Stop immediately if `approved=true`.
3. Optionally confirm whether Codex review was already triggered:
```bash
node scripts/check_codex_review_trigger.js 123 --repo owner/repo
```
4. Collect Codex feedback context and latest matching feedback IDs:
```bash
node scripts/collect_codex_feedback.js 123 --repo owner/repo --format json
```
5. Branch on the result:
   - If actionable feedback exists, address it in a single coherent fix set.
   - If approval is absent and no actionable feedback exists yet, emit a short status update and continue waiting through the blocking watcher. Do not manually request Codex review while the scripted wait is active.
6. Run required project validations before commit.
7. Stage and commit without delay after staging:
```bash
git add <changed-files>
git commit -m "fix: address codex PR feedback"
git push
```
8. Resolve addressed review threads:
   - Inspect unresolved threads with `gh api graphql` query from `references/gh-review-loop-reference.md`.
   - Resolve only threads fully addressed by the push.
9. After each push, hand waiting to the blocking watcher:
```bash
node scripts/wait_for_codex_review_event.js 123 \
  --repo owner/repo \
  --after-review-id 456 \
  --after-inline-comment-id 789 \
  --after-discussion-comment-id 1011
```
10. On watcher exit:
   - If `event=approved`, stop the loop.
   - If `event=feedback`, inspect the returned new feedback, apply the next fix set, and continue from validations.
11. Repeat until approval is detected.

## Validation Rules

- Stop the loop only on explicit `:+1:` reaction by a Codex actor.
- Treat the `eyes` reaction as a trigger diagnostic only; it does not stop the loop.
- Do not claim success when feedback is missing but approval is absent.
- After each push, let `wait_for_codex_review_event.js` own the 30-second polling cadence.
- Do not manually request Codex review while `wait_for_codex_review_event.js` is still polling.
- Keep each iteration small and reviewable.
- Preserve unrelated local changes.

## Helper Scripts

- `scripts/check_codex_thumbs_up.js`
  - Exit `0` when approval is detected.
  - Exit `1` when approval is not detected.
  - Print JSON summary for logs and automation.
- `scripts/check_codex_review_trigger.js`
  - Exit `0` when a matching Codex `eyes` reaction is detected.
  - Exit `1` when no matching `eyes` reaction is present.
  - Print JSON summary for logs and automation.
- `scripts/collect_codex_feedback.js`
  - Gather Codex-authored review summaries, inline comments, and discussion comments.
  - Output `markdown` (default) or `json`.
  - Include `latest_ids` in JSON output so the watcher can ignore already-seen feedback.
- `scripts/wait_for_codex_review_event.js`
  - Poll every 30 seconds until approval or newer Codex feedback appears.
  - Return immediately when matching feedback already exists and no `--after-*` baseline IDs are supplied.
  - Emit heartbeat logs to `stderr` while waiting and one final JSON object to `stdout`.

## Troubleshooting

- Read `references/gh-review-loop-reference.md` for:
  - Actor matching strategy.
  - Exact watcher CLI contract and baseline-ID usage.
  - GraphQL snippets for review-thread listing and resolution.
  - Operational guardrails for ambiguous feedback states.
