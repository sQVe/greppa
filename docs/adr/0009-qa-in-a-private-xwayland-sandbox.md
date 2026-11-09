# ADR 0009: QA in a private Xwayland sandbox

**Date**: 2026-11-05\
**Status**: Accepted\
**Related**: [Judge skill](../../.pi/skills/judge-mock/SKILL.md)

## Context

Agents and people need to look at and drive a real greppa window. A real window is the only way to
show focus, keyboard routing, and the rendering backend. Opening it on the developer's desktop
would take over the screen, the pointer, and the keyboard, and it would depend on the desktop's
scale and other windows.

greppa is one native process with no server and no browser, so a sandbox cannot separate the app
from the rest of the machine. It can separate the display and the input instead. Several projects
need the same display, input, capture, and cleanup logic. Separate copies would drift and require
the same fixes in each project.

## Decision

greppa uses the installed ruta CLI for its private sandbox instead of keeping its own sandbox code.
`cargo xtask sandbox` builds the scene binary when needed and passes commands to ruta. ruta gives
agents and people a throwaway greppa window on a private headless Weston and Xwayland display.
Every command runs on that display. Input is xdotool XTest, and a shot is ImageMagick `import` of
the private window, so a shot's pixels and an input coordinate share one scale. Agents try and QA
greppa only in the sandbox and never against the real display.

ruta owns display isolation, input, capture, and process cleanup. greppa owns `ruta.toml`, the scene
build, and scene-name validation for capture. The config fixes the window title and size so ruta
can identify and capture the window exactly. People may also call ruta directly after a build;
[the development guide](../development.md#sandbox) gives the install and run commands.

The scene binary must build to `target/debug/greppa-scene` under the workspace root.
`ruta.toml` names that fixed program path, and ruta has no per-run override.

The sandbox is persistent across commands, and each command is a separate process. It records each
process with its start time, so `down` never kills a reused PID. The root folder is owner-only with
mode 700, refuses symlinks and foreign owners, and holds its own `HOME` and XDG config, state,
runtime, and data folders. Runtime children run with an environment allowlist that drops the
caller's `DISPLAY`, `WAYLAND_DISPLAY`, `LIBEI_SOCKET`, and similar, so no command can fall back to
the real display. The scene build is the one exception: it keeps the caller's Cargo and rustup
configuration and drops only the display and session variables, because a build needs the toolchain
environment and never opens a display. `xdg-open` and `open` are stub scripts that log a link for
`opened` instead of opening it. `RUTA_NAME` runs a second sandbox side by side at
`/var/tmp/ruta-<name>`.

`mock capture` builds and validates the scene, then calls ruta's one-shot capture. ruta owns its
separate capture root and teardown, so capture leaves a running interactive sandbox untouched.

### Headed demos

An agent can demo a feature to the user with `up --headed`. Weston then runs nested on the user's
Wayland session as one window, so the user watches while the same commands drive the private
display. Only the Weston process gets the caller's `WAYLAND_DISPLAY` and runtime directory. The
scene, `xdotool`, and `import` keep the sandboxed environment, so input and shots stay on the
private display. During a demo the user's own mouse over the window mixes with the agent's input.

## Consequences

### Positive

- Agents and people see the real window without touching the real screen or input.
- A shot's coordinates match the input coordinates, so a click can be read from a shot.
- Recorded start times stop a reused PID from being stopped.
- The environment allowlist and the stub openers keep a command inside the sandbox.
- ruta shares display and cleanup fixes across projects and serves both capture and the sandbox.
- A headed demo shows the same private display that the headless sandbox uses, so an agent can
  switch to a visible window without changing how it drives the app.

### Negative

- The sandbox needs an installed ruta, Linux, Weston, Xwayland, xdotool, ImageMagick, and a Vulkan
  driver.
- A change to ruta's CLI or config can break the wrappers, so greppa pins its release.
- A custom Cargo target directory cannot run the sandbox or capture because the wrappers require
  the configured scene binary path.
- Input needs a current Weston and Xwayland. Weston 14 with Xwayland 24.1.6 and older, as in
  Ubuntu 24.04 and Debian 13, abort Xwayland on the first `xdotool` input; Weston 15 with Xwayland
  24.1.14 works. CI runs the end-to-end test in an Arch Linux container.
- A short-lived xdotool process does not keep the pointer hover across commands. A later
  requirement for hover needs a persistent connection. Held keys and mouse buttons do persist on
  the private server, so the sandbox must release them on every exit.
- The sandbox covers GPUI's X11 backend, not its native Wayland backend.
- The runtime allowlist must name any environment a future greppa view needs. The scene build
  instead drops a fixed set of display and session variables from the caller environment, so that
  set needs review when the caller environment changes.
- The sandbox is not a security boundary against a process that already has host shell access.
- Headed demos need a Wayland session. They are for showing a feature, not for unattended runs,
  because the user's own mouse over the window mixes with the agent's input.

## Alternatives considered

### A persistent x11rb connection

Talk to XTEST from Rust with `x11rb` and its `xtest` feature, and keep the connection open across
commands. Deferred because xdotool already provides every input the sandbox needs, held keys
included. A persistent connection becomes worthwhile when hover must survive across commands; it
also needs its own keymap and modifier handling.

### Native Wayland with Sway

Run greppa on a private headless Sway and drive it with wtype, a virtual-pointer client, and grim.
Rejected because the installed Weston advertises no virtual keyboard, virtual pointer, or
wlr-screencopy protocol, so it needs a different compositor, and switching the compositor and the
input and capture APIs together adds risk without a demonstrated benefit for this task.

### The developer's real display

Open the window on the desktop that is already running. Rejected because the window would take over
the screen and the input, and the result would depend on the desktop's scale and other windows.

### A sandbox inside xtask

Keep a local copy of the sandbox in Rust. Rejected because each project would maintain and test
its own display, input, and cleanup logic. Thin wrappers keep greppa's build and validation steps
local while ruta shares sandbox fixes across projects.
