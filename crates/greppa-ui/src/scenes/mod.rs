mod changed_files;

use gpui_kit::Div;

use crate::theme::Theme;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SceneName {
    Smoke1,
    Smoke2,
    Smoke3,
    Smoke4,
}

pub const SCENE_NAMES: &[&str] = &["smoke-1", "smoke-2", "smoke-3", "smoke-4"];

impl SceneName {
    pub fn parse(name: &str) -> Option<SceneName> {
        match name.trim() {
            "smoke-1" => Some(SceneName::Smoke1),
            "smoke-2" => Some(SceneName::Smoke2),
            "smoke-3" => Some(SceneName::Smoke3),
            "smoke-4" => Some(SceneName::Smoke4),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            SceneName::Smoke1 => "smoke-1",
            SceneName::Smoke2 => "smoke-2",
            SceneName::Smoke3 => "smoke-3",
            SceneName::Smoke4 => "smoke-4",
        }
    }
}

pub fn unknown_scene_message(name: Option<&str>) -> String {
    let known = SCENE_NAMES.join(", ");

    match name.map(str::trim) {
        None | Some("") => format!("Type a scene name. Known scenes: {known}."),
        Some(name) => format!("No scene named \"{name}\". Known scenes: {known}."),
    }
}

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
