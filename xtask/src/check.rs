use std::path::Path;
use std::process::{Command, ExitCode};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Group {
    /// Checks whose result does not depend on the operating system.
    Tidy,
    Build,
}

struct Step {
    name: &'static str,
    group: Group,
    program: &'static str,
    arguments: &'static [&'static str],
    environment: &'static [(&'static str, &'static str)],
}

const DENY_WARNINGS: (&str, &str) = ("CARGO_BUILD_WARNINGS", "deny");

const STEPS: &[Step] = &[
    Step {
        name: "rustfmt",
        group: Group::Tidy,
        program: "cargo",
        arguments: &["fmt", "--all", "--check"],
        environment: &[],
    },
    Step {
        name: "typos",
        group: Group::Tidy,
        program: "typos",
        arguments: &[],
        environment: &[],
    },
    Step {
        name: "taplo",
        group: Group::Tidy,
        program: "taplo",
        arguments: &["fmt", "--check"],
        environment: &[("RUST_LOG", "warn")],
    },
    Step {
        name: "cargo-deny",
        group: Group::Tidy,
        program: "cargo",
        arguments: &["deny", "--locked", "check"],
        environment: &[],
    },
    Step {
        name: "cargo-shear",
        group: Group::Tidy,
        program: "cargo",
        arguments: &["shear", "--locked", "--deny-warnings"],
        environment: &[],
    },
    Step {
        name: "clippy",
        group: Group::Build,
        program: "cargo",
        arguments: &["clippy", "--workspace", "--all-targets", "--locked"],
        environment: &[DENY_WARNINGS],
    },
    Step {
        name: "nextest",
        group: Group::Build,
        program: "cargo",
        arguments: &["nextest", "run", "--workspace", "--locked"],
        environment: &[DENY_WARNINGS],
    },
    Step {
        name: "doctests",
        group: Group::Build,
        program: "cargo",
        arguments: &["test", "--doc", "--workspace", "--locked"],
        environment: &[DENY_WARNINGS],
    },
    Step {
        name: "rustdoc",
        group: Group::Build,
        program: "cargo",
        arguments: &["doc", "--workspace", "--no-deps", "--locked"],
        environment: &[DENY_WARNINGS, ("RUSTDOCFLAGS", "-D warnings")],
    },
];

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

fn run_step(root: &Path, step: &Step) -> bool {
    eprintln!("==> {}", step.name);

    let status = Command::new(step.program)
        .args(step.arguments)
        .envs(step.environment.iter().copied())
        .current_dir(root)
        .status();

    match status {
        Ok(status) => status.success(),
        Err(error) => {
            eprintln!("Could not start {}: {error}", step.program);
            false
        }
    }
}

/// Runs every selected step, even after a failure, so one run shows every problem.
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    let groups = match parse_groups(arguments) {
        Ok(groups) => groups,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    let failed: Vec<&str> = STEPS
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
