# @greppa/web

## 0.2.0

### Minor Changes

- [#28](https://github.com/sQVe/greppa/pull/28)
  [`8ddfcaf`](https://github.com/sQVe/greppa/commit/8ddfcafe2118061a6415985a13efe73a74ec90ae) Thanks
  [@sQVe](https://github.com/sQVe)! - Add per-section file filter and per-commit reviewed track:
  - Each tree section (Changes, Working tree, Commits) renders a `FileFilterBar` with a search input
    plus a funnel popover for extension, change-type, and reviewed-status facets. Filter state is
    ephemeral per section and resets on reload.
  - File rows show a checkmark + dimmed style when reviewed across all three sections.
  - Mark Reviewed on a commit-source file routes to a new `reviewedCommitFiles` track keyed by
    `sha:path`; reviewing a path in commit A no longer marks it in commit B or in Changes.
  - Matching directories auto-expand via a transient overlay so clearing the filter restores the
    user's prior expansion exactly; persisted `collapsedPaths` is untouched.
  - StatusBar gains an "X / Y visible" segment when a section's filter is active and now reflects
    the per-commit reviewed count in the Commits view.
  - Commit rows annotate `(n / m matching)` when filtered; commits with zero matches dim.
    Shift-range selection over commit files now respects the filtered visible list.
  - Persisted review state merges with current defaults so adding new schema fields no longer drops
    users back to defaults.

### Patch Changes

- [#25](https://github.com/sQVe/greppa/pull/25)
  [`8ccacc1`](https://github.com/sQVe/greppa/commit/8ccacc1b3bd566d32e07abad436b03c02f45f307) Thanks
  [@sQVe](https://github.com/sQVe)! - Fix per-file commit selection edge cases:
  - `/commits` route now preserves file-only selections — previously a state with `commitFile` but
    no `commits` would redirect to `/changes`.
  - Expanded commits with no files retain their selection highlight instead of disappearing.
  - Replace racy time-based pointer suppression with a deterministic boolean flag cleared on the
    next microtask.
