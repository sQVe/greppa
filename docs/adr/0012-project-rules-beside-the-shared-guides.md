# ADR 0012: greppa keeps only its own rules beside the shared guides

**Date**: 2026-11-17\
**Status**: Accepted\
**Related**: [Shared coding guide](../stomme/shared/coding.md), [Rust guide](../stomme/languages/rust/guide.md), [ADR 0004 (Toolchain and quality gates)](./0004-toolchain-and-quality-gates.md)

## Context

The shared coding guide, the Rust guide, and the GPUI layer guides state greppa's coding rules. A
project guide that repeats them drifts when a shared rule changes. Two rules have no shared
equivalent: how `xtask` reports errors, and where a test gets its file system folder.

## Decision

greppa keeps no coding guide of its own. The shared guides state its coding rules, and this ADR
holds the two rules that are greppa's own.

### xtask errors

`xtask` counts as app code. Its tasks report errors with `anyhow`, because a task only passes the
error to the person who ran it. An `xtask` error that a test tells apart gets a `thiserror` type,
because the test matches a variant instead of message text.

### Test folders

A test that touches the file system gets its folder from `tempfile`, whose guard removes the folder
even when the test panics. In `xtask`, the test gets its folder through `xtask/src/test_support.rs`,
so the crate keeps one helper.

### Rules held elsewhere

Every other coding rule greppa held is stated by the shared guides or by ADR 0003 and ADR 0004.

### Known gap

`greppa-ui` reaches gpui-component components through the `gpui-kit` bundle crate. The
`gpui-component-kit` rule reads direct dependencies only, so it cannot see the components behind the
bundle. A follow-up adds a `kit` role or a clippy ban. Until then this is a gap, not a decision.

## Consequences

### Positive

- Each coding rule has one home, so a shared change does not leave a project copy behind.
- The two greppa-specific rules keep a written reason.

### Negative

- A reader must follow the shared guides and this ADR to know every greppa rule.
- The `gpui-kit` path stays unchecked until the follow-up.

## Alternatives considered

### Keep a project coding guide for the two rules

Keep a small project guide that holds only the two rules. Rejected because a project guide beside
the shared guides drifts, and the two rules fit one short ADR.

### Put the rules in `AGENTS.md`

State the two rules in the agent instructions. Rejected because instructions say what to do, while
an ADR keeps the lasting reason beside the rule.

### Rely on the shared guides alone

State neither rule and let the shared guides cover them. Rejected because neither rule has a shared
equivalent, so the rule would be lost.
