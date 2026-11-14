use gpui_kit::component::diff::{
    Diff, DiffAnnotation, DiffChangeIndicator, DiffDecoration, DiffDensity, DiffFile,
    DiffGutterMarker, DiffHunkSeparator, DiffLinePosition, DiffLineRange, DiffMode, DiffSide,
    DiffState,
};
use gpui_kit::component::input::TextareaState;
use gpui_kit::{
    App, AppContext, ClickEvent, Div, ElementId, Entity, ParentElement, Pixels, SharedString,
    Styled, Window, div,
};

use crate::parts::FileStatus;
use crate::parts::review::{annotation_frame, file_notice};
use crate::review::{Comment, FileKind, ReviewContent, ReviewFile, ViewerOptions, ordered_files};
use crate::scenes::directions::desktop::{
    parts as desktop_parts,
    precise::{self, ranges},
    profile::Profile,
};
use crate::scenes::directions::{syntax, tokens::DirectionTokens};

pub(crate) struct Viewer {
    state: Entity<DiffState>,
    content: ReviewContent,
    options: ViewerOptions,
    editor: Entity<TextareaState>,
    profile: Profile,
}

impl Viewer {
    pub(crate) fn new(
        content: ReviewContent,
        options: ViewerOptions,
        profile: Profile,
        window: &mut Window,
        cx: &mut App,
    ) -> Self {
        let documents = documents(&content.files);
        let state = cx.new(|cx| DiffState::new(documents, cx).with_mode(DiffMode::Unified));
        state.update(cx, |state, cx| {
            for file in &content.files {
                if file.viewed || file.collapsed {
                    state.set_file_collapsed(file.path, true, cx);
                }
            }
            if let Some(draft) = options.draft {
                state.set_selected_lines(Some(range(&draft)), cx);
            }
            state.scroll_to_file(options.initial_path, cx);
            if let Some(line) = options.initial_line {
                state.scroll_to_line(
                    DiffLinePosition::new(options.initial_path, DiffSide::Modified, line),
                    cx,
                );
            }
            let tokens = profile.tokens;
            state.set_syntax_highlighter(
                move |language, source| {
                    syntax::highlight(language, source, tokens.syntax, tokens.word)
                },
                cx,
            );
        });
        let draft_text = options.draft.map(|draft| draft.body).unwrap_or("");
        let editor = cx.new(|cx| TextareaState::new(window, cx).default_value(draft_text));
        profile.install(cx);
        if profile.variant == crate::scenes::directions::desktop::polish::Variant::Tree {
            state.update(cx, |state, cx| {
                state.scroll_to_line(
                    DiffLinePosition::new(precise::DRAFT.path, DiffSide::Original, 12),
                    cx,
                )
            });
        }
        Self {
            state,
            content,
            options,
            editor,
            profile,
        }
    }

    pub(crate) fn scroll_to_file(&self, path: &'static str, cx: &mut App) {
        self.state
            .update(cx, |state, cx| state.scroll_to_file(path, cx));
    }

    pub(crate) fn on_comment_click(
        &self,
        comment: Comment,
    ) -> impl Fn(&ClickEvent, &mut Window, &mut App) + 'static {
        let state = self.state.clone();
        move |_, _, cx| {
            state.update(cx, |state, cx| {
                state.scroll_to_line(
                    DiffLinePosition::new(comment.path, DiffSide::Modified, comment.start),
                    cx,
                );
                state.set_selected_lines(Some(range(&comment)), cx);
            });
        }
    }

    pub(crate) fn file_header(&self, file: &ReviewFile, profile: Profile, cx: &App) -> Div {
        precise_header(file, profile, self.state.clone(), cx)
    }

    pub(crate) fn render(&self, width: Pixels) -> Div {
        let profile = self.profile;
        let current = profile.tokens.theme;
        let width = width - current.spacing.small;
        let files = self.content.files.clone();
        let header_state = self.state.clone();
        let viewer = Diff::new(&self.state)
            .size_full()
            .header_visible(true)
            .soft_wrap(false)
            .density(DiffDensity {
                row_height: Some(profile.code_row),
                number_padding: Some(profile.number_padding),
                number_inset: Some(current.sizing.none),
                marker_width: Some(current.spacing.small),
                indicator_width: Some(profile.indicator),
                bar_width: Some(profile.bar),
                annotation_padding: Some(current.sizing.none),
                header_padding: Some(current.sizing.none),
                whole_pixel_numbers: true,
                omit_empty_number_columns: true,
                marker_gap: Some(profile.gap),
                annotation_border: Some(current.sizing.none),
                source_offset: Some(-current.border.width),
                scrollbar_gutter: Some(current.spacing.small),
                custom_header_shell: true,
            })
            .hunk_separator(DiffHunkSeparator::Simple)
            .border(current.sizing.none)
            .change_indicator(DiffChangeIndicator::Bars)
            .render_header(move |document, _, cx| {
                let file = files
                    .iter()
                    .find(|file| file.path == document.path().as_str())
                    .expect("header metadata");
                precise_header(file, profile, header_state.clone(), cx).w(width)
            });
        let (markers, highlights) = self.markers_and_highlights();
        let marker_content = self.content.clone();
        let marker_draft = self.options.draft;
        let marker_state = self.state.clone();
        let viewer = viewer
            .gutter_markers(markers)
            .render_gutter_marker(move |marker, _, cx| {
                if profile.range_marking == ranges::RangeMarking::Gutter {
                    let position = marker.position();
                    let comment = marker_content
                        .comments
                        .iter()
                        .chain(marker_draft.iter())
                        .find(|comment| {
                            comment.path == position.path().as_str()
                                && (comment.start..=comment.end).contains(&position.line())
                        })
                        .expect("range markers belong to comments");
                    let file = marker_content
                        .files
                        .iter()
                        .find(|file| file.path == comment.path)
                        .expect("comment file metadata");
                    let profile =
                        profile.for_file(marker_state.read(cx).number_column_width(), file);
                    let background = ranges::row_background(file, position.line(), profile);
                    return ranges::marker(profile, width, background);
                }
                precise::notes::marker(marker.id(), profile)
            })
            .decorations(highlights);

        let mut annotations: Vec<_> = self.content.comments.iter().map(annotation).collect();
        annotations.extend(self.options.draft.as_ref().map(annotation));
        annotations.extend(
            self.content
                .files
                .iter()
                .filter(|file| file.kind != FileKind::Text)
                .map(|file| {
                    DiffAnnotation::file(
                        SharedString::from(format!("notice:{}", file.path)),
                        file.path,
                    )
                }),
        );
        let content = self.content.clone();
        let draft = self.options.draft;
        let editor = self.editor.clone();
        let state = self.state.clone();
        let viewer = viewer
            .annotations(annotations)
            .render_annotation(move |annotation, _, cx| {
                let file = content
                    .files
                    .iter()
                    .find(|file| file.path == annotation.path().as_str())
                    .expect("annotations refer to review files");
                let profile = profile.for_file(state.read(cx).number_column_width(), file);
                if annotation.position().is_none() {
                    let path = file.path;
                    let collapsed = state.read(cx).is_file_collapsed(path);
                    let state = state.clone();
                    let toggle = move |_: &ClickEvent, _: &mut Window, cx: &mut App| {
                        state.update(cx, |state, cx| {
                            state.set_file_collapsed(path, !collapsed, cx)
                        });
                    };
                    if file.kind == FileKind::Generated {
                        return desktop_parts::generated_notice(file, collapsed, profile, toggle)
                            .w(width);
                    }
                    return annotation_frame(file_notice(file, &current), &current);
                }
                if let Some(draft) =
                    draft.filter(|draft| annotation.id() == &ElementId::from(draft.id))
                {
                    return precise::notes::editor(&editor, &draft, profile, width);
                }
                let comment = content
                    .comments
                    .iter()
                    .find(|comment| annotation.id() == &ElementId::from(comment.id))
                    .expect("every annotation has comment content");
                precise::notes::inline(comment, profile, width)
            });
        div()
            .size_full()
            .min_h(current.sizing.none)
            .min_w(current.sizing.none)
            .child(viewer)
    }

    fn markers_and_highlights(&self) -> (Vec<DiffGutterMarker>, Vec<DiffDecoration>) {
        let comments = &self.content.comments;
        let mut markers: Vec<_> = comments.iter().map(marker).collect();
        for comment in comments.iter().chain(self.options.draft.iter()) {
            if self
                .options
                .draft
                .as_ref()
                .is_some_and(|draft| draft.id == comment.id)
            {
                markers.push(marker(comment));
            }
            markers.extend((comment.start + 1..=comment.end).map(|line| {
                DiffGutterMarker::new(
                    "comment-range",
                    DiffLinePosition::new(comment.path, DiffSide::Modified, line),
                )
            }));
        }
        let profile = self.profile;
        let mut highlights = direction_decorations(&self.content.files, profile.tokens);
        if profile.range_marking == ranges::RangeMarking::Gutter {
            highlights.extend(
                comments
                    .iter()
                    .chain(self.options.draft.iter())
                    .map(|comment| {
                        DiffDecoration::new(range(comment))
                            .with_background(profile.tokens.theme.colors.selected)
                    }),
            );
        }
        if let Some((path, line, background)) = profile.code_focus_fill() {
            highlights.push(
                DiffDecoration::new(DiffLineRange::new(path, DiffSide::Modified, line, line))
                    .with_background(background),
            );
        }
        (markers, highlights)
    }
}

fn precise_header(file: &ReviewFile, profile: Profile, state: Entity<DiffState>, cx: &App) -> Div {
    let path = file.path;
    let collapsed = state.read(cx).is_file_collapsed(path);
    precise::header::render(file, profile, collapsed, move |_, _, cx| {
        state.update(cx, |state, cx| {
            state.set_file_collapsed(path, !collapsed, cx)
        });
    })
}

fn direction_decorations(files: &[ReviewFile], tokens: DirectionTokens) -> Vec<DiffDecoration> {
    files
        .iter()
        .filter_map(|file| {
            let (side, color, count) = match file.status {
                FileStatus::Added => (DiffSide::Modified, tokens.added, file.counts().0),
                FileStatus::Deleted => (DiffSide::Original, tokens.removed, file.counts().1),
                _ => return None,
            };
            Some(
                DiffDecoration::new(DiffLineRange::new(file.path, side, 1, count))
                    .with_background(color),
            )
        })
        .collect()
}

fn documents(files: &[ReviewFile]) -> Vec<DiffFile> {
    ordered_files(files)
        .into_iter()
        .flat_map(|file| DiffFile::parse(&file.patch).expect("the fixture patch is valid"))
        .collect()
}

fn range(comment: &Comment) -> DiffLineRange {
    DiffLineRange::new(comment.path, DiffSide::Modified, comment.start, comment.end)
}

fn annotation(comment: &Comment) -> DiffAnnotation {
    DiffAnnotation::line(
        comment.id,
        DiffLinePosition::new(comment.path, DiffSide::Modified, comment.end),
    )
}

fn marker(comment: &Comment) -> DiffGutterMarker {
    DiffGutterMarker::new(
        comment.id,
        DiffLinePosition::new(comment.path, DiffSide::Modified, comment.start),
    )
    .with_label(format!("Unsent comment: {}", comment.location()))
}

#[cfg(test)]
mod tests;
