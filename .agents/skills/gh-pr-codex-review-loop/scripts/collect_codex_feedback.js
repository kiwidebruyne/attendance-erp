#!/usr/bin/env node

"use strict";

const {
  buildFeedbackSummary,
  createActorMatcher,
  fetchFeedbackData,
  resolveRepo,
} = require("./lib/codex-review-loop");

function printHelp() {
  console.log(`Usage: collect_codex_feedback.js <pr_number> [options]

Collect Codex-authored feedback from a pull request.

Options:
  --repo <owner/repo>          Repository override
  --actor <login>              Exact actor login to match (repeatable)
  --actor-regex <pattern>      Case-insensitive regex matcher (default: codex)
  --no-default-actors          Disable default actor list
  --format <markdown|json>     Output format (default: markdown)
  --max-body-length <number>   Max body chars after compaction (default: 360)
  --fail-if-empty              Exit 1 if no matching feedback items found
  -h, --help                   Show this help message`);
}

function parseArgs(argv) {
  const options = {
    repo: null,
    actors: [],
    actorRegex: "codex",
    noDefaultActors: false,
    format: "markdown",
    maxBodyLength: 360,
    failIfEmpty: false,
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
    if (arg === "--format") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--format requires a value");
      }

      const value = String(argv[i]);
      if (value !== "markdown" && value !== "json") {
        throw new Error(`Unsupported --format value: ${value}`);
      }
      options.format = value;
      continue;
    }
    if (arg === "--max-body-length") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("--max-body-length requires a value");
      }

      const value = Number.parseInt(argv[i], 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --max-body-length value: ${argv[i]}`);
      }
      options.maxBodyLength = value;
      continue;
    }
    if (arg === "--fail-if-empty") {
      options.failIfEmpty = true;
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

function formatMarkdown(summary) {
  const lines = [];
  lines.push("# Codex Feedback Digest");
  lines.push("");
  lines.push(`- Repository: \`${summary.repo}\``);
  lines.push(`- Pull request: \`${summary.pr_number}\``);
  lines.push(`- Generated at (UTC): \`${summary.generated_at_utc}\``);
  lines.push("");
  lines.push(`## Review Summaries (${summary.review_summaries.length})`);

  if (summary.review_summaries.length > 0) {
    for (const item of summary.review_summaries) {
      lines.push(
        `- [${item.state}] @${item.author} (${item.submitted_at || "unknown time"}) ${item.url}`,
      );
      if (item.body) {
        lines.push(`  - ${item.body}`);
      }
    }
  } else {
    lines.push("- No Codex-authored review summaries found.");
  }

  lines.push("");
  lines.push(`## Inline Comments (${summary.inline_comments.length})`);
  if (summary.inline_comments.length > 0) {
    for (const item of summary.inline_comments) {
      let location = item.path;
      if (item.line !== null && item.line !== undefined) {
        location = `${location}:${item.line}`;
      }
      lines.push(
        `- @${item.author} on \`${location}\` (${item.created_at || "unknown time"}) ${item.url}`,
      );
      if (item.body) {
        lines.push(`  - ${item.body}`);
      }
    }
  } else {
    lines.push("- No Codex-authored inline comments found.");
  }

  lines.push("");
  lines.push(`## Discussion Comments (${summary.discussion_comments.length})`);
  if (summary.discussion_comments.length > 0) {
    for (const item of summary.discussion_comments) {
      lines.push(`- @${item.author} (${item.created_at || "unknown time"}) ${item.url}`);
      if (item.body) {
        lines.push(`  - ${item.body}`);
      }
    }
  } else {
    lines.push("- No Codex-authored discussion comments found.");
  }

  return lines.join("\n");
}

function collectCodexFeedback(options) {
  const actorMatcher = createActorMatcher({
    actors: options.actors,
    actorRegex: options.actorRegex,
    noDefaultActors: options.noDefaultActors,
  });
  const repo = resolveRepo(options.repo);
  const { reviews, inlineComments, discussionComments } = fetchFeedbackData(
    repo,
    options.prNumber,
  );

  return buildFeedbackSummary({
    actorMatcher,
    repo,
    prNumber: options.prNumber,
    reviews,
    inlineComments,
    discussionComments,
    maxBodyLength: options.maxBodyLength,
  });
}

function main(argv = process.argv.slice(2)) {
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

  let summary;
  try {
    summary = collectCodexFeedback(args);
  } catch (error) {
    console.log(JSON.stringify({ error: String(error.message || error) }));
    return 2;
  }

  if (args.format === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatMarkdown(summary));
  }

  const totalItems =
    summary.review_summaries.length +
    summary.inline_comments.length +
    summary.discussion_comments.length;
  if (args.failIfEmpty && totalItems === 0) {
    return 1;
  }

  return 0;
}

exports.collectCodexFeedback = collectCodexFeedback;
exports.formatMarkdown = formatMarkdown;
exports.main = main;
exports.parseArgs = parseArgs;

if (require.main === module) {
  process.exit(main());
}
