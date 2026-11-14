use gpui_kit::assets::IconName;
use gpui_kit::base::h_flex;
use gpui_kit::component::{Icon, tooltip::Tooltip};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    App, ClickEvent, Div, FontWeight, InteractiveElement, ParentElement,
    StatefulInteractiveElement, Styled, Window, div,
};

use super::super::{keyboard::KeyboardLayer, profile::Profile};
use super::files;
use crate::review::ReviewFile;

pub(crate) fn render(
    file: &ReviewFile,
    profile: Profile,
    collapsed: bool,
    toggle: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
) -> Div {
    let theme = profile.tokens.theme;
    let colors = theme.colors;
    let (added, deleted) = file.counts();
    let focused =
        profile.focused(KeyboardLayer::Diff) && file.path == crate::scenes::directions::data::FOCUS;
    let folder = file
        .path
        .rsplit_once('/')
        .map_or(String::new(), |(folder, _)| format!("{folder}/"));
    h_flex()
        .h(profile.header)
        .flex_shrink_0()
        .min_w(theme.sizing.none)
        .px(theme.spacing.small)
        .gap(profile.padding)
        .border_b(theme.border.width)
        .border_color(profile.tokens.outline)
        .bg(profile.tokens.header)
        .when(focused, |this| this.bg(profile.focus_tokens.focus_header))
        .text_size(profile.row_text)
        .text_color(colors.foreground)
        .child(
            h_flex()
                .id(gpui_kit::SharedString::from(format!(
                    "file-collapse:{}",
                    file.path
                )))
                .size(theme.review.checkbox)
                .flex_shrink_0()
                .cursor_pointer()
                .tooltip(|window, cx| Tooltip::new("Expand or collapse file").build(window, cx))
                .on_click(toggle)
                .child(
                    Icon::new(if collapsed {
                        IconName::ChevronRight
                    } else {
                        IconName::ChevronDown
                    })
                    .size(theme.review.checkbox)
                    .text_color(colors.muted),
                ),
        )
        .child(
            Icon::new(files::status_icon(file.status))
                .size(theme.review.checkbox)
                .flex_shrink_0()
                .text_color(file.status.color(&profile.tokens.theme)),
        )
        .child(
            h_flex()
                .flex_1()
                .min_w(theme.sizing.none)
                .overflow_hidden()
                .whitespace_nowrap()
                .child(
                    div()
                        .min_w(theme.sizing.none)
                        .text_ellipsis()
                        .text_color(colors.muted)
                        .child(folder),
                )
                .child(
                    div()
                        .flex_shrink_0()
                        .font_weight(FontWeight::MEDIUM)
                        .when(focused, |this| this.text_color(colors.accent))
                        .child(title(file)),
                ),
        )
        .child(
            h_flex()
                .flex_shrink_0()
                .gap(profile.header_control_gap)
                .child(
                    h_flex()
                        .gap(profile.padding)
                        .child(
                            div()
                                .text_size(theme.text.counts)
                                .text_color(colors.added)
                                .child(format!("+{added}")),
                        )
                        .child(
                            div()
                                .text_size(theme.text.counts)
                                .text_color(colors.deleted)
                                .child(format!("−{deleted}")),
                        ),
                )
                .child(viewed_control(file, profile)),
        )
}

fn viewed_control(file: &ReviewFile, profile: Profile) -> impl gpui_kit::IntoElement {
    let theme = profile.tokens.theme;
    let (background, tick) = viewed_appearance(file.viewed, profile);
    h_flex()
        .id(gpui_kit::SharedString::from(format!(
            "viewed-control:{}",
            file.path
        )))
        .group("header-viewed-control")
        .h(theme.review.checkbox)
        // Center on the full header height, including its bottom border.
        .mt(theme.border.width)
        .flex_shrink_0()
        .gap(profile.padding)
        .cursor_pointer()
        .tooltip(|window, cx| Tooltip::new("Mark as viewed").build(window, cx))
        .child(
            h_flex()
                .size(theme.review.checkbox)
                .flex_shrink_0()
                .justify_center()
                .rounded(theme.radius.small)
                .border(theme.border.width)
                .border_color(theme.colors.border)
                .bg(background)
                .group_hover("header-viewed-control", |this| {
                    this.border_color(theme.colors.accent)
                })
                .when_some(tick, |this, (icon, color)| {
                    this.child(
                        Icon::new(icon)
                            .size(theme.review.checkbox - theme.border.width * 2.0)
                            .text_color(color),
                    )
                }),
        )
        .child(
            div()
                .text_size(theme.text.counts)
                .line_height(theme.review.checkbox)
                .text_color(theme.colors.muted)
                .child("Viewed"),
        )
}

fn viewed_appearance(
    viewed: bool,
    profile: Profile,
) -> (gpui_kit::Rgba, Option<(IconName, gpui_kit::Rgba)>) {
    if viewed {
        return (
            profile.tokens.theme.colors.accent,
            Some((IconName::Check, profile.tokens.editor)),
        );
    }
    (profile.tokens.editor, None)
}

fn title(file: &ReviewFile) -> String {
    let name = file.path.rsplit('/').next().expect("a file has a name");
    match file.previous_path {
        Some(previous) => {
            let old = previous
                .rsplit('/')
                .next()
                .expect("a previous file has a name");
            format!("{old} → {name}")
        }
        None => name.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui_kit::px;

    #[test]
    fn viewed_checkbox_is_empty_until_viewed_then_uses_accent_fill_and_editor_tick() {
        let profile = Profile::base(super::super::super::polish::Variant::Tree);
        assert!(
            matches!(viewed_appearance(false, profile), (background, None) if background == profile.tokens.editor)
        );
        assert!(
            matches!(viewed_appearance(true, profile), (background, Some((IconName::Check, color))) if background == profile.tokens.theme.colors.accent && color == profile.tokens.editor)
        );
    }

    #[test]
    fn viewed_control_uses_the_directions_checkbox_spacing_and_meta_tokens() {
        let profile = Profile::base(super::super::super::polish::Variant::Tree);
        let theme = profile.tokens.theme;
        assert_eq!(theme.review.checkbox, px(14.0));
        assert_eq!(theme.border.width, px(1.0));
        assert_eq!(theme.radius.small, px(3.0));
        assert_eq!(theme.text.counts, px(11.0));
        assert_eq!(theme.spacing.small, px(8.0));
        assert_eq!(profile.padding, px(6.0));
        assert_eq!(profile.header_control_gap, px(14.0));
        assert_eq!(profile.header, px(28.0));
    }

    #[test]
    fn renamed_header_keeps_both_complete_names() {
        let content = crate::scenes::directions::data::content();
        let renamed = content
            .files
            .iter()
            .find(|file| file.previous_path.is_some())
            .expect("renamed fixture");
        assert_eq!(title(renamed), "range.rs → line_range.rs");
    }
}
