# ADR 0008: Dev builds keep line tables only, and dependencies keep no debug info

**Date**: 2026-11-05\
**Status**: Accepted\
**Related**: [ADR 0004 (Toolchain and quality gates)](./0004-toolchain-and-quality-gates.md),
[Cargo book: reduce generated debug information](https://doc.rust-lang.org/cargo/guide/build-performance.html#reduce-amount-of-generated-debug-information)

## Context

Contributors and agents work in many Git worktrees at once, and each worktree has its own `target/`
directory. Cargo's default `dev` profile builds workspace crates and their runtime dependencies with
full debug info. greppa pulls in GPUI and its large dependency tree, so each worktree writes and
links debug info for many dependencies that nobody steps through. The Cargo book names this debug
info as a cost in both disk space and build time.

Day-to-day work needs panic backtraces with files and lines, from tests and from the app. It rarely
needs a debugger that shows variables.

## Decision

The `dev` profile builds workspace crates with line tables only and dependencies with no debug info.
A separate `debugging` profile, built with `cargo build --profile debugging`, gives workspace crates
full debug info.

This follows the Cargo book's recommendation for build performance. Line tables keep file and line
numbers in panic backtraces, which is what tests and bug reports need. The `debugging` profile
inherits the dependency override, so dependencies stay without debug info there too.

## Consequences

### Positive

- Each worktree's `target/` is smaller, and builds write and link less.
- Panic backtraces from workspace code still show files and lines.

### Negative

- A debugger on a `dev` build cannot show local variables.
- The `debugging` profile builds into its own `target/debugging/` directory, so its first build
  compiles everything again.
- Dependency code compiled in the dependency's own crate has no source or variables in a debugger,
  even with the `debugging` profile. Generic code built inside a workspace crate keeps them.

## Alternatives considered

### Keep Cargo's default full debug info

Build workspace crates and runtime dependencies with full debug info in `dev`. Rejected because it
spends disk space and build time in every worktree on debug info that daily work does not use.

### No debug info at all in dev

Set `debug = false` for workspace crates too. Rejected because panic backtraces would lose file and
line numbers.
