pub(crate) mod chrome;
pub(crate) mod files;
pub(crate) mod metrics;
mod tree;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Variant {
    Rule,
    Tree,
}

#[cfg(test)]
mod tests {
    use crate::scenes::SceneName;

    #[test]
    fn every_direction_is_registered_at_native_full_window_size() {
        let desktop_scenes: Vec<_> = SceneName::ALL
            .into_iter()
            .filter(|scene| scene.desktop().is_some())
            .collect();
        assert_eq!(desktop_scenes.len(), 8);
        for scene in desktop_scenes {
            let name = scene.as_str();
            assert_eq!(f32::from(scene.bounds().size.width), 1280.0, "{name}");
            assert_eq!(f32::from(scene.bounds().size.height), 800.0, "{name}");
            assert_eq!(f32::from(scene.bounds().origin.x), 0.0, "{name}");
            assert_eq!(f32::from(scene.bounds().origin.y), 0.0, "{name}");
        }
    }
}
