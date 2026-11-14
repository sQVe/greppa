use gpui_kit::Rgba;

use super::{keyboard::KeyboardLayer, profile::Profile};
use crate::scenes::directions::data;
use crate::scenes::directions::tokens::{DirectionTokens, blend};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FocusLook {
    Subtle,
    Border,
}

impl FocusLook {
    pub(crate) fn from_name(name: &str) -> Self {
        if name.starts_with("direction-v7-focus-border-") {
            return Self::Border;
        }
        Self::Subtle
    }
}

#[derive(Clone, Copy)]
pub(crate) struct FocusTokens {
    pub focus_header: Rgba,
    pub focus_fill_surface: Rgba,
    pub focus_fill_editor: Rgba,
}

impl FocusTokens {
    pub(crate) fn new(tokens: DirectionTokens) -> Self {
        let accent = tokens.theme.colors.accent;
        Self {
            focus_header: blend(accent, tokens.header, 0.10),
            focus_fill_surface: blend(accent, tokens.theme.colors.surface, 0.20),
            focus_fill_editor: blend(accent, tokens.editor, 0.20),
        }
    }
}

impl Profile {
    pub(crate) fn focused(self, pane: KeyboardLayer) -> bool {
        self.focus_look != FocusLook::Subtle && self.keyboard_layer == pane
    }

    pub(crate) fn code_focus_fill(self) -> Option<(&'static str, usize, Rgba)> {
        self.focused(KeyboardLayer::Diff).then_some((
            data::FOCUS,
            28,
            self.focus_tokens.focus_fill_editor,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scenes::directions::desktop::polish::Variant;
    use crate::theme::contrast::contrast_ratio;

    #[test]
    fn border_names_select_stronger_focus() {
        for (name, expected) in [
            ("direction-v7-focus-border-files", FocusLook::Border),
            ("direction-v7-focus-border-diff", FocusLook::Border),
            ("direction-v7-focus-border-comments", FocusLook::Border),
            ("direction-v7-keys", FocusLook::Subtle),
            ("direction-v5-range-gutter", FocusLook::Subtle),
        ] {
            assert_eq!(FocusLook::from_name(name), expected, "{name}");
        }
    }

    #[test]
    #[expect(
        clippy::print_stdout,
        reason = "The report records the focus contrast ratios."
    )]
    fn focus_surfaces_keep_text_contrast_and_remain_darker_than_selection() {
        let profile = Profile::base(Variant::Rule);
        let colors = profile.tokens.theme.colors;
        let tokens = profile.focus_tokens;
        assert_eq!(profile.tokens.header, colors.surface);
        for (name, foreground, background) in [
            ("accent/header", colors.accent, tokens.focus_header),
            ("foreground/header", colors.foreground, tokens.focus_header),
            ("muted/header", colors.muted, tokens.focus_header),
            (
                "foreground/fill surface",
                colors.foreground,
                tokens.focus_fill_surface,
            ),
            (
                "muted/fill surface",
                colors.muted,
                tokens.focus_fill_surface,
            ),
            (
                "foreground/fill editor",
                colors.foreground,
                tokens.focus_fill_editor,
            ),
            ("muted/fill editor", colors.muted, tokens.focus_fill_editor),
        ] {
            let ratio = contrast_ratio(foreground, background);
            println!("{name}: {ratio:.4}:1");
            assert!(ratio >= 4.5, "{name}: {ratio:.4} < 4.5");
        }
        for fill in [tokens.focus_fill_surface, tokens.focus_fill_editor] {
            assert!(fill.r < colors.selected.r);
            assert!(fill.g < colors.selected.g);
            assert!(fill.b < colors.selected.b);
        }
    }

    #[test]
    fn code_fill_targets_only_line_twenty_eight_in_the_focused_diff_pane() {
        let mut profile = Profile::base(Variant::Rule);
        for look in [FocusLook::Subtle, FocusLook::Border] {
            profile.focus_look = look;
            for pane in [
                KeyboardLayer::None,
                KeyboardLayer::Files,
                KeyboardLayer::Diff,
                KeyboardLayer::Comments,
                KeyboardLayer::Keys,
            ] {
                profile.keyboard_layer = pane;
                let expected = if look != FocusLook::Subtle && pane == KeyboardLayer::Diff {
                    Some((data::FOCUS, 28, profile.focus_tokens.focus_fill_editor))
                } else {
                    None
                };
                assert_eq!(profile.code_focus_fill(), expected);
            }
        }
    }
}
