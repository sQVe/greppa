# Contributing

## Setup

```sh
pnpm install
pnpm run env:setup
```

`env:setup` generates `.env.local` with deterministic ports per worktree and writes a Caddy reverse
proxy snippet to `~/.config/caddy/greppa/`.

## Development

```sh
pnpm dev
```

Runs all packages in parallel. Each worktree gets stable ports derived from its directory name.

## Caddy reverse proxy

Caddy gives each worktree predictable `*.greppa.localhost` domains with no DNS config (RFC 6761).

Install Caddy, then start it with the generated config:

```sh
caddy run --config ~/.config/caddy/greppa/Caddyfile
```

| Worktree | Web app                     | API                               | Playground                             |
| -------- | --------------------------- | --------------------------------- | -------------------------------------- |
| main     | `greppa.localhost`          | `greppa.localhost/api/*`          | `playground.greppa.localhost`          |
| feat-foo | `feat-foo.greppa.localhost` | `feat-foo.greppa.localhost/api/*` | `playground.feat-foo.greppa.localhost` |

`pnpm run env:setup` regenerates the snippet and reloads Caddy automatically.

## Pull requests

Run checks before opening a PR:

```sh
pnpm test
pnpm typecheck
pnpm lint
```
