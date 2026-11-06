use std::path::Path;

use crate::environment::{self, ChildDirs};

pub(super) fn caller_environment() -> Vec<(String, String)> {
    std::env::vars().collect()
}

pub(super) fn sandbox_environment(root: &Path, display: &str) -> Vec<(String, String)> {
    let marker = root.to_string_lossy().into_owned();
    let dirs = ChildDirs::under(root);

    environment::child_environment(
        &caller_environment(),
        &dirs,
        &[("DISPLAY", display), ("GREPPA_SANDBOX_ROOT", &marker)],
    )
}

pub(super) fn weston_environment(root: &Path) -> Vec<(String, String)> {
    environment::child_environment(&caller_environment(), &ChildDirs::under(root), &[])
}

pub(super) fn nested_weston_environment(root: &Path, runtime: &Path) -> Vec<(String, String)> {
    let mut dirs = ChildDirs::under(root);
    dirs.runtime = runtime.to_path_buf();

    environment::child_environment(&caller_environment(), &dirs, &[])
}
