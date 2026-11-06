use std::io::BufRead as _;
use std::os::unix::process::CommandExt as _;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use super::*;

struct ChildGuard {
    child: std::process::Child,
    reaped: bool,
    group: bool,
}

impl ChildGuard {
    fn new(child: std::process::Child) -> Self {
        Self {
            child,
            reaped: false,
            group: false,
        }
    }

    fn spawn(command: &mut Command) -> Self {
        Self::new(command.spawn().expect("spawn the child"))
    }

    fn spawn_group(command: &mut Command) -> Self {
        command.process_group(0);
        let mut guard = Self::new(command.spawn().expect("spawn the child"));
        guard.group = true;

        guard
    }

    fn id(&self) -> u32 {
        self.child.id()
    }

    fn is_running(&mut self) -> bool {
        !self.reaped && self.child.try_wait().expect("check the child").is_none()
    }

    fn wait_for_exit(&mut self, timeout: Duration) -> bool {
        if self.reaped {
            return true;
        }

        let exited = poll_until(timeout, || {
            Ok(self.child.try_wait().expect("check the child"))
        })
        .expect("the exit wait cannot fail")
        .is_some();
        self.reaped = exited;

        exited
    }

    fn wait_until_ready(&self, fragment: &str, timeout: Duration) {
        let ready = poll_until(timeout, || {
            let Ok(cmdline) = fs::read(format!("/proc/{}/cmdline", self.id())) else {
                return Ok(None);
            };
            let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

            Ok(cmdline.contains(fragment).then_some(()))
        })
        .expect("the readiness check cannot fail");

        assert!(ready.is_some(), "the child never named itself {fragment}");
    }

    fn reap(&mut self) {
        if self.reaped {
            return;
        }

        if self.group {
            stop_process_group(self.child.id());
        }

        crate::test_support::stop_child(&mut self.child);
        self.reaped = true;
    }
}

fn stop_process_group(child_id: u32) {
    let Some(pgid) = rustix::process::Pid::from_raw(child_id as i32) else {
        return;
    };

    if let Err(error) = rustix::process::kill_process_group(pgid, rustix::process::Signal::KILL) {
        let error = std::io::Error::from(error);

        if let Some(warning) = crate::cleanup::cleanup_warning("stop the process group", &error) {
            panic!("{warning}");
        }
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        self.reap();
    }
}

fn spawn_sleep() -> ChildGuard {
    let mut command = Command::new("sleep");
    command.arg("30");

    ChildGuard::spawn(&mut command)
}

fn spawn_ready_sleep() -> ChildGuard {
    let child = spawn_sleep();
    child.wait_until_ready("sleep", Duration::from_secs(2));

    child
}

fn spawn_without_marker() -> ChildGuard {
    let mut command = Command::new("sleep");
    command.arg("30").env_remove("GREPPA_SANDBOX_ROOT");
    let child = ChildGuard::spawn(&mut command);
    child.wait_until_ready("sleep", Duration::from_secs(2));

    child
}

fn spawn_with_marker(root: &Path) -> ChildGuard {
    let mut command = Command::new("sleep");
    command
        .arg("30")
        .env("GREPPA_SANDBOX_ROOT", root.as_os_str());
    let child = ChildGuard::spawn(&mut command);
    child.wait_until_ready("sleep", Duration::from_secs(2));

    child
}

fn spawn_fake_weston(child_name: &str) -> (ChildGuard, u32) {
    let mut command = Command::new("bash");
    command.args(["-c", &format!("exec -a \"{child_name}\" sleep 30 & wait")]);
    let parent = ChildGuard::spawn_group(&mut command);
    let child = wait_for_child_named(parent.id(), child_name, Duration::from_secs(2));

    (parent, child)
}

fn wait_for_child_named(parent: u32, name: &str, timeout: Duration) -> u32 {
    let found = poll_until(timeout, || {
        for pid in child_pids(parent) {
            let Ok(cmdline) = fs::read(format!("/proc/{pid}/cmdline")) else {
                continue;
            };
            let cmdline = String::from_utf8_lossy(&cmdline).replace('\0', " ");

            if cmdline.contains(name) {
                return Ok(Some(pid));
            }
        }

        Ok(None)
    })
    .expect("the child scan cannot fail");

    found.expect("the named child appeared in time")
}

fn write_weston_record(root: &Path, pid: u32) {
    let started = process_start(pid).expect("the fake weston has a start time");

    fs::write(root.join("weston.pid"), format!("{pid} {started}\n")).expect("write weston.pid");
}

fn spawn_term_ignorer() -> ChildGuard {
    let mut command = Command::new("sh");
    command.args(["-c", "trap \"\" TERM; echo ready; exec sleep 30"]);
    command.stdout(Stdio::piped());

    let mut child = ChildGuard::spawn(&mut command);
    let stdout = child.child.stdout.take().expect("piped stdout");
    let mut reader = std::io::BufReader::new(stdout);
    let mut ready = String::new();
    reader.read_line(&mut ready).expect("read the ready line");

    assert_eq!(ready.trim(), "ready", "the child installed its TERM trap");

    child.wait_until_ready("sleep", Duration::from_secs(2));

    child
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
    let ready = poll_until(timeout, || Ok(process_is_zombie(pid).then_some(())))
        .expect("the zombie check cannot fail");

    assert!(ready.is_some(), "the child did not become a zombie in time");
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

    assert!(
        child.wait_for_exit(Duration::from_secs(2)),
        "the marked child is stopped"
    );
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
    let mut child = spawn_ready_sleep();
    record_child(&path, &child);

    stop_recorded(&path).expect("stop_recorded");

    assert!(
        child.wait_for_exit(Duration::from_secs(2)),
        "the recorded child is stopped"
    );
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_recorded_leaves_a_child_with_a_changed_start_time_running() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_ready_sleep();
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
    let mut child = spawn_ready_sleep();
    let started = record_child(&path, &child);

    stop_process(
        &path,
        child.id(),
        started,
        Duration::from_secs(2),
        open_pidfd,
    )
    .expect("stop_process");

    assert!(
        child.wait_for_exit(Duration::from_secs(2)),
        "a plain child is stopped by TERM"
    );
    assert!(!path.exists(), "the record is removed");
}

#[test]
fn stop_process_keeps_the_record_when_the_child_ignores_term() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_term_ignorer();
    let started = record_child(&path, &child);

    let error = stop_process(
        &path,
        child.id(),
        started,
        Duration::from_millis(300),
        open_pidfd,
    )
    .expect_err("a child that ignores TERM must time out");

    assert!(
        matches!(
            error.downcast_ref::<IdentityError>(),
            Some(IdentityError::DidNotStop { pid, .. }) if *pid == child.id()
        ),
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
fn stop_process_removes_the_record_when_a_failed_open_meets_a_changed_identity() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut child = spawn_ready_sleep();
    let pid = child.id();
    let started = record_child(&path, &child);

    let result = stop_process(&path, pid, started, Duration::from_secs(1), |_| {
        child.reap();
        Err(std::io::Error::from(rustix::io::Errno::NOSYS))
    });

    assert!(result.is_ok(), "a changed identity is treated as stopped");
    assert!(!path.exists(), "the stale record is removed");
}

#[test]
fn stop_process_reports_a_failed_open_with_an_unchanged_identity() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let child = spawn_ready_sleep();
    let pid = child.id();
    let started = record_child(&path, &child);

    let error = stop_process(&path, pid, started, Duration::from_secs(1), |_| {
        Err(std::io::Error::from(rustix::io::Errno::NOSYS))
    })
    .expect_err("an open failure with a live process is an error");

    assert!(
        error.downcast_ref::<std::io::Error>().is_some(),
        "unexpected error: {error:#}"
    );
    assert!(path.exists(), "the record is kept when the open fails");
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
    let child = spawn_ready_sleep();

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
    let child = spawn_ready_sleep();

    let error = record_process(
        &path,
        child.id(),
        "not-the-name",
        Duration::from_millis(200),
    )
    .expect_err("a wrong name must fail");

    assert!(
        matches!(
            error.downcast_ref::<IdentityError>(),
            Some(IdentityError::UnexpectedProcess { pid, expected, actual })
                if *pid == child.id()
                    && expected == "not-the-name"
                    && actual.starts_with("sleep")
        ),
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
        matches!(
            error.downcast_ref::<IdentityError>(),
            Some(IdentityError::MissingProcess { pid, expected })
                if *pid == u32::MAX && expected == "sleep"
        ),
        "unexpected error: {error:#}"
    );
    assert!(!path.exists(), "no record is written");
}

#[test]
fn record_process_reports_an_empty_name_in_time() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let child = spawn_exiting();
    let pid = child.id();

    wait_for_zombie(pid, Duration::from_secs(3));

    let error = record_process(&path, pid, "sleep", Duration::from_millis(200))
        .expect_err("an unnamed process must time out");

    assert!(
        matches!(
            error.downcast_ref::<IdentityError>(),
            Some(IdentityError::DidNotNameItself { pid: recorded, expected })
                if *recorded == pid && expected == "sleep"
        ),
        "unexpected error: {error:#}"
    );
    assert!(!path.exists(), "no record is written");
}

#[test]
fn record_xwayland_records_a_matching_child() {
    let root = crate::test_support::temporary_sandbox_root("xwayland-match");
    let path = root.path().join("xwayland.pid");
    let (weston, child) = spawn_fake_weston("Xwayland :97");
    write_weston_record(root.path(), weston.id());

    record_xwayland(root.path(), ":97", Duration::from_secs(1)).expect("record_xwayland");

    let (pid, _) = read_record(&path).expect("the xwayland record");
    assert_eq!(pid, child);
}

#[test]
fn record_xwayland_ignores_a_different_display() {
    let root = crate::test_support::temporary_sandbox_root("xwayland-display");
    let path = root.path().join("xwayland.pid");
    let (weston, _child) = spawn_fake_weston("Xwayland :97");
    write_weston_record(root.path(), weston.id());

    record_xwayland(root.path(), ":98", Duration::from_millis(200)).expect("record_xwayland");

    assert!(!path.exists(), "a different display is not recorded");
}

#[test]
fn record_xwayland_ignores_a_child_with_another_name() {
    let root = crate::test_support::temporary_sandbox_root("xwayland-name");
    let path = root.path().join("xwayland.pid");
    let (weston, _child) = spawn_fake_weston("OtherProcess");
    write_weston_record(root.path(), weston.id());

    record_xwayland(root.path(), ":97", Duration::from_millis(200)).expect("record_xwayland");

    assert!(!path.exists(), "a child with another name is not recorded");
}

#[test]
fn record_process_waits_for_the_command_line_to_change() {
    let directory = crate::test_support::temporary_directory();
    let path = directory.path().join("record");
    let mut command = Command::new("bash");
    command.args(["-c", "sleep 0.3; exec -a \"$EXPECTED\" sleep 30"]);
    command.env("EXPECTED", "expected-name");
    let child = ChildGuard::spawn(&mut command);

    record_process(&path, child.id(), "expected-name", Duration::from_secs(2))
        .expect("record_process waits for the exec");

    let (pid, _) = read_record(&path).expect("the record exists");
    assert_eq!(pid, child.id());
}

#[test]
fn the_identity_errors_render_their_messages() {
    let cases = [
        (
            IdentityError::DidNotStop {
                pid: 7,
                path: PathBuf::from("/tmp/x"),
            },
            "The process 7 did not stop; keeping /tmp/x",
        ),
        (
            IdentityError::UnexpectedProcess {
                pid: 7,
                expected: "weston".to_string(),
                actual: "other".to_string(),
            },
            "The process 7 is not the expected weston. Actual: other",
        ),
        (
            IdentityError::MissingProcess {
                pid: 7,
                expected: "weston".to_string(),
            },
            "The weston process 7 is gone before it could be recorded.",
        ),
        (
            IdentityError::DidNotNameItself {
                pid: 7,
                expected: "weston".to_string(),
            },
            "The weston process 7 did not name itself in time.",
        ),
    ];

    for (error, expected) in cases {
        assert_eq!(error.to_string(), expected, "{error:?}");
    }
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
    let result = stop_process(&path, pid, started + 1, Duration::from_secs(1), open_pidfd);

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
