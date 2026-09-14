import { expect, test } from "bun:test";
import { ArgsError, argEnvName, formatUsage, parseArgs } from "./args.ts";
import type { Arg } from "./config.ts";

/** Build an arg spec with the schema's defaults filled in. */
function arg(name: string, extra: Partial<Arg> = {}): Arg {
  return { name, rest: false, ...extra };
}

test("parseArgs accepts no arguments when none are declared", () => {
  expect(parseArgs([], [])).toEqual({ env: {}, positional: [] });
});

test("parseArgs rejects an argument that is not declared", () => {
  expect(() => parseArgs([], ["extra"])).toThrow(
    new ArgsError("unexpected argument: extra"),
  );
});

test("parseArgs rejects an unknown flag", () => {
  expect(() => parseArgs([arg("who")], ["--dry-run"])).toThrow(
    new ArgsError("unknown option: --dry-run"),
  );
});

test("parseArgs maps values to SETUPPER_ARG_* and positional order", () => {
  expect(parseArgs([arg("who"), arg("greeting")], ["world", "hi"])).toEqual({
    env: { SETUPPER_ARG_WHO: "world", SETUPPER_ARG_GREETING: "hi" },
    positional: ["world", "hi"],
  });
});

test("parseArgs fills an omitted argument from its default", () => {
  const specs = [arg("who"), arg("greeting", { default: "hello" })];
  expect(parseArgs(specs, ["world"])).toEqual({
    env: { SETUPPER_ARG_WHO: "world", SETUPPER_ARG_GREETING: "hello" },
    positional: ["world", "hello"],
  });
});

test("parseArgs reports a missing required argument", () => {
  expect(() => parseArgs([arg("who")], [])).toThrow(
    new ArgsError("missing argument: who"),
  );
});

test("parseArgs reports the first extra argument", () => {
  expect(() => parseArgs([arg("who")], ["a", "b"])).toThrow(
    new ArgsError("unexpected argument: b"),
  );
});

test("parseArgs treats everything after -- as values", () => {
  expect(parseArgs([arg("who")], ["--", "-h"]).positional).toEqual(["-h"]);
});

test("parseArgs treats a lone - as a value", () => {
  expect(parseArgs([arg("file")], ["-"]).positional).toEqual(["-"]);
});

test("parseArgs collects remaining values into a rest argument", () => {
  const specs = [arg("first"), arg("flags", { rest: true })];
  expect(parseArgs(specs, ["a", "--", "--watch", "x y"])).toEqual({
    env: { SETUPPER_ARG_FIRST: "a" },
    positional: ["a", "--watch", "x y"],
  });
});

test("parseArgs allows an empty rest argument", () => {
  expect(parseArgs([arg("flags", { rest: true })], [])).toEqual({
    env: {},
    positional: [],
  });
});

test("argEnvName uppercases the name", () => {
  expect(argEnvName("dry_run")).toBe("SETUPPER_ARG_DRY_RUN");
});

test("formatUsage marks required, optional, and rest arguments", () => {
  const specs = [
    arg("service"),
    arg("lines", { default: "100" }),
    arg("flags", { rest: true }),
  ];
  expect(formatUsage("logs", specs)).toBe("logs <service> [lines] [flags...]");
});
