# QA guide

greppa is a native desktop app in Rust on GPUI. Today a user can reach one interface: a mock scene
in the scene window, opened in the ruta sandbox. The `greppa` app binary opens nothing yet.

## Choose sections

| Section      | Test it when the change touches                                        |
| ------------ | ---------------------------------------------------------------------- |
| Scene window | A scene, a part, or the theme in `crates/greppa-ui`; `greppa-scene.rs` |

Cross-effects:

- `vendor/gpui-component`, the `gpui-kit` version, `Cargo.lock`, and `rust-toolchain.toml` can
  change how every scene draws.
- `ruta.toml` and the ruta release set the window size and how the sandbox finds the window.

Pick the scenes. `SceneName` in `crates/greppa-ui/src/scenes.rs` lists them.

- A change to one scene: that scene.
- A change to a part in `crates/greppa-ui/src/parts.rs`: every scene that uses the part.
- Any other change above: `smoke-2`, plus one scene for each part the change can reach.

- A new mock's look needs no `qa` launch. The [judge-mock skill](skills/judge-mock/SKILL.md) gates
  it from still images.
- When the impact on a scene is unclear, include the scene.

## Before a launch

For the manager. The `qa` worker cannot build or start anything, and one sandbox shows one scene.
Run `RUTA_NAME=<name> ruta guide` and follow its rules for the session that starts the sandbox.

The manager starts:

- One sandbox for each assigned scene, after the last edit. It reads no secret, costs nothing, and
  keeps to its own folder and private display.

  ```sh
  RUTA_NAME=<name> cargo xtask sandbox up <scene>
  ```

  It is up when `RUTA_NAME=<name> ruta status` exits 0. After the worker reports, stop it:

  ```sh
  RUTA_NAME=<name> ruta down
  ```

Ask the user:

- `up --headed`: it opens a window on the user's desktop.

Put in the brief: each `RUTA_NAME` with its scene, and whether the scene handles input. Launch `qa`
without `url`; a native window has none.

## Scene window

### Reach it

Run `RUTA_NAME=<name> ruta guide` first, with a `RUTA_NAME` from the brief. Follow its rules for
every session and for a session that did not start the sandbox.

1. Check that the sandbox is up and serves this worktree:

   ```sh
   RUTA_NAME=<name> ruta status
   ```

   It must exit 0 and print `ruta <name> is up and serves <worktree root>`. Otherwise ask the
   parent to start the sandbox. Do not start it.

2. Check that the window runs the current binary:

   ```sh
   pid=$(cut -d' ' -f1 /var/tmp/ruta-<name>/pid)
   readlink /proc/$pid/exe
   ```

   It must print `<worktree root>/target/debug/greppa-scene`. A path that ends in `(deleted)`
   means someone rebuilt the binary after the window opened.

3. Check that no source is newer than the binary:

   ```sh
   find crates/greppa-ui vendor/gpui-component Cargo.toml Cargo.lock rust-toolchain.toml \
     -newer target/debug/greppa-scene -type f
   ```

   Any path in the output means the window may show old code.

4. Check the scene: `RUTA_NAME=<name> ruta log` prints a JSON line whose `scene` is the scene from
   the brief.

If step 2, 3, or 4 fails, report it to the parent and test nothing.

### Use it safely

`ruta guide` lists the commands you may run and the ones you may not. greppa adds these rules:

- Never run `cargo` or `cargo xtask`. They build.
- Never run `target/debug/greppa-scene` yourself. It opens on the real display.
- Never write under `/var/tmp/ruta-*`. Write shots under `/tmp`, with a new name for each shot.
- `ruta log` prints what the app wrote to its output. `ruta opened` lists the links the app tried
  to open; the sandbox opens none of them.

### What to check

- The shot has the width and height that `ruta.toml` sets. `magick identify <file>` prints the
  shot's size.
- The panel is whole: no border, row, or label is cut off. Empty space below the last row is
  normal.
- Text is readable, and no label overlaps another.
- When the brief says the scene handles no input, a shot after a click, a key, and a scroll is the
  same picture as before.
- The `smoke-1` to `smoke-4` scenes test the mock judges, and some are flawed on purpose. Do not
  report a flaw that the "Design" column of the
  [smoke test table](skills/judge-mock/SKILL.md#smoke-test) names.

### Recipes

None.

## Not testable

Report each of these as not verified. Do not try one through another path.

- Other window sizes: the sandbox has the one size that `ruta.toml` sets.
- macOS and GPUI's Wayland backend: the sandbox runs GPUI's X11 backend on Linux.
- `cargo xtask`: it runs only through `cargo`, which builds. The manager runs `cargo xtask check`.
- `crates/greppa` and `crates/greppa-core`: no interface uses them yet.

[The development guide](../docs/development.md#sandbox) holds the install steps, the system
requirements, and every sandbox command.
