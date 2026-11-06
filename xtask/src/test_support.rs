#![allow(
    dead_code,
    reason = "some helpers are used only by test modules that are Linux only"
)]

use std::fs;
use std::os::unix::fs::PermissionsExt as _;
use std::process::Child;

use tempfile::{Builder, TempDir};

pub(crate) fn temporary_directory() -> TempDir {
    Builder::new()
        .prefix("greppa-xtask-test-")
        .tempdir()
        .expect("create a temporary directory")
}

pub(crate) fn temporary_sandbox_root(label: &str) -> TempDir {
    let prefix = format!("greppa-sandbox-test-{label}-");
    let root = Builder::new()
        .prefix(&prefix)
        .tempdir_in("/var/tmp")
        .expect("create a temporary sandbox root");

    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700))
        .expect("secure the sandbox root");

    root
}

pub(crate) fn stop_child(child: &mut Child) {
    if let Err(error) = child.kill()
        && let Some(warning) = crate::cleanup::cleanup_warning("stop the process", &error)
    {
        panic!("{warning}");
    }

    if let Err(error) = child.wait()
        && let Some(warning) = crate::cleanup::cleanup_warning("reap the process", &error)
    {
        panic!("{warning}");
    }
}
