# @greppa/web

## 0.1.1

### Patch Changes

- [#25](https://github.com/sQVe/greppa/pull/25)
  [`8ccacc1`](https://github.com/sQVe/greppa/commit/8ccacc1b3bd566d32e07abad436b03c02f45f307) Thanks
  [@sQVe](https://github.com/sQVe)! - Fix per-file commit selection edge cases:
  - `/commits` route now preserves file-only selections — previously a state with `commitFile` but
    no `commits` would redirect to `/changes`.
  - Expanded commits with no files retain their selection highlight instead of disappearing.
  - Replace racy time-based pointer suppression with a deterministic boolean flag cleared on the
    next microtask.
