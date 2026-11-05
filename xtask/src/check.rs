use std::path::Path;
use std::process::{Command, ExitCode};

use crate::raw_values;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Group {
    /// Checks whose result does not depend on the operating system.
    Tidy,
    Build,
}

enum Action {
    Command {
        program: &'static str,
        arguments: &'static [&'static str],
        environment: &'static [(&'static str, &'static str)],
    },
    RawValues,
}

struct Step {
    name: &'static str,
    group: Group,
    action: Action,
}

const DENY_WARNINGS: (&str, &str) = ("CARGO_BUILD_WARNINGS", "deny");

fn command(
    name: &'static str,
    group: Group,
    program: &'static str,
    arguments: &'static [&'static str],
    environment: &'static [(&'static str, &'static str)],
) -> Step {
    Step {
        name,
        group,
        action: Action::Command {
            program,
            arguments,
            environment,
        },
    }
}

fn steps() -> Vec<Step> {
    vec![
        command(
            "rustfmt",
            Group::Tidy,
            "cargo",
            &["fmt", "--all", "--check"],
            &[],
        ),
        Step {
            name: "raw-values",
            group: Group::Tidy,
            action: Action::RawValues,
        },
        command("typos", Group::Tidy, "typos", &[], &[]),
        command(
            "taplo",
            Group::Tidy,
            "taplo",
            &["fmt", "--check"],
            &[("RUST_LOG", "warn")],
        ),
        command(
            "cargo-deny",
            Group::Tidy,
            "cargo",
            &["deny", "--locked", "check"],
            &[],
        ),
        command(
            "cargo-shear",
            Group::Tidy,
            "cargo",
            &["shear", "--locked", "--deny-warnings"],
            &[],
        ),
        command(
            "clippy",
            Group::Build,
            "cargo",
            &["clippy", "--workspace", "--all-targets", "--locked"],
            &[DENY_WARNINGS],
        ),
        command(
            "nextest",
            Group::Build,
            "cargo",
            &["nextest", "run", "--workspace", "--locked"],
            &[DENY_WARNINGS],
        ),
        command(
            "doctests",
            Group::Build,
            "cargo",
            &["test", "--doc", "--workspace", "--locked"],
            &[DENY_WARNINGS],
        ),
        command(
            "rustdoc",
            Group::Build,
            "cargo",
            &["doc", "--workspace", "--no-deps", "--locked"],
            &[DENY_WARNINGS, ("RUSTDOCFLAGS", "-D warnings")],
        ),
    ]
}

fn parse_groups(arguments: &[String]) -> Result<Vec<Group>, String> {
    match arguments {
        [] => Ok(vec![Group::Tidy, Group::Build]),
        [group] if group == "tidy" => Ok(vec![Group::Tidy]),
        [group] if group == "build" => Ok(vec![Group::Build]),
        _ => Err(format!(
            "Unknown check arguments: {}. Use tidy, build, or none.",
            arguments.join(" ")
        )),
    }
}

#[expect(
    clippy::print_stderr,
    reason = "check progress and failures are the command's output"
)]
fn run_step(root: &Path, step: &Step) -> bool {
    eprintln!("==> {}", step.name);

    match &step.action {
        Action::Command {
            program,
            arguments,
            environment,
        } => {
            let status = Command::new(program)
                .args(*arguments)
                .envs(environment.iter().copied())
                .current_dir(root)
                .status();

            match status {
                Ok(status) => status.success(),
                Err(error) => {
                    eprintln!("Could not start {program}: {error}");
                    false
                }
            }
        }
        Action::RawValues => match raw_values::check(root) {
            Ok(()) => true,
            Err(message) => {
                eprintln!("{message}");
                false
            }
        },
    }
}

/// Runs every selected step, even after a failure, so one run shows every problem.
#[expect(
    clippy::print_stderr,
    reason = "check progress and failures are the command's output"
)]
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    let groups = match parse_groups(arguments) {
        Ok(groups) => groups,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    let failed: Vec<&str> = steps()
        .iter()
        .filter(|step| groups.contains(&step.group))
        .filter(|step| !run_step(root, step))
        .map(|step| step.name)
        .collect();

    if failed.is_empty() {
        eprintln!("All checks passed.");
        return ExitCode::SUCCESS;
    }

    eprintln!("Failed checks: {}", failed.join(", "));
    ExitCode::FAILURE
}
