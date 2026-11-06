use std::ffi::OsStr;
use std::time::Instant;

use super::*;
use crate::process::POLL;

#[test]
fn runtime_dir_is_private_and_removed_on_drop() {
    use std::os::unix::fs::PermissionsExt;

    let runtime = RuntimeDir::create("greppa-xtask-test-runtime").expect("runtime dir");
    let path = runtime.path().to_path_buf();
    let mode = fs::metadata(&path).expect("metadata").permissions().mode();

    assert_eq!(mode & 0o777, 0o700);
    assert!(path.join("home").is_dir());
    assert!(path.join("bin").is_dir());

    drop(runtime);

    assert!(!path.exists());
}

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
    display_files_for(folder, "7", owner)
}

fn display_files_for(folder: &Path, number: &str, owner: u32) -> (PathBuf, PathBuf) {
    let lock = folder.join(format!(".X{number}-lock"));
    let socket = folder.join(format!(".X11-unix/X{number}"));

    fs::create_dir_all(folder.join(".X11-unix")).expect("socket folder");
    fs::write(&lock, format!("{owner:>10}\n")).expect("lock");
    fs::write(&socket, "").expect("socket");

    (lock, socket)
}

#[test]
fn clean_display_files_removes_the_files_of_a_dead_owner() {
    let folder = crate::test_support::temporary_directory();
    let (lock, socket) = display_files(folder.path(), u32::MAX);

    clean_display_files_in(folder.path(), ":7", Duration::from_secs(1));

    assert!(!lock.exists());
    assert!(!socket.exists());
}

#[test]
fn clean_display_files_keeps_the_files_of_a_live_owner() {
    let folder = crate::test_support::temporary_directory();
    let (lock, socket) = display_files(folder.path(), std::process::id());

    clean_display_files_in(folder.path(), ":7", Duration::ZERO);

    assert!(lock.exists());
    assert!(socket.exists());
}

#[test]
fn clean_display_files_keeps_the_files_of_a_new_owner() {
    let folder = crate::test_support::temporary_directory();
    let mut dying = Command::new("sleep").arg("30").spawn().expect("sleep");
    let (lock, socket) = display_files(folder.path(), dying.id());
    let replacement = lock.clone();
    let new_owner = std::thread::spawn(move || {
        std::thread::sleep(POLL);
        fs::write(&replacement, format!("{:>10}\n", std::process::id())).expect("new lock");
        crate::test_support::stop_child(&mut dying);
    });

    clean_display_files_in(folder.path(), ":7", Duration::from_secs(10));
    new_owner.join().expect("new owner thread");

    assert!(lock.exists());
    assert!(socket.exists());
}

#[test]
fn clean_display_files_ignores_a_display_that_is_not_a_number() {
    let folder = crate::test_support::temporary_directory();
    let (lock, socket) = display_files(folder.path(), u32::MAX);

    clean_display_files_in(folder.path(), ":7x", Duration::ZERO);

    assert!(lock.exists());
    assert!(socket.exists());
}

#[test]
fn clean_display_files_ignores_a_display_without_a_number() {
    let folder = crate::test_support::temporary_directory();
    let (lock, socket) = display_files_for(folder.path(), "", u32::MAX);

    clean_display_files_in(folder.path(), ":", Duration::ZERO);

    assert!(lock.exists());
    assert!(socket.exists());
}

#[test]
fn clean_display_files_waits_for_an_owner_that_exits_later() {
    let folder = crate::test_support::temporary_directory();
    let mut owner = Command::new("sleep").arg("30").spawn().expect("sleep");
    let (lock, socket) = display_files(folder.path(), owner.id());
    let exit = std::thread::spawn(move || {
        std::thread::sleep(POLL * 3);
        crate::test_support::stop_child(&mut owner);
    });

    clean_display_files_in(folder.path(), ":7", Duration::from_secs(10));
    exit.join().expect("owner thread");

    assert!(!lock.exists());
    assert!(!socket.exists());
}

#[test]
fn dropping_running_stops_and_reaps_the_child() {
    let mut command = Command::new("sleep");
    command.arg("30");
    let running = Running::spawn(command, "sleep").expect("start sleep");
    let process = PathBuf::from(format!("/proc/{}", running.child.id()));
    let started = Instant::now();

    drop(running);

    assert!(
        started.elapsed() < Duration::from_secs(10),
        "the child was not stopped"
    );
    assert!(!process.exists(), "the child was not reaped");
}

#[test]
fn wait_for_display_returns_a_display_that_appears_later() {
    let folder = crate::test_support::temporary_directory();
    let log = folder.path().join("weston.log");
    let writer_path = log.clone();
    let writer = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(150));
        fs::write(&writer_path, "xserver listening on display :7\n").expect("write the log");
    });

    let display = wait_for_display(&log, Duration::from_secs(2)).expect("the display appears");

    writer.join().expect("the writer thread");
    assert_eq!(display, ":7");
}

#[test]
fn wait_for_display_reports_a_timeout() {
    let folder = crate::test_support::temporary_directory();
    let log = folder.path().join("weston.log");
    let timeout = Duration::from_millis(150);

    let error = wait_for_display(&log, timeout).expect_err("a missing display times out");

    assert!(
        matches!(
            error.downcast_ref::<DisplayError>(),
            Some(DisplayError::DisplayTimeout { timeout: recorded, log: recorded_log })
                if *recorded == timeout && recorded_log == &log
        ),
        "unexpected error: {error:#}"
    );
}

#[test]
fn the_display_errors_render_their_messages() {
    let error = DisplayError::DisplayTimeout {
        timeout: Duration::from_secs(3),
        log: PathBuf::from("/tmp/weston.log"),
    };

    assert_eq!(
        error.to_string(),
        "weston did not print a display within 3 seconds."
    );
}
