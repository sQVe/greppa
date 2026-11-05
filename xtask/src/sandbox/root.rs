//! Root path and folder safety: the sandbox root path, the pure checks that describe a trusted
//! root, and the filesystem checks that create, refuse, and remove it.

use std::fs;
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::path::Path;

const ROOT_PARENT: &str = "/var/tmp";
const ROOT_PREFIX: &str = "greppa-sandbox-";
const SOCKET_PREFIX: &str = "greppa-sandbox-";

pub(super) fn root_path(name: &str) -> std::path::PathBuf {
    std::path::Path::new(ROOT_PARENT).join(format!("{ROOT_PREFIX}{name}"))
}

pub(super) fn socket_name(name: &str) -> String {
    format!("{SOCKET_PREFIX}{name}")
}

pub(super) struct RootMetadata {
    pub(super) is_symlink: bool,
    pub(super) is_dir: bool,
    pub(super) owner: u32,
    pub(super) mode: u32,
}

pub(super) fn root_metadata_problem(metadata: &RootMetadata, current_uid: u32) -> Option<String> {
    if metadata.is_symlink {
        return Some("it is a symlink".to_string());
    }

    if !metadata.is_dir {
        return Some("it is not a folder".to_string());
    }

    if metadata.owner != current_uid {
        return Some("it is not owned by the current user".to_string());
    }

    if metadata.mode & 0o777 != 0o700 {
        return Some(format!("its mode is {:o}, not 700", metadata.mode & 0o777));
    }

    None
}

/// The sandbox paths that must never be symlinks. A planted link could redirect sandbox writes.
pub(super) fn linked_paths(root: &Path) -> Vec<std::path::PathBuf> {
    [
        "display",
        "weston.pid",
        "xwayland.pid",
        "pid",
        "window",
        "scene",
        "mode",
        "bin",
        "home",
        "opened",
        "scene.log",
        "weston.log",
        "run",
        "config",
        "state",
        "data",
        "cache",
    ]
    .iter()
    .map(|name| root.join(name))
    .collect()
}

pub(super) fn remove_root_allowed(root: &Path) -> bool {
    let parent_is_temporary = root.parent() == Some(Path::new(ROOT_PARENT));
    let base = root.file_name().and_then(|name| name.to_str());

    parent_is_temporary
        && base.is_some_and(|name| name.starts_with(ROOT_PREFIX) && name.len() > ROOT_PREFIX.len())
}

pub(super) fn require_trusted_root(root: &Path) -> Result<(), String> {
    refuse_unsafe_root(root)?;
    refuse_linked_paths(root)
}

pub(super) fn prepare_root(root: &Path) -> Result<(), String> {
    refuse_unsafe_root(root)?;

    if !root.exists() {
        fs::create_dir(root)
            .map_err(|error| format!("Could not create {}: {error}", root.display()))?;
        fs::set_permissions(root, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure {}: {error}", root.display()))?;
    }

    refuse_unsafe_root(root)?;

    for folder in ["run", "config", "state", "data", "cache", "home", "bin"] {
        let path = root.join(folder);

        if !path.exists() {
            fs::create_dir(&path)
                .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("Could not secure {}: {error}", path.display()))?;
        }
    }

    refuse_linked_paths(root)
}

pub(super) fn refuse_unsafe_root(root: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not read {}: {error}", root.display())),
    };

    let described = RootMetadata {
        is_symlink: metadata.file_type().is_symlink(),
        is_dir: metadata.is_dir(),
        owner: metadata.uid(),
        mode: metadata.permissions().mode(),
    };

    match root_metadata_problem(&described, current_uid()?) {
        Some(reason) => Err(format!("refusing {}: {reason}", root.display())),
        None => Ok(()),
    }
}

pub(super) fn refuse_linked_paths(root: &Path) -> Result<(), String> {
    for path in linked_paths(root) {
        let is_symlink = fs::symlink_metadata(&path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false);

        if is_symlink {
            return Err(format!(
                "refusing the symlinked sandbox path {}",
                path.display()
            ));
        }
    }

    Ok(())
}

fn current_uid() -> Result<u32, String> {
    fs::metadata("/proc/self")
        .map(|metadata| metadata.uid())
        .map_err(|error| format!("Could not read the current user id: {error}"))
}

pub(super) fn remove_root(root: &Path) -> Result<(), String> {
    if !remove_root_allowed(root) {
        return Err(format!(
            "refusing to remove {}: it is not a sandbox folder",
            root.display()
        ));
    }

    fs::remove_dir_all(root)
        .map_err(|error| format!("Could not remove {}: {error}", root.display()))
}

pub(super) fn install_openers(root: &Path) -> Result<(), String> {
    let opened = root.join("opened");

    for opener in ["xdg-open", "open"] {
        let path = root.join("bin").join(opener);

        if fs::symlink_metadata(&path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Err(format!("refusing the symlinked opener {}", path.display()));
        }

        let script = format!(
            "#!/bin/sh\nprintf '%s\\n' \"$*\" >>{}\n",
            shell_quote(&opened.to_string_lossy())
        );

        fs::write(&path, script)
            .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
            .map_err(|error| format!("Could not make {} runnable: {error}", path.display()))?;
    }

    Ok(())
}

/// Wraps a path in single quotes for the stub scripts. The root never contains a quote.
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::*;

    fn temporary_root(label: &str) -> PathBuf {
        Path::new("/var/tmp").join(format!(
            "greppa-sandbox-test-{label}-{}",
            std::process::id()
        ))
    }

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
            Some("it is a symlink".to_string())
        );
        assert_eq!(
            root_metadata_problem(
                &RootMetadata {
                    is_dir: false,
                    ..good
                },
                1000
            ),
            Some("it is not a folder".to_string())
        );
        assert_eq!(
            root_metadata_problem(&good, 1001),
            Some("it is not owned by the current user".to_string())
        );
        assert_eq!(
            root_metadata_problem(
                &RootMetadata {
                    mode: 0o755,
                    ..good
                },
                1000
            ),
            Some("its mode is 755, not 700".to_string())
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
        let root = temporary_root("linked");
        let target = std::env::temp_dir().join(format!(
            "greppa-sandbox-test-linked-target-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&target);
        fs::create_dir_all(&root).expect("create the root");
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).expect("secure the root");
        fs::create_dir_all(&target).expect("create the target");
        let marker = target.join("marker");
        fs::write(&marker, "keep").expect("write the marker");
        let link = root.join("run");
        std::os::unix::fs::symlink(&target, &link).expect("link the control path");

        let error = refuse_linked_paths(&root).expect_err("the linked path is refused");

        assert!(error.contains("symlinked"), "unexpected error: {error}");
        assert!(marker.is_file(), "the target must not change");
        assert!(
            fs::symlink_metadata(&link)
                .expect("the link")
                .file_type()
                .is_symlink()
        );

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&target);
    }
}
