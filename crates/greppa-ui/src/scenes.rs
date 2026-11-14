mod changed_files;
pub(crate) mod directions;

use gpui_kit::{
    App, Bounds, Context, IntoElement, ParentElement, Pixels, Render, Styled, Window, div,
};
use thiserror::Error;

use crate::theme::{install_review_theme, layout, theme};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SceneName {
    Smoke1,
    Smoke2,
    Smoke3,
    Smoke4,
    V4Rule,
    V4Tree,
    V5RangeGutter,
    V6Tree,
    V7Keys,
    V7BorderFiles,
    V7BorderDiff,
    V7BorderComments,
}

#[derive(Clone, Debug, PartialEq, Eq, Error)]
pub enum SceneError {
    #[error("Type a scene name. Known scenes: {}.", known_scenes())]
    Missing,
    #[error("No scene named \"{name}\". Known scenes: {}.", known_scenes())]
    Unknown { name: String },
}

impl SceneName {
    pub const ALL: [SceneName; 12] = [
        Self::Smoke1,
        Self::Smoke2,
        Self::Smoke3,
        Self::Smoke4,
        Self::V4Rule,
        Self::V4Tree,
        Self::V5RangeGutter,
        Self::V6Tree,
        Self::V7Keys,
        Self::V7BorderFiles,
        Self::V7BorderDiff,
        Self::V7BorderComments,
    ];

    pub fn from_argument(argument: Option<&str>) -> Result<SceneName, SceneError> {
        let Some(name) = argument.map(str::trim) else {
            return Err(SceneError::Missing);
        };
        if name.is_empty() {
            return Err(SceneError::Missing);
        }
        Self::ALL
            .into_iter()
            .find(|scene| scene.as_str() == name)
            .ok_or_else(|| SceneError::Unknown {
                name: name.to_string(),
            })
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Smoke1 => "smoke-1",
            Self::Smoke2 => "smoke-2",
            Self::Smoke3 => "smoke-3",
            Self::Smoke4 => "smoke-4",
            Self::V4Rule => "direction-v4-rule",
            Self::V4Tree => "direction-v4-tree",
            Self::V5RangeGutter => "direction-v5-range-gutter",
            Self::V6Tree => "direction-v6-tree",
            Self::V7Keys => "direction-v7-keys",
            Self::V7BorderFiles => "direction-v7-focus-border-files",
            Self::V7BorderDiff => "direction-v7-focus-border-diff",
            Self::V7BorderComments => "direction-v7-focus-border-comments",
        }
    }

    pub fn uses_bundled_icons(self) -> bool {
        !matches!(
            self,
            Self::Smoke1 | Self::Smoke2 | Self::Smoke3 | Self::Smoke4
        )
    }

    pub fn window_size(self) -> gpui_kit::Size<Pixels> {
        if self.uses_bundled_icons() {
            directions::desktop::profile::bounds().size
        } else {
            layout::WINDOW_SIZE
        }
    }

    pub fn bounds(self) -> Bounds<Pixels> {
        if self.uses_bundled_icons() {
            directions::desktop::profile::bounds()
        } else {
            Bounds::new(layout::SCENE_ORIGIN, layout::SCENE_SIZE)
        }
    }
}

pub struct Scene {
    name: SceneName,
    desktop: Option<gpui_kit::Entity<directions::desktop::Desktop>>,
}

impl Scene {
    pub fn new(name: SceneName, window: &mut Window, cx: &mut App) -> Self {
        let desktop = if name.uses_bundled_icons() {
            install_review_theme(cx);
            Some(gpui_kit::AppContext::new(cx, |cx| {
                directions::desktop::Desktop::new(name.as_str(), window, cx)
            }))
        } else {
            None
        };
        Self { name, desktop }
    }
}

impl Render for Scene {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        if let Some(desktop) = &self.desktop {
            return div().size_full().child(desktop.clone());
        }
        let current = theme();
        let bounds = self.name.bounds();
        div().size_full().bg(current.colors.background).child(
            div()
                .absolute()
                .left(bounds.origin.x)
                .top(bounds.origin.y)
                .w(bounds.size.width)
                .h(bounds.size.height)
                .child(changed_files::render(self.name, &current)),
        )
    }
}

fn known_scenes() -> String {
    let names: Vec<&str> = SceneName::ALL.into_iter().map(SceneName::as_str).collect();
    names.join(", ")
}

#[cfg(test)]
mod tests;
