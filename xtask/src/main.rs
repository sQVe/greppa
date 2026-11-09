mod check;
mod mock;
mod mutation;
mod raw_values;
#[cfg(target_os = "linux")]
mod ruta;
#[cfg(target_os = "linux")]
mod scene;
#[cfg(test)]
mod test_support;

use std::path::{Path, PathBuf};
use std::process::ExitCode;

const USAGE: &str = "\
Usage:
  cargo xtask check [tidy|build]
  cargo xtask mock capture <scene>
  cargo xtask sandbox <command> [arguments]
  cargo xtask mutation changed <base> [--max-mutants N]
  cargo xtask mutation audit <file>... [--max-mutants N]";

fn workspace_root() -> PathBuf {
    let manifest_directory = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    manifest_directory
        .parent()
        .expect("xtask lives one level below the workspace root")
        .to_path_buf()
}

#[expect(
    clippy::print_stderr,
    reason = "the usage message is the command's output"
)]
fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let root = workspace_root();

    match arguments.split_first() {
        Some((task, rest)) if task == "check" => check::run(&root, rest),
        Some((task, rest)) if task == "mock" => mock::run(&root, rest),
        Some((task, rest)) if task == "sandbox" => sandbox_status(&root, rest),
        Some((task, rest)) if task == "mutation" => mutation::run(&root, rest),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(target_os = "linux")]
#[expect(
    clippy::print_stderr,
    reason = "failure messages are the command's output"
)]
fn sandbox_status(root: &Path, arguments: &[String]) -> ExitCode {
    match ruta::sandbox(root, arguments) {
        Ok(status) => status,
        Err(error) => {
            eprintln!("{error:#}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(not(target_os = "linux"))]
#[expect(clippy::print_stderr, reason = "the refusal is the command's output")]
fn sandbox_status(_root: &Path, _arguments: &[String]) -> ExitCode {
    eprintln!("The sandbox runs on Linux only.");
    ExitCode::FAILURE
}
