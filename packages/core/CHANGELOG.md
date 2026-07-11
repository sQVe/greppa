# @greppa/core

## 0.1.1

### Patch Changes

- [#33](https://github.com/sQVe/greppa/pull/33)
  [`ad1a0d1`](https://github.com/sQVe/greppa/commit/ad1a0d11d00adb816cef14c4543ef63f335c79c0) Thanks
  [@sQVe](https://github.com/sQVe)! - Close server security and git diff gaps from the July 2026
  review:
  - Bind the HTTP server to 127.0.0.1 explicitly so the unauthenticated server is unreachable from
    non-loopback addresses.
  - Reject staged symlinks and path escapes in worktree file reads (lstat before read, resolved-path
    containment check).
  - Include untracked files in worktree review as additions via
    `git ls-files --others --exclude-standard -z`.
  - Parse `diff --name-status` with `-z` so filenames containing tabs or newlines survive intact.
  - Preserve numstat binary status (`-` no longer maps to 0), add an optional `binary` flag to
    `FileEntry`, and exclude binary files from diff warm-up.
