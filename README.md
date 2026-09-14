# setupper

> Define and run your own setup & dev shortcuts from a single YAML in each
> workspace — instead of piling them all into one `~/.zshrc`.

**Languages:** English (this file) · [日本語](docs/README.ja.md)

## The problem

You shorten the commands you run all the time into shell functions and aliases:

```sh
alias <name>='<command> && <command> && …'
<name>() { cd <repo>; <command>; <command>; … }
```

They all pile up in a single `~/.zshrc`, so one machine ends up holding the
shortcuts for every workspace at once — names collide, and it is hard to tell
which command belongs to which project. **setupper** gives each workspace its own
`setupper.yaml`, so a workspace's commands live next to it instead of in your
global shell config, and `~/.zshrc` stays clean.

## Installation

Distributed as a single self‑contained binary. Build it and put it on your
`PATH`, then run `setupper` from any workspace.

```sh
bun install
bun build --compile --outfile ~/bin/setupper src/index.ts
```

### Optional: a shorter alias

`setupper` is a little long to type, so a short alias is handy. Add one to your
shell config (`~/.zshrc`, `~/.bashrc`, …):

```sh
alias sup='setupper'   # recommended — short, memorable, part of "setUPPer"
```

Other candidates, in case `sup` is already taken on your machine:

| Alias | Why |
| --- | --- |
| `sup` | **Recommended.** 3 chars, echoes "set**UP**per", easy to remember. |
| `stp` | Consonants of "setup". |
| `spr` | Initials of "setupper". |
| `se` | Shortest (2 chars), but higher typo/collision risk. |

Pick one that does not collide with a command you already use (check with
`command -v <name>`).

### Optional: run commands without the `setupper` prefix

Even with a short alias you still type a prefix (`sup web`). To run a command by
its bare name (`web`), add setupper's shell integration:

```sh
# ~/.zshrc
eval "$(setupper shell-init zsh)"

# ~/.bashrc
eval "$(setupper shell-init bash)"
```

This installs a `command_not_found_handler` (zsh) / `command_not_found_handle`
(bash): when you type a name that is not already a real command, setupper checks
the nearest `setupper.yaml` and, if that name is defined there, runs it. Because
setupper resolves the config by walking up from the current directory, the same
bare name maps to whichever workspace you are in — no per-workspace shell setup
required.

Caveats:

- It only fires for names that are **not** already real commands. If a program
  named `web` is on your `PATH`, that program wins. Pick command names that do
  not collide (check with `command -v <name>`).
- A genuine typo of an undefined name falls through to the normal
  "command not found" message, so nothing unexpected runs.

## Usage

```sh
setupper                    # list available commands (same as `setupper list`)
setupper <command> [args]   # run a command (args only if it declares `args`)
setupper <command> -h       # show a command's description, usage, and steps
setupper --version
```

`setupper` finds the nearest config file (`setupper.yaml`, or `setupper.yml`) by
walking up from the current directory, so you can run it from any repository
inside the workspace.

## Security

`setupper` executes the shell steps in `setupper.yaml` verbatim, with your
user's full permissions — it is a command runner, not a sandbox. A
`setupper.yaml` can run *any* command your account can.

**Do not run `setupper` against a `setupper.yaml` you do not trust.** Treat one
that came from elsewhere — a cloned repository, a shared workspace, a downloaded
example — like a shell script from that source: read it before running it.
Because `setupper` walks up the directory tree to find the nearest
`setupper.yaml`, also confirm the file it picks up is the one you expect, not one
planted higher up in the tree.

## Concepts

- **Workspace** — a directory that groups several repositories. It holds the
  single `setupper.yaml`.
- **Command** — a named shortcut with a description and a list of steps.
- **Step** — a shell snippet. Steps run top to bottom; if one fails, the
  remaining steps are skipped and the command stops. A step runs via Bun's
  built-in shell by default, or via an external shell when `shell` is set (see
  [Choosing the shell](#choosing-the-shell)).
- **Working directory (`dir`)** — where a command runs, relative to the workspace
  root. Usually a repository subdirectory.

## Configuration — `setupper.yaml`

Place a single file at the workspace root. It may be named `setupper.yaml` or
`setupper.yml` (`.yaml` takes precedence if both exist).

```yaml
version: 1

# Env vars exported to every command. ${VAR} expands from the environment.
env:
  SHARED_TOOLS_DIR: ${HOME}/tools

commands:
  # Simplest form: a name + a list of shell steps.
  web:
    description: Install deps, seed .env.local, start the web app
    dir: web-app                   # relative to the workspace root
    run:
      - npm install
      - cp -n .env.sample .env.local      # -n keeps an existing .env.local
      - npm run dev

  # Steps stop on the first failure. Working dir and env are per command.
  api:
    description: Bootstrap and start the API dev server
    dir: api-server
    run:
      - pnpm install
      - cp -n .env.sample .env.local
      - pnpm migrate
      - pnpm dev

  # Steps are just shell, so any tool works.
  up:
    description: Install, bootstrap env files, then start the dev server
    dir: web-app
    run:
      - bun install
      - bunx lefthook install
      - cp -n .env.sample .env.local
      - echo "Run 'setupper api' in another terminal for the API"
      - bun run dev
```

### Schema

| Key | Where | YAML type | Meaning |
| --- | --- | --- | --- |
| `version` | root | number | Config schema version. `1` for now. |
| `env` | root | map | Env vars exported to every command. `${VAR}` expansion supported. |
| `commands` | root | map | Name → command definition. |
| `description` | command | string | One‑line help shown in `setupper list`. |
| `dir` | command | string | Working directory, relative to the workspace root. Default: workspace root. |
| `env` | command | map | Extra env vars, merged over the root `env`. |
| `shell` | command | string | Shell used to run this command's steps, e.g. `zsh` or `bash`. Each step runs as `<shell> -c <step>`. Default: Bun's built‑in shell. |
| `run` | command | string or list | Shell step(s). Run top to bottom; the first failing step stops the rest. |
| `run` | step | string | The shell command for a map‑form step. |
| `allow_failure` | step | boolean | If `true`, the command keeps going even when this step fails. Default `false`. |
| `shell` | step | string | Shell for this one step, overriding the command's `shell`. |
| `args` | command | list | Positional arguments the command accepts (see [Passing arguments](#passing-arguments)). Default: none — any extra argument is an error. |
| `name` | arg | string | Argument name, matching `^[a-z][a-z0-9_]*$`. Exposed to steps as `SETUPPER_ARG_<NAME>`. |
| `description` | arg | string | Shown in `setupper <command> -h`. |
| `default` | arg | string | Value used when the argument is omitted. Without it, the argument is required. |
| `rest` | arg | boolean | Collect all remaining arguments. Last argument only; requires `shell`. Default `false`. |

Writing a step as a map gives finer control:

```yaml
run:
  - pnpm install
  - run: cp -n .env.sample .env.local
    allow_failure: true            # keep going even if this step fails
```

### Choosing the shell

By default each step runs through Bun's built‑in shell. It is fast and portable
and covers the common cases (pipes, `&&`/`||`, redirects, `$(…)`, `${VAR}`), but
it is **not** a full shell: constructs like `for` loops, background jobs (`&`),
and `trap` are not supported.

Set `shell` to run a command's steps through a real shell instead. The step is
executed as `<shell> -c <step>`, so with a multi‑line `run:` block you get the
full language of that shell — loops, background jobs, `trap`, and so on. This is
handy when a command needs real control flow, or for porting an existing shell
function verbatim:

```yaml
commands:
  e2e:
    description: Start the mock server, wait for it, then run the e2e suite
    dir: app
    shell: bash                    # run the block below with bash
    run: |
      npm run mock-server &                     # background job
      server=$!
      trap 'kill "$server" 2>/dev/null' EXIT    # stop it on the way out
      for i in $(seq 1 10); do                  # wait for it to come up
        curl -sf http://localhost:3000/health && break
        sleep 1
      done
      npm run test:e2e
```

`shell` can also be set per step (on a map‑form step) to override the command's
shell for just that step.

### Passing arguments

A command accepts positional arguments only when it declares them under `args`.
Otherwise any extra argument, or an unrecognized flag such as `--dry-run`, is an
error instead of being silently ignored.

```yaml
commands:
  logs:
    description: Tail a service's logs
    args:
      - name: service
        description: service name, e.g. api or web
      - name: lines
        default: "100"
    run: docker compose logs --tail "$SETUPPER_ARG_LINES" "$SETUPPER_ARG_SERVICE"
```

`setupper logs api` tails 100 lines; `setupper logs api 20` tails 20.

- Each argument is exported as `SETUPPER_ARG_<NAME>` (the name uppercased), under
  both Bun's built‑in shell and an external `shell`. Values are passed as data
  and never re‑parsed as shell, so `setupper logs '; rm -rf ~'` is just an odd
  service name.
- An argument without `default` is required; a missing one exits 1 with the
  usage line. Required arguments must come before optional ones, and more
  arguments than declared is an error.
- Anything starting with `-` is treated as a flag and rejected. Put values that
  start with `-` after `--`: `setupper logs -- -weird-name`. `-h` / `--help` on
  its own shows help; `setupper logs -- -h` passes `-h` as an argument.
- With `shell` set, the arguments are also the positional parameters `$1`, `$2`,
  …, `"$@"`, in declaration order with defaults filled in. Under Bun's built‑in
  shell, `$1` does **not** refer to the command's arguments — use the
  `SETUPPER_ARG_*` variables.

Mark the last argument `rest: true` to collect everything that remains — for
example, to forward flags to the underlying tool. Bun's built‑in shell cannot
iterate over a list, so `rest` requires `shell` and is read through `"$@"`; it
has no `SETUPPER_ARG_*` variable.

```yaml
commands:
  test:
    description: Run the test suite, forwarding extra flags
    dir: web-app
    shell: bash
    args:
      - name: flags
        rest: true
    run: npm test -- "$@"
```

`setupper test -- --watch --coverage` runs `npm test -- --watch --coverage`.

## What setupper replaces (mapping from shell aliases)

| Shell pattern | setupper equivalent |
| --- | --- |
| `alias <name>='… && … && …'` | a `commands.<name>.run` list |
| `cd $(git rev-parse --show-toplevel)` | `dir:` (relative to the workspace) |
| <code>cp -n .env.sample .env.local &#124;&#124; true</code> | a `cp -n` step / `allow_failure: true` |
| `export SOME_VAR=…` | top‑level `env:` |
| `echo "hint…"` | an `echo` step |
| a `<name>() { … }` function using loops / `&` / `trap` | `shell: zsh` + a multi‑line `run:` block |
| a function reading `"$1"` / `"$@"` | `args:` + `SETUPPER_ARG_*` (or `"$@"` with `shell`) |

## Documentation

- English: this `README.md`
- 日本語: [`docs/README.ja.md`](docs/README.ja.md)
