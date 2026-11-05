use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context as _;
use ra_ap_rustc_lexer::{FrontmatterAllowed, LiteralKind, TokenKind, tokenize};

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
    let mut masked = String::with_capacity(source.len());
    let mut start = 0;

    for token in tokenize(source, FrontmatterAllowed::No) {
        let end = start + token.len as usize;
        let text = &source[start..end];
        let hides_text = matches!(
            token.kind,
            TokenKind::LineComment { .. }
                | TokenKind::BlockComment { .. }
                | TokenKind::Literal {
                    kind: LiteralKind::Char { .. }
                        | LiteralKind::Byte { .. }
                        | LiteralKind::Str { .. }
                        | LiteralKind::ByteStr { .. }
                        | LiteralKind::CStr { .. }
                        | LiteralKind::RawStr { .. }
                        | LiteralKind::RawByteStr { .. }
                        | LiteralKind::RawCStr { .. },
                    ..
                }
        );

        if hides_text {
            let blanks = text
                .bytes()
                .map(|byte| if byte == b'\n' { '\n' } else { ' ' });
            masked.extend(blanks);
        } else {
            masked.push_str(text);
        }

        start = end;
    }

    masked
}

#[cfg(test)]
mod tests;
