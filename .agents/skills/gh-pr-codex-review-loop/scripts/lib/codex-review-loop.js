#!/usr/bin/env node

"use strict";

const { execFileSync } = require("node:child_process");

const DEFAULT_ACTORS = [
  "codex",
  "codex[bot]",
  "openai-codex",
  "openai-codex[bot]",
  "chatgpt-codex-connector[bot]",
];

function compactText(text, maxBodyLength) {
  if (!text) {
    return "";
  }

  const collapsed = String(text).trim().split(/\s+/u).join(" ");
  if (collapsed.length <= maxBodyLength) {
    return collapsed;
  }

  const keep = maxBodyLength - 3;
  if (keep <= 0) {
    return "...";
  }

  return `${collapsed.slice(0, keep)}...`;
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function normalizeAfterIds(afterIds) {
  const source = afterIds || {};

  return {
    review: normalizeId(source.review),
    inline_comment: normalizeId(source.inline_comment),
    discussion_comment: normalizeId(source.discussion_comment),
  };
}

function getLatestId(items) {
  let latest = null;

  for (const item of items) {
    const id = normalizeId(item.id);
    if (id === null) {
      continue;
    }

    if (latest === null || id > latest) {
      latest = id;
    }
  }

  return latest;
}

function getAuthorLogin(item) {
  if (item && item.author) {
    return String(item.author);
  }

  if (item && item.user && item.user.login) {
    return String(item.user.login);
  }

  return "";
}

function createActorMatcher(options = {}) {
  const actorSet = new Set();
  const actors = Array.isArray(options.actors) ? options.actors : [];

  if (!options.noDefaultActors) {
    for (const actor of DEFAULT_ACTORS) {
      actorSet.add(actor.toLowerCase());
    }
  }

  for (const actor of actors) {
    actorSet.add(String(actor).toLowerCase());
  }

  let actorPattern = null;
  if (options.actorRegex) {
    actorPattern = new RegExp(String(options.actorRegex), "i");
  }

  if (actorSet.size === 0 && !actorPattern) {
    throw new Error(
      "No actor matcher configured; set --actor, --actor-regex, or keep defaults.",
    );
  }

  const configuredActors = Array.from(actorSet).sort();

  return {
    actorRegex: options.actorRegex || null,
    configuredActors,
    matches(login) {
      const raw = String(login || "");
      if (!raw) {
        return false;
      }

      const lowered = raw.toLowerCase();
      if (actorSet.has(lowered)) {
        return true;
      }

      if (actorPattern && actorPattern.test(raw)) {
        return true;
      }

      return false;
    },
  };
}

function findReactionMatches({ reactions, content, actorMatcher }) {
  if (!Array.isArray(reactions)) {
    throw new Error("reactions must be an array");
  }

  const matches = [];

  for (const reaction of reactions) {
    if (!reaction || reaction.content !== content) {
      continue;
    }

    const login = getAuthorLogin(reaction);
    if (!actorMatcher.matches(login)) {
      continue;
    }

    matches.push({
      id: normalizeId(reaction.id),
      user: login,
      created_at: reaction.created_at || null,
    });
  }

  return matches;
}

function buildFeedbackSummary(options) {
  const actorMatcher = options.actorMatcher;
  const maxBodyLength = options.maxBodyLength ?? 360;

  const reviewSummaries = [];
  for (const review of options.reviews || []) {
    const author = getAuthorLogin(review);
    if (!actorMatcher.matches(author)) {
      continue;
    }

    reviewSummaries.push({
      id: normalizeId(review.id),
      state: review.state || null,
      author,
      submitted_at: review.submitted_at || null,
      url: review.html_url || review.url || null,
      body: compactText(review.body || "", maxBodyLength),
    });
  }

  const inlineComments = [];
  for (const comment of options.inlineComments || []) {
    const author = getAuthorLogin(comment);
    if (!actorMatcher.matches(author)) {
      continue;
    }

    inlineComments.push({
      id: normalizeId(comment.id),
      author,
      path: comment.path || null,
      line: comment.line ?? null,
      side: comment.side || null,
      created_at: comment.created_at || null,
      url: comment.html_url || comment.url || null,
      body: compactText(comment.body || "", maxBodyLength),
    });
  }

  const discussionComments = [];
  for (const comment of options.discussionComments || []) {
    const author = getAuthorLogin(comment);
    if (!actorMatcher.matches(author)) {
      continue;
    }

    discussionComments.push({
      id: normalizeId(comment.id),
      author,
      created_at: comment.created_at || null,
      url: comment.html_url || comment.url || null,
      body: compactText(comment.body || "", maxBodyLength),
    });
  }

  return {
    repo: options.repo,
    pr_number: options.prNumber,
    generated_at_utc: options.generatedAtUtc || new Date().toISOString(),
    review_summaries: reviewSummaries,
    inline_comments: inlineComments,
    discussion_comments: discussionComments,
    latest_ids: {
      review: getLatestId(reviewSummaries),
      inline_comment: getLatestId(inlineComments),
      discussion_comment: getLatestId(discussionComments),
    },
    configured_actors: actorMatcher.configuredActors,
    actor_regex: actorMatcher.actorRegex,
  };
}

function filterFeedbackAfterIds(summary, afterIds) {
  const normalizedAfterIds = normalizeAfterIds(afterIds);

  const reviewSummaries = (summary.review_summaries || []).filter((item) => {
    const id = normalizeId(item.id);
    return normalizedAfterIds.review === null || (id !== null && id > normalizedAfterIds.review);
  });

  const inlineComments = (summary.inline_comments || []).filter((item) => {
    const id = normalizeId(item.id);
    return (
      normalizedAfterIds.inline_comment === null ||
      (id !== null && id > normalizedAfterIds.inline_comment)
    );
  });

  const discussionComments = (summary.discussion_comments || []).filter((item) => {
    const id = normalizeId(item.id);
    return (
      normalizedAfterIds.discussion_comment === null ||
      (id !== null && id > normalizedAfterIds.discussion_comment)
    );
  });

  return {
    review_summaries: reviewSummaries,
    inline_comments: inlineComments,
    discussion_comments: discussionComments,
    latest_ids: {
      review: getLatestId(reviewSummaries),
      inline_comment: getLatestId(inlineComments),
      discussion_comment: getLatestId(discussionComments),
    },
  };
}

function hasFeedbackItems(summary) {
  return (
    (summary.review_summaries || []).length > 0 ||
    (summary.inline_comments || []).length > 0 ||
    (summary.discussion_comments || []).length > 0
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForReviewEvent(options) {
  if (typeof options.checkApproval !== "function") {
    throw new Error("checkApproval must be a function");
  }

  if (typeof options.collectFeedback !== "function") {
    throw new Error("collectFeedback must be a function");
  }

  const intervalMs = options.intervalMs ?? 30000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("intervalMs must be a positive number");
  }

  const afterIds = normalizeAfterIds(options.afterIds);
  const onHeartbeat = options.onHeartbeat || (() => {});
  const sleepImpl = options.sleep || sleep;

  let pollCount = 0;
  while (true) {
    pollCount += 1;

    const approval = await options.checkApproval();
    if (approval && approval.approved) {
      return {
        event: "approved",
        approval,
        poll_count: pollCount,
      };
    }

    const feedback = await options.collectFeedback();
    const newFeedback = filterFeedbackAfterIds(feedback, afterIds);
    if (hasFeedbackItems(newFeedback)) {
      return {
        event: "feedback",
        feedback,
        new_feedback: newFeedback,
        poll_count: pollCount,
      };
    }

    await Promise.resolve(
      onHeartbeat({
        waiting: true,
        poll_count: pollCount,
        interval_ms: intervalMs,
        after_ids: afterIds,
        latest_ids: feedback.latest_ids || null,
      }),
    );

    await sleepImpl(intervalMs);
  }
}

function runGh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8" });
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const detail = stderr || stdout || error.message;
    throw new Error(`gh command failed: gh ${args.join(" ")} (${detail})`);
  }
}

function resolveRepo(repo, runGhImpl = runGh) {
  if (repo) {
    return repo;
  }

  const out = runGhImpl([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]).trim();

  if (!out.includes("/")) {
    throw new Error(
      `could not resolve repository from gh output: ${JSON.stringify(out)}`,
    );
  }

  return out;
}

function fetchArrayEndpoint(path, runGhImpl = runGh) {
  const out = runGhImpl([
    "api",
    "-H",
    "Accept: application/vnd.github+json",
    path,
    "--method",
    "GET",
    "--field",
    "per_page=100",
  ]);

  const payload = JSON.parse(out);
  if (!Array.isArray(payload)) {
    throw new Error(
      `unexpected payload for endpoint ${JSON.stringify(path)}; expected a JSON array`,
    );
  }

  return payload;
}

function fetchReactions(repo, prNumber, runGhImpl = runGh) {
  return fetchArrayEndpoint(`repos/${repo}/issues/${prNumber}/reactions`, runGhImpl);
}

function fetchFeedbackData(repo, prNumber, runGhImpl = runGh) {
  return {
    reviews: fetchArrayEndpoint(`repos/${repo}/pulls/${prNumber}/reviews`, runGhImpl),
    inlineComments: fetchArrayEndpoint(
      `repos/${repo}/pulls/${prNumber}/comments`,
      runGhImpl,
    ),
    discussionComments: fetchArrayEndpoint(
      `repos/${repo}/issues/${prNumber}/comments`,
      runGhImpl,
    ),
  };
}

exports.DEFAULT_ACTORS = DEFAULT_ACTORS;
exports.buildFeedbackSummary = buildFeedbackSummary;
exports.compactText = compactText;
exports.createActorMatcher = createActorMatcher;
exports.fetchArrayEndpoint = fetchArrayEndpoint;
exports.fetchFeedbackData = fetchFeedbackData;
exports.fetchReactions = fetchReactions;
exports.filterFeedbackAfterIds = filterFeedbackAfterIds;
exports.findReactionMatches = findReactionMatches;
exports.hasFeedbackItems = hasFeedbackItems;
exports.normalizeAfterIds = normalizeAfterIds;
exports.normalizeId = normalizeId;
exports.resolveRepo = resolveRepo;
exports.runGh = runGh;
exports.waitForReviewEvent = waitForReviewEvent;
