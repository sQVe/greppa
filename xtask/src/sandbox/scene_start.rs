use std::fs;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;

use anyhow::Context as _;

use crate::cleanup;
use crate::process::poll_until;
use crate::scene::{self, Ready};

use super::environment::sandbox_environment;
use super::identity::{STOP_TIMEOUT, process_start, record_process, stop_window};

const READY_TIMEOUT: Duration = Duration::from_secs(60);

pub(super) fn start_scene(
    root: &Path,
    binary: &Path,
    scene: &str,
    display: &str,
) -> anyhow::Result<Ready> {
    stop_window(root)?;

    let log_path = root.join("scene.log");
    cleanup::remove_file(&log_path);
    let log = fs::File::create(&log_path)
        .with_context(|| format!("Could not create {}", log_path.display()))?;
    let errors = log
        .try_clone()
        .with_context(|| format!("Could not open {} for writing", log_path.display()))?;

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
        .with_context(|| "Could not start the scene")?;
    let pid = child.id();

    if let Err(error) = record_process(
        &root.join("pid"),
        pid,
        &binary.to_string_lossy(),
        STOP_TIMEOUT,
    ) {
        cleanup::stop_child(&mut child);
        return Err(error);
    }

    drop(child);

    let ready = wait_for_ready(&log_path, pid, READY_TIMEOUT)?;

    fs::write(root.join("scene"), format!("{scene}\n"))
        .with_context(|| "Could not write the scene name")?;

    Ok(ready)
}

fn wait_for_ready(log_path: &Path, pid: u32, timeout: Duration) -> anyhow::Result<Ready> {
    let ready = poll_until(timeout, || {
        if let Ok(log) = fs::read_to_string(log_path) {
            for line in log.lines() {
                if let Ok(ready) = scene::parse_ready(line) {
                    return Ok(Some(ready));
                }
            }
        }

        if process_start(pid).is_none() {
            anyhow::bail!(
                "The scene exited before it printed a ready line; see {}",
                log_path.display()
            );
        }

        Ok(None)
    })?;

    ready.ok_or_else(|| {
        anyhow::anyhow!(
            "The scene did not print a ready line within {} seconds; see {}",
            timeout.as_secs(),
            log_path.display()
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ready_line() -> String {
        r#"{"scene":"smoke-2","origin":{"x":0.0,"y":0.0},"size":{"width":1400.0,"height":900.0},"scale":1.0,"title":"greppa smoke-2"}"#
            .to_string()
    }

    #[test]
    fn wait_for_ready_returns_a_printed_ready_line() {
        let folder = crate::test_support::temporary_directory();
        let log = folder.path().join("scene.log");
        fs::write(&log, format!("noise\n{}\n", ready_line())).expect("write the log");

        let ready =
            wait_for_ready(&log, std::process::id(), Duration::from_secs(1)).expect("a ready line");

        assert_eq!(ready.scene, "smoke-2");
    }

    #[test]
    fn wait_for_ready_parses_the_log_before_it_reports_a_missing_process() {
        let folder = crate::test_support::temporary_directory();
        let log = folder.path().join("scene.log");
        fs::write(&log, format!("{}\n", ready_line())).expect("write the log");

        let ready = wait_for_ready(&log, u32::MAX, Duration::from_secs(1))
            .expect("the ready line wins over the exit check");

        assert_eq!(ready.scene, "smoke-2");
    }

    #[test]
    fn wait_for_ready_reports_a_scene_that_exited() {
        let folder = crate::test_support::temporary_directory();
        let log = folder.path().join("scene.log");
        fs::write(&log, "no ready line here\n").expect("write the log");

        let error = wait_for_ready(&log, u32::MAX, Duration::from_secs(1))
            .expect_err("a missing process is reported");

        assert_eq!(
            error.to_string(),
            format!(
                "The scene exited before it printed a ready line; see {}",
                log.display()
            )
        );
    }
}
