use std::path::Path;

use crate::environment::{self, ChildDirs};

pub(super) fn caller_environment() -> Vec<(String, String)> {
    std::env::vars().collect()
}

pub(super) fn sandbox_environment(
    caller: &[(String, String)],
    root: &Path,
    display: &str,
) -> Vec<(String, String)> {
    let marker = root.to_string_lossy().into_owned();
    let dirs = ChildDirs::under(root);

    environment::child_environment(
        caller,
        &dirs,
        &[("DISPLAY", display), ("GREPPA_SANDBOX_ROOT", &marker)],
    )
}

pub(super) fn weston_environment(
    caller: &[(String, String)],
    root: &Path,
) -> Vec<(String, String)> {
    environment::child_environment(caller, &ChildDirs::under(root), &[])
}

pub(super) fn nested_weston_environment(
    caller: &[(String, String)],
    root: &Path,
    runtime: &Path,
) -> Vec<(String, String)> {
    let mut dirs = ChildDirs::under(root);
    dirs.runtime = runtime.to_path_buf();

    environment::child_environment(caller, &dirs, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hostile_caller() -> Vec<(String, String)> {
        [
            ("DISPLAY", ":0"),
            ("WAYLAND_DISPLAY", "wayland-0"),
            ("LIBEI_SOCKET", "/run/user/1000/eis-0"),
            ("DBUS_SESSION_BUS_ADDRESS", "unix:path=/run/user/1000/bus"),
            ("GREPPA_SANDBOX_ROOT", "/home/user"),
            ("HOME", "/home/user"),
            ("XDG_CONFIG_HOME", "/home/user/.config"),
            ("XDG_STATE_HOME", "/home/user/.local/state"),
            ("XDG_DATA_HOME", "/home/user/.local/share"),
            ("XDG_CACHE_HOME", "/home/user/.cache"),
            ("XDG_RUNTIME_DIR", "/run/user/1000"),
            ("PATH", "/usr/bin:/bin"),
        ]
        .into_iter()
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
    }

    fn value<'a>(environment: &'a [(String, String)], key: &str) -> Option<&'a str> {
        environment
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    fn assert_no_caller_session(environment: &[(String, String)]) {
        for key in [
            "WAYLAND_DISPLAY",
            "LIBEI_SOCKET",
            "DBUS_SESSION_BUS_ADDRESS",
        ] {
            assert_eq!(value(environment, key), None, "{key}");
        }
    }

    #[test]
    fn sandbox_environment_uses_the_private_display_and_folders() {
        let root = Path::new("/var/tmp/greppa-sandbox-smoke");

        let environment = sandbox_environment(&hostile_caller(), root, ":7");

        assert_no_caller_session(&environment);

        for (key, expected) in [
            ("DISPLAY", ":7"),
            ("GREPPA_SANDBOX_ROOT", "/var/tmp/greppa-sandbox-smoke"),
            ("HOME", "/var/tmp/greppa-sandbox-smoke/home"),
            ("XDG_CONFIG_HOME", "/var/tmp/greppa-sandbox-smoke/config"),
            ("XDG_STATE_HOME", "/var/tmp/greppa-sandbox-smoke/state"),
            ("XDG_DATA_HOME", "/var/tmp/greppa-sandbox-smoke/data"),
            ("XDG_CACHE_HOME", "/var/tmp/greppa-sandbox-smoke/cache"),
            ("XDG_RUNTIME_DIR", "/var/tmp/greppa-sandbox-smoke/run"),
            ("PATH", "/var/tmp/greppa-sandbox-smoke/bin:/usr/bin:/bin"),
        ] {
            assert_eq!(value(&environment, key), Some(expected), "{key}");
        }
    }

    #[test]
    fn weston_environment_has_no_caller_display_or_session() {
        let root = Path::new("/var/tmp/greppa-sandbox-smoke");

        let environment = weston_environment(&hostile_caller(), root);

        assert_no_caller_session(&environment);

        for (key, expected) in [
            ("DISPLAY", None),
            ("GREPPA_SANDBOX_ROOT", None),
            ("HOME", Some("/var/tmp/greppa-sandbox-smoke/home")),
            (
                "XDG_STATE_HOME",
                Some("/var/tmp/greppa-sandbox-smoke/state"),
            ),
            ("XDG_DATA_HOME", Some("/var/tmp/greppa-sandbox-smoke/data")),
            (
                "XDG_CACHE_HOME",
                Some("/var/tmp/greppa-sandbox-smoke/cache"),
            ),
            ("XDG_RUNTIME_DIR", Some("/var/tmp/greppa-sandbox-smoke/run")),
            (
                "PATH",
                Some("/var/tmp/greppa-sandbox-smoke/bin:/usr/bin:/bin"),
            ),
        ] {
            assert_eq!(value(&environment, key), expected, "{key}");
        }
    }

    #[test]
    fn nested_weston_environment_gets_only_the_given_runtime_folder() {
        let root = Path::new("/var/tmp/greppa-sandbox-smoke");

        let environment =
            nested_weston_environment(&hostile_caller(), root, Path::new("/run/user/1000"));

        assert_no_caller_session(&environment);

        for (key, expected) in [
            ("DISPLAY", None),
            ("XDG_RUNTIME_DIR", Some("/run/user/1000")),
            ("HOME", Some("/var/tmp/greppa-sandbox-smoke/home")),
            (
                "XDG_CONFIG_HOME",
                Some("/var/tmp/greppa-sandbox-smoke/config"),
            ),
            (
                "XDG_STATE_HOME",
                Some("/var/tmp/greppa-sandbox-smoke/state"),
            ),
            ("XDG_DATA_HOME", Some("/var/tmp/greppa-sandbox-smoke/data")),
            (
                "XDG_CACHE_HOME",
                Some("/var/tmp/greppa-sandbox-smoke/cache"),
            ),
        ] {
            assert_eq!(value(&environment, key), expected, "{key}");
        }
    }
}
