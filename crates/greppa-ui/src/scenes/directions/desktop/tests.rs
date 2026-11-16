use super::profile::Profile;
use crate::theme::contrast::contrast_ratio;

#[test]
#[expect(
    clippy::print_stdout,
    reason = "The direction report records the measured contrast minima."
)]
fn desktop_ui_and_plain_code_keep_contrast_without_recoloring_syntax() {
    for variant in [super::polish::Variant::Rule, super::polish::Variant::Tree] {
        let profile = Profile::base(variant);
        let tokens = profile.tokens;
        let colors = tokens.theme.colors;
        let surfaces = [
            colors.background,
            colors.surface,
            tokens.editor,
            colors.selected,
            tokens.header,
            tokens.note,
        ];
        let mut text = f32::MAX;
        let mut plain = f32::MAX;
        let mut controls = f32::MAX;
        for surface in surfaces {
            for ink in [
                colors.foreground,
                colors.muted,
                colors.accent,
                colors.added,
                colors.modified,
                colors.deleted,
            ] {
                let ratio = contrast_ratio(ink, surface);
                assert!(ratio >= 4.5, "UI text {ratio}");
                text = text.min(ratio);
            }
            for mark in [colors.border, colors.added, colors.modified, colors.deleted] {
                let ratio = contrast_ratio(mark, surface);
                assert!(ratio >= 3.0, "control {ratio}");
                controls = controls.min(ratio);
            }
        }
        assert!(contrast_ratio(tokens.button_text, tokens.button) >= 4.5);
        assert!(contrast_ratio(tokens.note_edge, tokens.note) >= 3.0);
        for surface in tokens.code_surfaces() {
            let ratio = contrast_ratio(colors.foreground, surface);
            assert!(ratio >= 4.5, "plain code {ratio}");
            plain = plain.min(ratio);
        }
        for surface in tokens.line_surfaces() {
            assert!(contrast_ratio(colors.muted, surface) >= 4.5);
            for mark in [colors.added, colors.deleted] {
                assert!(contrast_ratio(mark, surface) >= 3.0);
            }
        }
        println!("{variant:?}: UI text {text:.4}, plain code {plain:.4}, controls {controls:.4}");
    }
}
