use super::{BINARY, DELETED, FOCUS, PARTS, RENAMED};
use crate::parts::FileStatus;
use crate::review::{FileKind, ReviewFile};

pub(super) fn files() -> Vec<ReviewFile> {
    let source = include_str!("git.rs.txt");
    let parts = include_str!("parts.patch").to_string();
    let mut files = vec![
        added(FOCUS, source),
        added("crates/greppa-core/src/git/patch.rs", PATCH_SOURCE),
        added("crates/greppa-core/src/review_state.rs", REVIEW_SOURCE),
        added("crates/greppa-core/tests/git_reader.rs", TEST_SOURCE),
        modified(
            "crates/greppa-core/src/lib.rs",
            "pub mod line_range;\n",
            "pub mod line_range;\npub mod git;\npub mod review_state;\n",
        ),
        modified(
            "crates/greppa-core/Cargo.toml",
            "[lints]\nworkspace = true\n",
            "[dependencies]\nthiserror.workspace = true\n\n[lints]\nworkspace = true\n",
        ),
        modified(
            "Cargo.toml",
            "[workspace.dependencies]\nanyhow = \"1\"\n",
            "[workspace.dependencies]\nanyhow = \"1\"\ngreppa-core = { path = \"crates/greppa-core\" }\n",
        ),
        ReviewFile::new(PARTS, FileStatus::Modified, parts),
        modified(
            "crates/greppa-ui/src/theme.rs",
            "    pub deleted: Rgba,\n",
            "    pub deleted: Rgba,\n    pub renamed: Rgba,\n    pub binary: Rgba,\n",
        ),
        modified(
            "docs/development.md",
            "## Workspace\n",
            "## Workspace\n\nThe Git reader pins diff options and returns unified patches.\n",
        ),
        modified(
            "deny.toml",
            "[licenses]\nallow = [\"MIT\", \"Apache-2.0\"]\n",
            "[licenses]\nallow = [\"MIT\", \"Apache-2.0\", \"BSD-3-Clause\"]\n",
        ),
        generated(),
        renamed(),
        deleted(),
        binary(),
        added("crates/greppa-core/src/git/status.rs", STATUS_SOURCE),
    ];
    files
        .iter_mut()
        .find(|file| file.path == "Cargo.lock")
        .expect("generated lockfile")
        .kind = FileKind::Generated;

    files
}

fn added(path: &'static str, source: &str) -> ReviewFile {
    let body: String = source.lines().map(|line| format!("+{line}\n")).collect();
    let patch = format!(
        "diff --git a/{path} b/{path}\nnew file mode 100644\n--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{} @@\n{body}",
        source.lines().count()
    );

    ReviewFile::new(path, FileStatus::Added, patch)
}

fn modified(path: &'static str, before: &str, after: &str) -> ReviewFile {
    let removed: String = before.lines().map(|line| format!("-{line}\n")).collect();
    let added: String = after.lines().map(|line| format!("+{line}\n")).collect();
    let patch = format!(
        "diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n@@ -1,{} +1,{} @@\n{removed}{added}",
        before.lines().count(),
        after.lines().count()
    );

    ReviewFile::new(path, FileStatus::Modified, patch)
}

fn generated() -> ReviewFile {
    let mut before = String::new();
    let mut after = String::new();
    for package in 0..200 {
        before.push_str(&format!("[[package]]\nname = \"dependency-{package}\"\nversion = \"1.0.0\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\nchecksum = \"{package:064x}\"\n\n"));
        after.push_str(&format!("[[package]]\nname = \"dependency-{package}\"\nversion = \"1.1.0\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\nchecksum = \"{:064x}\"\n\n", package + 200));
    }

    modified("Cargo.lock", &before, &after)
}

fn renamed() -> ReviewFile {
    let previous = "crates/greppa-core/src/range.rs";
    let patch = format!(
        "diff --git a/{previous} b/{RENAMED}\nsimilarity index 90%\nrename from {previous}\nrename to {RENAMED}\n--- a/{previous}\n+++ b/{RENAMED}\n@@ -12,3 +12,4 @@\n     pub fn new(start: u32, end: u32) -> Option<Self> {{\n-        if start > end {{\n+        let invalid = start == 0 || start > end;\n+        if invalid {{\n             return None;\n"
    );
    let mut file = ReviewFile::new(RENAMED, FileStatus::Renamed, patch);
    file.previous_path = Some(previous);

    file
}

fn deleted() -> ReviewFile {
    let source = include_str!("deleted.rs.txt");
    let body: String = source.lines().map(|line| format!("-{line}\n")).collect();
    let patch = format!(
        "diff --git a/{DELETED} b/{DELETED}\ndeleted file mode 100644\n--- a/{DELETED}\n+++ /dev/null\n@@ -1,{} +0,0 @@\n{body}",
        source.lines().count()
    );

    ReviewFile::new(DELETED, FileStatus::Deleted, patch)
}

fn binary() -> ReviewFile {
    let patch = format!(
        "diff --git a/{BINARY} b/{BINARY}\nindex 1234567..abcdef0 100644\nBinary files a/{BINARY} and b/{BINARY} differ\n"
    );
    let mut file = ReviewFile::new(BINARY, FileStatus::Binary, patch);
    file.kind = FileKind::Binary {
        before_bytes: 24 * 1024,
        after_bytes: 32 * 1024,
    };

    file
}

const PATCH_SOURCE: &str = r#"use std::path::Path;

use super::GitError;

pub fn read(repository: &Path, path: &Path) -> Result<String, GitError> {
    super::read_patch(repository, path)
}
"#;

const REVIEW_SOURCE: &str = r#"use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Default)]
pub struct ReviewState {
    viewed: HashMap<PathBuf, String>,
}

impl ReviewState {
    pub fn mark_viewed(&mut self, path: PathBuf, fingerprint: String) {
        self.viewed.insert(path, fingerprint);
    }

    pub fn is_viewed(&self, path: &Path, fingerprint: &str) -> bool {
        self.viewed.get(path).is_some_and(|saved| saved == fingerprint)
    }
}
"#;

const TEST_SOURCE: &str = r#"use std::process::Command;

use greppa_core::git::{GitError, read_range};

#[test]
fn reports_an_unborn_head() {
    let repository = tempfile::tempdir().expect("create test repository");
    let status = Command::new("git").arg("init").arg(repository.path())
        .status().expect("Git is installed");

    assert!(status.success());
    let result = read_range(repository.path(), "HEAD");
    assert!(matches!(result, Err(GitError::Command(_))));
}
"#;

const STATUS_SOURCE: &str = r#"use std::path::PathBuf;

use super::{ChangedFile, GitError};

pub fn parse(output: &str) -> Result<Vec<ChangedFile>, GitError> {
    let mut files = Vec::new();
    for record in output.split('\0').filter(|record| !record.is_empty()) {
        let fields: Vec<_> = record.split('\t').collect();
        if fields.len() != 3 {
            return Err(GitError::Command("invalid numstat record".to_string()));
        }

        files.push(ChangedFile {
            path: PathBuf::from(fields[2]),
            added_lines: fields[0].parse().unwrap_or_default(),
            deleted_lines: fields[1].parse().unwrap_or_default(),
        });
    }

    Ok(files)
}
"#;
