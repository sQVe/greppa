use super::*;

#[test]
fn scan_reports_a_literal_with_its_path_and_line() {
    let source = "fn scene() {\n    let width = px(3.0);\n}\n";

    assert_eq!(
        scan_source("src/scenes/a.rs", source),
        ["src/scenes/a.rs:2: let width = px(3.0);"]
    );
}

#[test]
fn scan_ignores_comment_lines() {
    let source = "// let width = px(3.0);\n";

    assert_eq!(scan_source("src/a.rs", source), Vec::<String>::new());
}

#[test]
fn scan_ignores_raw_text_in_strings_and_comments() {
    let source = "\
let label = String::from(\"rgb(0x112233)\");\n\
let detail = r\"px(3.0) Pixels(3.0)\";\n\
let row = theme.text.row; // instead of px(3.0)\n\
/* px(3.0)\n   rgb(0x112233) */\n\
let other = \"white()\";\n";

    assert_eq!(scan_source("src/a.rs", source), Vec::<String>::new());
}

#[test]
fn scan_reports_constructor_literals() {
    let cases = [
        "let x = Pixels::from(3.0);",
        "let x = Pixels(3.0);",
        "let x = Rgba { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };",
        "let x = Hsla { h: 0.0, s: 0.0, l: 0.0, a: 1.0 };",
        "let x = Rgba::from(0.0);",
        "let x = Hsla::from(0.0);",
    ];

    for case in cases {
        assert!(line_has_raw_value(case), "not reported: {case}");
    }
}

#[test]
fn scan_reports_a_multiline_struct_literal_at_its_start_line() {
    let source = "\
let color = Rgba {\n\
    r: 0.1,\n\
    g: 0.2,\n\
    b: 0.3,\n\
    a: 1.0,\n\
};\n\
let other = Hsla {\n\
    h: 0.1,\n\
    s: 0.2,\n\
    l: 0.3,\n\
    a: 1.0,\n\
};\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        [
            "src/a.rs:1: let color = Rgba {",
            "src/a.rs:7: let other = Hsla {",
        ]
    );
}

#[test]
fn scan_reports_spaced_and_multiline_calls_at_their_start_line() {
    let source = "\
let a = hsla (0.1, 0.2, 0.3, 1.0);\n\
let b = px\n\
    (3.0);\n\
let c = rgb\n\
    (1, 2, 3);\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        [
            "src/a.rs:1: let a = hsla (0.1, 0.2, 0.3, 1.0);",
            "src/a.rs:2: let b = px",
            "src/a.rs:4: let c = rgb",
        ]
    );
}

#[test]
fn scan_ignores_a_return_type_and_reports_the_body_literal() {
    let source = "fn color() -> Rgba {\n    Rgba { r: 0.1, g: 0.2, b: 0.3, a: 1.0 }\n}\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        ["src/a.rs:2: Rgba { r: 0.1, g: 0.2, b: 0.3, a: 1.0 }"]
    );
}

#[test]
fn scan_allows_length_and_color_types() {
    let allowed = [
        "fn f(size: Pixels) -> Pixels { size }",
        "let color: Rgba = theme.colors.surface;",
        "fn color() -> Rgba { theme.colors.surface }",
        "let weight: FontWeight = theme.text.selected_weight;",
    ];

    for case in allowed {
        assert!(!line_has_raw_value(case), "wrongly reported: {case}");
    }
}

#[test]
fn scan_reports_each_kind_of_raw_value() {
    let cases = [
        "let x = px(3.0);",
        "let x = rems(0.5);",
        "let x = rems_from_px(3.0);",
        "let x = rgb(0x112233);",
        "let x = rgba(0x11223344);",
        "let x = hsla(0.5, 0.5, 0.5, 1.0);",
        "let x = hsl(0.5, 0.5, 0.5);",
        "let x = 0x112233;",
        "let x = white();",
        "let x = black();",
        "let x = transparent_black();",
        "div().p_2();",
        "div().gap_1();",
        "div().text_sm();",
        "div().rounded_md();",
        "div().w_64();",
        "div().border_l_2();",
    ];

    for case in cases {
        assert!(line_has_raw_value(case), "not reported: {case}");
    }
}

#[test]
fn scan_allows_theme_tokens_and_relative_layout() {
    let allowed = [
        "div().px(theme.spacing.small);",
        "div().bg(theme.colors.surface);",
        "div().size_full();",
        "div().w_full();",
        "div().text_color(theme.colors.foreground);",
        "div().text_size(theme.text.row);",
    ];

    for case in allowed {
        assert!(!line_has_raw_value(case), "wrongly reported: {case}");
    }
}

#[test]
fn scan_directory_exempts_theme_file() {
    let directory = crate::test_support::temporary_directory();
    fs::write(directory.path().join("theme.rs"), "let x = px(3.0);\n").expect("write theme");
    fs::write(directory.path().join("scene.rs"), "let y = 1.0;\n").expect("write scene");

    let failures = scan_directory(directory.path(), directory.path()).expect("scan");

    assert!(failures.is_empty());
}

#[test]
fn scan_directory_scans_a_nested_theme_file() {
    let directory = crate::test_support::temporary_directory();
    fs::create_dir_all(directory.path().join("scenes")).expect("create scenes");
    fs::write(
        directory.path().join("scenes/theme.rs"),
        "let x = px(3.0);\n",
    )
    .expect("write nested theme");

    let failures = scan_directory(directory.path(), directory.path()).expect("scan");

    assert_eq!(failures.len(), 1);
    assert!(failures[0].ends_with("theme.rs:1: let x = px(3.0);"));
}

#[test]
fn scan_directory_finds_literals_in_other_files() {
    let directory = crate::test_support::temporary_directory();
    fs::write(directory.path().join("theme.rs"), "let x = px(3.0);\n").expect("write theme");
    fs::write(
        directory.path().join("scene.rs"),
        "fn f() {\n    let y = rgb(0x112233);\n}\n",
    )
    .expect("write scene");

    let failures = scan_directory(directory.path(), directory.path()).expect("scan");

    assert_eq!(failures.len(), 1);
    assert!(failures[0].ends_with("scene.rs:2: let y = rgb(0x112233);"));
}

#[test]
fn scan_ignores_raw_values_in_nested_block_comments() {
    let source = "/* px(1); /* rgb(2); */ px(3); */\npx(4);\n";

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:2: px(4);"]);
}

#[test]
fn scan_ignores_raw_values_after_an_escaped_quote_in_a_string() {
    let source = "let s = \"a\\\" px(1)\";\nrgb(2);\n";

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:2: rgb(2);"]);
}

#[test]
fn scan_ignores_raw_values_in_hashed_raw_strings() {
    let source = r####"let s = r#"a" px(1)"#; let b = br##"a"# px(1)"##;
rgb(2);
"####;

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:2: rgb(2);"]);
}

#[test]
fn scan_reports_raw_values_after_char_literals_and_lifetimes() {
    let source = r#"let a = ['"', '\'', '\\', '\n'];
fn f<'a>(x: &'a str) {}
px(1);
"#;

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:3: px(1);"]);
}

#[test]
fn scan_reports_raw_values_after_adjacent_char_literals() {
    let source = r#"let a = ['\'','"'];
px(1);
"#;

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:2: px(1);"]);
}

#[test]
fn scan_ignores_a_final_line_comment_without_a_newline() {
    assert_eq!(scan_source("src/a.rs", "// px(1);"), Vec::<String>::new());
}

#[test]
fn scan_reports_raw_values_inside_macro_bodies() {
    let source = "format!(\"{}\", px(1));\ndiv![rgb(2)];\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        [
            "src/a.rs:1: format!(\"{}\", px(1));",
            "src/a.rs:2: div![rgb(2)];"
        ]
    );
}

#[test]
fn scan_keeps_line_numbers_after_a_multiline_raw_string() {
    let source = "let s = r#\"é\npx(1)\n\"#;\nrgb(2);\n";

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:4: rgb(2);"]);
}

#[test]
fn scan_reports_raw_values_after_a_raw_string_with_an_extra_closing_hash() {
    let source = "m!(r#\"text\"##);\npx(1);\n";

    assert_eq!(scan_source("src/a.rs", source), ["src/a.rs:2: px(1);"]);
}

#[test]
fn check_fails_with_each_raw_value_in_the_ui_source() {
    let root = crate::test_support::temporary_directory();
    let source = root.path().join(UI_SOURCE);
    fs::create_dir_all(&source).expect("create the UI source");
    fs::write(source.join("scene.rs"), "let x = px(3.0);\n").expect("write scene");

    let error = check(root.path()).expect_err("a raw value fails the check");

    assert_eq!(
        error.to_string(),
        "crates/greppa-ui/src/scene.rs:1: let x = px(3.0);"
    );
}

#[test]
fn scan_allows_names_that_end_with_a_constructor_name() {
    assert!(!line_has_raw_value("let x = MyRgba { r: 0.0 };"));
}

#[test]
fn scan_allows_an_impl_block_for_a_color_type() {
    let source = "impl Default for Rgba {\n    fn default() -> Self {\n        todo()\n    }\n}\n";

    assert_eq!(scan_source("src/a.rs", source), Vec::<String>::new());
}

#[test]
fn scan_allows_a_return_type_before_a_body_that_starts_with_a_path() {
    assert!(!line_has_raw_value("fn color() -> Rgba { a::color() }"));
}

#[test]
fn scan_allows_hex_numbers_that_are_not_color_length() {
    let allowed = ["let mask = 0xff;", "let id = 0x1122334455;"];

    for case in allowed {
        assert!(!line_has_raw_value(case), "wrongly reported: {case}");
    }
}

#[test]
fn scan_reports_raw_values_of_different_kinds_in_source_order() {
    let source = "\
let a = 0x112233;\n\
div().p_2();\n\
let b = Rgba { r: 0.1, g: 0.2, b: 0.3, a: 1.0 };\n\
let c = px(1.0);\n\
let d = Pixels::from(2.0);\n\
let e = white();\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        [
            "src/a.rs:1: let a = 0x112233;",
            "src/a.rs:2: div().p_2();",
            "src/a.rs:3: let b = Rgba { r: 0.1, g: 0.2, b: 0.3, a: 1.0 };",
            "src/a.rs:4: let c = px(1.0);",
            "src/a.rs:5: let d = Pixels::from(2.0);",
            "src/a.rs:6: let e = white();",
        ]
    );
}

#[test]
fn scan_reports_a_line_with_several_raw_values_once() {
    let source = "let a = px(1.0); let b = rgb(0x112233); div().p_2();\nlet c = Pixels(3.0);\n";

    assert_eq!(
        scan_source("src/a.rs", source),
        [
            "src/a.rs:1: let a = px(1.0); let b = rgb(0x112233); div().p_2();",
            "src/a.rs:2: let c = Pixels(3.0);",
        ]
    );
}
