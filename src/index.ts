import pkg from "../package.json" with { type: "json" };
import type { Command, Config } from "./config.ts";
import { loadConfig, normalizeSteps } from "./config.ts";
import { runCommand } from "./runner.ts";
import { SUPPORTED_SHELLS, shellInit } from "./shell-init.ts";

function printList(config: Config): void {
  const names = Object.keys(config.commands);
  if (names.length === 0) {
    console.log("No commands defined in setupper.yaml.");
    return;
  }
  const width = Math.max(...names.map((name) => name.length));
  console.log("Available commands:\n");
  for (const name of names) {
    const description = config.commands[name]?.description ?? "";
    console.log(`  ${name.padEnd(width)}  ${description}`);
  }
  console.log("\nRun 'setupper <command>' to execute one.");
}

function printHelp(name: string, command: Command): void {
  console.log(name);
  if (command.description) console.log(`  ${command.description}`);
  console.log(`  dir: ${command.dir ?? "."}`);
  if (command.shell) console.log(`  shell: ${command.shell}`);
  console.log("  steps:");
  for (const step of normalizeSteps(command.run)) {
    const marks = [
      step.shell ? `shell: ${step.shell}` : null,
      step.allow_failure ? "allow_failure" : null,
    ].filter((mark): mark is string => mark !== null);
    const suffix = marks.length > 0 ? `  (${marks.join(", ")})` : "";
    console.log(`    - ${step.run}${suffix}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const [name, flag] = argv;

  if (name === "--version" || name === "-v") {
    console.log(pkg.version);
    return 0;
  }

  if (name === "shell-init") {
    const snippet = flag ? shellInit(flag) : null;
    if (snippet === null) {
      console.error(
        `Usage: setupper shell-init <${SUPPORTED_SHELLS.join("|")}>`,
      );
      return 1;
    }
    console.log(snippet);
    return 0;
  }

  // Silent membership check used by the shell-init command-not-found hook.
  // Prints nothing; exit 0 if the nearest config defines the command, else 1.
  if (name === "--has") {
    if (!flag) return 1;
    try {
      const { config } = await loadConfig(process.cwd());
      return config.commands[flag] ? 0 : 1;
    } catch {
      return 1;
    }
  }

  const { config, workspaceRoot } = await loadConfig(process.cwd());

  if (!name || name === "list") {
    printList(config);
    return 0;
  }

  const command = config.commands[name];
  if (!command) {
    console.error(`Unknown command: ${name}\n`);
    printList(config);
    return 1;
  }

  if (flag === "-h" || flag === "--help") {
    printHelp(name, command);
    return 0;
  }

  return runCommand(config, command, workspaceRoot);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
