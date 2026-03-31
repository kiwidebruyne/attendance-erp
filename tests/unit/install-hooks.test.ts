import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  getNormalizedHooksPath,
  installHooks,
  isLefthookGeneratedHook,
  planLegacyHookCleanup,
} from "@/scripts/install-hooks-lib.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const lefthookCliPath = path.join(
  repoRoot,
  "node_modules",
  "lefthook",
  "bin",
  "index.js",
);

const lefthookPreCommit = `#!/bin/sh

if [ "$LEFTHOOK_VERBOSE" = "1" -o "$LEFTHOOK_VERBOSE" = "true" ]; then
  set -x
fi

echo "Can't find lefthook in PATH"
call_lefthook run "pre-commit" "$@"`;

const lefthookPrePush = `#!/bin/sh

if [ "$LEFTHOOK_VERBOSE" = "1" -o "$LEFTHOOK_VERBOSE" = "true" ]; then
  set -x
fi

echo "Can't find lefthook in PATH"
call_lefthook run "pre-push" "$@"`;

const huskyForwarder = `#!/usr/bin/env sh
. "$(dirname "$0")/h"
`;

const huskyHelper = `#!/usr/bin/env sh
[ "$HUSKY" = "2" ] && set -x
export PATH="node_modules/.bin:$PATH"
echo "husky - $n script failed (code $c)"
`;

const huskyDeprecatedShim = `echo "husky - DEPRECATED

Please remove the following two lines from $0:

#!/usr/bin/env sh
. \\"$(dirname -- \\"$0\\")/_/husky.sh\\"

They WILL FAIL in v10.0.0
"`;

const tempPaths: string[] = [];

afterEach(() => {
  while (tempPaths.length > 0) {
    const tempPath = tempPaths.pop();

    if (tempPath) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  }
});

function execOk(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  }).trim();
}

function execPnpmOk(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  if (process.platform === "win32") {
    return execOk("cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], options);
  }

  return execOk("pnpm", args, options);
}

function writeFakePnpm(binDir: string): void {
  mkdirSync(binDir, { recursive: true });

  const fakePnpmPath = path.join(binDir, "fake-pnpm.mjs");
  writeFileSync(
    fakePnpmPath,
    `import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

if (args[0] !== "exec" || args[1] !== "lefthook") {
  console.error("Unsupported fake pnpm command:", args.join(" "));
  process.exit(1);
}

const result = spawnSync(process.execPath, [${JSON.stringify(lefthookCliPath)}, ...args.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
`,
  );

  writeFileSync(
    path.join(binDir, "pnpm.cmd"),
    `@echo off\r\n"${process.execPath}" "${fakePnpmPath}" %*\r\n`,
  );
  writeFileSync(
    path.join(binDir, "pnpm"),
    `#!/bin/sh\n"${process.execPath}" "${fakePnpmPath}" "$@"\n`,
  );
}

function createTempRepoFixture() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "attendance-erp-hooks-"));
  tempPaths.push(tempRoot);

  const mainRepoPath = path.join(tempRoot, "repo");
  const linkedWorktreePath = path.join(tempRoot, "linked");
  const binPath = path.join(tempRoot, "bin");

  execOk("git", ["init", mainRepoPath]);
  execOk("git", ["-C", mainRepoPath, "config", "user.name", "Codex Test"]);
  execOk("git", [
    "-C",
    mainRepoPath,
    "config",
    "user.email",
    "codex@example.com",
  ]);

  writeFileSync(path.join(mainRepoPath, "README.md"), "# temp repo\n");
  writeFileSync(
    path.join(mainRepoPath, "lefthook.yml"),
    `pre-commit:
  jobs:
    - run: echo ok
`,
  );

  execOk("git", ["-C", mainRepoPath, "add", "README.md", "lefthook.yml"]);
  execOk("git", ["-C", mainRepoPath, "commit", "-m", "init"]);
  execOk("git", [
    "-C",
    mainRepoPath,
    "config",
    "extensions.worktreeConfig",
    "true",
  ]);
  execOk("git", [
    "-C",
    mainRepoPath,
    "worktree",
    "add",
    linkedWorktreePath,
    "-d",
    "HEAD",
  ]);

  writeFakePnpm(binPath);

  const env = {
    ...process.env,
    PATH: `${binPath}${path.delimiter}${process.env.PATH ?? ""}`,
  };

  return {
    commonGitDir: execOk("git", [
      "-C",
      linkedWorktreePath,
      "rev-parse",
      "--git-common-dir",
    ]),
    env,
    linkedWorktreePath,
    mainRepoPath,
  };
}

describe("install-hooks", () => {
  it("normalizes the repository common hooks directory path", () => {
    expect(getNormalizedHooksPath("C:\\repo\\.git")).toBe("C:/repo/.git/hooks");
  });

  it("recognizes Lefthook-generated wrapper files for the matching hook", () => {
    expect(isLefthookGeneratedHook(lefthookPreCommit, "pre-commit")).toBe(true);
    expect(isLefthookGeneratedHook(lefthookPrePush, "pre-push")).toBe(true);
    expect(isLefthookGeneratedHook(huskyForwarder, "pre-commit")).toBe(false);
  });

  it("plans cleanup for known generated Husky and Lefthook legacy files", () => {
    expect(
      planLegacyHookCleanup([
        { content: "*", name: ".gitignore", type: "file" },
        { content: huskyForwarder, name: "applypatch-msg", type: "file" },
        { content: huskyHelper, name: "h", type: "file" },
        { content: huskyDeprecatedShim, name: "husky.sh", type: "file" },
        { content: huskyForwarder, name: "pre-commit", type: "file" },
        { content: lefthookPrePush, name: "pre-push", type: "file" },
      ]),
    ).toEqual({
      filesToDelete: [
        ".gitignore",
        "applypatch-msg",
        "h",
        "husky.sh",
        "pre-commit",
        "pre-push",
      ],
      removeLegacyDirectory: true,
    });
  });

  it("fails cleanup planning for custom legacy hook content", () => {
    expect(() =>
      planLegacyHookCleanup([
        { content: "echo custom\n", name: "pre-commit", type: "file" },
      ]),
    ).toThrow(/non-generated/i);
  });

  it("normalizes shared hook config and removes stale .husky artifacts in linked worktrees", () => {
    const fixture = createTempRepoFixture();

    execOk("git", [
      "-C",
      fixture.mainRepoPath,
      "config",
      "core.hooksPath",
      ".husky/_",
    ]);
    execOk("git", [
      "-C",
      fixture.linkedWorktreePath,
      "config",
      "--worktree",
      "core.hooksPath",
      ".husky/_",
    ]);

    const legacyDir = path.join(fixture.linkedWorktreePath, ".husky", "_");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(path.join(legacyDir, "pre-commit"), lefthookPreCommit);
    writeFileSync(path.join(legacyDir, "pre-push"), lefthookPrePush);

    installHooks({ cwd: fixture.linkedWorktreePath, env: fixture.env });

    expect(
      execOk("git", [
        "-C",
        fixture.linkedWorktreePath,
        "config",
        "--get",
        "core.hooksPath",
      ]),
    ).toBe(getNormalizedHooksPath(fixture.commonGitDir));
    expect(() =>
      execOk("git", [
        "-C",
        fixture.linkedWorktreePath,
        "config",
        "--worktree",
        "--get",
        "core.hooksPath",
      ]),
    ).toThrow();
    expect(() =>
      execPnpmOk(["exec", "lefthook", "check-install"], {
        cwd: fixture.linkedWorktreePath,
        env: fixture.env,
      }),
    ).not.toThrow();
    expect(
      readFileSync(
        path.join(fixture.commonGitDir, "hooks", "pre-commit"),
        "utf8",
      ),
    ).toContain('call_lefthook run "pre-commit"');
    expect(
      existsSync(
        path.join(fixture.linkedWorktreePath, ".husky", "_", "pre-commit"),
      ),
    ).toBe(false);
  });

  it("fails with a clear error when a linked worktree contains custom .husky content", () => {
    const fixture = createTempRepoFixture();

    execOk("git", [
      "-C",
      fixture.mainRepoPath,
      "config",
      "core.hooksPath",
      ".husky/_",
    ]);

    const legacyDir = path.join(fixture.linkedWorktreePath, ".husky", "_");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(path.join(legacyDir, "pre-commit"), "echo custom\n");

    expect(() =>
      installHooks({ cwd: fixture.linkedWorktreePath, env: fixture.env }),
    ).toThrow(/non-generated/i);
    expect(
      execOk("git", [
        "-C",
        fixture.linkedWorktreePath,
        "config",
        "--get",
        "core.hooksPath",
      ]),
    ).toBe(".husky/_");
  });
});
