//! Helpers for test cleanup that never discard a `Result`.

#![allow(
    dead_code,
    reason = "some helpers are used only by test modules that are Linux only"
)]

use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::process::Child;

pub(crate) fn remove_file(path: &Path) {
    if let Err(error) = fs::remove_file(path)
        && error.kind() != ErrorKind::NotFound
    {
        panic!("Could not remove {}: {error}", path.display());
    }
}

pub(crate) fn remove_dir_all(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path)
        && error.kind() != ErrorKind::NotFound
    {
        panic!("Could not remove {}: {error}", path.display());
    }
}

pub(crate) fn stop_child(child: &mut Child) {
    if let Err(error) = child.kill()
        && error.kind() != ErrorKind::NotFound
    {
        panic!("Could not stop the process: {error}");
    }

    if let Err(error) = child.wait()
        && error.kind() != ErrorKind::NotFound
    {
        panic!("Could not reap the process: {error}");
    }
}
