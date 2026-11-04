# ADR 0002: Native app in Rust with GPUI

**Date**: 2026-11-04\
**Status**: Accepted\
**Related**: [ADR 0003 (Diff viewer on gpui-component's `Diff`)](./0003-diff-viewer-on-gpui-component.md),
[greppa-web](https://github.com/sQVe/greppa-web)

## Context

greppa's main promise is review of large changes that GitHub renders slowly or not at all. The first
version, now archived as `sQVe/greppa-web`, was a React app in the browser with a Node server that
ran Git and sent diffs over HTTP. Every diff crossed a process boundary and was rendered in the
browser's DOM, so the speed of large reviews depended on two runtimes and the transport between
them.

A native app reads the repository and draws the diff in one process. The hardest part of a native
port is the diff viewer: a review needs a side-by-side diff with text selection that spans rows
scrolled out of view, stays on one side, and keeps change highlights visible. GPUI has no built-in
selectable text view, so this was the main risk.

A GPUI proof of concept tested that risk. Its `VERDICT.md` records that gpui-component's `Diff`
viewer met all five selection and scrolling criteria with a one-line patch, and that it scrolled
smoothly on a real display. Its `README.md` names the headless test behind each criterion. Neither
path in the proof of concept used Zed's `editor` crate.

## Decision

greppa is a native desktop app written in Rust on GPUI and gpui-component. The app reads Git and
renders the review in one process, with no server and no browser.

GPUI is the UI framework Zed is built on. It renders on the GPU and is made for views that show a
lot of code. gpui-component adds the widgets greppa needs, including a diff viewer, under
Apache-2.0.

greppa does not use Zed's `editor` crate or any other GPL-3.0 crate from Zed. greppa is MIT, and a
GPL-3.0 dependency would force the whole app under GPL-3.0.

## Consequences

### Positive

- Diffs go from Git to the screen in one process, with no HTTP transport or DOM between them.
- The diff viewer risk is retired: the proof of concept meets the selection and scrolling criteria
  on gpui-component.
- One language covers the Git layer, review state, and UI.

### Negative

- greppa is rebuilt from scratch. No code from the web app carries over.
- GPUI and gpui-component are pre-1.0, so updates can break their API.
- The GPUI ecosystem is small. Missing widgets must be built or patched by greppa.
- greppa runs only as a desktop app. It cannot be opened in a browser or served to another machine.
- Building on Linux needs system libraries for fonts, windowing, and the GPU.

## Alternatives considered

### Keep the React and Node web app

Keep improving `greppa-web`. Rejected because its speed on large changes depends on the server, the
transport, and the browser together, and the native path removed the main risk of a port.

### Build the viewer on Zed's `editor` crate

Use the text editor that Zed itself uses for diffs. Rejected because the crate is GPL-3.0, which is
not compatible with an MIT app.
