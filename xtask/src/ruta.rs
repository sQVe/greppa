use std::path::Path;
use std::process::{Command, ExitCode};

use crate::scene;

pub(crate) fn sandbox(root: &Path, arguments: &[String]) -> anyhow::Result<ExitCode> {
    if needs_build(arguments) {
        scene::build(root)?;
    }

    run(root, arguments)
}

pub(crate) fn capture(root: &Path, scene: &str) -> anyhow::Result<ExitCode> {
    run(root, &capture_arguments(scene))
}

fn needs_build(arguments: &[String]) -> bool {
    matches!(
        arguments.first().map(String::as_str),
        Some("up" | "restart")
    )
}

fn capture_arguments(scene: &str) -> Vec<String> {
    vec![
        "capture".to_string(),
        "--out".to_string(),
        format!(".tau/judge/{scene}"),
        "--".to_string(),
        scene.to_string(),
    ]
}

fn run(root: &Path, arguments: &[String]) -> anyhow::Result<ExitCode> {
    let status = Command::new("ruta")
        .args(arguments)
        .current_dir(root)
        .status()
        .map_err(start_error)?;

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}

fn start_error(error: std::io::Error) -> anyhow::Error {
    if error.kind() == std::io::ErrorKind::NotFound {
        return anyhow::anyhow!(
            "ruta is not installed. Run: cargo install --git https://github.com/sQVe/ruta --tag v0.1.0 --locked ruta"
        );
    }

    anyhow::Error::new(error).context("Could not start ruta")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_up_and_restart_build_the_scene() {
        for (command, expected) in [
            ("up", true),
            ("restart", true),
            ("shot", false),
            ("down", false),
            ("unknown", false),
        ] {
            assert_eq!(
                needs_build(&[command.to_string(), "--anything".to_string()]),
                expected,
                "{command}"
            );
        }
        assert!(!needs_build(&[]));
    }

    #[test]
    fn capture_passes_the_output_folder_and_scene_to_ruta() {
        assert_eq!(
            capture_arguments("smoke-2"),
            ["capture", "--out", ".tau/judge/smoke-2", "--", "smoke-2"]
        );
    }
}
