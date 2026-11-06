use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::Context as _;

use crate::cleanup;
use crate::process;

const STOP_TIMEOUT: Duration = Duration::from_secs(5);

pub(super) fn record_xwayland(root: &Path, display: &str) -> anyhow::Result<()> {
    let Some((weston, _)) = read_record(&root.join("weston.pid")) else {
        return Ok(());
    };

    let deadline = Instant::now() + STOP_TIMEOUT;

    loop {
        for pid in child_pids(weston) {
            let Ok(cmdline) = fs::read(format!("/proc/{pid}/cmdline")) else {
                continue;
            };
            let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

            if cmdline.contains("Xwayland") && cmdline.contains(display) {
                record_process(&root.join("xwayland.pid"), pid, "Xwayland")?;
                return Ok(());
            }
        }

        if Instant::now() >= deadline {
            return Ok(());
        }

        std::thread::sleep(process::POLL);
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

fn process_is_zombie(pid: u32) -> bool {
    let Some(stat) = fs::read_to_string(format!("/proc/{pid}/stat")).ok() else {
        return false;
    };
    let Some(tail) = stat.rsplit_once(')').map(|(_, tail)| tail) else {
        return false;
    };

    tail.split_whitespace().next() == Some("Z")
}

pub(super) fn process_start(pid: u32) -> Option<u64> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let tail = stat.rsplit_once(')')?.1;

    tail.split_whitespace().nth(19)?.parse().ok()
}

/// The recorded identity still names the same process. Read again after the pidfd is open so a
/// reused PID is detected before any signal is sent.
fn identity_still_matches(pid: u32, started: u64) -> bool {
    process_start(pid) == Some(started)
}

pub(super) fn record_process(path: &Path, pid: u32, expected: &str) -> anyhow::Result<()> {
    let deadline = Instant::now() + STOP_TIMEOUT;

    loop {
        if let Some(started) = process_start(pid) {
            let cmdline = fs::read(format!("/proc/{pid}/cmdline"))
                .with_context(|| format!("Could not read the process {pid}"))?;
            let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

            if cmdline.contains(expected) {
                return fs::write(path, format!("{pid} {started}\n"))
                    .with_context(|| format!("Could not record the {expected} process"));
            }

            if !cmdline.trim().is_empty() {
                anyhow::bail!(
                    "The process {pid} is not the expected {expected}. Actual: {cmdline}"
                );
            }
        } else {
            anyhow::bail!("The {expected} process {pid} is gone before it could be recorded.");
        }

        if Instant::now() >= deadline {
            anyhow::bail!("The {expected} process {pid} did not name itself in time.");
        }

        std::thread::sleep(process::POLL);
    }
}

fn read_record(path: &Path) -> Option<(u32, u64)> {
    let text = fs::read_to_string(path).ok()?;
    let mut fields = text.split_whitespace();

    Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
}

pub(super) fn record_matches(path: &Path) -> bool {
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

pub(super) fn stop_window(root: &Path) -> anyhow::Result<()> {
    let path = root.join("pid");

    let Some((pid, started)) = read_record(&path) else {
        cleanup::remove_file(&path);
        return Ok(());
    };

    if process_start(pid) == Some(started) && process_is_ours(pid, root) {
        return stop_process(&path, pid, started);
    }

    cleanup::remove_file(&path);

    Ok(())
}

pub(super) fn stop_recorded(path: &Path) -> anyhow::Result<()> {
    let Some((pid, started)) = read_record(path) else {
        cleanup::remove_file(path);
        return Ok(());
    };

    if process_start(pid) == Some(started) {
        return stop_process(path, pid, started);
    }

    cleanup::remove_file(path);

    Ok(())
}

fn stop_process(path: &Path, pid: u32, started: u64) -> anyhow::Result<()> {
    if !identity_still_matches(pid, started) {
        cleanup::remove_file(path);
        return Ok(());
    }

    let Some(raw) = rustix::process::Pid::from_raw(pid as i32) else {
        cleanup::remove_file(path);
        return Ok(());
    };
    let pidfd = match rustix::process::pidfd_open(raw, rustix::process::PidfdFlags::empty()) {
        Ok(pidfd) => pidfd,
        Err(error) => {
            if !identity_still_matches(pid, started) {
                cleanup::remove_file(path);
                return Ok(());
            }

            return Err(error).with_context(|| format!("Could not open the process {pid}"));
        }
    };

    stop_after_open(path, pid, started, process_start(pid), || {
        send_term(pid, &pidfd);
    })
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the original error"
)]
fn send_term(pid: u32, pidfd: &rustix::fd::OwnedFd) {
    if let Err(error) = rustix::process::pidfd_send_signal(pidfd, rustix::process::Signal::TERM) {
        let error = std::io::Error::from(error);

        if let Some(warning) = cleanup::cleanup_warning(&format!("stop the process {pid}"), &error)
        {
            eprintln!("{warning}");
        }
    }
}

fn stop_after_open(
    path: &Path,
    pid: u32,
    started: u64,
    after_open: Option<u64>,
    signal: impl FnOnce(),
) -> anyhow::Result<()> {
    if after_open != Some(started) {
        cleanup::remove_file(path);
        return Ok(());
    }

    signal();
    stop_loop(path, pid, started)
}

fn stop_loop(path: &Path, pid: u32, started: u64) -> anyhow::Result<()> {
    let deadline = Instant::now() + STOP_TIMEOUT;

    loop {
        if !identity_still_matches(pid, started) || process_is_zombie(pid) {
            cleanup::remove_file(path);
            return Ok(());
        }

        if Instant::now() >= deadline {
            anyhow::bail!("The process {pid} did not stop; keeping {}", path.display());
        }

        std::thread::sleep(process::POLL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_still_matches_rejects_a_changed_start_time() {
        let pid = std::process::id();
        let started = process_start(pid).expect("the test process has a start time");

        assert!(identity_still_matches(pid, started));
        assert!(!identity_still_matches(pid, started + 1));
    }

    #[test]
    fn record_matches_rejects_a_changed_start_time() {
        let path =
            std::env::temp_dir().join(format!("greppa-sandbox-test-record-{}", std::process::id()));
        let pid = std::process::id();
        let started = process_start(pid).expect("the test process has a start time");

        fs::write(&path, format!("{pid} {started}\n")).expect("write the matching record");
        assert!(record_matches(&path));

        fs::write(&path, format!("{pid} {}\n", started + 1)).expect("write the changed record");
        assert!(!record_matches(&path));

        crate::test_support::remove_file(&path);
    }

    #[test]
    fn stop_process_skips_a_mismatched_start_time() {
        let path =
            std::env::temp_dir().join(format!("greppa-sandbox-test-stop-{}", std::process::id()));
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
        let result = stop_after_open(&path, pid, started, Some(started + 1), || signaled = true);

        assert!(result.is_ok());
        assert!(!signaled, "a changed identity must not signal");
        assert!(!path.exists(), "the stale record is removed");
    }
}
