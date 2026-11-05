//! Mock scenes built from greppa UI parts with fake data.
//!
//! A scene is drawn by the `greppa-scene` binary and captured for the two AI judges.

mod changed_files;

use gpui_kit::Div;

use crate::theme::Theme;

/// One named scene.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SceneName {
    /// A changed files panel with no header and no selected row.
    Smoke1,
    /// A clean changed files panel.
    Smoke2,
    /// A changed files panel whose file labels are all blank.
    Smoke3,
    /// A clean changed files panel with one smaller row.
    Smoke4,
}

/// Every scene name, in listing order.
pub const SCENE_NAMES: &[&str] = &["smoke-1", "smoke-2", "smoke-3", "smoke-4"];

impl SceneName {
    /// Parses a scene name, trimming surrounding whitespace.
    pub fn parse(name: &str) -> Option<SceneName> {
        match name.trim() {
            "smoke-1" => Some(SceneName::Smoke1),
            "smoke-2" => Some(SceneName::Smoke2),
            "smoke-3" => Some(SceneName::Smoke3),
            "smoke-4" => Some(SceneName::Smoke4),
            _ => None,
        }
    }

    /// The scene's canonical name.
    pub fn as_str(self) -> &'static str {
        match self {
            SceneName::Smoke1 => "smoke-1",
            SceneName::Smoke2 => "smoke-2",
            SceneName::Smoke3 => "smoke-3",
            SceneName::Smoke4 => "smoke-4",
        }
    }
}

/// The error message for a missing or unknown scene name. It lists every known scene.
pub fn unknown_scene_message(name: Option<&str>) -> String {
    let known = SCENE_NAMES.join(", ");

    match name.map(str::trim) {
        None | Some("") => format!("Type a scene name. Known scenes: {known}."),
        Some(name) => format!("No scene named \"{name}\". Known scenes: {known}."),
    }
}

/// Renders one scene into the panel area.
pub fn render_scene(name: SceneName, theme: &Theme) -> Div {
    changed_files::render(name, theme)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_reads_every_scene_name_and_trims() {
        for name in SCENE_NAMES {
            let parsed = SceneName::parse(name).expect("a known scene parses");

            assert_eq!(parsed.as_str(), *name);
            assert_eq!(SceneName::parse(&format!("  {name}  ")), Some(parsed));
        }
    }

    #[test]
    fn parse_rejects_an_unknown_name() {
        assert_eq!(SceneName::parse("smoke-9"), None);
        assert_eq!(SceneName::parse(""), None);
    }

    #[test]
    fn unknown_scene_message_names_every_scene() {
        assert_eq!(
            unknown_scene_message(None),
            "Type a scene name. Known scenes: smoke-1, smoke-2, smoke-3, smoke-4."
        );
        assert_eq!(
            unknown_scene_message(Some("  ")),
            "Type a scene name. Known scenes: smoke-1, smoke-2, smoke-3, smoke-4."
        );
        assert_eq!(
            unknown_scene_message(Some("smoke-9")),
            "No scene named \"smoke-9\". Known scenes: smoke-1, smoke-2, smoke-3, smoke-4."
        );
    }
}
