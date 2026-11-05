//! The `greppa-scene` binary: build it, read its ready line, and name its scenes.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::Value;

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

/// The first frame's JSON line: where the scene draws inside its window.
#[derive(Debug, PartialEq)]
pub(crate) struct Ready {
    pub scene: String,
    pub origin: Point,
    pub size: LogicalSize,
    pub scale: f32,
    pub title: String,
}

pub(crate) fn parse_ready(line: &str) -> Result<Ready, String> {
    let value: Value =
        serde_json::from_str(line).map_err(|error| format!("Invalid ready line: {error}"))?;
    let missing = |field: &str| format!("The ready line has no {field}.");

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

/// Matches `name` against the scene binary's list, so `up` fails before it starts anything.
pub(crate) fn validate_scene(name: &str, names: &[String]) -> Result<String, String> {
    let trimmed = name.trim();

    names
        .iter()
        .find(|scene| scene.as_str() == trimmed)
        .cloned()
        .ok_or_else(|| unknown_scene_message(name, names))
}

/// Session variables the scene build must not inherit. Cargo and rustup keep the rest of the
/// caller's environment, including PATH, HOME, CARGO_*, and RUSTUP_*.
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

pub(crate) fn build(root: &Path) -> Result<PathBuf, String> {
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
        .map_err(|error| format!("Could not start cargo build: {error}"))?;

    if !output.status.success() {
        return Err("The scene binary did not build.".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    executable_from_messages(&stdout)
}

pub(crate) fn executable_from_messages(output: &str) -> Result<PathBuf, String> {
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

    Err("Cargo did not report a greppa-scene executable.".to_string())
}

pub(crate) fn names(
    binary: &Path,
    environment: &[(String, String)],
) -> Result<Vec<String>, String> {
    let mut command = Command::new(binary);
    command
        .arg("--list")
        .env_clear()
        .envs(environment.iter().cloned());
    let output = crate::process::run_with_timeout(command, crate::process::TOOL_TIMEOUT)
        .map_err(|error| format!("Could not list the scenes: {error}"))?;

    if !output.status.success() {
        return Err("The scene binary did not list its scenes.".to_string());
    }

    let names: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();

    if names.is_empty() {
        return Err("The scene binary listed no scenes.".to_string());
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
            parse_ready(line),
            Ok(Ready {
                scene: "demo".to_string(),
                origin: Point { x: 60.0, y: 60.0 },
                size: LogicalSize {
                    width: 420.0,
                    height: 300.0,
                },
                scale: 1.0,
                title: "greppa-scene-demo".to_string(),
            })
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

        assert_eq!(validate_scene(" alpha ", &names), Ok("alpha".to_string()));
        assert_eq!(
            validate_scene("missing", &names),
            Err("No scene named \"missing\". Known scenes: alpha, beta.".to_string())
        );
        assert_eq!(
            validate_scene("", &names),
            Err("Type a scene name. Known scenes: alpha, beta.".to_string())
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
            executable_from_messages(output),
            Ok(PathBuf::from("/custom/target/debug/greppa-scene"))
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
