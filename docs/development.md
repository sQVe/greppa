# Development

## Set up

1. Install [rustup](https://rustup.rs). The first `cargo` command in the repository installs the
   toolchain that `rust-toolchain.toml` pins.
2. Install the check tools:

   ```sh
   cargo install --locked cargo-nextest cargo-deny cargo-shear cargo-mutants typos-cli taplo-cli prek
   ```

3. Install the Git hooks:

   ```sh
   prek install
   ```

## Workspace

- `crates/greppa-core` holds review logic: diffs, line ranges, and review state. It never depends on
  GPUI, so it builds and tests without a display or GPU.
- `crates/greppa-ui` holds the GPUI views.
- `crates/greppa` is the app binary. `cargo run` starts it.
- `xtask` holds repository tasks, run as `cargo xtask <task>`.

## Check your work

Run every check before you open a pull request:

```sh
cargo xtask check
```

It changes no files. It runs rustfmt, typos, taplo, cargo-deny, cargo-shear, clippy, nextest,
doctests, and rustdoc, and reports every failed check at the end. Warnings fail clippy, the tests,
and rustdoc. Every Cargo build runs with `--locked`, so a stale `Cargo.lock` fails too.

`cargo xtask check tidy` runs only the checks that do not compile code. `cargo xtask check build`
runs only the ones that do.

Fix problems with these commands:

| Problem | Command |
|---|---|
| Rust formatting | `cargo fmt --all` |
| TOML formatting | `taplo fmt` |
| Spelling | `typos --write-changes` |
| Unused dependencies | `cargo shear --fix` |
| Some clippy warnings | `cargo clippy --workspace --all-targets --fix` |

The pre-commit hook runs rustfmt, clippy, typos, and taplo, but only in check mode. Run the fix
commands yourself.

## Mutation testing

Mutation testing changes the code in small ways and reports each change that no test catches.
`cargo xtask mutation` runs [cargo-mutants](https://mutants.rs) and prints one JSON report on stdout
in the format Tau's `mutation_check` tool reads.

```sh
cargo xtask mutation changed main

cargo xtask mutation audit crates/greppa-core/src/lib.rs

cargo xtask mutation changed main --max-mutants 50
```

`.cargo/mutants.toml` leaves out the app binary, `xtask`, and test helpers. A missed mutant is a
survivor: add a test that fails when that line changes. The command exits 0 when every mutant is
caught, 2 for survivors in changed mode, and 1 for an error or an unmutated file. cargo-mutants
writes its logs to `target/mutants/mutants.out`.

## CI

`.github/workflows/ci.yml` runs on pull requests, on pushes to `main`, and weekly, so new security
advisories fail cargo-deny without a code change.

- `Check` runs `cargo xtask check tidy` on Linux.
- `Test (Linux)`, `Test (macOS)`, and `Test (Windows)` run `cargo xtask check build`.

Only runs on `main` save the build cache. Renovate updates dependencies, actions, and the toolchain
every Monday, after a release is three days old.
