use gpui_kit::assets::IconName;
use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::component::{
    Icon, Sizable,
    input::{Textarea, TextareaState},
};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Bounds, Div, ElementId, Entity, Focusable, ParentElement, Pixels, Styled, canvas, div, fill,
    point, px, size,
};

use super::super::{parts, polish::metrics::text_width, profile::Profile};
use crate::review::Comment;

pub(crate) fn inline(comment: &Comment, profile: Profile, width: Pixels) -> Div {
    let content = v_flex()
        .pl(px(10.0))
        .pr(px(11.0))
        .py(px(6.0))
        .gap(px(2.0))
        .text_size(profile.row_text)
        .line_height(px(16.0))
        .text_color(profile.tokens.theme.colors.foreground)
        .child(meta(comment, profile, false))
        .child(div().child(comment.body));
    band(content, profile, width)
}

pub(crate) fn editor(
    state: &Entity<TextareaState>,
    comment: &Comment,
    profile: Profile,
    width: Pixels,
) -> Div {
    let content = v_flex()
        .pl(px(10.0))
        .pr(px(11.0))
        .py(px(6.0))
        .gap(px(6.0))
        .text_size(profile.row_text)
        .line_height(px(16.0))
        .text_color(profile.tokens.theme.colors.foreground)
        .child(meta(comment, profile, true))
        .child(
            div()
                .relative()
                .border(px(1.0))
                .border_color(profile.tokens.theme.colors.accent)
                .bg(profile.tokens.editor)
                // XSmall adds 4 px horizontally; the wrapper completes the field's 6 px padding.
                .px(px(2.0))
                .py(px(6.0))
                .child(
                    Textarea::new(state)
                        .appearance(false)
                        .bordered(false)
                        .xsmall()
                        .h(px(32.0))
                        .text_size(profile.row_text)
                        .line_height(px(16.0)),
                )
                .child(draft_caret(state.clone(), profile)),
        )
        .child(
            h_flex()
                .h(px(22.0))
                .gap(px(6.0))
                .child(parts::button("Save", profile, false))
                .child(parts::button("Cancel", profile, false))
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(profile.tokens.theme.colors.muted)
                        .child("Not saved yet"),
                ),
        );
    band(content, profile, width)
}

pub(crate) fn marker(identifier: &ElementId, profile: Profile) -> Div {
    let range = identifier == &ElementId::from("comment-range");
    let continues = identifier == &ElementId::from("patch-range")
        || identifier == &ElementId::from("precise-draft");
    div()
        .relative()
        .w(px(8.0))
        .h(profile.code_row)
        .when(range, |this| {
            this.child(
                div()
                    .absolute()
                    .left(px(3.0))
                    .top(px(0.0))
                    .bottom(px(0.0))
                    .w(px(2.0))
                    .bg(profile.tokens.theme.colors.accent),
            )
        })
        .when(!range, |this| {
            this.child(
                div()
                    .absolute()
                    .left(px(1.0))
                    .top(px(6.0))
                    .size(px(6.0))
                    .rounded_full()
                    .bg(profile.tokens.theme.colors.accent),
            )
        })
        .when(continues, |this| {
            this.child(
                div()
                    .absolute()
                    .left(px(3.0))
                    .top(px(9.0))
                    .bottom(px(0.0))
                    .w(px(2.0))
                    .bg(profile.tokens.theme.colors.accent),
            )
        })
}

fn draft_caret(state: Entity<TextareaState>, profile: Profile) -> impl gpui_kit::IntoElement {
    canvas(
        |bounds, _, _| bounds,
        move |bounds, _, window, cx| {
            let state = state.read(cx);
            if state.focus_handle(cx).is_focused(window) {
                return;
            }
            // The staged draft keeps a steady end caret until the input receives real focus.
            let text = state.value();
            let offset = caret_offset(&text, |line| {
                text_width(line, profile.row_text, window.text_style().font(), window)
            });
            let caret = Bounds::new(bounds.origin + offset, size(px(1.0), px(16.0)));
            window.paint_quad(fill(caret, profile.tokens.theme.colors.foreground));
        },
    )
    .absolute()
    .left(px(0.0))
    .top(px(0.0))
    .size_full()
}

fn caret_offset(text: &str, width: impl Fn(&str) -> Pixels) -> gpui_kit::Point<Pixels> {
    let last_line = text
        .rsplit('\n')
        .next()
        .expect("text has a last line, even when empty");
    let last_row = text.bytes().filter(|byte| *byte == b'\n').count();
    point(
        px(6.0 + f32::from(width(last_line)).ceil()),
        px(6.0 + last_row as f32 * 16.0),
    )
}

fn meta(comment: &Comment, profile: Profile, editing: bool) -> Div {
    let mut label = parts::location(comment);
    if editing {
        label.push_str(" · editing");
    }
    h_flex()
        .h(px(14.0))
        .gap(px(4.0))
        .text_size(px(11.0))
        .line_height(px(14.0))
        .text_color(profile.tokens.theme.colors.muted)
        .child(
            div().relative().size(px(12.0)).flex_shrink_0().child(
                Icon::new(IconName::MessageCircle)
                    .size(px(12.0))
                    .absolute()
                    .left(px(0.0)),
            ),
        )
        .child(label)
}

fn band(content: Div, profile: Profile, width: Pixels) -> Div {
    div()
        .relative()
        .w(width)
        .bg(profile.tokens.note)
        .child(content.ml(profile.gutter - px(10.0)))
        .child(
            div()
                .absolute()
                .left(px(0.0))
                .right(px(0.0))
                .top(px(0.0))
                .h(px(1.0))
                .bg(profile.tokens.outline),
        )
        .child(
            div()
                .absolute()
                .left(px(0.0))
                .right(px(0.0))
                .bottom(px(0.0))
                .h(px(1.0))
                .bg(profile.tokens.outline),
        )
        .child(
            div()
                .absolute()
                .left(profile.gutter - px(10.0))
                .top(px(0.0))
                .bottom(px(0.0))
                .w(px(2.0))
                .bg(profile.tokens.theme.colors.accent),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn draft_caret_follows_the_last_line_without_changing_the_field_layout() {
        let offset = caret_offset("first\nlast", |line| {
            assert_eq!(line, "last");
            px(30.2)
        });
        assert_eq!(offset, point(px(37.0), px(22.0)));
        assert_eq!(caret_offset("", |_| px(0.0)), point(px(6.0), px(6.0)));
        assert_eq!(
            caret_offset("first\n", |_| px(0.0)),
            point(px(6.0), px(22.0))
        );
    }
}
