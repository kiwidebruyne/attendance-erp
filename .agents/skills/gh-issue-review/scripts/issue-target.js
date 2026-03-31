const DEFAULT_GITHUB_HOST = "github.com";
const ISSUE_PATH_PATTERN = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/;

function stripOptionalGitSuffix(repo) {
  return repo.toLowerCase().endsWith(".git") ? repo.slice(0, -4) : repo;
}

function formatRepoSlug(parts) {
  return parts.host === DEFAULT_GITHUB_HOST
    ? `${parts.owner}/${parts.repo}`
    : `${parts.host}/${parts.owner}/${parts.repo}`;
}

function parseRepoSlug(repoInput) {
  const trimmed = String(repoInput).trim();

  if (!trimmed) {
    throw new Error("Repository input cannot be empty.");
  }

  if (trimmed.includes("://")) {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length !== 2) {
      throw new Error(
        `Repository URL must point to a repository root: "${repoInput}".`,
      );
    }

    return {
      host: url.host.toLowerCase(),
      owner: segments[0],
      repo: stripOptionalGitSuffix(segments[1]),
    };
  }

  const segments = trimmed.split("/").filter(Boolean);

  if (segments.length === 2) {
    return {
      host: DEFAULT_GITHUB_HOST,
      owner: segments[0],
      repo: stripOptionalGitSuffix(segments[1]),
    };
  }

  if (segments.length === 3) {
    return {
      host: segments[0].toLowerCase(),
      owner: segments[1],
      repo: stripOptionalGitSuffix(segments[2]),
    };
  }

  throw new Error(
    `Repository input must use OWNER/REPO or HOST/OWNER/REPO: "${repoInput}".`,
  );
}

export function normalizeRepoInput(repoInput, optionName = "--repo") {
  try {
    return formatRepoSlug(parseRepoSlug(repoInput));
  } catch {
    throw new Error(
      `${optionName} must use OWNER/REPO or HOST/OWNER/REPO format.`,
    );
  }
}

export function repoSlugsEqual(leftRepo, rightRepo) {
  const left = parseRepoSlug(leftRepo);
  const right = parseRepoSlug(rightRepo);

  return (
    left.host === right.host &&
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.repo.toLowerCase() === right.repo.toLowerCase()
  );
}

export function parseIssueTarget(input) {
  const trimmed = String(input).trim();

  if (/^\d+$/.test(trimmed)) {
    return {
      issueNumber: Number.parseInt(trimmed, 10),
      kind: "number",
      rawInput: trimmed,
      repoSlug: null,
      selector: trimmed,
    };
  }

  try {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";

    const match = url.pathname.match(ISSUE_PATH_PATTERN);

    if (!match) {
      throw new Error("Issue URL does not match /owner/repo/issues/<number>.");
    }

    const [, owner, repo, issueNumber] = match;
    url.pathname = `/${owner}/${repo}/issues/${issueNumber}`;

    return {
      issueNumber: Number.parseInt(issueNumber, 10),
      kind: "url",
      rawInput: trimmed,
      repoSlug: formatRepoSlug({
        host: url.host.toLowerCase(),
        owner,
        repo,
      }),
      selector: url.toString(),
    };
  } catch {
    throw new Error(`Could not parse issue identifier "${input}".`);
  }
}

export function resolveTargetRepo(explicitRepo, target) {
  if (
    explicitRepo &&
    target.repoSlug &&
    !repoSlugsEqual(explicitRepo, target.repoSlug)
  ) {
    throw new Error(
      `Conflicting repository inputs: issue target "${target.rawInput}" points to "${target.repoSlug}" but --repo is "${explicitRepo}".`,
    );
  }

  return explicitRepo ?? target.repoSlug ?? null;
}
