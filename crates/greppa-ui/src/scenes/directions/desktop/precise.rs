pub(crate) mod files;
pub(crate) mod header;
mod labels;
mod layout;
pub(crate) mod notes;
pub(crate) mod ranges;

use crate::review::{Comment, ReviewContent};
use gpui_kit::{Pixels, px};

pub(crate) fn code_column(number_width: Pixels, columns: usize) -> Pixels {
    px(8.0) + number_width * columns as f32 + px(4.0 + 8.0 + 4.0 + 2.0 + 8.0)
}

pub(crate) const DRAFT: Comment = Comment {
    id: "precise-draft",
    path: "crates/greppa-core/src/line_range.rs",
    start: 14,
    end: 15,
    quote: "if invalid { return None; }",
    body: "Check whether the caller already converts the line numbers.\nKeep the one-based range contract explicit.",
    part_line: false,
};

pub(crate) fn prepare(content: &mut ReviewContent) {
    let file = content
        .files
        .iter_mut()
        .find(|file| file.path == "assets/branding/application-icons/greppa-icon.png")
        .expect("precise fixture contains the added binary file");
    file.status = crate::parts::FileStatus::Added;
}

pub(crate) fn tree_content(content: &mut ReviewContent) {
    let file = content
        .files
        .iter_mut()
        .find(|file| file.path == DRAFT.path)
        .expect("renamed fixture");
    file.patch = format!(
        "diff --git a/crates/greppa-core/src/range.rs b/{path}\nrename from crates/greppa-core/src/range.rs\nrename to {path}\n--- a/crates/greppa-core/src/range.rs\n+++ b/{path}\n@@ -12,6 +12,7 @@\n pub fn new(start: u32, end: u32) -> Option<Self> {{\n-    if start > end {{\n+    let invalid = start == 0 || start > end;\n+    if invalid {{\n         return None;\n     }}\n     Some(Self {{ start, end }})\n }}\n",
        path = DRAFT.path
    );
    content
        .files
        .iter_mut()
        .find(|file| file.status == crate::parts::FileStatus::Deleted)
        .expect("deleted fixture")
        .collapsed = false;
    content.comments = vec![Comment {
        id: "precise-saved",
        path: DRAFT.path,
        start: 13,
        end: 13,
        quote: "let invalid = start == 0 || start > end;",
        body: "Keep the zero-line check before constructing the range.",
        part_line: false,
    }];
}

#[cfg(test)]
mod tests {
    use super::super::{polish::Variant, profile::Profile};
    use super::*;
    use crate::parts::FileStatus;

    #[test]
    fn binary_fixture_keeps_its_kind_and_counts_but_uses_the_added_status() {
        let mut content = crate::scenes::directions::data::content();
        super::super::polish::files::prepare(&mut content);
        let original = content
            .files
            .iter()
            .find(|file| file.path.ends_with("/greppa-icon.png"))
            .expect("binary fixture")
            .clone();
        prepare(&mut content);
        let binary = content
            .files
            .iter()
            .find(|file| file.path == original.path)
            .expect("prepared binary fixture");
        assert!(matches!(binary.status, FileStatus::Added));
        assert_eq!(binary.kind, original.kind);
        assert_eq!(binary.patch, original.patch);
        assert_eq!(super::super::files::change_label(binary), "binary");
        assert!(matches!(
            files::status_icon(binary.status),
            gpui_kit::assets::IconName::Plus
        ));
    }

    #[test]
    fn pixel_gutter_keeps_fixed_lanes_for_one_and_two_columns_with_two_to_four_digits() {
        for width in [19.0, 28.0, 37.0] {
            for (status, columns) in [
                (FileStatus::Added, 1),
                (FileStatus::Deleted, 1),
                (FileStatus::Modified, 2),
            ] {
                let file = crate::review::ReviewFile::new("file.rs", status, String::new());
                let profile = Profile::base(Variant::Rule).for_file(Some(px(width)), &file);
                assert_eq!(profile.gutter, code_column(px(width), columns));
                assert_eq!(f32::from(profile.gutter).fract(), 0.0);
                assert_eq!(profile.gutter - px(10.0), px(24.0 + width * columns as f32));
            }
        }
    }

    #[test]
    fn tree_fixture_uses_minimal_changes_and_keeps_comment_ranges() {
        let mut content = crate::scenes::directions::data::content();
        tree_content(&mut content);
        let file = content
            .files
            .iter()
            .find(|file| file.path == DRAFT.path)
            .expect("modified file");
        assert_eq!(file.counts(), (2, 1));
        let (_, hunk) = file
            .patch
            .split_once("@@ -12,6 +12,7 @@\n")
            .expect("the sample preserves both source ranges");
        assert_eq!(
            hunk.lines().collect::<Vec<_>>(),
            [
                " pub fn new(start: u32, end: u32) -> Option<Self> {",
                "-    if start > end {",
                "+    let invalid = start == 0 || start > end;",
                "+    if invalid {",
                "         return None;",
                "     }",
                "     Some(Self { start, end })",
                " }",
            ]
        );
        assert_eq!(content.comments[0].path, DRAFT.path);
        assert_eq!(
            (content.comments[0].start, content.comments[0].end),
            (13, 13)
        );
        assert_eq!((DRAFT.start, DRAFT.end), (14, 15));
    }
}
