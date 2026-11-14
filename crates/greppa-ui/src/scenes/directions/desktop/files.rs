use gpui_kit::base::h_flex;
use gpui_kit::{Div, ParentElement, Styled, div, px};

use super::Desktop;
use crate::review::ReviewFile;
use crate::scenes::directions::data;

pub(super) fn footer(scene: &Desktop) -> Div {
    let profile = scene.profile;
    let colors = profile.tokens.theme.colors;
    let (viewed, total) = data::progress(&scene.content.files);
    let fraction = viewed as f32 / total as f32;
    let generated = scene.content.files.len() - total;
    h_flex()
        .h(profile.files_footer)
        .flex_shrink_0()
        .px(px(8.0))
        .gap(profile.gap)
        .border_t(px(1.0))
        .border_color(profile.tokens.outline)
        .text_size(px(11.0))
        .child(format!("{viewed} of {total} viewed"))
        .child(
            div()
                .text_color(colors.muted)
                .child(format!("+{generated} generated")),
        )
        .child(
            div().flex_1().h(px(3.0)).bg(profile.tokens.outline).child(
                div()
                    .w(gpui_kit::relative(fraction))
                    .h_full()
                    .bg(colors.accent),
            ),
        )
}

pub(super) fn change_label(file: &ReviewFile) -> String {
    if matches!(file.kind, crate::review::FileKind::Binary { .. }) {
        return "binary".to_string();
    }
    let (added, deleted) = file.counts();
    format!("+{added} −{deleted}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_rows_keep_their_binary_label_instead_of_zero_line_counts() {
        let content = data::content();
        let binary = content
            .files
            .iter()
            .find(|file| file.path == "assets/greppa-icon.png")
            .expect("binary fixture");
        assert_eq!(change_label(binary), "binary");
        let text = content
            .files
            .iter()
            .find(|file| file.path == data::FOCUS)
            .expect("text fixture");
        assert_eq!(change_label(text), "+62 −0");
    }
}
