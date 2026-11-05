# greppa

A local-first code review app: a native desktop app in Rust on GPUI that reads diffs from the Git
repository on disk. Read [the development guide](docs/development.md) for local setup and
verification.

- Run `cargo xtask check` before finishing changes.
- Format with `cargo fmt`. rustfmt runs with its default settings.
- Follow the decisions in [docs/adr](docs/adr/README.md), and record new decisions there. Read that
  guide before adding or changing an ADR. When details of a decision change, edit its ADR in place
  in the same change. Do not write documents that explain how a feature works; see
  [ADR 0001](docs/adr/0001-documentation-scope.md).
- Comment only what the code cannot say, such as a constraint or a workaround. Do not describe the
  code's history.
- Before finishing a document, check its local links and verify the commands it gives against the
  repository.

## Architecture

- greppa is one native process on GPUI and gpui-component, with no server and no browser. See
  [ADR 0002](docs/adr/0002-native-rust-gpui.md).
- The diff viewer is gpui-component's `Diff`, from a vendored copy that greppa owns and patches.
  Record each local patch, with its reason, in the vendored crate's `PATCHES.md`, and mark the
  changed code with a `// GREPPA:` comment. Commit an import or update of the crate unchanged, apart
  from its patches. See [ADR 0003](docs/adr/0003-diff-viewer-on-gpui-component.md).
- Only one module talks to `Diff`. Everything else uses greppa's own types for files, comments,
  themes, selections, and clicks. See [ADR 0003](docs/adr/0003-diff-viewer-on-gpui-component.md).
- The toolchain is pinned in `rust-toolchain.toml`. Lint levels live in `[workspace.lints]`, and CI
  fails on warnings. Add single clippy lints, not whole groups. See
  [ADR 0004](docs/adr/0004-toolchain-and-quality-gates.md).
- The app is MIT. Never depend on a GPL crate, such as Zed's `editor`. Keep the Apache-2.0 license
  and notices of vendored code. See [ADR 0004](docs/adr/0004-toolchain-and-quality-gates.md).
