//! The single source of sizes, spacing, radii, text sizes, and colors for greppa's UI.
//!
//! Scenes and parts take every such value from here. No other file in `greppa-ui` may build a
//! length with `px`/`rems` or a color with `rgb`/`rgba`/`hsla`; the `cargo xtask check` raw-value
//! step enforces that.

use gpui_kit::{FontWeight, Pixels, Rgba, px, rgb};

/// Every value a scene or part may draw with.
#[derive(Clone, Copy)]
pub struct Theme {
    /// Named colors.
    pub colors: Colors,
    /// Gaps and padding.
    pub spacing: Spacing,
    /// Corner radii.
    pub radius: Radius,
    /// Text sizes.
    pub text: TextSizes,
    /// Border widths.
    pub border: Border,
    /// Fixed sizes that are not spacing.
    pub sizing: Sizing,
}

/// Named colors for the light theme.
#[derive(Clone, Copy)]
pub struct Colors {
    /// The window base color.
    pub background: Rgba,
    /// A raised surface such as the changed files panel.
    pub surface: Rgba,
    /// Primary text.
    pub foreground: Rgba,
    /// Secondary text such as line counts.
    pub muted: Rgba,
    /// Control and panel boundaries.
    pub border: Rgba,
    /// Focus and selection accent.
    pub accent: Rgba,
    /// A selected row's fill.
    pub selected: Rgba,
    /// Added files and added line counts.
    pub added: Rgba,
    /// Modified files.
    pub modified: Rgba,
    /// Deleted files and deleted line counts.
    pub deleted: Rgba,
}

/// Gaps and padding.
#[derive(Clone, Copy)]
pub struct Spacing {
    /// The smallest gap.
    pub tiny: Pixels,
    /// A small gap or padding.
    pub small: Pixels,
    /// A medium padding.
    pub medium: Pixels,
    /// A large padding.
    pub large: Pixels,
}

/// Corner radii.
#[derive(Clone, Copy)]
pub struct Radius {
    /// A small radius for rows.
    pub small: Pixels,
    /// A medium radius for panels.
    pub medium: Pixels,
}

/// Text sizes.
#[derive(Clone, Copy)]
pub struct TextSizes {
    /// A section header.
    pub section: Pixels,
    /// A file label in a medium row.
    pub row: Pixels,
    /// A file label in a small row.
    pub row_small: Pixels,
    /// A status mark next to a medium label.
    pub mark: Pixels,
    /// A status mark next to a small label.
    pub mark_small: Pixels,
    /// The selected row's label weight, so selection is not color alone.
    pub selected_weight: FontWeight,
    /// Line counts in a medium row.
    pub counts: Pixels,
    /// Line counts in a small row.
    pub counts_small: Pixels,
}

/// Border widths.
#[derive(Clone, Copy)]
pub struct Border {
    /// A hairline.
    pub width: Pixels,
}

/// Fixed sizes that are not spacing.
#[derive(Clone, Copy)]
pub struct Sizing {
    /// A medium row height.
    pub row_height: Pixels,
    /// A small row height.
    pub row_height_small: Pixels,
    /// No size, so a flex child may shrink.
    pub none: Pixels,
}

impl Theme {
    /// The light theme.
    pub fn light() -> Theme {
        Theme {
            colors: Colors {
                background: rgb(0xF4F4F5),
                surface: rgb(0xFFFFFF),
                foreground: rgb(0x18181B),
                muted: rgb(0x52525B),
                border: rgb(0x71717A),
                accent: rgb(0x1D4ED8),
                selected: rgb(0xDBEAFE),
                added: rgb(0x166534),
                modified: rgb(0x92400E),
                deleted: rgb(0xB91C1C),
            },
            spacing: Spacing {
                tiny: px(4.0),
                small: px(8.0),
                medium: px(12.0),
                large: px(16.0),
            },
            radius: Radius {
                small: px(6.0),
                medium: px(10.0),
            },
            text: TextSizes {
                section: px(14.0),
                row: px(13.0),
                row_small: px(11.0),
                mark: px(13.0),
                mark_small: px(11.0),
                selected_weight: FontWeight::SEMIBOLD,
                counts: px(12.0),
                counts_small: px(10.0),
            },
            border: Border { width: px(1.0) },
            sizing: Sizing {
                row_height: px(36.0),
                row_height_small: px(30.0),
                none: px(0.0),
            },
        }
    }
}

/// The theme every scene and part draws with.
pub fn theme() -> Theme {
    Theme::light()
}

/// Fixed scene geometry. The window is larger than the scene so a shot has context, and the scene
/// sits at a fixed origin so the crop is exactly the panel.
pub mod layout {
    use gpui_kit::{Pixels, Point, Size, point, px, size};

    /// The scene window's fixed size.
    pub const WINDOW_SIZE: Size<Pixels> = size(px(640.0), px(480.0));
    /// The scene window's fixed position.
    pub const WINDOW_ORIGIN: Point<Pixels> = point(px(0.0), px(0.0));
    /// The scene's top-left corner inside the window.
    pub const SCENE_ORIGIN: Point<Pixels> = point(px(60.0), px(60.0));
    /// The scene's fixed size, which the panel fills.
    pub const SCENE_SIZE: Size<Pixels> = size(px(420.0), px(300.0));
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    struct ContrastPair {
        text: &'static str,
        surface: &'static str,
        minimum: f32,
    }

    fn palette() -> Vec<(&'static str, Rgba)> {
        let colors = Theme::light().colors;

        vec![
            ("background", colors.background),
            ("surface", colors.surface),
            ("foreground", colors.foreground),
            ("muted", colors.muted),
            ("border", colors.border),
            ("accent", colors.accent),
            ("selected", colors.selected),
            ("added", colors.added),
            ("modified", colors.modified),
            ("deleted", colors.deleted),
        ]
    }

    fn pair(text: &'static str, surface: &'static str, minimum: f32) -> ContrastPair {
        ContrastPair {
            text,
            surface,
            minimum,
        }
    }

    fn pairs() -> Vec<ContrastPair> {
        let surfaces = ["background", "surface", "selected"];
        let text_tokens = [
            "foreground",
            "muted",
            "accent",
            "added",
            "modified",
            "deleted",
        ];
        let mut pairs = Vec::new();

        for surface in surfaces {
            for text in text_tokens {
                pairs.push(pair(text, surface, 4.5));
            }
        }

        for surface in surfaces {
            pairs.push(pair("border", surface, 3.0));
        }

        pairs
    }

    fn channels(color: Rgba) -> (f32, f32, f32) {
        let hex = u32::from(color);
        let red = ((hex >> 24) & 0xFF) as f32 / 255.0;
        let green = ((hex >> 16) & 0xFF) as f32 / 255.0;
        let blue = ((hex >> 8) & 0xFF) as f32 / 255.0;

        (red, green, blue)
    }

    fn linear(channel: f32) -> f32 {
        if channel <= 0.04045 {
            channel / 12.92
        } else {
            ((channel + 0.055) / 1.055).powf(2.4)
        }
    }

    fn luminance(color: Rgba) -> f32 {
        let (red, green, blue) = channels(color);

        0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }

    fn contrast_ratio(first: Rgba, second: Rgba) -> f32 {
        let first = luminance(first);
        let second = luminance(second);
        let lighter = first.max(second);
        let darker = first.min(second);

        (lighter + 0.05) / (darker + 0.05)
    }

    fn lookup(palette: &[(&'static str, Rgba)], name: &str) -> Rgba {
        palette
            .iter()
            .find(|(token, _)| *token == name)
            .map(|(_, value)| *value)
            .unwrap_or_else(|| panic!("the palette has no {name}"))
    }

    fn result(pair: &ContrastPair, palette: &[(&'static str, Rgba)]) -> (bool, String) {
        let ratio = contrast_ratio(lookup(palette, pair.text), lookup(palette, pair.surface));
        let line = format!(
            "{} on {}: {:.2}:1, needs {}:1",
            pair.text, pair.surface, ratio, pair.minimum
        );

        (ratio >= pair.minimum, line)
    }

    fn failures(palette: &[(&'static str, Rgba)]) -> Vec<String> {
        pairs()
            .iter()
            .map(|pair| result(pair, palette))
            .filter(|(passed, _)| !passed)
            .map(|(_, line)| line)
            .collect()
    }

    fn expected(known: &[&str], palette: &[(&'static str, Rgba)]) -> Vec<String> {
        let checked = pairs();

        known
            .iter()
            .map(|key| {
                let found = checked
                    .iter()
                    .find(|pair| format!("{} on {}", pair.text, pair.surface) == *key);

                let found =
                    found.unwrap_or_else(|| panic!("the known failure {key} is not a pair"));

                result(found, palette).1
            })
            .collect()
    }

    fn known_failures() -> &'static [&'static str] {
        &[]
    }

    #[test]
    fn contrast_check_names_both_tokens_and_the_ratio() {
        let palette = [("foreground", rgb(0x888888)), ("surface", rgb(0xFFFFFF))];
        let checked = pair("foreground", "surface", 4.5);

        let (passed, line) = result(&checked, &palette);

        assert!(!passed);
        assert_eq!(line, "foreground on surface: 3.54:1, needs 4.5:1");
    }

    #[test]
    fn theme_fails_contrast_only_for_the_known_failures() {
        assert_eq!(failures(&palette()), expected(known_failures(), &palette()));
    }

    #[test]
    fn a_new_failing_pair_is_reported() {
        let mut broken = palette();
        broken[2] = ("foreground", rgb(0xDDDDDD));

        let reported = failures(&broken);

        assert!(
            reported
                .iter()
                .any(|line| line.starts_with("foreground on background:"))
        );
        assert_ne!(reported, expected(&[], &broken));
    }

    #[test]
    fn a_listed_pair_that_starts_to_pass_is_reported() {
        assert_ne!(
            failures(&palette()),
            expected(&["foreground on surface"], &palette())
        );
    }

    #[test]
    fn every_pair_names_its_text_and_surface_once() {
        let keys: Vec<String> = pairs()
            .iter()
            .map(|pair| format!("{} on {}", pair.text, pair.surface))
            .collect();
        let unique: HashSet<&String> = keys.iter().collect();

        assert_eq!(unique.len(), keys.len());
    }

    #[test]
    fn every_pair_uses_a_named_color() {
        let names: HashSet<&str> = palette().into_iter().map(|(name, _)| name).collect();

        for checked in pairs() {
            assert!(
                names.contains(checked.text),
                "{} is not a color token",
                checked.text
            );
            assert!(
                names.contains(checked.surface),
                "{} is not a color token",
                checked.surface
            );
        }
    }

    #[test]
    fn palette_has_no_duplicate_names() {
        let names: Vec<&str> = palette().into_iter().map(|(name, _)| name).collect();
        let unique: HashSet<&str> = names.iter().copied().collect();

        assert_eq!(unique.len(), names.len());
    }

    #[test]
    fn the_theme_is_light() {
        assert!(
            luminance(lookup(&palette(), "background"))
                > luminance(lookup(&palette(), "foreground"))
        );
    }
}
