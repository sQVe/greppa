use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

use anyhow::Context as _;

use crate::process;

use super::environment::sandbox_environment;

const WINDOW_TIMEOUT: Duration = Duration::from_secs(10);
const INPUT_SETTLE: Duration = Duration::from_millis(150);
pub(super) const CLICK_SETTLE: Duration = Duration::from_millis(200);
const STEP_DELAY: Duration = Duration::from_millis(16);
const DRAG_STEPS: u32 = 24;
const FOCUS_X: i32 = 5;
const FOCUS_Y: i32 = 5;

pub(super) fn window_id(root: &Path) -> anyhow::Result<String> {
    let window =
        fs::read_to_string(root.join("window")).with_context(|| "Could not read the window id")?;
    let window = window.trim().to_string();

    if window.is_empty() || !window.chars().all(|character| character.is_ascii_digit()) {
        anyhow::bail!("The recorded window id \"{window}\" is not numeric.");
    }

    Ok(window)
}

pub(super) fn focus_window(root: &Path, display: &str, title: &str) -> anyhow::Result<()> {
    let window = find_window(root, display, title)?;

    fs::write(root.join("window"), format!("{window}\n"))
        .with_context(|| "Could not write the window id")?;

    move_pointer(root, display, &window, FOCUS_X, FOCUS_Y)?;
    std::thread::sleep(INPUT_SETTLE);
    xdotool(root, display, &["click".to_string(), "1".to_string()])
}

fn find_window(root: &Path, display: &str, title: &str) -> anyhow::Result<String> {
    let deadline = Instant::now() + WINDOW_TIMEOUT;
    let environment = sandbox_environment(root, display);

    loop {
        let mut command = Command::new("xdotool");
        command
            .args(["search", "--onlyvisible", "--name", title])
            .env_clear()
            .envs(environment.iter().cloned());
        let output = process::run_with_timeout(command, process::TOOL_TIMEOUT)?;

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
                    anyhow::bail!(
                        "Found {} windows titled \"{title}\"; expected one.",
                        ids.len()
                    );
                }
            }
        }

        if Instant::now() >= deadline {
            anyhow::bail!(
                "The window titled \"{title}\" did not appear within {} seconds.",
                WINDOW_TIMEOUT.as_secs()
            );
        }

        std::thread::sleep(process::POLL);
    }
}

pub(super) fn warm_up(root: &Path, display: &str, window: &str) -> anyhow::Result<()> {
    move_pointer(root, display, window, 0, 0)?;
    std::thread::sleep(INPUT_SETTLE);

    Ok(())
}

pub(super) fn glide(
    root: &Path,
    display: &str,
    window: &str,
    from: (i32, i32),
    to: (i32, i32),
) -> anyhow::Result<()> {
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
pub(super) fn drag(
    root: &Path,
    display: &str,
    window: &str,
    from: (i32, i32),
    to: (i32, i32),
) -> anyhow::Result<()> {
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

pub(super) fn move_pointer(
    root: &Path,
    display: &str,
    window: &str,
    x: i32,
    y: i32,
) -> anyhow::Result<()> {
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

pub(super) fn xdotool(root: &Path, display: &str, arguments: &[String]) -> anyhow::Result<()> {
    let environment = sandbox_environment(root, display);
    let mut command = Command::new("xdotool");
    command
        .args(arguments)
        .env_clear()
        .envs(environment.iter().cloned());
    let output = process::run_with_timeout(command, process::TOOL_TIMEOUT)?;

    if !output.status.success() {
        anyhow::bail!(
            "xdotool {} failed: {}",
            arguments.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    Ok(())
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
}
