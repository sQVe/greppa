use std::collections::{BTreeMap, BTreeSet};

use crate::review::ReviewFile;

#[derive(Debug)]
pub(super) enum Entry {
    Folder(FolderRow),
    File { index: usize, depth: usize },
}

#[derive(Debug)]
pub(super) struct FolderRow {
    pub path: String,
    pub label: String,
    pub depth: usize,
    pub viewed: usize,
    pub total: usize,
    pub collapsed: bool,
}

pub(super) fn rows(
    files: &[ReviewFile],
    collapsed: &BTreeSet<String>,
    fits: impl Fn(&str, usize, (usize, usize)) -> bool,
) -> Vec<Entry> {
    let mut root = Folder::default();
    for (index, file) in files.iter().enumerate() {
        let mut folder = &mut root;
        let mut path = String::new();
        let (parent, _) = file.path.rsplit_once('/').unwrap_or(("", file.path));
        for name in parent.split('/').filter(|name| !name.is_empty()) {
            if !path.is_empty() {
                path.push('/');
            }
            path.push_str(name);
            folder = folder
                .folders
                .entry(name.to_string())
                .or_insert_with(|| Folder {
                    path: path.clone(),
                    name: name.to_string(),
                    ..Default::default()
                });
        }
        folder.files.push((index, file.viewed));
    }

    children(&root, 0, collapsed, &fits)
}

#[derive(Default)]
struct Folder {
    path: String,
    name: String,
    folders: BTreeMap<String, Folder>,
    files: Vec<(usize, bool)>,
}

impl Folder {
    fn counts(&self) -> (usize, usize) {
        self.folders.values().fold(
            (
                self.files.iter().filter(|(_, viewed)| *viewed).count(),
                self.files.len(),
            ),
            |(viewed, total), child| {
                let (child_viewed, child_total) = child.counts();
                (viewed + child_viewed, total + child_total)
            },
        )
    }

    fn compact(
        &self,
        depth: usize,
        collapsed: &BTreeSet<String>,
        fits: &impl Fn(&str, usize, (usize, usize)) -> bool,
    ) -> (&Self, String) {
        let mut folder = self;
        let mut label = folder.name.clone();
        let counts = self.counts();
        while folder.files.is_empty() && folder.folders.len() == 1 {
            if collapsed.contains(&folder.path) {
                break;
            }
            let child = folder.folders.values().next().expect("one child folder");
            let candidate = format!("{label}/{}", child.name);
            if !fits(&candidate, depth, counts) {
                break;
            }
            folder = child;
            label = candidate;
        }
        (folder, label)
    }
}

fn children(
    folder: &Folder,
    depth: usize,
    collapsed: &BTreeSet<String>,
    fits: &impl Fn(&str, usize, (usize, usize)) -> bool,
) -> Vec<Entry> {
    let mut rows = Vec::new();
    for child in folder.folders.values() {
        let (child, label) = child.compact(depth, collapsed, fits);
        let (viewed, total) = child.counts();
        let is_collapsed = collapsed.contains(&child.path);
        rows.push(Entry::Folder(FolderRow {
            path: child.path.clone(),
            label,
            depth,
            viewed,
            total,
            collapsed: is_collapsed,
        }));
        if !is_collapsed {
            rows.extend(children(child, depth + 1, collapsed, fits));
        }
    }
    for (index, _) in &folder.files {
        rows.push(Entry::File {
            index: *index,
            depth,
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scenes::directions::data;

    #[test]
    fn chains_split_at_the_longest_fitting_prefix_and_indent_the_remaining_rows() {
        let rows = rows(&[chain_file()], &BTreeSet::new(), |label, depth, counts| {
            counts == (0, 1) && label.len() <= 20 - depth * 2
        });
        assert_eq!(rows.len(), 3);
        assert!(
            matches!(&rows[0], Entry::Folder(FolderRow { path, label, depth: 0, viewed: 0, total: 1, collapsed: false }) if path == "assets/branding" && label == "assets/branding")
        );
        assert!(
            matches!(&rows[1], Entry::Folder(FolderRow { path, label, depth: 1, viewed: 0, total: 1, collapsed: false }) if path == "assets/branding/application-icons" && label == "application-icons")
        );
        assert!(matches!(&rows[2], Entry::File { index: 0, depth: 2 }));
    }

    #[test]
    fn remaining_segments_compress_again_using_each_child_rows_depth() {
        let file = ReviewFile::new(
            "aa/bb/cc/dd/ee/file.rs",
            crate::parts::FileStatus::Added,
            String::new(),
        );
        let rows = rows(&[file], &BTreeSet::new(), |label, depth, _| {
            let available = if depth == 1 { 2 } else { 5 };
            label.len() <= available
        });
        let folders: Vec<_> = rows
            .iter()
            .filter_map(|row| match row {
                Entry::Folder(folder) => Some((folder.label.as_str(), folder.depth)),
                Entry::File { .. } => None,
            })
            .collect();
        assert_eq!(folders, [("aa/bb", 0), ("cc", 1), ("dd/ee", 2)]);
        assert!(matches!(
            rows.last(),
            Some(Entry::File { index: 0, depth: 3 })
        ));
    }

    #[test]
    fn split_folder_rows_collapse_their_children_without_losing_viewed_counts() {
        for (path, expected_rows) in [
            ("assets/branding", 1),
            ("assets/branding/application-icons", 2),
        ] {
            let mut file = chain_file();
            file.viewed = true;
            let collapsed = [path.to_string()].into_iter().collect();
            let rows = rows(&[file], &collapsed, |label, depth, _| {
                label.len() <= 20 - depth * 2
            });
            assert_eq!(rows.len(), expected_rows, "collapsed folder {path}");
            assert!(rows.iter().all(|row| matches!(
                row,
                Entry::Folder(FolderRow {
                    viewed: 1,
                    total: 1,
                    ..
                })
            )));
            assert!(
                matches!(rows.last(), Some(Entry::Folder(FolderRow { path: actual, collapsed: true, .. })) if actual == path)
            );
        }
    }

    #[test]
    fn a_collapsed_split_prefix_stays_closed_when_the_label_slot_grows() {
        let collapsed = ["assets/branding".to_string()].into_iter().collect();
        let rows = rows(&[chain_file()], &collapsed, |_, _, _| true);
        assert_eq!(rows.len(), 1);
        assert!(
            matches!(&rows[0], Entry::Folder(FolderRow { path, label, collapsed: true, total: 1, .. }) if path == "assets/branding" && label == "assets/branding")
        );
    }

    #[test]
    fn an_overwide_single_segment_stays_one_row_for_end_ellipsis() {
        let file = ReviewFile::new(
            "a-segment-that-cannot-fit/file.rs",
            crate::parts::FileStatus::Added,
            String::new(),
        );
        let rows = rows(&[file], &BTreeSet::new(), |_, _, _| false);
        assert_eq!(rows.len(), 2);
        assert!(
            matches!(&rows[0], Entry::Folder(FolderRow { label, depth: 0, .. }) if label == "a-segment-that-cannot-fit")
        );
        assert!(matches!(&rows[1], Entry::File { index: 0, depth: 1 }));
    }

    #[test]
    fn single_child_chains_collapse_without_hiding_branch_points_or_viewed_counts() {
        let mut files = data::content().files;
        files.truncate(3);
        files[0].path = "crates/core/src/a.rs";
        files[0].viewed = true;
        files[1].path = "crates/core/src/b.rs";
        files[1].viewed = false;
        files[2].path = "crates/core/tests/a.rs";
        files[2].viewed = false;
        let rows = rows(&files, &BTreeSet::new(), |_, _, _| true);
        assert!(
            matches!(&rows[0], Entry::Folder(FolderRow { label, depth: 0, viewed: 1, total: 3, .. }) if label == "crates/core")
        );
        assert!(
            matches!(&rows[1], Entry::Folder(FolderRow { label, depth: 1, viewed: 1, total: 2, .. }) if label == "src")
        );
        assert!(matches!(&rows[2], Entry::File { index: 0, depth: 2 }));
        assert!(matches!(&rows[3], Entry::File { index: 1, depth: 2 }));
    }

    #[test]
    fn collapsing_a_folder_hides_only_its_children_and_keeps_its_counts() {
        let files = data::content().files;
        let collapsed = ["docs".to_string()].into_iter().collect();
        let rows = rows(&files, &collapsed, |_, _, _| true);
        assert!(rows.iter().any(|row| matches!(row, Entry::Folder(FolderRow { path, collapsed: true, total: 1, .. }) if path == "docs")));
        assert!(!rows.iter().any(|row| matches!(row, Entry::File { index, .. } if files[*index].path.starts_with("docs/"))));
        assert!(rows.iter().any(
            |row| matches!(row, Entry::File { index, .. } if files[*index].path == data::FOCUS)
        ));
    }

    fn chain_file() -> ReviewFile {
        ReviewFile::new(
            "assets/branding/application-icons/icon.png",
            crate::parts::FileStatus::Added,
            String::new(),
        )
    }
}
