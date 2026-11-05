use std::path::{Path, PathBuf};

use super::*;

#[test]
fn root_path_is_under_the_temporary_folder() {
    assert_eq!(
        root_path("smoke"),
        PathBuf::from("/var/tmp/greppa-sandbox-smoke")
    );
}

#[test]
fn remove_root_accepts_only_sandbox_folders() {
    assert!(remove_root_allowed(Path::new(
        "/var/tmp/greppa-sandbox-smoke"
    )));
    assert!(!remove_root_allowed(Path::new("/var/tmp/other")));
    assert!(!remove_root_allowed(Path::new(
        "/home/user/greppa-sandbox-smoke"
    )));
    assert!(!remove_root_allowed(Path::new("/var/tmp/greppa-sandbox-")));
}

#[test]
fn remove_root_refuses_a_folder_outside_the_sandbox_prefix() {
    let folder = crate::test_support::temporary_directory();
    let marker = folder.path().join("marker");
    fs::write(&marker, "keep").expect("write the marker");

    let error = remove_root(folder.path()).expect_err("the folder is refused");

    assert!(
        matches!(
            error.downcast_ref::<RootError>(),
            Some(RootError::NotSandboxFolder { path }) if path == folder.path()
        ),
        "unexpected error: {error}"
    );
    assert_eq!(fs::read_to_string(&marker).expect("the marker"), "keep");
}

#[test]
fn remove_root_removes_a_sandbox_folder() {
    let root = crate::test_support::temporary_sandbox_root("remove");
    fs::write(root.path().join("marker"), "remove").expect("write the marker");

    remove_root(root.path()).expect("the sandbox folder is removed");

    assert!(!root.path().exists());
}

fn mode(path: &Path) -> u32 {
    fs::symlink_metadata(path)
        .expect("read the metadata")
        .permissions()
        .mode()
        & 0o777
}

#[test]
fn prepare_root_creates_private_control_folders_and_runs_again() {
    let fixture = crate::test_support::temporary_sandbox_root("prepare");
    let root = fixture.path();
    fs::remove_dir(root).expect("remove the fixture folder");

    prepare_root(root).expect("the root is prepared");
    prepare_root(root).expect("a prepared root is prepared again");

    assert_eq!(mode(root), 0o700);

    for folder in ["run", "config", "state", "data", "cache", "home", "bin"] {
        let path = root.join(folder);

        assert!(path.is_dir(), "{folder} is a folder");
        assert_eq!(mode(&path), 0o700, "{folder} is private");
    }
}

#[test]
fn prepare_root_refuses_a_linked_control_folder_and_leaves_its_target() {
    let root = crate::test_support::temporary_sandbox_root("prepare-linked");
    let target = crate::test_support::temporary_directory();
    fs::write(target.path().join("marker"), "keep").expect("write the marker");
    let link = root.path().join("run");
    std::os::unix::fs::symlink(target.path(), &link).expect("link the control path");

    let error = prepare_root(root.path()).expect_err("the linked path is refused");

    assert!(
        matches!(
            error.downcast_ref::<RootError>(),
            Some(RootError::LinkedPath { path }) if path == &link
        ),
        "unexpected error: {error}"
    );

    let entries: Vec<_> = fs::read_dir(target.path())
        .expect("read the target")
        .map(|entry| entry.expect("an entry").file_name())
        .collect();

    assert_eq!(entries, ["marker"]);
    assert_eq!(
        fs::read_to_string(target.path().join("marker")).expect("the marker"),
        "keep"
    );
}

#[test]
fn refuse_unsafe_root_accepts_an_absent_path() {
    let folder = crate::test_support::temporary_directory();

    refuse_unsafe_root(&folder.path().join("absent")).expect("an absent root is accepted");
}

#[test]
fn refuse_unsafe_root_reports_a_path_under_a_file() {
    let folder = crate::test_support::temporary_directory();
    let file = folder.path().join("file");
    fs::write(&file, "").expect("write the file");

    let error = refuse_unsafe_root(&file.join("child")).expect_err("the path is refused");

    assert_eq!(
        error
            .downcast_ref::<std::io::Error>()
            .map(std::io::Error::kind),
        Some(std::io::ErrorKind::NotADirectory),
        "unexpected error: {error}"
    );
}

#[test]
fn refuse_unsafe_root_refuses_an_open_folder() {
    let root = crate::test_support::temporary_sandbox_root("open");
    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o755)).expect("open the root");

    let error = refuse_unsafe_root(root.path()).expect_err("the open root is refused");

    assert!(
        matches!(
            error.downcast_ref::<RootError>(),
            Some(RootError::Unsafe { path, reason: RootReason::WrongMode { mode: 0o755 } })
                if path == root.path()
        ),
        "unexpected error: {error}"
    );
}

#[test]
fn install_openers_writes_stubs_that_only_log_the_url() {
    let root = crate::test_support::temporary_sandbox_root("it's open");
    prepare_root(root.path()).expect("the root is prepared");

    install_openers(root.path()).expect("the openers are installed");

    for (opener, url) in [
        ("xdg-open", "https://example.com/a b"),
        ("open", "https://example.com/it's"),
    ] {
        let path = root.path().join("bin").join(opener);

        assert_eq!(mode(&path), 0o755, "{opener} is runnable");

        let status = std::process::Command::new(&path)
            .arg(url)
            .status()
            .expect("run the opener stub");

        assert!(status.success(), "{opener} exits with success");
    }

    assert_eq!(
        fs::read_to_string(root.path().join("opened")).expect("the opened log"),
        "https://example.com/a b\nhttps://example.com/it's\n"
    );
}

#[test]
fn install_openers_refuses_a_linked_opener_and_leaves_its_target() {
    let root = crate::test_support::temporary_sandbox_root("opener-linked");
    prepare_root(root.path()).expect("the root is prepared");
    let target = crate::test_support::temporary_directory();
    let marker = target.path().join("marker");
    fs::write(&marker, "keep").expect("write the marker");
    fs::set_permissions(&marker, fs::Permissions::from_mode(0o600)).expect("secure the marker");
    let link = root.path().join("bin").join("open");
    std::os::unix::fs::symlink(&marker, &link).expect("link the opener");

    let error = install_openers(root.path()).expect_err("the linked opener is refused");

    assert!(
        matches!(
            error.downcast_ref::<RootError>(),
            Some(RootError::LinkedOpener { path }) if path == &link
        ),
        "unexpected error: {error}"
    );
    assert_eq!(fs::read_to_string(&marker).expect("the marker"), "keep");
    assert_eq!(mode(&marker), 0o600);
}

#[test]
fn shell_quote_survives_spaces_and_single_quotes() {
    let value = "it's a 'quoted' value";

    let output = std::process::Command::new("/bin/sh")
        .arg("-c")
        .arg(format!("printf %s {}", shell_quote(value)))
        .output()
        .expect("run the shell");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), value);
}

#[test]
fn socket_name_is_unique_per_sandbox_name() {
    assert_eq!(socket_name("one"), "greppa-sandbox-one");
    assert_eq!(socket_name("two"), "greppa-sandbox-two");
}

#[test]
fn root_metadata_problem_names_each_reason() {
    let good = RootMetadata {
        is_symlink: false,
        is_dir: true,
        owner: 1000,
        mode: 0o700,
    };

    assert_eq!(root_metadata_problem(&good, 1000), None);
    assert_eq!(
        root_metadata_problem(
            &RootMetadata {
                is_symlink: true,
                ..good
            },
            1000
        ),
        Some(RootReason::Symlink)
    );
    assert_eq!(
        root_metadata_problem(
            &RootMetadata {
                is_dir: false,
                ..good
            },
            1000
        ),
        Some(RootReason::NotDirectory)
    );
    assert_eq!(
        root_metadata_problem(&good, 1001),
        Some(RootReason::WrongOwner)
    );
    assert_eq!(
        root_metadata_problem(
            &RootMetadata {
                mode: 0o755,
                ..good
            },
            1000
        ),
        Some(RootReason::WrongMode { mode: 0o755 })
    );
}

#[test]
fn root_reasons_render_the_refusal_text() {
    assert_eq!(RootReason::Symlink.to_string(), "it is a symlink");
    assert_eq!(RootReason::NotDirectory.to_string(), "it is not a folder");
    assert_eq!(
        RootReason::WrongOwner.to_string(),
        "it is not owned by the current user"
    );
    assert_eq!(
        RootReason::WrongMode { mode: 0o755 }.to_string(),
        "its mode is 755, not 700"
    );
}

#[test]
fn root_errors_render_the_refusal_text() {
    let unsafe_error = RootError::Unsafe {
        path: PathBuf::from("/var/tmp/greppa-sandbox-x"),
        reason: RootReason::WrongMode { mode: 0o755 },
    };

    assert_eq!(
        unsafe_error.to_string(),
        "refusing /var/tmp/greppa-sandbox-x: its mode is 755, not 700"
    );

    let linked = RootError::LinkedPath {
        path: PathBuf::from("/var/tmp/greppa-sandbox-x/run"),
    };

    assert_eq!(
        linked.to_string(),
        "refusing the symlinked sandbox path /var/tmp/greppa-sandbox-x/run"
    );

    let outside = RootError::NotSandboxFolder {
        path: PathBuf::from("/var/tmp/other"),
    };

    assert_eq!(
        outside.to_string(),
        "refusing to remove /var/tmp/other: it is not a sandbox folder"
    );

    let opener = RootError::LinkedOpener {
        path: PathBuf::from("/var/tmp/greppa-sandbox-x/bin/open"),
    };

    assert_eq!(
        opener.to_string(),
        "refusing the symlinked opener /var/tmp/greppa-sandbox-x/bin/open"
    );
}

#[test]
fn linked_paths_lists_control_files() {
    let paths = linked_paths(Path::new("/var/tmp/greppa-sandbox-smoke"));

    assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/display")));
    assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/run")));
    assert!(paths.contains(&PathBuf::from("/var/tmp/greppa-sandbox-smoke/bin")));
}

#[test]
fn refuse_linked_paths_refuses_a_linked_control_path_and_leaves_it() {
    let root = crate::test_support::temporary_sandbox_root("linked");
    let target = crate::test_support::temporary_directory();
    let marker = target.path().join("marker");
    fs::write(&marker, "keep").expect("write the marker");
    let link = root.path().join("run");
    std::os::unix::fs::symlink(target.path(), &link).expect("link the control path");

    let error = refuse_linked_paths(root.path()).expect_err("the linked path is refused");

    assert!(
        matches!(&error, RootError::LinkedPath { path } if path == &link),
        "unexpected error: {error}"
    );
    assert_eq!(
        error.to_string(),
        format!("refusing the symlinked sandbox path {}", link.display())
    );
    assert!(marker.is_file(), "the target must not change");
    assert!(
        fs::symlink_metadata(&link)
            .expect("the link")
            .file_type()
            .is_symlink()
    );
}
