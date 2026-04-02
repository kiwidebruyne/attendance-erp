#!/usr/bin/env node

"use strict";

const {
  createActorMatcher,
  fetchReactions,
  findReactionMatches,
  resolveRepo,
} = require("./lib/codex-review-loop");

function printHelp() {
  console.log(`Usage: check_codex_review_trigger.js <pr_number> [options]

Check whether a PR has a Codex :eyes: reaction.

Options:
  --repo <owner/repo>       Repository override
  --actor <login>           Exact actor login to match (repeatable)
  --actor-regex <pattern>   Case-insensitive regex actor matcher
  --no-default-actors       Disable default actor list
  --exit-zero               Always exit with 0 after output
  -h, --help                Show this help message`);
}

function parseArgs(argv) {
  const options = {
    repo: null,
    actors: [],
    actorRegex: null,
    noDefaultActors: false,
    exitZero: false,
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
    if (arg === "--exit-zero") {
      options.exitZero = true;
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

function checkCodexReviewTrigger(options) {
  const actorMatcher = createActorMatcher({
    actors: options.actors,
    actorRegex: options.actorRegex,
    noDefaultActors: options.noDefaultActors,
  });
  const repo = resolveRepo(options.repo);
  const reactions = fetchReactions(repo, options.prNumber);
  const matches = findReactionMatches({
    reactions,
    content: "eyes",
    actorMatcher,
  });

  return {
    triggered: matches.length > 0,
    repo,
    pr_number: options.prNumber,
    reaction_count: reactions.length,
    matched_reaction_count: matches.length,
    matches,
    configured_actors: actorMatcher.configuredActors,
    actor_regex: actorMatcher.actorRegex,
  };
}

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.log(JSON.stringify({ error: String(error.message || error), triggered: false }));
    return 2;
  }

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.prNumber === null) {
    console.log(
      JSON.stringify({
        error: "Missing required argument: <pr_number>",
        triggered: false,
      }),
    );
    return 2;
  }

  let result;
  try {
    result = checkCodexReviewTrigger(args);
  } catch (error) {
    console.log(JSON.stringify({ error: String(error.message || error), triggered: false }));
    return 2;
  }

  console.log(JSON.stringify(result, null, 2));
  if (args.exitZero) {
    return 0;
  }

  return result.triggered ? 0 : 1;
}

exports.checkCodexReviewTrigger = checkCodexReviewTrigger;
exports.main = main;
exports.parseArgs = parseArgs;

if (require.main === module) {
  process.exit(main());
}
