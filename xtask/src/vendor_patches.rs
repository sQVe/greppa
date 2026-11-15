use std::fs;

const SELECTION_SOURCE: &str = "vendor/gpui-component/src/diff/selection.rs";

const SELECTION_PATCH: [&str; 2] = [
    "// GREPPA: insert first so inline change backgrounds win over the selection background.",
    "layers.insert(0, (",
];

#[test]
fn selection_layer_patch_is_applied() {
    let path = crate::workspace_root().join(SELECTION_SOURCE);
    let source = fs::read_to_string(&path).expect("read the vendored selection.rs");
    let lines: Vec<&str> = source.lines().map(str::trim).collect();

    let patched = lines
        .windows(SELECTION_PATCH.len())
        .any(|window| window == SELECTION_PATCH);

    assert!(
        patched,
        "{SELECTION_SOURCE} lacks the selection layer patch in CodeText::request_layout; \
         apply it again as vendor/gpui-component/PATCHES.md describes"
    );
}
