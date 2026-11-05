use std::fs;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::Context as _;

use crate::cleanup;
use crate::display;

use super::environment::{nested_weston_environment, weston_environment};
use super::identity::{STOP_TIMEOUT, record_matches, record_process, stop_recorded};
use super::root::{prepare_root, socket_name};

const WINDOW_WIDTH: u32 = 1400;
const WINDOW_HEIGHT: u32 = 900;

pub(super) fn ensure_display(name: &str, root: &Path, headed: bool) -> anyhow::Result<String> {
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
    cleanup::remove_file(&log);
    cleanup::remove_file(&root.join("display"));
    cleanup::remove_file(&root.join("xwayland.pid"));

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

    let mut child = command.spawn().with_context(|| "Could not start weston")?;
    let pid = child.id();

    if let Err(error) = record_process(&root.join("weston.pid"), pid, "weston", STOP_TIMEOUT) {
        cleanup::stop_child(&mut child);
        return Err(error);
    }

    drop(child);

    let display = display::wait_for_display(&log, display::WESTON_TIMEOUT)?;
    fs::write(root.join("display"), format!("{display}\n"))
        .with_context(|| "Could not write the display file")?;
    fs::write(root.join("mode"), format!("{mode}\n"))
        .with_context(|| "Could not write the sandbox mode")?;

    Ok(display)
}

pub(super) fn display_up(root: &Path) -> Option<String> {
    if !record_matches(&root.join("weston.pid")) {
        return None;
    }

    let display = fs::read_to_string(root.join("display")).ok()?;
    let display = display.trim().to_string();

    display.starts_with(':').then_some(display)
}

pub(super) fn recorded_mode(root: &Path) -> Option<String> {
    fs::read_to_string(root.join("mode"))
        .ok()
        .map(|mode| mode.trim().to_string())
}

pub(super) fn require_headed_session(headed: bool) -> anyhow::Result<()> {
    if headed {
        wayland_display()?;
        caller_runtime_dir()?;
    }

    Ok(())
}

fn wayland_display() -> anyhow::Result<String> {
    match std::env::var("WAYLAND_DISPLAY") {
        Ok(display) if !display.trim().is_empty() => Ok(display),
        _ => anyhow::bail!(
            "Headed mode needs WAYLAND_DISPLAY. Run it from the Wayland session, or leave out --headed."
        ),
    }
}

fn caller_runtime_dir() -> anyhow::Result<PathBuf> {
    match std::env::var("XDG_RUNTIME_DIR") {
        Ok(directory) if directory.starts_with('/') => Ok(PathBuf::from(directory)),
        _ => anyhow::bail!(
            "Headed mode needs an absolute XDG_RUNTIME_DIR to reach the Wayland socket."
        ),
    }
}

pub(super) fn clean_display_files(root: &Path) {
    if let Ok(display) = fs::read_to_string(root.join("display")) {
        display::clean_display_files(display.trim());
    }
}
