// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../fixtures/types';
import { buildTokenEntries, diffLineKey, useSyntaxHighlighting } from './useSyntaxHighlighting';

vi.mock('shiki', () => ({
  createHighlighter: () => Promise.resolve(null),
}));

const singleHunkDiff: DiffFile = {
  path: 'src/foo.ts',
  changeType: 'modified',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,3 +1,4 @@',
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 4,
      lines: [
        { lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1;' },
        {
          lineType: 'removed',
          oldLineNumber: 2,
          newLineNumber: null,
          content: 'const b = 2;',
        },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 2, content: 'const b = 3;' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 3, content: 'const c = 4;' },
        { lineType: 'context', oldLineNumber: 3, newLineNumber: 4, content: '' },
      ],
    },
  ],
};

const multiHunkDiff: DiffFile = {
  path: 'src/bar.ts',
  changeType: 'modified',
  language: 'typescript',
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 2,
      lines: [
        { lineType: 'removed', oldLineNumber: 1, newLineNumber: null, content: 'const x = 1;' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 1, content: 'const x = 2;' },
      ],
    },
    {
      header: '@@ -10,2 +10,2 @@',
      oldStart: 10,
      oldCount: 2,
      newStart: 10,
      newCount: 2,
      lines: [
        { lineType: 'removed', oldLineNumber: 10, newLineNumber: null, content: 'const y = 1;' },
        { lineType: 'added', oldLineNumber: null, newLineNumber: 10, content: 'const y = 2;' },
      ],
    },
  ],
};

describe('diffLineKey', () => {
  it('includes line type and both line numbers', () => {
    expect(
      diffLineKey({ lineType: 'context', oldLineNumber: 1, newLineNumber: 1, content: '' }),
    ).toBe('context:1:1');
  });

  it('uses empty string for null line numbers', () => {
    expect(
      diffLineKey({ lineType: 'removed', oldLineNumber: 5, newLineNumber: null, content: '' }),
    ).toBe('removed:5:');
    expect(
      diffLineKey({ lineType: 'added', oldLineNumber: null, newLineNumber: 3, content: '' }),
    ).toBe('added::3');
  });
});

describe('buildTokenEntries', () => {
  it('splits lines into old and new entry lists', () => {
    const { oldEntries, newEntries } = buildTokenEntries(singleHunkDiff);
    expect(oldEntries.map((e) => e.content)).toEqual(['const a = 1;', 'const b = 2;', '']);
    expect(newEntries.map((e) => e.content)).toEqual([
      'const a = 1;',
      'const b = 3;',
      'const c = 4;',
      '',
    ]);
  });

  it('inserts empty separator entries between hunks', () => {
    const { oldEntries, newEntries } = buildTokenEntries(multiHunkDiff);
    expect(oldEntries[1]).toEqual({ key: '', content: '' });
    expect(newEntries[1]).toEqual({ key: '', content: '' });
  });

  it('assigns diffLineKey as the key for each entry', () => {
    const { oldEntries } = buildTokenEntries(singleHunkDiff);
    expect(oldEntries[0]?.key).toBe('context:1:1');
    expect(oldEntries[1]?.key).toBe('removed:2:');
  });
});

describe('useSyntaxHighlighting', () => {
  it('returns null token map when diff is null', () => {
    const { result } = renderHook(() => useSyntaxHighlighting(null, 'catppuccin-mocha'));
    expect(result.current).toBeNull();
  });

  it('returns null token map when highlighter has not loaded', () => {
    const { result } = renderHook(() => useSyntaxHighlighting(singleHunkDiff, 'catppuccin-mocha'));
    expect(result.current).toBeNull();
  });
});
