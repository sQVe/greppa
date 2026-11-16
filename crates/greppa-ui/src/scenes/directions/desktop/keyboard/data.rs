pub(super) struct KeyRow {
    pub label: &'static str,
    pub caps: &'static [&'static str],
}

pub(super) struct KeyGroup {
    pub title: &'static str,
    pub rows: &'static [KeyRow],
}
