import type { HighlightToken } from '../../workers/highlightProtocol';

interface TokenSpansProps {
  content: string;
  tokens: HighlightToken[] | null;
}

export const TokenSpans = ({ content, tokens }: TokenSpansProps) => {
  if (tokens == null) {
    return content;
  }
  return tokens.map((token, i) => (
    // Token lists are static per render; index keys are safe
    // oxlint-disable-next-line react/no-array-index-key
    <span key={i} style={{ color: token.color }}>
      {token.content}
    </span>
  ));
};
