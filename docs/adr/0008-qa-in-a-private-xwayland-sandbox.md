# ADR 0008: QA in a private Xwayland sandbox

**Date**: 2026-11-05\
**Status**: Accepted\
**Related**: [Judge skill](../../.pi/skills/judge-mock/SKILL.md)

## Context

Agents and people need to look at and drive a real greppa window. A real window is the only way to
show focus, keyboard routing, and the rendering backend. Opening it on the developer's desktop
would take over the screen, the pointer, and the keyboard, and it would depend on the desktop's
scale and other windows.

greppa is one native process with no server and no browser, so a sandbox cannot separate the app
from the rest of the machine. It can separate the display and the input instead. The capture path
for mocks already starts a private Weston with Xwayland and grabs the window with ImageMagick.

## Decision

`cargo xtask sandbox` gives agents and people a throwaway greppa window on a private headless
Weston and Xwayland display. Every command runs on that display. Input is xdotool XTest, and a shot
is ImageMagick `import` of the private window, so a shot's pixels and an input coordinate share one
scale. Agents try and QA greppa only in the sandbox and never against the real display.

The sandbox is persistent across commands, and each command is a separate process. It records each
process with its start time, so `down` never kills a reused PID. The root folder is owner-only with
mode 700, refuses symlinks and foreign owners, and holds its own `HOME` and XDG config, state,
runtime, and data folders. Runtime children run with an environment allowlist that drops the
caller's `DISPLAY`, `WAYLAND_DISPLAY`, `LIBEI_SOCKET`, and similar, so no command can fall back to
the real display. The scene build is the one exception: it keeps the caller's Cargo and rustup
configuration and drops only the display and session variables, because a build needs the toolchain
environment and never opens a display. `xdg-open` and `open` are stub scripts that log a link for
`opened` instead of opening it. A name override runs a second sandbox side by side.

`mock capture` uses the same display command and wait code as the sandbox. The sandbox adds its own
persistent cleanup, because its processes outlive the command that started them, so the two paths
share the start and wait logic but not the lifetime handling.

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
- The same display code serves capture and the sandbox.
- A headed demo shows the same private display that the headless sandbox uses, so an agent can
  switch to a visible window without changing how it drives the app.

### Negative

- The sandbox needs Linux, Weston, Xwayland, xdotool, ImageMagick, and a Vulkan driver.
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
commands. Deferred because the first version needs only move, click, drag, type, and key, and
xdotool already provides them. A persistent connection becomes worthwhile when hover or held
modifiers must survive across commands; it also needs its own keymap and modifier handling.

### Native Wayland with Sway

Run greppa on a private headless Sway and drive it with wtype, a virtual-pointer client, and grim.
Rejected because the installed Weston advertises no virtual keyboard, virtual pointer, or
wlr-screencopy protocol, so it needs a different compositor, and switching the compositor and the
input and capture APIs together adds risk without a demonstrated benefit for this task.

### The developer's real display

Open the window on the desktop that is already running. Rejected because the window would take over
the screen and the input, and the result would depend on the desktop's scale and other windows.

### A Python or shell script

Write the sandbox as a Python or bash program as the reference implementation did. Rejected because
`xtask` is the repository's task runner, the repository has no Python, and Rust holds the argument
parsing and isolation checks in one tested place.
