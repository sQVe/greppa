use gpui_kit::{Bounds, Pixels, Size, point, px, size};

#[derive(Clone, Copy)]
pub(crate) struct KeyboardTokens {
    pub width: Pixels,
    pub title_height: Pixels,
    pub padding: Pixels,
    pub column_gap: Pixels,
    pub group_gap: Pixels,
    pub row_height: Pixels,
    pub cap_height: Pixels,
    pub cap_padding: Pixels,
    pub cap_gap: Pixels,
    pub title_gap: Pixels,
    pub scrim_opacity: f32,
    pub pane_frame_width: Pixels,
    pub files: Bounds<Pixels>,
    pub diff: Bounds<Pixels>,
    pub comments: Bounds<Pixels>,
}

impl KeyboardTokens {
    pub(crate) fn new() -> Self {
        Self {
            width: px(640.0),
            title_height: px(32.0),
            padding: px(14.0),
            column_gap: px(32.0),
            group_gap: px(10.0),
            row_height: px(24.0),
            cap_height: px(18.0),
            cap_padding: px(5.0),
            cap_gap: px(4.0),
            title_gap: px(6.0),
            scrim_opacity: 0.30,
            pane_frame_width: px(2.0),
            files: Bounds::new(point(px(0.0), px(84.0)), size(px(259.0), px(24.0))),
            diff: Bounds::new(point(px(260.0), px(418.0)), size(px(712.0), px(18.0))),
            comments: Bounds::new(point(px(987.0), px(180.0)), size(px(287.0), px(100.0))),
        }
    }

    pub(crate) fn column_width(self, border: Pixels) -> Pixels {
        (self.width - border * 2.0 - self.padding * 2.0 - self.column_gap) / 2.0
    }

    pub(crate) fn box_bounds(
        self,
        viewport: Size<Pixels>,
        content: Pixels,
        border: Pixels,
    ) -> Bounds<Pixels> {
        let height = self.title_height + self.padding * 2.0 + content + border * 3.0;
        let left = px(f32::from((viewport.width - self.width) / 2.0).floor());
        let top = px(f32::from((viewport.height - height) / 2.0).floor());
        Bounds::new(point(left, top), size(self.width, height))
    }
}
