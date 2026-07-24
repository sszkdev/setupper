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
