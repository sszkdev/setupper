import { expect, test } from "bun:test";
import { shellInit } from "./shell-init.ts";

test("zsh snippet installs a command_not_found_handler that delegates to setupper", () => {
  const snippet = shellInit("zsh");
  expect(snippet).not.toBeNull();
  expect(snippet).toContain("command_not_found_handler()");
  expect(snippet).toContain("command setupper --has");
  expect(snippet).toContain('command setupper "$@"');
});

test("bash snippet installs a command_not_found_handle that delegates to setupper", () => {
  const snippet = shellInit("bash");
  expect(snippet).not.toBeNull();
  expect(snippet).toContain("command_not_found_handle()");
  expect(snippet).toContain("command setupper --has");
});

test("both snippets guard against recursion when setupper is missing", () => {
  for (const shell of ["zsh", "bash"]) {
    expect(shellInit(shell)).toContain('[[ "$1" == setupper ]] && return 127');
  }
});

test("unsupported shells return null", () => {
  expect(shellInit("fish")).toBeNull();
  expect(shellInit("")).toBeNull();
});
