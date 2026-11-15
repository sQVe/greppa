mod comments;
mod files;
pub(crate) mod focus;
pub(crate) mod keyboard;
pub(crate) mod parts;
pub(crate) mod polish;
pub(crate) mod precise;
pub(crate) mod profile;
#[cfg(test)]
mod tests;

use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    Context, Div, InteractiveElement, IntoElement, MouseButton, ParentElement, Render,
    ScrollHandle, SharedString, Styled, Window, div, px,
};

use crate::review::{ReviewContent, ViewerOptions};
use crate::scenes::directions::data;
use crate::viewer::Viewer;
use profile::{DesktopScene, Panels, Profile};

#[derive(Clone, Copy, PartialEq)]
pub(super) enum Panel {
    Files,
    Comments,
}

pub(crate) struct Desktop {
    profile: Profile,
    content: ReviewContent,
    viewer: Viewer,
    code_font: SharedString,
    focus: &'static str,
    files_width: f32,
    comments_width: f32,
    files_requested: bool,
    comments_requested: bool,
    overlay: Option<Panel>,
    drag: Option<(Panel, f32, f32)>,
    files_scroll: ScrollHandle,
    comments_scroll: ScrollHandle,
    tree_mode: bool,
    collapsed_folders: std::collections::BTreeSet<String>,
    hovered_file: Option<&'static str>,
}

impl Desktop {
    pub(crate) fn new(scene: DesktopScene, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let variant = scene.variant;
        let profile = Profile::for_scene(scene);
        let mut content = data::content();
        polish::files::prepare(&mut content);
        precise::prepare(&mut content);
        let tree_fixture = variant == polish::Variant::Tree;
        let mut focus = data::FOCUS;
        if tree_fixture {
            precise::tree_content(&mut content);
            focus = precise::DRAFT.path;
        }
        let draft = if tree_fixture {
            Some(precise::DRAFT)
        } else {
            None
        };
        let options = ViewerOptions {
            draft,
            initial_path: focus,
            initial_line: Some(if tree_fixture { 12 } else { 13 }),
        };
        let viewer = Viewer::new(content.clone(), options, profile, window, cx);
        Self {
            profile,
            content,
            viewer,
            code_font: gpui_kit::component::Theme::global(cx)
                .mono_font_family
                .clone(),
            focus,
            files_width: profile.files.into(),
            comments_width: profile.comments.into(),
            files_requested: true,
            comments_requested: true,
            overlay: None,
            drag: None,
            files_scroll: ScrollHandle::new(),
            comments_scroll: ScrollHandle::new(),
            tree_mode: variant == polish::Variant::Tree,
            hovered_file: None,
            collapsed_folders: ["crates/greppa-core/tests".to_string()]
                .into_iter()
                .collect(),
        }
    }

    fn layout(&self, width: f32) -> Panels {
        let files = if self.files_requested {
            self.files_width
        } else {
            0.0
        };
        let comments = if self.comments_requested {
            self.comments_width
        } else {
            0.0
        };
        let mut layout = profile::panels(width, files, comments);
        layout.files &= self.files_requested;
        layout.comments &= self.comments_requested;
        layout
    }

    fn toggle(&mut self, panel: Panel, width: f32) {
        if self.overlay == Some(panel) {
            self.overlay = None;
            return;
        }
        let visible = self.layout(width);
        match panel {
            Panel::Files if visible.files => self.files_requested = false,
            Panel::Comments if visible.comments => self.comments_requested = false,
            Panel::Files => {
                self.files_requested = true;
                if !self.layout(width).files {
                    self.overlay = Some(panel);
                }
            }
            Panel::Comments => {
                self.comments_requested = true;
                if !self.layout(width).comments {
                    self.overlay = Some(panel);
                }
            }
        }
    }

    fn resize_handle(&self, panel: Panel, cx: &Context<Self>) -> Div {
        div()
            .absolute()
            .top(px(0.0))
            .bottom(px(0.0))
            .w(px(4.0))
            .cursor_col_resize()
            .when(panel == Panel::Files, |this| this.right(px(0.0)))
            .when(panel == Panel::Comments, |this| this.left(px(0.0)))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(move |this, event: &gpui_kit::MouseDownEvent, _, _| {
                    let width = if panel == Panel::Files {
                        this.files_width
                    } else {
                        this.comments_width
                    };
                    this.drag = Some((panel, event.position.x.into(), width));
                }),
            )
    }
}

impl Render for Desktop {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let width: f32 = window.viewport_size().width.into();
        let layout = self.layout(width);
        let profile = self.profile;
        let file = self
            .content
            .files
            .iter()
            .find(|file| file.path == self.focus)
            .expect("focused fixture");
        let header = self
            .viewer
            .file_header(file, profile, cx)
            .w(px(layout.diff_width - 8.0));
        let reader = v_flex()
            .h_full()
            .flex_1()
            .min_w(px(480.0))
            .min_h(px(0.0))
            .bg(profile.tokens.editor)
            .child(
                header
                    .border_b(px(1.0))
                    .border_color(profile.tokens.outline),
            )
            .child(
                div()
                    .flex_1()
                    .min_h(px(0.0))
                    .child(self.viewer.render(px(layout.diff_width))),
            );
        let body = h_flex()
            .relative()
            .items_stretch()
            .flex_1()
            .min_h(px(0.0))
            .when(layout.files, |this| {
                this.child(polish::files::pane(self, window, cx))
            })
            .child(reader)
            .when(layout.comments, |this| this.child(comments::pane(self, cx)))
            .when_some(self.overlay, |this, panel| {
                this.child(
                    div()
                        .absolute()
                        .top(px(0.0))
                        .bottom(px(0.0))
                        .when(panel == Panel::Files, |this| {
                            this.left(px(0.0))
                                .child(polish::files::pane(self, window, cx))
                        })
                        .when(panel == Panel::Comments, |this| {
                            this.right(px(0.0)).child(comments::pane(self, cx))
                        }),
                )
            });
        v_flex()
            .size_full()
            .overflow_hidden()
            .bg(profile.tokens.theme.colors.background)
            .text_color(profile.tokens.theme.colors.foreground)
            .text_size(profile.row_text)
            .child(polish::chrome::toolbar(self, layout, cx))
            .child(body)
            .when(
                profile.keyboard_layer != keyboard::KeyboardLayer::None,
                |this| {
                    this.relative()
                        .child(keyboard::layer(profile, window.viewport_size()))
                },
            )
            .on_mouse_move(
                cx.listener(|this, event: &gpui_kit::MouseMoveEvent, _, cx| {
                    if event.pressed_button != Some(MouseButton::Left) {
                        return;
                    }
                    if let Some((panel, start, original)) = this.drag {
                        let delta = f32::from(event.position.x) - start;
                        match panel {
                            Panel::Files => {
                                this.files_width = (original + delta).clamp(160.0, 360.0)
                            }
                            Panel::Comments => {
                                this.comments_width = (original - delta).clamp(280.0, 420.0)
                            }
                        }
                        cx.notify();
                    }
                }),
            )
            .on_mouse_up(
                MouseButton::Left,
                cx.listener(|this, _, _, _| this.drag = None),
            )
            .on_mouse_up_out(
                MouseButton::Left,
                cx.listener(|this, _, _, _| this.drag = None),
            )
    }
}
