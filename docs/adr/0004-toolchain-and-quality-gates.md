# ADR 0004: Toolchain and quality gates

**Date**: 2026-11-04\
**Status**: Accepted\
**Related**: [ADR 0003 (Diff viewer on gpui-component's `Diff`)](./0003-diff-viewer-on-gpui-component.md)

## Context

greppa starts as a new Rust workspace, so it must choose its toolchain, formatting, linting, and
license checks before code exists. Before the port, a survey looked at eight active Rust projects:
Zed, gpui-component, uv, Ruff, Helix, rust-analyzer, Tauri, and Bevy. The GPUI proof of concept's
`docs/port-setup.md` records what they share. All eight format with rustfmt and fail CI on clippy
warnings. Most use edition 2024 and shared workspace lints. Few turn on the whole clippy pedantic
group.

greppa ships under MIT, so every dependency must have a license that allows it.

## Decision

greppa pins a stable Rust toolchain, formats with default rustfmt, lints with selected clippy lints,
checks dependencies with cargo-deny, runs formatting and linting in prek hooks, and runs mutation
testing with cargo-mutants as advice.

### Toolchain

- `rust-toolchain.toml` pins one stable release, with clippy and rustfmt. Every developer and CI
  build with that release. Moving to a newer release is a deliberate change.
- Every crate uses edition 2024.

### Formatting

- rustfmt runs with its default settings. greppa does not loosen or tighten the line-breaking
  widths.
- rustfmt never adds the blank lines between logical steps, so review checks them.

### Linting

- Clippy lint levels live in `[workspace.lints]`, and every crate uses them.
- The `all` group warns and `correctness` denies. Single lints, such as `dbg_macro`, `todo`, and
  `print_stdout`, are added when they are needed, also from groups that stay off. The whole
  pedantic, nursery, and restriction groups stay off.
- A suppression is `#[expect(lint, reason = "...")]` on the smallest item that needs it. The
  `allow_attributes_without_reason` lint rejects a suppression without a reason.
- A lint that fires in some builds and not in others is suppressed with
  `#[allow(lint, reason = "...")]`, because `#[expect]` warns in the builds where the lint is
  silent.
- Unsafe code is denied.
- CI fails on any warning.

### Dependencies and licenses

- The app is MIT. The vendored gpui-component keeps its Apache-2.0 license and notices.
- cargo-deny checks licenses, advisories, sources, and duplicate crates. It allows Apache-2.0 and
  other licenses compatible with an MIT app, and rejects GPL.

### Hooks

- prek runs Git hooks from a config tracked in the repository. The hooks run formatting and linting
  before a commit.
- `cargo xtask check` is the one entry point for the full set of checks.

### Mutation testing

- cargo-mutants mutates greppa-core, greppa-ui, and `xtask`. `.cargo/mutants.toml` leaves out the
  app binary, which needs a display to run, the mock scenes and their binary, which hold fake data,
  and test code and test helpers. Each exclusion has a comment that names its reason.
- A single function that only drives a display or an outside tool, such as Weston, xdotool, or
  ImageMagick, is skipped with `#[mutants::skip]` and a one-line comment that names the reason.
  Code that runs without a display stays under mutation, even when its survivors are hard to kill.
- CI mutates the diff of each pull request with `cargo xtask mutation changed`, and the scheduled
  run on `main` audits the whole workspace and saves the cargo-mutants report.
- Survivors are advice. They never fail a pull request or the audit, because some survivors are
  equivalent mutants that no test can catch, and a hard gate would push people to write tests
  that only kill a mutant. An error, an unmutated file, or a failing baseline fails the job.

## Consequences

### Positive

- Every machine builds with the same compiler, so a lint or format result does not change between
  developers and CI.
- Default rustfmt needs no config to maintain and matches most Rust code a reader has seen.
- A GPL dependency or an unknown source fails the build before it ships.
- Format and lint failures show up before a commit, not only in CI.
- Mutation testing shows code that no test checks, on each pull request and in the weekly audit.

### Negative

- Default rustfmt keeps short calls, chains, and `if`/`else` blocks on one line, so code is more
  compact than some readers like.
- A pinned toolchain must be moved forward by hand, or greppa falls behind stable Rust.
- Selected lints catch less than the pedantic group, so some style problems are left to review.
- A new license in the dependency tree blocks the build until someone reviews and allows it.
- Hooks add time to each commit, and prek is one more tool to install.
- Mutation runs take much longer than the tests, and survivors can be left unfixed because they
  do not fail CI.

## Alternatives considered

### Loosened rustfmt widths

Lower rustfmt's width settings so calls, chains, and `if`/`else` blocks split sooner. Rejected
because it adds config that differs from the Rust code readers know, and the more compact default
was acceptable.

### The whole clippy pedantic group

Turn on every pedantic lint and allow the ones that do not fit. Rejected because it brings many
lints greppa would turn off one by one, and only two of the eight surveyed projects do it.

### A floating stable toolchain

Build with whatever stable release is installed. Rejected because a new release can add lints or
change formatting, so the same code passes on one machine and fails on another.

### Survivors fail CI

Fail a pull request when a mutant survives. Rejected because equivalent mutants cannot be caught,
so each one would need a skip or a test that only exists to kill it.

### No license and advisory checks

Rely on review to catch a bad dependency. Rejected because the license of a transitive dependency
is easy to miss.
