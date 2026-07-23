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

## Usage

```sh
setupper                 # list available commands (same as `setupper list`)
setupper <command>       # run a command
setupper <command> -h    # show a command's description and steps
setupper --version
```

`setupper` finds the nearest `setupper.yaml` by walking up from the current
directory, so you can run it from any repository inside the workspace.

## Concepts

- **Workspace** — a directory that groups several repositories. It holds the
  single `setupper.yaml`.
- **Command** — a named shortcut with a description and a list of steps.
- **Step** — one shell line. Steps run top to bottom; if one fails, the remaining
  steps are skipped and the command stops.
- **Working directory (`dir`)** — where a command runs, relative to the workspace
  root. Usually a repository subdirectory.

## Configuration — `setupper.yaml`

Place a single file at the workspace root:

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
| `run` | command | string or list | Shell step(s). Run top to bottom via the system shell; the first failing step stops the rest. |
| `run` | step | string | The shell command for a map‑form step. |
| `allow_failure` | step | boolean | If `true`, the command keeps going even when this step fails. Default `false`. |

Writing a step as a map gives finer control:

```yaml
run:
  - pnpm install
  - run: cp -n .env.sample .env.local
    allow_failure: true            # keep going even if this step fails
```

## What setupper replaces (mapping from shell aliases)

| Shell pattern | setupper equivalent |
| --- | --- |
| `alias <name>='… && … && …'` | a `commands.<name>.run` list |
| `cd $(git rev-parse --show-toplevel)` | `dir:` (relative to the workspace) |
| <code>cp -n .env.sample .env.local &#124;&#124; true</code> | a `cp -n` step / `allow_failure: true` |
| `export SOME_VAR=…` | top‑level `env:` |
| `echo "hint…"` | an `echo` step |

## Documentation

- English: this `README.md`
- 日本語: [`docs/README.ja.md`](docs/README.ja.md)
