use super::*;

#[test]
fn registry_contains_only_four_smoke_and_eight_reference_scenes() {
    let names: Vec<_> = SceneName::ALL.into_iter().map(SceneName::as_str).collect();
    assert_eq!(
        names,
        [
            "smoke-1",
            "smoke-2",
            "smoke-3",
            "smoke-4",
            "direction-v4-rule",
            "direction-v4-tree",
            "direction-v5-range-gutter",
            "direction-v6-tree",
            "direction-v7-keys",
            "direction-v7-focus-border-files",
            "direction-v7-focus-border-diff",
            "direction-v7-focus-border-comments",
        ]
    );
}

#[test]
fn smoke_geometry_stays_fixed() {
    for name in [
        SceneName::Smoke1,
        SceneName::Smoke2,
        SceneName::Smoke3,
        SceneName::Smoke4,
    ] {
        assert_eq!(name.bounds().origin, layout::SCENE_ORIGIN);
        assert_eq!(name.bounds().size, layout::SCENE_SIZE);
        assert_eq!(name.window_size(), layout::WINDOW_SIZE);
        assert!(!name.uses_bundled_icons());
    }
}

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
    for name in ["smoke-9", "  smoke-9  "] {
        assert_eq!(
            SceneName::from_argument(Some(name)),
            Err(SceneError::Unknown {
                name: "smoke-9".to_string()
            })
        );
    }
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
    for error in [
        SceneError::Missing,
        SceneError::Unknown {
            name: "smoke-9".to_string(),
        },
    ] {
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
