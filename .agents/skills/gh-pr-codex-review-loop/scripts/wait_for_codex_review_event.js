#!/usr/bin/env node

"use strict";

const {
  buildFeedbackSummary,
  createActorMatcher,
  fetchFeedbackData,
  fetchReactions,
  findReactionMatches,
  normalizeAfterIds,
  resolveRepo,
  waitForReviewEvent,
} = require("./lib/codex-review-loop");

function printHelp() {
  console.log(`Usage: wait_for_codex_review_event.js <pr_number> [options]

Wait until a Codex thumbs-up appears or newer Codex feedback is posted.

Options:
  --repo <owner/repo>                 Repository override
  --actor <login>                     Exact actor login to match (repeatable)
  --actor-regex <pattern>             Case-insensitive regex actor matcher
  --no-default-actors                 Disable default actor list
  --interval-seconds <number>         Poll interval in seconds (default: 30)
  --after-review-id <id>              Only treat larger review ids as new
  --after-inline-comment-id <id>      Only treat larger inline comment ids as new
  --after-discussion-comment-id <id>  Only treat larger discussion comment ids as new
  --max-body-length <number>          Max body chars after compaction (default: 360)
  -h, --help                          Show this help message`);
}

function parseOptionalId(name, value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return parsed;
}

function parseArgs(argv) {
  const options = {
    repo: null,
    actors: [],
    actorRegex: null,
    noDefaultActors: false,
    intervalSeconds: 30,
    afterReviewId: null,
    afterInlineCommentId: null,
    afterDiscussionCommentId: null,
    maxBodyLength: 360,
    prNumber: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      return options;
    }
    if (arg === "--repo") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--repo requires a value");
      }
      options.repo = argv[i];
      continue;
    }
    if (arg === "--actor") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--actor requires a value");
      }
      options.actors.push(argv[i]);
      continue;
    }
    if (arg === "--actor-regex") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--actor-regex requires a value");
      }
      options.actorRegex = argv[i];
      continue;
    }
    if (arg === "--no-default-actors") {
      options.noDefaultActors = true;
      continue;
    }
    if (arg === "--interval-seconds") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--interval-seconds requires a value");
      }

      const parsed = Number.parseInt(argv[i], 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--interval-seconds must be a positive integer");
      }
      options.intervalSeconds = parsed;
      continue;
    }
    if (arg === "--after-review-id") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--after-review-id requires a value");
      }
      options.afterReviewId = parseOptionalId("--after-review-id", argv[i]);
      continue;
    }
    if (arg === "--after-inline-comment-id") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--after-inline-comment-id requires a value");
      }
      options.afterInlineCommentId = parseOptionalId(
        "--after-inline-comment-id",
        argv[i],
      );
      continue;
    }
    if (arg === "--after-discussion-comment-id") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--after-discussion-comment-id requires a value");
      }
      options.afterDiscussionCommentId = parseOptionalId(
        "--after-discussion-comment-id",
        argv[i],
      );
      continue;
    }
    if (arg === "--max-body-length") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--max-body-length requires a value");
      }

      const parsed = Number.parseInt(argv[i], 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("--max-body-length must be a non-negative integer");
      }
      options.maxBodyLength = parsed;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (options.prNumber !== null) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const parsed = Number.parseInt(arg, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid PR number: ${arg}`);
    }
    options.prNumber = parsed;
  }

  return options;
}

function buildApprovalSummary(repo, prNumber, actorMatcher) {
  const reactions = fetchReactions(repo, prNumber);
  const matches = findReactionMatches({
    reactions,
    content: "+1",
    actorMatcher,
  });

  return {
    approved: matches.length > 0,
    repo,
    pr_number: prNumber,
    reaction_count: reactions.length,
    matched_reaction_count: matches.length,
    matches,
    configured_actors: actorMatcher.configuredActors,
    actor_regex: actorMatcher.actorRegex,
  };
}

function buildFeedbackSnapshot(repo, prNumber, actorMatcher, maxBodyLength) {
  const { reviews, inlineComments, discussionComments } = fetchFeedbackData(
    repo,
    prNumber,
  );

  return buildFeedbackSummary({
    actorMatcher,
    repo,
    prNumber,
    reviews,
    inlineComments,
    discussionComments,
    maxBodyLength,
  });
}

async function waitForCodexReviewEventCli(options) {
  const actorMatcher = createActorMatcher({
    actors: options.actors,
    actorRegex: options.actorRegex,
    noDefaultActors: options.noDefaultActors,
  });
  const repo = resolveRepo(options.repo);
  const afterIds = normalizeAfterIds({
    review: options.afterReviewId,
    inline_comment: options.afterInlineCommentId,
    discussion_comment: options.afterDiscussionCommentId,
  });

  const result = await waitForReviewEvent({
    afterIds,
    intervalMs: options.intervalSeconds * 1000,
    checkApproval: async () => buildApprovalSummary(repo, options.prNumber, actorMatcher),
    collectFeedback: async () =>
      buildFeedbackSnapshot(repo, options.prNumber, actorMatcher, options.maxBodyLength),
    onHeartbeat: (heartbeat) => {
      console.error(
        JSON.stringify(
          {
            waiting: true,
            poll_count: heartbeat.poll_count,
            interval_seconds: options.intervalSeconds,
            repo,
            pr_number: options.prNumber,
            after_ids: afterIds,
            latest_ids: heartbeat.latest_ids,
          },
          null,
          2,
        ),
      );
    },
  });

  return {
    ...result,
    repo,
    pr_number: options.prNumber,
    configured_actors: actorMatcher.configuredActors,
    actor_regex: actorMatcher.actorRegex,
    interval_seconds: options.intervalSeconds,
    after_ids: afterIds,
  };
}

async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.log(JSON.stringify({ error: String(error.message || error) }));
    return 2;
  }

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.prNumber === null) {
    console.log(JSON.stringify({ error: "Missing required argument: <pr_number>" }));
    return 2;
  }

  let result;
  try {
    result = await waitForCodexReviewEventCli(args);
  } catch (error) {
    console.log(JSON.stringify({ error: String(error.message || error) }));
    return 2;
  }

  console.log(JSON.stringify(result, null, 2));
  return 0;
}

exports.buildApprovalSummary = buildApprovalSummary;
exports.buildFeedbackSnapshot = buildFeedbackSnapshot;
exports.main = main;
exports.parseArgs = parseArgs;
exports.waitForCodexReviewEventCli = waitForCodexReviewEventCli;

if (require.main === module) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (error) => {
      console.log(JSON.stringify({ error: String(error.message || error) }));
      process.exit(2);
    },
  );
}
