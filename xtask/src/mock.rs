use std::path::Path;
use std::process::ExitCode;

const USAGE: &str = "Usage:\n  cargo xtask mock capture <scene>";

#[expect(
    clippy::print_stderr,
    reason = "usage and failure messages are the command's output"
)]
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    match arguments {
        [command, scene] if command == "capture" => match capture(root, scene) {
            Ok(status) => status,
            Err(error) => {
                eprintln!("{error:#}");
                ExitCode::FAILURE
            }
        },
        _ => {
            eprintln!("{USAGE}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(target_os = "linux")]
fn capture(root: &Path, scene: &str) -> anyhow::Result<ExitCode> {
    let binary = crate::scene::build(root)?;
    let environment = crate::scene::build_environment(&std::env::vars().collect::<Vec<_>>());
    let names = crate::scene::names(&binary, &environment)?;
    let scene = crate::scene::validate_scene(scene, &names)?;
    let folder = root.join(".tau").join("judge").join(&scene);

    prepare_folder(&folder)?;
    crate::ruta::capture(root, &scene)
}

#[cfg(not(target_os = "linux"))]
fn capture(_root: &Path, _scene: &str) -> anyhow::Result<ExitCode> {
    anyhow::bail!("Mock capture runs on Linux only.")
}

#[cfg(target_os = "linux")]
fn prepare_folder(folder: &Path) -> anyhow::Result<()> {
    use anyhow::Context as _;
    use std::fs;

    fs::create_dir_all(folder).with_context(|| format!("Could not create {}", folder.display()))?;

    for file in ["shot.png", "crop.png", "capture.json"] {
        let path = folder.join(file);

        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(error).with_context(|| format!("Could not remove {}", path.display()));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_refuses_arguments_without_a_command() {
        let folder = crate::test_support::temporary_directory();

        assert_eq!(run(folder.path(), &[]), ExitCode::FAILURE);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn prepare_folder_removes_only_capture_outputs() {
        let folder = crate::test_support::temporary_directory();
        for file in [
            "shot.png",
            "crop.png",
            "capture.json",
            "check.txt",
            "weston.log",
        ] {
            std::fs::write(folder.path().join(file), "old").expect("write an old file");
        }

        prepare_folder(folder.path()).expect("prepare capture output");

        for file in ["shot.png", "crop.png", "capture.json"] {
            assert!(!folder.path().join(file).exists(), "removed {file}");
        }
        for file in ["check.txt", "weston.log"] {
            assert_eq!(
                std::fs::read_to_string(folder.path().join(file)).expect("read preserved file"),
                "old"
            );
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn prepare_folder_reports_a_removal_error() {
        let folder = crate::test_support::temporary_directory();
        let shot = folder.path().join("shot.png");
        std::fs::create_dir(&shot).expect("create an invalid output");
        std::fs::write(folder.path().join("crop.png"), "old crop").expect("write the crop");

        let error =
            prepare_folder(folder.path()).expect_err("a directory cannot be removed as a file");

        assert_eq!(
            error.to_string(),
            format!("Could not remove {}", shot.display())
        );
        assert_eq!(
            error
                .downcast_ref::<std::io::Error>()
                .expect("IO error")
                .kind(),
            std::io::ErrorKind::IsADirectory
        );
        assert!(shot.is_dir());
        assert_eq!(
            std::fs::read_to_string(folder.path().join("crop.png")).expect("read unchanged crop"),
            "old crop"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn prepare_folder_creates_a_missing_folder() {
        let folder = crate::test_support::temporary_directory();
        let output = folder.path().join("new");

        prepare_folder(&output).expect("create the output folder");

        assert!(output.is_dir());
    }
}
