pub(crate) mod files;
pub(crate) mod header;
mod labels;
mod layout;
pub(crate) mod notes;
pub(crate) mod ranges;

use crate::review::Comment;
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

#[cfg(test)]
mod tests {
    use super::super::{polish::Variant, profile::Profile};
    use super::*;
    use crate::parts::FileStatus;

    #[test]
    fn binary_fixture_keeps_its_kind_and_counts_but_uses_the_added_status() {
        let content = crate::scenes::directions::data::content();
        let binary = content
            .files
            .iter()
            .find(|file| file.path.ends_with("/greppa-icon.png"))
            .expect("binary fixture");
        assert!(matches!(binary.status, FileStatus::Added));
        assert!(matches!(
            binary.kind,
            crate::review::FileKind::Binary { .. }
        ));
        assert_eq!(binary.counts(), (0, 0));
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
        let content = crate::scenes::directions::data::tree_content();
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
