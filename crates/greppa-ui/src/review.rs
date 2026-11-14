use crate::parts::FileStatus;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FileKind {
    Text,
    Generated,
    Binary {
        before_bytes: usize,
        after_bytes: usize,
    },
}

#[derive(Clone)]
pub(crate) struct ReviewFile {
    pub path: &'static str,
    pub previous_path: Option<&'static str>,
    pub status: FileStatus,
    pub patch: String,
    pub viewed: bool,
    pub collapsed: bool,
    pub kind: FileKind,
}

impl ReviewFile {
    pub(crate) fn new(path: &'static str, status: FileStatus, patch: String) -> Self {
        Self {
            path,
            previous_path: None,
            status,
            patch,
            viewed: false,
            collapsed: false,
            kind: FileKind::Text,
        }
    }

    pub(crate) fn counts(&self) -> (usize, usize) {
        let additions = self
            .patch
            .lines()
            .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
            .count();
        let deletions = self
            .patch
            .lines()
            .filter(|line| line.starts_with('-') && !line.starts_with("---"))
            .count();
        (additions, deletions)
    }
}

#[derive(Clone, Copy)]
pub(crate) struct Comment {
    pub id: &'static str,
    pub path: &'static str,
    pub start: usize,
    pub end: usize,
    pub quote: &'static str,
    pub body: &'static str,
    pub part_line: bool,
}

impl Comment {
    pub(crate) fn location(&self) -> String {
        if self.part_line {
            return format!("Line {} · selected words · new", self.start);
        }
        if self.start == self.end {
            format!("Line {} · new", self.start)
        } else {
            format!("Lines {}–{} · new", self.start, self.end)
        }
    }
}

#[derive(Clone, Copy)]
pub(crate) struct ViewerOptions {
    pub draft: Option<Comment>,
    pub initial_path: &'static str,
    pub initial_line: Option<usize>,
}

#[derive(Clone)]
pub(crate) struct ReviewContent {
    pub files: Vec<ReviewFile>,
    pub comments: Vec<Comment>,
}

pub(crate) fn ordered_files(files: &[ReviewFile]) -> Vec<&ReviewFile> {
    let mut files: Vec<_> = files.iter().collect();
    files.sort_by_key(|file| (file.kind == FileKind::Generated, file.viewed));
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_location_labels_selected_words_lines_and_ranges() {
        let cases = [
            ("part line", 12, 12, true, "Line 12 · selected words · new"),
            ("one line", 12, 12, false, "Line 12 · new"),
            ("line range", 12, 15, false, "Lines 12–15 · new"),
        ];

        for (name, start, end, part_line, expected) in cases {
            let comment = Comment {
                id: "comment",
                path: "example.rs",
                start,
                end,
                quote: "selected code",
                body: "Review this code",
                part_line,
            };

            assert_eq!(comment.location(), expected, "{name}");
        }
    }

    #[test]
    fn queue_moves_viewed_files_after_unviewed_and_generated_files_last() {
        let mut generated = ReviewFile::new("Cargo.lock", FileStatus::Modified, String::new());
        generated.kind = FileKind::Generated;
        let mut viewed = ReviewFile::new("viewed.rs", FileStatus::Modified, String::new());
        viewed.viewed = true;
        let first = ReviewFile::new("first.rs", FileStatus::Added, String::new());
        let second = ReviewFile::new("second.rs", FileStatus::Added, String::new());
        let files = [generated, viewed, first, second];
        let actual: Vec<_> = ordered_files(&files).iter().map(|file| file.path).collect();
        assert_eq!(actual, ["first.rs", "second.rs", "viewed.rs", "Cargo.lock"]);
    }

    #[test]
    fn file_counts_exclude_patch_headers_and_context() {
        let file = ReviewFile::new("example.rs", FileStatus::Modified,
            "diff --git a/example.rs b/example.rs\n--- a/example.rs\n+++ b/example.rs\n@@ -1,2 +1,3 @@\n same\n-old\n+new\n+extra\n".to_string());
        assert_eq!(file.counts(), (2, 1));
    }
}
