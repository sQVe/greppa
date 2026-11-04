//! Review logic for greppa: diffs, line ranges, and review state.
//!
//! This crate must never depend on GPUI, so it builds and tests without a display or GPU.

/// A range of 1-based line numbers, inclusive at both ends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LineRange {
    start: u32,
    end: u32,
}

impl LineRange {
    /// Returns `None` when `start` is 0 or comes after `end`.
    pub fn new(start: u32, end: u32) -> Option<Self> {
        if start == 0 {
            return None;
        }

        if start > end {
            return None;
        }

        Some(Self { start, end })
    }

    /// Reports whether `line` lies inside the range.
    pub fn contains(self, line: u32) -> bool {
        self.start <= line && line <= self.end
    }
}

#[cfg(test)]
mod tests {
    use super::LineRange;

    #[test]
    fn new_rejects_line_zero_and_reversed_ranges() {
        assert_eq!(LineRange::new(0, 3), None);
        assert_eq!(LineRange::new(4, 3), None);
        assert_eq!(LineRange::new(3, 3), Some(LineRange { start: 3, end: 3 }));
    }

    #[test]
    fn contains_includes_both_ends_only() {
        let range = LineRange::new(2, 4).expect("valid range");

        assert!(!range.contains(1));
        assert!(range.contains(2));
        assert!(range.contains(4));
        assert!(!range.contains(5));
    }
}
