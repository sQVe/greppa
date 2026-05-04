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
