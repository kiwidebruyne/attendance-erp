import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

const skillPath = resolve(
  process.cwd(),
  ".agents/skills/gh-pr-codex-review-loop/SKILL.md",
);
const referencePath = resolve(
  process.cwd(),
  ".agents/skills/gh-pr-codex-review-loop/references/gh-review-loop-reference.md",
);
const helperModuleUrl = pathToFileURL(
  resolve(
    process.cwd(),
    ".agents/skills/gh-pr-codex-review-loop/scripts/lib/codex-review-loop.js",
  ),
).href;

async function loadReviewLoopHelpers() {
  return import(helperModuleUrl);
}

describe("gh-pr-codex-review-loop skill", () => {
  it("documents blocking scripted waiting instead of speculative manual Codex tagging", () => {
    const skill = readFileSync(skillPath, "utf8");
    const reference = readFileSync(referencePath, "utf8");

    expect(skill).toContain("wait_for_codex_review_event.js");
    expect(skill).toContain("check_codex_review_trigger.js");
    expect(skill).toMatch(/Do not manually request Codex review while/i);
    expect(reference).toMatch(/no manual tag during scripted wait/i);
  });
});

describe("codex review loop helpers", () => {
  it("matches only eyes reactions from allowed actors for trigger checks", async () => {
    const { createActorMatcher, findReactionMatches } =
      await loadReviewLoopHelpers();
    const actorMatcher = createActorMatcher({});

    const matches = findReactionMatches({
      reactions: [
        {
          id: 10,
          content: "eyes",
          created_at: "2026-04-02T00:00:00Z",
          user: { login: "codex" },
        },
        {
          id: 11,
          content: "+1",
          created_at: "2026-04-02T00:01:00Z",
          user: { login: "codex" },
        },
        {
          id: 12,
          content: "eyes",
          created_at: "2026-04-02T00:02:00Z",
          user: { login: "someone-else" },
        },
      ],
      content: "eyes",
      actorMatcher,
    });

    expect(matches).toEqual([
      {
        id: 10,
        user: "codex",
        created_at: "2026-04-02T00:00:00Z",
      },
    ]);
  });

  it("includes stable latest_ids in feedback summaries", async () => {
    const { buildFeedbackSummary, createActorMatcher } =
      await loadReviewLoopHelpers();
    const actorMatcher = createActorMatcher({});

    const summary = buildFeedbackSummary({
      actorMatcher,
      repo: "owner/repo",
      prNumber: 123,
      generatedAtUtc: "2026-04-02T00:00:00.000Z",
      reviews: [
        {
          id: 30,
          state: "COMMENTED",
          submitted_at: "2026-04-02T00:00:01Z",
          html_url: "https://example.com/review/30",
          body: "Review body",
          user: { login: "codex" },
        },
      ],
      inlineComments: [
        {
          id: 40,
          path: "file.ts",
          line: 12,
          side: "RIGHT",
          created_at: "2026-04-02T00:00:02Z",
          html_url: "https://example.com/comment/40",
          body: "Inline body",
          user: { login: "codex" },
        },
      ],
      discussionComments: [
        {
          id: 50,
          created_at: "2026-04-02T00:00:03Z",
          html_url: "https://example.com/discussion/50",
          body: "Discussion body",
          user: { login: "codex" },
        },
      ],
      maxBodyLength: 360,
    });

    expect(summary.latest_ids).toEqual({
      review: 30,
      inline_comment: 40,
      discussion_comment: 50,
    });
  });

  it("returns immediately when existing feedback is present and no baseline ids are supplied", async () => {
    const { waitForReviewEvent } = await loadReviewLoopHelpers();
    const sleep = vi.fn();

    const result = await waitForReviewEvent({
      checkApproval: vi.fn().mockResolvedValue({
        approved: false,
        matches: [],
      }),
      collectFeedback: vi.fn().mockResolvedValue({
        latest_ids: {
          review: 30,
          inline_comment: null,
          discussion_comment: null,
        },
        review_summaries: [
          {
            id: 30,
            author: "codex",
            body: "Please update the watcher flow.",
          },
        ],
        inline_comments: [],
        discussion_comments: [],
      }),
      sleep,
    });

    expect(result.event).toBe("feedback");
    expect(result.new_feedback.review_summaries).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("ignores old feedback when baseline ids are supplied and waits for newer items", async () => {
    const { waitForReviewEvent } = await loadReviewLoopHelpers();
    const sleep = vi.fn().mockResolvedValue(undefined);
    let pollCount = 0;

    const result = await waitForReviewEvent({
      afterIds: {
        review: 30,
        inline_comment: null,
        discussion_comment: null,
      },
      checkApproval: vi.fn().mockResolvedValue({
        approved: false,
        matches: [],
      }),
      collectFeedback: vi.fn().mockImplementation(async () => {
        pollCount += 1;

        if (pollCount === 1) {
          return {
            latest_ids: {
              review: 30,
              inline_comment: null,
              discussion_comment: null,
            },
            review_summaries: [
              {
                id: 30,
                author: "codex",
                body: "Old feedback",
              },
            ],
            inline_comments: [],
            discussion_comments: [],
          };
        }

        return {
          latest_ids: {
            review: 31,
            inline_comment: null,
            discussion_comment: null,
          },
          review_summaries: [
            {
              id: 30,
              author: "codex",
              body: "Old feedback",
            },
            {
              id: 31,
              author: "codex",
              body: "New feedback",
            },
          ],
          inline_comments: [],
          discussion_comments: [],
        };
      }),
      intervalMs: 1,
      sleep,
    });

    expect(result.event).toBe("feedback");
    expect(result.new_feedback.review_summaries).toEqual([
      {
        id: 31,
        author: "codex",
        body: "New feedback",
      },
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("returns approved when a thumbs-up appears on a later poll", async () => {
    const { waitForReviewEvent } = await loadReviewLoopHelpers();
    const sleep = vi.fn().mockResolvedValue(undefined);
    let approvalChecks = 0;

    const result = await waitForReviewEvent({
      checkApproval: vi.fn().mockImplementation(async () => {
        approvalChecks += 1;
        return {
          approved: approvalChecks > 1,
          matches:
            approvalChecks > 1
              ? [
                  {
                    id: 99,
                    user: "codex",
                    created_at: "2026-04-02T00:10:00Z",
                  },
                ]
              : [],
        };
      }),
      collectFeedback: vi.fn().mockResolvedValue({
        latest_ids: {
          review: null,
          inline_comment: null,
          discussion_comment: null,
        },
        review_summaries: [],
        inline_comments: [],
        discussion_comments: [],
      }),
      intervalMs: 1,
      sleep,
    });

    expect(result.event).toBe("approved");
    expect(result.approval.matches).toEqual([
      {
        id: 99,
        user: "codex",
        created_at: "2026-04-02T00:10:00Z",
      },
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
