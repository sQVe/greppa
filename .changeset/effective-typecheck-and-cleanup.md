---
---

Tooling-only: root `typecheck` now runs `tsc -b --pretty false` so every package is actually checked
(adds the missing `core` project reference and fixes stale `typeof RepoPath` requirements the
effective typecheck surfaced). Moves `onlyBuiltDependencies` and `peerDependencyRules` from
`package.json` to `pnpm-workspace.yaml` for pnpm 10. Quiets expected connection failures and Happy
DOM abort stacks in tests via a shared setup file with a strict fetch mock.
