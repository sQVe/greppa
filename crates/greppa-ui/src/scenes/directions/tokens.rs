use gpui_kit::{Rgba, px};

use crate::theme::Theme;

#[derive(Clone, Copy)]
pub(crate) struct DirectionTokens {
    pub theme: Theme,
    pub editor: Rgba,
    pub outline: Rgba,
    pub header: Rgba,
    pub note: Rgba,
    pub note_edge: Rgba,
    pub button: Rgba,
    pub button_text: Rgba,
    pub added: Rgba,
    pub removed: Rgba,
    pub word: Rgba,
    pub syntax: super::syntax::SyntaxPalette,
}

impl DirectionTokens {
    pub(crate) fn install(&self, cx: &mut gpui_kit::App) {
        let theme = &self.theme;
        gpui_kit::component::Theme::update(cx, |component| {
            component.background = self.editor.into();
            component.foreground = self.syntax.text.into();
            component.muted = theme.colors.surface.into();
            component.muted_foreground = theme.colors.muted.into();
            component.border = self.outline.into();
            component.input = theme.colors.border.into();
            component.ring = theme.colors.accent.into();
            component.caret = theme.colors.foreground.into();
            component.primary = self.button.into();
            component.primary_foreground = self.button_text.into();
            component.selection = theme.colors.selected.into();
            component.list_hover = theme.colors.selected.into();
            component.success = theme.colors.added.into();
            component.danger = theme.colors.deleted.into();
            component.scrollbar_thumb = theme.colors.border.into();
            component.scrollbar_thumb_hover = theme.colors.foreground.into();
            component.radius = theme.radius.small;
            component.radius_lg = theme.radius.medium;
            component.mono_font_size = theme.review.code;
            component.font_size = theme.review.rem;
        });
    }

    pub(super) fn prepare(mut self) -> Self {
        self.theme.review.checkbox = px(14.0);
        self.theme.review.code = px(13.0);
        self.theme.review.rem = px(16.0);
        self.theme.spacing.tiny = px(4.0);
        self.theme.spacing.small = px(8.0);
        self.theme.spacing.medium = px(12.0);
        self.theme.spacing.large = px(16.0);
        self
    }

    #[cfg(test)]
    pub(super) fn line_surfaces(&self) -> Vec<Rgba> {
        let colors = self.theme.colors;
        vec![
            self.editor,
            self.added,
            self.removed,
            colors.selected,
            self.changed_background(colors.added),
            self.changed_background(colors.deleted),
        ]
    }

    #[cfg(test)]
    fn changed_background(&self, foreground: Rgba) -> Rgba {
        blend(foreground, self.editor, 0.12)
    }

    #[cfg(test)]
    pub(crate) fn code_surfaces(&self) -> Vec<Rgba> {
        let colors = self.theme.colors;
        let native_added = self.changed_background(colors.added);
        let native_removed = self.changed_background(colors.deleted);
        vec![
            self.editor,
            self.added,
            self.removed,
            self.word,
            colors.selected,
            native_added,
            native_removed,
            blend(colors.added, native_added, 0.3),
            blend(colors.deleted, native_removed, 0.3),
        ]
    }
}

pub(super) fn blend(foreground: Rgba, background: Rgba, opacity: f32) -> Rgba {
    Rgba {
        r: foreground.r * opacity + background.r * (1.0 - opacity),
        g: foreground.g * opacity + background.g * (1.0 - opacity),
        b: foreground.b * opacity + background.b * (1.0 - opacity),
        a: 1.0,
    }
}
