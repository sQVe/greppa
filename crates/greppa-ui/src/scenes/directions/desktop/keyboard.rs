mod data;
mod review_keys;
pub(crate) mod tokens;

use super::{focus::FocusLook, profile::Profile};
use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Bounds, Div, FontWeight, ParentElement, Pixels, Rgba, Size, Styled, div, point, size,
};
use tokens::KeyboardTokens;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum KeyboardLayer {
    None,
    Files,
    Diff,
    Comments,
    Keys,
}

impl KeyboardLayer {
    pub(crate) fn selected_bar_color(self, profile: Profile) -> Rgba {
        let colors = profile.tokens.theme.colors;
        match self {
            Self::Diff | Self::Comments => colors.border,
            _ => colors.accent,
        }
    }

    fn pane_bounds(self, profile: Profile, viewport: Size<Pixels>) -> Option<Bounds<Pixels>> {
        let border = profile.tokens.theme.border.width;
        let (left, width) = match self {
            Self::Files => (profile.tokens.theme.sizing.none, profile.files - border),
            Self::Diff => (
                profile.files,
                viewport.width - profile.files - profile.comments,
            ),
            Self::Comments => (
                viewport.width - profile.comments + border,
                profile.comments - border,
            ),
            Self::None | Self::Keys => return None,
        };
        Some(Bounds::new(
            point(left, profile.toolbar),
            size(width, viewport.height - profile.toolbar),
        ))
    }

    pub(crate) fn from_name(name: &str) -> Self {
        match name {
            "direction-v7-focus-border-files" => Self::Files,
            "direction-v7-focus-border-diff" => Self::Diff,
            "direction-v7-focus-border-comments" => Self::Comments,
            "direction-v7-keys" => Self::Keys,
            _ => Self::None,
        }
    }
}

pub(crate) fn layer(profile: Profile, viewport: Size<Pixels>) -> Div {
    let tokens = profile.keyboard;
    match profile.keyboard_layer {
        KeyboardLayer::Files => focus(tokens.files, profile, viewport),
        KeyboardLayer::Diff => focus(tokens.diff, profile, viewport),
        KeyboardLayer::Comments => focus(tokens.comments, profile, viewport),
        KeyboardLayer::Keys => help(profile, viewport),
        KeyboardLayer::None => div(),
    }
}

fn focus(bounds: Bounds<Pixels>, profile: Profile, viewport: Size<Pixels>) -> Div {
    div()
        .absolute()
        .inset(profile.tokens.theme.sizing.none)
        .child(ring(bounds, profile))
        .when_some(
            profile.keyboard_layer.pane_bounds(profile, viewport),
            |this, pane| {
                this.child(
                    div()
                        .absolute()
                        .left(pane.origin.x)
                        .top(pane.origin.y)
                        .w(pane.size.width)
                        .h(pane.size.height)
                        .when(profile.focus_look == FocusLook::Border, |this| {
                            this.border(profile.keyboard.pane_frame_width)
                                .border_color(profile.tokens.theme.colors.accent)
                        }),
                )
            },
        )
}

fn ring(bounds: Bounds<Pixels>, profile: Profile) -> Div {
    div()
        .absolute()
        .left(bounds.origin.x)
        .top(bounds.origin.y)
        .w(bounds.size.width)
        .h(bounds.size.height)
        .border(profile.tokens.theme.border.width)
        .border_color(profile.tokens.theme.colors.accent)
}

fn help(profile: Profile, viewport: Size<Pixels>) -> Div {
    let tokens = profile.keyboard;
    let theme = profile.tokens.theme;
    let (left, right) = (review_keys::LEFT, review_keys::RIGHT);
    let content_height = column_height(left, tokens);
    let bounds = tokens.box_bounds(viewport, content_height, theme.border.width);
    div()
        .absolute()
        .inset(theme.sizing.none)
        .child(
            div()
                .absolute()
                .inset(theme.sizing.none)
                .bg(theme.colors.foreground.opacity(tokens.scrim_opacity)),
        )
        .child(
            v_flex()
                .absolute()
                .left(bounds.origin.x)
                .top(bounds.origin.y)
                .w(bounds.size.width)
                .h(bounds.size.height)
                .border(theme.border.width)
                .border_color(theme.colors.border)
                .rounded(theme.radius.small)
                .bg(theme.colors.surface)
                .overflow_hidden()
                .child(title(profile))
                .child(
                    div()
                        .w_full()
                        .h(theme.border.width)
                        .flex_shrink_0()
                        .bg(profile.tokens.outline),
                )
                .child(
                    h_flex()
                        .items_start()
                        .p(tokens.padding)
                        .gap(tokens.column_gap)
                        .child(column(left, profile))
                        .child(column(right, profile)),
                ),
        )
}

fn title(profile: Profile) -> Div {
    let tokens = profile.keyboard;
    let theme = profile.tokens.theme;
    h_flex()
        .h(tokens.title_height)
        .flex_shrink_0()
        .px(tokens.padding - theme.border.width)
        .justify_between()
        .child(
            div()
                .text_size(profile.row_text)
                .line_height(profile.code_row)
                .font_weight(FontWeight::MEDIUM)
                .text_color(theme.colors.foreground)
                .child("Keys"),
        )
        .child(
            h_flex()
                .gap(tokens.title_gap)
                .child(cap("Esc", profile))
                .child(
                    div()
                        .text_size(theme.text.counts)
                        .line_height(theme.review.checkbox)
                        .text_color(theme.colors.muted)
                        .child("Close"),
                ),
        )
}

fn column(groups: &'static [data::KeyGroup], profile: Profile) -> Div {
    let tokens = profile.keyboard;
    let theme = profile.tokens.theme;
    v_flex()
        .w(tokens.column_width(theme.border.width))
        .flex_shrink_0()
        .gap(tokens.group_gap)
        .children(groups.iter().map(|group| {
            v_flex()
                .child(
                    h_flex()
                        .h(tokens.row_height)
                        .flex_shrink_0()
                        .text_size(theme.text.counts)
                        .line_height(theme.review.checkbox)
                        .text_color(theme.colors.muted)
                        .child(group.title),
                )
                .children(group.rows.iter().map(|row| key_row(row, profile)))
        }))
}

fn key_row(row: &'static data::KeyRow, profile: Profile) -> Div {
    let tokens = profile.keyboard;
    h_flex()
        .h(tokens.row_height)
        .flex_shrink_0()
        .justify_between()
        .child(
            div()
                .flex_shrink_0()
                .whitespace_nowrap()
                .text_size(profile.file_text)
                .line_height(tokens.row_height)
                .text_color(profile.tokens.theme.colors.foreground)
                .child(row.label),
        )
        .child(h_flex().flex_shrink_0().gap(tokens.cap_gap).children(
            row.caps.iter().enumerate().map(|(index, label)| {
                h_flex()
                    .gap(tokens.cap_gap)
                    .when(index > 0, |this| {
                        this.child(
                            div()
                                .text_size(profile.tokens.theme.text.counts)
                                .line_height(profile.tokens.theme.review.checkbox)
                                .text_color(profile.tokens.theme.colors.muted)
                                .child("or"),
                        )
                    })
                    .child(cap(label, profile))
            }),
        ))
}

fn cap(label: &'static str, profile: Profile) -> Div {
    let tokens = profile.keyboard;
    let theme = profile.tokens.theme;
    h_flex()
        .h(tokens.cap_height)
        .min_w(tokens.cap_height)
        .px(tokens.cap_padding)
        .flex_shrink_0()
        .justify_center()
        .border(theme.border.width)
        .border_color(profile.tokens.outline)
        .rounded(theme.radius.small)
        .bg(profile.tokens.editor)
        .text_size(theme.text.counts)
        .line_height(theme.review.checkbox)
        .font_weight(FontWeight::MEDIUM)
        .text_color(theme.colors.foreground)
        .child(label)
}

fn column_height(groups: &[data::KeyGroup], tokens: KeyboardTokens) -> Pixels {
    let rows: usize = groups.iter().map(|group| group.rows.len() + 1).sum();
    tokens.row_height * rows as f32 + tokens.group_gap * groups.len().saturating_sub(1) as f32
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui_kit::px;

    #[test]
    fn pane_border_names_keep_fill_and_select_the_pane() {
        for (name, pane) in [
            ("direction-v7-focus-border-files", KeyboardLayer::Files),
            ("direction-v7-focus-border-diff", KeyboardLayer::Diff),
            (
                "direction-v7-focus-border-comments",
                KeyboardLayer::Comments,
            ),
        ] {
            let look = FocusLook::from_name(name);
            assert_eq!(look, FocusLook::Border);
            assert_eq!(KeyboardLayer::from_name(name), pane);
            let mut profile = Profile::base(super::super::polish::Variant::Rule);
            profile.focus_look = look;
            profile.keyboard_layer = pane;
            assert!(profile.focused(pane));
        }
        assert_eq!(
            KeyboardLayer::from_name("direction-v7-keys"),
            KeyboardLayer::Keys
        );
        assert_eq!(
            KeyboardLayer::from_name("direction-v6-tree"),
            KeyboardLayer::None
        );
    }

    #[test]
    fn pane_border_bounds_include_scrollbars_but_exclude_dividers_and_toolbar() {
        let profile = Profile::base(super::super::polish::Variant::Rule);
        assert_eq!(profile.keyboard.pane_frame_width, px(2.0));
        let viewport = size(px(1280.0), px(800.0));
        for (pane, left, width) in [
            (KeyboardLayer::Files, 0.0, 259.0),
            (KeyboardLayer::Diff, 260.0, 720.0),
            (KeyboardLayer::Comments, 981.0, 299.0),
        ] {
            let expected = Bounds::new(point(px(left), px(32.0)), size(px(width), px(768.0)));
            assert_eq!(pane.pane_bounds(profile, viewport), Some(expected));
        }
        assert_eq!(KeyboardLayer::None.pane_bounds(profile, viewport), None);
        assert_eq!(KeyboardLayer::Keys.pane_bounds(profile, viewport), None);
    }

    #[test]
    fn selected_file_bar_is_neutral_only_when_another_pane_has_focus() {
        let profile = Profile::base(super::super::polish::Variant::Rule);
        let colors = profile.tokens.theme.colors;
        for (layer, color) in [
            (KeyboardLayer::Files, colors.accent),
            (KeyboardLayer::Diff, colors.border),
            (KeyboardLayer::Comments, colors.border),
            (KeyboardLayer::None, colors.accent),
            (KeyboardLayer::Keys, colors.accent),
        ] {
            assert_eq!(layer.selected_bar_color(profile), color, "{layer:?}");
        }
    }
}
