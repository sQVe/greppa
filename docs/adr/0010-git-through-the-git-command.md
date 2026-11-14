# ADR 0010: greppa reads Git through the `git` command

**Date**: 2026-11-14\
**Status**: Accepted\
**Related**: [ADR 0004 (Toolchain and quality gates)](./0004-toolchain-and-quality-gates.md)

## Context

greppa reviews diffs from the Git repository on disk. It must resolve refs to commits, find merge
bases, list commits, and read patches. The patches must match what `git diff` shows the reviewer,
including rename detection and the diff algorithms Git offers.

Every machine that has a Git repository to review also has the `git` command. Git keeps its
plumbing commands and their explicit output formats stable for scripts.

greppa is MIT, and its dependencies must be compatible with that license. A Rust build that also
compiles a bundled C library needs a C toolchain.

## Decision

greppa reads Git by running the `git` command, not through a Git library.

`greppa-core` is the only app crate that runs `git`. It runs `git -C <folder>` with plumbing
commands and explicit output formats, so a user's config does not change what greppa parses. It
resolves each ref to a full commit SHA once, and keys everything after that on SHAs. The `xtask`
crate keeps its own Git calls, because it is a developer tool and not part of the app.

The patches greppa shows are the ones Git itself produces. Git's own behavior for worktrees,
submodules, and repository formats comes for free with each Git release.

## Consequences

### Positive

- greppa shows the same patches and resolves the same refs as the `git` the reviewer uses.
- greppa adds no Git library to its build, and no C code.
- Linked worktrees and new repository formats work wherever the installed `git` supports them.

### Negative

- greppa needs `git` on the `PATH`, and an old `git` may lack a flag greppa uses.
- Each Git read starts a process. Its cost against a library call is not measured.
- greppa parses text output, so each command must use an explicit, stable format.
- Tests need a real `git` to build temporary repositories.

## Alternatives considered

### gix

gix is a pure Rust Git library. Rejected because greppa would format patches itself and risk
showing a diff that differs from `git diff`, and because gix's API is before 1.0 and still changes.

### git2

git2 binds the C library libgit2. Rejected because it bundles and compiles libgit2, which adds C
code and a C toolchain to the build, and libgit2 is a second Git implementation whose output can
differ from the `git` command.
