use std::os::unix::fs::PermissionsExt;

use thiserror::Error;

use super::super::display_start::tests::{record_live_display, stale_display_cases};
use super::super::root::{RootError, RootReason};
use super::*;

#[derive(Debug, Error)]
#[error("the process will not stop")]
struct WillNotStop;

fn cleanup_order(root: &Path) -> [StopTarget; 3] {
    [
        StopTarget::Window {
            root: root.to_path_buf(),
        },
        StopTarget::Recorded {
            path: root.join("xwayland.pid"),
        },
        StopTarget::Recorded {
            path: root.join("weston.pid"),
        },
    ]
}

#[test]
fn cleanup_keeps_the_root_when_a_recorded_process_will_not_stop() {
    for failing in 0..3 {
        let root = crate::test_support::temporary_sandbox_root("will-not-stop");
        let mut visited = Vec::new();

        let error = cleanup(root.path(), |target| {
            visited.push(target);

            if visited.len() == failing + 1 {
                return Err(WillNotStop.into());
            }

            Ok(())
        })
        .expect_err("a failed stop fails the cleanup");

        assert!(
            error.downcast_ref::<WillNotStop>().is_some(),
            "{failing}: {error:#}"
        );
        assert_eq!(
            visited.as_slice(),
            &cleanup_order(root.path())[..=failing],
            "{failing}"
        );
        assert!(root.path().is_dir(), "{failing}: the root must stay");
    }
}

#[test]
fn cleanup_stops_every_record_in_order_and_removes_the_root() {
    let root = crate::test_support::temporary_sandbox_root("all-stopped");
    let mut visited = Vec::new();

    cleanup(root.path(), |target| {
        visited.push(target);
        Ok(())
    })
    .expect("the cleanup succeeds");

    assert_eq!(visited, cleanup_order(root.path()));
    assert!(!root.path().exists(), "the root must be removed");
}

#[test]
fn a_refused_scene_leaves_a_running_sandbox_alone() {
    let root = crate::test_support::temporary_sandbox_root("preflight");
    let marker = root.path().join("scene");
    fs::write(&marker, "smoke-2\n").expect("write the scene record");

    let error = start_window(
        Path::new("/nonexistent"),
        "preflight",
        root.path(),
        "app",
        false,
    )
    .expect_err("the app scene is refused");

    assert_eq!(
        error.to_string(),
        "The real app has no window yet. Use a scene name such as smoke-2."
    );
    assert!(
        marker.is_file(),
        "a refused scene must not tear the sandbox down"
    );
}

#[test]
fn cleanup_refuses_a_symlinked_root_and_leaves_its_target() {
    let folder = crate::test_support::temporary_directory();
    let target = crate::test_support::temporary_directory();
    let marker = target.path().join("marker");
    fs::write(&marker, "keep").expect("write the marker");
    let root = folder.path().join("root");
    std::os::unix::fs::symlink(target.path(), &root).expect("link the root");

    let error = cleanup(&root, stop_target).expect_err("the symlink is refused");
    let root_error = error
        .downcast_ref::<RootError>()
        .expect("the refusal is a root error");

    assert!(
        matches!(
            root_error,
            RootError::Unsafe {
                path,
                reason: RootReason::Symlink,
            } if path == &root
        ),
        "unexpected error: {error:#}"
    );
    assert!(marker.is_file(), "cleanup must not touch the link target");
    assert!(
        fs::symlink_metadata(&root)
            .expect("the root")
            .file_type()
            .is_symlink()
    );
}

#[test]
fn cleanup_refuses_a_root_that_is_not_private() {
    let root = crate::test_support::temporary_sandbox_root("mode");
    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("set the mode");

    let error = cleanup(root.path(), stop_target).expect_err("the mode is refused");
    let root_error = error
        .downcast_ref::<RootError>()
        .expect("the refusal is a root error");

    assert!(
        matches!(
            root_error,
            RootError::Unsafe {
                path,
                reason: RootReason::WrongMode { mode: 0o755 },
            } if path.as_path() == root.path()
        ),
        "unexpected error: {error:#}"
    );
    let metadata = fs::symlink_metadata(root.path()).expect("the root");
    assert!(metadata.is_dir());
    assert_eq!(metadata.permissions().mode() & 0o777, 0o755);
}

#[test]
fn require_up_refuses_a_symlinked_root() {
    let folder = crate::test_support::temporary_directory();
    let target = crate::test_support::temporary_directory();
    let marker = target.path().join("marker");
    fs::write(&marker, "keep").expect("write the marker");
    let root = folder.path().join("root");
    std::os::unix::fs::symlink(target.path(), &root).expect("link the root");

    let error = require_up("test", &root).expect_err("the symlink is refused");
    let root_error = error
        .downcast_ref::<RootError>()
        .expect("the refusal is a root error");

    assert!(
        matches!(
            root_error,
            RootError::Unsafe {
                path,
                reason: RootReason::Symlink,
            } if path == &root
        ),
        "unexpected error: {error:#}"
    );
    assert!(marker.is_file(), "the target must not change");
    assert!(
        fs::symlink_metadata(&root)
            .expect("the root")
            .file_type()
            .is_symlink()
    );
}

#[test]
fn recorded_scene_reports_a_missing_record() {
    let root = crate::test_support::temporary_sandbox_root("recorded-scene");

    let error = recorded_scene(root.path(), None).expect_err("a missing record fails");

    assert_eq!(
        error.to_string(),
        "The sandbox is not up; run 'cargo xtask sandbox up <scene>' first."
    );
}

#[test]
fn a_failed_start_keeps_its_error_when_cleanup_fails() {
    let root = crate::test_support::temporary_sandbox_root("failed-start");
    let workspace = crate::workspace_root();
    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("set the mode");

    let error =
        start_window(&workspace, "test", root.path(), "app", false).expect_err("the start fails");

    assert_eq!(
        error.to_string(),
        "The real app has no window yet. Use a scene name such as smoke-2."
    );
}

fn live_sandbox(label: &str) -> tempfile::TempDir {
    let root = crate::test_support::temporary_sandbox_root(label);
    record_live_display(root.path(), ":7\n");
    fs::write(root.path().join("window"), "123\n").expect("write the window");

    root
}

fn assert_not_up(error: &anyhow::Error, case: &str) {
    assert_eq!(
        error.downcast_ref::<SandboxError>(),
        Some(&SandboxError::NotUp {
            name: "test".to_string()
        }),
        "{case}: {error:#}"
    );
}

#[test]
fn require_up_returns_the_display_of_a_live_sandbox() {
    let root = live_sandbox("require-up");

    assert_eq!(
        require_up("test", root.path()).expect("the sandbox is up"),
        ":7"
    );
}

#[test]
fn require_up_refuses_a_stale_display() {
    for (case, make_stale) in stale_display_cases() {
        let root = live_sandbox("require-stale");
        make_stale(root.path());

        let error = require_up("test", root.path()).expect_err("a stale display is refused");

        assert_not_up(&error, case);
    }
}

#[test]
fn require_up_refuses_a_missing_window() {
    let root = live_sandbox("require-window");
    fs::remove_file(root.path().join("window")).expect("remove the window");

    let error = require_up("test", root.path()).expect_err("a missing window is refused");

    assert_not_up(&error, "missing window");
    assert_eq!(display_up(root.path()), Some(":7".to_string()));
}

#[test]
fn recorded_scene_reads_the_trimmed_record() {
    let root = crate::test_support::temporary_sandbox_root("scene-record");
    fs::write(root.path().join("scene"), "smoke-2\n").expect("write the scene");

    assert_eq!(
        recorded_scene(root.path(), None).expect("the record is read"),
        "smoke-2"
    );
}

#[test]
fn recorded_scene_prefers_an_explicit_scene() {
    let root = crate::test_support::temporary_sandbox_root("scene-explicit");
    fs::write(root.path().join("scene"), "smoke-2\n").expect("write the scene");

    assert_eq!(
        recorded_scene(root.path(), Some("smoke-3")).expect("the explicit scene wins"),
        "smoke-3"
    );
}

#[test]
fn recorded_scene_refuses_an_unsafe_root_even_with_an_explicit_scene() {
    let root = crate::test_support::temporary_sandbox_root("scene-unsafe");
    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("set the mode");

    let error = recorded_scene(root.path(), Some("smoke-3")).expect_err("the root is refused");

    assert!(
        matches!(
            error.downcast_ref::<RootError>(),
            Some(RootError::Unsafe {
                path,
                reason: RootReason::WrongMode { mode: 0o755 },
            }) if path.as_path() == root.path()
        ),
        "unexpected error: {error:#}"
    );
}

fn io_kind(error: &anyhow::Error) -> Option<std::io::ErrorKind> {
    error
        .downcast_ref::<std::io::Error>()
        .map(std::io::Error::kind)
}

#[test]
fn opened_accepts_a_missing_or_normal_file_and_fails_on_a_folder() {
    let root = crate::test_support::temporary_sandbox_root("opened");

    opened(root.path()).expect("a missing file means nothing opened");

    fs::write(root.path().join("opened"), "https://example.com\n").expect("write opened");
    opened(root.path()).expect("a normal file is printed");

    fs::remove_file(root.path().join("opened")).expect("remove opened");
    fs::create_dir(root.path().join("opened")).expect("create the folder");
    let error = opened(root.path()).expect_err("a folder cannot be read");

    assert_eq!(io_kind(&error), Some(std::io::ErrorKind::IsADirectory));
}

#[test]
fn log_fails_on_a_missing_log_and_prints_a_normal_one() {
    let root = crate::test_support::temporary_sandbox_root("log");

    let error = log(root.path()).expect_err("a missing log fails");

    assert_eq!(io_kind(&error), Some(std::io::ErrorKind::NotFound));

    fs::write(root.path().join("scene.log"), "ready\n").expect("write the log");
    log(root.path()).expect("a normal log is printed");
}

#[test]
fn down_succeeds_for_an_absent_root() {
    let folder = crate::test_support::temporary_directory();
    let root = folder.path().join("greppa-sandbox-absent");

    down("test", &root).expect("an absent sandbox is already down");

    assert!(!root.exists());
}

#[test]
fn down_removes_a_private_root_without_records() {
    let root = crate::test_support::temporary_sandbox_root("down");
    fs::write(root.path().join("scene"), "smoke-2\n").expect("write the scene");

    down("test", root.path()).expect("the sandbox goes down");

    assert!(!root.path().exists());
}
