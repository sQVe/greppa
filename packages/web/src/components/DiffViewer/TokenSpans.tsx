import type { ThemedToken } from 'shiki';

interface TokenSpansProps {
  content: string;
  tokens: ThemedToken[] | null;
}

export const TokenSpans = ({ content, tokens }: TokenSpansProps) => {
  if (tokens == null) {
    return content;
  }
  return tokens.map((token, i) => (
    // Shiki tokens have no stable identity; index keys are safe here since the list is static per render
    // oxlint-disable-next-line react/no-array-index-key
    <span key={i} style={{ color: token.color }}>
      {token.content}
    </span>
  ));
};
