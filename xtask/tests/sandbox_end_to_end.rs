#![cfg(target_os = "linux")]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

#[path = "../src/test_support.rs"]
mod test_support;

#[test]
fn sandbox_passes_arguments_stdio_working_directory_and_status_to_ruta() {
    use std::os::unix::fs::PermissionsExt as _;

    let folder = test_support::temporary_directory();
    let ruta = folder.path().join("ruta");
    fs::write(
        &ruta,
        "#!/bin/sh\nprintf '%s\\n' \"$PWD\" \"$@\"\nprintf 'ruta stderr\\n' >&2\nexit 23\n",
    )
    .expect("write a fake ruta");
    fs::set_permissions(&ruta, fs::Permissions::from_mode(0o700)).expect("make ruta executable");

    let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
        .args([
            "sandbox",
            "future-command",
            "--unknown",
            "two words",
            "--",
            "up",
        ])
        .env("PATH", folder.path())
        .current_dir(folder.path())
        .output()
        .expect("run the wrapper");
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace parent");

    assert_eq!(output.status.code(), Some(23));
    assert_eq!(
        String::from_utf8_lossy(&output.stdout),
        format!(
            "{}\nfuture-command\n--unknown\ntwo words\n--\nup\n",
            workspace.display()
        )
    );
    assert_eq!(String::from_utf8_lossy(&output.stderr), "ruta stderr\n");
}

#[test]
fn missing_ruta_names_the_pinned_install_command() {
    let folder = test_support::temporary_directory();
    let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
        .args(["sandbox", "down"])
        .env("PATH", folder.path())
        .output()
        .expect("run the wrapper");

    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert_eq!(
        String::from_utf8_lossy(&output.stderr),
        "ruta is not installed. Run: cargo install --git https://github.com/sQVe/ruta --tag v0.1.0 --locked ruta\n"
    );
    assert_eq!(
        fs::read_dir(folder.path())
            .expect("list the folder")
            .count(),
        0
    );
}

#[test]
fn build_commands_refuse_an_executable_outside_the_configured_target() {
    use std::os::unix::fs::PermissionsExt as _;

    let folder = test_support::temporary_directory();
    let cargo = folder.path().join("cargo");
    fs::write(&cargo, "#!/bin/sh\nprintf '%s\\n' '{\"reason\":\"compiler-artifact\",\"target\":{\"name\":\"greppa-scene\"},\"executable\":\"/custom/debug/greppa-scene\"}'\n")
        .expect("write a fake cargo");
    fs::set_permissions(&cargo, fs::Permissions::from_mode(0o700)).expect("make cargo executable");
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace parent");
    let expected = format!(
        "ruta.toml requires {}/target/debug/greppa-scene, but Cargo reported /custom/debug/greppa-scene. Remove CARGO_TARGET_DIR or other target directory overrides.\n",
        workspace.display()
    );

    for arguments in [
        vec!["sandbox", "up", "smoke-2"],
        vec!["sandbox", "restart"],
        vec!["mock", "capture", "smoke-2"],
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
            .args(&arguments)
            .env("PATH", folder.path())
            .output()
            .expect("run the wrapper");

        assert_eq!(output.status.code(), Some(1), "{arguments:?}");
        assert!(output.stdout.is_empty(), "{arguments:?}");
        assert_eq!(
            String::from_utf8_lossy(&output.stderr),
            expected,
            "{arguments:?}"
        );
    }

    let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
        .args(["mock", "unknown", "smoke-2"])
        .env("PATH", folder.path())
        .output()
        .expect("run an unknown mock command");

    assert_eq!(output.status.code(), Some(1));
    assert_eq!(
        String::from_utf8_lossy(&output.stderr),
        "Usage:\n  cargo xtask mock capture <scene>\n"
    );
}

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
        PathBuf::from(format!("/var/tmp/ruta-{}", self.name))
    }

    fn run(&self, arguments: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_xtask"))
            .arg("sandbox")
            .args(arguments)
            .env("RUTA_NAME", &self.name)
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

    if let Some(folder) = std::env::var_os("GREPPA_E2E_ARTIFACTS") {
        sandbox
            .keep_diagnostics(Path::new(&folder))
            .expect("save sandbox diagnostics");
    }

    sandbox.succeed(&["down"]);

    assert!(!sandbox.root().exists(), "down removes the sandbox root");
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
        .env("RUTA_NAME", format!("e2e-capture-{}", std::process::id()))
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
