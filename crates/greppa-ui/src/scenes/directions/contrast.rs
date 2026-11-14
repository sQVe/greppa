use super::desktop::{polish::Variant, profile::Profile};
use crate::theme::contrast::contrast_ratio;

#[test]
fn selected_comment_rows_keep_number_and_plain_code_contrast() {
    let profile = Profile::base(Variant::Rule);
    let colors = profile.tokens.theme.colors;
    for (name, foreground) in [
        ("muted line numbers", colors.muted),
        ("plain code", colors.foreground),
    ] {
        let ratio = contrast_ratio(foreground, colors.selected);
        assert!(ratio >= 4.5, "{name} on selected: {ratio:.4} < 4.5");
    }
}

#[test]
fn hairline_meets_text_and_control_contrast_on_rendered_surfaces() {
    let tokens = Profile::base(Variant::Rule).tokens;
    let colors = tokens.theme.colors;
    for (surface_name, surface) in [
        ("frame", colors.background),
        ("pane", colors.surface),
        ("editor", tokens.editor),
        ("selected", colors.selected),
        ("header", tokens.header),
        ("note", tokens.note),
        ("added", tokens.added),
        ("removed", tokens.removed),
    ] {
        for (name, ink) in [
            ("text", colors.foreground),
            ("muted", colors.muted),
            ("link", colors.accent),
        ] {
            let ratio = contrast_ratio(ink, surface);
            assert!(ratio >= 4.5, "{name} on {surface_name}: {ratio:.4} < 4.5");
        }
        for (name, ink) in [
            ("control", colors.border),
            ("added mark", colors.added),
            ("modified mark", colors.modified),
            ("deleted mark", colors.deleted),
        ] {
            let ratio = contrast_ratio(ink, surface);
            assert!(ratio >= 3.0, "{name} on {surface_name}: {ratio:.4} < 3.0");
        }
    }
    assert!(contrast_ratio(tokens.button_text, tokens.button) >= 4.5);
    assert!(contrast_ratio(tokens.note_edge, tokens.note) >= 3.0);
    for surface in tokens.code_surfaces() {
        assert!(contrast_ratio(colors.foreground, surface) >= 4.5);
    }
    for surface in tokens.line_surfaces() {
        assert!(contrast_ratio(colors.muted, surface) >= 4.5);
    }
}
