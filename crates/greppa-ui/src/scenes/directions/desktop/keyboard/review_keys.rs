use super::data::{KeyGroup, KeyRow};

pub(super) const LEFT: &[KeyGroup] = &[
    KeyGroup {
        title: "Move",
        rows: &[
            KeyRow {
                label: "Next pane",
                caps: &["Tab"],
            },
            KeyRow {
                label: "Previous pane",
                caps: &["Shift+Tab"],
            },
            KeyRow {
                label: "Down",
                caps: &["j", "↓"],
            },
            KeyRow {
                label: "Up",
                caps: &["k", "↑"],
            },
            KeyRow {
                label: "Scroll left",
                caps: &["h", "←"],
            },
            KeyRow {
                label: "Scroll right",
                caps: &["l", "→"],
            },
            KeyRow {
                label: "Half a page down",
                caps: &["Ctrl+D"],
            },
            KeyRow {
                label: "Half a page up",
                caps: &["Ctrl+U"],
            },
            KeyRow {
                label: "Top",
                caps: &["g g"],
            },
            KeyRow {
                label: "Bottom",
                caps: &["G"],
            },
        ],
    },
    KeyGroup {
        title: "Jump",
        rows: &[
            KeyRow {
                label: "Next file",
                caps: &["}"],
            },
            KeyRow {
                label: "Previous file",
                caps: &["{"],
            },
            KeyRow {
                label: "Next change",
                caps: &["]"],
            },
            KeyRow {
                label: "Previous change",
                caps: &["["],
            },
            KeyRow {
                label: "Next comment",
                caps: &[")"],
            },
            KeyRow {
                label: "Previous comment",
                caps: &["("],
            },
        ],
    },
];
pub(super) const RIGHT: &[KeyGroup] = &[
    KeyGroup {
        title: "Review",
        rows: &[
            KeyRow {
                label: "Mark viewed, next file",
                caps: &["r"],
            },
            KeyRow {
                label: "Open file or comment",
                caps: &["Enter"],
            },
            KeyRow {
                label: "Select lines",
                caps: &["v"],
            },
            KeyRow {
                label: "Comment on the line or selection",
                caps: &["c"],
            },
            KeyRow {
                label: "Edit comment",
                caps: &["i"],
            },
            KeyRow {
                label: "Delete comment",
                caps: &["d d"],
            },
            KeyRow {
                label: "Finish review",
                caps: &["Z Z"],
            },
        ],
    },
    KeyGroup {
        title: "Writing a comment",
        rows: &[
            KeyRow {
                label: "Save",
                caps: &["Ctrl+Enter"],
            },
            KeyRow {
                label: "Cancel",
                caps: &["Esc"],
            },
        ],
    },
    KeyGroup {
        title: "View",
        rows: &[
            KeyRow {
                label: "Show or hide the file list",
                caps: &["z f"],
            },
            KeyRow {
                label: "Show or hide comments",
                caps: &["z c"],
            },
            KeyRow {
                label: "Switch list and tree",
                caps: &["z l"],
            },
            KeyRow {
                label: "Show these keys",
                caps: &["?"],
            },
        ],
    },
];

#[cfg(test)]
mod tests {
    use super::super::column_height;
    use super::*;
    use crate::scenes::directions::desktop::{polish::Variant, profile::Profile};
    use gpui_kit::{point, px, size};

    #[test]
    fn review_tool_keys_keep_all_twenty_nine_actions_and_sequences() {
        let groups: Vec<_> = LEFT.iter().chain(RIGHT).map(|group| group.title).collect();
        assert_eq!(
            groups,
            ["Move", "Jump", "Review", "Writing a comment", "View"]
        );
        let actual: Vec<_> = LEFT
            .iter()
            .chain(RIGHT)
            .flat_map(|group| group.rows)
            .map(|row| (row.label, row.caps))
            .collect();
        let expected: [(&str, &[&str]); 29] = [
            ("Next pane", &["Tab"]),
            ("Previous pane", &["Shift+Tab"]),
            ("Down", &["j", "↓"]),
            ("Up", &["k", "↑"]),
            ("Scroll left", &["h", "←"]),
            ("Scroll right", &["l", "→"]),
            ("Half a page down", &["Ctrl+D"]),
            ("Half a page up", &["Ctrl+U"]),
            ("Top", &["g g"]),
            ("Bottom", &["G"]),
            ("Next file", &["}"]),
            ("Previous file", &["{"]),
            ("Next change", &["]"]),
            ("Previous change", &["["]),
            ("Next comment", &[")"]),
            ("Previous comment", &["("]),
            ("Mark viewed, next file", &["r"]),
            ("Open file or comment", &["Enter"]),
            ("Select lines", &["v"]),
            ("Comment on the line or selection", &["c"]),
            ("Edit comment", &["i"]),
            ("Delete comment", &["d d"]),
            ("Finish review", &["Z Z"]),
            ("Save", &["Ctrl+Enter"]),
            ("Cancel", &["Esc"]),
            ("Show or hide the file list", &["z f"]),
            ("Show or hide comments", &["z c"]),
            ("Switch list and tree", &["z l"]),
            ("Show these keys", &["?"]),
        ];
        assert_eq!(actual, expected);
        assert!(actual.iter().all(|(_, caps)| (1..=2).contains(&caps.len())));
    }

    #[test]
    fn review_tool_keys_fit_the_centered_five_hundred_five_pixel_box() {
        let profile = Profile::base(Variant::Rule);
        let tokens = profile.keyboard;
        let border = profile.tokens.theme.border.width;
        assert_eq!(column_height(LEFT, tokens), px(442.0));
        assert_eq!(column_height(RIGHT, tokens), px(404.0));
        assert_eq!(tokens.column_width(border), px(289.0));
        let bounds = tokens.box_bounds(
            size(px(1280.0), px(800.0)),
            column_height(LEFT, tokens),
            border,
        );
        assert_eq!(bounds.origin, point(px(320.0), px(147.0)));
        assert_eq!(bounds.size, size(px(640.0), px(505.0)));
    }
}
