// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these tests use literal ${VAR} placeholders on purpose to exercise env expansion.
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command, Config } from "./config.ts";
import {
  expandEnv,
  findConfigFile,
  normalizeSteps,
  parseConfig,
  resolveEnv,
} from "./config.ts";

/** Fetch a command by name or fail the test if it is missing. */
function command(config: Config, name: string): Command {
  const found = config.commands[name];
  if (!found) throw new Error(`command "${name}" not found`);
  return found;
}

test("parseConfig accepts a valid config", () => {
  const config = parseConfig(
    "version: 1\ncommands:\n  web:\n    description: start web\n    dir: web-app\n    run:\n      - npm install\n      - npm run dev\n",
  );
  expect(config.version).toBe(1);
  expect(command(config, "web").dir).toBe("web-app");
});

test("parseConfig rejects a wrong version", () => {
  expect(() => parseConfig("version: 2\ncommands: {}\n")).toThrow();
});

test("parseConfig rejects a missing run", () => {
  expect(() =>
    parseConfig("version: 1\ncommands:\n  bad:\n    dir: x\n"),
  ).toThrow();
});

test("parseConfig error names the offending path", () => {
  // `false` is a YAML boolean, so this step's `run` is not a string.
  expect(() =>
    parseConfig("version: 1\ncommands:\n  c:\n    run:\n      - false\n"),
  ).toThrow(/commands\.c\.run/);
});

test("normalizeSteps flattens a string run", () => {
  expect(normalizeSteps("echo hi")).toEqual([
    { run: "echo hi", allow_failure: false },
  ]);
});

test("normalizeSteps keeps map-form steps and fills defaults", () => {
  const config = parseConfig(
    "version: 1\ncommands:\n  c:\n    run:\n      - npm install\n      - run: cp -n a b\n        allow_failure: true\n",
  );
  expect(normalizeSteps(command(config, "c").run)).toEqual([
    { run: "npm install", allow_failure: false },
    { run: "cp -n a b", allow_failure: true },
  ]);
});

test("parseConfig accepts a command-level shell", () => {
  const config = parseConfig(
    "version: 1\ncommands:\n  c:\n    shell: zsh\n    run: |\n      for p in 1 2 3; do echo $p; done\n",
  );
  expect(command(config, "c").shell).toBe("zsh");
});

test("normalizeSteps carries a step-level shell override", () => {
  const config = parseConfig(
    "version: 1\ncommands:\n  c:\n    run:\n      - echo plain\n      - run: for p in 1 2; do echo $p; done\n        shell: bash\n",
  );
  expect(normalizeSteps(command(config, "c").run)).toEqual([
    { run: "echo plain", allow_failure: false },
    {
      run: "for p in 1 2; do echo $p; done",
      allow_failure: false,
      shell: "bash",
    },
  ]);
});

test("expandEnv replaces ${VAR} from the given source", () => {
  expect(expandEnv("${HOME}/tools", { HOME: "/home/x" })).toBe("/home/x/tools");
  expect(expandEnv("${MISSING}!", {})).toBe("!");
});

test("resolveEnv merges root and command env, command wins, all expanded", () => {
  process.env.SETUPPER_TEST_HOME = "/home/test";
  const config = parseConfig(
    "version: 1\nenv:\n  A: ${SETUPPER_TEST_HOME}/x\n  B: root\ncommands:\n  c:\n    env:\n      B: cmd\n    run: echo hi\n",
  );
  const env = resolveEnv(config, command(config, "c"));
  expect(env.A).toBe("/home/test/x");
  expect(env.B).toBe("cmd");
});

test("findConfigFile walks up to the nearest config", async () => {
  const root = await mkdtemp(join(tmpdir(), "setupper-"));
  try {
    await Bun.write(join(root, "setupper.yaml"), "version: 1\ncommands: {}\n");
    const nested = join(root, "a", "b");
    await mkdir(nested, { recursive: true });
    expect(await findConfigFile(nested)).toBe(join(root, "setupper.yaml"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("findConfigFile returns null when nothing is found", async () => {
  const root = await mkdtemp(join(tmpdir(), "setupper-empty-"));
  try {
    expect(await findConfigFile(root)).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("findConfigFile accepts a .yml config too", async () => {
  const root = await mkdtemp(join(tmpdir(), "setupper-yml-"));
  try {
    await Bun.write(join(root, "setupper.yml"), "version: 1\ncommands: {}\n");
    expect(await findConfigFile(root)).toBe(join(root, "setupper.yml"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("findConfigFile prefers .yaml over .yml in the same directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "setupper-both-"));
  try {
    await Bun.write(join(root, "setupper.yaml"), "version: 1\ncommands: {}\n");
    await Bun.write(join(root, "setupper.yml"), "version: 1\ncommands: {}\n");
    expect(await findConfigFile(root)).toBe(join(root, "setupper.yaml"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
