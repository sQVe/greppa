use gpui_kit::base::v_flex;
use gpui_kit::{Div, ParentElement, Styled, div};

use crate::review::{FileKind, ReviewFile};
use crate::theme::Theme;

pub(crate) fn file_notice(file: &ReviewFile, theme: &Theme) -> Div {
    match file.kind {
        FileKind::Binary {
            before_bytes,
            after_bytes,
        } => v_flex()
            .py(theme.spacing.small)
            .gap(theme.spacing.small)
            .text_size(theme.text.row)
            .child("Binary file · PNG image · no text diff")
            .child(format!(
                "{} KiB before → {} KiB after",
                before_bytes / 1024,
                after_bytes / 1024
            )),
        _ => div(),
    }
}

pub(crate) fn display_count(count: usize) -> String {
    if count < 1000 {
        count.to_string()
    } else {
        format!("{},{:03}", count / 1000, count % 1000)
    }
}

pub(crate) fn annotation_frame(panel: Div, theme: &Theme) -> Div {
    v_flex()
        .w_full()
        .px(theme.spacing.large)
        .py(theme.spacing.tiny)
        .child(panel)
}

#[cfg(test)]
mod tests {
    use super::display_count;

    #[test]
    fn change_counts_use_a_separator_starting_at_one_thousand() {
        let cases = [(999, "999"), (1000, "1,000"), (12345, "12,345")];

        for (count, expected) in cases {
            assert_eq!(display_count(count), expected, "count {count}");
        }
    }

    #[test]
    fn large_change_counts_keep_their_thousands_separator() {
        assert_eq!(display_count(2400), "2,400");
    }
}
