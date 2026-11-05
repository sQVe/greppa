# Local patches to gpui-component 0.9.0

This directory is the published `gpui-component` 0.9.0 crate with one local
change. Cargo uses it through `[patch.crates-io]` in the root `Cargo.toml`.

## Rules

- Every file here is the published crate unchanged, except this file and the
  lines each patch below changes.
- Each patch starts with a `// GREPPA:` comment at the changed code, so
  `grep -rn 'GREPPA:' vendor/` lists every local change. Record the full
  reason here.
- On an update, unpack the new crate over this directory, then apply each
  patch below again.

## Upstream source

- Crate: `gpui-component` 0.9.0, unpacked from `gpui-component-0.9.0.crate`
  on crates.io, sha256
  `45bbfdba0efa392190f2fd446ec311325302eb047d5ce45dc1bcf189cb18f5eb`.
- Upstream revision: `7591a35eced761e3613c01e71ff04c10129dae1a`, as recorded
  in the crate's `.cargo_vcs_info.json`.
- Upstream path of the patched file:
  `crates/component/src/diff/selection.rs`. The `src/` tree here matches that
  revision file for file.
- License: Apache-2.0. The crate's license file is `LICENSE-APACHE`, kept in
  this directory.

## Change

- File: `src/diff/selection.rs`, `CodeText::request_layout`, the upstream
  `layers.push((` call at line 280.
- The selection layer is inserted at index 0 instead of pushed last. It is
  now one `// GREPPA:` comment line and one changed line.
- Reason: `merge_highlights` takes each background from the last active
  layer. The selection layer was last, so it replaced the inline change
  background on selected bytes. With the selection layer first, the inline
  change background wins on changed bytes, and the selection background stays
  on the other selected bytes.
- Built-in syntax colors do not change. The built-in syntax styles set only
  `color`, `font_weight`, and `font_style` (`src/highlighter/registry.rs`, the
  `From<ThemeStyle>` impl), and the selection layer sets only
  `background_color`.
- Behavior change for custom highlighters. `syntax_highlights` in
  `src/diff/presentation.rs` accepts any `HighlightStyle` from a
  `HighlightStyleResolver`. A background set there now outranks the native
  text selection background on those bytes. The POC installs no custom
  highlighter, so this is not exercised here. Check it before proposing the
  patch upstream.
- Line-range selection is not changed. `line_highlights` in `src/diff/mod.rs`
  pushes its row selection after the inline layers, so it still paints over
  the inline change background.

Patch size: 1 changed line and 1 added comment line (`git diff --no-index`
reports 2 insertions and 1 deletion against the upstream file).

## Checks

- `merge_highlights` has one caller in this crate, `CodeText::request_layout`.
  The upstream unit tests in `src/diff/selection_tests.rs` call
  `merge_highlights` with explicit layer order, so they do not depend on the
  caller's order.
- The crate's own library tests do not compile from the published tarball. Five
  `include_str!` paths point at files outside the crate (`crates/assets`,
  `crates/base`, `examples`, `themes`). They were not run.
- The change is checked by the phase 1 C5 test in `tests/diff_selection.rs`.
  It fails without this patch and passes with it. Logs are in
  `/tmp/gpui-poc-phase3/`.
