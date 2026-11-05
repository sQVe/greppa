use std::path::Path;
use std::process::ExitCode;

const USAGE: &str = "Usage:\n  cargo xtask mock capture <scene>";

#[expect(
    clippy::print_stderr,
    reason = "usage and failure messages are the command's output"
)]
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    match arguments {
        [command, scene] if command == "capture" => capture_command(root, scene),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(target_os = "linux")]
#[expect(
    clippy::print_stderr,
    reason = "failure messages are the command's output"
)]
fn capture_command(root: &Path, scene: &str) -> ExitCode {
    if let Err(error) = linux::capture(root, scene) {
        eprintln!("{error:#}");

        return ExitCode::FAILURE;
    }

    ExitCode::SUCCESS
}

#[cfg(not(target_os = "linux"))]
#[expect(
    clippy::print_stderr,
    reason = "the unsupported-platform message is the command's output"
)]
fn capture_command(_root: &Path, _scene: &str) -> ExitCode {
    eprintln!("Mock capture runs on Linux only.");
    ExitCode::FAILURE
}

#[cfg(target_os = "linux")]
mod linux {
    use std::fs;
    use std::io::{BufRead, BufReader};
    use std::path::Path;
    use std::process::{Child, Command, Stdio};
    use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
    use std::time::{Duration, Instant};

    use anyhow::Context as _;
    use serde_json::json;
    use thiserror::Error;

    use crate::display::{self, Running, RuntimeDir};
    use crate::environment::{self, ChildDirs};
    use crate::process;
    use crate::scene::{self, LogicalSize, Point, Ready};

    const READY_TIMEOUT: Duration = Duration::from_secs(60);
    const SCENE_SETTLE: Duration = Duration::from_millis(800);

    const OUTPUT_FILES: &[&str] = &["shot.png", "crop.png", "capture.json", "weston.log"];

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    struct PixelSize {
        width: u32,
        height: u32,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    struct Crop {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    }

    fn crop_box(origin: Point, size: LogicalSize, scale: f32) -> Crop {
        Crop {
            x: (origin.x * scale).round() as i32,
            y: (origin.y * scale).round() as i32,
            width: (size.width * scale).round() as u32,
            height: (size.height * scale).round() as u32,
        }
    }

    fn crop_fits(crop: Crop, shot: PixelSize) -> bool {
        let right = crop.x as i64 + crop.width as i64;
        let bottom = crop.y as i64 + crop.height as i64;

        crop.x >= 0 && crop.y >= 0 && right <= shot.width as i64 && bottom <= shot.height as i64
    }

    fn crop_geometry(crop: Crop) -> String {
        format!("{}x{}+{}+{}", crop.width, crop.height, crop.x, crop.y)
    }

    fn mock_environment(runtime: &Path, display: Option<&str>) -> Vec<(String, String)> {
        let mut dirs = ChildDirs::under(runtime);
        dirs.runtime = runtime.to_path_buf();
        let extras: &[(&str, &str)] = match display {
            Some(display) => &[("DISPLAY", display)],
            None => &[],
        };

        environment::child_environment(&std::env::vars().collect::<Vec<_>>(), &dirs, extras)
    }

    #[derive(Debug, Error)]
    pub(super) enum CaptureError {
        #[error("The scene did not print a ready line in time.")]
        Timeout,
        #[error("The scene exited before it printed a ready line.")]
        Closed,
    }

    struct Scene {
        child: Child,
        lines: Receiver<String>,
    }

    impl Scene {
        fn start(
            binary: &Path,
            scene: &str,
            display: &str,
            runtime: &Path,
        ) -> anyhow::Result<Self> {
            let environment = mock_environment(runtime, Some(display));
            let mut child = Command::new(binary)
                .arg(scene)
                .env_clear()
                .envs(environment)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .context("Could not start the scene")?;

            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| anyhow::anyhow!("The scene has no stdout to read."))?;
            let (sender, lines) = mpsc::channel();

            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);

                for line in reader.lines().map_while(Result::ok) {
                    if sender.send(line).is_err() {
                        break;
                    }
                }
            });

            Ok(Self { child, lines })
        }

        fn ready(&mut self, timeout: Duration) -> Result<Ready, CaptureError> {
            next_ready(&self.lines, timeout)
        }
    }

    fn next_ready(lines: &Receiver<String>, timeout: Duration) -> Result<Ready, CaptureError> {
        let deadline = Instant::now() + timeout;

        loop {
            let remaining = deadline
                .checked_duration_since(Instant::now())
                .ok_or(CaptureError::Timeout)?;

            match lines.recv_timeout(remaining) {
                Ok(line) => {
                    if let Ok(ready) = scene::parse_ready(&line) {
                        return Ok(ready);
                    }
                }
                Err(RecvTimeoutError::Timeout) => return Err(CaptureError::Timeout),
                Err(RecvTimeoutError::Disconnected) => return Err(CaptureError::Closed),
            }
        }
    }

    impl Drop for Scene {
        #[expect(
            clippy::print_stderr,
            reason = "a cleanup failure in Drop has no caller to report it"
        )]
        fn drop(&mut self) {
            if let Err(error) = self.child.kill()
                && error.kind() != std::io::ErrorKind::NotFound
            {
                eprintln!("Could not stop the scene: {error}");
            }

            if let Err(error) = self.child.wait()
                && error.kind() != std::io::ErrorKind::NotFound
            {
                eprintln!("Could not reap the scene: {error}");
            }
        }
    }

    pub(super) fn capture(root: &Path, scene: &str) -> anyhow::Result<()> {
        let binary = scene::build(root)?;
        let runtime = RuntimeDir::create("greppa-mock")?;
        let environment = mock_environment(runtime.path(), None);
        let names = scene::names(&binary, &environment)?;
        let scene = scene::validate_scene(scene, &names)?;
        let folder = root.join(".tau").join("judge").join(&scene);

        prepare_folder(&folder)?;

        let mut weston = start_weston(&runtime)?;
        let display =
            display::wait_for_display(&runtime.path().join("weston.log"), display::WESTON_TIMEOUT)?;
        weston.set_display(&display);
        let mut app = Scene::start(&binary, &scene, &display, runtime.path())?;
        let ready = app.ready(READY_TIMEOUT)?;

        std::thread::sleep(SCENE_SETTLE);

        let shot = folder.join("shot.png");
        display::import_window(&display, &ready.title, &shot, &environment)?;

        let shot_size = read_shot_size(&shot, &environment)?;
        let crop = crop_box(ready.origin, ready.size, ready.scale);

        if !crop_fits(crop, shot_size) {
            anyhow::bail!(crop_outside_message(crop, shot_size));
        }

        crop_image(&shot, &folder.join("crop.png"), crop, &environment)?;
        write_capture_json(&folder, &ready, shot_size, crop)
    }

    fn prepare_folder(folder: &Path) -> anyhow::Result<()> {
        fs::create_dir_all(folder)
            .with_context(|| format!("Could not create {}", folder.display()))?;

        for file in OUTPUT_FILES {
            let path = folder.join(file);

            if path.exists() {
                fs::remove_file(&path)
                    .with_context(|| format!("Could not remove {}", path.display()))?;
            }
        }

        Ok(())
    }

    fn crop_outside_message(crop: Crop, shot: PixelSize) -> String {
        format!(
            "The crop {} falls outside the {}x{} shot.",
            crop_geometry(crop),
            shot.width,
            shot.height
        )
    }

    fn start_weston(runtime: &RuntimeDir) -> anyhow::Result<Running> {
        let log = runtime.path().join("weston.log");
        let socket = format!("greppa-mock-{}", std::process::id());
        let command = display::weston_command(
            &socket,
            1400,
            900,
            &log,
            &mock_environment(runtime.path(), None),
        );

        Running::spawn(command, "weston")
    }

    fn read_shot_size(path: &Path, environment: &[(String, String)]) -> anyhow::Result<PixelSize> {
        let mut command = Command::new("identify");
        command
            .args(["-format", "%w %h"])
            .arg(path)
            .env_clear()
            .envs(environment.iter().cloned());
        let output = process::run_with_timeout(command, process::TOOL_TIMEOUT)?;

        if !output.status.success() {
            anyhow::bail!(
                "identify failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let mut parts = text.split_whitespace();
        let width = parts.next().and_then(|value| value.parse().ok());
        let height = parts.next().and_then(|value| value.parse().ok());

        match (width, height) {
            (Some(width), Some(height)) => Ok(PixelSize { width, height }),
            _ => anyhow::bail!("identify printed no width and height: {text}"),
        }
    }

    fn crop_image(
        shot: &Path,
        crop_path: &Path,
        crop: Crop,
        environment: &[(String, String)],
    ) -> anyhow::Result<()> {
        let geometry = crop_geometry(crop);
        let mut command = Command::new("magick");
        command
            .arg(shot)
            .args(["-crop", &geometry, "+repage"])
            .arg(crop_path)
            .env_clear()
            .envs(environment.iter().cloned());
        let output = process::run_with_timeout(command, process::TOOL_TIMEOUT)?;

        if !output.status.success() {
            anyhow::bail!(
                "magick failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }

        Ok(())
    }

    fn write_capture_json(
        folder: &Path,
        ready: &Ready,
        shot: PixelSize,
        crop: Crop,
    ) -> anyhow::Result<()> {
        let record = json!({
            "scene": ready.scene,
            "shot": { "width": shot.width, "height": shot.height },
            "crop": {
                "x": crop.x,
                "y": crop.y,
                "width": crop.width,
                "height": crop.height,
                "geometry": crop_geometry(crop),
            },
            "scale": ready.scale,
        });
        let path = folder.join("capture.json");

        fs::write(&path, format!("{record:#}\n"))
            .with_context(|| format!("Could not write {}", path.display()))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn crop_box_scales_the_origin_and_size() {
            let crop = crop_box(
                Point { x: 60.0, y: 40.0 },
                LogicalSize {
                    width: 420.0,
                    height: 300.0,
                },
                2.0,
            );

            assert_eq!(
                crop,
                Crop {
                    x: 120,
                    y: 80,
                    width: 840,
                    height: 600,
                }
            );
        }

        #[test]
        fn crop_geometry_uses_wxh_plus_xy() {
            let crop = Crop {
                x: 120,
                y: 80,
                width: 840,
                height: 600,
            };

            assert_eq!(crop_geometry(crop), "840x600+120+80");
        }

        #[test]
        fn crop_fits_checks_every_edge() {
            let shot = PixelSize {
                width: 1400,
                height: 900,
            };
            let inside = Crop {
                x: 60,
                y: 60,
                width: 420,
                height: 300,
            };

            assert!(crop_fits(inside, shot));
            assert!(!crop_fits(Crop { x: -1, ..inside }, shot));
            assert!(!crop_fits(Crop { y: -1, ..inside }, shot));
            assert!(!crop_fits(
                Crop {
                    width: 1400,
                    ..inside
                },
                shot
            ));
            assert!(!crop_fits(
                Crop {
                    height: 900,
                    ..inside
                },
                shot
            ));
        }

        #[test]
        fn next_ready_reports_a_missing_line() {
            let (_sender, receiver) = mpsc::channel();
            let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("timeout");

            assert!(matches!(error, CaptureError::Timeout));
            assert_eq!(
                error.to_string(),
                "The scene did not print a ready line in time."
            );
        }

        #[test]
        fn next_ready_reports_a_closed_stream() {
            let (sender, receiver) = mpsc::channel();
            drop(sender);

            let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("closed");

            assert!(matches!(error, CaptureError::Closed));
            assert_eq!(
                error.to_string(),
                "The scene exited before it printed a ready line."
            );
        }

        #[test]
        fn next_ready_skips_lines_until_it_parses_one() {
            let (sender, receiver) = mpsc::channel();
            let ready = "{\"scene\":\"demo\",\"origin\":{\"x\":60,\"y\":60},\"size\":{\"width\":420,\"height\":300},\"scale\":1,\"title\":\"greppa-scene-demo\"}";

            sender.send("build noise".to_string()).expect("send noise");
            sender.send(ready.to_string()).expect("send ready");
            drop(sender);

            assert!(next_ready(&receiver, Duration::from_millis(100)).is_ok());
        }

        #[test]
        fn crop_outside_message_names_the_box_and_shot() {
            let crop = Crop {
                x: 60,
                y: 60,
                width: 420,
                height: 300,
            };
            let shot = PixelSize {
                width: 100,
                height: 100,
            };

            assert_eq!(
                crop_outside_message(crop, shot),
                "The crop 420x300+60+60 falls outside the 100x100 shot."
            );
        }
    }
}
