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

#[derive(Clone, Debug, PartialEq, Eq, Error)]
pub enum SceneError {
    #[error("Type a scene name. Known scenes: {}.", known_scenes())]
    Missing,
    #[error("No scene named \"{name}\". Known scenes: {}.", known_scenes())]
    Unknown { name: String },
}

impl SceneName {
    pub const ALL: [SceneName; 4] = [
        SceneName::Smoke1,
        SceneName::Smoke2,
        SceneName::Smoke3,
        SceneName::Smoke4,
    ];

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
        SceneName::ALL
            .into_iter()
            .find(|scene| scene.as_str() == name)
    }
}

pub fn render_scene(name: SceneName, theme: &Theme) -> Div {
    changed_files::render(name, theme)
}

fn known_scenes() -> String {
    let names: Vec<&str> = SceneName::ALL.into_iter().map(SceneName::as_str).collect();

    names.join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_argument_reads_every_scene_name_and_trims() {
        for scene in SceneName::ALL {
            let name = scene.as_str();

            assert_eq!(SceneName::from_argument(Some(name)), Ok(scene));
            assert_eq!(
                SceneName::from_argument(Some(&format!("  {name}  "))),
                Ok(scene)
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
    fn unknown_scene_error_names_the_rejected_name() {
        let error = SceneError::Unknown {
            name: "smoke-9".to_string(),
        };

        assert!(
            error.to_string().contains("smoke-9"),
            "the message does not name the rejected scene"
        );
    }

    #[test]
    fn scene_errors_name_every_scene() {
        let errors = [
            SceneError::Missing,
            SceneError::Unknown {
                name: "smoke-9".to_string(),
            },
        ];

        for error in errors {
            let message = error.to_string();

            for scene in SceneName::ALL {
                assert!(
                    message.contains(scene.as_str()),
                    "the {error:?} message does not name the scene {}",
                    scene.as_str()
                );
            }
        }
    }
}
