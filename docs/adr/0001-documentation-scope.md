# ADR 0001: Documentation scope

**Date**: 2026-11-04\
**Status**: Accepted

## Context

Feature pages duplicate behavior defined in code and tests. Maintaining both lets prose drift from
behavior.

Code shows what a feature does, but not always why it was designed that way. greppa records those
lasting reasons in ADRs.

## Decision

greppa documents decisions, not features. greppa writes no feature pages, because ADRs record
decisions, and code states behavior.

### Where content lives

- ADRs record lasting decisions and their reasons. Include only the details needed to understand or
  follow the decision.
- Code and tests state behavior.
- `docs/` holds only what no feature owns: the documentation index, the development guide, the
  coding guide, and the ADRs.
- The root README introduces the project and links to the rest. Topic details go in `docs/` and are
  linked from the [documentation index](../README.md).
- A record of local changes to vendored code lives next to that code. It states what each change
  does and why, so the change can be kept on an update or offered upstream. It describes no
  feature.
- `.pi/qa.md` tells QA agents how to reach, drive, and check greppa in the sandbox. It may link
  feature recipes under `.pi/qa/`. They give test commands and visible results, not how a feature
  works. Update them in the change that alters what they test.

### Adding and changing documents

Do not add a page that explains how a feature works. Write an ADR only for a choice with a lasting
reason and a credible alternative.

An ADR states the current decision. When its details change, edit the ADR in place. Supersede it
only when the core choice reverses. The new ADR then states the whole current rule, so a reader
never has to combine two ADRs.

The only status is Accepted. A retired ADR leaves the tree. The metadata is Date, Status, and at
most one Supersedes line and one Related line.

In ADRs and `docs/`, do not write ticket IDs, benchmark tables, version numbers, or file lists that
go stale. Name a file only when the decision is about that file, or when it holds the evidence an
ADR rests on.

The [index](./README.md) groups current ADRs by area and ends with a Retired table. Numbers are
never reused. Git keeps the history, and `git show <commit>:docs/adr/<file>` restores a retired ADR.

## Consequences

### Positive

- Fewer descriptions of behavior to keep in sync with code.

### Negative

- Readers who want current behavior must read the code.
- A reader who wants a guided tour of a feature does not get one.
- Every change to a decision must update its ADR in the same change, or the ADR drifts from the
  code.
- The reasoning behind an earlier version of a decision lives only in Git history.

## Alternatives considered

### A page per feature

Keep a page per feature under `docs/`. Rejected because it gives readers a guide, but duplicates
behavior defined in code and can drift as the code changes.

### A new ADR for every change

Keep each ADR as written and record every change in a new ADR that supersedes it. Rejected because
it builds chains of superseded ADRs, and a reader must combine several files to find the current
rule.
