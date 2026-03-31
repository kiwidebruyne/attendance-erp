import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";

const huskyWrapperNames = new Set([
  "applypatch-msg",
  "commit-msg",
  "post-applypatch",
  "post-checkout",
  "post-commit",
  "post-merge",
  "post-rewrite",
  "pre-applypatch",
  "pre-auto-gc",
  "pre-commit",
  "pre-merge-commit",
  "pre-push",
  "pre-rebase",
  "prepare-commit-msg",
]);

const huskyWrapperContent = `#!/usr/bin/env sh
. "$(dirname "$0")/h"
`;

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, "\n");
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function runPnpm(args, options = {}) {
  const command = getPnpmCommand();

  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", command, ...args], options);
  }

  return run(command, args, options);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const detail =
      stderr || stdout || `${command} exited with status ${result.status}`;

    throw new Error(detail);
  }

  return (result.stdout ?? "").trim();
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });

  return {
    ok: result.status === 0,
    stderr: (result.stderr ?? "").trim(),
    stdout: (result.stdout ?? "").trim(),
  };
}

function getLegacyHooksDirectory(worktreePath) {
  return path.join(worktreePath, ".husky", "_");
}

function isStandardHuskyHelper(name, content) {
  const normalizedContent = normalizeLineEndings(content);

  if (name === ".gitignore") {
    return normalizedContent.trim() === "*";
  }

  if (name === "h") {
    return (
      normalizedContent.includes('export PATH="node_modules/.bin:$PATH"') &&
      normalizedContent.includes("husky - $n script failed")
    );
  }

  if (name === "husky.sh") {
    return (
      normalizedContent.includes("husky - DEPRECATED") &&
      normalizedContent.includes("They WILL FAIL in v10.0.0")
    );
  }

  return (
    huskyWrapperNames.has(name) &&
    normalizedContent.trim() === huskyWrapperContent.trim()
  );
}

function getLegacyEntries(worktreePath) {
  const legacyHooksDirectory = getLegacyHooksDirectory(worktreePath);

  if (!existsSync(legacyHooksDirectory)) {
    return [];
  }

  return readdirSync(legacyHooksDirectory, { withFileTypes: true }).map(
    (entry) => ({
      content: entry.isFile()
        ? readFileSync(path.join(legacyHooksDirectory, entry.name), "utf8")
        : undefined,
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    }),
  );
}

function parseWorktreeList(porcelainOutput) {
  return porcelainOutput
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

export function getNormalizedHooksPath(commonGitDir) {
  return path.resolve(commonGitDir, "hooks").replace(/\\/g, "/");
}

export function isLefthookGeneratedHook(content, hookName) {
  const normalizedContent = normalizeLineEndings(content);

  return (
    normalizedContent.includes("Can't find lefthook in PATH") &&
    normalizedContent.includes(`call_lefthook run "${hookName}"`)
  );
}

export function planLegacyHookCleanup(entries) {
  if (entries.length === 0) {
    return {
      filesToDelete: [],
      removeLegacyDirectory: false,
    };
  }

  const filesToDelete = [];

  for (const entry of entries) {
    if (entry.type !== "file" || typeof entry.content !== "string") {
      throw new Error(
        `Legacy .husky/_ contains non-generated entry: ${entry.name}`,
      );
    }

    const isGeneratedLefthookHook =
      (entry.name === "pre-commit" || entry.name === "pre-push") &&
      isLefthookGeneratedHook(entry.content, entry.name);

    if (
      isGeneratedLefthookHook ||
      isStandardHuskyHelper(entry.name, entry.content)
    ) {
      filesToDelete.push(entry.name);
      continue;
    }

    throw new Error(
      `Legacy .husky/_ contains non-generated file: ${entry.name}`,
    );
  }

  return {
    filesToDelete,
    removeLegacyDirectory: true,
  };
}

function collectCleanupPlans(worktreePaths) {
  return worktreePaths
    .map((worktreePath) => {
      const entries = getLegacyEntries(worktreePath);

      return entries.length === 0
        ? null
        : {
            cleanupPlan: planLegacyHookCleanup(entries),
            legacyHooksDirectory: getLegacyHooksDirectory(worktreePath),
            worktreePath,
          };
    })
    .filter(Boolean);
}

function cleanupLegacyHooks(cleanupPlans) {
  for (const cleanupPlan of cleanupPlans) {
    for (const fileName of cleanupPlan.cleanupPlan.filesToDelete) {
      rmSync(path.join(cleanupPlan.legacyHooksDirectory, fileName), {
        force: true,
      });
    }

    if (
      cleanupPlan.cleanupPlan.removeLegacyDirectory &&
      existsSync(cleanupPlan.legacyHooksDirectory) &&
      readdirSync(cleanupPlan.legacyHooksDirectory).length === 0
    ) {
      rmdirSync(cleanupPlan.legacyHooksDirectory);
    }

    const huskyDirectory = path.dirname(cleanupPlan.legacyHooksDirectory);

    if (
      existsSync(huskyDirectory) &&
      readdirSync(huskyDirectory).length === 0
    ) {
      rmdirSync(huskyDirectory);
    }
  }
}

function clearWorktreeOverride(worktreePath, env) {
  const currentValue = tryRun(
    "git",
    ["-C", worktreePath, "config", "--worktree", "--get-all", "core.hooksPath"],
    { cwd: worktreePath, env },
  );

  if (currentValue.ok && currentValue.stdout.length > 0) {
    run(
      "git",
      [
        "-C",
        worktreePath,
        "config",
        "--worktree",
        "--unset-all",
        "core.hooksPath",
      ],
      {
        cwd: worktreePath,
        env,
      },
    );
  }
}

export function installHooks(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const commonGitDir = run("git", ["rev-parse", "--git-common-dir"], {
    cwd,
    env,
  });
  const normalizedHooksPath = getNormalizedHooksPath(commonGitDir);
  const worktreePaths = parseWorktreeList(
    run("git", ["worktree", "list", "--porcelain"], { cwd, env }),
  );
  const cleanupPlans = collectCleanupPlans(worktreePaths);

  run(
    "git",
    [
      "config",
      "--file",
      path.join(commonGitDir, "config"),
      "core.hooksPath",
      normalizedHooksPath,
    ],
    {
      cwd,
      env,
    },
  );

  const worktreeConfigEnabled = tryRun(
    "git",
    [
      "config",
      "--file",
      path.join(commonGitDir, "config"),
      "--bool",
      "--get",
      "extensions.worktreeConfig",
    ],
    { cwd, env },
  );

  if (worktreeConfigEnabled.ok && worktreeConfigEnabled.stdout === "true") {
    for (const worktreePath of worktreePaths) {
      clearWorktreeOverride(worktreePath, env);
    }
  }

  runPnpm(["exec", "lefthook", "install", "-f"], { cwd, env });
  runPnpm(["exec", "lefthook", "check-install"], { cwd, env });

  cleanupLegacyHooks(cleanupPlans);

  return {
    cleanedWorktrees: cleanupPlans.map(
      (cleanupPlan) => cleanupPlan.worktreePath,
    ),
    normalizedHooksPath,
  };
}
