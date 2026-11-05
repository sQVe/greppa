//! Scene startup: write the scene log, record the scene PID, and wait for its ready line.

use std::fs;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::process;
use crate::scene::{self, Ready};

use super::environment::sandbox_environment;
use super::identity::{process_start, record_process, stop_window};

const READY_TIMEOUT: Duration = Duration::from_secs(60);

pub(super) fn start_scene(
    root: &Path,
    binary: &Path,
    scene: &str,
    display: &str,
) -> Result<Ready, String> {
    stop_window(root)?;

    let log_path = root.join("scene.log");
    let _ = fs::remove_file(&log_path);
    let log = fs::File::create(&log_path)
        .map_err(|error| format!("Could not create {}: {error}", log_path.display()))?;
    let errors = log
        .try_clone()
        .map_err(|error| format!("Could not open {} for writing: {error}", log_path.display()))?;

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

    Ok(ready)
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

        std::thread::sleep(process::POLL);
    }
}
