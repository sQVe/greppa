use gpui_kit::base::{Scrollbar, ScrollbarMode, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Context, Div, FontWeight, InteractiveElement, ParentElement, StatefulInteractiveElement,
    Styled, div, px,
};

use super::{Desktop, Panel, keyboard::KeyboardLayer, parts};
use crate::review::Comment;
#[cfg(test)]
use crate::scenes::directions::data;

pub(super) fn pane(scene: &Desktop, cx: &Context<Desktop>) -> Div {
    let profile = scene.profile;
    let colors = profile.tokens.theme.colors;
    let mut cards = v_flex().p(profile.padding).gap(profile.padding);
    let comments = ordered_comments(&scene.content.comments);
    let mut group = None;
    for comment in comments {
        if group != Some(comment.path) {
            cards = cards.child(
                div()
                    .text_size(px(11.0))
                    .text_color(colors.muted)
                    .child(comment.path),
            );
            group = Some(comment.path);
        }
        let jump = scene.viewer.on_comment_click(*comment);
        let path = comment.path;
        cards = cards.child(
            parts::card(comment, profile, scene.code_font.clone())
                .id(comment.id)
                .cursor_pointer()
                .on_click(cx.listener(move |this, event, window, cx| {
                    this.focus = path;
                    this.overlay = None;
                    jump(event, window, cx);
                    cx.notify();
                })),
        );
    }
    v_flex()
        .relative()
        .w(px(scene.comments_width))
        .h_full()
        .flex_shrink_0()
        .min_h(px(0.0))
        .border_l(px(1.0))
        .border_color(profile.tokens.outline)
        .bg(colors.surface)
        .child(
            h_flex()
                .h(profile.header)
                .flex_shrink_0()
                .px(profile.padding)
                .justify_between()
                .border_b(px(1.0))
                .border_color(profile.tokens.outline)
                .when(profile.focused(KeyboardLayer::Comments), |this| {
                    this.bg(profile.focus_tokens.focus_header)
                })
                .child(
                    div()
                        .font_weight(FontWeight::MEDIUM)
                        .when(profile.focused(KeyboardLayer::Comments), |this| {
                            this.text_color(colors.accent)
                        })
                        .child("Comments"),
                )
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(colors.muted)
                        .child(format!("{} unsent", scene.content.comments.len())),
                ),
        )
        .child(
            div()
                .relative()
                .flex_1()
                .min_h(px(0.0))
                .child(
                    div()
                        .id("desktop-comment-scroll")
                        .size_full()
                        .overflow_y_scroll()
                        .track_scroll(&scene.comments_scroll)
                        .child(cards),
                )
                .child(Scrollbar::vertical(&scene.comments_scroll).mode(ScrollbarMode::Always)),
        )
        .child(scene.resize_handle(Panel::Comments, cx))
}

fn ordered_comments(comments: &[Comment]) -> Vec<&Comment> {
    let mut ordered: Vec<_> = comments.iter().collect();
    ordered.sort_by_key(|comment| (comment.path, comment.start, comment.end));
    ordered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panel_groups_use_comment_paths_and_source_line_order() {
        let content = data::content();
        let ordered = ordered_comments(&content.comments);
        assert_eq!(
            ordered
                .iter()
                .map(|comment| comment.start)
                .collect::<Vec<_>>(),
            [23, 26, 32]
        );
        let mut tree = content;
        super::super::precise::tree_content(&mut tree);
        let ordered = ordered_comments(&tree.comments);
        assert_eq!(ordered[0].path, "crates/greppa-core/src/line_range.rs");
        assert_eq!(ordered[0].start, 13);
    }
}
