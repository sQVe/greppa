use gpui_kit::Rgba;

pub(crate) fn contrast_ratio(first: Rgba, second: Rgba) -> f32 {
    let first = luminance(first);
    let second = luminance(second);
    let lighter = first.max(second);
    let darker = first.min(second);

    (lighter + 0.05) / (darker + 0.05)
}

pub(super) fn luminance(color: Rgba) -> f32 {
    let hex = u32::from(color);
    let red = ((hex >> 24) & 0xFF) as f32 / 255.0;
    let green = ((hex >> 16) & 0xFF) as f32 / 255.0;
    let blue = ((hex >> 8) & 0xFF) as f32 / 255.0;

    0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

fn linear(channel: f32) -> f32 {
    if channel <= 0.04045 {
        channel / 12.92
    } else {
        ((channel + 0.055) / 1.055).powf(2.4)
    }
}
