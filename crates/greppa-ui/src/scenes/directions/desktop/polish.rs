pub(crate) mod chrome;
pub(crate) mod files;
pub(crate) mod metrics;
mod tree;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Variant {
    Rule,
    Tree,
}

impl Variant {
    pub(crate) const NAMED: [(&'static str, Self); 8] = [
        ("direction-v4-rule", Self::Rule),
        ("direction-v4-tree", Self::Tree),
        ("direction-v5-range-gutter", Self::Rule),
        ("direction-v6-tree", Self::Tree),
        ("direction-v7-keys", Self::Rule),
        ("direction-v7-focus-border-files", Self::Rule),
        ("direction-v7-focus-border-diff", Self::Rule),
        ("direction-v7-focus-border-comments", Self::Rule),
    ];

    pub(crate) fn from_name(name: &str) -> Option<Self> {
        Self::NAMED
            .iter()
            .find(|(candidate, _)| *candidate == name)
            .map(|(_, variant)| *variant)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scenes::SceneName;

    #[test]
    fn every_direction_is_registered_at_native_full_window_size() {
        for (name, _) in Variant::NAMED {
            let scene = SceneName::from_argument(Some(name)).expect("registered direction scene");
            assert_eq!(f32::from(scene.bounds().size.width), 1280.0, "{name}");
            assert_eq!(f32::from(scene.bounds().size.height), 800.0, "{name}");
            assert_eq!(f32::from(scene.bounds().origin.x), 0.0, "{name}");
            assert_eq!(f32::from(scene.bounds().origin.y), 0.0, "{name}");
            assert!(scene.uses_bundled_icons(), "{name}");
        }
    }
}
