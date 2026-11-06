# greppa

A local-first code review app: a native desktop app in Rust on GPUI that reads diffs from the Git
repository on disk. Read [the development guide](docs/development.md) for local setup and
verification.

- Run `cargo xtask check` before finishing changes.
- Follow [the Rust coding guide](docs/coding.md) in Rust code. It changes and adds to Tau's coding
  instructions.
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
- greppa supports Linux and macOS, not Windows. Add no `cfg(windows)` code to greppa's own crates.
  See [ADR 0007](docs/adr/0007-linux-and-macos-only.md).
- The diff viewer is gpui-component's `Diff`, from a vendored copy that greppa owns and patches.
  Record each local patch, with its reason, in the vendored crate's `PATCHES.md`, and mark the
  changed code with a `// GREPPA:` comment. Commit an import or update of the crate unchanged, apart
  from its patches. See [ADR 0003](docs/adr/0003-diff-viewer-on-gpui-component.md).
- Only one module talks to `Diff`. Everything else uses greppa's own types for files, comments,
  themes, selections, and clicks. See [ADR 0003](docs/adr/0003-diff-viewer-on-gpui-component.md).
- Every size, spacing, corner radius, text size, and color in `greppa-ui` comes from
  `crates/greppa-ui/src/theme.rs`. `cargo xtask check` rejects a raw value anywhere else in
  `greppa-ui`, and a contrast test checks the theme's text and control pairs.
- Design new UI as a mock scene first, with real greppa parts and fake data. Open a scene in the
  sandbox with `cargo xtask sandbox up <scene>`, capture it with `cargo xtask mock capture <scene>`,
  and gate it with the judge-mock skill in `.pi/skills/judge-mock/`. See
  [ADR 0005](docs/adr/0005-two-ai-judges-gate-ui-mocks.md).
- Try and QA greppa only in the sandbox. `cargo xtask sandbox up <scene>` opens a throwaway window
  on a private headless display. Never send input or run the app against the real display. See
  [the development guide](docs/development.md) and
  [ADR 0009](docs/adr/0009-qa-in-a-private-xwayland-sandbox.md).
- The toolchain is pinned in `rust-toolchain.toml`. Lint levels live in `[workspace.lints]`, and CI
  fails on warnings. Add single clippy lints, not whole groups. See
  [ADR 0004](docs/adr/0004-toolchain-and-quality-gates.md).
- The app is MIT. Never depend on a GPL crate, such as Zed's `editor`. Keep the Apache-2.0 license
  and notices of vendored code. See [ADR 0004](docs/adr/0004-toolchain-and-quality-gates.md).
