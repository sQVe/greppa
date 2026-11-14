use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

// A Git repository in a temporary folder, built with `git` that ignores user and system config.
pub(crate) struct TestRepository {
    folder: TempDir,
}

impl TestRepository {
    // Creates a repository whose first branch is `main`, with no commits.
    pub(crate) fn new() -> Self {
        let folder = tempfile::Builder::new()
            .prefix("greppa-core-test-")
            .tempdir()
            .expect("create a temporary directory");

        git(folder.path(), &["init", "--quiet", "--initial-branch=main"]);

        Self { folder }
    }

    pub(crate) fn path(&self) -> &Path {
        self.folder.path()
    }

    // Commits with no file changes and returns the new commit's SHA.
    pub(crate) fn commit(&self, message: &str) -> String {
        self.git(&["commit", "--quiet", "--allow-empty", "--message", message]);

        self.git(&["rev-parse", "HEAD"])
    }

    pub(crate) fn switch_new_branch(&self, name: &str) {
        self.git(&["switch", "--quiet", "--create", name]);
    }

    pub(crate) fn switch_orphan_branch(&self, name: &str) {
        self.git(&["switch", "--quiet", "--orphan", name]);
    }

    pub(crate) fn move_branch(&self, name: &str, commit: &str) {
        self.git(&["update-ref", &format!("refs/heads/{name}"), commit]);
    }

    pub(crate) fn git(&self, arguments: &[&str]) -> String {
        git(self.path(), arguments)
    }
}

pub(crate) fn git(folder: &Path, arguments: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(folder)
        .args(arguments)
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_AUTHOR_NAME", "Test Author")
        .env("GIT_AUTHOR_EMAIL", "author@example.com")
        .env("GIT_COMMITTER_NAME", "Test Committer")
        .env("GIT_COMMITTER_EMAIL", "committer@example.com")
        .output()
        .expect("start git");

    assert!(
        output.status.success(),
        "git {arguments:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    String::from_utf8(output.stdout)
        .expect("git writes UTF-8 here")
        .trim_end()
        .to_owned()
}
