# ADR 0003: Diff viewer on gpui-component's `Diff`

**Date**: 2026-11-04\
**Status**: Accepted\
**Related**: [ADR 0002 (Native app in Rust with GPUI)](./0002-native-rust-gpui.md)

## Context

A review needs a side-by-side diff where a drag copies exactly one side, word and line selection
work, scrolling stays smooth, and character-level change highlights stay visible inside a
selection. The GPUI proof of concept tested two ways to build it. Its `VERDICT.md` holds the result,
and its `README.md` holds the tests and method limits.

gpui-component's `Diff` met every criterion after one patch. Unpatched, it painted the selection
over the change highlights. The patch moves the selection layer under the highlight layers. The
proof of concept records it in `vendor/gpui-component/PATCHES.md`.

`Diff` already has a unified view, context folding, file headers, line annotations, and gutter
markers. A custom split renderer on gpui-base's selection engine also met the selection criteria,
but it was about 1,600 lines, blocked the first frame on syntax highlighting, and depended on
internals of gpui-base. Smooth scrolling on a real display was not verified for it.

## Decision

greppa's diff viewer is built on gpui-component's `Diff`, from a vendored and patched copy that
greppa treats as its own code.

### Vendored copy

- greppa vendors gpui-component and patches it, starting with the patch that keeps change
  highlights visible inside a selection.
- Each local patch is recorded next to the vendored code with its reason, so it can be kept on an
  update. A `// GREPPA:` comment marks each patch in the code, so a search finds every local
  change.
- Apart from its patches, the vendored copy is the published crate unchanged. The import and each
  patch land in separate commits, so a review reads only the patches.
- greppa offers generic patches upstream, but does not wait for them.

### One boundary

- One greppa module talks to `Diff`. The rest of greppa passes files, comments, and themes to it in
  greppa's own types, and gets selections and clicks back in greppa's own types.
- No other module imports `Diff` or its types. A switch to a fork or to a custom renderer then stays
  a change inside that module.

### Known limits

- `Diff` cannot anchor a comment to a span inside a line. Its selected text has no offsets, and its
  decorations color whole lines. A patch must expose the selected range and add a character-range
  highlight layer. This is not built or measured.
- `Diff` renders annotations beneath a line, not as widgets inside the text.
- `Diff` reads unified patches, not old and new strings, so greppa produces patches from Git.

## Consequences

### Positive

- The viewer starts with unified view, folding, file headers, annotations, and gutter markers that
  greppa does not have to build.
- Little viewer code to own beyond the boundary module and the patches.
- The boundary keeps the custom renderer open as a fallback.

### Negative

- Every gpui-component update must carry greppa's patches forward.
- With the selection patch, a background from a custom syntax highlighter also paints over the
  selection.
- Comments on a span inside a line need more patches to `Diff`, with unknown cost.
- The boundary module translates between greppa's types and `Diff`'s types, which adds code.
- The unified view with selection, review comment widgets, and custom themes were not tested in the
  proof of concept.

## Alternatives considered

### Custom renderer on gpui-base

Own the whole renderer, as the second path of the proof of concept did. Deferred because it must
rebuild what `Diff` already has, blocks the first frame on highlighting, and depends on internals of
gpui-base. It stays the fallback if `Diff` cannot meet a later need.

### Stock gpui-component without a vendored copy

Use the published crate and wait for upstream fixes. Rejected because the stock `Diff` hides change
highlights inside a selection, and span comments need patches that upstream may not take.
