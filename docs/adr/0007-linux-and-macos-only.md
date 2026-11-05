# ADR 0007: greppa supports Linux and macOS, not Windows

**Date**: 2026-11-05\
**Status**: Accepted\
**Related**: [ADR 0002 (Native app in Rust with GPUI)](./0002-native-rust-gpui.md)

## Context

GPUI runs on Linux, macOS, and Windows. Zed ships a Windows build, so Windows is not a broken
platform for greppa. Supporting it is a matter of cost.

greppa is local-first and reads Git repositories on disk, so its core work is paths and line
endings. Windows brings its own path rules, CRLF line endings, and Git's `core.autocrlf` behavior.
Each is a source of diff bugs that the other platforms do not have. Windows also needs its own full
GPUI build in CI on every pull request, and no user of greppa needs it.

## Decision

greppa supports Linux and macOS only. It does not support Windows.

- CI builds and tests greppa on Linux and macOS. There is no Windows job.
- greppa's own crates hold no `cfg(windows)` code.
- A report about Windows behavior is out of scope.
- The vendored gpui-component keeps its Windows code unchanged, so updates from upstream stay clean.

macOS stays because it has GPUI's most mature backend, and its CI job already exists.

## Consequences

### Positive

- Path and line-ending handling has two platforms to get right, not three.
- Each pull request runs one fewer full GPUI build.

### Negative

- People on Windows cannot use greppa.
- Adding Windows later means auditing path and line-ending code that was never written for it.

## Alternatives considered

### Support Linux, macOS, and Windows

Build and test on all three platforms. Rejected because Windows adds path, CRLF, and `core.autocrlf`
cases to every diff feature, and a CI build, for no user who needs it.

### Linux only

Drop macOS too. Rejected because macOS has GPUI's most mature backend, and its CI job already
exists.
