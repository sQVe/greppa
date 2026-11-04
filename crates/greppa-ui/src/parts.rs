//! Reusable greppa UI parts. Every size, color, and text size comes from [`crate::theme`].

use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::*;

use crate::theme::Theme;

/// The status of a changed file.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum FileStatus {
    /// A new file.
    Added,
    /// An edited file.
    Modified,
    /// A removed file.
    Deleted,
}

impl FileStatus {
    fn mark(self) -> &'static str {
        match self {
            FileStatus::Added => "A",
            FileStatus::Modified => "M",
            FileStatus::Deleted => "D",
        }
    }

    fn color(self, theme: &Theme) -> Rgba {
        match self {
            FileStatus::Added => theme.colors.added,
            FileStatus::Modified => theme.colors.modified,
            FileStatus::Deleted => theme.colors.deleted,
        }
    }
}

/// A row's vertical density.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RowSize {
    /// The default row.
    Medium,
    /// A slightly shorter row, with the same text.
    Small,
}

/// One changed file shown in a [`ChangedFilesPanel`].
#[derive(Clone)]
pub struct ChangedFileRow {
    /// The file path, or an empty string to hide it.
    pub label: String,
    /// The file's status.
    pub status: FileStatus,
    /// Added line count.
    pub added_lines: u32,
    /// Deleted line count.
    pub deleted_lines: u32,
    /// Whether the row draws as selected.
    pub selected: bool,
    /// The row's density.
    pub size: RowSize,
}

impl ChangedFileRow {
    /// A medium, unselected row with no line counts.
    pub fn new(label: impl Into<String>, status: FileStatus) -> Self {
        Self {
            label: label.into(),
            status,
            added_lines: 0,
            deleted_lines: 0,
            selected: false,
            size: RowSize::Medium,
        }
    }

    /// Sets the added and deleted line counts.
    pub fn lines(mut self, added_lines: u32, deleted_lines: u32) -> Self {
        self.added_lines = added_lines;
        self.deleted_lines = deleted_lines;
        self
    }

    /// Draws the row as selected.
    pub fn selected(mut self) -> Self {
        self.selected = true;
        self
    }

    /// Draws the row a little shorter, with the same text.
    pub fn small(mut self) -> Self {
        self.size = RowSize::Small;
        self
    }

    fn render(&self, theme: &Theme) -> Div {
        let height = match self.size {
            RowSize::Medium => theme.sizing.row_height,
            RowSize::Small => theme.sizing.row_height_small,
        };
        let background = if self.selected {
            theme.colors.selected
        } else {
            theme.colors.surface
        };
        let mut label = div()
            .flex_1()
            .min_w(theme.sizing.none)
            .text_size(theme.text.row)
            .text_color(theme.colors.foreground);

        if self.selected {
            label = label.font_weight(theme.text.selected_weight);
        }

        h_flex()
            .h(height)
            .w_full()
            .gap(theme.spacing.small)
            .px(theme.spacing.small)
            .rounded(theme.radius.small)
            .bg(background)
            .child(mark(self.status, theme))
            .child(label.child(self.label.clone()))
            .child(counts(self, theme))
    }
}

fn mark(status: FileStatus, theme: &Theme) -> Div {
    div()
        .text_size(theme.text.mark)
        .text_color(status.color(theme))
        .child(status.mark())
}

fn counts(row: &ChangedFileRow, theme: &Theme) -> Div {
    let mut counts = h_flex()
        .gap(theme.spacing.tiny)
        .text_size(theme.text.counts);

    if row.added_lines > 0 {
        counts = counts.child(
            div()
                .text_color(theme.colors.added)
                .child(format!("+{}", row.added_lines)),
        );
    }

    if row.deleted_lines > 0 {
        counts = counts.child(
            div()
                .text_color(theme.colors.deleted)
                .child(format!("-{}", row.deleted_lines)),
        );
    }

    counts
}

/// A panel listing changed files.
#[derive(Clone)]
pub struct ChangedFilesPanel {
    /// The section header, or `None` to draw no header.
    pub header: Option<String>,
    /// The rows, in draw order.
    pub rows: Vec<ChangedFileRow>,
}

impl ChangedFilesPanel {
    /// A panel with no header.
    pub fn new(rows: Vec<ChangedFileRow>) -> Self {
        Self { header: None, rows }
    }

    /// Adds the section header.
    pub fn header(mut self, header: impl Into<String>) -> Self {
        self.header = Some(header.into());
        self
    }

    /// Renders the panel. The panel fills its parent.
    pub fn render(&self, theme: &Theme) -> Div {
        let mut panel = v_flex()
            .size_full()
            .bg(theme.colors.surface)
            .border(theme.border.width)
            .border_color(theme.colors.border)
            .rounded(theme.radius.medium)
            .overflow_hidden();

        if let Some(header) = &self.header {
            panel = panel.child(section_header(header, theme));
        }

        let mut list = v_flex()
            .flex_1()
            .min_h(theme.sizing.none)
            .p(theme.spacing.small)
            .gap(theme.spacing.tiny);

        for row in &self.rows {
            list = list.child(row.render(theme));
        }

        panel.child(list)
    }
}

fn section_header(header: &str, theme: &Theme) -> Div {
    div()
        .px(theme.spacing.medium)
        .py(theme.spacing.small)
        .text_size(theme.text.section)
        .text_color(theme.colors.foreground)
        .child(header.to_string())
}
