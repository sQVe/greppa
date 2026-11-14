mod patches;

use crate::parts::FileStatus;
use crate::review::{Comment, FileKind, ReviewContent, ReviewFile};

pub(crate) const FOCUS: &str = "crates/greppa-core/src/git.rs";
pub(super) const PARTS: &str = "crates/greppa-ui/src/parts.rs";
pub(super) const RENAMED: &str = "crates/greppa-core/src/line_range.rs";
pub(super) const DELETED: &str = "crates/greppa-ui/src/scenes/changed_files.rs";
pub(super) const BINARY: &str = "assets/greppa-icon.png";

pub(crate) fn content() -> ReviewContent {
    let mut files = patches::files();
    for file in &mut files {
        file.viewed = [
            "Cargo.toml",
            "crates/greppa-core/Cargo.toml",
            "crates/greppa-core/src/lib.rs",
            PARTS,
            "docs/development.md",
        ]
        .contains(&file.path);
        file.collapsed = matches!(file.kind, FileKind::Generated | FileKind::Binary { .. });
        file.collapsed |= file.status == FileStatus::Deleted;
    }
    ReviewContent {
        files,
        comments: COMMENTS.to_vec(),
    }
}

const COMMENTS: [Comment; 3] = [
    Comment {
        id: "git-error",
        path: FOCUS,
        start: 23,
        end: 23,
        quote: "return Err(GitError::Command(\"git diff failed\".to_string()));",
        body: "Include Git's stderr and exit code. The generic message hides why the command failed.",
        part_line: false,
    },
    Comment {
        id: "patch-range",
        path: FOCUS,
        start: 32,
        end: 35,
        quote: "let output = Command::new(\"git\")\n    .current_dir(repository)\n    .args([\"diff\", \"--no-ext-diff\", \"--unified=3\", \"HEAD\", \"--\"])\n    .arg(path)",
        body: "Use the selected range here too. HEAD would show a different change from the file list.",
        part_line: false,
    },
    Comment {
        id: "path-bytes",
        path: FOCUS,
        start: 26,
        end: 26,
        quote: "from_utf8_lossy",
        body: "Keep paths as bytes until the OS path boundary. Lossy decoding can change a filename.",
        part_line: true,
    },
];

pub(crate) fn progress(files: &[ReviewFile]) -> (usize, usize) {
    let included: Vec<_> = files
        .iter()
        .filter(|file| file.kind != FileKind::Generated)
        .collect();
    (
        included.iter().filter(|file| file.viewed).count(),
        included.len(),
    )
}

pub(crate) fn groups(files: &[ReviewFile]) -> Vec<(&'static str, Vec<&ReviewFile>)> {
    let mut unviewed = Vec::new();
    let mut viewed = Vec::new();
    let mut generated = Vec::new();
    for file in files {
        if file.kind == FileKind::Generated {
            generated.push(file);
        } else if file.viewed {
            viewed.push(file);
        } else {
            unviewed.push(file);
        }
    }
    vec![
        ("Not viewed", unviewed),
        ("Viewed", viewed),
        ("Generated · excluded from progress", generated),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_keeps_sixteen_files_three_comments_and_exact_counts() {
        let content = content();
        let files = &content.files;
        let generated = files
            .iter()
            .find(|file| file.path == "Cargo.lock")
            .expect("lockfile");
        let deleted = files
            .iter()
            .find(|file| file.path == DELETED)
            .expect("deleted scene");
        let parts = files.iter().find(|file| file.path == PARTS).expect("parts");
        assert_eq!(files.len(), 16);
        assert_eq!(generated.counts(), (1200, 1200));
        assert_eq!(deleted.counts(), (0, 41));
        assert_eq!(parts.patch.matches("@@ -").count(), 6);
        assert_eq!(content.comments.len(), 3);
    }

    #[test]
    fn generated_group_excludes_only_the_lockfile_from_progress() {
        let content = content();
        let groups = groups(&content.files);
        assert_eq!(progress(&content.files), (5, 15));
        assert_eq!(
            groups.last().expect("generated group").1[0].path,
            "Cargo.lock"
        );
        assert_eq!(
            groups
                .iter()
                .map(|(_, files)| files.len())
                .collect::<Vec<_>>(),
            [10, 5, 1]
        );
    }
}
