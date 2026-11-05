use std::fs;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use anyhow::Context as _;

use crate::cleanup;
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

    if let Err(error) = record_process(&root.join("pid"), pid, &binary.to_string_lossy()) {
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
            anyhow::bail!(
                "The scene exited before it printed a ready line; see {}",
                log_path.display()
            );
        }

        if Instant::now() >= deadline {
            anyhow::bail!(
                "The scene did not print a ready line within {} seconds; see {}",
                timeout.as_secs(),
                log_path.display()
            );
        }

        std::thread::sleep(process::POLL);
    }
}
