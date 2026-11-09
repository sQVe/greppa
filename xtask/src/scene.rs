use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::Context as _;
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum SceneError {
    #[error("{}", unknown_scene_message(name, names))]
    Unknown { name: String, names: Vec<String> },
    #[error("{}", unknown_scene_message(name, names))]
    Empty { name: String, names: Vec<String> },
}

pub(crate) fn unknown_scene_message(name: &str, names: &[String]) -> String {
    let known = names.join(", ");

    if name.trim().is_empty() {
        format!("Type a scene name. Known scenes: {known}.")
    } else {
        format!("No scene named \"{}\". Known scenes: {known}.", name.trim())
    }
}

pub(crate) fn validate_scene(name: &str, names: &[String]) -> Result<String, SceneError> {
    let trimmed = name.trim();
    let requested = trimmed.to_string();

    names
        .iter()
        .find(|scene| scene.as_str() == trimmed)
        .cloned()
        .ok_or_else(|| {
            if trimmed.is_empty() {
                SceneError::Empty {
                    name: requested,
                    names: names.to_vec(),
                }
            } else {
                SceneError::Unknown {
                    name: requested,
                    names: names.to_vec(),
                }
            }
        })
}

const DROPPED_SESSION: &[&str] = &[
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "WAYLAND_SOCKET",
    "LIBEI_SOCKET",
    "XAUTHORITY",
    "SWAYSOCK",
    "DBUS_SESSION_BUS_ADDRESS",
    "AT_SPI_BUS_ADDRESS",
];

pub(crate) fn build_environment(caller: &[(String, String)]) -> Vec<(String, String)> {
    caller
        .iter()
        .filter(|(key, _)| !DROPPED_SESSION.contains(&key.as_str()))
        .cloned()
        .collect()
}

pub(crate) fn build(root: &Path) -> anyhow::Result<PathBuf> {
    let output = Command::new("cargo")
        .args([
            "build",
            "--locked",
            "--package",
            "greppa-ui",
            "--bin",
            "greppa-scene",
            "--message-format=json-render-diagnostics",
        ])
        .current_dir(root)
        .env_clear()
        .envs(build_environment(&std::env::vars().collect::<Vec<_>>()))
        .stderr(Stdio::inherit())
        .output()
        .context("Could not start cargo build")?;

    if !output.status.success() {
        anyhow::bail!("The scene binary did not build.");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let executable = executable_from_messages(&stdout)?;
    validate_executable(root, &executable)?;

    Ok(executable)
}

fn validate_executable(root: &Path, executable: &Path) -> anyhow::Result<()> {
    let expected = root.join("target/debug/greppa-scene");

    if executable != expected {
        anyhow::bail!(
            "ruta.toml requires {}, but Cargo reported {}. Remove CARGO_TARGET_DIR or other target directory overrides.",
            expected.display(),
            executable.display()
        );
    }

    Ok(())
}

pub(crate) fn executable_from_messages(output: &str) -> anyhow::Result<PathBuf> {
    for line in output.lines() {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };

        if value["reason"] != "compiler-artifact" || value["target"]["name"] != "greppa-scene" {
            continue;
        }

        if let Some(executable) = value["executable"].as_str() {
            return Ok(PathBuf::from(executable));
        }
    }

    anyhow::bail!("Cargo did not report a greppa-scene executable.")
}

pub(crate) fn names(
    binary: &Path,
    environment: &[(String, String)],
) -> anyhow::Result<Vec<String>> {
    let mut command = Command::new(binary);
    command
        .arg("--list")
        .env_clear()
        .envs(environment.iter().cloned());
    let output = command.output().context("Could not list the scenes")?;

    if !output.status.success() {
        anyhow::bail!("The scene binary did not list its scenes.");
    }

    let names: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();

    if names.is_empty() {
        anyhow::bail!("The scene binary listed no scenes.");
    }

    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn known_names() -> Vec<String> {
        ["alpha", "beta"]
            .iter()
            .map(|name| name.to_string())
            .collect()
    }

    #[test]
    fn validate_scene_names_the_known_scenes() {
        let names = known_names();

        assert_eq!(
            validate_scene(" alpha ", &names).expect("a known scene"),
            "alpha"
        );

        let error = validate_scene("missing", &names).expect_err("an unknown scene fails");
        assert!(
            matches!(error, SceneError::Unknown { ref name, .. } if name == "missing"),
            "unexpected error: {error}"
        );
        assert_eq!(
            error.to_string(),
            "No scene named \"missing\". Known scenes: alpha, beta."
        );

        let error = validate_scene("", &names).expect_err("an empty scene fails");
        assert!(matches!(error, SceneError::Empty { .. }));
        assert_eq!(
            error.to_string(),
            "Type a scene name. Known scenes: alpha, beta."
        );
    }

    #[test]
    fn build_environment_drops_session_variables() {
        let caller = vec![
            ("DISPLAY".to_string(), ":0".to_string()),
            ("WAYLAND_DISPLAY".to_string(), "wayland-0".to_string()),
            ("WAYLAND_SOCKET".to_string(), "3".to_string()),
            ("LIBEI_SOCKET".to_string(), "/run/ei".to_string()),
            (
                "XAUTHORITY".to_string(),
                "/home/user/.Xauthority".to_string(),
            ),
            ("SWAYSOCK".to_string(), "/run/sway".to_string()),
            ("PATH".to_string(), "/usr/bin".to_string()),
            ("HOME".to_string(), "/home/user".to_string()),
            ("CARGO_HOME".to_string(), "/cargo".to_string()),
            ("RUSTUP_HOME".to_string(), "/rustup".to_string()),
        ];
        let environment = build_environment(&caller);
        let has = |key: &str| environment.iter().any(|(name, _)| name == key);

        assert!(!has("DISPLAY"));
        assert!(!has("WAYLAND_DISPLAY"));
        assert!(!has("WAYLAND_SOCKET"));
        assert!(!has("LIBEI_SOCKET"));
        assert!(!has("XAUTHORITY"));
        assert!(!has("SWAYSOCK"));
        assert!(has("PATH"));
        assert!(has("HOME"));
        assert!(has("CARGO_HOME"));
        assert!(has("RUSTUP_HOME"));
    }

    #[test]
    fn names_lists_the_binary_without_a_display() {
        use std::os::unix::fs::PermissionsExt as _;

        let folder = crate::test_support::temporary_directory();
        let binary = folder.path().join("scene");
        std::fs::write(&binary, "#!/bin/sh\n[ \"$1\" = --list ] || exit 1\n[ -z \"$DISPLAY\" ] || exit 1\nprintf ' alpha \\n\\n beta \\n'\n").expect("write a scene list command");
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700))
            .expect("make the scene executable");

        assert_eq!(
            names(&binary, &[]).expect("list known scenes"),
            ["alpha", "beta"]
        );
    }

    #[test]
    fn executable_must_match_the_ruta_config_path() {
        let root = Path::new("/workspace");
        let expected = root.join("target/debug/greppa-scene");
        validate_executable(root, &expected).expect("the configured executable is accepted");
        let error = validate_executable(root, Path::new("/custom/debug/greppa-scene"))
            .expect_err("a custom target directory is refused");
        assert_eq!(
            error.to_string(),
            "ruta.toml requires /workspace/target/debug/greppa-scene, but Cargo reported /custom/debug/greppa-scene. Remove CARGO_TARGET_DIR or other target directory overrides."
        );
    }

    #[test]
    fn executable_from_messages_reads_the_artifact_path() {
        let output = "\
{\"reason\":\"compiler-artifact\",\"target\":{\"name\":\"greppa-scene\"},\"executable\":\"/custom/target/debug/greppa-scene\"}\n\
{\"reason\":\"build-finished\",\"success\":true}\n";

        assert_eq!(
            executable_from_messages(output).expect("a compiler artifact"),
            PathBuf::from("/custom/target/debug/greppa-scene")
        );
        assert!(executable_from_messages("not json").is_err());
        assert!(
            executable_from_messages(
                "{\"reason\":\"compiler-artifact\",\"target\":{\"name\":\"other\"},\"executable\":\"/x\"}"
            )
            .is_err()
        );
    }
}
