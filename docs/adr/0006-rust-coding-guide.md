# ADR 0006: A Rust coding guide adapts Tau's coding rules

**Date**: 2026-11-05\
**Status**: Accepted\
**Related**: [ADR 0004 (Toolchain and quality gates)](./0004-toolchain-and-quality-gates.md),
[Rust coding guide](../coding.md),
[rust-analyzer style](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/style.md),
[Zed rules](https://github.com/zed-industries/zed/blob/main/.rules),
[GPUI Kit coding guides](https://github.com/longbridge/gpui-component/blob/main/website/docs/coding-guides.md),
[Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)

## Context

Agents write most of greppa's code, and Tau's coding instructions load in every session. Those
instructions were written for TypeScript. They say that repository conventions win when they differ.

Read literally, several Tau rules conflict with ordinary Rust and GPUI code. Tau bans every
abbreviation, but GPUI names its context `cx`, and trait methods require names such as `fmt`. Tau
asks to assign call chains and ternary expressions to variables, but Rust code combines computing
and deciding on purpose with `?`, `if let`, `let ... else`, and value-producing `match`. GPUI builds
elements as one fluent chain. Tau puts helpers before their callers, but Rust items are in scope in
the whole module.

Rust also brings concerns Tau does not cover: ownership, error types, module files, lint
suppression, and GPUI's entity and task lifetimes. The owner is new to Rust, so these rules must be
written down, short enough to follow, and concrete enough to check in review.

Published Rust guidance does not settle the details. rust-analyzer, Zed, the GPUI Kit, uv, Ruff,
Google, and Microsoft mostly agree on errors and borrowing. They disagree on short names, `mod.rs`
files, and how much rustdoc to write.

## Decision

greppa keeps Tau's coding instructions and adds `docs/coding.md`, which states only the Rust and
GPUI rules that override or add to them. A Tau rule the guide does not change applies as written,
so the guide never repeats one. The guide keeps one policy per item. Its reasons live in this ADR.

### Names

Names use full words, as Tau asks. The exceptions are GPUI's `cx` and `window`, with `window` before
`cx` as GPUI and Zed order them, names a standard or trait method requires, generic `T`, and short
lifetimes such as `'a`. These names are the vocabulary every GPUI and Rust example uses, so
expanding them makes greppa harder to compare with its sources. Other short names, such as `i`,
`buf`, and `tx`, gain nothing the full word lacks.

### Item order and modules

Items read top-down: public and high-level items first, private helpers after, as rust-analyzer
orders them. A reader meets what a module offers before how it works. The compiler does not need
helpers first, so Tau's helper-before-caller rule has no Rust reason behind it.

A module `foo` lives in `foo.rs`, and its children in `foo/`, as Zed requires. Many files named
`mod.rs` are hard to tell apart in editor tabs and search results.

### Errors

A failure that can happen at run time returns a `Result` and propagates with `?`. An error that
callers branch on gets its own `thiserror` type with data in fields, so callers and tests match a
variant instead of parsing text. App code that only reports an error uses `anyhow` with context,
because a new error type there would add code no caller reads. A panic marks a bug, and `expect`
says why the call cannot fail, so a panic message points at the broken assumption. A discarded
`Result` hides failures, as Zed's rules warn, so `let _ =` on a `Result` is not allowed.

### Statements

`?`, `if let`, `let ... else`, value-producing `if` and `match`, short iterator chains, and GPUI
fluent builders are written inline. They are the normal Rust and GPUI forms, and splitting them
would add names that carry no meaning. A long chain, or one whose result is a concept, still gets a
name, which keeps the purpose of Tau's rule.

### Function size

One job per function stays the rule. Tau's 60-line, 500-line, and 4-parameter limits stay review
signals. A GPUI `render` builder or an exhaustive `match` can be long and still do one job, and
splitting it to meet a number scatters one layout or one decision.

### Ownership

Functions borrow views such as `&str`, `&[T]`, and `&Path` to read, and take owned values to keep
them. The signature then shows who owns the data, and callers can pass any matching container. A
clone is a deliberate choice, because it can copy large data or share state. `redundant_clone`
catches some needless clones.

A lint suppression uses `#[expect(lint, reason = "...")]`. The compiler warns when the expected lint
no longer fires, so a stale suppression does not linger, and the reason tells the next reader why
the lint does not apply.

### Doc comments

Doc comments go only on items another crate uses, and state only errors, panics, and invariants the
name and types cannot show. greppa publishes no library, so full API documentation would mostly
restate signatures, which Tau's comment rules forbid.

### GPUI

The guide states the GPUI lifetime rules that Zed and the GPUI Kit document: use the inner `cx` in
an entity update, keep or deliberately detach `Task` and `Subscription` handles, use weak handles
from child to parent, keep `render` declarative and notify only on real changes, use stable IDs,
drop stale background results, and keep GPUI types out of `greppa-core`. Breaking each rule gives a
panic, lost work, a leak, a render loop, or a stale view that the compiler does not catch.

### Tests

Unit tests live in a `#[cfg(test)] mod tests` in the file that owns the behavior. Tests that use a
crate from outside go in a few targets under `tests/`, because Cargo links each file there as its
own binary. Case tables are plain loops, which need no dependency. Fakes replace only IO boundaries,
so tests run real logic. Tests match error variants and data, because `is_err()` passes for any
failure and message text changes with wording. Mutation survivors are advice, as in Tau.

### Lints

`print_stdout`, `print_stderr`, `allow_attributes_without_reason`, `should_panic_without_expect`,
and `redundant_clone` check parts of these rules. ADR 0004 lists how greppa adds single lints.

## Consequences

### Positive

- Agents and the owner get Rust rules that do not contradict the code they read and write.
- The guide stays short, because it holds only the differences from Tau's rules.
- Error and test rules let tests check what failed without depending on message wording.
- The GPUI rules name lifetime mistakes before they cause panics, leaks, or stale views.

### Negative

- A reader must combine two documents, Tau's coding instructions and this guide, to know every rule.
- When Tau's coding instructions change, the guide may need a matching change.
- Most rules cannot be checked by a lint, so review must check them.
- Typed errors and `expect` messages take more code than `unwrap` and string errors.

## Alternatives considered

### A full Rust guide that repeats Tau's rules

Write one guide that holds every rule, including those that carry over unchanged. Rejected because
Tau's coding instructions load in every session anyway, and two copies of a rule drift apart.

### Tau's coding instructions unchanged

Follow Tau's rules as written. Rejected because several of them, read literally, forbid normal Rust
and GPUI code, such as `cx`, `?` inside an expression, and fluent element builders.

### An external guide adopted whole

Adopt rust-analyzer's style guide, Microsoft's Rust guidelines, or Google's Rust guide as written.
Rejected because they disagree with each other on names, docs, and errors, and each was written for
a different kind of project, such as a published library or an IDE.

### Helpers before their callers

Keep Tau's order, with helpers declared first. Rejected because Rust does not need it, and the
top-down order shows what a module offers first.

### `mod.rs` files

Store a module with children in `foo/mod.rs`. Rejected because many files share the name `mod.rs`,
which makes editor tabs and search results hard to read.

### Size limits as lints

Set clippy's `too_many_lines` and `too_many_arguments` thresholds to Tau's numbers. Rejected because
GPUI builders and exhaustive matches would trip them while still doing one job, and the fixes would
scatter code to meet a number.

### `missing_docs` and full rustdoc

Turn on the `missing_docs` lint, as Bevy and Tokio do. Rejected because greppa publishes no library,
and the lint would force comments that restate names.

### Lints that ban `unwrap` and `expect`

Turn on `unwrap_used` and `expect_used`. Rejected because a panic is the right response to a bug,
and `expect` with a reason documents the assumption.

### One error style everywhere

Use only `thiserror` types, or only `anyhow`. Rejected because callers that branch need typed
variants, while app code that only reports an error gains nothing from a new type.

### Test case libraries and mocking frameworks

Use `rstest` for case tables and `mockall` for fakes. Deferred because plain loops and small trait
fakes cover greppa's tests today, and each library is one more dependency.
