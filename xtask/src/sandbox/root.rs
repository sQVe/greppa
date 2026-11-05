use std::fs;
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};

use anyhow::Context as _;
use thiserror::Error;

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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RootReason {
    Symlink,
    NotDirectory,
    WrongOwner,
    WrongMode { mode: u32 },
}

impl std::fmt::Display for RootReason {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RootReason::Symlink => formatter.write_str("it is a symlink"),
            RootReason::NotDirectory => formatter.write_str("it is not a folder"),
            RootReason::WrongOwner => formatter.write_str("it is not owned by the current user"),
            RootReason::WrongMode { mode } => write!(formatter, "its mode is {mode:o}, not 700"),
        }
    }
}

#[derive(Debug, Error)]
pub(super) enum RootError {
    #[error("refusing {}: {reason}", path.display())]
    Unsafe { path: PathBuf, reason: RootReason },
    #[error("refusing the symlinked sandbox path {}", path.display())]
    LinkedPath { path: PathBuf },
}

pub(super) fn root_metadata_problem(
    metadata: &RootMetadata,
    current_uid: u32,
) -> Option<RootReason> {
    if metadata.is_symlink {
        return Some(RootReason::Symlink);
    }

    if !metadata.is_dir {
        return Some(RootReason::NotDirectory);
    }

    if metadata.owner != current_uid {
        return Some(RootReason::WrongOwner);
    }

    if metadata.mode & 0o777 != 0o700 {
        return Some(RootReason::WrongMode {
            mode: metadata.mode & 0o777,
        });
    }

    None
}

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

pub(super) fn require_trusted_root(root: &Path) -> anyhow::Result<()> {
    refuse_unsafe_root(root)?;
    refuse_linked_paths(root)?;

    Ok(())
}

pub(super) fn prepare_root(root: &Path) -> anyhow::Result<()> {
    refuse_unsafe_root(root)?;

    if !root.exists() {
        fs::create_dir(root).with_context(|| format!("Could not create {}", root.display()))?;
        fs::set_permissions(root, fs::Permissions::from_mode(0o700))
            .with_context(|| format!("Could not secure {}", root.display()))?;
    }

    refuse_unsafe_root(root)?;

    for folder in ["run", "config", "state", "data", "cache", "home", "bin"] {
        let path = root.join(folder);

        if !path.exists() {
            fs::create_dir(&path)
                .with_context(|| format!("Could not create {}", path.display()))?;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                .with_context(|| format!("Could not secure {}", path.display()))?;
        }
    }

    refuse_linked_paths(root)?;

    Ok(())
}

pub(super) fn refuse_unsafe_root(root: &Path) -> anyhow::Result<()> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(error).with_context(|| format!("Could not read {}", root.display()));
        }
    };

    let described = RootMetadata {
        is_symlink: metadata.file_type().is_symlink(),
        is_dir: metadata.is_dir(),
        owner: metadata.uid(),
        mode: metadata.permissions().mode(),
    };

    match root_metadata_problem(&described, current_uid()?) {
        Some(reason) => Err(RootError::Unsafe {
            path: root.to_path_buf(),
            reason,
        }
        .into()),
        None => Ok(()),
    }
}

pub(super) fn refuse_linked_paths(root: &Path) -> Result<(), RootError> {
    for path in linked_paths(root) {
        let is_symlink = fs::symlink_metadata(&path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false);

        if is_symlink {
            return Err(RootError::LinkedPath { path });
        }
    }

    Ok(())
}

fn current_uid() -> anyhow::Result<u32> {
    fs::metadata("/proc/self")
        .map(|metadata| metadata.uid())
        .with_context(|| "Could not read the current user id")
}

pub(super) fn remove_root(root: &Path) -> anyhow::Result<()> {
    if !remove_root_allowed(root) {
        anyhow::bail!(
            "refusing to remove {}: it is not a sandbox folder",
            root.display()
        );
    }

    fs::remove_dir_all(root).with_context(|| format!("Could not remove {}", root.display()))
}

pub(super) fn install_openers(root: &Path) -> anyhow::Result<()> {
    let opened = root.join("opened");

    for opener in ["xdg-open", "open"] {
        let path = root.join("bin").join(opener);

        if fs::symlink_metadata(&path)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
        {
            anyhow::bail!("refusing the symlinked opener {}", path.display());
        }

        let script = format!(
            "#!/bin/sh\nprintf '%s\\n' \"$*\" >>{}\n",
            shell_quote(&opened.to_string_lossy())
        );

        fs::write(&path, script).with_context(|| format!("Could not write {}", path.display()))?;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
            .with_context(|| format!("Could not make {} runnable", path.display()))?;
    }

    Ok(())
}

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
        crate::test_support::remove_dir_all(&root);
        crate::test_support::remove_dir_all(&target);
        fs::create_dir_all(&root).expect("create the root");
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).expect("secure the root");
        fs::create_dir_all(&target).expect("create the target");
        let marker = target.join("marker");
        fs::write(&marker, "keep").expect("write the marker");
        let link = root.join("run");
        std::os::unix::fs::symlink(&target, &link).expect("link the control path");

        let error = refuse_linked_paths(&root).expect_err("the linked path is refused");

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

        crate::test_support::remove_dir_all(&root);
        crate::test_support::remove_dir_all(&target);
    }
}
