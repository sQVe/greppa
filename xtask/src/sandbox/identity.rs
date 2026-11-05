use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::Context as _;
use thiserror::Error;

use crate::cleanup;
use crate::process::poll_until;

pub(super) const STOP_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Error)]
pub(super) enum IdentityError {
    #[error("The process {pid} did not stop; keeping {}", path.display())]
    DidNotStop { pid: u32, path: PathBuf },
    #[error("The process {pid} is not the expected {expected}. Actual: {actual}")]
    UnexpectedProcess {
        pid: u32,
        expected: String,
        actual: String,
    },
    #[error("The {expected} process {pid} is gone before it could be recorded.")]
    MissingProcess { pid: u32, expected: String },
    #[error("The {expected} process {pid} did not name itself in time.")]
    DidNotNameItself { pid: u32, expected: String },
}

pub(super) fn record_xwayland(root: &Path, display: &str, timeout: Duration) -> anyhow::Result<()> {
    let Some((weston, _)) = read_record(&root.join("weston.pid")) else {
        return Ok(());
    };

    poll_until(timeout, || {
        for pid in child_pids(weston) {
            let Ok(cmdline) = fs::read(format!("/proc/{pid}/cmdline")) else {
                continue;
            };
            let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

            if cmdline.contains("Xwayland") && cmdline.contains(display) {
                record_process(&root.join("xwayland.pid"), pid, "Xwayland", timeout)?;
                return Ok(Some(()));
            }
        }

        Ok(None)
    })?;

    Ok(())
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

pub(super) fn process_is_zombie(pid: u32) -> bool {
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

pub(super) fn record_process(
    path: &Path,
    pid: u32,
    expected: &str,
    timeout: Duration,
) -> anyhow::Result<()> {
    let mut mismatch = None;
    let recorded = poll_until(timeout, || {
        let Some(started) = process_start(pid) else {
            return Err(IdentityError::MissingProcess {
                pid,
                expected: expected.to_string(),
            }
            .into());
        };

        let cmdline = fs::read(format!("/proc/{pid}/cmdline"))
            .with_context(|| format!("Could not read the process {pid}"))?;
        let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

        if cmdline.contains(expected) {
            fs::write(path, format!("{pid} {started}\n"))
                .with_context(|| format!("Could not record the {expected} process"))?;

            return Ok(Some(()));
        }

        if !cmdline.trim().is_empty() {
            mismatch = Some(cmdline);
        }

        Ok(None)
    })?;

    if recorded.is_none() {
        return Err(match mismatch {
            Some(actual) => IdentityError::UnexpectedProcess {
                pid,
                expected: expected.to_string(),
                actual,
            }
            .into(),
            None => IdentityError::DidNotNameItself {
                pid,
                expected: expected.to_string(),
            }
            .into(),
        });
    }

    Ok(())
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
        return stop_process(&path, pid, started, STOP_TIMEOUT, open_pidfd);
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
        return stop_process(path, pid, started, STOP_TIMEOUT, open_pidfd);
    }

    cleanup::remove_file(path);

    Ok(())
}

fn open_pidfd(raw: rustix::process::Pid) -> std::io::Result<rustix::fd::OwnedFd> {
    rustix::process::pidfd_open(raw, rustix::process::PidfdFlags::empty())
        .map_err(std::io::Error::from)
}

fn stop_process(
    path: &Path,
    pid: u32,
    started: u64,
    timeout: Duration,
    open: impl FnOnce(rustix::process::Pid) -> std::io::Result<rustix::fd::OwnedFd>,
) -> anyhow::Result<()> {
    if !identity_still_matches(pid, started) {
        cleanup::remove_file(path);
        return Ok(());
    }

    let Some(raw) = rustix::process::Pid::from_raw(pid as i32) else {
        cleanup::remove_file(path);
        return Ok(());
    };
    let pidfd = match open(raw) {
        Ok(pidfd) => pidfd,
        Err(error) => {
            if !identity_still_matches(pid, started) {
                cleanup::remove_file(path);
                return Ok(());
            }

            return Err(error).with_context(|| format!("Could not open the process {pid}"));
        }
    };

    stop_after_open(path, pid, started, process_start(pid), timeout, || {
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
    timeout: Duration,
    signal: impl FnOnce(),
) -> anyhow::Result<()> {
    if after_open != Some(started) {
        cleanup::remove_file(path);
        return Ok(());
    }

    signal();
    stop_loop(path, pid, started, timeout)
}

fn stop_loop(path: &Path, pid: u32, started: u64, timeout: Duration) -> anyhow::Result<()> {
    let stopped = poll_until(timeout, || {
        if !identity_still_matches(pid, started) || process_is_zombie(pid) {
            cleanup::remove_file(path);
            return Ok(Some(()));
        }

        Ok(None)
    })?;

    if stopped.is_none() {
        return Err(IdentityError::DidNotStop {
            pid,
            path: path.to_path_buf(),
        }
        .into());
    }

    Ok(())
}

#[cfg(test)]
pub(super) mod tests;
