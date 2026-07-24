import { join } from "node:path";
import { $ } from "bun";
import type { Command, Config, Step } from "./config.ts";
import { normalizeSteps, resolveEnv } from "./config.ts";

/**
 * Run a command's steps top to bottom. Steps stop on the first failing step
 * unless it is marked `allow_failure`. Returns the exit code to use for the
 * process (0 on success, otherwise the failing step's code).
 *
 * Steps run via Bun's built-in shell by default; when `shell` is set (on the
 * command or an individual step) the step is run as `<shell> -c <step>`.
 */
export async function runCommand(
  config: Config,
  command: Command,
  workspaceRoot: string,
): Promise<number> {
  const cwd = command.dir ? join(workspaceRoot, command.dir) : workspaceRoot;
  const env = { ...process.env, ...resolveEnv(config, command) };

  for (const step of normalizeSteps(command.run)) {
    const shell = step.shell ?? command.shell;
    const exitCode = shell
      ? await runInShell(shell, step, cwd, env)
      : await runInBunShell(step, cwd, env);
    if (exitCode !== 0 && !step.allow_failure) return exitCode;
  }
  return 0;
}

/** Run a step through Bun's built-in shell (the default). */
async function runInBunShell(
  step: Step,
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<number> {
  const { exitCode } = await $`${{ raw: step.run }}`
    .cwd(cwd)
    .env(env)
    .nothrow();
  return exitCode;
}

/** Run a step through an external shell: `<shell> -c <step>`. */
async function runInShell(
  shell: string,
  step: Step,
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<number> {
  const proc = Bun.spawn([shell, "-c", step.run], {
    cwd,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}
