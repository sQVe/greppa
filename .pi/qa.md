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
The registry has four smoke scenes and eight reference scenes:

- `direction-v4-rule` and `direction-v4-tree`
- `direction-v5-range-gutter` and `direction-v6-tree`
- `direction-v7-focus-border-files`, `direction-v7-focus-border-diff`, and
  `direction-v7-focus-border-comments`
- `direction-v7-keys`

All scene windows are 1280x800. Smoke panels stay 420x300 at (60, 60).
Reference scenes fill the window and use fixed review data.

- A change to one scene: that scene.
- A change to a part in `crates/greppa-ui/src/parts.rs`: every scene that uses the part.
- Any other change above: `smoke-2`, plus one scene for each part the change can reach.

- A new mock's look needs no `qa` launch. The [judge-mock skill](skills/judge-mock/SKILL.md) gates
  it from still images.
- When the impact on a scene is unclear, include the scene.

## Journeys

| Journey | Goal | Run it when the change touches | Test |
| ------- | ---- | ------------------------------ | ---- |
| [Find the file that changed](qa/journeys/find-the-file-that-changed.md) | Find the file that changed and read its diff. | `crates/greppa-ui/src/scenes/`, `crates/greppa-ui/src/parts.rs` | by hand |

## Before a launch

For the manager. The `qa` worker cannot build or start anything, and one sandbox shows one scene.

Build the scene before the first launch, so the launch's build is a no-op:

```sh
cargo build --locked --package greppa-ui --bin greppa-scene
```

The manager launches the `sandbox` target with the `verification` tool. Write the scene name to
`.tau/scene` first. The target builds the scene, starts the sandbox, and checks that it serves
this worktree. The sandbox name is `greppa-` followed by the run in lowercase, where `<run>` is
the run the tool returns. After the worker reports, stop the run with the tool.

Ask the user:

- `up --headed`: it opens a window on the user's desktop.

Put in the brief: the run, the sandbox name, the scene, and whether the scene handles input.
Launch `qa` without `url`; a native window has none.

## Scene window

Target: `sandbox`

### Reach it

Run `RUTA_NAME=<name> ruta guide` first, with a `RUTA_NAME` from the brief. Follow its rules for
every session and for a session that did not start the sandbox.

The `sandbox` target's doctor checked the build at launch. Run the steps below again before you drive.

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

3. Check that no source is newer than the binary, and that `ruta.toml` is not newer than the
   sandbox:

   ```sh
   find crates/greppa-ui vendor/gpui-component Cargo.toml Cargo.lock rust-toolchain.toml \
     -newer target/debug/greppa-scene -type f
   find ruta.toml -newer /var/tmp/ruta-<name>/pid
   ```

   Any path in the output means the window may show old code or old sandbox settings.

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

For a reference scene, check the controls that the change touches:

- Click a file or comment to jump to its diff.
- Switch between the file list and folder tree. Collapse and expand a folder.
- Drag a pane divider, hide the pane with its toolbar toggle, then show it again.
  Its width should stay the same.
- Expand the generated file and return to a source file. Comment bands should still align
  with the code after the line-number column grows.

The focus scenes show fixed focus marks. `direction-v7-keys` shows reference key text, not
implemented keyboard bindings. These scenes do not save a review or comments.

## Not testable

Report each of these as not verified. Do not try one through another path.

- Other window sizes: the sandbox has the one size that `ruta.toml` sets.
- macOS and GPUI's Wayland backend: the sandbox runs GPUI's X11 backend on Linux.
- `cargo xtask`: it runs only through `cargo`, which builds. The manager runs `cargo xtask check`.
- `crates/greppa` and `crates/greppa-core`: no interface uses them yet.

[The development guide](../docs/development.md#sandbox) holds the install steps, the system
requirements, and every sandbox command.
