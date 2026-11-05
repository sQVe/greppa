use std::path::Path;
use std::process::{Command, ExitCode};

use thiserror::Error;

use crate::raw_values;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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

#[derive(Debug, Error, PartialEq, Eq)]
#[error("Unknown check arguments: {}. Use tidy, build, or none.", arguments.join(" "))]
struct UnknownArguments {
    arguments: Vec<String>,
}

fn parse_groups(arguments: &[String]) -> Result<Vec<Group>, UnknownArguments> {
    match arguments {
        [] => Ok(vec![Group::Tidy, Group::Build]),
        [group] if group == "tidy" => Ok(vec![Group::Tidy]),
        [group] if group == "build" => Ok(vec![Group::Build]),
        _ => Err(UnknownArguments {
            arguments: arguments.to_vec(),
        }),
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
            Err(error) => {
                eprintln!("{error:#}");
                false
            }
        },
    }
}

/// Runs every selected step, even after a failure, so one run shows every problem.
fn failed_steps<'a>(root: &Path, steps: &'a [Step], groups: &[Group]) -> Vec<&'a str> {
    steps
        .iter()
        .filter(|step| groups.contains(&step.group))
        .filter(|step| !run_step(root, step))
        .map(|step| step.name)
        .collect()
}

#[expect(
    clippy::print_stderr,
    reason = "check progress and failures are the command's output"
)]
fn check_steps(root: &Path, steps: &[Step], groups: &[Group]) -> ExitCode {
    let failed = failed_steps(root, steps, groups);

    if failed.is_empty() {
        eprintln!("All checks passed.");
        return ExitCode::SUCCESS;
    }

    eprintln!("Failed checks: {}", failed.join(", "));
    ExitCode::FAILURE
}

#[expect(
    clippy::print_stderr,
    reason = "check progress and failures are the command's output"
)]
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    let groups = match parse_groups(arguments) {
        Ok(groups) => groups,
        Err(error) => {
            eprintln!("{error}");
            return ExitCode::FAILURE;
        }
    };

    check_steps(root, &steps(), &groups)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn shell_step(name: &'static str, arguments: &'static [&'static str]) -> Step {
        command(name, Group::Tidy, "/bin/sh", arguments, &[])
    }

    fn names(group: Group) -> Vec<&'static str> {
        steps()
            .into_iter()
            .filter(|step| step.group == group)
            .map(|step| step.name)
            .collect()
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn steps_group_every_check() {
        assert_eq!(
            names(Group::Tidy),
            [
                "rustfmt",
                "raw-values",
                "typos",
                "taplo",
                "cargo-deny",
                "cargo-shear"
            ]
        );
        assert_eq!(
            names(Group::Build),
            ["clippy", "nextest", "doctests", "rustdoc"]
        );
    }

    #[test]
    fn steps_lock_cargo_and_deny_build_warnings() {
        for step in steps() {
            let Action::Command {
                program,
                arguments,
                environment,
            } = step.action
            else {
                continue;
            };

            if program == "cargo" && step.name != "rustfmt" {
                assert!(arguments.contains(&"--locked"), "{} is locked", step.name);
            }

            if step.group == Group::Build {
                assert!(
                    environment.contains(&DENY_WARNINGS),
                    "{} denies warnings",
                    step.name
                );
            }

            if step.name == "rustdoc" {
                assert!(environment.contains(&("RUSTDOCFLAGS", "-D warnings")));
            }
        }
    }

    #[test]
    fn parse_groups_selects_groups() {
        let cases = [
            (vec![], vec![Group::Tidy, Group::Build]),
            (strings(&["tidy"]), vec![Group::Tidy]),
            (strings(&["build"]), vec![Group::Build]),
        ];

        for (arguments, expected) in cases {
            assert_eq!(parse_groups(&arguments), Ok(expected), "{arguments:?}");
        }
    }

    #[test]
    fn parse_groups_rejects_unknown_arguments() {
        for arguments in [strings(&["lint"]), strings(&["tidy", "build"])] {
            assert_eq!(
                parse_groups(&arguments),
                Err(UnknownArguments {
                    arguments: arguments.clone()
                }),
                "{arguments:?}"
            );
        }
    }

    #[test]
    fn run_fails_on_unknown_arguments() {
        let root = crate::test_support::temporary_directory();

        assert_eq!(run(root.path(), &strings(&["lint"])), ExitCode::FAILURE);
    }

    #[test]
    fn check_steps_fails_when_a_step_fails_and_runs_later_steps() {
        let root = crate::test_support::temporary_directory();
        let steps = [
            shell_step("fails", &["-c", "exit 7"]),
            shell_step("later", &["-c", "touch later"]),
        ];

        assert_eq!(
            check_steps(root.path(), &steps, &[Group::Tidy]),
            ExitCode::FAILURE
        );
        assert!(root.path().join("later").exists());
    }

    #[test]
    fn run_step_fails_when_its_program_exits_non_zero() {
        let root = crate::test_support::temporary_directory();

        assert!(run_step(
            root.path(),
            &shell_step("passes", &["-c", "exit 0"])
        ));
        assert!(!run_step(
            root.path(),
            &shell_step("fails", &["-c", "exit 7"])
        ));
    }

    #[test]
    fn run_step_fails_when_its_program_does_not_exist() {
        let root = crate::test_support::temporary_directory();
        let step = command(
            "missing",
            Group::Tidy,
            "/nonexistent/greppa-missing-program",
            &[],
            &[],
        );

        assert!(!run_step(root.path(), &step));
    }

    #[test]
    fn run_step_runs_in_the_root_with_its_environment() {
        let root = crate::test_support::temporary_directory();
        let step = command(
            "environment",
            Group::Tidy,
            "/bin/sh",
            &[
                "-c",
                r#"test -f marker && test "$GREPPA_CHECK_VALUE" = expected"#,
            ],
            &[("GREPPA_CHECK_VALUE", "expected")],
        );

        fs::write(root.path().join("marker"), "").expect("write the marker");

        assert!(run_step(root.path(), &step));
    }

    #[test]
    fn failed_steps_runs_every_selected_step_after_a_failure() {
        let root = crate::test_support::temporary_directory();
        let steps = [
            shell_step("fails", &["-c", "exit 1"]),
            shell_step("later", &["-c", "touch later"]),
            command(
                "build",
                Group::Build,
                "/bin/sh",
                &["-c", "touch build"],
                &[],
            ),
        ];

        let failed = failed_steps(root.path(), &steps, &[Group::Tidy]);

        assert_eq!(failed, ["fails"]);
        assert!(root.path().join("later").exists());
        assert!(!root.path().join("build").exists());
    }
}
