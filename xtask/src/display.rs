use std::fs;
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::process::{POLL, TOOL_TIMEOUT, run_with_timeout};

pub(crate) const WESTON_TIMEOUT: Duration = Duration::from_secs(30);

/// A private XDG runtime directory, mode 700, removed on drop. Creation is atomic and refuses an
/// existing path, so a planted symlink cannot redirect it.
pub(crate) struct RuntimeDir {
    path: PathBuf,
}

impl RuntimeDir {
    pub(crate) fn create(prefix: &str) -> Result<Self, String> {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.subsec_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()));
        let mut builder = fs::DirBuilder::new();
        builder.mode(0o700);

        if let Err(error) = builder.create(&path) {
            return Err(format!("Could not create {}: {error}", path.display()));
        }

        for folder in ["home", "config", "state", "data", "cache", "bin"] {
            if let Err(error) = builder.create(path.join(folder)) {
                let _ = fs::remove_dir_all(&path);
                return Err(format!(
                    "Could not create {}/{}: {error}",
                    path.display(),
                    folder
                ));
            }
        }

        Ok(Self { path })
    }

    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for RuntimeDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

pub(crate) struct Running {
    child: Child,
    display: Option<String>,
}

impl Running {
    pub(crate) fn spawn(mut command: Command, name: &str) -> Result<Self, String> {
        let child = command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Could not start {name}: {error}"))?;

        Ok(Self {
            child,
            display: None,
        })
    }

    pub(crate) fn set_display(&mut self, display: &str) {
        self.display = Some(display.to_string());
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();

        if let Some(display) = &self.display {
            clean_display_files(display);
        }
    }
}

const DISPLAY_CLEANUP_TIMEOUT: Duration = Duration::from_secs(3);

pub(crate) fn clean_display_files(display: &str) {
    clean_display_files_in(Path::new("/tmp"), display, DISPLAY_CLEANUP_TIMEOUT);
}

fn clean_display_files_in(folder: &Path, display: &str, timeout: Duration) {
    let Some(number) = display.strip_prefix(':') else {
        return;
    };

    if number.is_empty() || !number.chars().all(|character| character.is_ascii_digit()) {
        return;
    }

    let lock = folder.join(format!(".X{number}-lock"));
    let socket = folder.join(format!(".X11-unix/X{number}"));
    let owner = lock_owner(&lock);

    if let Some(pid) = owner {
        let deadline = Instant::now() + timeout;

        while lock_owner_is_alive(pid) {
            if Instant::now() >= deadline {
                return;
            }

            std::thread::sleep(POLL);
        }
    }

    if lock_owner(&lock) != owner {
        return;
    }

    let _ = fs::remove_file(&lock);
    let _ = fs::remove_file(&socket);
}

fn lock_owner(lock: &Path) -> Option<u32> {
    fs::read_to_string(lock).ok()?.trim().parse().ok()
}

fn lock_owner_is_alive(pid: u32) -> bool {
    let Ok(stat) = fs::read_to_string(format!("/proc/{pid}/stat")) else {
        return false;
    };
    let Some(tail) = stat.rsplit_once(')').map(|(_, tail)| tail) else {
        return false;
    };

    tail.split_whitespace().next() != Some("Z")
}

fn base_weston_command(
    socket: &str,
    width: u32,
    height: u32,
    log: &Path,
    environment: &[(String, String)],
) -> Command {
    let mut command = Command::new("weston");

    command
        .arg("--xwayland")
        .arg(format!("--socket={socket}"))
        .arg(format!("--width={width}"))
        .arg(format!("--height={height}"))
        .arg(format!("--log={}", log.display()))
        .env_clear()
        .envs(environment.iter().cloned());

    command
}

pub(crate) fn weston_command(
    socket: &str,
    width: u32,
    height: u32,
    log: &Path,
    environment: &[(String, String)],
) -> Command {
    let mut command = base_weston_command(socket, width, height, log, environment);

    command.arg("--backend=headless");

    command
}

pub(crate) fn nested_weston_command(
    socket: &str,
    width: u32,
    height: u32,
    log: &Path,
    wayland_display: &str,
    environment: &[(String, String)],
) -> Command {
    let mut command = base_weston_command(socket, width, height, log, environment);

    command
        .arg("--backend=wayland")
        .env("WAYLAND_DISPLAY", wayland_display);

    command
}

pub(crate) fn display_from_log(log: &str) -> Option<String> {
    let marker = "xserver listening on display ";

    log.lines().find_map(|line| {
        let rest = line.split_once(marker)?.1;
        let display: String = rest
            .chars()
            .take_while(|character| !character.is_whitespace())
            .collect();

        display.starts_with(':').then_some(display)
    })
}

pub(crate) fn wait_for_display(log_path: &Path, timeout: Duration) -> Result<String, String> {
    let deadline = Instant::now() + timeout;

    loop {
        if let Ok(log) = fs::read_to_string(log_path)
            && let Some(display) = display_from_log(&log)
        {
            return Ok(display);
        }

        if Instant::now() >= deadline {
            return Err(format!(
                "weston did not print a display within {} seconds.",
                timeout.as_secs()
            ));
        }

        std::thread::sleep(POLL);
    }
}

pub(crate) fn import_window(
    display: &str,
    window: &str,
    path: &Path,
    environment: &[(String, String)],
) -> Result<(), String> {
    let mut command = Command::new("import");

    command
        .args(["-display", display, "-window", window])
        .arg(path)
        .env_clear()
        .envs(environment.iter().cloned());

    let output = run_with_timeout(command, TOOL_TIMEOUT)?;

    if !output.status.success() {
        return Err(format!(
            "import failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::*;

    fn environment() -> Vec<(String, String)> {
        vec![
            ("XDG_RUNTIME_DIR".to_string(), "/tmp/run".to_string()),
            ("HOME".to_string(), "/tmp/home".to_string()),
        ]
    }

    fn value<'a>(command: &'a Command, key: &str) -> Option<&'a OsStr> {
        command
            .get_envs()
            .find(|(name, _)| *name == OsStr::new(key))
            .and_then(|(_, value)| value)
    }

    #[test]
    fn display_from_log_reads_the_xwayland_display() {
        let log = "some line\nxserver listening on display :7\nanother line\n";

        assert_eq!(display_from_log(log), Some(":7".to_string()));
        assert_eq!(display_from_log("no display here"), None);
        assert_eq!(
            display_from_log("xserver listening on display wayland-0"),
            None
        );
    }

    #[test]
    fn headless_weston_drops_the_wayland_session() {
        let command = weston_command(
            "greppa-mock",
            1400,
            900,
            Path::new("/tmp/weston.log"),
            &environment(),
        );
        let arguments: Vec<&OsStr> = command.get_args().collect();

        assert!(arguments.contains(&OsStr::new("--backend=headless")));
        assert_eq!(value(&command, "WAYLAND_DISPLAY"), None);
        assert_eq!(
            value(&command, "XDG_RUNTIME_DIR"),
            Some(OsStr::new("/tmp/run"))
        );
    }

    #[test]
    fn nested_weston_gets_the_caller_wayland_session() {
        let mut caller = environment();
        caller.push(("WAYLAND_DISPLAY".to_string(), "wayland-1".to_string()));
        let command = nested_weston_command(
            "greppa-sandbox-demo",
            1400,
            900,
            Path::new("/tmp/weston.log"),
            "wayland-1",
            &caller,
        );
        let arguments: Vec<&OsStr> = command.get_args().collect();

        assert!(arguments.contains(&OsStr::new("--backend=wayland")));
        assert!(!arguments.contains(&OsStr::new("--backend=headless")));
        assert_eq!(
            value(&command, "WAYLAND_DISPLAY"),
            Some(OsStr::new("wayland-1"))
        );
        assert_eq!(
            value(&command, "XDG_RUNTIME_DIR"),
            Some(OsStr::new("/tmp/run"))
        );
    }

    fn display_files(folder: &Path, owner: u32) -> (PathBuf, PathBuf) {
        let lock = folder.join(".X7-lock");
        let socket = folder.join(".X11-unix/X7");

        fs::create_dir_all(folder.join(".X11-unix")).expect("socket folder");
        fs::write(&lock, format!("{owner:>10}\n")).expect("lock");
        fs::write(&socket, "").expect("socket");

        (lock, socket)
    }

    #[test]
    fn clean_display_files_removes_the_files_of_a_dead_owner() {
        let folder = RuntimeDir::create("greppa-display-dead").expect("folder");
        let (lock, socket) = display_files(folder.path(), u32::MAX);

        clean_display_files_in(folder.path(), ":7", Duration::from_secs(1));

        assert!(!lock.exists());
        assert!(!socket.exists());
    }

    #[test]
    fn clean_display_files_keeps_the_files_of_a_live_owner() {
        let folder = RuntimeDir::create("greppa-display-live").expect("folder");
        let (lock, socket) = display_files(folder.path(), std::process::id());

        clean_display_files_in(folder.path(), ":7", Duration::ZERO);

        assert!(lock.exists());
        assert!(socket.exists());
    }

    #[test]
    fn clean_display_files_keeps_the_files_of_a_new_owner() {
        let folder = RuntimeDir::create("greppa-display-new").expect("folder");
        let mut dying = Command::new("sleep").arg("30").spawn().expect("sleep");
        let (lock, socket) = display_files(folder.path(), dying.id());
        let replacement = lock.clone();
        let new_owner = std::thread::spawn(move || {
            std::thread::sleep(POLL);
            fs::write(&replacement, format!("{:>10}\n", std::process::id())).expect("new lock");
            let _ = dying.kill();
            let _ = dying.wait();
        });

        clean_display_files_in(folder.path(), ":7", Duration::from_secs(10));
        new_owner.join().expect("new owner thread");

        assert!(lock.exists());
        assert!(socket.exists());
    }

    #[test]
    fn clean_display_files_ignores_a_display_that_is_not_a_number() {
        let folder = RuntimeDir::create("greppa-display-name").expect("folder");
        let (lock, socket) = display_files(folder.path(), u32::MAX);

        clean_display_files_in(folder.path(), ":7x", Duration::ZERO);

        assert!(lock.exists());
        assert!(socket.exists());
    }
}
