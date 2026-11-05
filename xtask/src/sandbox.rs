//! A throwaway greppa window on a private headless Weston and Xwayland display.
//!
//! Every command is a separate process. The sandbox therefore records process IDs with their
//! start times and its own display and window in the root folder. `down` stops the recorded
//! processes and removes the folder. Nothing reaches the caller's display, pointer, or keyboard.

use std::path::Path;
use std::process::ExitCode;

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

const ROOT_PARENT: &str = "/var/tmp";
const ROOT_PREFIX: &str = "greppa-sandbox-";
const DEFAULT_NAME: &str = "greppa";
const SOCKET_PREFIX: &str = "greppa-sandbox-";

#[derive(Debug, PartialEq)]
pub(crate) enum Sandbox {
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

fn number(value: &str, name: &str) -> Result<i32, String> {
    value
        .parse()
        .map_err(|_| format!("{name} must be a whole number, not \"{value}\""))
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

pub(crate) fn parse(arguments: &[String]) -> Result<Sandbox, String> {
    match arguments {
        [command, rest @ ..] if command == "up" => {
            let (headed, rest) = split_headed(rest);

            match rest.as_slice() {
                [scene] => Ok(Sandbox::Up {
                    scene: scene.clone(),
                    headed,
                }),
                _ => Err(USAGE.to_string()),
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
                _ => Err(USAGE.to_string()),
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
                .map_err(|_| format!("button must be a whole number, not \"{button}\""))?,
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
        _ => Err(USAGE.to_string()),
    }
}

pub(crate) fn sandbox_name(value: Option<&str>) -> Result<String, String> {
    let name = value.unwrap_or(DEFAULT_NAME);
    let mut characters = name.chars();
    let first = characters.next();

    let valid_first =
        first.is_some_and(|character| character.is_ascii_lowercase() || character.is_ascii_digit());
    let valid_rest = characters.all(|character| {
        character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
    });

    if !valid_first || !valid_rest || name.len() > 32 {
        return Err(format!(
            "GREPPA_SANDBOX must be one name of lowercase letters, digits, and dashes, not \"{name}\""
        ));
    }

    Ok(name.to_string())
}

pub(crate) fn root_path(name: &str) -> std::path::PathBuf {
    std::path::Path::new(ROOT_PARENT).join(format!("{ROOT_PREFIX}{name}"))
}

pub(crate) fn socket_name(name: &str) -> String {
    format!("{SOCKET_PREFIX}{name}")
}

pub(crate) struct RootMetadata {
    pub is_symlink: bool,
    pub is_dir: bool,
    pub owner: u32,
    pub mode: u32,
}

pub(crate) fn root_metadata_problem(metadata: &RootMetadata, current_uid: u32) -> Option<String> {
    if metadata.is_symlink {
        return Some("it is a symlink".to_string());
    }

    if !metadata.is_dir {
        return Some("it is not a folder".to_string());
    }

    if metadata.owner != current_uid {
        return Some("it is not owned by the current user".to_string());
    }

    if metadata.mode & 0o777 != 0o700 {
        return Some(format!("its mode is {:o}, not 700", metadata.mode & 0o777));
    }

    None
}

/// The sandbox paths that must never be symlinks. A planted link could redirect sandbox writes.
pub(crate) fn linked_paths(root: &Path) -> Vec<std::path::PathBuf> {
    [
        "display",
        "weston.pid",
        "xwayland.pid",
        "pid",
        "window",
        "title",
        "scene",
        "mode",
        "bin",
        "home",
        "opened",
        "scene.log",
        "weston.log",
        "run",
        "config",
        "state",
        "data",
        "cache",
    ]
    .iter()
    .map(|name| root.join(name))
    .collect()
}

pub(crate) fn remove_root_allowed(root: &Path) -> bool {
    let parent_is_temporary = root.parent() == Some(Path::new(ROOT_PARENT));
    let base = root.file_name().and_then(|name| name.to_str());

    parent_is_temporary
        && base.is_some_and(|name| name.starts_with(ROOT_PREFIX) && name.len() > ROOT_PREFIX.len())
}

pub(crate) fn find_program(name: &str, path: &str) -> Option<std::path::PathBuf> {
    path.split(':')
        .filter(|directory| !directory.is_empty())
        .map(|directory| Path::new(directory).join(name))
        .find(|candidate| candidate.is_file())
}

pub(crate) fn tool_error(name: &str) -> String {
    let package = match name {
        "xdotool" => "the xdotool package",
        "weston" => "the weston package",
        "Xwayland" => "the xorg-xwayland package",
        "import" | "magick" | "identify" => "the imagemagick package",
        _ => name,
    };

    format!("The tool \"{name}\" is missing. Install {package} and try again.")
}

pub(crate) fn run(workspace: &Path, arguments: &[String]) -> ExitCode {
    let name = match sandbox_name(std::env::var("GREPPA_SANDBOX").ok().as_deref()) {
        Ok(name) => name,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    let command = match parse(arguments) {
        Ok(command) => command,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    #[cfg(target_os = "linux")]
    {
        linux::run(workspace, &name, command)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (workspace, name, command);
        eprintln!("The sandbox runs on Linux only.");
        ExitCode::FAILURE
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use std::fs;
    use std::os::unix::fs::{MetadataExt, PermissionsExt};
    use std::os::unix::process::CommandExt;
    use std::path::{Path, PathBuf};
    use std::process::{Command, ExitCode, Stdio};
    use std::time::{Duration, Instant};

    use crate::display;
    use crate::environment::{self, ChildDirs};
    use crate::scene::{self, Ready};

    use super::{
        RootMetadata, Sandbox, find_program, linked_paths, remove_root_allowed,
        root_metadata_problem, root_path, socket_name, tool_error,
    };

    const WINDOW_WIDTH: u32 = 1400;
    const WINDOW_HEIGHT: u32 = 900;
    const READY_TIMEOUT: Duration = Duration::from_secs(60);
    const WINDOW_TIMEOUT: Duration = Duration::from_secs(10);
    const STOP_TIMEOUT: Duration = Duration::from_secs(5);
    const INPUT_SETTLE: Duration = Duration::from_millis(150);
    const CLICK_SETTLE: Duration = Duration::from_millis(200);
    const STEP_DELAY: Duration = Duration::from_millis(16);
    const DRAG_STEPS: u32 = 24;
    const FOCUS_X: i32 = 5;
    const FOCUS_Y: i32 = 5;

    fn sandbox_environment(root: &Path, display: &str) -> Vec<(String, String)> {
        let marker = root.to_string_lossy().into_owned();
        let dirs = ChildDirs::under(root);

        environment::child_environment(
            &caller_environment(),
            &dirs,
            &[("DISPLAY", display), ("GREPPA_SANDBOX_ROOT", &marker)],
        )
    }

    fn weston_environment(root: &Path) -> Vec<(String, String)> {
        environment::child_environment(&caller_environment(), &ChildDirs::under(root), &[])
    }

    fn nested_weston_environment(root: &Path, runtime: &Path) -> Vec<(String, String)> {
        let mut dirs = ChildDirs::under(root);
        dirs.runtime = runtime.to_path_buf();

        environment::child_environment(&caller_environment(), &dirs, &[])
    }

    pub(super) fn run(workspace: &Path, name: &str, command: Sandbox) -> ExitCode {
        match execute(workspace, name, command) {
            Ok(()) => ExitCode::SUCCESS,
            Err(message) => {
                eprintln!("{message}");
                ExitCode::FAILURE
            }
        }
    }

    fn execute(workspace: &Path, name: &str, command: Sandbox) -> Result<(), String> {
        let root = root_path(name);

        match command {
            Sandbox::Up { scene, headed } => up(workspace, name, &root, &scene, headed),
            Sandbox::Restart { scene, headed } => {
                restart(workspace, name, &root, scene.as_deref(), headed)
            }
            Sandbox::Shot { file } => shot(name, &root, file),
            Sandbox::Move { from, to } => with_window(name, &root, |display, window| {
                warm_up(&root, display, window)?;
                glide(&root, display, window, from, to)
            }),
            Sandbox::Click { x, y, button } => with_window(name, &root, |display, window| {
                warm_up(&root, display, window)?;
                move_pointer(&root, display, window, x, y)?;
                std::thread::sleep(CLICK_SETTLE);
                xdotool(&root, display, &["click".to_string(), button.to_string()])
            }),
            Sandbox::Drag { from, to } => with_window(name, &root, |display, window| {
                drag(&root, display, window, from, to)
            }),
            Sandbox::Type { text } => with_window(name, &root, |display, window| {
                warm_up(&root, display, window)?;
                xdotool(
                    &root,
                    display,
                    &[
                        "type".to_string(),
                        "--delay".to_string(),
                        "30".to_string(),
                        "--".to_string(),
                        text,
                    ],
                )
            }),
            Sandbox::Key { key, modifiers } => with_window(name, &root, |display, window| {
                warm_up(&root, display, window)?;
                let mut combo = modifiers;
                combo.push(key);
                xdotool(
                    &root,
                    display,
                    &[
                        "key".to_string(),
                        "--clearmodifiers".to_string(),
                        combo.join("+"),
                    ],
                )
            }),
            Sandbox::Log => log(&root),
            Sandbox::Opened => opened(&root),
            Sandbox::Down => down(name, &root),
        }
    }

    fn up(
        workspace: &Path,
        name: &str,
        root: &Path,
        scene_name: &str,
        headed: bool,
    ) -> Result<(), String> {
        require_program("weston")?;
        require_program("Xwayland")?;
        require_program("xdotool")?;
        require_headed_session(headed)?;

        start_window(workspace, name, root, scene_name, headed)
    }

    fn restart(
        workspace: &Path,
        name: &str,
        root: &Path,
        scene_name: Option<&str>,
        headed: Option<bool>,
    ) -> Result<(), String> {
        require_program("weston")?;
        require_program("Xwayland")?;
        require_program("xdotool")?;

        require_trusted_root(root)?;

        let headed = headed.unwrap_or_else(|| recorded_mode(root).as_deref() == Some("headed"));
        require_headed_session(headed)?;

        let scene = recorded_scene(root, scene_name)?;

        start_window(workspace, name, root, &scene, headed)
    }

    fn require_headed_session(headed: bool) -> Result<(), String> {
        if headed {
            wayland_display()?;
            caller_runtime_dir()?;
        }

        Ok(())
    }

    fn recorded_mode(root: &Path) -> Option<String> {
        fs::read_to_string(root.join("mode"))
            .ok()
            .map(|mode| mode.trim().to_string())
    }

    fn wayland_display() -> Result<String, String> {
        match std::env::var("WAYLAND_DISPLAY") {
            Ok(display) if !display.trim().is_empty() => Ok(display),
            _ => Err(
                "Headed mode needs WAYLAND_DISPLAY. Run it from the Wayland session, or leave out --headed."
                    .to_string(),
            ),
        }
    }

    fn caller_runtime_dir() -> Result<PathBuf, String> {
        match std::env::var("XDG_RUNTIME_DIR") {
            Ok(directory) if directory.starts_with('/') => Ok(PathBuf::from(directory)),
            _ => Err(
                "Headed mode needs an absolute XDG_RUNTIME_DIR to reach the Wayland socket."
                    .to_string(),
            ),
        }
    }

    fn recorded_scene(root: &Path, scene_name: Option<&str>) -> Result<String, String> {
        require_trusted_root(root)?;

        if let Some(scene) = scene_name {
            return Ok(scene.to_string());
        }

        fs::read_to_string(root.join("scene"))
            .map(|scene| scene.trim().to_string())
            .map_err(|_| {
                "The sandbox is not up; run 'cargo xtask sandbox up <scene>' first.".to_string()
            })
    }

    fn start_window(
        workspace: &Path,
        name: &str,
        root: &Path,
        scene_name: &str,
        headed: bool,
    ) -> Result<(), String> {
        let outcome = start_window_inner(workspace, name, root, scene_name, headed);

        if outcome.is_err() {
            let _ = cleanup(root);
        }

        outcome
    }

    fn start_window_inner(
        workspace: &Path,
        name: &str,
        root: &Path,
        scene_name: &str,
        headed: bool,
    ) -> Result<(), String> {
        if scene_name == "app" {
            return Err(
                "The real app has no window yet. Use a scene name such as smoke-2.".to_string(),
            );
        }

        prepare_root(root)?;

        let binary = scene::build(workspace)?;
        let names = scene::names(&binary, &weston_environment(root))?;
        let scene = scene::validate_scene(scene_name, &names)?;
        let display = ensure_display(name, root, headed)?;

        install_openers(root)?;
        start_scene(root, &binary, &scene, &display)?;
        focus_window(root, &display)?;
        record_xwayland(root, &display);

        println!(
            "sandbox {name} is up on {display} (log: {})",
            root.join("scene.log").display()
        );

        Ok(())
    }

    fn ensure_display(name: &str, root: &Path, headed: bool) -> Result<String, String> {
        let mode = if headed { "headed" } else { "headless" };

        if let Some(display) = display_up(root) {
            if recorded_mode(root).as_deref() == Some(mode) {
                return Ok(display);
            }

            stop_recorded(&root.join("weston.pid"))?;
            clean_display_files(root);
        }

        prepare_root(root)?;

        let log = root.join("weston.log");
        let _ = fs::remove_file(&log);
        let _ = fs::remove_file(root.join("display"));
        let _ = fs::remove_file(root.join("xwayland.pid"));

        let mut command = if headed {
            let runtime = caller_runtime_dir()?;
            let environment = nested_weston_environment(root, &runtime);

            display::nested_weston_command(
                &socket_name(name),
                WINDOW_WIDTH,
                WINDOW_HEIGHT,
                &log,
                &wayland_display()?,
                &environment,
            )
        } else {
            display::weston_command(
                &socket_name(name),
                WINDOW_WIDTH,
                WINDOW_HEIGHT,
                &log,
                &weston_environment(root),
            )
        };

        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .process_group(0);

        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start weston: {error}"))?;
        let pid = child.id();

        if let Err(error) = record_process(&root.join("weston.pid"), pid, "weston") {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }

        drop(child);

        let display = display::wait_for_display(&log, display::WESTON_TIMEOUT)?;
        fs::write(root.join("display"), format!("{display}\n"))
            .map_err(|error| format!("Could not write the display file: {error}"))?;
        fs::write(root.join("mode"), format!("{mode}\n"))
            .map_err(|error| format!("Could not write the sandbox mode: {error}"))?;

        Ok(display)
    }

    fn display_up(root: &Path) -> Option<String> {
        if !record_matches(&root.join("weston.pid")) {
            return None;
        }

        let display = fs::read_to_string(root.join("display")).ok()?;
        let display = display.trim().to_string();

        display.starts_with(':').then_some(display)
    }

    fn with_window<F>(name: &str, root: &Path, action: F) -> Result<(), String>
    where
        F: FnOnce(&str, &str) -> Result<(), String>,
    {
        require_program("xdotool")?;

        let display = require_up(name, root)?;
        let window = window_id(root)?;

        action(&display, &window)
    }

    fn require_trusted_root(root: &Path) -> Result<(), String> {
        refuse_unsafe_root(root)?;
        refuse_linked_paths(root)
    }

    fn require_up(name: &str, root: &Path) -> Result<String, String> {
        require_trusted_root(root)?;

        let display = display_up(root).ok_or_else(|| {
            format!("sandbox {name} is not up; run 'cargo xtask sandbox up <scene>' first")
        })?;

        if !root.join("window").is_file() {
            return Err(format!(
                "sandbox {name} is not up; run 'cargo xtask sandbox up <scene>' first"
            ));
        }

        Ok(display)
    }

    fn window_id(root: &Path) -> Result<String, String> {
        let window = fs::read_to_string(root.join("window"))
            .map_err(|error| format!("Could not read the window id: {error}"))?;
        let window = window.trim().to_string();

        if window.is_empty() || !window.chars().all(|character| character.is_ascii_digit()) {
            return Err(format!(
                "The recorded window id \"{window}\" is not numeric."
            ));
        }

        Ok(window)
    }

    fn shot(name: &str, root: &Path, file: Option<PathBuf>) -> Result<(), String> {
        require_program("import")?;

        let display = require_up(name, root)?;
        let window = window_id(root)?;
        let path = file.unwrap_or_else(|| root.join("shot.png"));
        let environment = sandbox_environment(root, &display);

        display::import_window(&display, &window, &path, &environment)?;
        println!("{}", path.display());

        Ok(())
    }

    fn log(root: &Path) -> Result<(), String> {
        require_trusted_root(root)?;

        let log = fs::read_to_string(root.join("scene.log"))
            .map_err(|error| format!("Could not read the scene log: {error}"))?;

        print!("{log}");

        Ok(())
    }

    fn opened(root: &Path) -> Result<(), String> {
        require_trusted_root(root)?;

        match fs::read_to_string(root.join("opened")) {
            Ok(opened) => print!("{opened}"),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Could not read the opened links: {error}")),
        }

        Ok(())
    }

    fn down(name: &str, root: &Path) -> Result<(), String> {
        if !root.exists() {
            println!("sandbox {name} is not up");
            return Ok(());
        }

        refuse_unsafe_root(root)?;
        refuse_linked_paths(root)?;
        cleanup(root)?;
        println!("sandbox {name} is gone");

        Ok(())
    }

    /// Stops everything the sandbox recorded, then removes the root. It refuses a root that fails
    /// the owner, mode, or symlink checks, so a failed `up` cannot act on an untrusted path. A
    /// process that will not stop keeps the root so the retry has its record.
    fn cleanup(root: &Path) -> Result<(), String> {
        require_trusted_root(root)?;

        stop_window(root)?;
        stop_recorded(&root.join("xwayland.pid"))?;
        stop_recorded(&root.join("weston.pid"))?;
        clean_display_files(root);

        if root.exists() {
            remove_root(root)?;
        }

        Ok(())
    }

    fn remove_root(root: &Path) -> Result<(), String> {
        if !remove_root_allowed(root) {
            return Err(format!(
                "refusing to remove {}: it is not a sandbox folder",
                root.display()
            ));
        }

        fs::remove_dir_all(root)
            .map_err(|error| format!("Could not remove {}: {error}", root.display()))
    }

    fn prepare_root(root: &Path) -> Result<(), String> {
        refuse_unsafe_root(root)?;

        if !root.exists() {
            fs::create_dir(root)
                .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
            fs::set_permissions(root, fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("Could not secure {}: {error}", root.display()))?;
        }

        refuse_unsafe_root(root)?;

        for folder in ["run", "config", "state", "data", "cache", "home", "bin"] {
            let path = root.join(folder);

            if !path.exists() {
                fs::create_dir(&path)
                    .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
                fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                    .map_err(|error| format!("Could not secure {}: {error}", path.display()))?;
            }
        }

        refuse_linked_paths(root)
    }

    fn refuse_unsafe_root(root: &Path) -> Result<(), String> {
        let metadata = match fs::symlink_metadata(root) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(format!("Could not read {}: {error}", root.display())),
        };

        let described = RootMetadata {
            is_symlink: metadata.file_type().is_symlink(),
            is_dir: metadata.is_dir(),
            owner: metadata.uid(),
            mode: metadata.permissions().mode(),
        };

        match root_metadata_problem(&described, current_uid()?) {
            Some(reason) => Err(format!("refusing {}: {reason}", root.display())),
            None => Ok(()),
        }
    }

    fn refuse_linked_paths(root: &Path) -> Result<(), String> {
        for path in linked_paths(root) {
            let is_symlink = fs::symlink_metadata(&path)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false);

            if is_symlink {
                return Err(format!(
                    "refusing the symlinked sandbox path {}",
                    path.display()
                ));
            }
        }

        Ok(())
    }

    fn current_uid() -> Result<u32, String> {
        fs::metadata("/proc/self")
            .map(|metadata| metadata.uid())
            .map_err(|error| format!("Could not read the current user id: {error}"))
    }

    fn install_openers(root: &Path) -> Result<(), String> {
        let opened = root.join("opened");

        for opener in ["xdg-open", "open"] {
            let path = root.join("bin").join(opener);

            if fs::symlink_metadata(&path)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err(format!("refusing the symlinked opener {}", path.display()));
            }

            let script = format!(
                "#!/bin/sh\nprintf '%s\\n' \"$*\" >>{}\n",
                shell_quote(&opened.to_string_lossy())
            );

            fs::write(&path, script)
                .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
                .map_err(|error| format!("Could not make {} runnable: {error}", path.display()))?;
        }

        Ok(())
    }

    /// Wraps a path in single quotes for the stub scripts. The root never contains a quote.
    fn shell_quote(value: &str) -> String {
        format!("'{}'", value.replace('\'', "'\\''"))
    }

    fn start_scene(root: &Path, binary: &Path, scene: &str, display: &str) -> Result<(), String> {
        stop_window(root)?;

        let log_path = root.join("scene.log");
        let _ = fs::remove_file(&log_path);
        let log = fs::File::create(&log_path)
            .map_err(|error| format!("Could not create {}: {error}", log_path.display()))?;
        let errors = log.try_clone().map_err(|error| {
            format!("Could not open {} for writing: {error}", log_path.display())
        })?;

        let mut command = Command::new(binary);
        command
            .arg(scene)
            .env_clear()
            .envs(sandbox_environment(root, display))
            .stdin(Stdio::null())
            .stdout(log)
            .stderr(errors)
            .process_group(0);

        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start the scene: {error}"))?;
        let pid = child.id();

        if let Err(error) = record_process(&root.join("pid"), pid, &binary.to_string_lossy()) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }

        drop(child);

        let ready = wait_for_ready(&log_path, pid, READY_TIMEOUT)?;

        fs::write(root.join("scene"), format!("{scene}\n"))
            .map_err(|error| format!("Could not write the scene name: {error}"))?;
        fs::write(root.join("title"), format!("{}\n", ready.title))
            .map_err(|error| format!("Could not write the window title: {error}"))?;

        Ok(())
    }

    fn caller_environment() -> Vec<(String, String)> {
        std::env::vars().collect()
    }

    fn wait_for_ready(log_path: &Path, pid: u32, timeout: Duration) -> Result<Ready, String> {
        let deadline = Instant::now() + timeout;

        loop {
            if let Ok(log) = fs::read_to_string(log_path) {
                for line in log.lines() {
                    if let Ok(ready) = scene::parse_ready(line) {
                        return Ok(ready);
                    }
                }
            }

            if process_start(pid).is_none() {
                return Err(format!(
                    "The scene exited before it printed a ready line; see {}",
                    log_path.display()
                ));
            }

            if Instant::now() >= deadline {
                return Err(format!(
                    "The scene did not print a ready line within {} seconds; see {}",
                    timeout.as_secs(),
                    log_path.display()
                ));
            }

            std::thread::sleep(display::POLL);
        }
    }

    fn focus_window(root: &Path, display: &str) -> Result<(), String> {
        let title = fs::read_to_string(root.join("title"))
            .map_err(|error| format!("Could not read the window title: {error}"))?;
        let title = title.trim().to_string();
        let window = find_window(root, display, &title)?;

        fs::write(root.join("window"), format!("{window}\n"))
            .map_err(|error| format!("Could not write the window id: {error}"))?;

        move_pointer(root, display, &window, FOCUS_X, FOCUS_Y)?;
        std::thread::sleep(INPUT_SETTLE);
        xdotool(root, display, &["click".to_string(), "1".to_string()])
    }

    fn find_window(root: &Path, display: &str, title: &str) -> Result<String, String> {
        let deadline = Instant::now() + WINDOW_TIMEOUT;
        let environment = sandbox_environment(root, display);

        loop {
            let mut command = Command::new("xdotool");
            command
                .args(["search", "--onlyvisible", "--name", title])
                .env_clear()
                .envs(environment.iter().cloned());
            let output = display::run_with_timeout(command, display::TOOL_TIMEOUT)?;

            if output.status.success() {
                let ids: Vec<String> = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .map(str::to_string)
                    .collect();

                match ids.as_slice() {
                    [id] => return Ok(id.clone()),
                    [] => {}
                    _ => {
                        return Err(format!(
                            "Found {} windows titled \"{title}\"; expected one.",
                            ids.len()
                        ));
                    }
                }
            }

            if Instant::now() >= deadline {
                return Err(format!(
                    "The window titled \"{title}\" did not appear within {} seconds.",
                    WINDOW_TIMEOUT.as_secs()
                ));
            }

            std::thread::sleep(display::POLL);
        }
    }

    fn warm_up(root: &Path, display: &str, window: &str) -> Result<(), String> {
        move_pointer(root, display, window, 0, 0)?;
        std::thread::sleep(INPUT_SETTLE);

        Ok(())
    }

    fn glide(
        root: &Path,
        display: &str,
        window: &str,
        from: (i32, i32),
        to: (i32, i32),
    ) -> Result<(), String> {
        for step in 0..=DRAG_STEPS {
            let x = interpolate(from.0, to.0, step);
            let y = interpolate(from.1, to.1, step);

            move_pointer(root, display, window, x, y)?;
            std::thread::sleep(STEP_DELAY);
        }

        Ok(())
    }

    /// Presses button 1, glides, and always releases after a successful press. The motion error is
    /// returned if both the motion and the release fail, so the caller sees the first cause.
    fn drag(
        root: &Path,
        display: &str,
        window: &str,
        from: (i32, i32),
        to: (i32, i32),
    ) -> Result<(), String> {
        warm_up(root, display, window)?;
        move_pointer(root, display, window, from.0, from.1)?;
        std::thread::sleep(CLICK_SETTLE);
        xdotool(root, display, &["mousedown".to_string(), "1".to_string()])?;

        let motion = (|| {
            std::thread::sleep(CLICK_SETTLE);
            glide(root, display, window, from, to)?;
            std::thread::sleep(INPUT_SETTLE);

            Ok(())
        })();
        let released = xdotool(root, display, &["mouseup".to_string(), "1".to_string()]);

        motion.and(released)
    }

    fn interpolate(from: i32, to: i32, step: u32) -> i32 {
        let distance = i64::from(to) - i64::from(from);
        let moved = distance * i64::from(step) / i64::from(DRAG_STEPS);

        (i64::from(from) + moved) as i32
    }

    fn move_pointer(
        root: &Path,
        display: &str,
        window: &str,
        x: i32,
        y: i32,
    ) -> Result<(), String> {
        xdotool(
            root,
            display,
            &[
                "mousemove".to_string(),
                "--window".to_string(),
                window.to_string(),
                x.to_string(),
                y.to_string(),
            ],
        )
    }

    fn xdotool(root: &Path, display: &str, arguments: &[String]) -> Result<(), String> {
        let environment = sandbox_environment(root, display);
        let mut command = Command::new("xdotool");
        command
            .args(arguments)
            .env_clear()
            .envs(environment.iter().cloned());
        let output = display::run_with_timeout(command, display::TOOL_TIMEOUT)?;

        if !output.status.success() {
            return Err(format!(
                "xdotool {} failed: {}",
                arguments.join(" "),
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }

        Ok(())
    }

    fn require_program(name: &str) -> Result<(), String> {
        let path = std::env::var("PATH").unwrap_or_default();

        if find_program(name, &path).is_some() {
            return Ok(());
        }

        Err(tool_error(name))
    }

    fn record_xwayland(root: &Path, display: &str) {
        let Some((weston, _)) = read_record(&root.join("weston.pid")) else {
            return;
        };

        let deadline = Instant::now() + STOP_TIMEOUT;

        loop {
            for pid in child_pids(weston) {
                let Ok(cmdline) = fs::read(format!("/proc/{pid}/cmdline")) else {
                    continue;
                };
                let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

                if cmdline.contains("Xwayland") && cmdline.contains(display) {
                    let _ = record_process(&root.join("xwayland.pid"), pid, "Xwayland");
                    return;
                }
            }

            if Instant::now() >= deadline {
                return;
            }

            std::thread::sleep(display::POLL);
        }
    }

    fn child_pids(parent: u32) -> Vec<u32> {
        let Ok(entries) = fs::read_dir("/proc") else {
            return Vec::new();
        };

        entries
            .flatten()
            .filter_map(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .and_then(|name| name.parse::<u32>().ok())
            })
            .filter(|pid| process_parent(*pid) == Some(parent))
            .collect()
    }

    fn process_parent(pid: u32) -> Option<u32> {
        let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
        let tail = stat.rsplit_once(')')?.1;

        tail.split_whitespace().nth(1)?.parse().ok()
    }

    /// A zombie holds its PID but no longer runs. It is reaped when its parent exits.
    fn process_is_zombie(pid: u32) -> bool {
        let Some(stat) = fs::read_to_string(format!("/proc/{pid}/stat")).ok() else {
            return false;
        };
        let Some(tail) = stat.rsplit_once(')').map(|(_, tail)| tail) else {
            return false;
        };

        tail.split_whitespace().next() == Some("Z")
    }

    fn process_start(pid: u32) -> Option<u64> {
        let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
        let tail = stat.rsplit_once(')')?.1;

        tail.split_whitespace().nth(19)?.parse().ok()
    }

    /// The recorded identity still names the same process. Read again after the pidfd is open so a
    /// reused PID is detected before any signal is sent.
    fn identity_still_matches(pid: u32, started: u64) -> bool {
        process_start(pid) == Some(started)
    }

    fn record_process(path: &Path, pid: u32, expected: &str) -> Result<(), String> {
        let deadline = Instant::now() + STOP_TIMEOUT;

        loop {
            if let Some(started) = process_start(pid) {
                let cmdline = fs::read(format!("/proc/{pid}/cmdline"))
                    .map_err(|error| format!("Could not read the process {pid}: {error}"))?;
                let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

                if cmdline.contains(expected) {
                    return fs::write(path, format!("{pid} {started}\n")).map_err(|error| {
                        format!("Could not record the {expected} process: {error}")
                    });
                }

                if !cmdline.trim().is_empty() {
                    return Err(format!(
                        "The process {pid} is not the expected {expected}. Actual: {cmdline}"
                    ));
                }
            } else {
                return Err(format!(
                    "The {expected} process {pid} is gone before it could be recorded."
                ));
            }

            if Instant::now() >= deadline {
                return Err(format!(
                    "The {expected} process {pid} did not name itself in time."
                ));
            }

            std::thread::sleep(display::POLL);
        }
    }

    fn read_record(path: &Path) -> Option<(u32, u64)> {
        let text = fs::read_to_string(path).ok()?;
        let mut fields = text.split_whitespace();

        Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
    }

    fn record_matches(path: &Path) -> bool {
        let Some((pid, started)) = read_record(path) else {
            return false;
        };

        process_start(pid) == Some(started)
    }

    fn process_is_ours(pid: u32, root: &Path) -> bool {
        let marker = format!("GREPPA_SANDBOX_ROOT={}", root.display());
        let Ok(environment) = fs::read(format!("/proc/{pid}/environ")) else {
            return false;
        };

        String::from_utf8_lossy(&environment)
            .replace('\0', "\n")
            .lines()
            .any(|line| line == marker)
    }

    fn stop_window(root: &Path) -> Result<(), String> {
        let path = root.join("pid");

        let Some((pid, started)) = read_record(&path) else {
            let _ = fs::remove_file(&path);
            return Ok(());
        };

        if process_start(pid) == Some(started) && process_is_ours(pid, root) {
            return stop_process(&path, pid, started);
        }

        let _ = fs::remove_file(&path);

        Ok(())
    }

    fn stop_recorded(path: &Path) -> Result<(), String> {
        let Some((pid, started)) = read_record(path) else {
            let _ = fs::remove_file(path);
            return Ok(());
        };

        if process_start(pid) == Some(started) {
            return stop_process(path, pid, started);
        }

        let _ = fs::remove_file(path);

        Ok(())
    }

    fn stop_process(path: &Path, pid: u32, started: u64) -> Result<(), String> {
        if !identity_still_matches(pid, started) {
            let _ = fs::remove_file(path);
            return Ok(());
        }

        let Some(raw) = rustix::process::Pid::from_raw(pid as i32) else {
            let _ = fs::remove_file(path);
            return Ok(());
        };
        let pidfd = match rustix::process::pidfd_open(raw, rustix::process::PidfdFlags::empty()) {
            Ok(pidfd) => pidfd,
            Err(error) => {
                if !identity_still_matches(pid, started) {
                    let _ = fs::remove_file(path);
                    return Ok(());
                }

                return Err(format!("Could not open the process {pid}: {error}"));
            }
        };

        stop_after_open(path, pid, started, process_start(pid), || {
            let _ = rustix::process::pidfd_send_signal(&pidfd, rustix::process::Signal::TERM);
        })
    }

    /// Guards the post-pidfd identity check. `after_open` is observed after the pidfd is open; a
    /// changed value means the PID was reused, so no signal is sent.
    fn stop_after_open(
        path: &Path,
        pid: u32,
        started: u64,
        after_open: Option<u64>,
        signal: impl FnOnce(),
    ) -> Result<(), String> {
        if after_open != Some(started) {
            let _ = fs::remove_file(path);
            return Ok(());
        }

        signal();
        stop_loop(path, pid, started)
    }

    fn stop_loop(path: &Path, pid: u32, started: u64) -> Result<(), String> {
        let deadline = Instant::now() + STOP_TIMEOUT;

        loop {
            if !identity_still_matches(pid, started) || process_is_zombie(pid) {
                let _ = fs::remove_file(path);
                return Ok(());
            }

            if Instant::now() >= deadline {
                return Err(format!(
                    "The process {pid} did not stop; keeping {}",
                    path.display()
                ));
            }

            std::thread::sleep(display::POLL);
        }
    }

    /// Reads the display this sandbox started and delegates the stale-file cleanup to the shared
    /// display module, so capture and the sandbox use one implementation.
    fn clean_display_files(root: &Path) {
        if let Ok(display) = fs::read_to_string(root.join("display")) {
            display::clean_display_files(display.trim());
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn interpolate_hits_both_ends() {
            assert_eq!(interpolate(10, 20, 0), 10);
            assert_eq!(interpolate(10, 20, DRAG_STEPS), 20);
            assert_eq!(interpolate(20, 10, DRAG_STEPS / 2), 15);
        }

        fn temporary_root(label: &str) -> PathBuf {
            Path::new("/var/tmp").join(format!(
                "greppa-sandbox-test-{label}-{}",
                std::process::id()
            ))
        }

        #[test]
        fn cleanup_refuses_a_symlinked_root_and_leaves_its_target() {
            let root = temporary_root("symlink");
            let target = std::env::temp_dir()
                .join(format!("greppa-sandbox-test-target-{}", std::process::id()));
            let _ = fs::remove_file(&root);
            let _ = fs::remove_dir_all(&target);
            fs::create_dir_all(&target).expect("create the target");
            let marker = target.join("marker");
            fs::write(&marker, "keep").expect("write the marker");
            std::os::unix::fs::symlink(&target, &root).expect("link the root");

            let error = cleanup(&root).expect_err("the symlink is refused");

            assert!(error.contains("symlink"), "unexpected error: {error}");
            assert!(marker.is_file(), "cleanup must not touch the link target");
            assert!(
                fs::symlink_metadata(&root)
                    .expect("the root")
                    .file_type()
                    .is_symlink()
            );

            let _ = fs::remove_file(&root);
            let _ = fs::remove_dir_all(&target);
        }

        #[test]
        fn cleanup_refuses_a_root_that_is_not_private() {
            let root = temporary_root("mode");
            let _ = fs::remove_dir_all(&root);
            fs::create_dir(&root).expect("create the root");
            fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).expect("set the mode");

            let error = cleanup(&root).expect_err("the mode is refused");

            assert!(error.contains("755"), "unexpected error: {error}");
            let metadata = fs::symlink_metadata(&root).expect("the root");
            assert!(metadata.is_dir());
            assert_eq!(metadata.permissions().mode() & 0o777, 0o755);

            let _ = fs::remove_dir_all(&root);
        }

        #[test]
        fn require_up_refuses_a_symlinked_root() {
            let root = temporary_root("up-symlink");
            let target = std::env::temp_dir().join(format!(
                "greppa-sandbox-test-up-target-{}",
                std::process::id()
            ));
            let _ = fs::remove_file(&root);
            let _ = fs::remove_dir_all(&target);
            fs::create_dir_all(&target).expect("create the target");
            let marker = target.join("marker");
            fs::write(&marker, "keep").expect("write the marker");
            std::os::unix::fs::symlink(&target, &root).expect("link the root");

            let error = require_up("test", &root).expect_err("the symlink is refused");

            assert!(error.contains("symlink"), "unexpected error: {error}");
            assert!(marker.is_file(), "the target must not change");
            assert!(
                fs::symlink_metadata(&root)
                    .expect("the root")
                    .file_type()
                    .is_symlink()
            );

            let _ = fs::remove_file(&root);
            let _ = fs::remove_dir_all(&target);
        }

        #[test]
        fn refuse_linked_paths_refuses_a_linked_control_path_and_leaves_it() {
            let root = temporary_root("linked");
            let target = std::env::temp_dir().join(format!(
                "greppa-sandbox-test-linked-target-{}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&root);
            let _ = fs::remove_dir_all(&target);
            fs::create_dir_all(&root).expect("create the root");
            fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).expect("secure the root");
            fs::create_dir_all(&target).expect("create the target");
            let marker = target.join("marker");
            fs::write(&marker, "keep").expect("write the marker");
            let link = root.join("run");
            std::os::unix::fs::symlink(&target, &link).expect("link the control path");

            let error = refuse_linked_paths(&root).expect_err("the linked path is refused");

            assert!(error.contains("symlinked"), "unexpected error: {error}");
            assert!(marker.is_file(), "the target must not change");
            assert!(
                fs::symlink_metadata(&link)
                    .expect("the link")
                    .file_type()
                    .is_symlink()
            );

            let _ = fs::remove_dir_all(&root);
            let _ = fs::remove_dir_all(&target);
        }

        #[test]
        fn identity_still_matches_rejects_a_changed_start_time() {
            let pid = std::process::id();
            let started = process_start(pid).expect("the test process has a start time");

            assert!(identity_still_matches(pid, started));
            assert!(!identity_still_matches(pid, started + 1));
        }

        #[test]
        fn record_matches_rejects_a_changed_start_time() {
            let path = std::env::temp_dir()
                .join(format!("greppa-sandbox-test-record-{}", std::process::id()));
            let pid = std::process::id();
            let started = process_start(pid).expect("the test process has a start time");

            fs::write(&path, format!("{pid} {started}\n")).expect("write the matching record");
            assert!(record_matches(&path));

            fs::write(&path, format!("{pid} {}\n", started + 1)).expect("write the changed record");
            assert!(!record_matches(&path));

            let _ = fs::remove_file(&path);
        }

        #[test]
        fn stop_process_skips_a_mismatched_start_time() {
            let path = std::env::temp_dir()
                .join(format!("greppa-sandbox-test-stop-{}", std::process::id()));
            let pid = std::process::id();
            let started = process_start(pid).expect("the test process has a start time");

            fs::write(&path, format!("{pid} {started}\n")).expect("write the record");
            let result = stop_process(&path, pid, started + 1);

            assert!(result.is_ok());
            assert!(!path.exists(), "a mismatched record is removed");
        }

        #[test]
        fn stop_after_open_refuses_a_changed_identity_without_signaling() {
            let path = std::env::temp_dir().join(format!(
                "greppa-sandbox-test-after-open-{}",
                std::process::id()
            ));
            let pid = std::process::id();
            let started = process_start(pid).expect("the test process has a start time");
            fs::write(&path, format!("{pid} {started}\n")).expect("write the record");

            let mut signaled = false;
            let result =
                stop_after_open(&path, pid, started, Some(started + 1), || signaled = true);

            assert!(result.is_ok());
            assert!(!signaled, "a changed identity must not signal");
            assert!(!path.exists(), "the stale record is removed");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn parse_reads_every_command() {
        assert_eq!(
            parse(&["up".to_string(), "smoke-2".to_string()]),
            Ok(Sandbox::Up {
                scene: "smoke-2".to_string(),
                headed: false,
            })
        );
        assert_eq!(
            parse(&[
                "up".to_string(),
                "--headed".to_string(),
                "smoke-2".to_string()
            ]),
            Ok(Sandbox::Up {
                scene: "smoke-2".to_string(),
                headed: true,
            })
        );
        assert_eq!(
            parse(&["restart".to_string()]),
            Ok(Sandbox::Restart {
                scene: None,
                headed: None,
            })
        );
        assert_eq!(
            parse(&[
                "restart".to_string(),
                "--headed".to_string(),
                "smoke-3".to_string()
            ]),
            Ok(Sandbox::Restart {
                scene: Some("smoke-3".to_string()),
                headed: Some(true),
            })
        );
        assert_eq!(
            parse(&["shot".to_string(), "out.png".to_string()]),
            Ok(Sandbox::Shot {
                file: Some(PathBuf::from("out.png"))
            })
        );
        assert_eq!(
            parse(&[
                "move".to_string(),
                "1".to_string(),
                "2".to_string(),
                "3".to_string(),
                "4".to_string()
            ]),
            Ok(Sandbox::Move {
                from: (1, 2),
                to: (3, 4)
            })
        );
        assert_eq!(
            parse(&["click".to_string(), "10".to_string(), "20".to_string()]),
            Ok(Sandbox::Click {
                x: 10,
                y: 20,
                button: 1
            })
        );
        assert_eq!(
            parse(&[
                "click".to_string(),
                "10".to_string(),
                "20".to_string(),
                "3".to_string()
            ]),
            Ok(Sandbox::Click {
                x: 10,
                y: 20,
                button: 3
            })
        );
        assert_eq!(
            parse(&[
                "drag".to_string(),
                "1".to_string(),
                "2".to_string(),
                "3".to_string(),
                "4".to_string()
            ]),
            Ok(Sandbox::Drag {
                from: (1, 2),
                to: (3, 4)
            })
        );
        assert_eq!(
            parse(&["type".to_string(), "hello".to_string(), "world".to_string()]),
            Ok(Sandbox::Type {
                text: "hello world".to_string()
            })
        );
        assert_eq!(
            parse(&["key".to_string(), "p".to_string(), "Control_L".to_string()]),
            Ok(Sandbox::Key {
                key: "p".to_string(),
                modifiers: vec!["Control_L".to_string()]
            })
        );
        assert_eq!(parse(&["log".to_string()]), Ok(Sandbox::Log));
        assert_eq!(parse(&["down".to_string()]), Ok(Sandbox::Down));
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
        assert_eq!(sandbox_name(None), Ok("greppa".to_string()));
        assert_eq!(sandbox_name(Some("alpha-2")), Ok("alpha-2".to_string()));
        assert_eq!(sandbox_name(Some("2")), Ok("2".to_string()));
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
    fn root_path_is_under_the_temporary_folder() {
        assert_eq!(
            root_path("smoke"),
            PathBuf::from("/var/tmp/greppa-sandbox-smoke")
        );
    }

    #[test]
    fn remove_root_accepts_only_sandbox_folders() {
        assert!(remove_root_allowed(Path::new(
            "/var/tmp/greppa-sandbox-smoke"
        )));
        assert!(!remove_root_allowed(Path::new("/var/tmp/other")));
        assert!(!remove_root_allowed(Path::new(
            "/home/user/greppa-sandbox-smoke"
        )));
        assert!(!remove_root_allowed(Path::new("/var/tmp/greppa-sandbox-")));
    }

    #[test]
    fn root_metadata_problem_names_each_reason() {
        let good = RootMetadata {
            is_symlink: false,
            is_dir: true,
            owner: 1000,
            mode: 0o700,
        };

        assert_eq!(root_metadata_problem(&good, 1000), None);
        assert_eq!(
            root_metadata_problem(
                &RootMetadata {
                    is_symlink: true,
                    ..good
                },
                1000
            ),
            Some("it is a symlink".to_string())
        );
        assert_eq!(
            root_metadata_problem(
                &RootMetadata {
                    is_dir: false,
                    ..good
                },
                1000
            ),
            Some("it is not a folder".to_string())
        );
        assert_eq!(
            root_metadata_problem(&good, 1001),
            Some("it is not owned by the current user".to_string())
        );
        assert_eq!(
            root_metadata_problem(
                &RootMetadata {
                    mode: 0o755,
                    ..good
                },
                1000
            ),
            Some("its mode is 755, not 700".to_string())
        );
    }

    #[test]
    fn linked_paths_lists_control_files() {
        let paths = linked_paths(Path::new("/var/tmp/greppa-sandbox-smoke"));

        assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/display")));
        assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/run")));
        assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/bin")));
    }

    #[test]
    fn find_program_uses_the_given_path() {
        let directory = std::env::temp_dir().join(format!("greppa-find-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).expect("create the test directory");
        let program = directory.join("fake-tool");
        std::fs::write(&program, "#!/bin/sh\n").expect("write the fake tool");

        let found = find_program("fake-tool", &directory.to_string_lossy());
        assert_eq!(found, Some(program));
        assert_eq!(find_program("fake-tool", "/nonexistent"), None);

        let _ = std::fs::remove_dir_all(&directory);
    }

    #[test]
    fn tool_error_names_the_tool_and_package() {
        assert!(tool_error("xdotool").contains("xdotool"));
        assert!(tool_error("Xwayland").contains("xorg-xwayland"));
        assert!(tool_error("import").contains("imagemagick"));
    }
}
