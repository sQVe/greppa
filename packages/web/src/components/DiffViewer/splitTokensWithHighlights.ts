import type { CharRange } from '../../fixtures/types';
import type { HighlightToken } from '../../workers/highlightProtocol';

export interface HighlightedToken {
  content: string;
  color: string | undefined;
  highlighted: boolean;
}

export const splitTokensWithHighlights = (
  tokens: HighlightToken[] | null,
  charRanges: CharRange[] | undefined,
  fallbackContent?: string,
): HighlightedToken[] => {
  const effectiveTokens: HighlightToken[] =
    tokens ?? (fallbackContent != null ? [{ content: fallbackContent }] : []);

  if (effectiveTokens.length === 0) {
    return [];
  }

  if (charRanges == null || charRanges.length === 0) {
    return effectiveTokens.map((token) => ({ content: token.content, color: token.color, highlighted: false }));
  }

  const sorted = [...charRanges].toSorted((a, b) => a.startColumn - b.startColumn);
  const result: HighlightedToken[] = [];
  let col = 1;

  for (const token of effectiveTokens) {
    const tokenStart = col;
    const tokenEnd = col + token.content.length;
    let cursor = tokenStart;

    for (const range of sorted) {
      const hlStart = Math.max(range.startColumn, tokenStart, cursor);
      const hlEnd = Math.min(range.endColumn, tokenEnd);

      if (hlStart >= tokenEnd || hlEnd <= hlStart) {
        continue;
      }

      if (hlStart > cursor) {
        result.push({
          content: token.content.slice(cursor - tokenStart, hlStart - tokenStart),
          color: token.color,
          highlighted: false,
        });
      }

      result.push({
        content: token.content.slice(hlStart - tokenStart, hlEnd - tokenStart),
        color: token.color,
        highlighted: true,
      });

      cursor = hlEnd;
    }

    if (cursor < tokenEnd) {
      result.push({
        content: token.content.slice(cursor - tokenStart),
        color: token.color,
        highlighted: false,
      });
    }

    col = tokenEnd;
  }

  return result;
};
