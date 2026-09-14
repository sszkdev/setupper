import { dirname, join, resolve } from "node:path";
import * as v from "valibot";
import { parse as parseYaml } from "yaml";

/** Config filenames tried in each directory, `.yaml` before `.yml`. */
export const CONFIG_FILENAMES = ["setupper.yaml", "setupper.yml"] as const;

const StepSchema = v.union([
  v.string(),
  v.object({
    run: v.string(),
    allow_failure: v.optional(v.boolean(), false),
    shell: v.optional(v.string()),
  }),
]);

const ArgSchema = v.object({
  name: v.pipe(
    v.string(),
    v.regex(/^[a-z][a-z0-9_]*$/, "must match ^[a-z][a-z0-9_]*$"),
  ),
  description: v.optional(v.string()),
  default: v.optional(v.string()),
  rest: v.optional(v.boolean(), false),
});

const CommandObjectSchema = v.object({
  description: v.optional(v.string()),
  dir: v.optional(v.string()),
  env: v.optional(v.record(v.string(), v.string())),
  shell: v.optional(v.string()),
  args: v.optional(v.array(ArgSchema)),
  run: v.union([v.string(), v.array(StepSchema)]),
});

const CommandSchema = v.pipe(
  CommandObjectSchema,
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    for (const problem of argsProblems(dataset.value)) {
      addIssue({ message: `args: ${problem}` });
    }
  }),
);

const ConfigSchema = v.object({
  version: v.literal(1),
  env: v.optional(v.record(v.string(), v.string())),
  commands: v.record(v.string(), CommandSchema),
});

export type Config = v.InferOutput<typeof ConfigSchema>;
export type Command = v.InferOutput<typeof CommandSchema>;

export type Arg = v.InferOutput<typeof ArgSchema>;

/** A single shell step, always in normalized (map) form. */
export type Step = { run: string; allow_failure: boolean; shell?: string };

/** Rules across a command's `args` that per-field schemas cannot express. */
function argsProblems(command: v.InferOutput<typeof CommandObjectSchema>) {
  const specs = command.args ?? [];
  const problems: string[] = [];
  const seen = new Set<string>();
  let optionalSeen = false;
  specs.forEach((spec, index) => {
    if (seen.has(spec.name)) problems.push(`duplicate name "${spec.name}"`);
    seen.add(spec.name);
    if (spec.rest) {
      if (index !== specs.length - 1) {
        problems.push(`rest "${spec.name}" must be the last argument`);
      }
      if (spec.default !== undefined) {
        problems.push(`rest "${spec.name}" cannot have a default`);
      }
      // Bun's built-in shell has no "$@", so every step needs a real shell.
      const steps = normalizeSteps(command.run);
      if (steps.some((step) => !(step.shell ?? command.shell))) {
        problems.push(
          `rest "${spec.name}" requires \`shell\` on the command or every step`,
        );
      }
    } else if (spec.default !== undefined) {
      optionalSeen = true;
    } else if (optionalSeen) {
      problems.push(
        `required "${spec.name}" cannot follow an optional argument`,
      );
    }
  });
  return problems;
}

/** Parse and validate the YAML text of a `setupper.yaml`. Throws on error. */
export function parseConfig(text: string): Config {
  const result = v.safeParse(ConfigSchema, parseYaml(text));
  if (result.success) return result.output;
  const details = result.issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `  - ${path}: ${issue.message}` : `  - ${issue.message}`;
    })
    .join("\n");
  throw new Error(`invalid config:\n${details}`);
}

/** Flatten a command's `run` (string or list) into a uniform list of steps. */
export function normalizeSteps(run: Command["run"]): Step[] {
  const list = typeof run === "string" ? [run] : run;
  return list.map((step) =>
    typeof step === "string" ? { run: step, allow_failure: false } : step,
  );
}

/** Replace `${VAR}` occurrences using `source` (defaults to the environment). */
export function expandEnv(
  value: string,
  source: Record<string, string | undefined> = process.env,
): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name) => source[name] ?? "");
}

/** Resolve a command's env: root env, overridden by command env, all expanded. */
export function resolveEnv(
  config: Config,
  command: Command,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.env ?? {})) {
    result[key] = expandEnv(value);
  }
  for (const [key, value] of Object.entries(command.env ?? {})) {
    result[key] = expandEnv(value);
  }
  return result;
}

/**
 * Walk up from `startDir` to find the nearest config file. Within a directory,
 * `setupper.yaml` takes precedence over `setupper.yml`.
 */
export async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (await Bun.file(candidate).exists()) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type LoadedConfig = {
  config: Config;
  /** Directory holding the config file; the workspace root. */
  workspaceRoot: string;
  path: string;
};

/** Find, read, and validate the nearest config starting from `startDir`. */
export async function loadConfig(startDir: string): Promise<LoadedConfig> {
  const path = await findConfigFile(startDir);
  if (!path) {
    throw new Error(
      `No ${CONFIG_FILENAMES.join(" or ")} found in ${startDir} or any parent directory.`,
    );
  }
  let config: Config;
  try {
    config = parseConfig(await Bun.file(path).text());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${path}: ${message}`);
  }
  return { config, workspaceRoot: dirname(path), path };
}
