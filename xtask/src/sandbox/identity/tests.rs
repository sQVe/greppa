use std::io::BufRead as _;
use std::process::{Command, Stdio};
use std::time::Instant;

use super::*;

struct ChildGuard {
    child: std::process::Child,
}

impl ChildGuard {
    fn new(child: std::process::Child) -> Self {
        Self { child }
    }

    fn spawn(command: &mut Command) -> Self {
        Self::new(command.spawn().expect("spawn the child"))
    }

    fn id(&self) -> u32 {
        self.child.id()
    }

    fn is_running(&mut self) -> bool {
        self.child.try_wait().expect("check the child").is_none()
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        crate::test_support::stop_child(&mut self.child);
    }
}

fn spawn_sleep() -> ChildGuard {
    let mut command = Command::new("sleep");
    command.arg("30");

    ChildGuard::spawn(&mut command)
}

fn spawn_without_marker() -> ChildGuard {
    let mut command = Command::new("sleep");
    command.arg("30").env_remove("GREPPA_SANDBOX_ROOT");

    ChildGuard::spawn(&mut command)
}

fn spawn_with_marker(root: &Path) -> ChildGuard {
    let mut command = Command::new("sleep");
    command
        .arg("30")
        .env("GREPPA_SANDBOX_ROOT", root.as_os_str());

    ChildGuard::spawn(&mut command)
}

fn spawn_term_ignorer() -> ChildGuard {
    let mut command = Command::new("sh");
    command.args(["-c", "trap \"\" TERM; echo ready; exec sleep 30"]);
    command.stdout(Stdio::piped());

    let mut child = command.spawn().expect("spawn the term-ignoring child");
    let stdout = child.stdout.take().expect("piped stdout");
    let mut reader = std::io::BufReader::new(stdout);
    let mut ready = String::new();
    reader.read_line(&mut ready).expect("read the ready line");

    assert_eq!(ready.trim(), "ready", "the child installed its TERM trap");

    ChildGuard::new(child)
}

fn spawn_exiting() -> ChildGuard {
    ChildGuard::spawn(&mut Command::new("true"))
}

fn record_child(path: &Path, child: &ChildGuard) -> u64 {
    let started = process_start(child.id()).expect("the child has a start time");

    fs::write(path, format!("{} {started}\n", child.id())).expect("write the record");

    started
}

fn wait_for_zombie(pid: u32, timeout: Duration) {
    let started = Instant::now();

    while !process_is_zombie(pid) {
        assert!(
            started.elapsed() < timeout,
            "the child did not become a zombie in time"
        );

        std::thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn stop_window_leaves_a_child_without_the_marker_running() {
    let root = crate::test_support::temporary_sandbox_root("stop-window-plain");
    let path = root.path().join("pid");
    let mut child = spawn_without_marker();
    record_child(&path, &child);

    stop_window(root.path()).expect("stop_window");

    assert!(
        child.is_running(),
        "a child without the marker must keep running"
    );
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_window_stops_a_child_with_the_matching_marker() {
    let root = crate::test_support::temporary_sandbox_root("stop-window-ours");
    let path = root.path().join("pid");
    let mut child = spawn_with_marker(root.path());
    record_child(&path, &child);

    stop_window(root.path()).expect("stop_window");

    assert!(!child.is_running(), "the marked child is stopped");
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_window_leaves_a_child_with_a_marker_for_another_root_running() {
    let root = crate::test_support::temporary_sandbox_root("stop-window-root");
    let other = crate::test_support::temporary_sandbox_root("stop-window-other");
    let path = root.path().join("pid");
    let mut child = spawn_with_marker(other.path());
    record_child(&path, &child);

    stop_window(root.path()).expect("stop_window");

    assert!(
        child.is_running(),
        "a child marked for another root must keep running"
    );
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_recorded_stops_a_recorded_child() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_sleep();
    record_child(&path, &child);

    stop_recorded(&path).expect("stop_recorded");

    assert!(!child.is_running(), "the recorded child is stopped");
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_recorded_leaves_a_child_with_a_changed_start_time_running() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_sleep();
    let started = process_start(child.id()).expect("the child has a start time");
    fs::write(&path, format!("{} {}\n", child.id(), started + 1)).expect("write the record");

    stop_recorded(&path).expect("stop_recorded");

    assert!(
        child.is_running(),
        "a changed start time must not stop the child"
    );
    assert!(!path.exists(), "the stale record is removed");
}

#[test]
fn stop_process_stops_a_child_and_removes_the_record() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_sleep();
    let started = record_child(&path, &child);

    stop_process(&path, child.id(), started, Duration::from_secs(2)).expect("stop_process");

    assert!(!child.is_running(), "a plain child is stopped by TERM");
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_process_keeps_the_record_when_the_child_ignores_term() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_term_ignorer();
    let started = record_child(&path, &child);

    let error = stop_process(&path, child.id(), started, Duration::from_millis(300))
        .expect_err("a child that ignores TERM must time out");

    assert!(
        error.to_string().contains("did not stop"),
        "unexpected error: {error:#}"
    );
    assert!(
        path.exists(),
        "the record is kept when the child will not stop"
    );
    assert!(child.is_running(), "the child keeps running");
}

#[test]
fn stop_loop_treats_a_zombie_as_stopped() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let child = spawn_exiting();
    let pid = child.id();
    let started = record_child(&path, &child);

    wait_for_zombie(pid, Duration::from_secs(3));
    stop_loop(&path, pid, started, Duration::from_secs(1)).expect("stop_loop");

    assert!(!path.exists(), "a zombie's record is removed");
}

#[test]
fn process_start_is_none_for_a_missing_pid() {
    assert_eq!(process_start(u32::MAX), None);
}

#[test]
fn process_parent_names_the_test_process() {
    let child = spawn_sleep();

    assert_eq!(process_parent(child.id()), Some(std::process::id()));
}

#[test]
fn child_pids_finds_a_child_and_not_a_stranger() {
    let child = spawn_sleep();

    assert!(child_pids(std::process::id()).contains(&child.id()));
    assert!(!child_pids(u32::MAX).contains(&child.id()));
}

#[test]
fn record_process_writes_the_pid_and_start_time() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let child = spawn_sleep();

    record_process(&path, child.id(), "sleep", Duration::from_secs(1)).expect("record_process");

    let (pid, started) = read_record(&path).expect("the record exists");
    assert_eq!(pid, child.id());
    assert_eq!(
        started,
        process_start(child.id()).expect("the child has a start time")
    );
}

#[test]
fn record_process_rejects_a_wrong_name_and_writes_no_file() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let child = spawn_sleep();

    let error = record_process(&path, child.id(), "not-the-name", Duration::from_secs(1))
        .expect_err("a wrong name must fail");

    assert!(
        error.to_string().contains("is not the expected"),
        "unexpected error: {error:#}"
    );
    assert!(!path.exists(), "no record is written");
}

#[test]
fn record_process_rejects_a_missing_pid_and_writes_no_file() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");

    let error = record_process(&path, u32::MAX, "sleep", Duration::from_secs(1))
        .expect_err("a missing pid must fail");

    assert!(
        error.to_string().contains("is gone"),
        "unexpected error: {error:#}"
    );
    assert!(!path.exists(), "no record is written");
}

#[test]
fn identity_still_matches_rejects_a_changed_start_time() {
    let pid = std::process::id();
    let started = process_start(pid).expect("the test process has a start time");

    assert!(identity_still_matches(pid, started));
    assert!(!identity_still_matches(pid, started + 1));
}

#[test]
fn record_matches_rejects_a_changed_start_time() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let pid = std::process::id();
    let started = process_start(pid).expect("the test process has a start time");

    fs::write(&path, format!("{pid} {started}\n")).expect("write the matching record");
    assert!(record_matches(&path));

    fs::write(&path, format!("{pid} {}\n", started + 1)).expect("write the changed record");
    assert!(!record_matches(&path));
}

#[test]
fn stop_process_skips_a_mismatched_start_time() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let pid = std::process::id();
    let started = process_start(pid).expect("the test process has a start time");

    fs::write(&path, format!("{pid} {started}\n")).expect("write the record");
    let result = stop_process(&path, pid, started + 1, Duration::from_secs(1));

    assert!(result.is_ok());
    assert!(!path.exists(), "a mismatched record is removed");
}

#[test]
fn stop_after_open_refuses_a_changed_identity_without_signaling() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let pid = std::process::id();
    let started = process_start(pid).expect("the test process has a start time");
    fs::write(&path, format!("{pid} {started}\n")).expect("write the record");

    let mut signaled = false;
    let result = stop_after_open(
        &path,
        pid,
        started,
        Some(started + 1),
        Duration::from_secs(1),
        || signaled = true,
    );

    assert!(result.is_ok());
    assert!(!signaled, "a changed identity must not signal");
    assert!(!path.exists(), "the stale record is removed");
}
