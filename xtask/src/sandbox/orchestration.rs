use std::fs;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{ExitCode, Stdio};

use crate::display;
use crate::scene;

use super::command::{Sandbox, require_program};
use super::environment::{nested_weston_environment, sandbox_environment, weston_environment};
use super::identity::{
    record_matches, record_process, record_xwayland, stop_recorded, stop_window,
};
use super::input::{
    CLICK_SETTLE, drag, focus_window, glide, move_pointer, warm_up, window_id, xdotool,
};
use super::root::{
    install_openers, prepare_root, refuse_linked_paths, refuse_unsafe_root, remove_root,
    require_trusted_root, root_path, socket_name,
};
use super::scene_start::start_scene;

const WINDOW_WIDTH: u32 = 1400;
const WINDOW_HEIGHT: u32 = 900;

#[expect(
    clippy::print_stderr,
    reason = "failure messages are the command's output"
)]
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

// Runs before anything changes, so a failed check leaves a running sandbox as it was.
fn prepare_scene(
    workspace: &Path,
    root: &Path,
    scene_name: &str,
) -> Result<(PathBuf, String), String> {
    if scene_name == "app" {
        return Err(
            "The real app has no window yet. Use a scene name such as smoke-2.".to_string(),
        );
    }

    let binary = scene::build(workspace)?;
    let names = scene::names(&binary, &weston_environment(root))?;
    let scene = scene::validate_scene(scene_name, &names)?;

    Ok((binary, scene))
}

fn start_window(
    workspace: &Path,
    name: &str,
    root: &Path,
    scene_name: &str,
    headed: bool,
) -> Result<(), String> {
    let (binary, scene) = prepare_scene(workspace, root, scene_name)?;
    let outcome = start_window_inner(name, root, &binary, &scene, headed);

    if outcome.is_err() {
        let _ = cleanup(root);
    }

    outcome
}

#[expect(
    clippy::print_stdout,
    reason = "the display and log path are the command's output"
)]
fn start_window_inner(
    name: &str,
    root: &Path,
    binary: &Path,
    scene: &str,
    headed: bool,
) -> Result<(), String> {
    prepare_root(root)?;

    let display = ensure_display(name, root, headed)?;

    install_openers(root)?;
    let ready = start_scene(root, binary, scene, &display)?;
    focus_window(root, &display, &ready.title)?;
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

#[expect(clippy::print_stdout, reason = "the shot path is the command's output")]
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

#[expect(clippy::print_stdout, reason = "the scene log is the command's output")]
fn log(root: &Path) -> Result<(), String> {
    require_trusted_root(root)?;

    let log = fs::read_to_string(root.join("scene.log"))
        .map_err(|error| format!("Could not read the scene log: {error}"))?;

    print!("{log}");

    Ok(())
}

#[expect(
    clippy::print_stdout,
    reason = "the opened links are the command's output"
)]
fn opened(root: &Path) -> Result<(), String> {
    require_trusted_root(root)?;

    match fs::read_to_string(root.join("opened")) {
        Ok(opened) => print!("{opened}"),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not read the opened links: {error}")),
    }

    Ok(())
}

#[expect(
    clippy::print_stdout,
    reason = "the sandbox state is the command's output"
)]
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

fn clean_display_files(root: &Path) {
    if let Ok(display) = fs::read_to_string(root.join("display")) {
        display::clean_display_files(display.trim());
    }
}

#[cfg(test)]
mod tests {
    use std::os::unix::fs::PermissionsExt;
    use std::path::{Path, PathBuf};

    use super::*;

    fn temporary_root(label: &str) -> PathBuf {
        Path::new("/var/tmp").join(format!(
            "greppa-sandbox-test-{label}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn a_refused_scene_leaves_a_running_sandbox_alone() {
        let root = temporary_root("preflight");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir(&root).expect("create the root");
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).expect("make it private");
        let marker = root.join("scene");
        fs::write(&marker, "smoke-2\n").expect("write the scene record");

        let error = start_window(Path::new("/nonexistent"), "preflight", &root, "app", false)
            .expect_err("the app scene is refused");

        assert!(error.contains("no window yet"), "unexpected error: {error}");
        assert!(
            marker.is_file(),
            "a refused scene must not tear the sandbox down"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn cleanup_refuses_a_symlinked_root_and_leaves_its_target() {
        let root = temporary_root("symlink");
        let target =
            std::env::temp_dir().join(format!("greppa-sandbox-test-target-{}", std::process::id()));
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
}
