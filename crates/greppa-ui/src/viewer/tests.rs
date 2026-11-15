use super::*;
use crate::scenes::directions::data::{FOCUS, content, tree_content};
use crate::scenes::directions::desktop::{polish::Variant, precise::DRAFT};
use crate::theme::Theme;

#[test]
fn optional_density_preserves_defaults_and_applies_explicit_geometry() {
    let theme = Theme::light();
    let sizes = theme.review;
    let defaults = DiffDensity::default();
    assert_eq!(defaults.resolved_row_height(sizes.code), sizes.code * 1.6);
    let compact = DiffDensity {
        row_height: Some(theme.review.line_height),
        number_padding: Some(theme.sizing.none),
        ..defaults
    };
    assert_eq!(compact.resolved_row_height(sizes.code), sizes.line_height);
    let number_width = |digits| compact.resolved_number_width(sizes.code, sizes.rem, digits);
    assert_eq!(number_width(2), sizes.code * 1.4);
    assert!(number_width(3) > number_width(2));
    let pixel = DiffDensity {
        whole_pixel_numbers: true,
        ..compact
    };
    for (digits, expected) in [(2, 19.0), (3, 28.0), (4, 37.0)] {
        assert_eq!(
            f32::from(pixel.resolved_number_width(sizes.code, sizes.rem, digits)),
            expected
        );
    }
    assert!(!defaults.omit_empty_number_columns);
    assert_eq!(defaults.marker_gap, None);
    assert_eq!(defaults.annotation_border, None);
    assert_eq!(defaults.source_offset, None);
    assert_eq!(defaults.scrollbar_gutter, None);
    assert!(!defaults.custom_header_shell);
}

#[test]
fn direction_tints_cover_added_and_deleted_files_without_tinting_modified_context() {
    let content = content();
    let tokens = Profile::base(Variant::Rule).tokens;
    let decorations = direction_decorations(&content.files, tokens);

    assert_eq!(decorations.len(), 7);
    let reader = decorations
        .iter()
        .find(|decoration| decoration.range().path().as_str() == FOCUS)
        .expect("added reader tint");
    assert_eq!(reader.range().start(), 1);
    assert_eq!(reader.range().end(), 62);
    assert_eq!(reader.background(), Some(tokens.added.into()));
    assert!(!decorations.iter().any(
        |decoration| decoration.range().path().as_str() == "crates/greppa-ui/src/parts.rs"
    ));
}

#[test]
fn decorations_cover_the_whole_row_unless_scoped_to_the_gutter() {
    let whole_row = DiffDecoration::new(range(&DRAFT));

    assert!(!whole_row.is_gutter_only());
    assert!(whole_row.gutter_only().is_gutter_only());
}

#[test]
fn comment_ranges_mark_only_the_gutter_with_the_selected_color() {
    let tokens = Profile::base(Variant::Rule).tokens;
    let decoration = gutter_range(&DRAFT, tokens);

    assert!(decoration.is_gutter_only());
    assert_eq!(decoration.range(), &range(&DRAFT));
    assert_eq!(
        decoration.background(),
        Some(tokens.theme.colors.selected.into())
    );
}

#[test]
fn real_viewer_parses_reference_files_with_matching_counts() {
    for content in [content(), tree_content()] {
        assert_eq!(content.files.len(), 16);
        for file in &content.files {
            let documents = DiffFile::parse(&file.patch).expect("valid greppa fixture patch");
            assert_documents_match(&documents, std::slice::from_ref(file));
        }
    }
}

fn assert_documents_match(documents: &[DiffFile], files: &[ReviewFile]) {
    assert_eq!(documents.len(), files.len());
    for (document, file) in documents.iter().zip(files) {
        assert_eq!(document.path().as_str(), file.path);
        assert_eq!(
            (document.additions(), document.deletions()),
            file.counts(),
            "{}",
            file.path
        );
        assert_eq!(
            document.is_binary(),
            matches!(file.kind, FileKind::Binary { .. })
        );
    }
}

#[test]
fn annotations_anchor_below_the_last_selected_line_and_markers_at_the_first() {
    let content = content();
    for comment in content.comments.iter().chain([&DRAFT]) {
        let annotation = annotation(comment);
        let position = annotation.position().expect("a line annotation");
        let marker = marker(comment);

        assert_eq!(position.path().as_str(), comment.path);
        assert_eq!(position.side(), DiffSide::Modified);
        assert_eq!(position.line(), comment.end);
        assert_eq!(marker.position().line(), comment.start);
    }
}
