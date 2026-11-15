#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RangeMarking {
    Dots,
    Gutter,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scenes::SceneName;

    #[test]
    fn scene_names_select_one_marking_and_leave_earlier_scenes_on_dots() {
        for (scene, expected) in [
            (SceneName::V5RangeGutter, RangeMarking::Gutter),
            (SceneName::V4Rule, RangeMarking::Dots),
            (SceneName::V4Tree, RangeMarking::Dots),
        ] {
            let marking = scene.desktop().expect("desktop scene").range_marking;
            assert_eq!(marking, expected, "{scene:?}");
        }
    }
}
