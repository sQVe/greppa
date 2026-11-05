use std::path::Path;

use thiserror::Error;

const USAGE: &str = "\
Usage:
  cargo xtask sandbox up [--headed] <scene>
  cargo xtask sandbox restart [--headed] [scene]
  cargo xtask sandbox shot [file]
  cargo xtask sandbox move <x0> <y0> <x1> <y1>
  cargo xtask sandbox click <x> <y> [button]
  cargo xtask sandbox drag <x0> <y0> <x1> <y1>
  cargo xtask sandbox type <text>
  cargo xtask sandbox key <keysym> [modifier]...
  cargo xtask sandbox log
  cargo xtask sandbox opened
  cargo xtask sandbox down

Set GREPPA_SANDBOX=<name> to run a second sandbox side by side.";

const DEFAULT_NAME: &str = "greppa";

#[derive(Debug, PartialEq)]
pub(super) enum Sandbox {
    Up {
        scene: String,
        headed: bool,
    },
    Restart {
        scene: Option<String>,
        headed: Option<bool>,
    },
    Shot {
        file: Option<std::path::PathBuf>,
    },
    Move {
        from: (i32, i32),
        to: (i32, i32),
    },
    Click {
        x: i32,
        y: i32,
        button: u8,
    },
    Drag {
        from: (i32, i32),
        to: (i32, i32),
    },
    Type {
        text: String,
    },
    Key {
        key: String,
        modifiers: Vec<String>,
    },
    Log,
    Opened,
    Down,
}

fn number(value: &str, name: &str) -> anyhow::Result<i32> {
    value
        .parse()
        .map_err(|_| anyhow::anyhow!("{name} must be a whole number, not \"{value}\""))
}

fn split_headed(arguments: &[String]) -> (bool, Vec<String>) {
    let headed = arguments.iter().any(|argument| argument == "--headed");
    let rest = arguments
        .iter()
        .filter(|argument| argument.as_str() != "--headed")
        .cloned()
        .collect();

    (headed, rest)
}

pub(super) fn parse(arguments: &[String]) -> anyhow::Result<Sandbox> {
    match arguments {
        [command, rest @ ..] if command == "up" => {
            let (headed, rest) = split_headed(rest);

            match rest.as_slice() {
                [scene] => Ok(Sandbox::Up {
                    scene: scene.clone(),
                    headed,
                }),
                _ => anyhow::bail!(USAGE),
            }
        }
        [command, rest @ ..] if command == "restart" => {
            let (headed_flag, rest) = split_headed(rest);
            let headed = headed_flag.then_some(true);

            match rest.as_slice() {
                [] => Ok(Sandbox::Restart {
                    scene: None,
                    headed,
                }),
                [scene] => Ok(Sandbox::Restart {
                    scene: Some(scene.clone()),
                    headed,
                }),
                _ => anyhow::bail!(USAGE),
            }
        }
        [command] if command == "shot" => Ok(Sandbox::Shot { file: None }),
        [command, file] if command == "shot" => Ok(Sandbox::Shot {
            file: Some(std::path::PathBuf::from(file)),
        }),
        [command, x0, y0, x1, y1] if command == "move" => Ok(Sandbox::Move {
            from: (number(x0, "x0")?, number(y0, "y0")?),
            to: (number(x1, "x1")?, number(y1, "y1")?),
        }),
        [command, x0, y0, x1, y1] if command == "drag" => Ok(Sandbox::Drag {
            from: (number(x0, "x0")?, number(y0, "y0")?),
            to: (number(x1, "x1")?, number(y1, "y1")?),
        }),
        [command, x, y] if command == "click" => Ok(Sandbox::Click {
            x: number(x, "x")?,
            y: number(y, "y")?,
            button: 1,
        }),
        [command, x, y, button] if command == "click" => Ok(Sandbox::Click {
            x: number(x, "x")?,
            y: number(y, "y")?,
            button: button
                .parse()
                .map_err(|_| anyhow::anyhow!("button must be a whole number, not \"{button}\""))?,
        }),
        [command, rest @ ..] if command == "type" && !rest.is_empty() => Ok(Sandbox::Type {
            text: rest.join(" "),
        }),
        [command, key, modifiers @ ..] if command == "key" => Ok(Sandbox::Key {
            key: key.clone(),
            modifiers: modifiers.to_vec(),
        }),
        [command] if command == "log" => Ok(Sandbox::Log),
        [command] if command == "opened" => Ok(Sandbox::Opened),
        [command] if command == "down" => Ok(Sandbox::Down),
        _ => anyhow::bail!(USAGE),
    }
}

pub(super) fn sandbox_name(value: Option<&str>) -> anyhow::Result<String> {
    let name = value.unwrap_or(DEFAULT_NAME);
    let mut characters = name.chars();
    let first = characters.next();

    let valid_first =
        first.is_some_and(|character| character.is_ascii_lowercase() || character.is_ascii_digit());
    let valid_rest = characters.all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    });

    if !valid_first || !valid_rest || name.len() > 32 {
        anyhow::bail!(
            "GREPPA_SANDBOX must be one name of lowercase letters, digits, and dashes, not \"{name}\""
        );
    }

    Ok(name.to_string())
}

fn find_program(name: &str, path: &str) -> Option<std::path::PathBuf> {
    path.split(':')
        .filter(|directory| !directory.is_empty())
        .map(|directory| Path::new(directory).join(name))
        .find(|candidate| candidate.is_file())
}

fn tool_error(name: &str) -> String {
    let package = match name {
        "xdotool" => "the xdotool package",
        "weston" => "the weston package",
        "Xwayland" => "the xorg-xwayland package",
        "import" | "magick" | "identify" => "the imagemagick package",
        _ => name,
    };

    format!("The tool \"{name}\" is missing. Install {package} and try again.")
}

#[derive(Debug, Error)]
#[error("{}", tool_error(name))]
pub(super) struct MissingTool {
    pub(super) name: String,
}

pub(super) fn require_program(name: &str) -> Result<(), MissingTool> {
    require_program_in(name, &std::env::var("PATH").unwrap_or_default())
}

fn require_program_in(name: &str, path: &str) -> Result<(), MissingTool> {
    if find_program(name, path).is_some() {
        return Ok(());
    }

    Err(MissingTool {
        name: name.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn parse_reads_every_command() {
        assert_eq!(
            parse(&["up".to_string(), "smoke-2".to_string()]).expect("up parses"),
            Sandbox::Up {
                scene: "smoke-2".to_string(),
                headed: false,
            }
        );
        assert_eq!(
            parse(&[
                "up".to_string(),
                "--headed".to_string(),
                "smoke-2".to_string()
            ])
            .expect("headed up parses"),
            Sandbox::Up {
                scene: "smoke-2".to_string(),
                headed: true,
            }
        );
        assert_eq!(
            parse(&["restart".to_string()]).expect("restart parses"),
            Sandbox::Restart {
                scene: None,
                headed: None,
            }
        );
        assert_eq!(
            parse(&[
                "restart".to_string(),
                "--headed".to_string(),
                "smoke-3".to_string()
            ])
            .expect("headed restart parses"),
            Sandbox::Restart {
                scene: Some("smoke-3".to_string()),
                headed: Some(true),
            }
        );
        assert_eq!(
            parse(&["shot".to_string(), "out.png".to_string()]).expect("shot parses"),
            Sandbox::Shot {
                file: Some(PathBuf::from("out.png"))
            }
        );
        assert_eq!(
            parse(&[
                "move".to_string(),
                "1".to_string(),
                "2".to_string(),
                "3".to_string(),
                "4".to_string()
            ])
            .expect("move parses"),
            Sandbox::Move {
                from: (1, 2),
                to: (3, 4)
            }
        );
        assert_eq!(
            parse(&["click".to_string(), "10".to_string(), "20".to_string()])
                .expect("click parses"),
            Sandbox::Click {
                x: 10,
                y: 20,
                button: 1
            }
        );
        assert_eq!(
            parse(&[
                "click".to_string(),
                "10".to_string(),
                "20".to_string(),
                "3".to_string()
            ])
            .expect("click with a button parses"),
            Sandbox::Click {
                x: 10,
                y: 20,
                button: 3
            }
        );
        assert_eq!(
            parse(&[
                "drag".to_string(),
                "1".to_string(),
                "2".to_string(),
                "3".to_string(),
                "4".to_string()
            ])
            .expect("drag parses"),
            Sandbox::Drag {
                from: (1, 2),
                to: (3, 4)
            }
        );
        assert_eq!(
            parse(&["type".to_string(), "hello".to_string(), "world".to_string()])
                .expect("type parses"),
            Sandbox::Type {
                text: "hello world".to_string()
            }
        );
        assert_eq!(
            parse(&["key".to_string(), "p".to_string(), "Control_L".to_string()])
                .expect("key parses"),
            Sandbox::Key {
                key: "p".to_string(),
                modifiers: vec!["Control_L".to_string()]
            }
        );
        assert_eq!(
            parse(&["log".to_string()]).expect("log parses"),
            Sandbox::Log
        );
        assert_eq!(
            parse(&["down".to_string()]).expect("down parses"),
            Sandbox::Down
        );
    }

    #[test]
    fn parse_rejects_bad_shapes() {
        assert!(parse(&["up".to_string()]).is_err());
        assert!(parse(&["up".to_string(), "a".to_string(), "b".to_string()]).is_err());
        assert!(parse(&["up".to_string(), "--headed".to_string()]).is_err());
        assert!(parse(&["move".to_string(), "1".to_string()]).is_err());
        assert!(parse(&["click".to_string(), "x".to_string(), "2".to_string()]).is_err());
        assert!(parse(&["type".to_string()]).is_err());
        assert!(parse(&["key".to_string()]).is_err());
        assert!(parse(&["nonsense".to_string()]).is_err());
    }

    #[test]
    fn sandbox_name_accepts_one_leaf_name() {
        assert_eq!(sandbox_name(None).expect("default name"), "greppa");
        assert_eq!(sandbox_name(Some("alpha-2")).expect("leaf name"), "alpha-2");
        assert_eq!(sandbox_name(Some("2")).expect("leaf name"), "2");
    }

    #[test]
    fn sandbox_name_rejects_paths_and_spaces() {
        assert!(sandbox_name(Some("Two")).is_err());
        assert!(sandbox_name(Some("a/b")).is_err());
        assert!(sandbox_name(Some("a b")).is_err());
        assert!(sandbox_name(Some("")).is_err());
        assert!(sandbox_name(Some("-lead")).is_err());
        assert!(sandbox_name(Some(&"a".repeat(33))).is_err());
    }

    #[test]
    fn find_program_uses_the_given_path() {
        let directory = std::env::temp_dir().join(format!("greppa-find-{}", std::process::id()));
        crate::test_support::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).expect("create the test directory");
        let program = directory.join("fake-tool");
        std::fs::write(&program, "#!/bin/sh\n").expect("write the fake tool");

        let found = find_program("fake-tool", &directory.to_string_lossy());
        assert_eq!(found, Some(program));
        assert_eq!(find_program("fake-tool", "/nonexistent"), None);

        crate::test_support::remove_dir_all(&directory);
    }

    #[test]
    fn require_program_reports_a_missing_tool() {
        let error = require_program_in("no-such-tool", "/nonexistent").expect_err("missing tool");

        assert!(matches!(error, MissingTool { ref name } if name == "no-such-tool"));
        assert_eq!(
            error.to_string(),
            "The tool \"no-such-tool\" is missing. Install no-such-tool and try again."
        );
    }

    #[test]
    fn tool_error_names_the_tool_and_package() {
        assert!(tool_error("xdotool").contains("xdotool"));
        assert!(tool_error("Xwayland").contains("xorg-xwayland"));
        assert!(tool_error("import").contains("imagemagick"));
    }
}
