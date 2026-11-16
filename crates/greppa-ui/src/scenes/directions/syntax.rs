use std::ops::Range;

use gpui_kit::{HighlightStyle, Rgba, rgb};
use ra_ap_rustc_lexer::{FrontmatterAllowed, LiteralKind, TokenKind, tokenize};

#[derive(Clone, Copy)]
pub(crate) struct SyntaxPalette {
    pub keyword: Rgba,
    pub string: Rgba,
    pub number: Rgba,
    pub kind: Rgba,
    pub function: Rgba,
    pub operator: Rgba,
    pub comment: Rgba,
    pub text: Rgba,
}

impl SyntaxPalette {
    pub(super) fn latte() -> Self {
        Self {
            keyword: rgb(0x8839ef),
            string: rgb(0x40a02b),
            number: rgb(0xfe640b),
            kind: rgb(0xdf8e1d),
            function: rgb(0x1e66f5),
            operator: rgb(0x179299),
            comment: rgb(0x8c8fa1),
            text: rgb(0x4c4f69),
        }
    }

    #[cfg(test)]
    pub(super) fn colors(&self) -> [(&'static str, Rgba); 8] {
        [
            ("Mauve / keyword", self.keyword),
            ("Green / string", self.string),
            ("Peach / number", self.number),
            ("Yellow / type", self.kind),
            ("Blue / function", self.function),
            ("Teal / operator", self.operator),
            ("Overlay1 / comment", self.comment),
            ("Text / identifier", self.text),
        ]
    }
}

pub(crate) fn highlight(
    language: &str,
    source: &str,
    palette: SyntaxPalette,
    word: Rgba,
) -> Vec<(Range<usize>, HighlightStyle)> {
    if language != "rust" {
        return Vec::new();
    }

    let mut styles = Vec::new();
    let mut start = 0;
    let mut target_marked = false;
    for token in tokenize(source, FrontmatterAllowed::No) {
        let end = start + token.len as usize;
        let text = &source[start..end];
        let color = token_color(&token.kind, text, &source[end..], &palette);
        let target_identifier = matches!(token.kind, TokenKind::Ident) && text == "from_utf8_lossy";
        let background_color = if target_identifier && !target_marked {
            target_marked = true;
            Some(word.into())
        } else {
            None
        };
        styles.push((
            start..end,
            HighlightStyle {
                color: Some(color.into()),
                background_color,
                ..Default::default()
            },
        ));
        start = end;
    }
    styles
}

fn token_color(kind: &TokenKind, text: &str, following: &str, palette: &SyntaxPalette) -> Rgba {
    match kind {
        TokenKind::LineComment { .. } | TokenKind::BlockComment { .. } => palette.comment,
        TokenKind::Literal {
            kind: LiteralKind::Int { .. } | LiteralKind::Float { .. },
            ..
        } => palette.number,
        TokenKind::Literal { .. } => palette.string,
        TokenKind::Ident | TokenKind::RawIdent => match text {
            "as" | "async" | "await" | "break" | "const" | "continue" | "crate" | "dyn"
            | "else" | "enum" | "extern" | "fn" | "for" | "if" | "impl" | "in" | "let" | "loop"
            | "match" | "mod" | "move" | "mut" | "pub" | "ref" | "return" | "self" | "static"
            | "struct" | "super" | "trait" | "type" | "unsafe" | "use" | "where" | "while" => {
                palette.keyword
            }
            "true" | "false" => palette.number,
            _ if text.chars().next().is_some_and(char::is_uppercase) => palette.kind,
            _ if following.trim_start().starts_with('(') => palette.function,
            _ => palette.text,
        },
        _ => match text {
            "=" | "!" | "&" | "|" | "+" | "-" | "*" | "/" | "?" | "<" | ">" => palette.operator,
            _ => palette.text,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rust_tokens_get_latte_styles_and_only_the_first_target_identifier_gets_a_background() {
        let source = "// from_utf8_lossy\nlet label = \"from_utf8_lossy\"; let paths = String::from_utf8_lossy(bytes); from_utf8_lossy(other);";
        let palette = SyntaxPalette::latte();
        let word = rgb(0xdde3ed);
        let styles = highlight("rust", source, palette, word);
        let tokens: Vec<_> = styles
            .iter()
            .map(|(range, style)| (&source[range.clone()], style))
            .collect();

        assert!(
            tokens.iter().any(
                |(token, style)| *token == "let" && style.color == Some(palette.keyword.into())
            )
        );
        assert!(
            tokens.iter().any(
                |(token, style)| *token == "String" && style.color == Some(palette.kind.into())
            )
        );
        assert!(
            tokens
                .iter()
                .any(|(token, style)| *token == "\"from_utf8_lossy\""
                    && style.color == Some(palette.string.into()))
        );
        let selected: Vec<_> = tokens
            .iter()
            .filter(|(_, style)| style.background_color.is_some())
            .collect();
        assert_eq!(selected.len(), 1);
        assert_eq!(selected[0].0, "from_utf8_lossy");
        assert_eq!(selected[0].1.background_color, Some(word.into()));
    }

    #[test]
    fn syntax_ranges_keep_unicode_boundaries_and_ignore_non_rust_sources() {
        let palette = SyntaxPalette::latte();
        let source = "let café = \"日本語\";";
        let styles = highlight("rust", source, palette, palette.text);

        assert!(!styles.is_empty());
        assert!(
            styles
                .iter()
                .all(|(range, _)| source.get(range.clone()).is_some())
        );
        assert!(highlight("toml", source, palette, palette.text).is_empty());
    }
}
