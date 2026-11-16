use gpui_kit::assets::IconName;
use gpui_kit::base::h_flex;
use gpui_kit::component::{Icon, tooltip::Tooltip};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Context, Div, FontWeight, InteractiveElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, Window, div, px,
};

use super::super::{Desktop, polish::metrics};
use crate::{
    parts::FileStatus,
    review::{FileKind, ReviewFile},
};

pub(crate) fn row(
    file: &ReviewFile,
    depth: usize,
    scene: &Desktop,
    window: &Window,
    cx: &Context<Desktop>,
) -> Div {
    let profile = scene.profile;
    let colors = profile.tokens.theme.colors;
    let inset = 8.0 + depth as f32 * 12.0;
    let prefix = if scene.tree_mode { 34.0 } else { 14.0 };
    let counts = super::super::files::change_label(file);
    let own_counts = counts_text_width(&counts, window);
    let column = super::layout::counts_column_width(scene.content.files.iter().map(|file| {
        let text = super::super::files::change_label(file);
        (
            file.kind != FileKind::Generated,
            counts_text_width(&text, window),
        )
    }));
    let eligible = file.kind != FileKind::Generated;
    let hovered = scene.hovered_file == Some(file.path);
    let viewed_or_hovered = file.viewed || hovered;
    let tick_visible = eligible && viewed_or_hovered;
    let label_end =
        super::layout::label_end(scene.files_width - 9.0, own_counts, column, tick_visible);
    let available = label_end - inset - prefix - 6.0;
    let path = file.path;
    let tooltip = super::labels::tooltip(path, file.previous_path);
    div()
        .relative()
        .h(px(24.0))
        .flex_shrink_0()
        .when(path == scene.focus, |this| {
            this.bg(colors.selected).when(
                profile.focused(super::super::keyboard::KeyboardLayer::Files),
                |this| this.bg(profile.focus_tokens.focus_fill_surface),
            )
        })
        .child(
            h_flex()
                .id(SharedString::from(path))
                .group("precise-file-row")
                .relative()
                .h(px(24.0))
                .w_full()
                .pl(px(inset))
                .pr(px(8.0))
                .whitespace_nowrap()
                .text_size(profile.file_text)
                .line_height(px(16.0))
                .text_color(colors.foreground)
                .cursor_pointer()
                .hover(|this| this.bg(profile.tokens.editor))
                .tooltip(move |window, cx| Tooltip::new(tooltip.clone()).build(window, cx))
                .on_hover(cx.listener(move |this, hovered, _, cx| {
                    this.hovered_file = hovered_file(this.hovered_file, path, *hovered);
                    cx.notify();
                }))
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.focus = path;
                    this.viewer.scroll_to_file(path, cx);
                    this.overlay = None;
                    cx.notify();
                }))
                .when(scene.tree_mode, |this| {
                    this.child(div().w(px(20.0)).flex_shrink_0())
                })
                .child(
                    Icon::new(status_icon(file.status))
                        .size(px(14.0))
                        .flex_shrink_0()
                        .text_color(file.status.color(&profile.tokens.theme)),
                )
                .child(label(file, available, scene, window).ml(px(6.0)))
                .when(tick_visible, |this| {
                    this.child(
                        h_flex()
                            .absolute()
                            .right(px(8.0 + column))
                            .h(px(24.0))
                            .child(tick(file, profile)),
                    )
                })
                .child(
                    h_flex()
                        .absolute()
                        .right(px(8.0))
                        .h(px(24.0))
                        .w(px(own_counts))
                        .justify_end()
                        .text_right()
                        .text_size(px(11.0))
                        .text_color(colors.muted)
                        .child(div().w_full().text_right().child(counts)),
                ),
        )
        .when(path == scene.focus, |this| {
            this.child(
                div()
                    .absolute()
                    .left(px(0.0))
                    .top(px(0.0))
                    .bottom(px(0.0))
                    .w(px(2.0))
                    .bg(profile.keyboard_layer.selected_bar_color(profile)),
            )
        })
}

fn hovered_file(
    current: Option<&'static str>,
    path: &'static str,
    hovered: bool,
) -> Option<&'static str> {
    if hovered {
        Some(path)
    } else {
        current.filter(|current| *current != path)
    }
}

fn counts_text_width(text: &str, window: &Window) -> f32 {
    f32::from(metrics::text_width(
        text,
        px(11.0),
        window.text_style().font(),
        window,
    ))
    .ceil()
}

fn label(file: &ReviewFile, available: f32, scene: &Desktop, window: &Window) -> Div {
    let profile = scene.profile;
    let width = |text: &str| {
        f32::from(metrics::text_width(
            text,
            profile.file_text,
            window.text_style().font(),
            window,
        ))
        .ceil()
    };
    let (folder, name) = file.path.rsplit_once('/').unwrap_or(("", file.path));
    let folder = if scene.tree_mode { "" } else { folder };
    let selected = file.path == scene.focus;
    let mut name_font = window.text_style().font();
    if selected {
        name_font.weight = FontWeight::MEDIUM;
    }
    let full_name_width = f32::from(metrics::text_width(
        name,
        profile.file_text,
        name_font,
        window,
    ))
    .ceil();
    let name_width = full_name_width.min(available.max(0.0));
    let mut extras =
        super::labels::extras(file.previous_path, folder, available - name_width, width);
    let needs_disambiguation =
        !scene.tree_mode && extras.folder.is_empty() && file.previous_path.is_none();
    if needs_disambiguation {
        let paths: Vec<_> = scene.content.files.iter().map(|file| file.path).collect();
        if let Some(parent) = super::labels::distinct_parent(file.path, &paths)
            && width(parent) + 2.0 <= available - name_width
        {
            extras.folder = parent.to_string();
        }
    }
    h_flex()
        .w(px(available.max(0.0)))
        .flex_shrink_0()
        .min_w(px(0.0))
        .gap(px(2.0))
        .overflow_hidden()
        .child(
            div()
                .w(px(name_width))
                .flex_shrink_0()
                .overflow_hidden()
                .text_ellipsis()
                .text_color(profile.tokens.theme.colors.foreground)
                .when(selected, |this| this.font_weight(FontWeight::MEDIUM))
                .child(name),
        )
        .when_some(extras.old_name, |this, old| {
            this.child(
                div()
                    .flex_shrink_0()
                    .text_color(profile.tokens.theme.colors.muted)
                    .child(old),
            )
        })
        .when(!extras.folder.is_empty(), |this| {
            this.child(
                div()
                    .flex_shrink_0()
                    .text_color(profile.tokens.theme.colors.muted)
                    .child(extras.folder),
            )
        })
        .when(file.kind == FileKind::Generated, |this| {
            this.child(
                Icon::new(IconName::Cog)
                    .size(px(14.0))
                    .text_color(profile.tokens.theme.colors.muted),
            )
        })
}

#[cfg(test)]
fn parent_label(folder: &str, fits: impl Fn(&str) -> bool) -> String {
    metrics::folder_suffix(folder, fits)
}

fn tick(file: &ReviewFile, profile: super::super::profile::Profile) -> Div {
    h_flex().w(px(16.0)).flex_shrink_0().justify_center().child(
        h_flex()
            .id(SharedString::from(format!("viewed-tick:{}", file.path)))
            .size(px(14.0))
            .cursor_pointer()
            .tooltip(|window, cx| Tooltip::new("Mark as viewed").build(window, cx))
            .text_color(profile.tokens.theme.colors.muted)
            .child(Icon::new(IconName::Check).size(px(14.0))),
    )
}

pub(crate) fn status_icon(status: FileStatus) -> IconName {
    match status {
        FileStatus::Added => IconName::Plus,
        FileStatus::Modified => IconName::Pencil,
        FileStatus::Deleted => IconName::Minus,
        FileStatus::Renamed => IconName::ArrowRightLeft,
        FileStatus::Binary => IconName::Binary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaving_one_row_does_not_clear_another_rows_hover_budget() {
        assert_eq!(hovered_file(None, "a.rs", true), Some("a.rs"));
        assert_eq!(hovered_file(Some("a.rs"), "b.rs", true), Some("b.rs"));
        assert_eq!(hovered_file(Some("b.rs"), "a.rs", false), Some("b.rs"));
        assert_eq!(hovered_file(Some("b.rs"), "b.rs", false), None);
    }

    #[test]
    fn folder_hints_drop_when_a_whole_path_segment_does_not_fit() {
        for (folder, expected) in [("", ""), ("crates/greppa-core", ""), ("src", "")] {
            assert_eq!(parent_label(folder, |_| false), expected);
        }
        assert_eq!(
            parent_label("crates/greppa-core/src", |value| value.chars().count() <= 5),
            "…/src"
        );
        assert_eq!(
            parent_label("crates/greppa-core", |value| value.chars().count() <= 13),
            "…/greppa-core"
        );
        assert_eq!(
            parent_label("assets/application-icons", |value| value.chars().count()
                <= 7),
            ""
        );
        assert_eq!(
            parent_label("日本/東京都", |value| value.chars().count() <= 2),
            ""
        );
    }
}
