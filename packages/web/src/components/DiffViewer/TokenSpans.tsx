import type { CharRange, LineType } from '../../fixtures/types';
import type { HighlightToken } from '../../workers/highlightProtocol';
import { splitTokensWithHighlights } from './splitTokensWithHighlights';
import { getTokenColorClass } from './tokenStylesheet';

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

    return segments.map((segment, i) => {
      const colorClass = getTokenColorClass(segment.color);
      let className = colorClass;

      if (segment.highlighted) {
        className = colorClass != null ? `${hlClass} ${colorClass}` : hlClass;
      }

      return (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} className={className}>
          {segment.content}
        </span>
      );
    });
  }

  if (tokens == null) {
    return content;
  }

  return tokens.map((token, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <span key={i} className={getTokenColorClass(token.color)}>
      {token.content}
    </span>
  ));
};
