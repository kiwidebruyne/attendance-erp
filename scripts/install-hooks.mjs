import { installHooks } from "./install-hooks-lib.mjs";

try {
  const result = installHooks();

  console.log(
    `[hooks-install] core.hooksPath -> ${result.normalizedHooksPath}`,
  );

  if (result.cleanedWorktrees.length > 0) {
    console.log(
      `[hooks-install] cleaned legacy .husky/_ artifacts in ${result.cleanedWorktrees.join(", ")}`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[hooks-install] ${message}`);
  process.exit(1);
}
