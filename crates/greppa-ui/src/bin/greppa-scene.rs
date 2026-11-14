use std::process::ExitCode;

use gpui_kit::*;
use greppa_ui::scenes::{Scene, SceneName};
use greppa_ui::theme::layout;

fn window_options(title: &str, scene: SceneName) -> WindowOptions {
    WindowOptions {
        window_bounds: Some(WindowBounds::Windowed(Bounds::new(
            layout::WINDOW_ORIGIN,
            scene.window_size(),
        ))),
        titlebar: Some(TitlebarOptions {
            title: Some(SharedString::from(title.to_string())),
            ..TitlebarOptions::default()
        }),
        ..WindowOptions::default()
    }
}

fn ready_line(name: SceneName, scale: f32, title: &str) -> String {
    let bounds = name.bounds();
    let origin = bounds.origin;
    let size = bounds.size;

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

#[expect(
    clippy::print_stdout,
    clippy::print_stderr,
    reason = "the list and ready line go to stdout, the errors to stderr"
)]
fn main() -> ExitCode {
    let argument = std::env::args().nth(1);

    if argument.as_deref() == Some("--list") {
        for name in SceneName::ALL {
            println!("{}", name.as_str());
        }

        return ExitCode::SUCCESS;
    }

    let name = match SceneName::from_argument(argument.as_deref()) {
        Ok(name) => name,
        Err(error) => {
            eprintln!("{error}");

            return ExitCode::FAILURE;
        }
    };
    let title = "greppa-scene".to_string();

    let application = gpui_kit::application();
    let application = if name.uses_bundled_icons() {
        application.with_assets(gpui_kit::assets::AllAssets)
    } else {
        application
    };
    application.run(move |cx| {
        gpui_kit::init(cx);

        let (handle, _view) =
            gpui_kit::open_window(window_options(&title, name), cx, move |window, cx| {
                cx.new(|cx| Scene::new(name, window, cx))
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
