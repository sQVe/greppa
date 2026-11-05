//! Best-effort cleanup for temporary files and child processes.
//!
//! A cleanup failure must not hide the original error, so these helpers report it on stderr and
//! continue. A path or process that is already gone is not a failure.

#![allow(
    dead_code,
    reason = "these helpers are used only by the Linux sandbox and by test code"
)]

use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::process::Child;

pub(crate) fn cleanup_warning(context: &str, error: &std::io::Error) -> Option<String> {
    if cleanup_failure_is_expected(error) {
        return None;
    }

    Some(format!("Could not {context}: {error}"))
}

fn cleanup_failure_is_expected(error: &std::io::Error) -> bool {
    if error.kind() == ErrorKind::NotFound {
        return true;
    }

    #[cfg(target_os = "linux")]
    {
        error.raw_os_error() == Some(rustix::io::Errno::SRCH.raw_os_error())
    }

    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the caller's result"
)]
pub(crate) fn remove_file(path: &Path) {
    if let Err(error) = fs::remove_file(path)
        && let Some(warning) = cleanup_warning(&format!("remove {}", path.display()), &error)
    {
        eprintln!("{warning}");
    }
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the caller's result"
)]
pub(crate) fn remove_dir_all(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path)
        && let Some(warning) = cleanup_warning(&format!("remove {}", path.display()), &error)
    {
        eprintln!("{warning}");
    }
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the original error"
)]
pub(crate) fn stop_child(child: &mut Child) {
    if let Err(error) = child.kill()
        && let Some(warning) = cleanup_warning("stop the process", &error)
    {
        eprintln!("{warning}");
    }

    if let Err(error) = child.wait()
        && let Some(warning) = cleanup_warning("reap the process", &error)
    {
        eprintln!("{warning}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_target_is_ignored_and_other_failures_are_reported() {
        let missing = std::io::Error::from(ErrorKind::NotFound);
        assert_eq!(cleanup_warning("remove /tmp/x", &missing), None);

        let denied = std::io::Error::from(ErrorKind::PermissionDenied);
        let reported = cleanup_warning("remove /tmp/x", &denied)
            .expect("an unexpected cleanup failure is reported");
        assert!(
            reported.starts_with("Could not remove /tmp/x: "),
            "unexpected warning: {reported}"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_process_that_is_gone_is_an_expected_failure() {
        let gone = std::io::Error::from(rustix::io::Errno::SRCH);

        assert_eq!(cleanup_warning("stop the process 1", &gone), None);
    }
}
