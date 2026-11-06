use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use anyhow::Context as _;

use crate::display;
use crate::scene;

use super::command::{Sandbox, require_program};
use super::display_start::{
    clean_display_files, display_up, ensure_display, recorded_mode, require_headed_session,
};
use super::environment::{sandbox_environment, weston_environment};
use super::identity::{record_xwayland, stop_recorded, stop_window};
use super::input::{
    CLICK_SETTLE, drag, focus_window, glide, move_pointer, warm_up, window_id, xdotool,
};
use super::root::{
    install_openers, prepare_root, refuse_linked_paths, refuse_unsafe_root, remove_root,
    require_trusted_root, root_path,
};
use super::scene_start::start_scene;

#[expect(
    clippy::print_stderr,
    reason = "failure messages are the command's output"
)]
pub(super) fn run(workspace: &Path, name: &str, command: Sandbox) -> ExitCode {
    match execute(workspace, name, command) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error:#}");
            ExitCode::FAILURE
        }
    }
}

fn execute(workspace: &Path, name: &str, command: Sandbox) -> anyhow::Result<()> {
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
) -> anyhow::Result<()> {
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
) -> anyhow::Result<()> {
    require_program("weston")?;
    require_program("Xwayland")?;
    require_program("xdotool")?;

    require_trusted_root(root)?;

    let headed = headed.unwrap_or_else(|| recorded_mode(root).as_deref() == Some("headed"));
    require_headed_session(headed)?;

    let scene = recorded_scene(root, scene_name)?;

    start_window(workspace, name, root, &scene, headed)
}

fn recorded_scene(root: &Path, scene_name: Option<&str>) -> anyhow::Result<String> {
    require_trusted_root(root)?;

    if let Some(scene) = scene_name {
        return Ok(scene.to_string());
    }

    fs::read_to_string(root.join("scene"))
        .map(|scene| scene.trim().to_string())
        .map_err(|_| {
            anyhow::anyhow!("The sandbox is not up; run 'cargo xtask sandbox up <scene>' first.")
        })
}

// Runs before anything changes, so a failed check leaves a running sandbox as it was.
fn prepare_scene(
    workspace: &Path,
    root: &Path,
    scene_name: &str,
) -> anyhow::Result<(PathBuf, String)> {
    if scene_name == "app" {
        anyhow::bail!("The real app has no window yet. Use a scene name such as smoke-2.");
    }

    let binary = scene::build(workspace)?;
    let names = scene::names(&binary, &weston_environment(root))?;
    let scene = scene::validate_scene(scene_name, &names)?;

    Ok((binary, scene))
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure after a failed start must not hide the start error"
)]
fn start_window(
    workspace: &Path,
    name: &str,
    root: &Path,
    scene_name: &str,
    headed: bool,
) -> anyhow::Result<()> {
    let (binary, scene) = prepare_scene(workspace, root, scene_name)?;

    match start_window_inner(name, root, &binary, &scene, headed) {
        Ok(()) => Ok(()),
        Err(error) => {
            if let Err(cleanup_error) = cleanup(root) {
                eprintln!("Could not clean up after the failed start: {cleanup_error:#}");
            }

            Err(error)
        }
    }
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
) -> anyhow::Result<()> {
    prepare_root(root)?;

    let display = ensure_display(name, root, headed)?;

    install_openers(root)?;
    let ready = start_scene(root, binary, scene, &display)?;
    focus_window(root, &display, &ready.title)?;
    record_xwayland(root, &display)?;

    println!(
        "sandbox {name} is up on {display} (log: {})",
        root.join("scene.log").display()
    );

    Ok(())
}

fn with_window<F>(name: &str, root: &Path, action: F) -> anyhow::Result<()>
where
    F: FnOnce(&str, &str) -> anyhow::Result<()>,
{
    require_program("xdotool")?;

    let display = require_up(name, root)?;
    let window = window_id(root)?;

    action(&display, &window)
}

fn require_up(name: &str, root: &Path) -> anyhow::Result<String> {
    require_trusted_root(root)?;

    let display = display_up(root).ok_or_else(|| {
        anyhow::anyhow!("sandbox {name} is not up; run 'cargo xtask sandbox up <scene>' first")
    })?;

    if !root.join("window").is_file() {
        anyhow::bail!("sandbox {name} is not up; run 'cargo xtask sandbox up <scene>' first");
    }

    Ok(display)
}

#[expect(clippy::print_stdout, reason = "the shot path is the command's output")]
fn shot(name: &str, root: &Path, file: Option<PathBuf>) -> anyhow::Result<()> {
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
fn log(root: &Path) -> anyhow::Result<()> {
    require_trusted_root(root)?;

    let log = fs::read_to_string(root.join("scene.log"))
        .with_context(|| "Could not read the scene log")?;

    print!("{log}");

    Ok(())
}

#[expect(
    clippy::print_stdout,
    reason = "the opened links are the command's output"
)]
fn opened(root: &Path) -> anyhow::Result<()> {
    require_trusted_root(root)?;

    match fs::read_to_string(root.join("opened")) {
        Ok(opened) => print!("{opened}"),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(error).with_context(|| "Could not read the opened links");
        }
    }

    Ok(())
}

#[expect(
    clippy::print_stdout,
    reason = "the sandbox state is the command's output"
)]
fn down(name: &str, root: &Path) -> anyhow::Result<()> {
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
fn cleanup(root: &Path) -> anyhow::Result<()> {
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

#[cfg(test)]
mod tests {
    use std::os::unix::fs::PermissionsExt;

    use super::super::root::{RootError, RootReason};
    use super::*;

    #[test]
    fn a_refused_scene_leaves_a_running_sandbox_alone() {
        let root = crate::test_support::temporary_sandbox_root("preflight");
        let marker = root.path().join("scene");
        fs::write(&marker, "smoke-2\n").expect("write the scene record");

        let error = start_window(
            Path::new("/nonexistent"),
            "preflight",
            root.path(),
            "app",
            false,
        )
        .expect_err("the app scene is refused");

        assert_eq!(
            error.to_string(),
            "The real app has no window yet. Use a scene name such as smoke-2."
        );
        assert!(
            marker.is_file(),
            "a refused scene must not tear the sandbox down"
        );
    }

    #[test]
    fn cleanup_refuses_a_symlinked_root_and_leaves_its_target() {
        let folder = crate::test_support::temporary_directory();
        let target = crate::test_support::temporary_directory();
        let marker = target.path().join("marker");
        fs::write(&marker, "keep").expect("write the marker");
        let root = folder.path().join("root");
        std::os::unix::fs::symlink(target.path(), &root).expect("link the root");

        let error = cleanup(&root).expect_err("the symlink is refused");
        let root_error = error
            .downcast_ref::<RootError>()
            .expect("the refusal is a root error");

        assert!(
            matches!(
                root_error,
                RootError::Unsafe {
                    path,
                    reason: RootReason::Symlink,
                } if path == &root
            ),
            "unexpected error: {error:#}"
        );
        assert!(marker.is_file(), "cleanup must not touch the link target");
        assert!(
            fs::symlink_metadata(&root)
                .expect("the root")
                .file_type()
                .is_symlink()
        );
    }

    #[test]
    fn cleanup_refuses_a_root_that_is_not_private() {
        let root = crate::test_support::temporary_sandbox_root("mode");
        fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("set the mode");

        let error = cleanup(root.path()).expect_err("the mode is refused");
        let root_error = error
            .downcast_ref::<RootError>()
            .expect("the refusal is a root error");

        assert!(
            matches!(
                root_error,
                RootError::Unsafe {
                    path,
                    reason: RootReason::WrongMode { mode: 0o755 },
                } if path.as_path() == root.path()
            ),
            "unexpected error: {error:#}"
        );
        let metadata = fs::symlink_metadata(root.path()).expect("the root");
        assert!(metadata.is_dir());
        assert_eq!(metadata.permissions().mode() & 0o777, 0o755);
    }

    #[test]
    fn require_up_refuses_a_symlinked_root() {
        let folder = crate::test_support::temporary_directory();
        let target = crate::test_support::temporary_directory();
        let marker = target.path().join("marker");
        fs::write(&marker, "keep").expect("write the marker");
        let root = folder.path().join("root");
        std::os::unix::fs::symlink(target.path(), &root).expect("link the root");

        let error = require_up("test", &root).expect_err("the symlink is refused");
        let root_error = error
            .downcast_ref::<RootError>()
            .expect("the refusal is a root error");

        assert!(
            matches!(
                root_error,
                RootError::Unsafe {
                    path,
                    reason: RootReason::Symlink,
                } if path == &root
            ),
            "unexpected error: {error:#}"
        );
        assert!(marker.is_file(), "the target must not change");
        assert!(
            fs::symlink_metadata(&root)
                .expect("the root")
                .file_type()
                .is_symlink()
        );
    }

    #[test]
    fn recorded_scene_reports_a_missing_record() {
        let root = crate::test_support::temporary_sandbox_root("recorded-scene");

        let error = recorded_scene(root.path(), None).expect_err("a missing record fails");

        assert_eq!(
            error.to_string(),
            "The sandbox is not up; run 'cargo xtask sandbox up <scene>' first."
        );
    }

    #[test]
    fn a_failed_start_keeps_its_error_when_cleanup_fails() {
        let root = crate::test_support::temporary_sandbox_root("failed-start");
        let workspace = crate::workspace_root();
        fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("set the mode");

        let error = start_window(&workspace, "test", root.path(), "app", false)
            .expect_err("the start fails");

        assert_eq!(
            error.to_string(),
            "The real app has no window yet. Use a scene name such as smoke-2."
        );
    }
}
