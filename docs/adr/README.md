# Architecture decision records

Record lasting decisions and the reasons behind them, not how a feature works.

## Writing ADRs

Follow [shared ADR 0001](../stomme/shared/adr/0001-documentation-scope.md) for documentation scope,
the ADR process, and what a document may contain. Open the [template](./TEMPLATE.md) before you
write. An ADR is not a feature summary, implementation plan, or acceptance checklist. A new ADR is
Accepted. Numbers are never reused. The Retired table keeps each retired ADR's last commit, and
`git show <commit>:docs/adr/<file>` restores the file.

## Index

### Platform and UI

- [0002: Native app in Rust with GPUI](./0002-native-rust-gpui.md)
- [0003: Diff viewer on gpui-component's `Diff`](./0003-diff-viewer-on-gpui-component.md)
- [0005: Two AI judges from different model families gate UI mocks](./0005-two-ai-judges-gate-ui-mocks.md)
- [0007: greppa supports Linux and macOS, not Windows](./0007-linux-and-macos-only.md)
- [0009: QA in a private Xwayland sandbox](./0009-qa-in-a-private-xwayland-sandbox.md)

### Project and toolchain

- [0004: Toolchain and quality gates](./0004-toolchain-and-quality-gates.md)
- [0008: Dev builds keep line tables only, and dependencies keep no debug info](./0008-dev-builds-keep-line-tables-only.md)
- [0010: greppa reads Git through the `git` command](./0010-git-through-the-git-command.md)
- [0011: greppa's capability modules live in one import table](./0011-capability-modules-in-one-import-table.md)
- [0012: greppa keeps only its own rules beside the shared guides](./0012-project-rules-beside-the-shared-guides.md)

## Retired

| ADR | Title | Replaced by | Last commit |
| --- | ----- | ----------- | ----------- |
| 0001 | Documentation scope | [Stomme shared ADR 0001](../stomme/shared/adr/0001-documentation-scope.md) | 7dc9ea4bd8e99c38213ac01c35e1b6f0aa66f1f7 |
| 0006 | A Rust coding guide adapts Tau's coding rules | [Stomme shared coding guide](../stomme/shared/coding.md) | 7dc9ea4bd8e99c38213ac01c35e1b6f0aa66f1f7 |
