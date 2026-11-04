mod check;
mod mock;
mod mutation;
mod raw_values;

use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str = "\
Usage:
  cargo xtask check [tidy|build]
  cargo xtask mock capture <scene>
  cargo xtask mutation changed <base> [--max-mutants N]
  cargo xtask mutation audit <file>... [--max-mutants N]";

fn workspace_root() -> PathBuf {
    let manifest_directory = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    manifest_directory
        .parent()
        .expect("xtask lives one level below the workspace root")
        .to_path_buf()
}

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let root = workspace_root();

    match arguments.split_first() {
        Some((task, rest)) if task == "check" => check::run(&root, rest),
        Some((task, rest)) if task == "mock" => mock::run(&root, rest),
        Some((task, rest)) if task == "mutation" => mutation::run(&root, rest),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::FAILURE
        }
    }
}
