/** Shells that `setupper shell-init` can emit integration for. */
export const SUPPORTED_SHELLS = ["zsh", "bash"] as const;
export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

const ZSH_INIT = `command_not_found_handler() {
  [[ "$1" == setupper ]] && return 127   # avoid recursion if setupper is missing
  if command setupper --has "$1" 2>/dev/null; then
    command setupper "$@"
    return $?
  fi
  print -u2 "zsh: command not found: $1"
  return 127
}`;

const BASH_INIT = `command_not_found_handle() {
  [[ "$1" == setupper ]] && return 127   # avoid recursion if setupper is missing
  if command setupper --has "$1" 2>/dev/null; then
    command setupper "$@"
    return $?
  fi
  echo "bash: $1: command not found" >&2
  return 127
}`;

/**
 * Return the shell integration snippet for `shell`, or `null` if the shell is
 * unsupported. The snippet installs a command-not-found hook that routes bare
 * command names to `setupper`, so a workspace's commands can be run without the
 * `setupper` prefix.
 */
export function shellInit(shell: string): string | null {
  switch (shell) {
    case "zsh":
      return ZSH_INIT;
    case "bash":
      return BASH_INIT;
    default:
      return null;
  }
}
