mod command;
#[cfg(target_os = "linux")]
mod display_start;
#[cfg(target_os = "linux")]
mod environment;
#[cfg(target_os = "linux")]
mod identity;
#[cfg(target_os = "linux")]
mod input;
#[cfg(target_os = "linux")]
mod orchestration;
#[cfg(target_os = "linux")]
mod root;
#[cfg(target_os = "linux")]
mod scene_start;

use std::path::Path;
use std::process::ExitCode;

use command::{parse, sandbox_name};

#[expect(
    clippy::print_stderr,
    reason = "usage and failure messages are the command's output"
)]
pub(crate) fn run(workspace: &Path, arguments: &[String]) -> ExitCode {
    let name = match sandbox_name(std::env::var("GREPPA_SANDBOX").ok().as_deref()) {
        Ok(name) => name,
        Err(error) => {
            eprintln!("{error:#}");
            return ExitCode::FAILURE;
        }
    };

    let command = match parse(arguments) {
        Ok(command) => command,
        Err(error) => {
            eprintln!("{error:#}");
            return ExitCode::FAILURE;
        }
    };

    #[cfg(target_os = "linux")]
    {
        orchestration::run(workspace, &name, command)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (workspace, name, command);
        eprintln!("The sandbox runs on Linux only.");
        ExitCode::FAILURE
    }
}
