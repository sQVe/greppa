// GREPPA: Opt-in review geometry preserves the upstream layout by default.
use gpui::{Pixels, px};

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct DiffDensity {
    pub row_height: Option<Pixels>,
    pub number_padding: Option<Pixels>,
    pub number_inset: Option<Pixels>,
    pub marker_width: Option<Pixels>,
    pub indicator_width: Option<Pixels>,
    pub bar_width: Option<Pixels>,
    pub annotation_padding: Option<Pixels>,
    pub header_padding: Option<Pixels>,
    pub whole_pixel_numbers: bool,
    pub omit_empty_number_columns: bool,
    pub marker_gap: Option<Pixels>,
    pub annotation_border: Option<Pixels>,
    pub source_offset: Option<Pixels>,
    // GREPPA: Defaults keep the original scrollbar placement and header controls.
    pub scrollbar_gutter: Option<Pixels>,
    pub custom_header_shell: bool,
}

impl DiffDensity {
    pub fn resolved_row_height(self, font_size: Pixels) -> Pixels {
        self.row_height.unwrap_or(font_size * 1.6)
    }

    pub fn resolved_number_width(self, font_size: Pixels, rem: Pixels, digits: usize) -> Pixels {
        let width = font_size * 0.7 * digits as f32 + self.number_padding.unwrap_or(rem);

        if self.whole_pixel_numbers {
            px(f32::from(width).ceil())
        } else {
            width
        }
    }
}
