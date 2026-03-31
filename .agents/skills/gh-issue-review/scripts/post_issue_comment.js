#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  normalizeRepoInput,
  parseIssueTarget,
  resolveTargetRepo,
} from "./issue-target.js";

const USAGE = `Usage:
  bun ".agents/skills/gh-issue-review/scripts/post_issue_comment.js" <issue-number> --body-file <path> [--repo owner/repo]
  bun ".agents/skills/gh-issue-review/scripts/post_issue_comment.js" <issue-url> --body-file <path> [--dry-run]
`;

function parseArgs(argv) {
  const parsed = {
    bodyFile: undefined,
    dryRun: false,
    issueId: undefined,
    repo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--body-file") {
      const value = argv[index + 1];

      if (!value || (value.startsWith("-") && value !== "-")) {
        throw new Error("--body-file requires a value.");
      }

      parsed.bodyFile = value;
      index += 1;
      continue;
    }

    if (argument === "--repo") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("--repo requires a value.");
      }

      parsed.repo = normalizeRepoInput(value);
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      console.log(USAGE);
      process.exit(0);
    }

    if (!parsed.issueId && !argument.startsWith("-")) {
      parsed.issueId = argument;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (parsed.issueId) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (!parsed.issueId) {
    throw new Error("Provide an issue number or issue URL.");
  }

  if (!parsed.bodyFile) {
    throw new Error(
      "Provide --body-file so the comment body never depends on shell quoting.",
    );
  }

  return parsed;
}

function readCommentBody(bodyFile) {
  if (bodyFile === "-") {
    return readFileSync(0, "utf8");
  }

  const absolutePath = path.resolve(process.cwd(), bodyFile);

  if (!existsSync(absolutePath)) {
    throw new Error(`Comment body file not found: ${absolutePath}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function postComment(target, repo, bodyFile, body) {
  const argumentsList = [
    "issue",
    "comment",
    target.selector,
    "--body-file",
    bodyFile,
  ];

  if (target.kind === "number" && repo) {
    argumentsList.push("--repo", repo);
  }

  const options = {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  };

  if (bodyFile === "-") {
    options.input = body;
    options.stdio[0] = "pipe";
  }

  const output = execFileSync("gh", argumentsList, options).trim();

  return output;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const target = parseIssueTarget(parsed.issueId);

  if (parsed.repo && target.kind === "url") {
    throw new Error(
      "Do not pass --repo when the issue target is a URL. Use either an issue number with --repo or a self-contained issue URL.",
    );
  }

  const effectiveRepo = resolveTargetRepo(parsed.repo, target);
  const body = readCommentBody(parsed.bodyFile);

  if (parsed.dryRun) {
    console.log(
      JSON.stringify(
        {
          body,
          dryRun: true,
          issueNumber: target.issueNumber,
          repo: effectiveRepo,
          selector: target.selector,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = postComment(target, effectiveRepo, parsed.bodyFile, body);

  console.log(
    JSON.stringify(
      {
        bodyLength: body.length,
        issueNumber: target.issueNumber,
        posted: true,
        repo: effectiveRepo,
        selector: target.selector,
        result,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  console.error(USAGE);
  process.exit(1);
}
