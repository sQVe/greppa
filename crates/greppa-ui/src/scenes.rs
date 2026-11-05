mod changed_files;

use gpui_kit::Div;
use thiserror::Error;

use crate::theme::Theme;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SceneName {
    Smoke1,
    Smoke2,
    Smoke3,
    Smoke4,
}

pub const SCENE_NAMES: &[&str] = &["smoke-1", "smoke-2", "smoke-3", "smoke-4"];

#[derive(Clone, Debug, PartialEq, Eq, Error)]
pub enum SceneError {
    #[error("Type a scene name. Known scenes: {}.", known_scenes())]
    Missing,
    #[error("No scene named \"{name}\". Known scenes: {}.", known_scenes())]
    Unknown { name: String },
}

impl SceneName {
    pub fn from_argument(argument: Option<&str>) -> Result<SceneName, SceneError> {
        let Some(name) = argument.map(str::trim) else {
            return Err(SceneError::Missing);
        };

        if name.is_empty() {
            return Err(SceneError::Missing);
        }

        SceneName::from_name(name).ok_or_else(|| SceneError::Unknown {
            name: name.to_string(),
        })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            SceneName::Smoke1 => "smoke-1",
            SceneName::Smoke2 => "smoke-2",
            SceneName::Smoke3 => "smoke-3",
            SceneName::Smoke4 => "smoke-4",
        }
    }

    fn from_name(name: &str) -> Option<SceneName> {
        match name {
            "smoke-1" => Some(SceneName::Smoke1),
            "smoke-2" => Some(SceneName::Smoke2),
            "smoke-3" => Some(SceneName::Smoke3),
            "smoke-4" => Some(SceneName::Smoke4),
            _ => None,
        }
    }
}

pub fn render_scene(name: SceneName, theme: &Theme) -> Div {
    changed_files::render(name, theme)
}

fn known_scenes() -> String {
    SCENE_NAMES.join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_argument_reads_every_scene_name_and_trims() {
        for name in SCENE_NAMES {
            let parsed = SceneName::from_argument(Some(name)).expect("a known scene parses");

            assert_eq!(parsed.as_str(), *name);
            assert_eq!(
                SceneName::from_argument(Some(&format!("  {name}  "))),
                Ok(parsed)
            );
        }
    }

    #[test]
    fn from_argument_reports_a_missing_name() {
        assert_eq!(SceneName::from_argument(None), Err(SceneError::Missing));
        assert_eq!(
            SceneName::from_argument(Some("  ")),
            Err(SceneError::Missing)
        );
    }

    #[test]
    fn from_argument_reports_an_unknown_name_with_its_trimmed_name() {
        assert_eq!(
            SceneName::from_argument(Some("smoke-9")),
            Err(SceneError::Unknown {
                name: "smoke-9".to_string()
            })
        );
        assert_eq!(
            SceneName::from_argument(Some("  smoke-9  ")),
            Err(SceneError::Unknown {
                name: "smoke-9".to_string()
            })
        );
    }

    #[test]
    fn unknown_scene_message_names_every_scene() {
        let error = SceneError::Unknown {
            name: "smoke-9".to_string(),
        };
        let message = error.to_string();

        for name in SCENE_NAMES {
            assert!(
                message.contains(name),
                "the message does not name the scene {name}"
            );
        }
    }
}
