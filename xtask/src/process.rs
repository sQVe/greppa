use std::io::Read;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

use anyhow::Context as _;
use thiserror::Error;

pub(crate) const POLL: Duration = Duration::from_millis(100);
pub(crate) const TOOL_TIMEOUT: Duration = Duration::from_secs(20);

pub(crate) fn poll_until<T>(
    timeout: Duration,
    mut attempt: impl FnMut() -> anyhow::Result<Option<T>>,
) -> anyhow::Result<Option<T>> {
    let deadline = Instant::now() + timeout;

    loop {
        if let Some(value) = attempt()? {
            return Ok(Some(value));
        }

        if Instant::now() >= deadline {
            return Ok(None);
        }

        std::thread::sleep(POLL);
    }
}

#[derive(Debug, Error)]
pub(crate) enum ProcessError {
    #[error("{program} timed out after {} seconds.", duration.as_secs())]
    Timeout { program: String, duration: Duration },
}

pub(crate) fn run_with_timeout(mut command: Command, timeout: Duration) -> anyhow::Result<Output> {
    let program = command.get_program().to_string_lossy().into_owned();

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .with_context(|| format!("Could not start {program}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = std::thread::spawn(move || read_all(stdout));
    let stderr_reader = std::thread::spawn(move || read_all(stderr));
    let deadline = Instant::now() + timeout;

    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    crate::cleanup::stop_child(&mut child);
                    return Err(ProcessError::Timeout {
                        program,
                        duration: timeout,
                    }
                    .into());
                }

                std::thread::sleep(POLL);
            }
            Err(error) => {
                crate::cleanup::stop_child(&mut child);
                return Err(error).with_context(|| format!("Could not wait for {program}"));
            }
        }
    };

    let stdout = collect(stdout_reader, &program)?;
    let stderr = collect(stderr_reader, &program)?;

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn collect(
    reader: std::thread::JoinHandle<std::io::Result<Vec<u8>>>,
    program: &str,
) -> anyhow::Result<Vec<u8>> {
    let output = reader
        .join()
        .map_err(|_| anyhow::anyhow!("the output reader stopped"))
        .with_context(|| format!("Could not read the output of {program}"))?;

    output.with_context(|| format!("Could not read the output of {program}"))
}

fn read_all(reader: Option<impl Read>) -> std::io::Result<Vec<u8>> {
    let Some(mut reader) = reader else {
        return Ok(Vec::new());
    };
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)?;

    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_with_timeout_collects_output_larger_than_a_pipe() {
        let mut command = Command::new("sh");
        command.args(["-c", "seq 1 200000"]);

        let output = run_with_timeout(command, Duration::from_secs(10))
            .expect("large output must finish within the deadline");

        assert!(output.status.success());
        assert!(
            output.stdout.len() > 1_000_000,
            "stdout was {} bytes",
            output.stdout.len()
        );
    }

    #[test]
    fn run_with_timeout_kills_and_reaps_a_hung_child() {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 30"]);

        let error = run_with_timeout(command, Duration::from_millis(200)).expect_err("timeout");
        let timeout = error
            .downcast_ref::<ProcessError>()
            .expect("a process timeout");

        assert!(
            matches!(
                timeout,
                ProcessError::Timeout { program, duration }
                    if program == "sh" && *duration == Duration::from_millis(200)
            ),
            "unexpected error: {error:#}"
        );
    }

    #[test]
    fn a_timeout_names_the_program_and_seconds() {
        let timeout = ProcessError::Timeout {
            program: "weston".to_string(),
            duration: Duration::from_secs(30),
        };

        assert_eq!(timeout.to_string(), "weston timed out after 30 seconds.");
    }

    #[test]
    fn run_with_timeout_prints_a_start_failure_once() {
        let missing = "greppa-no-such-program";
        let os_error = Command::new(missing)
            .spawn()
            .expect_err("the program is missing")
            .to_string();

        let error = run_with_timeout(Command::new(missing), Duration::from_secs(1))
            .expect_err("the program is missing");
        let rendered = format!("{error:#}");

        assert_eq!(
            rendered.matches(&os_error).count(),
            1,
            "rendered: {rendered}"
        );
    }

    #[test]
    fn poll_until_returns_the_value_of_a_later_attempt() {
        let mut attempts = 0;
        let value = poll_until(Duration::from_secs(1), || {
            attempts += 1;

            Ok((attempts == 3).then_some(attempts))
        })
        .expect("the attempt cannot fail");

        assert_eq!(value, Some(3));
    }

    #[test]
    fn poll_until_passes_an_attempt_error_through_at_once() {
        let mut attempts = 0;
        let error = poll_until::<()>(Duration::from_secs(1), || {
            attempts += 1;

            Err(anyhow::anyhow!("attempt failed"))
        })
        .expect_err("the attempt error is returned");

        assert_eq!(error.to_string(), "attempt failed");
        assert_eq!(attempts, 1, "poll_until stops at the first error");
    }

    #[test]
    fn poll_until_returns_none_after_a_short_timeout() {
        let mut attempts = 0;
        let value = poll_until(Duration::from_millis(250), || {
            attempts += 1;

            Ok(None::<()>)
        })
        .expect("the attempt cannot fail");

        assert_eq!(value, None);
        assert!(attempts >= 2, "poll_until keeps trying until the deadline");
    }
}
