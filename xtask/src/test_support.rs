#![allow(
    dead_code,
    reason = "some helpers are used only by test modules that are Linux only"
)]

use std::fs;
use std::path::Path;
use std::process::Child;

pub(crate) fn remove_file(path: &Path) {
    if let Err(error) = fs::remove_file(path)
        && let Some(warning) =
            crate::cleanup::cleanup_warning(&format!("remove {}", path.display()), &error)
    {
        panic!("{warning}");
    }
}

pub(crate) fn remove_dir_all(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path)
        && let Some(warning) =
            crate::cleanup::cleanup_warning(&format!("remove {}", path.display()), &error)
    {
        panic!("{warning}");
    }
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
