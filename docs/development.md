# Development

## Set up

1. Install [rustup](https://rustup.rs). The first `cargo` command in the repository installs the
   toolchain that `rust-toolchain.toml` pins.
2. Install the check tools:

   ```sh
   cargo install --locked cargo-nextest cargo-deny cargo-shear cargo-mutants typos-cli taplo-cli prek
   ```

3. Install the Git hooks:

   ```sh
   prek install
   ```

### Linux build packages

GPUI needs system libraries to compile. On Debian and Ubuntu:

```sh
sudo apt-get install --no-install-recommends \
  libasound2-dev libfontconfig1-dev libfreetype6-dev libssl-dev libvulkan-dev \
  libwayland-dev libx11-dev libx11-xcb-dev libxcb-randr0-dev libxcb-render0-dev \
  libxcb-shape0-dev libxcb-xfixes0-dev libxcb-xkb-dev libxcb1-dev \
  libxkbcommon-dev libxkbcommon-x11-dev pkg-config
```

On Arch Linux the same packages are:

```sh
sudo pacman -S --needed alsa-lib fontconfig freetype2 openssl vulkan-headers \
  wayland libx11 libxcb libxkbcommon libxkbcommon-x11 pkgconf
```

The `Test (Linux)` and mutation jobs in `.github/workflows/ci.yml` install the Debian and Ubuntu
list before they build GPUI. The list for CI is in
`.github/actions/install-gpui-system-packages/install.sh`. The check job does not compile code and
needs no display.

### Debugger builds

The `dev` profile keeps only line tables for workspace crates and no debug info for dependencies,
so panic backtraces show files and lines but a debugger cannot show variables. For full debugger
support in workspace crates, build with `cargo build --profile debugging`. Dependencies still build
without debug info. The binaries go to `target/debugging/`.

## Workspace

- `crates/greppa-core` holds review logic: diffs, line ranges, and review state. It never depends on
  GPUI, so it builds and tests without a display or GPU.
- `crates/greppa-ui` holds the GPUI views. It depends on `gpui-kit`; `greppa-core` never does.
- `crates/greppa` is the app binary. `cargo run` starts it.
- `xtask` holds repository tasks, run as `cargo xtask <task>`.
- `vendor/gpui-component` is the published `gpui-component` crate with one local patch, wired in
  through `[patch.crates-io]`. `PATCHES.md` describes the change. It is not a workspace member
  and is left out of the formatters and linters.

## Check your work

Run every check before you open a pull request:

```sh
cargo xtask check
```

It changes no files. It runs rustfmt, the raw-value check, typos, taplo, cargo-deny, cargo-shear,
clippy, nextest, doctests, and rustdoc, and reports every failed check at the end. Warnings fail
clippy, the tests, and rustdoc. Every Cargo build runs with `--locked`, so a stale `Cargo.lock`
fails too.

The raw-value check scans `crates/greppa-ui/src/**/*.rs` except `theme.rs`. It fails when a line
builds a length or color directly, such as `px(3.0)`, `rgb(0x112233)`, `white()`, or a preset
helper such as `.p_2()` or `.w_64()`. Every size, spacing, radius, text size, and color comes from
`crates/greppa-ui/src/theme.rs`.

The contrast test is a `greppa-ui` unit test that nextest runs. It computes the WCAG 2.2 AA
contrast ratio for each theme text and surface pair: 4.5:1 for text, 3:1 for boundaries and large
text. It passes only when the failing pairs are exactly the list of known failures. A new failing
pair fails the test, and a listed pair that starts to pass fails it too. Each failure message names
both tokens and the ratio.

`cargo xtask check tidy` runs only the checks that do not compile code. `cargo xtask check build`
runs only the ones that do.

Fix problems with these commands:

| Problem | Command |
|---|---|
| Rust formatting | `cargo fmt --all` |
| TOML formatting | `taplo fmt` |
| Spelling | `typos --write-changes` |
| Unused dependencies | `cargo shear --fix` |
| Some clippy warnings | `cargo clippy --workspace --all-targets --fix` |

The pre-commit hook runs rustfmt, clippy, typos, and taplo, but only in check mode. Run the fix
commands yourself.

## UI mocks

A mock is a scene built from real greppa UI parts with fake data. The scene code lives in
`crates/greppa-ui/src/scenes/`, and the parts live in `crates/greppa-ui/src/parts.rs`.

Open one scene in the sandbox:

```sh
cargo xtask sandbox up smoke-2
```

The scene binary opens one named scene. It prints the known scene names and exits non-zero when the
name is unknown or missing. The `--list` flag prints the names and exits without opening a window.
On the first frame it prints one JSON line with the scene name, origin, size, scale factor, and
window title. The sandbox opens it on the private display; never run it against the real display.

Capture a scene for the judges:

```sh
cargo xtask mock capture smoke-2
```

The command builds the scene binary, validates the scene name, removes stale capture files, and
calls `ruta capture --out .tau/judge/smoke-2 -- smoke-2`. ruta writes `shot.png`, `crop.png`, and
`capture.json` there. The crop is exactly the scene panel; the shot shows the surrounding base
color. ruta stops the scene and its private display on success and on failure, without stopping a
running interactive sandbox. It never uses the real display or input. `.tau/` is git-ignored.

Capture is Linux only. The end-to-end CI job checks that it writes all three files. It needs ruta
and:

- weston with the headless backend and Xwayland.
- ImageMagick 7 with `import`, `magick`, and `identify`.
- A working Vulkan driver. On a machine without a GPU, install Mesa's lavapipe. On Arch Linux that
  package is `vulkan-swrast`; on Debian and Ubuntu it is `mesa-vulkan-drivers`.

## Sandbox

Agents and people try and QA greppa through ruta in a throwaway window on a private headless
Weston and Xwayland display. Nothing shows on the real desktop, and no input reaches the real
pointer or keyboard. Install the pinned release:

```sh
cargo install --git https://github.com/sQVe/ruta --tag v0.2.1 --locked ruta
```

`ruta.toml` names the scene binary, JSON ready line, fixed `greppa-scene` title, and 640x480 window.
The wrappers require the binary at `target/debug/greppa-scene`; remove `CARGO_TARGET_DIR` or other
target directory overrides if the build reports another path.

```sh
cargo xtask sandbox up smoke-2
cargo xtask sandbox up --headed smoke-2
cargo xtask sandbox shot
cargo xtask sandbox move 100 100 200 200
cargo xtask sandbox click 200 124
cargo xtask sandbox drag 100 100 300 200
cargo xtask sandbox type "hello"
cargo xtask sandbox key p Control_L
cargo xtask sandbox scroll 200 124 3
cargo xtask sandbox hold Shift_L
cargo xtask sandbox release Shift_L
cargo xtask sandbox status
cargo xtask sandbox guide
cargo xtask sandbox log
cargo xtask sandbox opened
cargo xtask sandbox restart
cargo xtask sandbox down
```

The wrapper builds `greppa-scene` for `up` and `restart`, then passes all arguments to ruta.
Other commands go straight to ruta. After a build, you can also run `ruta up smoke-2`, `ruta shot`,
and `ruta down` directly from the workspace root.

`up [--headed] <scene>` opens the scene. Without `--headed` it stays on the
private display. With `--headed` it also runs Weston nested on your Wayland session, as one window on
the desktop, so you can demo a feature to someone. Only that Weston process gets the caller's
`WAYLAND_DISPLAY` and runtime directory; the scene, `xdotool`, and `import` stay on the private
Xwayland display. `up --headed` without `WAYLAND_DISPLAY` fails and starts nothing. During a demo
your own mouse over the window mixes with the agent's input, so leave the window alone while the
agent drives it.

`restart [--headed] [scene]` reopens the last scene, or another one. `shot [file]` writes the window
at its own pixel size, so a coordinate read from a shot matches the `move`, `click`, and `drag`
coordinates. `scroll <x> <y> [notches]` turns the wheel at a point; a positive count scrolls down
and a negative one up. `hold` keeps keys down for later commands until `release` lets them go.
`status` exits 0 only when the sandbox is up and was started from this workspace. `guide` prints
ruta's rules for agents that share a sandbox. `log` prints the scene's output. `opened` lists the
links that a stub `xdg-open` or
`open` logged instead of opening. `down` stops every process the sandbox started and removes its
root folder. A failed `up` cleans up the same way.

The root is `/var/tmp/ruta-<name>`, owner-only with mode 700. The default name is `greppa`. It holds the sandbox's own
`HOME`, XDG config, state, runtime, data, and cache folders and its own Weston socket. Each command
runs with an environment allowlist, so the caller's `DISPLAY`, `WAYLAND_DISPLAY`, and `LIBEI_SOCKET`
never reach it. `RUTA_NAME=<name>` runs a second sandbox side by side. A command that needs a
missing tool exits with a message that names the tool.

An ignored test drives the sandbox and `mock capture` end to end. It needs the same tools as the
sandbox. Run it with `cargo nextest run -p xtask --run-ignored only --test sandbox_end_to_end`.

Run the sandbox on Linux. It needs weston with the headless backend and Xwayland, xdotool, and
ImageMagick 7 with `import`, plus the Vulkan driver that capture needs.

On Arch Linux:

```sh
sudo pacman -S --needed weston xorg-xwayland imagemagick xdotool
```

On Debian and Ubuntu:

```sh
sudo apt-get install --no-install-recommends weston xwayland imagemagick xdotool
```

Input needs Weston 15 with Xwayland 24.1.14 or newer, as Arch ships. With the older versions in
Ubuntu 24.04 and Debian 13, Xwayland aborts on the first `xdotool` input, so `shot` works but
`click`, `type`, and `key` do not. CI runs the end-to-end test in an Arch Linux container for this
reason.

Never send input or run greppa against the real display.

## Mutation testing

Mutation testing changes the code in small ways and reports each change that no test catches.
`cargo xtask mutation` runs [cargo-mutants](https://mutants.rs) and prints one JSON report on stdout
in the format Tau's `mutation_check` tool reads.

```sh
cargo xtask mutation changed main

cargo xtask mutation audit crates/greppa-core/src/lib.rs

cargo xtask mutation changed main --max-mutants 50
```

`.cargo/mutants.toml` leaves out the app binary, the mock scenes, and test code and helpers.
Functions that only drive a display or an outside tool carry `#[mutants::skip]` and a comment
that names the reason. A missed mutant is a
survivor: add a test that fails when that line changes. The command exits 0 when every mutant is
caught, 2 for survivors in changed mode, and 1 for an error or an unmutated file. cargo-mutants
writes its logs to `target/mutants/mutants.out`.

## CI

`.github/workflows/ci.yml` runs on pull requests, on pushes to `main`, and weekly, so new security
advisories fail cargo-deny without a code change.

- `Check` runs `cargo xtask check tidy` on Linux.
- `Test (Linux)` and `Test (macOS)` run `cargo xtask check build`. greppa does not support
  Windows; see [ADR 0007](adr/0007-linux-and-macos-only.md).
- `Mutation (changed)` runs on pull requests. It runs `cargo xtask mutation changed` against the
  pull request's base, prints the JSON report, and lists survivors in the job summary. Survivors
  pass the job; an error or an unmutated file fails it.
- `Mutation audit` runs on the weekly schedule and on manual runs from `main`. It runs
  `cargo mutants --workspace` and uploads `mutants.out` as an artifact. Survivors and timeouts
  pass the job; other cargo-mutants failures fail it.

Only runs on `main` save the build cache.

The `Test (Linux)` and mutation jobs keep their system packages in the workflow cache and install
them from there, so they need the Ubuntu package mirror only when the cache has no packages that
fit the runner image. Every run that downloads from the mirror saves the packages, also on a pull
request. A pull request reads its own cache, the cache of its base branch, and the cache of `main`.

Renovate updates dependencies, actions, and the toolchain
every Monday, after a release is three days old.
