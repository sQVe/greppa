//! Best-effort cleanup for temporary files and child processes.
//!
//! A cleanup failure must not hide the original error, so these helpers report it on stderr and
//! continue. A path or process that is already gone is not a failure.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::process::Child;

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the caller's result"
)]
pub(crate) fn remove_file(path: &Path) {
    if let Err(error) = fs::remove_file(path)
        && error.kind() != ErrorKind::NotFound
    {
        eprintln!("Could not remove {}: {error}", path.display());
    }
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the caller's result"
)]
pub(crate) fn remove_dir_all(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path)
        && error.kind() != ErrorKind::NotFound
    {
        eprintln!("Could not remove {}: {error}", path.display());
    }
}

#[expect(
    clippy::print_stderr,
    reason = "a cleanup failure must not hide the original error"
)]
pub(crate) fn stop_child(child: &mut Child) {
    if let Err(error) = child.kill()
        && error.kind() != ErrorKind::NotFound
    {
        eprintln!("Could not stop the process: {error}");
    }

    if let Err(error) = child.wait()
        && error.kind() != ErrorKind::NotFound
    {
        eprintln!("Could not reap the process: {error}");
    }
}
