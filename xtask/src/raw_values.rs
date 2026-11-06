use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context as _;

const UI_SOURCE: &str = "crates/greppa-ui/src";
const THEME_FILE: &str = "theme.rs";

const RAW_CALLS: &[&str] = &["px", "rems", "rems_from_px", "rgb", "rgba", "hsla", "hsl"];

const NAMED_COLORS: &[&str] = &[
    "white",
    "black",
    "red",
    "green",
    "blue",
    "yellow",
    "transparent_black",
    "transparent_white",
    "opaque_grey",
];

const CONSTRUCTORS: &[&str] = &["Pixels", "Rgba", "Hsla"];

// The style helpers that encode a fixed scale. `full` and `auto` are left out: they are relative
// layout values with no raw length, such as `size_full`.
const BOX_PREFIXES: &[&str] = &[
    "w", "h", "size", "min_size", "min_w", "min_h", "max_size", "max_w", "max_h", "gap", "gap_x",
    "gap_y", "p", "pt", "pb", "px", "py", "pl", "pr", "m", "mt", "mb", "my", "mx", "ml", "mr",
    "inset", "top", "bottom", "left", "right",
];

const BORDER_PREFIXES: &[&str] = &[
    "border", "border_t", "border_b", "border_r", "border_l", "border_x", "border_y",
];

const CORNER_PREFIXES: &[&str] = &[
    "rounded",
    "rounded_t",
    "rounded_b",
    "rounded_r",
    "rounded_l",
    "rounded_tl",
    "rounded_tr",
    "rounded_bl",
    "rounded_br",
];

const BOX_SUFFIXES: &[&str] = &[
    "0", "0p5", "1", "1p5", "2", "2p5", "3", "3p5", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    "16", "20", "24", "32", "40", "48", "56", "64", "72", "80", "96", "112", "128", "px", "1_2",
    "1_3", "2_3", "1_4", "2_4", "3_4", "1_5", "2_5", "3_5", "4_5", "1_6", "5_6", "1_12",
];

const BORDER_SUFFIXES: &[&str] = &[
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "16", "20", "24", "32",
];

const CORNER_SUFFIXES: &[&str] = &["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];

const TEXT_SUFFIXES: &[&str] = &["xs", "sm", "base", "lg", "xl", "2xl", "3xl"];

pub(crate) fn check(root: &Path) -> anyhow::Result<()> {
    let directory = root.join(UI_SOURCE);
    let failures = scan_directory(root, &directory)?;

    if failures.is_empty() {
        return Ok(());
    }

    anyhow::bail!("{}", failures.join("\n"))
}

fn scan_directory(root: &Path, directory: &Path) -> anyhow::Result<Vec<String>> {
    let mut files = Vec::new();
    collect_files(directory, &mut files)?;
    files.sort();

    let theme_file = directory.join(THEME_FILE);
    let mut failures = Vec::new();

    for file in files {
        if file == theme_file {
            continue;
        }

        let source = fs::read_to_string(&file)
            .with_context(|| format!("Could not read {}", file.display()))?;
        let path = file
            .strip_prefix(root)
            .unwrap_or(&file)
            .display()
            .to_string();

        failures.extend(scan_source(&path, &source));
    }

    Ok(failures)
}

fn collect_files(directory: &Path, files: &mut Vec<PathBuf>) -> anyhow::Result<()> {
    let entries = fs::read_dir(directory)
        .with_context(|| format!("Could not list {}", directory.display()))?;

    for entry in entries {
        let entry = entry.with_context(|| "Could not read an entry")?;
        let path = entry.path();

        if path.is_dir() {
            collect_files(&path, files)?;
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("rs") {
            files.push(path);
        }
    }

    Ok(())
}

fn scan_source(path: &str, source: &str) -> Vec<String> {
    let masked = mask_source(source);
    let mut failures = Vec::new();
    let mut cursor = 0;
    let mut reported_line = None;

    while let Some(offset) = next_raw_value(&masked, cursor) {
        let line = line_number(&masked, offset);

        if reported_line != Some(line) {
            let text = source.lines().nth(line - 1).unwrap_or("");

            failures.push(format!("{path}:{line}: {}", text.trim()));
            reported_line = Some(line);
        }

        cursor = offset + 1;
    }

    failures
}

fn line_number(masked: &str, offset: usize) -> usize {
    masked[..offset]
        .bytes()
        .filter(|byte| *byte == b'\n')
        .count()
        + 1
}

fn next_raw_value(text: &str, from: usize) -> Option<usize> {
    let mut earliest: Option<usize> = None;
    let mut consider = |candidate: Option<usize>| {
        if let Some(offset) = candidate {
            earliest = Some(earliest.map_or(offset, |current| current.min(offset)));
        }
    };

    for name in RAW_CALLS {
        consider(find_bare_call(text, from, name));
    }

    for name in NAMED_COLORS {
        consider(find_bare_call(text, from, name));
    }

    for name in CONSTRUCTORS {
        consider(find_constructor(text, from, name));
    }

    consider(find_hex_color(text, from));
    consider(find_preset_helper(text, from));

    earliest
}

#[cfg(test)]
fn line_has_raw_value(text: &str) -> bool {
    next_raw_value(text, 0).is_some()
}

fn find_constructor(text: &str, from: usize, name: &str) -> Option<usize> {
    let from_call = format!("{name}::from");
    let mut earliest: Option<usize> = None;
    let mut consider = |candidate: Option<usize>| {
        if let Some(offset) = candidate {
            earliest = Some(earliest.map_or(offset, |current| current.min(offset)));
        }
    };

    consider(find_bare_call(text, from, &from_call));
    consider(find_bare_call(text, from, name));
    consider(find_bare_struct_literal(text, from, name));

    earliest
}

fn find_bare_struct_literal(text: &str, from: usize, name: &str) -> Option<usize> {
    let mut start = from;

    while let Some(offset) = text[start..].find(name) {
        let index = start + offset;
        let before = text[..index].chars().next_back();
        let is_member = before == Some('.') || before.is_some_and(is_identifier_char);

        if is_member || preceded_by_arrow(text, index) {
            start = index + name.len();
            continue;
        }

        let rest = text[index + name.len()..].trim_start();

        if let Some(fields) = rest.strip_prefix('{')
            && starts_with_struct_fields(fields.trim_start(), name)
        {
            return Some(index);
        }

        start = index + name.len();
    }

    None
}

fn preceded_by_arrow(text: &str, index: usize) -> bool {
    text[..index].trim_end().ends_with("->")
}

fn starts_with_struct_fields(fields: &str, name: &str) -> bool {
    if fields.starts_with("..") {
        return true;
    }

    let field_prefixes: &[&str] = match name {
        "Rgba" => &["r:", "g:", "b:", "a:"],
        "Hsla" => &["h:", "s:", "l:", "a:"],
        _ => return false,
    };

    field_prefixes
        .iter()
        .any(|prefix| fields.starts_with(prefix))
}

fn find_bare_call(text: &str, from: usize, name: &str) -> Option<usize> {
    let mut start = from;

    while let Some(offset) = text[start..].find(name) {
        let index = start + offset;
        let before = text[..index].chars().next_back();
        let called_as_method = before == Some('.');
        let inside_identifier = before.is_some_and(is_identifier_char);

        if !called_as_method && !inside_identifier {
            let after = text[index + name.len()..].trim_start();

            if after.starts_with('(') {
                return Some(index);
            }
        }

        start = index + name.len();
    }

    None
}

fn find_hex_color(text: &str, from: usize) -> Option<usize> {
    let mut start = from;

    while let Some(offset) = text[start..].find("0x") {
        let index = start + offset;
        let digits: String = text[index + 2..]
            .chars()
            .take_while(|character| character.is_ascii_hexdigit())
            .collect();
        let after = text[index + 2 + digits.len()..].chars().next();
        let is_color_length = digits.len() == 6 || digits.len() == 8;

        if is_color_length && !after.is_some_and(is_identifier_char) {
            return Some(index);
        }

        start = index + 2;
    }

    None
}

fn find_preset_helper(text: &str, from: usize) -> Option<usize> {
    let mut index = from;

    while let Some(offset) = text[index..].find('.') {
        let dot = index + offset;
        let name_start = dot + 1;
        let name_end = identifier_end(text, name_start);

        if name_end > name_start {
            let name = &text[name_start..name_end];

            if text[name_end..].trim_start().starts_with('(') && is_preset_helper(name) {
                return Some(dot);
            }
        }

        index = name_start;
    }

    None
}

fn identifier_end(text: &str, start: usize) -> usize {
    let mut end = start;

    for (offset, character) in text[start..].char_indices() {
        if character.is_ascii_alphanumeric() || character == '_' {
            end = start + offset + character.len_utf8();
        } else {
            break;
        }
    }

    end
}

fn is_preset_helper(name: &str) -> bool {
    has_prefix_and_suffix(name, BOX_PREFIXES, BOX_SUFFIXES)
        || has_prefix_and_suffix(name, BORDER_PREFIXES, BORDER_SUFFIXES)
        || has_prefix_and_suffix(name, CORNER_PREFIXES, CORNER_SUFFIXES)
        || has_prefix_and_suffix(name, &["text"], TEXT_SUFFIXES)
}

fn has_prefix_and_suffix(name: &str, prefixes: &[&str], suffixes: &[&str]) -> bool {
    prefixes.iter().any(|prefix| {
        let Some(rest) = name.strip_prefix(prefix) else {
            return false;
        };
        let Some(suffix) = rest.strip_prefix('_') else {
            return false;
        };

        suffixes.contains(&suffix)
    })
}

fn is_identifier_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

fn mask_source(source: &str) -> String {
    let characters: Vec<char> = source.chars().collect();
    let mut masked = String::with_capacity(source.len());
    let mut index = 0;

    while index < characters.len() {
        if starts_with(&characters, index, &['/', '/']) {
            index = skip_line_comment(&characters, index, &mut masked);
        } else if starts_with(&characters, index, &['/', '*']) {
            index = skip_block_comment(&characters, index, &mut masked);
        } else if let Some(end) = raw_string_end(&characters, index) {
            mask_range(&characters, index, end, &mut masked);
            index = end;
        } else if characters[index] == '"' {
            index = skip_quoted(&characters, index, &mut masked);
        } else if characters[index] == '\'' {
            index = skip_char_or_lifetime(&characters, index, &mut masked);
        } else {
            masked.push(characters[index]);
            index += 1;
        }
    }

    masked
}

fn starts_with(characters: &[char], index: usize, pattern: &[char]) -> bool {
    characters.len() >= index + pattern.len()
        && characters[index..index + pattern.len()] == *pattern
}

fn push_masked(masked: &mut String, character: char) {
    if character == '\n' {
        masked.push('\n');
    } else {
        masked.push(' ');
    }
}

fn mask_range(characters: &[char], start: usize, end: usize, masked: &mut String) {
    for character in characters.iter().take(end).skip(start) {
        push_masked(masked, *character);
    }
}

fn skip_line_comment(characters: &[char], mut index: usize, masked: &mut String) -> usize {
    while index < characters.len() && characters[index] != '\n' {
        push_masked(masked, characters[index]);
        index += 1;
    }

    index
}

fn skip_block_comment(characters: &[char], mut index: usize, masked: &mut String) -> usize {
    let mut depth = 0;

    while index < characters.len() {
        if starts_with(characters, index, &['/', '*']) {
            depth += 1;
            push_masked(masked, '/');
            push_masked(masked, '*');
            index += 2;
        } else if starts_with(characters, index, &['*', '/']) {
            depth -= 1;
            push_masked(masked, '*');
            push_masked(masked, '/');
            index += 2;

            if depth == 0 {
                break;
            }
        } else {
            push_masked(masked, characters[index]);
            index += 1;
        }
    }

    index
}

fn skip_quoted(characters: &[char], mut index: usize, masked: &mut String) -> usize {
    push_masked(masked, '"');
    index += 1;

    while index < characters.len() {
        let character = characters[index];

        if character == '\\' && index + 1 < characters.len() {
            push_masked(masked, character);
            push_masked(masked, characters[index + 1]);
            index += 2;
            continue;
        }

        push_masked(masked, character);
        index += 1;

        if character == '"' {
            break;
        }
    }

    index
}

fn skip_char_or_lifetime(characters: &[char], index: usize, masked: &mut String) -> usize {
    if characters.get(index + 1) == Some(&'\\') {
        push_masked(masked, '\'');
        let mut cursor = index + 1;

        while cursor < characters.len() {
            push_masked(masked, characters[cursor]);

            if characters[cursor] == '\'' && cursor > index + 1 {
                cursor += 1;
                break;
            }

            cursor += 1;
        }

        return cursor;
    }

    if let (Some(&single), Some(&closing)) = (characters.get(index + 1), characters.get(index + 2))
        && closing == '\''
    {
        push_masked(masked, '\'');
        push_masked(masked, single);
        push_masked(masked, '\'');
        return index + 3;
    }

    masked.push('\'');
    index + 1
}

fn raw_string_end(characters: &[char], index: usize) -> Option<usize> {
    let mut cursor = index;

    if characters.get(cursor) == Some(&'b') {
        cursor += 1;
    }

    if characters.get(cursor) != Some(&'r') {
        return None;
    }

    cursor += 1;
    let mut hashes = 0;

    while characters.get(cursor) == Some(&'#') {
        hashes += 1;
        cursor += 1;
    }

    if characters.get(cursor) != Some(&'"') {
        return None;
    }

    cursor += 1;

    while cursor < characters.len() {
        if characters[cursor] == '"' {
            let mut closing = 0;

            while characters.get(cursor + 1 + closing) == Some(&'#') {
                closing += 1;
            }

            if closing == hashes {
                return Some(cursor + 1 + hashes);
            }
        }

        cursor += 1;
    }

    Some(characters.len())
}

#[cfg(test)]
mod tests {
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
}
