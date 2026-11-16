use gpui_kit::{Font, Pixels, TextRun, Window};

pub(crate) fn text_width(text: &str, size: Pixels, font: Font, window: &Window) -> Pixels {
    window
        .text_system()
        .shape_line(
            text.to_string().into(),
            size,
            &[TextRun {
                len: text.len(),
                font,
                ..Default::default()
            }],
            None,
        )
        .width
}

pub(crate) fn folder_suffix(folder: &str, fits: impl Fn(&str) -> bool) -> String {
    if fits(folder) {
        return folder.to_string();
    }

    for (position, _) in folder.match_indices('/') {
        let suffix = format!("…{}", &folder[position..]);
        if fits(&suffix) {
            return suffix;
        }
    }

    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_truncation_keeps_the_nearest_folder_and_never_borrows_filename_space() {
        let folder = "crates/greppa-ui/src/scenes";
        assert_eq!(
            folder_suffix(folder, |text| text.len() <= 15),
            "…/src/scenes"
        );
        assert_eq!(folder_suffix(folder, |text| text.len() <= 10), "…/scenes");
        assert_eq!(folder_suffix(folder, |text| text.len() <= 5), "");
        assert_eq!(
            folder_suffix("日本/src", |text| text.chars().count() <= 5),
            "…/src"
        );
        assert_eq!(folder_suffix("src", |_| true), "src");
    }
}
