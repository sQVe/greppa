# Local patches to gpui-component 0.9.0

This directory is the published `gpui-component` 0.9.0 crate with the local
changes below. Cargo uses it through `[patch.crates-io]` in the root `Cargo.toml`.

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
- Upstream paths of the patched files are under `crates/component/src/diff/`:
  `selection.rs`, `mod.rs`, `state.rs`, and `decoration.rs`. `density.rs` is a
  local addition.
- License: Apache-2.0. The crate's license file is `LICENSE-APACHE`, kept in
  this directory.

## Change 1: selection layer order

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
- The xtask test `vendor_patches::selection_layer_patch_is_applied`, in
  `xtask/src/vendor_patches.rs`, fails when `src/diff/selection.rs` lacks the
  `// GREPPA:` comment and the `layers.insert(0, (` line. It checks the
  source text, not the painted result.

## Change 2: opt-in review density

Files: new `src/diff/density.rs`, plus `src/diff/mod.rs` and `src/diff/state.rs`.
Every changed region has a `// GREPPA:` marker.

`Diff::density(DiffDensity)` accepts optional pixel values and opt-in flags. Pixel values
default to `None` and flags to `false`, so existing callers keep the upstream geometry.

| Setting | Effect | Default |
| --- | --- | --- |
| `row_height` | Code row height and layout hint | Font size multiplied by 1.6 |
| `number_padding` | Extra width after `font_size * 0.7 * digits` | One rem |
| `number_inset` | Number-cell padding and its selectable number's right inset | Existing outer `pr_1` and inner `px_1` styles |
| `marker_width` | Painted and measured comment-marker lane | One code row height |
| `indicator_width` | Sign or bar lane width | Existing `w_4` or `w_2` style |
| `bar_width` | Visible addition/removal bar | 3 px |
| `annotation_padding` | Native annotation padding on all sides | Existing `px_3` / `py_3` styles |
| `header_padding` | Native header-shell padding on all sides | Existing `pl_1` / `pr_3` / `py_1` styles |
| `whole_pixel_numbers` | Round number-column widths up to whole pixels | `false` |
| `omit_empty_number_columns` | Omit the unused column in an added or deleted file | `false` |
| `marker_gap` | Clear space on each side of the marker lane, including width measurement | No extra gap |
| `annotation_border` | Native annotation top and bottom border widths | Existing 1 px borders |
| `source_offset` | Move source ink and selection geometry together for optical alignment | No offset |
| `scrollbar_gutter` | Reserve separate right and bottom rails outside the shared code viewport | Overlay scrollbars |
| `custom_header_shell` | Let the host supply the complete file header, including collapse controls and borders | `false` |

When `number_padding` is set, digit measurement excludes collapsed files.
A collapsed generated file must not reserve four-digit gutters in a two-digit
reader. Expanded files still grow the gutter.

The layout cache key includes non-default density and the measured number width.
Changing density or expanding a file with wider numbers therefore refreshes layout.
`DiffState::number_column_width()` exposes that cached width for host annotations.
It returns `None` before a density layout exists. The host can align a comment's
left edge with the code even after the gutter grows.

Reason: the upstream fixed row factor, gutter lanes, and nested annotation padding
prevent compact desktop review layouts. Header-shell padding also adds to a host's
requested total header height. Optional settings let greppa remove those extra
layers without changing existing callers. Soft wrapping remains the existing
caller setting; this patch does not change wrapping, syntax, selection, or parsing.

Whole-pixel number widths and marker gaps let a host align code and note edges without
fractional bars or crowded dots. Omitting an unused number column preserves space in
one-sided files. Optional annotation borders let a host draw a continuous vertical rule
through the horizontal border rows, or a rounded bubble without an extra native frame.
An optional source offset aligns the first visible code glyph with a host's content column
without moving gutter lanes. The host still owns note contents, shapes, and padding. These options share the density
layout-cache key; callers that do not set them keep their original output.

Reserved scrollbar rails prevent horizontal thumbs from covering the last visible source row.
One list and one vertical scrollbar still serve every file. The host sizes annotations to the
remaining viewport. A complete host header shell lets pinned and in-list headers use the same
controls and viewport width, so trailing counts do not disappear beyond horizontally scrolling
code. Both options are opt-in; the default shell and overlay placement remain unchanged.

Only `crates/greppa-ui/src/viewer.rs` uses these settings. Its density test checks default
and explicit row heights, number widths, digit growth, and opt-in defaults. The scene
capture comparisons check the retained reference layouts. The published crate's own
test-fixture limitation described above still applies.

## Change 3: opt-in gutter-only decorations

Files: `src/diff/decoration.rs` and `src/diff/mod.rs`, in `code_line`. Every changed
region has a `// GREPPA:` marker.

`DiffDecoration::gutter_only()` limits a decoration's background to the row's leading
lanes: the left row padding, the line-number columns, and the marker lane with its gaps.
The lanes end where the change indicator starts. The change indicator and source then show
the last whole-row decoration covering the line, if any, over the stock change background.
`DiffDecoration::is_gutter_only()` reports the setting. A new decoration is whole-row, so
callers that never call `gutter_only()` keep the upstream single overlay.

The last supplied decoration still decides the gutter, so a gutter-only decoration
supplied after a file tint wins there. A selected line still shows the selection instead
of any decoration.

Reason: greppa marks a comment range in the gutter while the source keeps its added,
removed, or context background. A whole-row decoration hid that background, so the host
had to parse the patch again and repaint each source background from its marker. With
the scope in the renderer, the host passes the range and nothing else.

Only `crates/greppa-ui/src/viewer.rs` uses this setting. Its tests check the whole-row
default and the gutter-only comment ranges. The scene capture comparisons check that the
reference scenes keep every pixel. The published crate's own test-fixture limitation
described above still applies.
