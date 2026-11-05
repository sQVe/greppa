use std::io::Read;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

pub(crate) const POLL: Duration = Duration::from_millis(100);
pub(crate) const TOOL_TIMEOUT: Duration = Duration::from_secs(20);

pub(crate) fn run_with_timeout(mut command: Command, timeout: Duration) -> Result<Output, String> {
    let program = command.get_program().to_string_lossy().into_owned();

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start {program}: {error}"))?;
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
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "{program} timed out after {} seconds.",
                        timeout.as_secs()
                    ));
                }

                std::thread::sleep(POLL);
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Could not wait for {program}: {error}"));
            }
        }
    };

    let stdout = stdout_reader.join().unwrap_or_default();
    let stderr = stderr_reader.join().unwrap_or_default();

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn read_all(reader: Option<impl Read>) -> Vec<u8> {
    let Some(mut reader) = reader else {
        return Vec::new();
    };
    let mut buffer = Vec::new();
    let _ = reader.read_to_end(&mut buffer);

    buffer
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

        assert!(error.contains("timed out"), "unexpected error: {error}");
    }
}
