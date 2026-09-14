import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const INDEX = join(import.meta.dir, "index.ts");

let workspace: string;
let empty: string;

beforeAll(async () => {
  workspace = mkdtempSync(join(tmpdir(), "setupper-ws-"));
  empty = mkdtempSync(join(tmpdir(), "setupper-empty-"));
  await Bun.write(
    join(workspace, "setupper.yaml"),
    [
      "version: 1",
      "commands:",
      "  web:",
      "    run:",
      "      - echo hi",
      "  greet:",
      "    args:",
      "      - name: who",
      "      - name: greeting",
      "        default: hello",
      '    run: echo "$SETUPPER_ARG_GREETING, $SETUPPER_ARG_WHO"',
      "  pass:",
      "    shell: bash",
      "    args:",
      "      - name: first",
      "      - name: rest",
      "        rest: true",
      '    run: printf "[%s]" "$@"',
      "",
    ].join("\n"),
  );
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
});

async function run(args: string[], cwd: string) {
  const proc = Bun.spawn(["bun", INDEX, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

test("--has exits 0 and prints nothing for a defined command", async () => {
  const { exitCode, stdout } = await run(["--has", "web"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toBe("");
});

test("--has exits 1 for an undefined command", async () => {
  const { exitCode } = await run(["--has", "nope"], workspace);
  expect(exitCode).toBe(1);
});

test("--has exits 1 when no config is found", async () => {
  const { exitCode } = await run(["--has", "web"], empty);
  expect(exitCode).toBe(1);
});

test("--has exits 1 when no command name is given", async () => {
  const { exitCode } = await run(["--has"], workspace);
  expect(exitCode).toBe(1);
});

test("<command> -h prints help without running the command", async () => {
  const { exitCode, stdout } = await run(["web", "-h"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("steps:");
});

test("<command> rejects an unknown flag instead of running", async () => {
  const { exitCode, stdout, stderr } = await run(
    ["web", "--dry-run"],
    workspace,
  );
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown option: --dry-run");
  expect(stdout).not.toContain("hi");
});

test("<command> rejects an unexpected positional argument", async () => {
  const { exitCode, stdout, stderr } = await run(["web", "extra"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unexpected argument: extra");
  expect(stdout).not.toContain("hi");
});

test("<command> -h rejects trailing arguments", async () => {
  const { exitCode, stderr } = await run(["web", "-h", "--dry-run"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown option: -h");
});

test("<command> passes declared args as SETUPPER_ARG_* env vars", async () => {
  const { exitCode, stdout } = await run(["greet", "world", "hi"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toBe("hi, world\n");
});

test("<command> fills an omitted optional arg from its default", async () => {
  const { exitCode, stdout } = await run(["greet", "world"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toBe("hello, world\n");
});

test("<command> does not re-parse an argument as shell", async () => {
  const { exitCode, stdout } = await run(
    ["greet", "; echo INJECTED"],
    workspace,
  );
  expect(exitCode).toBe(0);
  expect(stdout).toBe("hello, ; echo INJECTED\n");
});

test("<command> reports a missing required arg with usage", async () => {
  const { exitCode, stdout, stderr } = await run(["greet"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("missing argument: who");
  expect(stderr).toContain("usage: setupper greet <who> [greeting]");
  expect(stdout).toBe("");
});

test("<command> rejects more args than declared", async () => {
  const { exitCode, stderr } = await run(["greet", "a", "b", "c"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unexpected argument: c");
});

test("<command> -- passes a dash-prefixed value such as -h", async () => {
  const { exitCode, stdout } = await run(["greet", "--", "-h"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toBe("hello, -h\n");
});

test("<command> -h shows usage and declared args", async () => {
  const { exitCode, stdout } = await run(["greet", "-h"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("usage: setupper greet <who> [greeting]");
  expect(stdout).toContain('- greeting  (default: "hello")');
});

test("<command> with shell forwards args and rest as $@", async () => {
  const { exitCode, stdout } = await run(
    ["pass", "a", "--", "--watch", "x y"],
    workspace,
  );
  expect(exitCode).toBe(0);
  expect(stdout).toBe("[a][--watch][x y]");
});

test("<command> rejects a flag before -- even with a rest arg", async () => {
  const { exitCode, stderr } = await run(["pass", "a", "--watch"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown option: --watch");
});

test("shell-init zsh prints the zsh integration", async () => {
  const { exitCode, stdout } = await run(["shell-init", "zsh"], workspace);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("command_not_found_handler()");
});

test("shell-init errors on an unsupported shell", async () => {
  const { exitCode, stderr } = await run(["shell-init", "fish"], workspace);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("Usage: setupper shell-init");
});

test("shell-init errors when no shell is given", async () => {
  const { exitCode } = await run(["shell-init"], workspace);
  expect(exitCode).toBe(1);
});
