pub mod parts;
mod review;
pub mod scenes;
pub mod theme;
#[expect(
    clippy::disallowed_types,
    reason = "the viewer is the one module that talks to gpui-component's Diff"
)]
mod viewer;
