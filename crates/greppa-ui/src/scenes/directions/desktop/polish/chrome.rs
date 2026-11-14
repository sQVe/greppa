use gpui_kit::assets::IconName;
use gpui_kit::base::h_flex;
use gpui_kit::component::{Icon, tooltip::Tooltip};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Context, Div, InteractiveElement, ParentElement, StatefulInteractiveElement, Styled, div, px,
};

use super::super::{
    Desktop, Panel, parts,
    profile::{Panels, Profile},
};
use crate::scenes::directions::data;

pub(crate) fn toolbar(scene: &Desktop, layout: Panels, cx: &Context<Desktop>) -> Div {
    let profile = scene.profile;
    h_flex()
        .h(profile.toolbar)
        .flex_shrink_0()
        .border_color(profile.tokens.outline)
        .relative()
        .border_b(px(0.0))
        .child(
            div()
                .absolute()
                .left(px(0.0))
                .right(px(0.0))
                .bottom(px(0.0))
                .h(px(1.0))
                .bg(profile.tokens.outline),
        )
        .px(px(8.0))
        .gap(px(14.0))
        .child(range_selector(profile))
        .child(title(profile))
        .child(progress(scene))
        .child(toggles(scene, layout, cx))
        .child(
            parts::button("Finish review", profile, true)
                .h(profile.finish)
                .px(px(10.0)),
        )
}

fn range_selector(profile: Profile) -> Div {
    h_flex()
        .h(profile.button)
        .flex_shrink_0()
        .px(px(6.0))
        .gap(px(6.0))
        .rounded(px(3.0))
        .border(px(1.0))
        .border_color(profile.tokens.theme.colors.border)
        .bg(profile.tokens.theme.colors.surface)
        .text_size(profile.row_text)
        .line_height(px(16.0))
        .child("main..HEAD")
        .child(Icon::new(IconName::ChevronDown).size(px(12.0)))
}

fn title(profile: Profile) -> Div {
    h_flex()
        .flex_1()
        .min_w(px(0.0))
        .items_baseline()
        .gap(px(6.0))
        .whitespace_nowrap()
        .child(
            div()
                .min_w(px(0.0))
                .overflow_hidden()
                .text_ellipsis()
                .text_size(profile.row_text)
                .line_height(px(16.0))
                .child("Add the Git reader to greppa-core"),
        )
        .child(
            div()
                .flex_shrink_0()
                .text_size(profile.row_text)
                .line_height(px(16.0))
                .text_color(profile.tokens.theme.colors.muted)
                .child("4 commits · 16 files"),
        )
}

fn toggles(scene: &Desktop, layout: Panels, cx: &Context<Desktop>) -> Div {
    h_flex()
        .flex_shrink_0()
        .gap(px(6.0))
        .border(px(1.0))
        .border_color(scene.profile.tokens.theme.colors.border)
        .rounded(px(3.0))
        .child(toggle(Panel::Files, scene, layout, cx))
        .child(toggle(Panel::Comments, scene, layout, cx))
}

fn toggle(
    panel: Panel,
    scene: &Desktop,
    layout: Panels,
    cx: &Context<Desktop>,
) -> impl gpui_kit::IntoElement {
    let colors = scene.profile.tokens.theme.colors;
    let (identifier, icon, label, visible) = match panel {
        Panel::Files => ("chrome-files", IconName::PanelLeft, "Files", layout.files),
        Panel::Comments => (
            "chrome-comments",
            IconName::PanelRight,
            "Comments",
            layout.comments,
        ),
    };
    let active = visible || scene.overlay == Some(panel);
    h_flex()
        .id(identifier)
        .w(px(24.0))
        .h(px(22.0))
        .justify_center()
        .cursor_pointer()
        .text_color(colors.muted)
        .when(active, |this| {
            this.bg(colors.selected).text_color(colors.accent)
        })
        .hover(|this| this.text_color(colors.accent))
        .tooltip(move |window, cx| Tooltip::new(label).build(window, cx))
        .on_click(cx.listener(move |this, _, window, cx| {
            this.toggle(panel, window.viewport_size().width.into());
            cx.notify();
        }))
        .child(Icon::new(icon).size(px(14.0)))
}

fn progress(scene: &Desktop) -> Div {
    let colors = scene.profile.tokens.theme.colors;
    let (viewed, total) = data::progress(&scene.content.files);
    let generated = scene.content.files.len() - total;
    let tooltip = progress_tooltip(viewed, total, generated);
    h_flex()
        .child(
            div()
                .id("viewed-progress-tooltip")
                .absolute()
                .size_full()
                .tooltip(move |window, cx| Tooltip::new(tooltip.clone()).build(window, cx)),
        )
        .relative()
        .flex_shrink_0()
        .gap(px(6.0))
        .text_size(scene.profile.row_text)
        .line_height(px(16.0))
        .text_color(colors.muted)
        .child(format!("{viewed} of {total} viewed"))
        .child(
            div()
                .w(px(40.0))
                .h(px(3.0))
                .bg(scene.profile.tokens.outline)
                .child(
                    div()
                        .w(gpui_kit::relative(viewed as f32 / total as f32))
                        .h_full()
                        .bg(colors.accent),
                ),
        )
}

fn progress_tooltip(viewed: usize, total: usize, generated: usize) -> String {
    format!("{viewed} of {total} files viewed. {generated} generated file is not counted.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_tooltip_explains_the_generated_file_exclusion() {
        let content = data::content();
        let (viewed, total) = data::progress(&content.files);
        assert_eq!(
            progress_tooltip(viewed, total, content.files.len() - total),
            "5 of 15 files viewed. 1 generated file is not counted."
        );
    }
}
