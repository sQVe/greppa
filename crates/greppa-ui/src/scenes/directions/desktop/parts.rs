use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{Div, ParentElement, SharedString, Styled, div, px};

use super::profile::Profile;
use crate::review::{Comment, ReviewFile};

pub(crate) fn button(label: impl Into<SharedString>, profile: Profile, filled: bool) -> Div {
    let colors = profile.tokens.theme.colors;
    h_flex()
        .h(profile.button)
        .flex_shrink_0()
        .px(profile.padding)
        .justify_center()
        .rounded(px(3.0))
        .border(px(1.0))
        .border_color(if filled { colors.accent } else { colors.border })
        .bg(if filled {
            colors.accent
        } else {
            colors.surface
        })
        .text_color(if filled {
            profile.tokens.button_text
        } else {
            colors.foreground
        })
        .text_size(profile.row_text)
        .line_height(px(16.0))
        .child(label.into())
}

pub(crate) fn generated_notice(
    file: &ReviewFile,
    collapsed: bool,
    profile: Profile,
    on_toggle: impl Fn(&gpui_kit::ClickEvent, &mut gpui_kit::Window, &mut gpui_kit::App) + 'static,
) -> Div {
    use gpui_kit::{InteractiveElement as _, StatefulInteractiveElement as _};
    let (added, deleted) = file.counts();
    h_flex()
        .justify_between()
        .p(profile.padding)
        .text_size(profile.row_text)
        .child(format!(
            "Generated file · {} changed lines",
            crate::parts::review::display_count(added + deleted)
        ))
        .child(
            button(
                if collapsed { "Show diff" } else { "Hide diff" },
                profile,
                false,
            )
            .id("desktop-generated-toggle")
            .on_click(on_toggle),
        )
}

pub(crate) fn location(comment: &Comment) -> String {
    if comment.start == comment.end {
        format!("Line {}", comment.start)
    } else {
        format!("Lines {}–{}", comment.start, comment.end)
    }
}

pub(crate) fn card(comment: &Comment, profile: Profile, code_font: SharedString) -> Div {
    let quote = single_line_quote(comment.quote);
    v_flex()
        .gap(profile.gap)
        .p(profile.padding)
        .border_l(px(1.0))
        .border_color(profile.tokens.note_edge)
        .bg(profile.tokens.note)
        .text_color(profile.tokens.theme.colors.foreground)
        .text_size(profile.row_text)
        .line_height(px(16.0))
        .w_full()
        .when(
            profile.focused(super::keyboard::KeyboardLayer::Comments) && comment.id == "path-bytes",
            |this| {
                this.bg(profile.focus_tokens.focus_fill_editor)
                    .border_color(profile.tokens.theme.colors.accent)
            },
        )
        .child(
            div()
                .text_size(px(11.0))
                .text_color(profile.tokens.theme.colors.muted)
                .child(location(comment)),
        )
        .child(
            div()
                .text_size(px(11.0))
                .font_family(code_font)
                .w_full()
                .min_w(px(0.0))
                .text_ellipsis()
                .overflow_hidden()
                .text_color(profile.tokens.theme.colors.muted)
                .child(quote),
        )
        .child(comment.body)
}

fn single_line_quote(quote: &str) -> String {
    quote.lines().map(str::trim).collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quiet_button_boundaries_keep_control_contrast() {
        let profile = Profile::base(super::super::polish::Variant::Rule);
        let mut control = button("Files", profile, false);
        let color = control
            .style()
            .border_color
            .expect("quiet controls have a boundary");
        let ratio = crate::theme::contrast::contrast_ratio(
            color.into(),
            profile.tokens.theme.colors.surface,
        );
        assert!(ratio >= 3.0, "quiet control boundary contrast: {ratio}");
    }

    #[test]
    fn precise_quotes_keep_words_on_one_line_for_visual_end_truncation() {
        assert_eq!(
            single_line_quote("let name = \"a  b\";\n    use_name(name);"),
            "let name = \"a  b\"; use_name(name);"
        );
        assert_eq!(
            single_line_quote("  return Err(\"git diff failed\");\n    café 世界"),
            "return Err(\"git diff failed\"); café 世界"
        );
    }
}
