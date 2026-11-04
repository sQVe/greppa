//! The changed files panel scenes, built on the panel and row parts with fake data.

use gpui_kit::Div;

use crate::parts::{ChangedFileRow, ChangedFilesPanel, FileStatus};
use crate::scenes::SceneName;
use crate::theme::Theme;

/// The row that draws a little shorter in the small-row scene.
const SMALL_ROW_INDEX: usize = 2;

/// The quality a smoke scene is designed to show.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Variant {
    MissingHeader,
    Clean,
    BlankLabels,
    SmallRow,
}

impl Variant {
    fn shows_header(&self) -> bool {
        !matches!(self, Variant::MissingHeader)
    }

    fn selects_first_row(&self) -> bool {
        !matches!(self, Variant::MissingHeader)
    }

    fn blank_labels(&self) -> bool {
        matches!(self, Variant::BlankLabels)
    }

    fn small_row_index(&self) -> Option<usize> {
        matches!(self, Variant::SmallRow).then_some(SMALL_ROW_INDEX)
    }
}

fn variant(name: SceneName) -> Variant {
    match name {
        SceneName::Smoke1 => Variant::MissingHeader,
        SceneName::Smoke2 => Variant::Clean,
        SceneName::Smoke3 => Variant::BlankLabels,
        SceneName::Smoke4 => Variant::SmallRow,
    }
}

pub(super) fn render(name: SceneName, theme: &Theme) -> Div {
    let variant = variant(name);
    let mut panel = ChangedFilesPanel::new(rows(&variant));

    if variant.shows_header() {
        panel = panel.header("Changed files");
    }

    panel.render(theme)
}

fn rows(variant: &Variant) -> Vec<ChangedFileRow> {
    let files = [
        ("src/main.rs", FileStatus::Added, 42, 0),
        ("crates/greppa-ui/src/lib.rs", FileStatus::Modified, 12, 5),
        ("docs/development.md", FileStatus::Deleted, 0, 18),
        ("crates/greppa-core/src/lib.rs", FileStatus::Modified, 3, 1),
    ];

    files
        .iter()
        .enumerate()
        .map(|(index, (label, status, added_lines, deleted_lines))| {
            let label = if variant.blank_labels() {
                String::new()
            } else {
                (*label).to_string()
            };

            let mut row = ChangedFileRow::new(label, *status).lines(*added_lines, *deleted_lines);

            if variant.selects_first_row() && index == 0 {
                row = row.selected();
            }

            if variant.small_row_index() == Some(index) {
                row = row.small();
            }

            row
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parts::RowSize;

    #[test]
    fn smoke_one_hides_the_header_and_the_selection() {
        let variant = variant(SceneName::Smoke1);

        assert!(!variant.shows_header());
        assert!(!variant.selects_first_row());
        assert!(!variant.blank_labels());
        assert_eq!(variant.small_row_index(), None);
    }

    #[test]
    fn smoke_two_is_clean() {
        let variant = variant(SceneName::Smoke2);

        assert!(variant.shows_header());
        assert!(variant.selects_first_row());
        assert!(!variant.blank_labels());
        assert_eq!(variant.small_row_index(), None);
    }

    #[test]
    fn smoke_three_blanks_every_label() {
        let variant = variant(SceneName::Smoke3);
        let rows = rows(&variant);

        assert!(variant.shows_header());
        assert!(variant.blank_labels());
        assert!(rows.iter().all(|row| row.label.is_empty()));
    }

    #[test]
    fn smoke_four_smallens_only_one_row() {
        let variant = variant(SceneName::Smoke4);
        let rows = rows(&variant);

        assert!(variant.shows_header());
        assert!(variant.selects_first_row());
        assert_eq!(variant.small_row_index(), Some(SMALL_ROW_INDEX));
        assert!(
            rows.iter()
                .enumerate()
                .all(|(index, row)| { (row.size == RowSize::Small) == (index == SMALL_ROW_INDEX) })
        );
    }

    #[test]
    fn smoke_two_selects_only_the_first_row_and_keeps_labels() {
        let rows = rows(&variant(SceneName::Smoke2));

        assert!(rows.iter().all(|row| !row.label.is_empty()));
        assert!(
            rows.iter().enumerate().all(|(index, row)| {
                row.selected == (index == 0) && row.size == RowSize::Medium
            })
        );
    }
}
