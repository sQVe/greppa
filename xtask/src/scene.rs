use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::Context as _;
use serde_json::Value;
use thiserror::Error;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct LogicalSize {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, PartialEq)]
pub(crate) struct Ready {
    pub scene: String,
    pub origin: Point,
    pub size: LogicalSize,
    pub scale: f32,
    pub title: String,
}

#[derive(Debug, Error)]
pub(crate) enum SceneError {
    #[error("{}", unknown_scene_message(name, names))]
    Unknown { name: String, names: Vec<String> },
    #[error("{}", unknown_scene_message(name, names))]
    Empty { name: String, names: Vec<String> },
}

pub(crate) fn parse_ready(line: &str) -> anyhow::Result<Ready> {
    let value: Value = serde_json::from_str(line).context("Invalid ready line")?;
    let missing = |field: &str| anyhow::anyhow!("The ready line has no {field}.");

    Ok(Ready {
        scene: value["scene"]
            .as_str()
            .ok_or_else(|| missing("scene"))?
            .to_string(),
        origin: Point {
            x: number(&value["origin"]["x"]).ok_or_else(|| missing("origin.x"))?,
            y: number(&value["origin"]["y"]).ok_or_else(|| missing("origin.y"))?,
        },
        size: LogicalSize {
            width: number(&value["size"]["width"]).ok_or_else(|| missing("size.width"))?,
            height: number(&value["size"]["height"]).ok_or_else(|| missing("size.height"))?,
        },
        scale: number(&value["scale"]).ok_or_else(|| missing("scale"))?,
        title: value["title"]
            .as_str()
            .ok_or_else(|| missing("title"))?
            .to_string(),
    })
}

fn number(value: &Value) -> Option<f32> {
    value.as_f64().map(|value| value as f32)
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

    executable_from_messages(&stdout)
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
    let output = crate::process::run_with_timeout(command, crate::process::TOOL_TIMEOUT)
        .context("Could not list the scenes")?;

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

    #[test]
    fn parse_ready_reads_every_field() {
        let line = "{\"scene\":\"demo\",\"origin\":{\"x\":60,\"y\":60},\"size\":{\"width\":420,\"height\":300},\"scale\":1,\"title\":\"greppa-scene-demo\"}";

        assert_eq!(
            parse_ready(line).expect("a complete ready line"),
            Ready {
                scene: "demo".to_string(),
                origin: Point { x: 60.0, y: 60.0 },
                size: LogicalSize {
                    width: 420.0,
                    height: 300.0,
                },
                scale: 1.0,
                title: "greppa-scene-demo".to_string(),
            }
        );
    }

    #[test]
    fn parse_ready_rejects_other_output() {
        assert!(parse_ready("not json").is_err());
        assert!(parse_ready("{\"scene\":\"demo\"}").is_err());
    }

    #[test]
    fn parse_ready_reports_a_missing_field() {
        assert!(
            parse_ready(
                "{\"scene\":\"demo\",\"origin\":{\"x\":1,\"y\":2},\"size\":{\"width\":3,\"height\":4},\"scale\":1}"
            )
            .is_err()
        );
    }

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
