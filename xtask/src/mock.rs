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
    if let Err(message) = linux::capture(root, scene) {
        eprintln!("{message}");

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
    use std::os::unix::fs::PermissionsExt;
    use std::path::{Path, PathBuf};
    use std::process::{Child, Command, Stdio};
    use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
    use std::time::{Duration, Instant};

    use serde_json::{Value, json};

    const READY_TIMEOUT: Duration = Duration::from_secs(60);
    const WESTON_TIMEOUT: Duration = Duration::from_secs(30);
    const SCENE_SETTLE: Duration = Duration::from_millis(800);
    const POLL: Duration = Duration::from_millis(100);

    const OUTPUT_FILES: &[&str] = &["shot.png", "crop.png", "capture.json", "weston.log"];

    #[derive(Clone, Copy, Debug, PartialEq)]
    struct Point {
        x: f32,
        y: f32,
    }

    #[derive(Clone, Copy, Debug, PartialEq)]
    struct LogicalSize {
        width: f32,
        height: f32,
    }

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

    #[derive(Debug, PartialEq)]
    struct Ready {
        scene: String,
        origin: Point,
        size: LogicalSize,
        scale: f32,
        title: String,
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

    fn parse_ready(line: &str) -> Result<Ready, String> {
        let value: Value =
            serde_json::from_str(line).map_err(|error| format!("Invalid ready line: {error}"))?;
        let missing = |field: &str| format!("The ready line has no {field}.");

        Ok(Ready {
            scene: value["scene"]
                .as_str()
                .ok_or_else(|| missing("scene"))?
                .to_string(),
            origin: Point {
                x: number(&value["origin"]["x"]).ok_or_else(|| missing("origin.x"))?,
                y: number(&value["origin"]["y"]).ok_or_else(|| missing("origin.y"))?,
            },
            size: LogicalSize {
                width: number(&value["size"]["width"]).ok_or_else(|| missing("size.width"))?,
                height: number(&value["size"]["height"]).ok_or_else(|| missing("size.height"))?,
            },
            scale: number(&value["scale"]).ok_or_else(|| missing("scale"))?,
            title: value["title"]
                .as_str()
                .ok_or_else(|| missing("title"))?
                .to_string(),
        })
    }

    fn number(value: &Value) -> Option<f32> {
        value.as_f64().map(|value| value as f32)
    }

    fn display_from_log(log: &str) -> Option<String> {
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

    fn unknown_scene_message(name: &str, names: &[String]) -> String {
        let known = names.join(", ");

        if name.trim().is_empty() {
            format!("Type a scene name. Known scenes: {known}.")
        } else {
            format!("No scene named \"{}\". Known scenes: {known}.", name.trim())
        }
    }

    fn validate_scene(name: &str, names: &[String]) -> Result<String, String> {
        let trimmed = name.trim();

        names
            .iter()
            .find(|scene| scene.as_str() == trimmed)
            .cloned()
            .ok_or_else(|| unknown_scene_message(name, names))
    }

    struct Running {
        child: Child,
    }

    impl Running {
        fn spawn(mut command: Command, name: &str) -> Result<Self, String> {
            let child = command
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|error| format!("Could not start {name}: {error}"))?;

            Ok(Self { child })
        }
    }

    impl Drop for Running {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
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
        ) -> Result<Self, String> {
            let mut child = Command::new(binary)
                .arg(scene)
                .env("DISPLAY", display)
                .env_remove("WAYLAND_DISPLAY")
                .env("XDG_RUNTIME_DIR", runtime)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .map_err(|error| format!("Could not start the scene: {error}"))?;

            let stdout = child
                .stdout
                .take()
                .ok_or("The scene has no stdout to read.")?;
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

        fn ready(&mut self, timeout: Duration) -> Result<Ready, String> {
            next_ready(&self.lines, timeout)
        }
    }

    fn next_ready(lines: &Receiver<String>, timeout: Duration) -> Result<Ready, String> {
        let deadline = Instant::now() + timeout;

        loop {
            let remaining = deadline
                .checked_duration_since(Instant::now())
                .ok_or("The scene did not print a ready line in time.")?;

            match lines.recv_timeout(remaining) {
                Ok(line) => {
                    if let Ok(ready) = parse_ready(&line) {
                        return Ok(ready);
                    }
                }
                Err(RecvTimeoutError::Timeout) => {
                    return Err("The scene did not print a ready line in time.".to_string());
                }
                Err(RecvTimeoutError::Disconnected) => {
                    return Err("The scene exited before it printed a ready line.".to_string());
                }
            }
        }
    }

    impl Drop for Scene {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    struct RuntimeDir {
        path: PathBuf,
    }

    impl RuntimeDir {
        fn create() -> Result<Self, String> {
            let path = std::env::temp_dir().join(format!("greppa-mock-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);

            fs::create_dir_all(&path)
                .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("Could not secure {}: {error}", path.display()))?;

            Ok(Self { path })
        }
    }

    impl Drop for RuntimeDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    pub(super) fn capture(root: &Path, scene: &str) -> Result<(), String> {
        let binary = build_scene(root)?;
        let names = scene_names(&binary)?;
        let scene = validate_scene(scene, &names)?;
        let folder = root.join(".tau").join("judge").join(&scene);

        prepare_folder(&folder)?;

        let runtime = RuntimeDir::create()?;
        let _weston = start_weston(&runtime)?;
        let display = wait_for_display(&runtime.path.join("weston.log"), WESTON_TIMEOUT)?;
        let mut app = Scene::start(&binary, &scene, &display, &runtime.path)?;
        let ready = app.ready(READY_TIMEOUT)?;

        std::thread::sleep(SCENE_SETTLE);

        let shot = folder.join("shot.png");
        import_window(&display, &ready.title, &shot)?;

        let shot_size = read_shot_size(&shot)?;
        let crop = crop_box(ready.origin, ready.size, ready.scale);

        if !crop_fits(crop, shot_size) {
            return Err(crop_outside_message(crop, shot_size));
        }

        crop_image(&shot, &folder.join("crop.png"), crop)?;
        write_capture_json(&folder, &ready, shot_size, crop)
    }

    fn prepare_folder(folder: &Path) -> Result<(), String> {
        fs::create_dir_all(folder)
            .map_err(|error| format!("Could not create {}: {error}", folder.display()))?;

        for file in OUTPUT_FILES {
            let path = folder.join(file);

            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|error| format!("Could not remove {}: {error}", path.display()))?;
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

    fn build_scene(root: &Path) -> Result<PathBuf, String> {
        let output = Command::new("cargo")
            .args([
                "build",
                "--locked",
                "--package",
                "greppa-ui",
                "--bin",
                "greppa-scene",
                "--message-format=json-render-diagnostics",
            ])
            .current_dir(root)
            .stderr(Stdio::inherit())
            .output()
            .map_err(|error| format!("Could not start cargo build: {error}"))?;

        if !output.status.success() {
            return Err("The scene binary did not build.".to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        executable_from_messages(&stdout)
    }

    fn executable_from_messages(output: &str) -> Result<PathBuf, String> {
        for line in output.lines() {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                continue;
            };

            if value["reason"] != "compiler-artifact" || value["target"]["name"] != "greppa-scene" {
                continue;
            }

            if let Some(executable) = value["executable"].as_str() {
                return Ok(PathBuf::from(executable));
            }
        }

        Err("Cargo did not report a greppa-scene executable.".to_string())
    }

    fn scene_names(binary: &Path) -> Result<Vec<String>, String> {
        let output = Command::new(binary)
            .arg("--list")
            .output()
            .map_err(|error| format!("Could not list the scenes: {error}"))?;

        if !output.status.success() {
            return Err("The scene binary did not list its scenes.".to_string());
        }

        let names: Vec<String> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect();

        if names.is_empty() {
            return Err("The scene binary listed no scenes.".to_string());
        }

        Ok(names)
    }

    fn start_weston(runtime: &RuntimeDir) -> Result<Running, String> {
        let log = runtime.path.join("weston.log");
        let mut command = Command::new("weston");

        command
            .arg("--backend=headless")
            .arg("--xwayland")
            .arg(format!("--socket=greppa-mock-{}", std::process::id()))
            .arg("--width=1400")
            .arg("--height=900")
            .arg(format!("--log={}", log.display()))
            .env_remove("DISPLAY")
            .env_remove("WAYLAND_DISPLAY")
            .env("XDG_RUNTIME_DIR", &runtime.path);

        Running::spawn(command, "weston")
    }

    fn wait_for_display(log_path: &Path, timeout: Duration) -> Result<String, String> {
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

    fn import_window(display: &str, title: &str, path: &Path) -> Result<(), String> {
        let output = Command::new("import")
            .args(["-display", display, "-window", title])
            .arg(path)
            .output()
            .map_err(|error| format!("Could not start import: {error}"))?;

        if !output.status.success() {
            return Err(format!(
                "import failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }

        Ok(())
    }

    fn read_shot_size(path: &Path) -> Result<PixelSize, String> {
        let output = Command::new("identify")
            .args(["-format", "%w %h"])
            .arg(path)
            .output()
            .map_err(|error| format!("Could not start identify: {error}"))?;

        if !output.status.success() {
            return Err(format!(
                "identify failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let mut parts = text.split_whitespace();
        let width = parts.next().and_then(|value| value.parse().ok());
        let height = parts.next().and_then(|value| value.parse().ok());

        match (width, height) {
            (Some(width), Some(height)) => Ok(PixelSize { width, height }),
            _ => Err(format!("identify printed no width and height: {text}")),
        }
    }

    fn crop_image(shot: &Path, crop_path: &Path, crop: Crop) -> Result<(), String> {
        let geometry = crop_geometry(crop);
        let output = Command::new("magick")
            .arg(shot)
            .args(["-crop", &geometry, "+repage"])
            .arg(crop_path)
            .output()
            .map_err(|error| format!("Could not start magick: {error}"))?;

        if !output.status.success() {
            return Err(format!(
                "magick failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }

        Ok(())
    }

    fn write_capture_json(
        folder: &Path,
        ready: &Ready,
        shot: PixelSize,
        crop: Crop,
    ) -> Result<(), String> {
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
            .map_err(|error| format!("Could not write {}: {error}", path.display()))
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
        fn parse_ready_reads_every_field() {
            let line = "{\"scene\":\"demo\",\"origin\":{\"x\":60,\"y\":60},\"size\":{\"width\":420,\"height\":300},\"scale\":1,\"title\":\"greppa-scene-demo\"}";

            assert_eq!(
                parse_ready(line),
                Ok(Ready {
                    scene: "demo".to_string(),
                    origin: Point { x: 60.0, y: 60.0 },
                    size: LogicalSize {
                        width: 420.0,
                        height: 300.0,
                    },
                    scale: 1.0,
                    title: "greppa-scene-demo".to_string(),
                })
            );
        }

        #[test]
        fn parse_ready_rejects_other_output() {
            assert!(parse_ready("not json").is_err());
            assert!(parse_ready("{\"scene\":\"demo\"}").is_err());
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

        fn known_names() -> Vec<String> {
            ["alpha", "beta"]
                .iter()
                .map(|name| name.to_string())
                .collect()
        }

        #[test]
        fn validate_scene_names_the_known_scenes() {
            let names = known_names();

            assert_eq!(validate_scene(" alpha ", &names), Ok("alpha".to_string()));
            assert_eq!(
                validate_scene("missing", &names),
                Err("No scene named \"missing\". Known scenes: alpha, beta.".to_string())
            );
            assert_eq!(
                validate_scene("", &names),
                Err("Type a scene name. Known scenes: alpha, beta.".to_string())
            );
        }

        #[test]
        fn executable_from_messages_reads_the_artifact_path() {
            let output = "\
{\"reason\":\"compiler-artifact\",\"target\":{\"name\":\"greppa-scene\"},\"executable\":\"/custom/target/debug/greppa-scene\"}\n\
{\"reason\":\"build-finished\",\"success\":true}\n";

            assert_eq!(
                executable_from_messages(output),
                Ok(PathBuf::from("/custom/target/debug/greppa-scene"))
            );
            assert!(executable_from_messages("not json").is_err());
            assert!(
                executable_from_messages(
                    "{\"reason\":\"compiler-artifact\",\"target\":{\"name\":\"other\"},\"executable\":\"/x\"}"
                )
                .is_err()
            );
        }

        #[test]
        fn next_ready_reports_a_missing_line() {
            let (_sender, receiver) = mpsc::channel();
            let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("timeout");

            assert_eq!(error, "The scene did not print a ready line in time.");
        }

        #[test]
        fn next_ready_reports_a_closed_stream() {
            let (sender, receiver) = mpsc::channel();
            drop(sender);

            let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("closed");

            assert_eq!(error, "The scene exited before it printed a ready line.");
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

        #[test]
        fn parse_ready_reports_a_missing_field() {
            assert!(
                parse_ready(
                    "{\"scene\":\"demo\",\"origin\":{\"x\":1,\"y\":2},\"size\":{\"width\":3,\"height\":4},\"scale\":1}"
                )
                .is_err()
            );
        }
    }
}
