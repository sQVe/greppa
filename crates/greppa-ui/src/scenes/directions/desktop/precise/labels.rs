use super::super::polish::metrics;

#[derive(Debug, PartialEq)]
pub(super) struct Extras {
    pub old_name: Option<String>,
    pub folder: String,
}

pub(super) fn distinct_parent<'a>(path: &'a str, paths: &[&str]) -> Option<&'a str> {
    let (folder, name) = path.rsplit_once('/')?;
    let peers: Vec<_> = paths
        .iter()
        .filter(|other| **other != path)
        .filter(|other| other.rsplit('/').next() == Some(name))
        .collect();
    if peers.is_empty() {
        return None;
    }

    folder.rsplit('/').enumerate().find_map(|(depth, segment)| {
        let differs = peers.iter().all(|other| {
            other
                .rsplit_once('/')
                .and_then(|(parent, _)| parent.rsplit('/').nth(depth))
                != Some(segment)
        });
        differs.then_some(segment)
    })
}

pub(super) fn tooltip(path: &str, previous: Option<&str>) -> String {
    match previous {
        Some(previous) => format!("{previous} → {path}"),
        None => path.to_string(),
    }
}

pub(super) fn extras(
    old_path: Option<&str>,
    folder: &str,
    available: f32,
    width: impl Fn(&str) -> f32,
) -> Extras {
    let old_name = old_path
        .map(|path| {
            let name = path.rsplit('/').next().expect("a path has a filename");
            format!("← {name}")
        })
        .filter(|label| width(label) + 2.0 <= available);
    if old_path.is_some() && old_name.is_none() {
        return Extras {
            old_name: None,
            folder: String::new(),
        };
    }

    let remaining = available - old_name.as_ref().map_or(0.0, |label| width(label) + 2.0);
    let folder = metrics::folder_suffix(folder, |text| width(text) + 2.0 <= remaining);

    Extras { old_name, folder }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_names_use_the_nearest_distinct_whole_parent_segment() {
        let paths = [
            "Cargo.toml",
            "crates/greppa-core/Cargo.toml",
            "src/shared/file.rs",
            "tests/shared/file.rs",
        ];
        for (path, expected) in [
            (paths[0], None),
            (paths[1], Some("greppa-core")),
            (paths[2], Some("src")),
            ("src/main.rs", None),
        ] {
            assert_eq!(distinct_parent(path, &paths), expected, "{path}");
        }
    }

    #[test]
    fn renamed_file_tooltips_keep_both_full_paths_when_the_old_label_is_omitted() {
        let path = "crates/greppa-core/src/line_range.rs";
        let previous = Some("crates/greppa-core/src/range.rs");
        let labels = extras(previous, "", 4.0, |text| text.chars().count() as f32);
        assert_eq!(labels.old_name, None);
        assert_eq!(labels.folder, "");
        assert_eq!(
            tooltip(path, previous),
            "crates/greppa-core/src/range.rs → crates/greppa-core/src/line_range.rs"
        );
        assert_eq!(tooltip("Cargo.toml", None), "Cargo.toml");
    }

    #[test]
    fn old_names_are_whole_and_take_priority_over_folder_hints() {
        let width = |text: &str| text.chars().count() as f32;
        let old = Some("src/range.rs");
        for (available, expected_old, expected_folder) in [
            (10.0, None, ""),
            (12.0, Some("← range.rs"), ""),
            (19.0, Some("← range.rs"), "…/src"),
            (100.0, Some("← range.rs"), "crates/core/src"),
        ] {
            let actual = extras(old, "crates/core/src", available, width);
            assert_eq!(actual.old_name.as_deref(), expected_old, "{available}");
            assert_eq!(actual.folder, expected_folder, "{available}");
        }
    }
}
