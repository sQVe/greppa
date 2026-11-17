# ADR 0011: greppa's capability modules live in one import table

**Date**: 2026-11-17\
**Status**: Accepted\
**Related**: [Shared ADR 0002 (Capability modules with a project-owned import table)](../stomme/shared/adr/0002-capability-modules.md), [Shared ADR 0010 (Recorded violations)](../stomme/shared/adr/0010-recorded-violations.md)

## Context

greppa's shared code sits in `greppa-core` and `greppa-ui`, and its app and build tasks sit outside
them. Shared ADR 0002 asks a project to name its capability modules and the directions between them
in one table, so every agent gets the same answer to where a shared file belongs and which module
may use it.

Without that table, a helper lands in whichever module a slice finds convenient, and a reader
cannot tell which file owns a concept. greppa also carries two shapes that the shared layout rules
reject, so the table needs a place to record them.

## Decision

greppa lists its capability modules in the `[modules]` table of `stomme.toml`, with one row per
module and one edge per allowed import.

### Modules

- `git` and `source` are modules in `greppa-core`.
- `parts`, `review`, `scenes`, `theme`, and `viewer` are modules in `greppa-ui`.
- `crates/greppa` holds only the app entry point, so it has no module row.

### Edges

- `source` uses `git`.
- `parts` uses `review` and `theme`.
- `review` uses `parts`.
- `scenes` uses `parts`, `review`, `theme`, and `viewer`.
- `viewer` uses `parts`, `review`, `scenes`, and `theme`.

### Mutual edges

Two pairs of edges are mutual on purpose.

`review` holds the review data and `parts` holds the widgets that render it. Each module uses types
from the other, and one direction alone would force one of those concepts into the wrong module.

`viewer` and the chosen direction scenes share that direction's tokens, syntax highlighting, and
profile until the direction scenes move out of `greppa-ui`. Splitting that shared material now would
copy it into both modules.

### Public files

The `public` lists name the extra files another module already uses, as shared ADR 0002 allows.
`parts` publishes `parts/review.rs`, `theme` publishes `theme/contrast.rs`, and `scenes` publishes
its direction files.

### Outside the table

`xtask` stays outside the table because its crate root holds `workspace_root`, which the
`crate-root-path` rule rejects. A follow-up adds its rows after that function moves into a module.

Two recorded violations keep the table honest until follow-ups remove them. The `greppa-scene`
binary breaks `rust-file-case`, and `crates/greppa` breaks `role-folder` because its folder does not
end in `-app`. The follow-ups move the binary and rename the crate to a name ending in `-app`. The
recorded list may only shrink.

## Consequences

### Positive

- One table answers where a shared file belongs and which module may use it.
- The check rejects an import that crosses the table, so the structure does not rely on review.
- The two violations are visible and bounded instead of silent exceptions.

### Negative

- The two mutual edges mean a reader cannot order the modules as a sequence.
- `xtask` stays outside the check until `workspace_root` moves into a module.
- The table carries the two recorded violations until the follow-ups land.

## Alternatives considered

### An import table written only in prose

Describe the modules and their edges in a document and rely on review. Rejected because agents copy
nearby code, and a rule without a check drifts.

### One module per crate

Give each capability its own crate and let Cargo's dependency graph hold the edges. Rejected because
`greppa-core` and `greppa-ui` each hold several capabilities that change together, and extra crates
add build targets without adding a boundary the check can read.
