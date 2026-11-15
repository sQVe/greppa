use gpui_kit::{Div, ParentElement, Pixels, Styled, div};

use super::super::profile::Profile;
use crate::review::ReviewFile;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RangeMarking {
    Dots,
    Gutter,
}

pub(crate) fn marker(profile: Profile, width: Pixels, background: gpui_kit::Rgba) -> Div {
    let lane = profile.tokens.theme.spacing.small;
    let code_offset = lane + profile.gap + profile.bar;
    let background_offset = code_offset - profile.bar;
    let background_width = width - (profile.gutter - profile.indicator);
    div()
        .relative()
        .w(lane)
        .h(profile.code_row)
        // Restore the empty indicator too. Changed bars paint over it after this marker.
        .child(
            div()
                .absolute()
                .top(profile.tokens.theme.sizing.none)
                .left(background_offset)
                .w(background_width)
                .h(profile.code_row)
                .bg(background),
        )
}

pub(crate) fn row_background(file: &ReviewFile, line: usize, profile: Profile) -> gpui_kit::Rgba {
    match file.status {
        crate::parts::FileStatus::Added => profile.tokens.added,
        crate::parts::FileStatus::Deleted => profile.tokens.removed,
        _ if added_line(&file.patch, line) => profile
            .tokens
            .changed_background(profile.tokens.theme.colors.added),
        _ => profile.tokens.editor,
    }
}

fn added_line(patch: &str, target: usize) -> bool {
    let mut modified_line = None;
    for line in patch.lines() {
        if let Some(header) = line.strip_prefix("@@ ") {
            let range = header
                .split_whitespace()
                .nth(1)
                .expect("fixture hunk has a modified range");
            let start = range
                .strip_prefix('+')
                .expect("modified hunk range starts with plus");
            modified_line = Some(
                start
                    .split(',')
                    .next()
                    .expect("hunk range has a start")
                    .parse::<usize>()
                    .expect("fixture hunk start is a line number"),
            );
            continue;
        }
        let Some(number) = modified_line else {
            continue;
        };
        if line.starts_with('+') || line.starts_with(' ') {
            if number == target {
                return line.starts_with('+');
            }
            modified_line = Some(number + 1);
        }
    }
    panic!("marked modified line {target} must exist in the fixture patch");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scenes::SceneName;

    #[test]
    fn scene_names_select_one_marking_and_leave_earlier_scenes_on_dots() {
        for (scene, expected) in [
            (SceneName::V5RangeGutter, RangeMarking::Gutter),
            (SceneName::V4Rule, RangeMarking::Dots),
            (SceneName::V4Tree, RangeMarking::Dots),
        ] {
            let marking = scene.desktop().expect("desktop scene").range_marking;
            assert_eq!(marking, expected, "{scene:?}");
        }
    }

    #[test]
    fn mixed_patch_rows_keep_native_added_and_context_backgrounds() {
        let mut content = crate::scenes::directions::data::content();
        super::super::tree_content(&mut content);
        let file = content
            .files
            .iter()
            .find(|file| file.path == super::super::DRAFT.path)
            .expect("renamed fixture");
        let profile = Profile::base(super::super::super::polish::Variant::Tree);
        let added = profile
            .tokens
            .changed_background(profile.tokens.theme.colors.added);
        for (line, expected) in [
            (12, profile.tokens.editor),
            (13, added),
            (14, added),
            (15, profile.tokens.editor),
            (18, profile.tokens.editor),
        ] {
            assert_eq!(row_background(file, line, profile), expected, "line {line}");
        }
    }

    #[test]
    fn the_rule_fixture_marks_only_rows_with_the_added_background() {
        let content = crate::scenes::directions::data::content();
        for comment in &content.comments {
            let file = content
                .files
                .iter()
                .find(|file| file.path == comment.path)
                .expect("comment file");
            assert!(matches!(file.status, crate::parts::FileStatus::Added));
        }
    }
}
