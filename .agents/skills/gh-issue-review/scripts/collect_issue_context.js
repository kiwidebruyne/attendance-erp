#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  normalizeRepoInput,
  parseIssueTarget,
  resolveTargetRepo,
} from "./issue-target.js";

const MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const MAX_ALL_ISSUES = 100;
const USAGE = `Usage:
  bun ".agents/skills/gh-issue-review/scripts/collect_issue_context.js" --all [--repo owner/repo] [--state open|all|closed]
  bun ".agents/skills/gh-issue-review/scripts/collect_issue_context.js" 2 5 7 [--repo owner/repo]
  bun ".agents/skills/gh-issue-review/scripts/collect_issue_context.js" https://github.com/owner/repo/issues/2
`;

function parseArgs(argv) {
  const parsed = {
    all: false,
    issueInputs: [],
    repo: null,
    state: "open",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--all") {
      parsed.all = true;
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

    if (argument === "--state") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("--state requires a value.");
      }

      parsed.state = value;
      index += 1;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      console.log(USAGE);
      process.exit(0);
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    parsed.issueInputs.push(argument);
  }

  if (!["open", "all", "closed"].includes(parsed.state)) {
    throw new Error(`Unsupported state "${parsed.state}".`);
  }

  if (parsed.all && parsed.issueInputs.length > 0) {
    throw new Error("Do not pass issue identifiers together with --all.");
  }

  if (!parsed.all && parsed.issueInputs.length === 0) {
    throw new Error(
      "Pass --all or provide at least one issue number or issue URL.",
    );
  }

  return parsed;
}

function runGh(argumentsList, repo) {
  const args = [...argumentsList];

  if (repo) {
    args.push("--repo", repo);
  }

  return execFileSync("gh", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listRelativeEntries(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);

  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git")
    .map((entry) =>
      path.posix.join(relativePath.replaceAll("\\", "/"), entry.name),
    )
    .sort((left, right) => left.localeCompare(right));
}

function resolveRepoSlug(repo) {
  if (repo) {
    return repo;
  }

  const raw = execFileSync(
    "gh",
    ["repo", "view", "--json", "nameWithOwner,url"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: MAX_BUFFER_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
  const payload = JSON.parse(raw);
  const url = new URL(payload.url);
  const candidate =
    url.host.toLowerCase() === "github.com"
      ? payload.nameWithOwner
      : `${url.host}/${payload.nameWithOwner}`;

  return normalizeRepoInput(candidate, "resolved repository");
}

function detectRepoMetadata(repo) {
  let remote = null;

  try {
    remote = JSON.parse(
      execFileSync(
        "gh",
        [
          "repo",
          "view",
          ...(repo ? [repo] : []),
          "--json",
          "nameWithOwner,url,defaultBranchRef",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).trim(),
    );
  } catch {
    remote = null;
  }

  return {
    cwd: process.cwd(),
    docsFiles: listRelativeEntries("docs"),
    rootEntries: readdirSync(process.cwd(), { withFileTypes: true })
      .filter((entry) => entry.name !== ".git")
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right)),
    workflowFiles: listRelativeEntries(path.join(".github", "workflows")),
    detectedFiles: [
      "AGENTS.md",
      "README.md",
      "package.json",
      "bun.lock",
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "Cargo.toml",
      "pyproject.toml",
      "go.mod",
    ].filter((filePath) => existsSync(path.join(process.cwd(), filePath))),
    remote,
  };
}

function listIssues(state, repo) {
  const raw = runGh(
    [
      "issue",
      "list",
      "--state",
      state,
      "--limit",
      String(MAX_ALL_ISSUES + 1),
      "--json",
      "number",
    ],
    repo,
  );

  if (!raw.trim()) {
    return {
      issues: [],
      truncated: false,
    };
  }

  const listedIssues = JSON.parse(raw);

  return {
    issues: listedIssues.slice(0, MAX_ALL_ISSUES),
    truncated: listedIssues.length > MAX_ALL_ISSUES,
  };
}

function viewIssue(target, repo) {
  const selector = target.selector;
  const effectiveRepo = resolveTargetRepo(repo, target);
  const raw = runGh(
    [
      "issue",
      "view",
      selector,
      "--json",
      "number,title,body,labels,state,url,author,comments",
    ],
    target.kind === "number" ? effectiveRepo : undefined,
  );

  return JSON.parse(raw);
}

function uniqueTargets(targets) {
  const seen = new Set();

  return targets.filter((target) => {
    if (seen.has(target.selector)) {
      return false;
    }

    seen.add(target.selector);
    return true;
  });
}

function resolveReviewRepo(parsed, requestedTargets, allRepo) {
  if (parsed.all) {
    return allRepo;
  }

  let currentRepo = parsed.repo;
  const targetRepos = new Set();

  for (const target of requestedTargets) {
    let targetRepo = resolveTargetRepo(parsed.repo, target);

    if (!targetRepo) {
      if (!currentRepo) {
        currentRepo = resolveRepoSlug(null);
      }

      targetRepo = currentRepo;
    }

    targetRepos.add(targetRepo);
  }

  if (targetRepos.size > 1) {
    throw new Error(
      "Do not mix issue identifiers from multiple repositories in one invocation. Split the command by repository or pass --repo so all bare issue numbers resolve to the same repository.",
    );
  }

  const [reviewRepo] = targetRepos;

  return reviewRepo ?? null;
}

function describeSelectedIssues(state) {
  if (state === "closed") {
    return "closed issues";
  }

  if (state === "all") {
    return "issues across all states";
  }

  return "open issues";
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const allRepo = parsed.all ? resolveRepoSlug(parsed.repo) : null;
  const requestedTargets = parsed.issueInputs.map((input) =>
    parseIssueTarget(input),
  );
  const reviewRepo = resolveReviewRepo(parsed, requestedTargets, allRepo);
  const listedIssues = parsed.all ? listIssues(parsed.state, allRepo) : null;

  const issueTargets = parsed.all
    ? listedIssues.issues.map((issue) => parseIssueTarget(String(issue.number)))
    : uniqueTargets(requestedTargets);

  const issues = issueTargets.map((target) => viewIssue(target, reviewRepo));
  const output = {
    repo: detectRepoMetadata(reviewRepo),
    requestedInputs: parsed.all ? ["--all"] : parsed.issueInputs,
    requestedIssues: issueTargets.map((target) => target.issueNumber),
    selection: parsed.all
      ? {
          limit: MAX_ALL_ISSUES,
          notice: listedIssues.truncated
            ? `Requested --all, but collected only the first ${MAX_ALL_ISSUES} ${describeSelectedIssues(parsed.state)}. This helper does not paginate past that cap.`
            : `Requested --all. This helper reviews up to the first ${MAX_ALL_ISSUES} ${describeSelectedIssues(parsed.state)} per run.`,
          returnedIssueCount: issueTargets.length,
          truncated: listedIssues.truncated,
        }
      : null,
    issues,
  };

  console.log(JSON.stringify(output, null, 2));
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
