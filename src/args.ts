import type { Arg } from "./config.ts";

/** A command's argv resolved against its declared `args`. */
export type ParsedArgs = {
  /** `SETUPPER_ARG_<NAME>` for every non-rest argument. */
  env: Record<string, string>;
  /** Every value in declaration order (defaults filled in), rest values last. */
  positional: string[];
};

/** A command-line mistake; reported together with the command's usage line. */
export class ArgsError extends Error {}

/** Env var that carries the value of the argument named `name`. */
export function argEnvName(name: string): string {
  return `SETUPPER_ARG_${name.toUpperCase()}`;
}

/** One-line usage, e.g. `logs <service> [lines]` or `test [flags...]`. */
export function formatUsage(name: string, specs: Arg[]): string {
  const parts = specs.map((spec) => {
    if (spec.rest) return `[${spec.name}...]`;
    return spec.default === undefined ? `<${spec.name}>` : `[${spec.name}]`;
  });
  return [name, ...parts].join(" ");
}

/**
 * Resolve `argv` (everything after the command name) against `specs`. Tokens
 * starting with `-` are rejected as unknown options until a `--` separator, so
 * a mistyped flag never silently reaches a step. Throws `ArgsError` on a
 * missing, extra, or flag-like argument.
 */
export function parseArgs(specs: Arg[], argv: string[]): ParsedArgs {
  const values: string[] = [];
  let optionsEnded = false;
  for (const token of argv) {
    if (!optionsEnded && token === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && token.startsWith("-") && token !== "-") {
      throw new ArgsError(`unknown option: ${token}`);
    } else {
      values.push(token);
    }
  }

  const last = specs.at(-1);
  const rest = last?.rest ? last : undefined;
  const fixed = rest ? specs.slice(0, -1) : specs;
  if (!rest && values.length > fixed.length) {
    throw new ArgsError(`unexpected argument: ${values[fixed.length]}`);
  }

  const env: Record<string, string> = {};
  const positional: string[] = [];
  fixed.forEach((spec, index) => {
    const value = values[index] ?? spec.default;
    if (value === undefined) {
      throw new ArgsError(`missing argument: ${spec.name}`);
    }
    env[argEnvName(spec.name)] = value;
    positional.push(value);
  });
  if (rest) positional.push(...values.slice(fixed.length));
  return { env, positional };
}
