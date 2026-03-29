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

Caddy gives each worktree predictable `*.greppa.localhost` domains with automatic HTTPS. It starts
automatically with `pnpm dev`.

One-time setup to trust Caddy's local CA in your browser:

```sh
caddy trust
```

On Linux, Chrome uses its own certificate store. Install the CA there too:

```sh
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Caddy Local Authority" \
  -i ~/.local/share/caddy/pki/authorities/local/root.crt
```

Restart your browser after running this.

| Worktree | Web app                     | API                               | Playground                             |
| -------- | --------------------------- | --------------------------------- | -------------------------------------- |
| main     | `greppa.localhost`          | `greppa.localhost/api/*`          | `playground.greppa.localhost`          |
| feat-foo | `feat-foo.greppa.localhost` | `feat-foo.greppa.localhost/api/*` | `playground.feat-foo.greppa.localhost` |

## Pull requests

Run checks before opening a PR:

```sh
pnpm test
pnpm typecheck
pnpm lint
```
