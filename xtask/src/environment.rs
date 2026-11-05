//! The child environment allowlist. Every sandbox child except nested Weston uses it.

use std::path::{Path, PathBuf};

const ALLOWED_KEYS: &[&str] = &[
    "TERM",
    "USER",
    "LOGNAME",
    "SHELL",
    "TZ",
    "LANG",
    "LANGUAGE",
    "XDG_DATA_DIRS",
    "LD_LIBRARY_PATH",
    "RUST_BACKTRACE",
    "RUST_LOG",
];

const ALLOWED_PREFIXES: &[&str] = &[
    "LC_",
    "LIBGL_",
    "MESA_",
    "VK_",
    "VULKAN_",
    "WGPU_",
    "FONTCONFIG_",
    "FREETYPE_",
    "NIX_",
    "WESTON_",
    "__",
];

fn caller_key_is_allowed(key: &str) -> bool {
    ALLOWED_KEYS.contains(&key)
        || ALLOWED_PREFIXES
            .iter()
            .any(|prefix| key.starts_with(prefix))
}

pub(crate) struct ChildDirs {
    pub home: PathBuf,
    pub config: PathBuf,
    pub state: PathBuf,
    pub data: PathBuf,
    pub cache: PathBuf,
    pub runtime: PathBuf,
    pub bin: PathBuf,
}

impl ChildDirs {
    pub(crate) fn under(root: &Path) -> Self {
        Self {
            home: root.join("home"),
            config: root.join("config"),
            state: root.join("state"),
            data: root.join("data"),
            cache: root.join("cache"),
            runtime: root.join("run"),
            bin: root.join("bin"),
        }
    }
}

fn set(environment: &mut Vec<(String, String)>, key: &str, value: &str) {
    environment.retain(|(existing, _)| existing != key);
    environment.push((key.to_string(), value.to_string()));
}

/// Builds a cleared environment from the caller's allowlisted values plus the sandbox values.
/// `extras` win over both, so a sandbox `DISPLAY` replaces an inherited one.
pub(crate) fn child_environment(
    caller: &[(String, String)],
    dirs: &ChildDirs,
    extras: &[(&str, &str)],
) -> Vec<(String, String)> {
    let host_path = caller
        .iter()
        .find(|(key, _)| key == "PATH")
        .map(|(_, value)| value.clone())
        .unwrap_or_default();

    let mut environment = Vec::new();

    set(&mut environment, "HOME", &dirs.home.to_string_lossy());
    set(
        &mut environment,
        "XDG_CONFIG_HOME",
        &dirs.config.to_string_lossy(),
    );
    set(
        &mut environment,
        "XDG_STATE_HOME",
        &dirs.state.to_string_lossy(),
    );
    set(
        &mut environment,
        "XDG_DATA_HOME",
        &dirs.data.to_string_lossy(),
    );
    set(
        &mut environment,
        "XDG_CACHE_HOME",
        &dirs.cache.to_string_lossy(),
    );
    set(
        &mut environment,
        "XDG_RUNTIME_DIR",
        &dirs.runtime.to_string_lossy(),
    );
    set(
        &mut environment,
        "PATH",
        &format!("{}:{host_path}", dirs.bin.display()),
    );

    for (key, value) in extras {
        set(&mut environment, key, value);
    }

    for (key, value) in caller {
        if environment.iter().any(|(existing, _)| existing == key) {
            continue;
        }

        if caller_key_is_allowed(key) {
            environment.push((key.clone(), value.clone()));
        }
    }

    environment
}

#[cfg(test)]
mod tests {
    use super::*;

    fn caller() -> Vec<(String, String)> {
        vec![
            ("DISPLAY".to_string(), ":0".to_string()),
            ("WAYLAND_DISPLAY".to_string(), "wayland-0".to_string()),
            ("WAYLAND_SOCKET".to_string(), "3".to_string()),
            ("LIBEI_SOCKET".to_string(), "/run/user/1000/ei".to_string()),
            (
                "XAUTHORITY".to_string(),
                "/home/user/.Xauthority".to_string(),
            ),
            ("SWAYSOCK".to_string(), "/run/user/1000/sway".to_string()),
            (
                "DBUS_SESSION_BUS_ADDRESS".to_string(),
                "unix:path=/run/dbus".to_string(),
            ),
            ("HOME".to_string(), "/home/user".to_string()),
            ("XDG_RUNTIME_DIR".to_string(), "/run/user/1000".to_string()),
            ("PATH".to_string(), "/usr/bin".to_string()),
            ("LANG".to_string(), "en_US.UTF-8".to_string()),
            ("LC_ALL".to_string(), "C".to_string()),
            ("TRAILING".to_string(), "drop-me".to_string()),
        ]
    }

    fn value<'a>(environment: &'a [(String, String)], key: &str) -> Option<&'a str> {
        environment
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    #[test]
    fn drops_caller_desktop_and_keeps_sandbox_paths() {
        let root = Path::new("/var/tmp/greppa-sandbox-smoke");
        let dirs = ChildDirs::under(root);
        let environment = child_environment(&caller(), &dirs, &[("DISPLAY", ":7")]);

        assert_eq!(value(&environment, "DISPLAY"), Some(":7"));
        assert_eq!(value(&environment, "WAYLAND_DISPLAY"), None);
        assert_eq!(value(&environment, "WAYLAND_SOCKET"), None);
        assert_eq!(value(&environment, "LIBEI_SOCKET"), None);
        assert_eq!(value(&environment, "XAUTHORITY"), None);
        assert_eq!(value(&environment, "SWAYSOCK"), None);
        assert_eq!(value(&environment, "DBUS_SESSION_BUS_ADDRESS"), None);
        assert_eq!(value(&environment, "TRAILING"), None);
        assert_eq!(
            value(&environment, "HOME"),
            Some("/var/tmp/greppa-sandbox-smoke/home")
        );
        assert_eq!(
            value(&environment, "XDG_RUNTIME_DIR"),
            Some("/var/tmp/greppa-sandbox-smoke/run")
        );
        assert_eq!(
            value(&environment, "PATH"),
            Some("/var/tmp/greppa-sandbox-smoke/bin:/usr/bin")
        );
        assert_eq!(value(&environment, "LANG"), Some("en_US.UTF-8"));
        assert_eq!(value(&environment, "LC_ALL"), Some("C"));
    }

    #[test]
    fn extras_replace_the_caller_value() {
        let root = Path::new("/var/tmp/greppa-sandbox-smoke");
        let environment = child_environment(
            &caller(),
            &ChildDirs::under(root),
            &[("WAYLAND_DISPLAY", "wayland-1"), ("DISPLAY", ":7")],
        );

        assert_eq!(value(&environment, "WAYLAND_DISPLAY"), Some("wayland-1"));
        assert_eq!(
            environment
                .iter()
                .filter(|(key, _)| key == "WAYLAND_DISPLAY")
                .count(),
            1
        );
    }
}
