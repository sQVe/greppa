#![cfg(target_os = "linux")]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";
const SCENE_WINDOW_SIZE: (u32, u32) = (640, 480);

struct Sandbox {
    name: String,
}

impl Sandbox {
    fn new(label: &str) -> Self {
        Self {
            name: format!("e2e-{label}-{}", std::process::id()),
        }
    }

    fn root(&self) -> PathBuf {
        PathBuf::from(format!("/var/tmp/greppa-sandbox-{}", self.name))
    }

    fn marker(&self) -> String {
        format!("GREPPA_SANDBOX_ROOT={}", self.root().display())
    }

    fn run(&self, arguments: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_xtask"))
            .arg("sandbox")
            .args(arguments)
            .env("GREPPA_SANDBOX", &self.name)
            .output()
            .expect("run the xtask binary")
    }

    fn succeed(&self, arguments: &[&str]) {
        let output = self.run(arguments);

        assert!(
            output.status.success(),
            "sandbox {arguments:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

impl Sandbox {
    // `down` deletes the root, so its logs and shots are copied out first for CI to upload.
    fn keep_diagnostics(&self, folder: &Path) -> std::io::Result<()> {
        let target = folder.join(&self.name);

        fs::create_dir_all(&target)?;

        for entry in fs::read_dir(self.root())? {
            let path = entry?.path();
            let is_diagnostic = path
                .extension()
                .is_some_and(|extension| extension == "log" || extension == "png");

            if is_diagnostic && let Some(file) = path.file_name() {
                fs::copy(&path, target.join(file))?;
            }
        }

        Ok(())
    }
}

impl Drop for Sandbox {
    #[expect(
        clippy::print_stderr,
        reason = "no caller can take a cleanup error in drop"
    )]
    fn drop(&mut self) {
        if let Some(folder) = std::env::var_os("GREPPA_E2E_ARTIFACTS")
            && self.root().is_dir()
            && let Err(error) = self.keep_diagnostics(Path::new(&folder))
        {
            eprintln!("could not keep the diagnostics of {}: {error}", self.name);
        }

        let output = self.run(&["down"]);

        if !output.status.success() {
            eprintln!(
                "sandbox {} did not go down: {}",
                self.name,
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }
}

fn png_size(path: &Path) -> (u32, u32) {
    let bytes = fs::read(path).expect("read the shot");

    assert!(bytes.len() >= 24, "the shot is too short for a PNG header");
    assert_eq!(&bytes[..8], PNG_SIGNATURE, "the shot is a PNG");
    assert_eq!(&bytes[12..16], b"IHDR", "the PNG starts with IHDR");

    let width = u32::from_be_bytes(bytes[16..20].try_into().expect("four width bytes"));
    let height = u32::from_be_bytes(bytes[20..24].try_into().expect("four height bytes"));

    (width, height)
}

fn processes_with_marker(marker: &str) -> Vec<PathBuf> {
    let processes = fs::read_dir("/proc").expect("list /proc");

    processes
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("environ"))
        .filter(|environ| {
            fs::read(environ).is_ok_and(|bytes| {
                bytes
                    .split(|byte| *byte == 0)
                    .any(|variable| variable == marker.as_bytes())
            })
        })
        .collect()
}

#[test]
#[ignore = "needs Weston, Xwayland, xdotool, and ImageMagick"]
fn sandbox_drives_a_scene_and_goes_down() {
    let sandbox = Sandbox::new("up");
    let shot = sandbox.root().join("shot.png");
    let shot_argument = shot.to_str().expect("the shot path is UTF-8");

    sandbox.succeed(&["up", "smoke-2"]);
    sandbox.succeed(&["shot", shot_argument]);
    assert_eq!(
        png_size(&shot),
        SCENE_WINDOW_SIZE,
        "the shot has the scene window size"
    );
    sandbox.succeed(&["click", "200", "200"]);
    sandbox.succeed(&["type", "hello"]);
    sandbox.succeed(&["key", "Escape"]);
    sandbox.succeed(&["opened"]);
    sandbox.succeed(&["down"]);

    assert!(!sandbox.root().exists(), "down removes the sandbox root");
}

#[test]
#[ignore = "needs Weston, Xwayland, xdotool, and ImageMagick"]
fn failed_up_leaves_no_root_and_no_process() {
    let sandbox = Sandbox::new("bad");

    let output = sandbox.run(&["up", "no-such-scene"]);

    assert!(!output.status.success(), "up with an unknown scene fails");
    assert!(!sandbox.root().exists(), "a failed up removes its root");
    assert_eq!(
        processes_with_marker(&sandbox.marker()),
        Vec::<PathBuf>::new(),
        "a failed up stops every process it started"
    );
}

#[test]
#[ignore = "needs Weston, Xwayland, xdotool, and ImageMagick"]
fn mock_capture_writes_its_files() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("xtask lives one level below the workspace root");
    let folder = workspace.join(".tau").join("judge").join("smoke-2");

    let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
        .args(["mock", "capture", "smoke-2"])
        .output()
        .expect("run the xtask binary");

    assert!(
        output.status.success(),
        "mock capture failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    for file in ["shot.png", "crop.png", "capture.json"] {
        assert!(folder.join(file).is_file(), "mock capture writes {file}");
    }
}
