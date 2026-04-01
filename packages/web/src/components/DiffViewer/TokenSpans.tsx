import type { CharRange, LineType } from '../../fixtures/types';
import type { HighlightToken } from '../../workers/highlightProtocol';
import { splitTokensWithHighlights } from './splitTokensWithHighlights';

import styles from './DiffViewer.module.css';

interface TokenSpansProps {
  content: string;
  tokens: HighlightToken[] | null;
  charRanges?: CharRange[];
  lineType?: LineType;
}

const highlightClass = (lineType: LineType | undefined) => {
  if (lineType === 'removed') {
    return styles.charRemoved;
  }
  if (lineType === 'added') {
    return styles.charAdded;
  }

  return '';
};

export const TokenSpans = ({ content, tokens, charRanges, lineType }: TokenSpansProps) => {
  if (charRanges != null && charRanges.length > 0) {
    const segments = splitTokensWithHighlights(tokens, charRanges, content);
    const hlClass = highlightClass(lineType);

    return segments.map((segment, i) => (
      // Token lists are static per render; index keys are safe
      // oxlint-disable-next-line react/no-array-index-key
      <span
        key={i}
        className={segment.highlighted ? hlClass : undefined}
        style={segment.color != null ? { color: segment.color } : undefined}
      >
        {segment.content}
      </span>
    ));
  }

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
