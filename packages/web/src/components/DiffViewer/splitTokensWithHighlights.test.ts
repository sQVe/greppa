import { describe, expect, it } from 'vitest';

import type { CharRange } from '../../fixtures/types';
import type { HighlightToken } from '../../workers/highlightProtocol';
import { splitTokensWithHighlights } from './splitTokensWithHighlights';

describe('splitTokensWithHighlights', () => {
  it('returns tokens unchanged when no charRanges provided', () => {
    const tokens: HighlightToken[] = [{ content: 'hello', color: '#fff' }];
    const result = splitTokensWithHighlights(tokens, undefined);
    expect(result).toEqual([{ content: 'hello', color: '#fff', highlighted: false }]);
  });

  it('returns tokens unchanged when charRanges is empty', () => {
    const tokens: HighlightToken[] = [{ content: 'hello', color: '#fff' }];
    const result = splitTokensWithHighlights(tokens, []);
    expect(result).toEqual([{ content: 'hello', color: '#fff', highlighted: false }]);
  });

  it('highlights entire token when charRange covers it fully', () => {
    const tokens: HighlightToken[] = [{ content: 'hello', color: '#fff' }];
    const ranges: CharRange[] = [{ startColumn: 1, endColumn: 6 }];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([{ content: 'hello', color: '#fff', highlighted: true }]);
  });

  it('splits token when charRange covers partial start', () => {
    const tokens: HighlightToken[] = [{ content: 'hello', color: '#fff' }];
    const ranges: CharRange[] = [{ startColumn: 1, endColumn: 4 }];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([
      { content: 'hel', color: '#fff', highlighted: true },
      { content: 'lo', color: '#fff', highlighted: false },
    ]);
  });

  it('splits token when charRange covers middle', () => {
    const tokens: HighlightToken[] = [{ content: 'hello', color: '#fff' }];
    const ranges: CharRange[] = [{ startColumn: 2, endColumn: 4 }];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([
      { content: 'h', color: '#fff', highlighted: false },
      { content: 'el', color: '#fff', highlighted: true },
      { content: 'lo', color: '#fff', highlighted: false },
    ]);
  });

  it('handles multiple tokens with a charRange spanning across them', () => {
    const tokens: HighlightToken[] = [
      { content: 'const', color: '#c00' },
      { content: ' ', color: undefined },
      { content: 'x', color: '#0f0' },
    ];
    const ranges: CharRange[] = [{ startColumn: 4, endColumn: 7 }];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([
      { content: 'con', color: '#c00', highlighted: false },
      { content: 'st', color: '#c00', highlighted: true },
      { content: ' ', color: undefined, highlighted: true },
      { content: 'x', color: '#0f0', highlighted: false },
    ]);
  });

  it('handles Infinity endColumn (highlights to end of line)', () => {
    const tokens: HighlightToken[] = [
      { content: 'abc', color: '#fff' },
      { content: 'def', color: '#aaa' },
    ];
    const ranges: CharRange[] = [{ startColumn: 2, endColumn: Infinity }];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([
      { content: 'a', color: '#fff', highlighted: false },
      { content: 'bc', color: '#fff', highlighted: true },
      { content: 'def', color: '#aaa', highlighted: true },
    ]);
  });

  it('handles multiple non-overlapping charRanges', () => {
    const tokens: HighlightToken[] = [{ content: 'abcdefgh', color: '#fff' }];
    const ranges: CharRange[] = [
      { startColumn: 2, endColumn: 4 },
      { startColumn: 6, endColumn: 8 },
    ];
    const result = splitTokensWithHighlights(tokens, ranges);
    expect(result).toEqual([
      { content: 'a', color: '#fff', highlighted: false },
      { content: 'bc', color: '#fff', highlighted: true },
      { content: 'de', color: '#fff', highlighted: false },
      { content: 'fg', color: '#fff', highlighted: true },
      { content: 'h', color: '#fff', highlighted: false },
    ]);
  });

  it('handles plain content string when no tokens exist', () => {
    const result = splitTokensWithHighlights(null, [{ startColumn: 2, endColumn: 4 }], 'hello');
    expect(result).toEqual([
      { content: 'h', color: undefined, highlighted: false },
      { content: 'el', color: undefined, highlighted: true },
      { content: 'lo', color: undefined, highlighted: false },
    ]);
  });
});
