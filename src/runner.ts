import { join } from "node:path";
import { $ } from "bun";
import type { Command, Config } from "./config.ts";
import { normalizeSteps, resolveEnv } from "./config.ts";

/**
 * Run a command's steps top to bottom via Bun's shell. Steps stop on the first
 * failing step unless it is marked `allow_failure`. Returns the exit code to use
 * for the process (0 on success, otherwise the failing step's code).
 */
export async function runCommand(
  config: Config,
  command: Command,
  workspaceRoot: string,
): Promise<number> {
  const cwd = command.dir ? join(workspaceRoot, command.dir) : workspaceRoot;
  const env = { ...process.env, ...resolveEnv(config, command) };

  for (const step of normalizeSteps(command.run)) {
    const { exitCode } = await $`${{ raw: step.run }}`
      .cwd(cwd)
      .env(env)
      .nothrow();
    if (exitCode !== 0 && !step.allow_failure) return exitCode;
  }
  return 0;
}
