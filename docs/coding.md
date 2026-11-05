# Rust coding guide

Apply these rules with Tau's coding instructions to every Rust file in greppa, tests included. Where
the two differ, this guide wins. A Tau rule this guide does not change applies as written. The
reasons behind each rule are in [ADR 0006](./adr/0006-rust-coding-guide.md).

## Names

These names are exceptions to Tau's full-word naming rule.

- Name a GPUI context `cx` and a GPUI window `window`. Put `window` before `cx` in a parameter list.
- Keep a name that a standard or trait method requires, such as `fmt`.
- Use `T` for a generic type parameter and short names such as `'a` for lifetimes.

## Item order and modules

- Order items top-down: public and high-level items first, private helpers after the items that use
  them. This replaces Tau's rule to declare a helper before its caller.
- Store module `foo` in `foo.rs`, and its child modules in `foo/`. Never create `foo/mod.rs`.

## Errors

- Return a `Result` and propagate it with `?` for a failure that can happen at run time, such as bad
  input, a missing file, or a failed Git command.
- Give an error its own type, derived with `thiserror`, when a caller branches on what failed. Put
  the data a caller needs in fields, not only in the message.
- Count a test that tells failures apart as a caller that branches.
- In app code that only reports an error, use `anyhow::Result` and add context with `.context(...)`
  or `.with_context(...)`. App code is `main` and the code that only passes errors up to it.
- Treat `xtask` as app code: its tasks report errors with `anyhow`, not with `String`.
- Import anyhow's trait as `use anyhow::Context as _;`, because GPUI exports a type named
  `Context`.
- Panic only on a bug. Use `expect` with a message that says why the call cannot fail, such as
  `.expect("a known scene name parses")`.
- Never discard a `Result`. `let _ =`, `_ =`, `drop(result)`, and an unused `.ok()` all discard it.
  Propagate it, or handle the error in a `match` or `if let Err(error)`.
- In `Drop`, where no caller can take a cleanup error, print it with `eprintln!` inside
  `if let Err(error)`. Put `#[expect(clippy::print_stderr, reason = "...")]` on the `drop` method.

## Statements and expressions

- Write these forms inline: `?`, `if let`, `let ... else`, an `if` or `match` that produces a value,
  and a short iterator chain such as `names.iter().any(...)`. This replaces Tau's rules on call
  chains and ternary expressions.
- Write GPUI element builders as one fluent chain, with `.when(...)`, `.when_some(...)`, and
  `.child(...)` for conditional and nested parts.
- Name a chain with its own `let` when it is long, or when its result is a concept the reader should
  see by name, such as the rows a `for` loop walks.
- Use an `Option<T>` field for an optional value, and `.when_some(...)` for an optional GPUI child.
  Tau's spread rules do not apply to Rust.

## Function size

- Do not split an exhaustive `match` or a GPUI builder chain only to meet Tau's size review signals.

## Ownership

- Borrow a view to read: take `&str`, `&[T]`, and `&Path`, not `&String`, `&Vec<T>`, and `&PathBuf`.
- Take an owned value, such as `String`, `Vec<T>`, or `PathBuf`, when the function keeps it. Do not
  borrow and then clone inside.
- Clone on purpose. Before you write `.clone()`, check whether a move or a shorter borrow works.
- Suppress a lint with `#[expect(lint, reason = "...")]` on the smallest item that needs it. Use
  `#[allow(lint, reason = "...")]` only where the lint fires in some builds and not in others.

## Doc comments

- Write `///` doc comments only on items another crate uses.
- In a doc comment, state only errors, panics, and invariants the name and types cannot show.

## GPUI

- Inside `entity.update(cx, |state, cx| ...)`, use the closure's `state` for the entity's data and
  the closure's `cx` for GPUI calls.
- Never read or update an entity through its handle while that entity is being updated. GPUI panics
  with "cannot update T while it is already being updated", or "cannot read" for a read.
- Await a `Task`, store it in its owner, or call `.detach()` on purpose. Dropping a `Task` cancels
  its work. Detaching gives up both cancellation and the result.
- Store a `Subscription` in its owner, or call `.detach()` on purpose. Dropping a `Subscription`
  ends it.
- Never write `let _ =` on a `Task` or `Subscription`. `_` drops it at once, and `let _task = ...`
  keeps it only to the end of the scope.
- Give a child that refers to its parent a `WeakEntity`, never an `Entity`. Treat a failed
  `upgrade()` as normal: the parent is gone.
- Keep `render` declarative: read state, derive values, and build elements. Do not start work,
  subscribe, or change state in `render`.
- Call `cx.notify()` once after a change to what the view shows. Never call it from `render`.
- Build element IDs from stable domain data, such as a file path. Never use a list index as an ID.
- When background work finishes, check that the state it started from is still current, such as the
  same selected file. Drop the result when it is not.
- Keep GPUI types out of `greppa-core`. It takes and returns plain greppa data.

## Tests

- Put unit tests in a `#[cfg(test)] mod tests` at the end of the file that owns the behavior.
- Put a test that uses a crate from the outside in that crate's `tests/`. Keep as few targets as
  possible, usually one, such as `tests/integration/main.rs` with modules. Cargo builds each file in
  `tests/` as its own binary.
- Write a case table as an array and a plain `for` loop. Name the case in the assert message.
- Fake only an IO boundary, such as Git, the file system, or the clock, with a small trait the
  production code takes. Do not add a trait only to fake pure code.
- Assert the error variant and its data with `assert!(matches!(...))` or `assert_eq!`, never only
  `is_err()`. Do not compare a human-readable message unless its exact text is a contract.
- Use `#[should_panic(expected = "...")]` only for code that panics on purpose.
- Treat a surviving mutant from `cargo xtask mutation` as advice, as Tau does.
