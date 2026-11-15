use gpui_kit::{Bounds, Pixels, Rgba, point, px, size};

use super::super::{hairline, syntax::SyntaxPalette, tokens::DirectionTokens};
use super::polish::Variant;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct DesktopScene {
    pub variant: Variant,
    pub range_marking: super::precise::ranges::RangeMarking,
    pub keyboard_layer: super::keyboard::KeyboardLayer,
    pub focus_look: super::focus::FocusLook,
}

#[derive(Clone, Copy)]
pub(crate) struct Profile {
    pub tokens: DirectionTokens,
    pub variant: Variant,
    pub range_marking: super::precise::ranges::RangeMarking,
    pub keyboard_layer: super::keyboard::KeyboardLayer,
    pub keyboard: super::keyboard::tokens::KeyboardTokens,
    pub focus_look: super::focus::FocusLook,
    pub focus_tokens: super::focus::FocusTokens,
    pub file_text: Pixels,
    pub toolbar: Pixels,
    pub button: Pixels,
    pub finish: Pixels,
    pub header: Pixels,
    pub header_control_gap: Pixels,
    pub code_row: Pixels,
    pub number_padding: Pixels,
    pub indicator: Pixels,
    pub bar: Pixels,
    pub gutter: Pixels,
    pub files: Pixels,
    pub comments: Pixels,
    pub files_footer: Pixels,
    pub padding: Pixels,
    pub gap: Pixels,
    pub row_text: Pixels,
    pub thumb: Rgba,
}

impl Profile {
    pub(crate) fn for_scene(scene: DesktopScene) -> Self {
        Self {
            range_marking: scene.range_marking,
            keyboard_layer: scene.keyboard_layer,
            focus_look: scene.focus_look,
            ..Self::base(scene.variant)
        }
    }

    pub(crate) fn base(variant: Variant) -> Self {
        let mut tokens = hairline::tokens();
        tokens.syntax = SyntaxPalette::latte();
        tokens.theme.text.row = px(13.0);
        tokens.theme.review.line_height = px(16.0);
        Self {
            tokens,
            variant,
            range_marking: super::precise::ranges::RangeMarking::Dots,
            keyboard_layer: super::keyboard::KeyboardLayer::None,
            keyboard: super::keyboard::tokens::KeyboardTokens::new(),
            focus_look: super::focus::FocusLook::Subtle,
            focus_tokens: super::focus::FocusTokens::new(tokens),
            file_text: px(12.0),
            toolbar: px(32.0),
            button: px(22.0),
            finish: px(28.0),
            header: px(28.0),
            header_control_gap: px(14.0),
            code_row: px(18.0),
            number_padding: px(0.0),
            indicator: px(10.0),
            bar: px(2.0),
            gutter: px(56.4),
            files: px(260.0),
            comments: px(300.0),
            files_footer: px(28.0),
            padding: px(6.0),
            gap: px(4.0),
            row_text: px(13.0),
            thumb: tokens.outline,
        }
    }

    pub(crate) fn for_file(
        mut self,
        width: Option<Pixels>,
        file: &crate::review::ReviewFile,
    ) -> Self {
        let columns = if matches!(
            file.status,
            crate::parts::FileStatus::Added | crate::parts::FileStatus::Deleted
        ) {
            1
        } else {
            2
        };
        self.gutter = super::precise::code_column(width.unwrap_or(px(19.0)), columns);
        self
    }

    pub(crate) fn install(self, cx: &mut gpui_kit::App) {
        self.tokens.install(cx);
        gpui_kit::component::Theme::update(cx, |theme| {
            theme.foreground = self.tokens.theme.colors.foreground.into();
            theme.scrollbar_thumb = self.thumb.into();
            theme.scrollbar_thumb_hover = self.tokens.theme.colors.border.into();
            theme.popover = self.tokens.theme.colors.surface.into();
            theme.popover_foreground = self.tokens.theme.colors.foreground.into();
            theme.scrollbar_mode = gpui_kit::base::ScrollbarMode::Always;
        });
        use gpui_kit::base::{ScrollbarStyles, Theme};
        let styles = ScrollbarStyles::default()
            .track(|style| style.width(px(8.0)))
            .thumb(|style| style.width(px(3.0)).inset(px(2.0)).bg(self.thumb))
            .thumb_hover(|style| style.width(px(5.0)).bg(self.tokens.theme.colors.border))
            .thumb_active(|style| style.width(px(5.0)).bg(self.tokens.theme.colors.border));
        let theme = Theme::global_mut(cx);
        theme.scrollbar = theme.scrollbar.clone().with_styles(styles);
    }
}

pub(crate) fn bounds() -> Bounds<Pixels> {
    Bounds::new(point(px(0.0), px(0.0)), size(px(1280.0), px(800.0)))
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Panels {
    pub files: bool,
    pub comments: bool,
    pub diff_width: f32,
}

pub(crate) fn panels(width: f32, files: f32, comments: f32) -> Panels {
    let show_comments = width - files - comments >= 480.0;
    let show_files = width - files >= 480.0;
    let mut diff_width = width;
    if show_files {
        diff_width -= files;
    }
    if show_comments {
        diff_width -= comments;
    }
    Panels {
        files: show_files,
        comments: show_comments,
        diff_width,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resting_scrollbars_use_outline() {
        for variant in [Variant::Rule, Variant::Tree] {
            let profile = Profile::base(variant);
            assert_eq!(profile.thumb, profile.tokens.outline);
        }
    }

    #[test]
    fn panels_hide_comments_then_files_and_keep_the_diff_reservation() {
        let profile = Profile::base(Variant::Rule);
        for (width, files, comments) in [
            (1280.0, true, true),
            (960.0, true, false),
            (640.0, false, false),
        ] {
            let result = panels(width, profile.files.into(), profile.comments.into());
            assert_eq!((result.files, result.comments), (files, comments));
            assert!(result.diff_width >= 480.0);
        }
    }

    #[test]
    fn desktop_palette_keeps_all_published_latte_colors() {
        for ((name, actual), expected) in Profile::base(Variant::Rule)
            .tokens
            .syntax
            .colors()
            .into_iter()
            .zip([
                0x8839ef, 0x40a02b, 0xfe640b, 0xdf8e1d, 0x1e66f5, 0x179299, 0x8c8fa1, 0x4c4f69,
            ])
        {
            assert_eq!(u32::from(actual) >> 8, expected, "{name}");
        }
    }
}
