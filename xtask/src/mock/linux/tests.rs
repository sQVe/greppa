use super::*;

#[test]
fn crop_box_scales_the_origin_and_size() {
    let crop = crop_box(
        Point { x: 60.0, y: 40.0 },
        LogicalSize {
            width: 420.0,
            height: 300.0,
        },
        2.0,
    );

    assert_eq!(
        crop,
        Crop {
            x: 120,
            y: 80,
            width: 840,
            height: 600,
        }
    );
}

#[test]
fn crop_geometry_uses_wxh_plus_xy() {
    let crop = Crop {
        x: 120,
        y: 80,
        width: 840,
        height: 600,
    };

    assert_eq!(crop_geometry(crop), "840x600+120+80");
}

#[test]
fn crop_fits_checks_every_edge() {
    let shot = PixelSize {
        width: 1400,
        height: 900,
    };
    let inside = Crop {
        x: 60,
        y: 60,
        width: 420,
        height: 300,
    };

    assert!(crop_fits(inside, shot));
    assert!(!crop_fits(Crop { x: -1, ..inside }, shot));
    assert!(!crop_fits(Crop { y: -1, ..inside }, shot));
    assert!(!crop_fits(
        Crop {
            width: 1400,
            ..inside
        },
        shot
    ));
    assert!(!crop_fits(
        Crop {
            height: 900,
            ..inside
        },
        shot
    ));
}

#[test]
fn next_ready_reports_a_missing_line() {
    let (_sender, receiver) = mpsc::channel();
    let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("timeout");

    assert!(matches!(error, CaptureError::Timeout));
    assert_eq!(
        error.to_string(),
        "The scene did not print a ready line in time."
    );
}

#[test]
fn next_ready_reports_a_closed_stream() {
    let (sender, receiver) = mpsc::channel();
    drop(sender);

    let error = next_ready(&receiver, Duration::from_millis(10)).expect_err("closed");

    assert!(matches!(error, CaptureError::Closed));
    assert_eq!(
        error.to_string(),
        "The scene exited before it printed a ready line."
    );
}

#[test]
fn next_ready_skips_lines_until_it_parses_one() {
    let (sender, receiver) = mpsc::channel();
    let ready = "{\"scene\":\"demo\",\"origin\":{\"x\":60,\"y\":60},\"size\":{\"width\":420,\"height\":300},\"scale\":1,\"title\":\"greppa-scene-demo\"}";

    sender.send("build noise".to_string()).expect("send noise");
    sender.send(ready.to_string()).expect("send ready");
    drop(sender);

    assert!(next_ready(&receiver, Duration::from_millis(100)).is_ok());
}

#[test]
fn crop_outside_message_names_the_box_and_shot() {
    let crop = Crop {
        x: 60,
        y: 60,
        width: 420,
        height: 300,
    };
    let shot = PixelSize {
        width: 100,
        height: 100,
    };

    assert_eq!(
        crop_outside_message(crop, shot),
        "The crop 420x300+60+60 falls outside the 100x100 shot."
    );
}

fn hostile_caller() -> Vec<(String, String)> {
    [
        ("DISPLAY", ":0"),
        ("WAYLAND_DISPLAY", "wayland-0"),
        ("LIBEI_SOCKET", "/run/user/1000/eis-0"),
        ("DBUS_SESSION_BUS_ADDRESS", "unix:path=/run/user/1000/bus"),
        ("HOME", "/home/user"),
        ("XDG_CONFIG_HOME", "/home/user/.config"),
        ("XDG_CACHE_HOME", "/home/user/.cache"),
        ("XDG_RUNTIME_DIR", "/run/user/1000"),
        ("PATH", "/usr/bin:/bin"),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_string(), value.to_string()))
    .collect()
}

fn value<'a>(environment: &'a [(String, String)], key: &str) -> Option<&'a str> {
    environment
        .iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.as_str())
}

#[test]
fn mock_environment_uses_private_folders_and_the_given_display() {
    let runtime = Path::new("/var/tmp/greppa-mock-runtime");

    for (case, display, expected_display) in
        [("headless", None, None), ("scene", Some(":7"), Some(":7"))]
    {
        let environment = mock_environment(&hostile_caller(), runtime, display);

        for (key, expected) in [
            ("DISPLAY", expected_display),
            ("WAYLAND_DISPLAY", None),
            ("LIBEI_SOCKET", None),
            ("DBUS_SESSION_BUS_ADDRESS", None),
            ("HOME", Some("/var/tmp/greppa-mock-runtime/home")),
            (
                "XDG_CONFIG_HOME",
                Some("/var/tmp/greppa-mock-runtime/config"),
            ),
            ("XDG_CACHE_HOME", Some("/var/tmp/greppa-mock-runtime/cache")),
            ("XDG_RUNTIME_DIR", Some("/var/tmp/greppa-mock-runtime")),
            (
                "PATH",
                Some("/var/tmp/greppa-mock-runtime/bin:/usr/bin:/bin"),
            ),
        ] {
            assert_eq!(value(&environment, key), expected, "{case}: {key}");
        }
    }
}

#[test]
fn dropping_a_scene_stops_and_reaps_its_child() {
    let child = Command::new("sleep")
        .arg("30")
        .spawn()
        .expect("start sleep");
    let process = std::path::PathBuf::from(format!("/proc/{}", child.id()));
    let scene = Scene {
        child,
        lines: mpsc::channel().1,
    };
    let started = Instant::now();

    drop(scene);

    assert!(
        started.elapsed() < Duration::from_secs(10),
        "the child was not stopped"
    );
    assert!(!process.exists(), "the child was not reaped");
}

#[test]
fn prepare_folder_removes_only_the_capture_files() {
    let folder = crate::test_support::temporary_directory();
    let marker = folder.path().join("notes.md");
    fs::write(&marker, "keep").expect("write the marker");

    for file in ["shot.png", "crop.png", "capture.json", "weston.log"] {
        fs::write(folder.path().join(file), "old").expect("write an old output");
    }

    prepare_folder(folder.path()).expect("the folder is prepared");

    for file in ["shot.png", "crop.png", "capture.json", "weston.log"] {
        assert!(!folder.path().join(file).exists(), "{file}");
    }
    assert!(marker.is_file(), "an unrelated file must stay");
}

#[test]
fn prepare_folder_creates_a_missing_folder() {
    let parent = crate::test_support::temporary_directory();
    let folder = parent.path().join("judge").join("smoke-2");

    prepare_folder(&folder).expect("the folder is created");

    assert!(folder.is_dir());
}

#[test]
fn write_capture_json_records_the_scene_shot_crop_and_scale() {
    let folder = crate::test_support::temporary_directory();
    let ready = Ready {
        scene: "smoke-2".to_string(),
        origin: Point { x: 1.0, y: 2.0 },
        size: LogicalSize {
            width: 3.0,
            height: 4.0,
        },
        scale: 1.5,
        title: "greppa smoke-2".to_string(),
    };
    let shot = PixelSize {
        width: 1400,
        height: 900,
    };
    let crop = Crop {
        x: 11,
        y: 12,
        width: 130,
        height: 140,
    };

    write_capture_json(folder.path(), &ready, shot, crop).expect("the record is written");

    let text = fs::read_to_string(folder.path().join("capture.json")).expect("read the record");
    let record: serde_json::Value = serde_json::from_str(&text).expect("the record is JSON");

    assert_eq!(
        record,
        json!({
            "scene": "smoke-2",
            "shot": { "width": 1400, "height": 900 },
            "crop": {
                "x": 11,
                "y": 12,
                "width": 130,
                "height": 140,
                "geometry": "130x140+11+12",
            },
            "scale": 1.5,
        })
    );
}

#[test]
fn write_capture_json_fails_when_the_folder_is_a_file() {
    let parent = crate::test_support::temporary_directory();
    let folder = parent.path().join("file");
    fs::write(&folder, "not a folder").expect("write the file");
    let ready = Ready {
        scene: "smoke-2".to_string(),
        origin: Point { x: 0.0, y: 0.0 },
        size: LogicalSize {
            width: 1.0,
            height: 1.0,
        },
        scale: 1.0,
        title: "greppa smoke-2".to_string(),
    };
    let shot = PixelSize {
        width: 1,
        height: 1,
    };
    let crop = Crop {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
    };

    let error = write_capture_json(&folder, &ready, shot, crop).expect_err("the write fails");

    assert_eq!(
        error
            .downcast_ref::<std::io::Error>()
            .map(std::io::Error::kind),
        Some(std::io::ErrorKind::NotADirectory)
    );
}
