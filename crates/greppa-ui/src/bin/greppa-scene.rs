//! Opens one named mock scene for capture.
//!
//! The window is a fixed size in the base color, and the scene is drawn at a fixed origin with its
//! declared size. On the first frame the binary prints one JSON line so the capture can wait for it.

use std::process::ExitCode;

use gpui_kit::*;
use greppa_ui::scenes::{SCENE_NAMES, SceneName, render_scene, unknown_scene_message};
use greppa_ui::theme::{layout, theme};

struct SceneView {
    name: SceneName,
}

impl Render for SceneView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let current = theme();

        div().size_full().bg(current.colors.background).child(
            div()
                .absolute()
                .left(layout::SCENE_ORIGIN.x)
                .top(layout::SCENE_ORIGIN.y)
                .w(layout::SCENE_SIZE.width)
                .h(layout::SCENE_SIZE.height)
                .child(render_scene(self.name, &current)),
        )
    }
}

fn window_options(title: &str) -> WindowOptions {
    WindowOptions {
        window_bounds: Some(WindowBounds::Windowed(Bounds::new(
            layout::WINDOW_ORIGIN,
            layout::WINDOW_SIZE,
        ))),
        titlebar: Some(TitlebarOptions {
            title: Some(SharedString::from(title.to_string())),
            ..TitlebarOptions::default()
        }),
        ..WindowOptions::default()
    }
}

fn ready_line(name: SceneName, scale: f32, title: &str) -> String {
    let origin = layout::SCENE_ORIGIN;
    let size = layout::SCENE_SIZE;

    format!(
        "{{\"scene\":\"{}\",\"origin\":{{\"x\":{},\"y\":{}}},\"size\":{{\"width\":{},\"height\":{}}},\"scale\":{},\"title\":\"{}\"}}",
        name.as_str(),
        f32::from(origin.x),
        f32::from(origin.y),
        f32::from(size.width),
        f32::from(size.height),
        scale,
        title,
    )
}

fn main() -> ExitCode {
    let argument = std::env::args().nth(1);

    if argument.as_deref() == Some("--list") {
        for name in SCENE_NAMES {
            println!("{name}");
        }

        return ExitCode::SUCCESS;
    }

    let Some(name) = argument.as_deref().and_then(SceneName::parse) else {
        eprintln!("{}", unknown_scene_message(argument.as_deref()));

        return ExitCode::FAILURE;
    };
    let title = format!("greppa-scene-{}", name.as_str());

    gpui_kit::application().run(move |cx| {
        gpui_kit::init(cx);

        let (handle, _view) = gpui_kit::open_window(window_options(&title), cx, move |_, cx| {
            cx.new(|_| SceneView { name })
        })
        .expect("open the scene window");

        handle
            .update(cx, |_, window, _| {
                let title = title.clone();

                window.on_next_frame(move |window, _| {
                    println!("{}", ready_line(name, window.scale_factor(), &title));
                });
            })
            .expect("the scene window is open");

        cx.activate(true);
    });

    ExitCode::SUCCESS
}
