use gpui_kit::base::{h_flex, v_flex};
use gpui_kit::*;

use crate::theme::Theme;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum FileStatus {
    Added,
    Modified,
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

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RowSize {
    Medium,
    Small,
}

#[derive(Clone)]
pub struct ChangedFileRow {
    pub label: String,
    pub status: FileStatus,
    pub added_lines: u32,
    pub deleted_lines: u32,
    pub selected: bool,
    pub size: RowSize,
}

impl ChangedFileRow {
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

    pub fn lines(mut self, added_lines: u32, deleted_lines: u32) -> Self {
        self.added_lines = added_lines;
        self.deleted_lines = deleted_lines;
        self
    }

    pub fn selected(mut self) -> Self {
        self.selected = true;
        self
    }

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

#[derive(Clone)]
pub struct ChangedFilesPanel {
    pub header: Option<String>,
    pub rows: Vec<ChangedFileRow>,
}

impl ChangedFilesPanel {
    pub fn new(rows: Vec<ChangedFileRow>) -> Self {
        Self { header: None, rows }
    }

    pub fn header(mut self, header: impl Into<String>) -> Self {
        self.header = Some(header.into());
        self
    }

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
