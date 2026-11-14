use std::ffi::OsStr;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use thiserror::Error;

// Environment variables that would point `git` at another repository than the `-C` folder.
const REPOSITORY_OVERRIDES: [&str; 5] = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
];

#[derive(Debug, Error)]
pub enum GitError {
    #[error("could not start `{command}`: {source}")]
    NotStarted {
        command: String,
        #[source]
        source: io::Error,
    },
    #[error("`{command}` failed with exit code {exit_code:?}: {stderr}")]
    Failed {
        command: String,
        exit_code: Option<i32>,
        stderr: String,
    },
    #[error("`{command}` wrote output that is not UTF-8")]
    NotUtf8 { command: String },
}

pub(crate) struct Git {
    folder: PathBuf,
}

impl Git {
    pub(crate) fn new(folder: &Path) -> Self {
        Self {
            folder: folder.to_path_buf(),
        }
    }

    // Runs `git -C <folder> <arguments>` and returns its standard output without the final
    // newline.
    pub(crate) fn run<S: AsRef<OsStr>>(&self, arguments: &[S]) -> Result<String, GitError> {
        let mut command = Command::new("git");

        command.arg("-C").arg(&self.folder).args(arguments);

        for variable in REPOSITORY_OVERRIDES {
            command.env_remove(variable);
        }

        let description = describe(&self.folder, arguments);
        let output = command.output().map_err(|source| GitError::NotStarted {
            command: description.clone(),
            source,
        })?;

        if !output.status.success() {
            return Err(GitError::Failed {
                command: description,
                exit_code: output.status.code(),
                stderr: String::from_utf8_lossy(&output.stderr)
                    .trim_end()
                    .to_owned(),
            });
        }

        let mut stdout = String::from_utf8(output.stdout).map_err(|_| GitError::NotUtf8 {
            command: description,
        })?;

        if stdout.ends_with('\n') {
            stdout.pop();
        }

        Ok(stdout)
    }
}

fn describe<S: AsRef<OsStr>>(folder: &Path, arguments: &[S]) -> String {
    let mut words = vec![
        "git".to_owned(),
        "-C".to_owned(),
        folder.display().to_string(),
    ];

    words.extend(
        arguments
            .iter()
            .map(|argument| argument.as_ref().to_string_lossy().into_owned()),
    );

    words.join(" ")
}
