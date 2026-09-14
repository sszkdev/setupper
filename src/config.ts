import { dirname, join, resolve } from "node:path";
import * as v from "valibot";
import { parse as parseYaml } from "yaml";

/** Config filenames tried in each directory, `.yaml` before `.yml`. */
export const CONFIG_FILENAMES = ["setupper.yaml", "setupper.yml"] as const;

const StepMapSchema = v.object({
  run: v.string(),
  allow_failure: v.optional(v.boolean(), false),
  shell: v.optional(v.string()),
});

const StepSchema = v.union([v.string(), StepMapSchema]);

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

type Issue = v.BaseIssue<unknown>;
type LocatedIssue = { path: v.IssuePathItem[]; issue: Issue };

/**
 * Resolve union issues down to the option that actually matched the input's
 * type. A union reports one issue per option; options whose issues carry a
 * path got past the type check, so the real cause is nested inside them.
 * `v.object` also accepts arrays, so an option that only got there by
 * treating an array as an object does not count as matching.
 * Nested issue paths are relative, so they are joined onto the parent path.
 */
function locateIssues(issue: Issue, prefix: v.IssuePathItem[]): LocatedIssue[] {
  const path = [...prefix, ...(issue.path ?? [])];
  const deeper =
    issue.type === "union"
      ? (issue.issues ?? []).filter(
          (sub) =>
            sub.path?.length &&
            !(
              sub.path[0]?.type === "object" && Array.isArray(sub.path[0].input)
            ),
        )
      : [];
  if (deeper.length === 0) return [{ path, issue }];
  return deeper.flatMap((sub) => locateIssues(sub, path));
}

function formatIssue({ path, issue }: LocatedIssue): string {
  const last = path.at(-1);
  const keys = last?.type === "object" ? Object.keys(last.input as object) : [];
  // A list step that is a map without `run` is reported at the step itself.
  if (
    issue.type === "object" &&
    last?.key === "run" &&
    keys.length > 0 &&
    path.at(-2)?.type === "array"
  ) {
    const message = `step is a map without "run" (keys: ${keys.map((key) => JSON.stringify(key)).join(", ")}).`;
    // With a known step key, `run` was just forgotten. Otherwise it is almost
    // always a plain string step containing ": ", which YAML parses as a map.
    const forgotRun = keys.some((key) => key in StepMapSchema.entries);
    return formatLine(
      path.slice(0, -1),
      forgotRun
        ? message
        : `${message} A step containing ": " is parsed by YAML as a map; quote the whole step.`,
    );
  }
  return formatLine(path, issue.message);
}

function formatLine(path: v.IssuePathItem[], message: string): string {
  const dotPath = path.map((item) => String(item.key)).join(".");
  return dotPath ? `  - ${dotPath}: ${message}` : `  - ${message}`;
}

/** Parse and validate the YAML text of a `setupper.yaml`. Throws on error. */
export function parseConfig(text: string): Config {
  const result = v.safeParse(ConfigSchema, parseYaml(text));
  if (result.success) return result.output;
  const details = result.issues
    .flatMap((issue) => locateIssues(issue, []))
    .map(formatIssue)
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
