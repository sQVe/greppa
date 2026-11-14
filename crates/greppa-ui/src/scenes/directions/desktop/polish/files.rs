use gpui_kit::assets::IconName;
use gpui_kit::base::{Scrollbar, h_flex, v_flex};
use gpui_kit::component::{Icon, tooltip::Tooltip};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Context, Div, FontWeight, InteractiveElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, Window, div, px,
};

use super::super::precise::files as file_row;
use super::super::{Desktop, Panel};
use super::{metrics, tree};
use crate::review::ReviewContent;
use crate::scenes::directions::data;

pub(super) const ROW: f32 = 24.0;
pub(super) const GAP: f32 = 4.0;

pub(crate) fn prepare(content: &mut ReviewContent) {
    for (old, new) in [
        (
            "assets/greppa-icon.png",
            "assets/branding/application-icons/greppa-icon.png",
        ),
        (
            "docs/development.md",
            "docs/guides/review-workflows/development.md",
        ),
    ] {
        let file = content
            .files
            .iter_mut()
            .find(|file| file.path == old)
            .expect("the shared fixture contains both path examples");
        file.path = new;
        file.patch = file.patch.replace(old, new);
    }
}

pub(crate) fn pane(scene: &Desktop, window: &Window, cx: &Context<Desktop>) -> Div {
    let profile = scene.profile;
    let colors = profile.tokens.theme.colors;
    v_flex()
        .relative()
        .w(px(scene.files_width))
        .h_full()
        .flex_shrink_0()
        .min_h(px(0.0))
        .border_r(px(1.0))
        .border_color(profile.tokens.outline)
        .bg(colors.surface)
        .child(header(scene, cx))
        .child(
            div()
                .relative()
                .flex_1()
                .min_h(px(0.0))
                .child(
                    div()
                        .id("polish-file-scroll")
                        .size_full()
                        .overflow_y_scroll()
                        .track_scroll(&scene.files_scroll)
                        .child(rows(scene, window, cx)),
                )
                .child(Scrollbar::vertical(&scene.files_scroll)),
        )
        .child(super::super::files::footer(scene))
        .child(scene.resize_handle(Panel::Files, cx))
}

fn header(scene: &Desktop, cx: &Context<Desktop>) -> Div {
    let profile = scene.profile;
    h_flex()
        .h(profile.header)
        .flex_shrink_0()
        .px(px(8.0))
        .gap(px(GAP))
        .border_b(px(1.0))
        .border_color(profile.tokens.outline)
        .when(
            profile.focused(super::super::keyboard::KeyboardLayer::Files),
            |this| this.bg(profile.focus_tokens.focus_header),
        )
        .child(
            div()
                .font_weight(FontWeight::MEDIUM)
                .when(
                    profile.focused(super::super::keyboard::KeyboardLayer::Files),
                    |this| this.text_color(profile.tokens.theme.colors.accent),
                )
                .child("Files"),
        )
        .child(
            div()
                .text_size(px(11.0))
                .text_color(profile.tokens.theme.colors.muted)
                .child("16 changed"),
        )
        .child(div().flex_1())
        .child(
            h_flex()
                .gap(px(2.0))
                .border(px(1.0))
                .border_color(profile.tokens.theme.colors.border)
                .rounded(px(3.0))
                .child(mode(false, scene, cx))
                .child(mode(true, scene, cx)),
        )
}

fn mode(tree: bool, scene: &Desktop, cx: &Context<Desktop>) -> impl gpui_kit::IntoElement {
    let colors = scene.profile.tokens.theme.colors;
    let icon = if tree {
        IconName::ListTree
    } else {
        IconName::List
    };
    let label = if tree { "Folder tree" } else { "Review queue" };
    h_flex()
        .id(if tree { "mode-tree" } else { "mode-list" })
        .size(px(20.0))
        .justify_center()
        .rounded(px(3.0))
        .cursor_pointer()
        .text_color(colors.muted)
        .when(scene.tree_mode == tree, |this| {
            this.bg(colors.selected).text_color(colors.accent)
        })
        .hover(|this| this.bg(colors.selected))
        .tooltip(move |window, cx| Tooltip::new(label).build(window, cx))
        .on_click(cx.listener(move |this, _, _, cx| {
            this.tree_mode = tree;
            this.files_scroll
                .set_offset(gpui_kit::point(px(0.0), px(0.0)));
            cx.notify();
        }))
        .child(Icon::new(icon).size(px(14.0)))
}

fn rows(scene: &Desktop, window: &Window, cx: &Context<Desktop>) -> Div {
    let mut rows = v_flex().w_full();
    if scene.tree_mode {
        let fits = |label: &str, depth, (viewed, total)| {
            let fraction = format!("{viewed}/{total}");
            let counts = fraction_width(&fraction, window);
            let inset = 8.0 + depth as f32 * 12.0;
            let available = px(precise_folder_width(scene.files_width, inset, counts));
            metrics::text_width(
                label,
                scene.profile.file_text,
                window.text_style().font(),
                window,
            ) <= available
        };
        for entry in tree::rows(&scene.content.files, &scene.collapsed_folders, fits) {
            rows = rows.child(match entry {
                tree::Entry::File { index, depth } => {
                    file_row::row(&scene.content.files[index], depth, scene, window, cx)
                }
                tree::Entry::Folder(folder) => folder_row(scene, folder, window, cx),
            });
        }
    } else {
        for (label, files) in data::groups(&scene.content.files) {
            let label = if label.starts_with("Generated") {
                "Generated"
            } else {
                label
            };
            let heading = if label == "Generated" {
                format!("Generated · {} · not counted", files.len())
            } else {
                format!("{label} · {}", files.len())
            };
            rows = rows.child(
                h_flex()
                    .h(px(ROW))
                    .px(px(8.0))
                    .text_size(px(11.0))
                    .text_color(scene.profile.tokens.theme.colors.muted)
                    .child(heading),
            );
            for file in files {
                rows = rows.child(file_row::row(file, 0, scene, window, cx));
            }
        }
    }
    rows
}

fn folder_row(
    scene: &Desktop,
    folder: tree::FolderRow,
    window: &Window,
    cx: &Context<Desktop>,
) -> Div {
    let profile = scene.profile;
    let colors = profile.tokens.theme.colors;
    let fraction = format!("{}/{}", folder.viewed, folder.total);
    let counts = fraction_width(&fraction, window);
    let inset = 8.0 + folder.depth as f32 * 12.0;
    let label = folder.label;
    let tooltip = folder.path.clone();
    let path = folder.path.clone();
    div().child(
        h_flex()
            .id(SharedString::from(folder.path))
            .h(px(ROW))
            .pl(px(inset))
            .pr(px(8.0))
            .gap(px(6.0))
            .text_size(profile.file_text)
            .text_color(colors.muted)
            .whitespace_nowrap()
            .cursor_pointer()
            .hover(|this| this.bg(profile.tokens.editor))
            .tooltip(move |window, cx| Tooltip::new(tooltip.clone()).build(window, cx))
            .on_click(cx.listener(move |this, _, _, cx| {
                if !this.collapsed_folders.remove(&path) {
                    this.collapsed_folders.insert(path.clone());
                }
                cx.notify();
            }))
            .child(
                h_flex().w(px(14.0)).justify_center().child(
                    Icon::new(if folder.collapsed {
                        IconName::ChevronRight
                    } else {
                        IconName::ChevronDown
                    })
                    .size(px(14.0)),
                ),
            )
            .child(
                Icon::new(if folder.collapsed {
                    IconName::Folder
                } else {
                    IconName::FolderOpen
                })
                .size(px(14.0)),
            )
            .child(
                div()
                    .flex_1()
                    .min_w(px(0.0))
                    .overflow_hidden()
                    .mr(px(2.0))
                    .text_ellipsis()
                    .child(label),
            )
            .child(
                div()
                    .w(px(counts))
                    .flex_shrink_0()
                    .text_right()
                    .text_size(px(11.0))
                    .child(fraction),
            ),
    )
}

fn fraction_width(fraction: &str, window: &Window) -> f32 {
    f32::from(metrics::text_width(
        fraction,
        px(11.0),
        window.text_style().font(),
        window,
    ))
    .ceil()
}

fn precise_folder_width(pane_width: f32, inset: f32, counts_width: f32) -> f32 {
    pane_width - 1.0 - inset - 8.0 - counts_width - 40.0 - 8.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn precise_folders_use_their_own_fraction_width_and_keep_eight_pixels_clear() {
        assert_eq!(precise_folder_width(260.0, 8.0, 18.0), 177.0);
        assert_eq!(precise_folder_width(260.0, 20.0, 18.0), 165.0);
        assert_eq!(precise_folder_width(260.0, 8.0, 24.0), 171.0);
        assert_eq!(precise_folder_width(268.0, 8.0, 18.0), 185.0);
    }

    #[test]
    fn long_path_examples_preserve_filenames_counts_and_the_open_diff() {
        let mut content = data::content();
        let original = content.clone();
        prepare(&mut content);
        assert_eq!(content.files.len(), original.files.len());
        for (file, original) in content.files.iter().zip(&original.files) {
            assert_eq!(file.counts(), original.counts());
            assert_eq!(
                file.path.rsplit('/').next(),
                original.path.rsplit('/').next()
            );
            if file.path == data::FOCUS {
                assert_eq!(file.patch, original.patch);
            }
        }
        let rows = tree::rows(&content.files, &Default::default(), |_, _, _| true);
        for expected in [
            "assets/branding/application-icons",
            "docs/guides/review-workflows",
        ] {
            assert!(rows.iter().any(
                |entry| matches!(entry, tree::Entry::Folder(tree::FolderRow { label, .. }) if label == expected)
            ));
        }
    }
}
