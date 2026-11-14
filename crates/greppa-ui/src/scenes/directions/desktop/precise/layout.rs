pub(super) fn counts_column_width(rows: impl Iterator<Item = (bool, f32)>) -> f32 {
    rows.filter(|(eligible, _)| *eligible)
        .map(|(_, width)| width.ceil())
        .fold(0.0, f32::max)
}

pub(super) fn label_end(
    counts_right: f32,
    own_counts: f32,
    column: f32,
    tick_visible: bool,
) -> f32 {
    let occupied = if tick_visible {
        column + 16.0
    } else {
        own_counts
    };
    counts_right - occupied - 8.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_column_ignores_generated_rows_and_rounds_up() {
        assert_eq!(
            counts_column_width([(true, 32.4), (false, 68.0), (true, 35.2)].into_iter()),
            36.0
        );
    }

    #[test]
    fn labels_stop_before_the_next_visible_control_or_count() {
        for (counts, tick, expected) in [
            (28.0, true, 191.0),
            (28.0, false, 215.0),
            (68.0, false, 175.0),
        ] {
            assert_eq!(label_end(251.0, counts, 36.0, tick), expected);
        }
    }
}
