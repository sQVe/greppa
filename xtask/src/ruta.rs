use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use std::time::SystemTime;

use anyhow::Context as _;

use crate::scene;

const SCENE_SOURCES: &[&str] = &[
    "crates/greppa-ui",
    "vendor/gpui-component",
    "Cargo.toml",
    "Cargo.lock",
    "rust-toolchain.toml",
];

pub(crate) fn sandbox(root: &Path, arguments: &[String]) -> anyhow::Result<ExitCode> {
    let run = std::env::var("TAU_VERIFICATION_RUN").ok();
    let arguments = with_scene_from_file(root, run.as_deref(), arguments)?;

    if needs_build(&arguments) {
        scene::build(root)?;
    }

    if arguments.first().map(String::as_str) == Some("doctor") {
        return doctor(root, run.as_deref());
    }

    run_ruta(root, run.as_deref(), &arguments)
}

pub(crate) fn capture(root: &Path, scene: &str) -> anyhow::Result<ExitCode> {
    run_ruta(root, None, &capture_arguments(scene))
}

fn sandbox_name(run: Option<&str>) -> Option<String> {
    run.map(|run| format!("greppa-{}", run.to_lowercase()))
}

fn scene_from_file(root: &Path) -> anyhow::Result<String> {
    let path = root.join(".tau/scene");
    let contents = std::fs::read_to_string(&path)
        .with_context(|| format!("Could not read the scene from {}", path.display()))?;
    let scene = contents.trim();

    if scene.is_empty() {
        anyhow::bail!("The scene file {} is empty.", path.display());
    }

    Ok(scene.to_string())
}

fn with_scene_from_file(
    root: &Path,
    run: Option<&str>,
    arguments: &[String],
) -> anyhow::Result<Vec<String>> {
    let launches_scene = run.is_some()
        && arguments.first().map(String::as_str) == Some("up")
        && arguments.len() == 1;

    if !launches_scene {
        return Ok(arguments.to_vec());
    }

    let mut with_scene = arguments.to_vec();
    with_scene.push(scene_from_file(root)?);

    Ok(with_scene)
}

fn needs_build(arguments: &[String]) -> bool {
    matches!(
        arguments.first().map(String::as_str),
        Some("up" | "restart")
    )
}

fn capture_arguments(scene: &str) -> Vec<String> {
    vec![
        "capture".to_string(),
        "--out".to_string(),
        format!(".tau/judge/{scene}"),
        "--".to_string(),
        scene.to_string(),
    ]
}

fn run_ruta(root: &Path, run: Option<&str>, arguments: &[String]) -> anyhow::Result<ExitCode> {
    let mut command = Command::new("ruta");
    command.args(arguments).current_dir(root);

    if let Some(name) = sandbox_name(run) {
        command.env("RUTA_NAME", name);
    }

    let status = command.status().map_err(start_error)?;

    Ok(ExitCode::from(status.code().unwrap_or(1) as u8))
}

fn doctor(root: &Path, run: Option<&str>) -> anyhow::Result<ExitCode> {
    let Some(name) = sandbox_name(run) else {
        anyhow::bail!("TAU_VERIFICATION_RUN is not set, so the sandbox name is unknown.");
    };
    let sandbox_directory = PathBuf::from(format!("/var/tmp/ruta-{name}"));

    let output = Command::new("ruta")
        .arg("status")
        .env("RUTA_NAME", &name)
        .current_dir(root)
        .output()
        .map_err(start_error)?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let expected_status = format!("ruta {name} is up and serves {}", root.display());

    if !output.status.success() || !stdout.contains(&expected_status) {
        anyhow::bail!(
            "The sandbox {name} is not up and serving {}. ruta status printed:\n{stdout}",
            root.display()
        );
    }

    let pid = read_pid(&sandbox_directory.join("pid"))?;
    let executable_link = PathBuf::from(format!("/proc/{pid}/exe"));
    let executable = std::fs::read_link(&executable_link)
        .with_context(|| format!("Could not read {}", executable_link.display()))?;
    let expected_executable = root.join("target/debug/greppa-scene");

    if executable != expected_executable {
        anyhow::bail!(
            "The sandbox runs {}, not {}.",
            executable.display(),
            expected_executable.display()
        );
    }

    let newer = newer_files(root, &expected_executable)?;

    if !newer.is_empty() {
        anyhow::bail!(
            "These files are newer than the running binary: {}.",
            display_paths(&newer)
        );
    }

    if is_newer(&root.join("ruta.toml"), &sandbox_directory.join("pid"))? {
        anyhow::bail!("ruta.toml is newer than the sandbox. Restart the sandbox.");
    }

    Ok(ExitCode::SUCCESS)
}

fn newer_files(root: &Path, binary: &Path) -> anyhow::Result<Vec<PathBuf>> {
    let modified = std::fs::metadata(binary)
        .with_context(|| format!("Could not read {}", binary.display()))?
        .modified()
        .with_context(|| {
            format!(
                "Could not read the modification time of {}",
                binary.display()
            )
        })?;
    let mut newer = Vec::new();

    for source in SCENE_SOURCES {
        let path = root.join(source);

        if !path.exists() {
            anyhow::bail!("{} is missing.", path.display());
        }

        collect_newer(&path, modified, &mut newer)?;
    }

    Ok(newer)
}

fn collect_newer(
    path: &Path,
    binary_time: SystemTime,
    newer: &mut Vec<PathBuf>,
) -> anyhow::Result<()> {
    let metadata =
        std::fs::metadata(path).with_context(|| format!("Could not read {}", path.display()))?;

    if metadata.is_dir() {
        let entries = std::fs::read_dir(path)
            .with_context(|| format!("Could not list {}", path.display()))?;

        for entry in entries {
            let entry = entry.with_context(|| format!("Could not list {}", path.display()))?;
            collect_newer(&entry.path(), binary_time, newer)?;
        }

        return Ok(());
    }

    let modified = metadata
        .modified()
        .with_context(|| format!("Could not read the modification time of {}", path.display()))?;

    if modified > binary_time {
        newer.push(path.to_path_buf());
    }

    Ok(())
}

fn read_pid(path: &Path) -> anyhow::Result<u32> {
    let contents = std::fs::read_to_string(path)
        .with_context(|| format!("Could not read {}", path.display()))?;
    let field = contents
        .split_whitespace()
        .next()
        .with_context(|| format!("{} is empty.", path.display()))?;

    field
        .parse()
        .with_context(|| format!("{} does not start with a process id.", path.display()))
}

fn is_newer(path: &Path, than: &Path) -> anyhow::Result<bool> {
    let modified = std::fs::metadata(path)
        .with_context(|| format!("Could not read {}", path.display()))?
        .modified()
        .with_context(|| format!("Could not read the modification time of {}", path.display()))?;
    let than_modified = std::fs::metadata(than)
        .with_context(|| format!("Could not read {}", than.display()))?
        .modified()
        .with_context(|| format!("Could not read the modification time of {}", than.display()))?;

    Ok(modified > than_modified)
}

fn display_paths(paths: &[PathBuf]) -> String {
    let shown: Vec<String> = paths
        .iter()
        .map(|path| path.display().to_string())
        .collect();

    shown.join(", ")
}

fn start_error(error: std::io::Error) -> anyhow::Error {
    if error.kind() == std::io::ErrorKind::NotFound {
        return anyhow::anyhow!(
            "ruta is not installed. Run: cargo install --git https://github.com/sQVe/ruta --tag v0.2.1 --locked ruta"
        );
    }

    anyhow::Error::new(error).context("Could not start ruta")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_up_and_restart_build_the_scene() {
        for (command, expected) in [
            ("up", true),
            ("restart", true),
            ("shot", false),
            ("down", false),
            ("unknown", false),
        ] {
            assert_eq!(
                needs_build(&[command.to_string(), "--anything".to_string()]),
                expected,
                "{command}"
            );
        }
        assert!(!needs_build(&[]));
    }

    #[test]
    fn capture_passes_the_output_folder_and_scene_to_ruta() {
        assert_eq!(
            capture_arguments("smoke-2"),
            ["capture", "--out", ".tau/judge/smoke-2", "--", "smoke-2"]
        );
    }

    #[test]
    fn sandbox_name_adds_the_greppa_prefix_in_lowercase() {
        assert_eq!(
            sandbox_name(Some("sandbox-abc123")),
            Some("greppa-sandbox-abc123".to_string())
        );
        assert_eq!(
            sandbox_name(Some("sandbox-VemoyV")),
            Some("greppa-sandbox-vemoyv".to_string())
        );
        assert_eq!(sandbox_name(None), None);
    }

    #[test]
    fn a_launch_without_a_scene_reads_the_scene_file() {
        let root = crate::test_support::temporary_directory();
        std::fs::create_dir_all(root.path().join(".tau")).expect("create .tau");
        std::fs::write(root.path().join(".tau/scene"), " smoke-2 \n").expect("write the scene");
        let up = vec!["up".to_string()];

        assert_eq!(
            with_scene_from_file(root.path(), Some("sandbox-abc123"), &up)
                .expect("append the scene"),
            ["up", "smoke-2"]
        );
        assert_eq!(
            with_scene_from_file(
                root.path(),
                Some("sandbox-abc123"),
                &["up".to_string(), "smoke-2".to_string()]
            )
            .expect("keep the given scene"),
            ["up", "smoke-2"]
        );
        assert_eq!(
            with_scene_from_file(root.path(), Some("sandbox-abc123"), &["down".to_string()])
                .expect("leave other commands unchanged"),
            ["down"]
        );
        assert_eq!(
            with_scene_from_file(root.path(), None, &up).expect("leave the command unchanged"),
            ["up"]
        );
    }

    #[test]
    fn a_missing_or_empty_scene_file_fails() {
        let root = crate::test_support::temporary_directory();
        let up = vec!["up".to_string()];

        let error = with_scene_from_file(root.path(), Some("sandbox-abc123"), &up)
            .expect_err("a missing scene file fails");
        assert!(
            error.to_string().contains(".tau/scene"),
            "unexpected error: {error}"
        );

        std::fs::create_dir_all(root.path().join(".tau")).expect("create .tau");
        std::fs::write(root.path().join(".tau/scene"), " \n").expect("write an empty scene");
        let error = with_scene_from_file(root.path(), Some("sandbox-abc123"), &up)
            .expect_err("an empty scene file fails");
        assert!(
            error.to_string().contains(".tau/scene"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn newer_files_lists_only_sources_newer_than_the_binary() {
        use std::time::Duration;

        fn set_modified(path: &Path, time: SystemTime) {
            let file = std::fs::File::options()
                .write(true)
                .open(path)
                .expect("open a file to set its time");
            file.set_modified(time).expect("set the modification time");
        }

        let root = crate::test_support::temporary_directory();
        let sources = root.path().join("crates/greppa-ui");
        std::fs::create_dir_all(&sources).expect("create the source folder");
        std::fs::create_dir_all(root.path().join("vendor/gpui-component"))
            .expect("create the vendor folder");
        let old = sources.join("old.rs");
        std::fs::write(&old, "old").expect("write an old source");
        for source in ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml"] {
            std::fs::write(root.path().join(source), "").expect("write a scene source");
        }
        let binary = root.path().join("greppa-scene");
        std::fs::write(&binary, "binary").expect("write the binary");
        let new = sources.join("new.rs");
        std::fs::write(&new, "new").expect("write a new source");

        let now = SystemTime::now();
        set_modified(&old, now - Duration::from_secs(10));
        for source in ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml"] {
            set_modified(&root.path().join(source), now - Duration::from_secs(10));
        }
        set_modified(&binary, now - Duration::from_secs(5));
        set_modified(&new, now);

        assert_eq!(
            newer_files(root.path(), &binary).expect("list newer files"),
            [new]
        );
    }

    #[test]
    fn read_pid_reads_the_first_field() {
        let root = crate::test_support::temporary_directory();
        let path = root.path().join("pid");
        std::fs::write(&path, "123 456\n").expect("write a pid file");

        assert_eq!(read_pid(&path).expect("read the pid"), 123);
    }
}
