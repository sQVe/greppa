use gpui_kit::{FontWeight, Pixels, Rgba, px, rgb};

#[derive(Clone, Copy)]
pub struct Theme {
    pub colors: Colors,
    pub spacing: Spacing,
    pub radius: Radius,
    pub text: TextSizes,
    pub border: Border,
    pub sizing: Sizing,
}

#[derive(Clone, Copy)]
pub struct Colors {
    pub background: Rgba,
    pub surface: Rgba,
    pub foreground: Rgba,
    pub muted: Rgba,
    pub border: Rgba,
    pub accent: Rgba,
    pub selected: Rgba,
    pub added: Rgba,
    pub modified: Rgba,
    pub deleted: Rgba,
}

#[derive(Clone, Copy)]
pub struct Spacing {
    pub tiny: Pixels,
    pub small: Pixels,
    pub medium: Pixels,
    pub large: Pixels,
}

#[derive(Clone, Copy)]
pub struct Radius {
    pub small: Pixels,
    pub medium: Pixels,
}

#[derive(Clone, Copy)]
pub struct TextSizes {
    pub section: Pixels,
    pub row: Pixels,
    pub mark: Pixels,
    /// The selected row's label weight, so selection is not color alone.
    pub selected_weight: FontWeight,
    pub counts: Pixels,
}

#[derive(Clone, Copy)]
pub struct Border {
    pub width: Pixels,
}

#[derive(Clone, Copy)]
pub struct Sizing {
    pub row_height: Pixels,
    pub row_height_small: Pixels,
    /// No size, so a flex child may shrink.
    pub none: Pixels,
}

impl Theme {
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
                mark: px(13.0),
                selected_weight: FontWeight::SEMIBOLD,
                counts: px(12.0),
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

pub fn theme() -> Theme {
    Theme::light()
}

/// Fixed scene geometry. The window is larger than the scene so a shot has context, and the scene
/// sits at a fixed origin so the crop is exactly the panel.
pub mod layout {
    use gpui_kit::{Pixels, Point, Size, point, px, size};

    pub const WINDOW_SIZE: Size<Pixels> = size(px(640.0), px(480.0));
    pub const WINDOW_ORIGIN: Point<Pixels> = point(px(0.0), px(0.0));
    pub const SCENE_ORIGIN: Point<Pixels> = point(px(60.0), px(60.0));
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

    #[derive(Debug, PartialEq)]
    struct ContrastCheck {
        text: &'static str,
        surface: &'static str,
        ratio: f32,
        minimum: f32,
    }

    impl ContrastCheck {
        fn passed(&self) -> bool {
            self.ratio >= self.minimum
        }
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

    fn check(pair: &ContrastPair, palette: &[(&'static str, Rgba)]) -> ContrastCheck {
        let ratio = contrast_ratio(lookup(palette, pair.text), lookup(palette, pair.surface));

        ContrastCheck {
            text: pair.text,
            surface: pair.surface,
            ratio,
            minimum: pair.minimum,
        }
    }

    fn failures(palette: &[(&'static str, Rgba)]) -> Vec<ContrastCheck> {
        pairs()
            .iter()
            .map(|pair| check(pair, palette))
            .filter(|checked| !checked.passed())
            .collect()
    }

    fn expected(
        known: &[(&'static str, &'static str)],
        palette: &[(&'static str, Rgba)],
    ) -> Vec<ContrastCheck> {
        let checked = pairs();

        known
            .iter()
            .map(|(text, surface)| {
                let found = checked
                    .iter()
                    .find(|pair| pair.text == *text && pair.surface == *surface)
                    .unwrap_or_else(|| {
                        panic!("the known failure {text} on {surface} is not a pair")
                    });

                check(found, palette)
            })
            .collect()
    }

    fn known_failures() -> &'static [(&'static str, &'static str)] {
        &[]
    }

    #[test]
    fn contrast_check_computes_the_ratio_and_fails_below_the_minimum() {
        let palette = [("foreground", rgb(0x888888)), ("surface", rgb(0xFFFFFF))];
        let checked = check(&pair("foreground", "surface", 4.5), &palette);

        assert!((checked.ratio - 3.54).abs() < 0.01);
        assert!(!checked.passed(), "{checked:?} should fail");
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
                .any(|checked| checked.text == "foreground" && checked.surface == "background"),
            "the new failing foreground on background pair is not reported"
        );
        assert_ne!(reported, expected(&[], &broken));
    }

    #[test]
    fn a_listed_pair_that_starts_to_pass_is_reported() {
        assert_ne!(
            failures(&palette()),
            expected(&[("foreground", "surface")], &palette())
        );
    }

    #[test]
    fn expected_selects_the_pair_named_by_a_known_failure() {
        let checks = expected(&[("foreground", "surface")], &palette());

        assert_eq!(checks.len(), 1);
        assert_eq!(checks[0].text, "foreground");
        assert_eq!(checks[0].surface, "surface");
        assert_eq!(checks[0].minimum, 4.5);
    }

    #[test]
    fn every_pair_names_its_text_and_surface_once() {
        let keys: Vec<(&str, &str)> = pairs()
            .iter()
            .map(|pair| (pair.text, pair.surface))
            .collect();
        let unique: HashSet<(&str, &str)> = keys.iter().copied().collect();

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
