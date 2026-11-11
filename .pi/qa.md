# QA guide

greppa is a native desktop app in Rust on GPUI. Today a user can reach one interface: a mock scene
in the scene window, opened in the ruta sandbox. The `greppa` app binary opens nothing yet.

## Choose sections

For the manager.

| Section      | Test it when the change touches                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene window | A scene, a part, or the theme in `crates/greppa-ui`; `vendor/gpui-component`; the `gpui-kit` version or `Cargo.lock`; `rust-toolchain.toml`; `ruta.toml`; `greppa-scene.rs`; the ruta release |

Pick the scenes. `SceneName` in `crates/greppa-ui/src/scenes.rs` lists them.

- A change to one scene: that scene.
- A change to a part in `crates/greppa-ui/src/parts.rs`: every scene that uses the part.
- A change to anything else in the table: `smoke-2`, plus one scene for each part the change can
  reach.
- When the impact on a scene is unclear, include the scene.

Do not launch `qa` for these:

- A new mock's look. The [judge-mock skill](skills/judge-mock/SKILL.md) gates it from still images.
- `cargo xtask`. It runs only through `cargo`, which builds. Run `cargo xtask check` yourself.
- `crates/greppa` and `crates/greppa-core`. No interface uses them yet.

## Before launch

For the manager. The `qa` worker cannot build or start anything, and one sandbox shows one scene.
Run every command from the worktree root.

1. Start one sandbox for each assigned scene, after the last edit:

   ```sh
   RUTA_NAME=<name> cargo xtask sandbox up <scene>
   ```

   Always set `RUTA_NAME`, and use a name that no other running sandbox has. Without it, every
   worktree uses the sandbox `greppa`. An `up` on a name that is in use replaces its window. A name
   starts with a letter or digit and holds at most 32 lowercase letters, digits, and hyphens.

2. Put in the brief: each `RUTA_NAME` with its scene, and whether the scene handles input. Launch
   `qa` without `url`; a native window has none.
3. After the worker reports, stop each sandbox:

   ```sh
   RUTA_NAME=<name> ruta down
   ```

## Scene window

### Reach it

Run every command from the worktree root, with a `RUTA_NAME` from the brief.

1. Check that the sandbox runs:

   ```sh
   RUTA_NAME=<name> ruta shot /tmp/<name>-1.png
   ```

   It prints the file path. When it prints `ruta <name> is not up; run 'ruta up' first`, ask the
   parent to start the sandbox. Do not start it.

2. Check that the window runs this worktree's binary:

   ```sh
   pid=$(cut -d' ' -f1 /var/tmp/ruta-<name>/pid)
   readlink /proc/$pid/cwd
   readlink /proc/$pid/exe
   ```

   `cwd` must be this worktree's root. `exe` must be `<worktree>/target/debug/greppa-scene`. An
   `exe` that ends in `(deleted)` means someone rebuilt the binary after the window opened.

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

Besides the checks above, use only these commands. Coordinates are window pixels, the same as in a
shot.

```sh
RUTA_NAME=<name> ruta shot <file>
RUTA_NAME=<name> ruta move <x0> <y0> <x1> <y1>
RUTA_NAME=<name> ruta click <x> <y> [button]
RUTA_NAME=<name> ruta drag <x0> <y0> <x1> <y1>
RUTA_NAME=<name> ruta scroll <x> <y> [notches]
RUTA_NAME=<name> ruta type <text>
RUTA_NAME=<name> ruta key <keysym> [modifier]...
RUTA_NAME=<name> ruta hold <keysym>...
RUTA_NAME=<name> ruta release <keysym>...
RUTA_NAME=<name> ruta log
RUTA_NAME=<name> ruta opened
```

- Always pass a file to `ruta shot`, under `/tmp`, with a new name for each shot. Without a file,
  the shot goes into the sandbox folder.
- The shot is the only view of the window. Read the PNG.
- `ruta log` prints what the app wrote to its output. `ruta opened` lists the links the app tried
  to open; the sandbox opens none of them.

Never:

- Run `cargo` or `cargo xtask`. They build.
- Run `ruta up`, `ruta restart`, `ruta down`, or `ruta capture`. They start or stop an app.
- Run a `ruta` command without `RUTA_NAME`. It reaches a sandbox that another worktree may own.
- Run `target/debug/greppa-scene` yourself. It opens on the real display.
- Call `xdotool`, `import`, or any other input or capture tool yourself. Outside ruta they reach
  the real display.
- Leave a key held. Follow each `ruta hold` with `ruta release` for the same keys.
- Write under `/var/tmp/ruta-*`.

### What to check

- The shot has the width and height that `ruta.toml` sets.
- The scene fills its panel, with no blank or clipped area.
- Text is readable, and no label overlaps another.
- When the brief says the scene handles no input, a shot after a click, a key, and a scroll is the
  same picture as before.
- The `smoke-1` to `smoke-4` scenes test the mock judges, and some are flawed on purpose. Do not
  report a flaw that the "Design" column of the
  [smoke test table](skills/judge-mock/SKILL.md#smoke-test) names.

Report as not verified: other window sizes, macOS, and GPUI's Wayland backend. The sandbox has one
window size and runs GPUI's X11 backend on Linux.

### Recipes

None.

[The development guide](../docs/development.md#sandbox) holds the install steps, the system
requirements, and every sandbox command.
