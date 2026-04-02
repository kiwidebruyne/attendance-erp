# GitHub PR Codex Review Loop Reference

## Purpose

Use this reference while running the loop defined in `../SKILL.md`.
It provides deterministic commands for actor matching, approval checks, trigger checks, blocking wait behavior, and review-thread operations.

## Actor Matching

Default Codex actors in bundled scripts:

- `codex`
- `codex[bot]`
- `openai-codex`
- `openai-codex[bot]`
- `chatgpt-codex-connector[bot]`

If your workspace uses a different identity, pass `--actor <login>` or `--actor-regex "<pattern>"`.
Use the same actor overrides consistently across approval checks, trigger checks, feedback collection, and the blocking watcher.

## Approval Check

```bash
node scripts/check_codex_thumbs_up.js 123 --repo owner/repo
```

Interpretation:

- `approved=true` means the loop can stop.
- `approved=false` means the loop continues.
- Exit codes:
  - `0` approval detected
  - `1` approval absent
  - `2` invalid input or `gh` failure

## Review Trigger Check

```bash
node scripts/check_codex_review_trigger.js 123 --repo owner/repo
```

Interpretation:

- `triggered=true` means a matching Codex `eyes` reaction is present.
- `triggered=false` means no matching `eyes` reaction is present yet.
- This script is diagnostic only. A trigger does not stop the loop, and a missing trigger is not permission to manually tag Codex while the watcher is still polling.

## Feedback Collection

```bash
node scripts/collect_codex_feedback.js 123 --repo owner/repo --format json
```

Key JSON fields:

- `review_summaries`
- `inline_comments`
- `discussion_comments`
- `latest_ids.review`
- `latest_ids.inline_comment`
- `latest_ids.discussion_comment`

Use `latest_ids` from the last seen payload as the baseline for the blocking watcher after each push.

## Blocking Waiter

Use the waiter instead of an agent-managed sleep loop:

```bash
node scripts/wait_for_codex_review_event.js 123 \
  --repo owner/repo \
  --after-review-id 456 \
  --after-inline-comment-id 789 \
  --after-discussion-comment-id 1011
```

Behavior:

- Polls every 30 seconds by default.
- Re-checks approval before feedback on each pass.
- Emits heartbeat JSON to `stderr` on every waiting pass.
- Prints exactly one final JSON object to `stdout`.
- Exits `0` when either:
  - `event=approved`
  - `event=feedback`
- Exits `2` on invalid input or `gh` failure.

Baseline rules:

- If no `--after-*` IDs are supplied, existing matching feedback is returned immediately.
- If `--after-*` IDs are supplied, only items with larger IDs count as new.
- Use all three baseline IDs after each push so the waiter does not wake up on already-seen feedback.

## Continuous Polling Cadence

- After each push, start `wait_for_codex_review_event.js` and let it own the 30-second polling cadence.
- While the waiter is running, do not manually request Codex review.
- Missing feedback during the wait is a normal non-terminal state, not a reason to re-trigger review.
- If the waiter returns `event=feedback`, address only the newly returned items and then start the waiter again with fresh baseline IDs after the next push.
- The only loop stop condition is a matching Codex `:+1:` reaction.

## Review-Thread Listing (GraphQL)

Use this query to list unresolved review threads and their latest comment metadata:

```bash
gh api graphql \
  -f owner='OWNER' \
  -f repo='REPO' \
  -F number=PR_NUMBER \
  -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              isOutdated
              comments(last: 1) {
                nodes {
                  author { login }
                  body
                  url
                }
              }
            }
          }
        }
      }
    }
  '
```

## Review-Thread Resolve Mutation (GraphQL)

Resolve a thread only after the corresponding feedback is fully addressed:

```bash
gh api graphql \
  -f query='
    mutation($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }
  ' \
  -f threadId='THREAD_ID'
```

## Operational Guardrails

- Do not resolve threads preemptively.
- Do not stop the loop on `APPROVED` review state alone; use the `:+1:` reaction as the stop condition.
- Follow the no manual tag during scripted wait rule.
- Do not manually tag Codex during scripted wait, even if the `eyes` trigger is still absent.
- Do not treat a missing `eyes` reaction as proof that the GitHub review trigger failed.
- Do not stop the loop when approval is absent but no new feedback has appeared yet; keep polling through the blocking waiter.
