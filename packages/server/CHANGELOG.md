# @greppa/server

## 0.1.1

### Patch Changes

- [#26](https://github.com/sQVe/greppa/pull/26)
  [`a6d17ff`](https://github.com/sQVe/greppa/commit/a6d17ff73c4556d1b6967d17188a3649e295eb04) Thanks
  [@sQVe](https://github.com/sQVe)! - Wire the fallow audit gate into CI and stabilise the warm-up
  cancellation integration test:
  - `.github/workflows/ci.yml`: replace the `fallow-rs/fallow` action with a direct
    `pnpm exec fallow audit --changed-since ${PR_BASE}` step. The action only invokes `dead-code` /
    `dupes` / `health` (or bare combined mode) and never `fallow audit`, so the per-analysis
    baselines configured under `audit:` in `.fallowrc.json` were never applied — pre-existing
    baselined findings tripped `fail-on-issues`.
  - `.fallowrc.json`: ignore `@ast-grep/cli` (binary CLI used via the `lint:rules` npm script, not
    imported), and refresh the dupes baseline for the line-number shift introduced below.
  - `packages/server/src/Http.integration.test.ts`: the warm-up cancel-mid-flight test was
    deadlocking. `reader.cancel()` on Effect's HTTP stream waits for fiber interruption, which
    itself waits for in-flight concurrent git child processes' finalizers — unbounded under load.
    Bound the wait with `Promise.race`; the test still verifies the server delivers a chunk and
    accepts the cancel signal.

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

- Updated dependencies
  [[`ad1a0d1`](https://github.com/sQVe/greppa/commit/ad1a0d11d00adb816cef14c4543ef63f335c79c0)]:
  - @greppa/core@0.1.1
