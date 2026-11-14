use gpui_kit::{FontWeight, px, rgb};

use super::{syntax::SyntaxPalette, tokens::DirectionTokens};
use crate::theme::{Colors, Theme};

pub(super) fn tokens() -> DirectionTokens {
    let mut theme = Theme::light();
    theme.colors = Colors {
        background: rgb(0xe8eaed),
        surface: rgb(0xeef0f2),
        foreground: rgb(0x252a32),
        muted: rgb(0x505862),
        border: rgb(0x666e79),
        accent: rgb(0x274e77),
        selected: rgb(0xd4dce5),
        added: rgb(0x28633c),
        modified: rgb(0x76501c),
        deleted: rgb(0xa12e3b),
    };
    theme.radius.small = px(3.0);
    theme.radius.medium = px(3.0);
    theme.text.row = px(12.0);
    theme.text.counts = px(11.0);
    theme.text.selected_weight = FontWeight::MEDIUM;
    theme.review.line_height = px(16.0);

    DirectionTokens {
        theme,
        editor: rgb(0xf6f7f8),
        outline: rgb(0xb9bfc7),
        header: rgb(0xeef0f2),
        note: rgb(0xf6f7f8),
        note_edge: rgb(0x666e79),
        button: rgb(0x274e77),
        button_text: rgb(0xf6f7f8),
        added: rgb(0xebf2ed),
        removed: rgb(0xf6eaea),
        word: rgb(0xd4dce5),
        syntax: SyntaxPalette::latte(),
    }
    .prepare()
}
